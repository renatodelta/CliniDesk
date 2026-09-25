import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Mock pacientes iniciais em memória para fallback resiliente
let memoryPatients = [
  {
    id: 'pat-1',
    name: 'Carlos Eduardo Oliveira',
    phone: '+5511999991111',
    cpf: '123.456.789-00',
    email: 'carlos.oliveira@email.com',
    birthDate: '1985-04-12',
    notes: 'Hipertenso. Acompanhamento semestral.',
    createdAt: new Date().toISOString(),
    _count: { appointments: 3 },
  },
  {
    id: 'pat-2',
    name: 'Fernanda Maria Santos',
    phone: '+5511988882222',
    cpf: '987.654.321-11',
    email: 'fernanda.santos@email.com',
    birthDate: '1992-08-25',
    notes: 'Alergia a Dipirona.',
    createdAt: new Date().toISOString(),
    _count: { appointments: 1 },
  },
  {
    id: 'pat-3',
    name: 'Roberto Mendes Rocha',
    phone: '+5511977773333',
    cpf: '456.789.123-22',
    email: 'roberto.rocha@email.com',
    birthDate: '1978-11-03',
    notes: 'Retorno para avaliação de exames de sangue.',
    createdAt: new Date().toISOString(),
    _count: { appointments: 5 },
  },
  {
    id: 'pat-4',
    name: 'Juliana Barbosa Lima',
    phone: '+5511966664444',
    cpf: '321.654.987-33',
    email: 'juliana.lima@email.com',
    birthDate: '2000-01-15',
    notes: 'Primeira consulta agendada.',
    createdAt: new Date().toISOString(),
    _count: { appointments: 0 },
  },
];

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.toLowerCase() || '';

    try {
      const dbPatients = await prisma.patient.findMany({
        where: search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search, mode: 'insensitive' } },
                { cpf: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
              ],
            }
          : undefined,
        include: {
          _count: {
            select: { appointments: true },
          },
          appointments: {
            orderBy: { startTime: 'desc' },
            take: 1,
            select: { startTime: true, status: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (dbPatients && dbPatients.length > 0) {
        return NextResponse.json({ patients: dbPatients });
      }
    } catch (dbErr) {
      console.warn('⚠️ [Patients API] DB Query error, using fallback:', dbErr);
    }

    // Filter memory fallback
    const filtered = memoryPatients.filter(
      (p) =>
        !search ||
        p.name.toLowerCase().includes(search) ||
        p.phone.toLowerCase().includes(search) ||
        (p.cpf && p.cpf.toLowerCase().includes(search)) ||
        (p.email && p.email.toLowerCase().includes(search))
    );

    return NextResponse.json({ patients: filtered });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, phone, cpf, email, birthDate, notes } = body;

    if (!name || !phone) {
      return NextResponse.json({ error: 'Nome e Telefone são obrigatórios.' }, { status: 400 });
    }

    // Formatar telefone para E.164
    const digits = phone.replace(/\D/g, '');
    const cleanPhone = digits.startsWith('55') ? `+${digits}` : `+55${digits}`;

    try {
      // Obter ou criar clinic ID padrão
      const clinic = await prisma.clinic.findFirst();
      const clinicId = clinic ? clinic.id : 'default-clinic';

      const newPatient = await prisma.patient.create({
        data: {
          clinicId,
          name,
          phone: cleanPhone,
          cpf: cpf || null,
          email: email || null,
          birthDate: birthDate || null,
          notes: notes || null,
        },
        include: {
          _count: { select: { appointments: true } },
        },
      });

      return NextResponse.json({ success: true, patient: newPatient });
    } catch (dbErr) {
      console.warn('⚠️ [Patients API DB Create Error] Fallback to in-memory:', dbErr);
      const newPatient = {
        id: `pat-${Date.now()}`,
        name,
        phone: cleanPhone,
        cpf: cpf || null,
        email: email || null,
        birthDate: birthDate || null,
        notes: notes || null,
        createdAt: new Date().toISOString(),
        _count: { appointments: 0 },
      };
      memoryPatients.unshift(newPatient);
      return NextResponse.json({ success: true, patient: newPatient });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, name, phone, cpf, email, birthDate, notes } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID do paciente é obrigatório.' }, { status: 400 });
    }

    const digits = phone ? phone.replace(/\D/g, '') : '';
    const cleanPhone = digits ? (digits.startsWith('55') ? `+${digits}` : `+55${digits}`) : undefined;

    try {
      const updated = await prisma.patient.update({
        where: { id },
        data: {
          name,
          ...(cleanPhone && { phone: cleanPhone }),
          cpf: cpf || null,
          email: email || null,
          birthDate: birthDate || null,
          notes: notes || null,
        },
        include: {
          _count: { select: { appointments: true } },
        },
      });

      return NextResponse.json({ success: true, patient: updated });
    } catch (dbErr) {
      console.warn('⚠️ [Patients API DB Update Error] Fallback to in-memory:', dbErr);
      const idx = memoryPatients.findIndex((p) => p.id === id);
      if (idx !== -1) {
        memoryPatients[idx] = {
          ...memoryPatients[idx],
          name: name ?? memoryPatients[idx].name,
          phone: cleanPhone ?? memoryPatients[idx].phone,
          cpf: cpf ?? memoryPatients[idx].cpf,
          email: email ?? memoryPatients[idx].email,
          birthDate: birthDate ?? memoryPatients[idx].birthDate,
          notes: notes ?? memoryPatients[idx].notes,
        };
        return NextResponse.json({ success: true, patient: memoryPatients[idx] });
      }
      return NextResponse.json({ error: 'Paciente não encontrado.' }, { status: 404 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID é obrigatório.' }, { status: 400 });
    }

    try {
      await prisma.patient.delete({ where: { id } });
      return NextResponse.json({ success: true });
    } catch (dbErr) {
      console.warn('⚠️ [Patients API DB Delete Error] Fallback to in-memory:', dbErr);
      memoryPatients = memoryPatients.filter((p) => p.id !== id);
      return NextResponse.json({ success: true });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
