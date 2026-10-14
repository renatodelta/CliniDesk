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
        { error: 'Por favor, informe a data/hora, nome completo e telefone.' },
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

    // 1. Localizar ou cadastrar/atualizar o paciente no banco de dados
    let patient = await prisma.patient.findFirst({
      where: {
        clinicId: clinic.id,
        phone: { contains: cleanPatientPhone.slice(-8) },
      },
    });

    if (patient) {
      patient = await prisma.patient.update({
        where: { id: patient.id },
        data: {
          name: patientName,
          cpf: patientCpf || patient.cpf,
        },
      });
    } else {
      patient = await prisma.patient.create({
        data: {
          clinicId: clinic.id,
          name: patientName,
          phone: formattedPatientPhone,
          cpf: patientCpf || null,
        },
      });
    }

    // 2. Validar data e hora e colisão de agenda
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

    // 3. Criar o agendamento
    const appointmentNotes = isForOtherPerson
      ? `Agendado via Web para: ${patientName}. Titular do WhatsApp: ${contactPhone || 'mesmo'}. ${notes || ''}`.trim()
      : `Agendado pelo paciente via Web. ${notes || ''}`.trim();

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

    // 4. Disparar mensagem de confirmação para o WhatsApp que agendou
    const confirmMessage = `🎉 *Agendamento Confirmado com Sucesso!*\n\nOlá, *${patientName}*! Sua consulta com *${doctor.name}* foi confirmada para:\n\n📅 *Data:* ${dataFormatada}\n🏥 *Local:* ${clinic.name}\n\n${doctor.name} agradece o contato e deseja um ótimo dia!`;

    // Salvar mensagem no histórico do WhatsApp
    await prisma.message.create({
      data: {
        clinicId: clinic.id,
        patientId: patient.id,
        role: 'assistant',
        content: confirmMessage,
      },
    });

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
