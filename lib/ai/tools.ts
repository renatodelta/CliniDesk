import { prisma } from '@/lib/prisma';
import { addMinutes, isAfter, isBefore } from 'date-fns';

export interface ToolResult {
  success: boolean;
  message: string;
  data?: any;
}

/**
 * Converte qualquer string de data (ex: "2026-09-25 13:00", "2026-09-25T13:00")
 * interpretando explicitamente no fuso de Brasília (UTC-3).
 */
export function parseBRT(dateStr: string): Date {
  let s = dateStr.trim().replace(' ', 'T');
  if (s.includes('/')) {
    const parts = s.split('T');
    const dateParts = parts[0].split('/');
    if (dateParts.length === 3) {
      s = `${dateParts[2]}-${dateParts[1].padStart(2, '0')}-${dateParts[0].padStart(2, '0')}` + (parts[1] ? `T${parts[1]}` : '');
    }
  }
  if (!s.includes('Z') && !/[+-]\d{2}:\d{2}$/.test(s)) {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) {
      s += ':00';
    }
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(s)) {
      s += '-03:00';
    }
  }
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }
  return new Date(dateStr);
}

/**
 * Formata um objeto Date para o horário de Brasília (UTC-3 / America/Sao_Paulo)
 */
export function formatBRT(date: Date, includeDayOfWeek: boolean = true): string {
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: includeDayOfWeek ? 'long' : undefined,
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return formatter.format(date);
}

export function formatBRTShort(date: Date): string {
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return formatter.format(date).replace(',', ' às');
}

/**
 * 1. BUSCAR CONSULTA ATUAL DO PACIENTE
 */
export async function buscarConsultaAtual(telefonePaciente: string, clinicId?: string): Promise<ToolResult> {
  try {
    // Normalizar telefone (remover caracteres não numéricos)
    const cleanPhone = telefonePaciente.replace(/\D/g, '');

    // Buscar paciente pelo telefone
    const patient = await prisma.patient.findFirst({
      where: {
        phone: {
          contains: cleanPhone.slice(-8), // busca pelos últimos dígitos para lidar com DDD/país
        },
        ...(clinicId ? { clinicId } : {}),
      },
    });

    if (!patient) {
      return {
        success: false,
        message: `Nenhum paciente cadastrado encontrado para o telefone ${telefonePaciente}.`,
      };
    }

    const now = new Date();

    // Buscar agendamento futuro mais próximo
    const appointment = await prisma.appointment.findFirst({
      where: {
        patientId: patient.id,
        startTime: {
          gte: now,
        },
        status: {
          in: ['SCHEDULED', 'CONFIRMED'],
        },
      },
      orderBy: {
        startTime: 'asc',
      },
      include: {
        clinic: true,
        patient: true,
      },
    });

    if (!appointment) {
      return {
        success: true,
        message: `Olá ${patient.name}, você não possui nenhuma consulta futura agendada no momento.`,
        data: { patientName: patient.name, hasAppointment: false },
      };
    }

    const dataFormatada = formatBRT(new Date(appointment.startTime));

    return {
      success: true,
      message: `Consulta encontrada para ${patient.name}:\n- Data: ${dataFormatada}\n- Status: ${appointment.status}\n- Especialidade: ${appointment.clinic.specialty}\n- ID Agendamento: ${appointment.id}`,
      data: {
        appointmentId: appointment.id,
        patientName: patient.name,
        patientPhone: patient.phone,
        startTime: appointment.startTime.toISOString(),
        endTime: appointment.endTime.toISOString(),
        status: appointment.status,
        specialty: appointment.clinic.specialty,
        clinicName: appointment.clinic.name,
      },
    };
  } catch (error: any) {
    console.error('Erro em buscarConsultaAtual:', error);
    return {
      success: false,
      message: `Erro ao buscar consulta: ${error.message}`,
    };
  }
}

/**
 * 2. BUSCAR HORÁRIOS DISPONÍVEIS NA GRADE
 */
