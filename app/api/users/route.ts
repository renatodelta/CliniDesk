import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Mock in-memory state in case DB user table is not created yet or fallback needed
let memoryUsers = [
  {
    id: 'user-1',
    name: 'Dra. Amanda Silva',
    email: 'amanda.silva@clinidesk.com.br',
    phone: '(11) 98765-4321',
    role: 'MEDICO',
    specialty: 'Cardiologia',
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'user-2',
    name: 'Dr. Roberto Santos',
    email: 'roberto.santos@clinidesk.com.br',
    phone: '(11) 97654-3210',
    role: 'MEDICO',
    specialty: 'Dermatologia',
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'user-3',
    name: 'Mariana Costa',
    email: 'mariana.costa@clinidesk.com.br',
    phone: '(11) 96543-2109',
    role: 'RECEPCIONISTA',
    specialty: null,
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'user-4',
    name: 'Carlos Eduardo',
    email: 'carlos.eduardo@clinidesk.com.br',
    phone: '(11) 95432-1098',
    role: 'ADMIN',
    specialty: null,
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
  }
];

export async function GET() {
  try {
    try {
      const dbUsers = await prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
      });
      if (dbUsers && dbUsers.length > 0) {
        return NextResponse.json({ users: dbUsers });
      }
    } catch (dbErr) {
      console.warn('⚠️ [Users API] DB query error, using memory fallback:', dbErr);
    }
    return NextResponse.json({ users: memoryUsers });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, phone, role, specialty, status } = body;

    if (!name || !email) {
      return NextResponse.json({ error: 'Nome e E-mail são obrigatórios' }, { status: 400 });
    }

    try {
      const newUser = await prisma.user.create({
        data: {
          name,
          email,
          phone: phone || null,
          role: role || 'RECEPCIONISTA',
          specialty: specialty || null,
          status: status || 'ACTIVE',
        },
      });
      return NextResponse.json({ success: true, user: newUser });
    } catch (dbErr) {
      console.warn('⚠️ [Users API DB Create Error] Fallback to in-memory:', dbErr);
      const newUser = {
        id: `user-${Date.now()}`,
        name,
        email,
        phone: phone || null,
        role: role || 'RECEPCIONISTA',
        specialty: specialty || null,
        status: status || 'ACTIVE',
        createdAt: new Date().toISOString(),
      };
      memoryUsers.unshift(newUser);
      return NextResponse.json({ success: true, user: newUser });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, name, email, phone, role, specialty, status } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 });
    }

    try {
      const updatedUser = await prisma.user.update({
        where: { id },
        data: {
          name,
          email,
          phone: phone || null,
          role: role || 'RECEPCIONISTA',
          specialty: specialty || null,
          status: status || 'ACTIVE',
        },
      });
      return NextResponse.json({ success: true, user: updatedUser });
    } catch (dbErr) {
      console.warn('⚠️ [Users API DB Update Error] Fallback to in-memory:', dbErr);
      const index = memoryUsers.findIndex((u) => u.id === id);
      if (index !== -1) {
        memoryUsers[index] = {
          ...memoryUsers[index],
          name: name ?? memoryUsers[index].name,
          email: email ?? memoryUsers[index].email,
          phone: phone ?? memoryUsers[index].phone,
          role: role ?? memoryUsers[index].role,
          specialty: specialty ?? memoryUsers[index].specialty,
          status: status ?? memoryUsers[index].status,
        };
        return NextResponse.json({ success: true, user: memoryUsers[index] });
      }
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
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
      return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 });
    }

    try {
      await prisma.user.delete({ where: { id } });
      return NextResponse.json({ success: true });
    } catch (dbErr) {
      console.warn('⚠️ [Users API DB Delete Error] Fallback to in-memory:', dbErr);
      memoryUsers = memoryUsers.filter((u) => u.id !== id);
      return NextResponse.json({ success: true });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
