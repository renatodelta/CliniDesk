import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { processAgentMessage } from '@/lib/ai/agent';
import { sendWhatsAppMessage } from '@/lib/whatsapp/client';

export const dynamic = 'force-dynamic';

// --------------------------------------------------------------------------
// 1. ENDPOINT GET: Verificação obrigatória do Webhook pela Meta
// --------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const verifyToken = process.env.VERIFY_TOKEN || 'meu_token_secreto_123';

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('✅ Webhook da Meta verificado com sucesso!');
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  console.warn('⚠️ Tentativa de verificação do Webhook falhou. Token inválido.');
  return new NextResponse('Forbidden', { status: 403 });
}

// --------------------------------------------------------------------------
// 2. ENDPOINT POST: Recebimento das Mensagens
// --------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log('📩 [Webhook WhatsApp] Mensagem recebida:', JSON.stringify(body, null, 2));

    let senderPhone = '';
    let userText = '';
    let pushName = 'Paciente';

    // 0. Parser para a Meta WhatsApp Cloud API Oficial
    if (body.object === 'whatsapp_business_account') {
      const entry = body.entry?.[0]?.changes?.[0]?.value;

      // Ignora eventos de status (entregue, lido, etc.)
      if (!entry?.messages || entry.messages.length === 0) {
        return NextResponse.json({ status: 'ignored', reason: 'Evento de status/sem mensagens' });
      }

      const msg = entry.messages[0];
      senderPhone = msg.from?.replace(/\D/g, '') || '';
      pushName = entry.contacts?.[0]?.profile?.name || 'Paciente';

      // Extrai texto de mensagens normais ou respostas interativas
      userText =
        msg.text?.body ||
        msg.interactive?.button_reply?.title ||
        msg.interactive?.list_reply?.title ||
        msg.button?.text ||
        '';
    }
    // 1. Parser para Evolution API (v1 / v2, case-insensitive)
    else {
      const eventName = (body.event || '').toLowerCase();
      const isEvolutionEvent =
        eventName.includes('messages') ||
        eventName.includes('upsert') ||
        body.data?.key ||
        (Array.isArray(body.data) && body.data[0]?.key);

      if (isEvolutionEvent && body.data) {
        const msgData = Array.isArray(body.data) ? body.data[0] : body.data;

        if (msgData.key?.fromMe) {
          return NextResponse.json({ status: 'ignored', reason: 'Mensagem enviada pela própria instância' });
        }

        const rawJid = msgData.key?.remoteJid || msgData.key?.participant || '';
        senderPhone = rawJid.replace('@s.whatsapp.net', '').replace('@g.us', '').replace(/\D/g, '');

        userText =
          msgData.message?.conversation ||
          msgData.message?.extendedTextMessage?.text ||
          msgData.message?.buttonsResponseMessage?.selectedButtonId ||
          msgData.message?.listResponseMessage?.singleSelectReply?.selectedRowId ||
          '';

        pushName = msgData.pushName || body.senderName || 'Paciente';
      }
      // 2. Parser para Z-API
      else if (body.phone && (body.text?.message || body.isGroup === false)) {
        if (body.fromMe) {
          return NextResponse.json({ status: 'ignored', reason: 'Mensagem do próprio número' });
        }
        senderPhone = body.phone.replace(/\D/g, '');
        userText = body.text?.message || body.message || '';
        pushName = body.senderName || 'Paciente';
      }
      // 3. Parser Genérico / Direto
      else if (body.phone || body.from) {
        senderPhone = (body.phone || body.from).replace(/\D/g, '');
        userText = body.message || body.text || body.content || '';
        pushName = body.name || 'Paciente';
      }
    }

    if (!senderPhone || !userText.trim()) {
      return NextResponse.json({ status: 'ignored', reason: 'Payload sem telefone ou conteúdo válido' }, { status: 200 });
    }

    // Formatar telefone para padrão internacional E.164 (+55...)
    const formattedPhone = senderPhone.startsWith('55') ? `+${senderPhone}` : `+55${senderPhone}`;

    // Buscar primeira clínica cadastrada ou criar padrão se o banco for novo
    let clinic = await prisma.clinic.findFirst();
    if (!clinic) {
      clinic = await prisma.clinic.create({
        data: {
          name: 'Clínica Saúde & Vida',
          email: 'contato@clinica.com.br',
          phone: '+5511999999999',
          specialty: 'Clínica Geral',
          slotDurationMinutes: 30,
          minCancelHours: 2,
        },
      });
    }

    // Buscar ou criar paciente no banco de dados
    let patient = await prisma.patient.findFirst({
      where: {
        clinicId: clinic.id,
        phone: { contains: senderPhone.slice(-8) },
      },
    });

    if (!patient) {
      patient = await prisma.patient.create({
        data: {
          clinicId: clinic.id,
          name: pushName,
          phone: formattedPhone,
        },
      });
      console.log(`👤 Novo paciente cadastrado automaticamente: ${patient.name} (${patient.phone})`);
    }

    // 1. Salvar mensagem recebida do usuário no histórico
    await prisma.message.create({
      data: {
        clinicId: clinic.id,
        patientId: patient.id,
        role: 'user',
        content: userText,
      },
    });

    // 2. Carregar histórico recente de mensagens (últimas 20 mais recentes)
    const rawMessages = await prisma.message.findMany({
      where: { patientId: patient.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    const recentMessages = rawMessages.reverse();

    const history = recentMessages.map((m) => ({
      role: m.role as 'user' | 'assistant' | 'system' | 'tool',
      content: m.content,
    }));

    // 3. Processar mensagem através do motor de IA & Tool Calling
    const agentResult = await processAgentMessage({
      patientPhone: formattedPhone,
      userMessage: userText,
      conversationHistory: history,
      clinicId: clinic.id,
    });

    // 4. Salvar resposta do assistente no banco
    await prisma.message.create({
      data: {
        clinicId: clinic.id,
        patientId: patient.id,
        role: 'assistant',
        content: agentResult.reply,
      },
    });

    // 5. Disparar resposta para o WhatsApp do paciente via REST API
    const whatsappResult = await sendWhatsAppMessage(formattedPhone, agentResult.reply);

    return NextResponse.json({
      success: true,
      patient: { id: patient.id, name: patient.name, phone: patient.phone },
      agentReply: agentResult.reply,
      toolsExecuted: agentResult.toolsExecuted,
      whatsappResult,
    });
  } catch (error: any) {
    console.error('❌ Erro no processamento do Webhook de WhatsApp:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}