export async function buscarHorariosDisponiveis(
  dataDesejada: string, // YYYY-MM-DD
  periodo: 'manha' | 'tarde' | 'noite' | 'qualquer' = 'qualquer',
  clinicId?: string
): Promise<ToolResult> {
  try {
    // Obter primeira clínica se não fornecida
    const clinic = clinicId
      ? await prisma.clinic.findUnique({ where: { id: clinicId } })
      : await prisma.clinic.findFirst();

    if (!clinic) {
      return { success: false, message: 'Clínica não encontrada no sistema.' };
    }

    // Data no fuso BRT
    const cleanDateStr = dataDesejada.includes('T') ? dataDesejada.split('T')[0] : dataDesejada;
    const targetDateStart = parseBRT(`${cleanDateStr}T00:00:00`);
    if (isNaN(targetDateStart.getTime())) {
      return { success: false, message: 'Formato de data inválido. Use AAAA-MM-DD.' };
    }

    // Obter dia da semana em BRT (0 = Domingo, 1 = Segunda... 6 = Sábado)
    const dayOfWeek = targetDateStart.getDay().toString();

    let workingHoursConfig: Record<string, { active: boolean; start: string; end: string; lunchStart: string; lunchEnd: string }>;

    try {
      workingHoursConfig = JSON.parse(clinic.workingHours);
    } catch (e) {
      return { success: false, message: 'Erro na configuração do expediente da clínica.' };
    }

    const dayConfig = workingHoursConfig[dayOfWeek];
    if (!dayConfig || !dayConfig.active) {
      const diasNomes = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
      return {
        success: true,
        message: `O profissional não atende aos ${diasNomes[parseInt(dayOfWeek)]}s. Por favor escolha outro dia da semana.`,
        data: { slots: [] },
      };
    }

    // Gerar grade de horários baseados no expediente e intervalo de almoço
    const slotDuration = clinic.slotDurationMinutes || 30;
    const slots: string[] = [];

    const [startH, startM] = dayConfig.start.split(':').map(Number);
    const [endH, endM] = dayConfig.end.split(':').map(Number);

    const startTimeBRT = parseBRT(`${cleanDateStr}T${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}:00`);
    const endTimeBRT = parseBRT(`${cleanDateStr}T${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}:00`);

    let lunchStartTime: Date | null = null;
    let lunchEndTime: Date | null = null;

    if (dayConfig.lunchStart && dayConfig.lunchEnd) {
      lunchStartTime = parseBRT(`${cleanDateStr}T${dayConfig.lunchStart}:00`);
      lunchEndTime = parseBRT(`${cleanDateStr}T${dayConfig.lunchEnd}:00`);
    }

    // Buscar agendamentos existentes no dia
    const startOfDay = parseBRT(`${cleanDateStr}T00:00:00`);
    const endOfDay = parseBRT(`${cleanDateStr}T23:59:59`);

    const existingAppointments = await prisma.appointment.findMany({
      where: {
        clinicId: clinic.id,
        startTime: { gte: startOfDay, lte: endOfDay },
        status: { in: ['SCHEDULED', 'CONFIRMED'] },
      },
    });

    const now = new Date();
    let currentTime = new Date(startTimeBRT);

    while (isBefore(currentTime, endTimeBRT)) {
      const slotEnd = addMinutes(currentTime, slotDuration);
      if (isAfter(slotEnd, endTimeBRT)) break;

      // Verificar se não cai no horário de almoço
      const isLunchTime =
        lunchStartTime && lunchEndTime &&
        (isAfter(currentTime, lunchStartTime) || currentTime.getTime() === lunchStartTime.getTime()) &&
        isBefore(currentTime, lunchEndTime);

      // Verificar se slot é no futuro
      const isFutureSlot = isAfter(currentTime, now);

      // Verificar se não colide com agendamento existente
      const isOccupied = existingAppointments.some((appt) => {
        const apptStart = new Date(appt.startTime);
        const apptEnd = new Date(appt.endTime);
        return (
          (currentTime >= apptStart && currentTime < apptEnd) ||
          (slotEnd > apptStart && slotEnd <= apptEnd)
        );
      });

      if (!isLunchTime && isFutureSlot && !isOccupied) {
        // Horário formatado em BRT
        const timeStr = new Intl.DateTimeFormat('pt-BR', {
          timeZone: 'America/Sao_Paulo',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }).format(currentTime);

        const hourInt = parseInt(timeStr.split(':')[0], 10);

        let matchesPeriod = true;
        if (periodo === 'manha' && hourInt >= 12) matchesPeriod = false;
        if (periodo === 'tarde' && (hourInt < 12 || hourInt >= 18)) matchesPeriod = false;
        if (periodo === 'noite' && hourInt < 18) matchesPeriod = false;

        if (matchesPeriod) {
          slots.push(timeStr);
        }
      }

      currentTime = slotEnd;
    }

    const dataExtenso = formatBRT(targetDateStart, true);

    if (slots.length === 0) {
      return {
        success: true,
        message: `Não encontramos horários livres disponíveis para o dia ${dataExtenso}${periodo !== 'qualquer' ? ` no período da ${periodo}` : ''}.`,
        data: { date: dataDesejada, slots: [] },
      };
    }

    return {
      success: true,
      message: `Horários disponíveis em ${dataExtenso}:\n${slots.join(', ')}`,
      data: {
        date: dataDesejada,
        periodo,
        slots,
      },
    };
  } catch (error: any) {
    console.error('Erro em buscarHorariosDisponiveis:', error);
    return {
      success: false,
      message: `Erro ao buscar horários: ${error.message}`,
    };
  }
}

/**
 * 3. CANCELAR CONSULTA
 */
