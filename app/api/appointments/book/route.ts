import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseBRT, formatBRTShort } from '@/lib/ai/tools';
import { getDoctorInfo } from '@/lib/ai/agent';
import { sendWhatsAppMessage } from '@/lib/whatsapp/client';
import { addMinutes } from 'date-fns';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      startTime,
      contactPhone,
      patientName,
      patientCpf,
      patientPhone,
      isForOtherPerson,
      notes,
    } = body;

    if (!startTime || !patientName || !patientPhone) {
      return NextResponse.json(
        { error: 'Por favor, informe a data/hora, nome completo e telefone do paciente.' },
        { status: 400 }
      );
    }

    const clinic = await prisma.clinic.findFirst();
    if (!clinic) {
      return NextResponse.json({ error: 'Nenhuma clínica cadastrada.' }, { status: 404 });
    }

    const doctor = await getDoctorInfo(clinic.id);

    // Sanitizar telefones
    const cleanPatientPhone = patientPhone.replace(/\D/g, '');
    const formattedPatientPhone = cleanPatientPhone.startsWith('55')
      ? `+${cleanPatientPhone}`
      : `+55${cleanPatientPhone}`;

    const cleanContactPhone = (contactPhone || patientPhone).replace(/\D/g, '');
    const formattedContactPhone = cleanContactPhone.startsWith('55')
      ? `+${cleanContactPhone}`
      : `+55${cleanContactPhone}`;

    const cleanCpf = patientCpf ? patientCpf.replace(/\D/g, '') : '';
    const formattedCpf = cleanCpf.length === 11
      ? `${cleanCpf.slice(0, 3)}.${cleanCpf.slice(3, 6)}.${cleanCpf.slice(6, 9)}-${cleanCpf.slice(9, 11)}`
      : patientCpf || null;

    // 1. Localizar ou cadastrar obrigatoriamente o paciente no "Cadastro de Pacientes"
    // Busca por CPF (se informado) OU pelos últimos dígitos do telefone
    let patient = null;

    if (cleanCpf) {
      patient = await prisma.patient.findFirst({
        where: {
          clinicId: clinic.id,
          OR: [
            { cpf: { contains: cleanCpf } },
            { phone: { contains: cleanPatientPhone.slice(-8) } },
          ],
        },
      });
    } else {
      patient = await prisma.patient.findFirst({
        where: {
          clinicId: clinic.id,
          phone: { contains: cleanPatientPhone.slice(-8) },
        },
      });
    }

    const patientNotes = isForOtherPerson
      ? `Cadastrado via Agendamento Online por terceiro (WhatsApp: ${formattedContactPhone}). ${notes || ''}`.trim()
      : (notes || 'Cadastrado via Agendamento Online').trim();

    if (patient) {
      // Atualizar dados cadastrais do paciente existente
      patient = await prisma.patient.update({
        where: { id: patient.id },
        data: {
          name: patientName.trim(),
          cpf: formattedCpf || patient.cpf,
          phone: formattedPatientPhone,
          notes: patient.notes ? `${patient.notes} | ${patientNotes}` : patientNotes,
        },
      });
      console.log(`👤 Paciente existente atualizado no cadastro: ${patient.name} (CPF: ${patient.cpf})`);
    } else {
      // Criar novo cadastro no "Cadastro de Pacientes"
      patient = await prisma.patient.create({
        data: {
          clinicId: clinic.id,
          name: patientName.trim(),
          phone: formattedPatientPhone,
          cpf: formattedCpf,
          notes: patientNotes,
        },
      });
      console.log(`👤 Novo paciente cadastrado com sucesso: ${patient.name} (CPF: ${patient.cpf}, Tel: ${patient.phone})`);
    }

    // 2. Se for agendado por outra pessoa, garantir que o contato do marcador também fique registrado se necessário
    if (isForOtherPerson && cleanContactPhone && cleanContactPhone !== cleanPatientPhone) {
      const existingBooker = await prisma.patient.findFirst({
        where: {
          clinicId: clinic.id,
          phone: { contains: cleanContactPhone.slice(-8) },
        },
      });
      if (!existingBooker) {
        await prisma.patient.create({
          data: {
            clinicId: clinic.id,
            name: `Contato Marcador (${formattedContactPhone})`,
            phone: formattedContactPhone,
            notes: `Marcou consulta para o paciente: ${patient.name} (CPF: ${patient.cpf || 'N/A'})`,
          },
        }).catch((e) => console.warn('Aviso ao registrar contato do marcador:', e.message));
      }
    }

    // 3. Validar data e hora e colisão de agenda
    const start = parseBRT(startTime);
    if (isNaN(start.getTime())) {
      return NextResponse.json({ error: 'Formato de data e hora inválido.' }, { status: 400 });
    }

    const slotDuration = clinic.slotDurationMinutes || 30;
    const end = addMinutes(start, slotDuration);

    const conflict = await prisma.appointment.findFirst({
      where: {
        clinicId: clinic.id,
        status: { in: ['AGENDADO', 'CONFIRMADO', 'SCHEDULED', 'CONFIRMED'] },
        OR: [
          { startTime: { lte: start }, endTime: { gt: start } },
          { startTime: { lt: end }, endTime: { gte: end } },
        ],
      },
    });

    if (conflict) {
      return NextResponse.json(
        { error: 'Desculpe, este horário acabou de ser preenchido por outro paciente. Por favor, escolha outro horário.' },
        { status: 409 }
      );
    }

    // 4. Criar o agendamento vinculado OBRIGATORIAMENTE ao paciente cadastrado
    const appointmentNotes = isForOtherPerson
      ? `Agendado via Web para o paciente: ${patient.name} (CPF: ${patient.cpf || 'N/A'}, Tel: ${patient.phone}). Solicitado por WhatsApp: ${formattedContactPhone}. ${notes || ''}`.trim()
      : `Agendado pelo próprio paciente via Web. CPF: ${patient.cpf || 'N/A'}. ${notes || ''}`.trim();

    const appointment = await prisma.appointment.create({
      data: {
        clinicId: clinic.id,
        patientId: patient.id,
        startTime: start,
        endTime: end,
        status: 'AGENDADO',
        notes: appointmentNotes,
      },
    });

    const dataFormatada = formatBRTShort(start);

    // 5. Disparar mensagem de confirmação para o WhatsApp que agendou
    const confirmMessage = isForOtherPerson
      ? `🎉 *Agendamento Confirmado com Sucesso!*\n\nA consulta para *${patient.name}* com *${doctor.name}* foi confirmada para:\n\n📅 *Data:* ${dataFormatada}\n🏥 *Local:* ${clinic.name}\n👤 *Paciente Cadastrado:* ${patient.name} (CPF: ${patient.cpf || 'Não informado'})\n\n${doctor.name} agradece o contato e deseja um ótimo dia!`
      : `🎉 *Agendamento Confirmado com Sucesso!*\n\nOlá, *${patient.name}*! Sua consulta com *${doctor.name}* foi confirmada para:\n\n📅 *Data:* ${dataFormatada}\n🏥 *Local:* ${clinic.name}\n\n${doctor.name} agradece o contato e deseja um ótimo dia!`;

    // Salvar mensagem no histórico do WhatsApp
    await prisma.message.create({
      data: {
        clinicId: clinic.id,
        patientId: patient.id,
        role: 'assistant',
        content: confirmMessage,
      },
    }).catch((e) => console.warn('Aviso ao salvar mensagem de confirmação:', e.message));

    // Enviar mensagem real via WhatsApp API
    const whatsappResult = await sendWhatsAppMessage(formattedContactPhone, confirmMessage);

    return NextResponse.json({
      success: true,
      appointment,
      patient,
      whatsappResult,
      formattedDate: dataFormatada,
      doctorName: doctor.name,
      clinicName: clinic.name,
    });
  } catch (error: any) {
    console.error('Erro em POST /api/appointments/book:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
