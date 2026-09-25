import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendWhatsAppMessage } from '@/lib/whatsapp/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const dynamic = 'force-dynamic';

// POST /api/appointments/cron-reminders - Automação de lembrete das próximas 24 horas
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'clinidesk-super-secret-cron-token';

    // Validação simples de segurança se token fornecido
    if (authHeader && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Não autorizado. Token de cron inválido.' }, { status: 401 });
    }

    const now = new Date();
    const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Buscar agendamentos agendados (SCHEDULED) nas próximas 24h
    const upcomingAppointments = await prisma.appointment.findMany({
      where: {
        startTime: {
          gte: now,
          lte: next24h,
        },
        status: { in: ['AGENDADO', 'SCHEDULED'] },
      },
      include: {
        patient: true,
        clinic: true,
      },
    });

    console.log(`⏰ [CRON Reminders] Encontrados ${upcomingAppointments.length} agendamentos para lembrar nas próximas 24h.`);

    const reminderResults = [];

    for (const appt of upcomingAppointments) {
      const dataFormatada = format(new Date(appt.startTime), "EEEE, dd 'de' MMMM 'às' HH:mm", { locale: ptBR });

      const reminderText = `Olá *${appt.patient.name}*! Tudo bem?\n\nLembramos que você possui uma consulta agendada para *${dataFormatada}* com a clínica *${appt.clinic.name}*.\n\nPor favor, responda a esta mensagem:\n- Digite *1* ou *Sim* para *CONFIRMAR*\n- Digite *2* ou *Reagendar* para ver outros horários vagos\n- Digite *3* ou *Cancelar* para cancelar sua consulta.`;

      // Registrar mensagem no histórico da conversa
      await prisma.message.create({
        data: {
          clinicId: appt.clinicId,
          patientId: appt.patientId,
          role: 'assistant',
          content: reminderText,
        },
      });

      // Disparar via WhatsApp API
      const result = await sendWhatsAppMessage(appt.patient.phone, reminderText);
      reminderResults.push({
        appointmentId: appt.id,
        patientName: appt.patient.name,
        phone: appt.patient.phone,
        sent: result.success,
      });
    }

    return NextResponse.json({
      success: true,
      processed: upcomingAppointments.length,
      details: reminderResults,
    });
  } catch (error: any) {
    console.error('❌ Erro no cron de lembretes:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