export async function cancelarConsulta(agendamentoId: string, motivo?: string): Promise<ToolResult> {
  try {
    const appointment = await prisma.appointment.findUnique({
      where: { id: agendamentoId },
      include: { clinic: true, patient: true },
    });

    if (!appointment) {
      return { success: false, message: 'Agendamento não encontrado.' };
    }

    if (appointment.status === 'CANCELED') {
      return { success: true, message: 'Esta consulta já estava cancelada.' };
    }

    // Verificar antecedência mínima
    const now = new Date();
    const minCancelHours = appointment.clinic.minCancelHours || 2;
    const hoursDifference = (new Date(appointment.startTime).getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursDifference < minCancelHours && hoursDifference > 0) {
      return {
        success: false,
        message: `O cancelamento automático só pode ser feito com pelo menos ${minCancelHours} horas de antecedência. Entre em contato diretamente com a recepção da clínica.`,
      };
    }

    // Atualizar status para CANCELED
    const updated = await prisma.appointment.update({
      where: { id: agendamentoId },
      data: {
        status: 'CANCELED',
        notes: motivo ? `Cancelado via WhatsApp IA. Motivo: ${motivo}` : 'Cancelado via WhatsApp IA.',
      },
    });

    const dataFormatada = formatBRTShort(new Date(appointment.startTime));

    return {
      success: true,
      message: `Consulta de ${appointment.patient.name} marcada para ${dataFormatada} foi CANCELADA com sucesso.`,
      data: {
        appointmentId: updated.id,
        status: updated.status,
        patientName: appointment.patient.name,
      },
    };
  } catch (error: any) {
    console.error('Erro em cancelarConsulta:', error);
    return {
      success: false,
      message: `Erro ao cancelar consulta: ${error.message}`,
    };
  }
}

/**
 * 4. CONFIRMAR REMARCAÇÃO DE CONSULTA
 */
export async function confirmarRemarcacao(
  agendamentoId: string,
  novaDataHora: string // YYYY-MM-DD HH:mm ou ISO ou DD/MM/YYYY HH:mm
): Promise<ToolResult> {
  try {
    const oldAppointment = await prisma.appointment.findUnique({
      where: { id: agendamentoId },
      include: { clinic: true, patient: true },
    });

    if (!oldAppointment) {
      return { success: false, message: 'Agendamento original não encontrado.' };
    }

    // Converter novaDataHora para Date no fuso BRT (UTC-3)
    const newStart = parseBRT(novaDataHora);

    if (isNaN(newStart.getTime())) {
      return {
        success: false,
        message: 'Formato da nova data/hora inválido. Forneça no formato YYYY-MM-DD HH:mm (ex: 2026-09-15 14:00).',
      };
    }

    const slotDuration = oldAppointment.clinic.slotDurationMinutes || 30;
    const newEnd = addMinutes(newStart, slotDuration);

    // Verificar se novo horário colide com algum outro agendamento ativo de outro paciente
    const conflict = await prisma.appointment.findFirst({
      where: {
        clinicId: oldAppointment.clinicId,
        patientId: { not: oldAppointment.patientId },
        status: { in: ['SCHEDULED', 'CONFIRMED'] },
        OR: [
          {
            startTime: { lte: newStart },
            endTime: { gt: newStart },
          },
          {
            startTime: { lt: newEnd },
            endTime: { gte: newEnd },
          },
        ],
      },
    });

    if (conflict) {
      return {
        success: false,
        message: 'Desculpe, o novo horário escolhido acabou de ser ocupado. Por favor, consulte os horários livres novamente.',
      };
    }

    const dataFormatada = formatBRT(newStart, true);
    const dataShortFormatada = formatBRTShort(newStart);

    // 1. Atualizar TODOS os agendamentos anteriores do paciente com status SCHEDULED ou CONFIRMED para RESCHEDULED
    await prisma.appointment.updateMany({
      where: {
        patientId: oldAppointment.patientId,
        status: { in: ['SCHEDULED', 'CONFIRMED'] },
      },
      data: {
        status: 'RESCHEDULED',
        notes: `Remarcado para ${dataShortFormatada}`,
      },
    });

    // 2. Criar novo agendamento com status SCHEDULED
    const newAppointment = await prisma.appointment.create({
      data: {
        clinicId: oldAppointment.clinicId,
        patientId: oldAppointment.patientId,
        startTime: newStart,
        endTime: newEnd,
        status: 'SCHEDULED',
        notes: `Remarcado a partir do agendamento anterior #${oldAppointment.id.slice(0, 8)}`,
      },
    });

    return {
      success: true,
      message: `Remarcação efetuada com sucesso! Nova consulta agendada para ${dataFormatada} com ${oldAppointment.clinic.name}.`,
      data: {
        newAppointmentId: newAppointment.id,
        oldAppointmentId: oldAppointment.id,
        patientName: oldAppointment.patient.name,
        newStartTime: newStart.toISOString(),
        newEndTime: newEnd.toISOString(),
        status: 'SCHEDULED',
      },
    };
  } catch (error: any) {
    console.error('Erro em confirmarRemarcacao:', error);
    return {
      success: false,
      message: `Erro ao confirmar remarcação: ${error.message}`,
    };
  }
}

