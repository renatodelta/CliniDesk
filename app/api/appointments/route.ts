import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseISO, addMinutes } from 'date-fns';

// GET /api/appointments - Listagem de agendamentos com filtros por data e status
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const dateStr = searchParams.get('date');
    const status = searchParams.get('status');
    const patientId = searchParams.get('patientId');

    const clinic = await prisma.clinic.findFirst();
    if (!clinic) {
      return NextResponse.json({ error: 'Nenhuma clínica cadastrada.' }, { status: 404 });
    }

    const whereClause: any = {
      clinicId: clinic.id,
    };

    if (status && status !== 'ALL') {
      whereClause.status = status;
    }

    if (patientId) {
      whereClause.patientId = patientId;
    }

    if (dateStr) {
      const targetDate = parseISO(dateStr);
      if (!isNaN(targetDate.getTime())) {
        const startOfDay = new Date(targetDate);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(targetDate);
        endOfDay.setHours(23, 59, 59, 999);

        whereClause.startTime = {
          gte: startOfDay,
          lte: endOfDay,
        };
      }
    }

    const appointments = await prisma.appointment.findMany({
      where: whereClause,
      include: {
        patient: true,
        clinic: true,
      },
      orderBy: {
        startTime: 'asc',
      },
    });

    return NextResponse.json({
      success: true,
      count: appointments.length,
      appointments,
    });
  } catch (error: any) {
    console.error('Erro em GET /api/appointments:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/appointments - Criação manual de agendamento
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { patientName, patientPhone, startTime, notes, status } = body;

    if (!patientPhone || !startTime) {
      return NextResponse.json(
        { error: 'Os campos patientPhone e startTime são obrigatórios.' },
        { status: 400 }
      );
    }

    const clinic = await prisma.clinic.findFirst();
    if (!clinic) {
      return NextResponse.json({ error: 'Nenhuma clínica cadastrada.' }, { status: 404 });
    }

    const formattedPhone = patientPhone.startsWith('+') ? patientPhone : `+55${patientPhone.replace(/\D/g, '')}`;

    // Buscar ou criar paciente
    let patient = await prisma.patient.findFirst({
      where: {
        clinicId: clinic.id,
        phone: { contains: formattedPhone.slice(-8) },
      },
    });

    if (!patient) {
      patient = await prisma.patient.create({
        data: {
          clinicId: clinic.id,
          name: patientName || 'Novo Paciente',
          phone: formattedPhone,
        },
      });
    }

    const start = parseISO(startTime);
    if (isNaN(start.getTime())) {
      return NextResponse.json({ error: 'Formato de startTime inválido.' }, { status: 400 });
    }

    const end = addMinutes(start, clinic.slotDurationMinutes || 30);

    // Verificar colisão
    const conflict = await prisma.appointment.findFirst({
      where: {
        clinicId: clinic.id,
        status: { in: ['SCHEDULED', 'CONFIRMED'] },
        OR: [
          { startTime: { lte: start }, endTime: { gt: start } },
          { startTime: { lt: end }, endTime: { gte: end } },
        ],
      },
    });

    if (conflict) {
      return NextResponse.json(
        { error: 'Já existe um agendamento para este mesmo horário.' },
        { status: 409 }
      );
    }

    const newAppointment = await prisma.appointment.create({
      data: {
        clinicId: clinic.id,
        patientId: patient.id,
        startTime: start,
        endTime: end,
        status: status || 'SCHEDULED',
        notes: notes || 'Agendamento manual criado pelo painel',
      },
      include: {
        patient: true,
      },
    });

    return NextResponse.json({
      success: true,
      appointment: newAppointment,
    });
  } catch (error: any) {
    console.error('Erro em POST /api/appointments:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
