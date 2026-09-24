import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/clinic/settings - Obter configurações atuais da clínica
export async function GET() {
  try {
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

    let parsedWorkingHours = {};
    try {
      parsedWorkingHours = JSON.parse(clinic.workingHours);
    } catch (e) {
      parsedWorkingHours = {};
    }

    return NextResponse.json({
      success: true,
      clinic: {
        ...clinic,
        workingHours: parsedWorkingHours,
      },
    });
  } catch (error: any) {
    console.error('Erro em GET /api/clinic/settings:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/clinic/settings - Atualizar configurações da clínica
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, specialty, phone, slotDurationMinutes, minCancelHours, workingHours } = body;

    let clinic = await prisma.clinic.findFirst();

    const dataToUpdate: any = {};
    if (name) dataToUpdate.name = name;
    if (specialty) dataToUpdate.specialty = specialty;
    if (phone) dataToUpdate.phone = phone;
    if (slotDurationMinutes) dataToUpdate.slotDurationMinutes = parseInt(slotDurationMinutes);
    if (minCancelHours) dataToUpdate.minCancelHours = parseInt(minCancelHours);

    if (workingHours) {
      dataToUpdate.workingHours = typeof workingHours === 'string' ? workingHours : JSON.stringify(workingHours);
    }

    if (!clinic) {
      clinic = await prisma.clinic.create({
        data: {
          name: name || 'Minha Clínica',
          email: 'contato@clinica.com.br',
          phone: phone || '+5511999999999',
          specialty: specialty || 'Clínica Geral',
          slotDurationMinutes: slotDurationMinutes ? parseInt(slotDurationMinutes) : 30,
          minCancelHours: minCancelHours ? parseInt(minCancelHours) : 2,
          workingHours: dataToUpdate.workingHours || '{}',
        },
      });
    } else {
      clinic = await prisma.clinic.update({
        where: { id: clinic.id },
        data: dataToUpdate,
      });
    }

    let parsedWorkingHours = {};
    try {
      parsedWorkingHours = JSON.parse(clinic.workingHours);
    } catch (e) {}

    return NextResponse.json({
      success: true,
      clinic: {
        ...clinic,
        workingHours: parsedWorkingHours,
      },
    });
  } catch (error: any) {
    console.error('Erro em POST /api/clinic/settings:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
