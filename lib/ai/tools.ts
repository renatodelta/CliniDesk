import { prisma } from '@/lib/prisma';
import { format, parse, addMinutes, isAfter, isBefore, setHours, setMinutes, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface ToolResult {
  success: boolean;
  message: string;
  data?: any;
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

    const dataFormatada = format(new Date(appointment.startTime), "EEEE, dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR });

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

    // Parse da data informada
    const targetDate = parseISO(dataDesejada.includes('T') ? dataDesejada.split('T')[0] : dataDesejada);
    if (isNaN(targetDate.getTime())) {
      return { success: false, message: 'Formato de data inválido. Use AAAA-MM-DD.' };
    }

    const dayOfWeek = targetDate.getDay().toString(); // 0 = Domingo, 1 = Segunda...
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

    let currentTime = setMinutes(setHours(targetDate, startH), startM);
    const endTime = setMinutes(setHours(targetDate, endH), endM);

    let lunchStartTime: Date | null = null;
    let lunchEndTime: Date | null = null;

    if (dayConfig.lunchStart && dayConfig.lunchEnd) {
      const [lStartH, lStartM] = dayConfig.lunchStart.split(':').map(Number);
      const [lEndH, lEndM] = dayConfig.lunchEnd.split(':').map(Number);
      lunchStartTime = setMinutes(setHours(targetDate, lStartH), lStartM);
      lunchEndTime = setMinutes(setHours(targetDate, lEndH), lEndM);
    }

    // Buscar agendamentos existentes no dia
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const existingAppointments = await prisma.appointment.findMany({
      where: {
        clinicId: clinic.id,
        startTime: { gte: startOfDay, lte: endOfDay },
        status: { in: ['SCHEDULED', 'CONFIRMED'] },
      },
    });

    const now = new Date();

    while (isBefore(currentTime, endTime)) {
      const slotEnd = addMinutes(currentTime, slotDuration);
      if (isAfter(slotEnd, endTime)) break;

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
        const timeStr = format(currentTime, 'HH:mm');
        const hour = currentTime.getHours();

        let matchesPeriod = true;
        if (periodo === 'manha' && hour >= 12) matchesPeriod = false;
        if (periodo === 'tarde' && (hour < 12 || hour >= 18)) matchesPeriod = false;
        if (periodo === 'noite' && hour < 18) matchesPeriod = false;

        if (matchesPeriod) {
          slots.push(timeStr);
        }
      }

      currentTime = slotEnd;
    }

    const dataExtenso = format(targetDate, "dd/MM/yyyy (EEEE)", { locale: ptBR });

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

    const dataFormatada = format(new Date(appointment.startTime), "dd/MM/yyyy 'às' HH:mm");

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
  novaDataHora: string // YYYY-MM-DD HH:mm ou ISO
): Promise<ToolResult> {
  try {
    const oldAppointment = await prisma.appointment.findUnique({
      where: { id: agendamentoId },
      include: { clinic: true, patient: true },
    });

    if (!oldAppointment) {
      return { success: false, message: 'Agendamento original não encontrado.' };
    }

    // Tentar converter novaDataHora
    let newStart: Date;
    if (novaDataHora.includes('T')) {
      newStart = parseISO(novaDataHora);
    } else {
      newStart = parse(novaDataHora, 'yyyy-MM-dd HH:mm', new Date());
      if (isNaN(newStart.getTime())) {
        newStart = parse(novaDataHora, 'dd/MM/yyyy HH:mm', new Date());
      }
    }

    if (isNaN(newStart.getTime())) {
      return {
        success: false,
        message: 'Formato da nova data/hora inválido. Forneça no formato YYYY-MM-DD HH:mm (ex: 2026-09-15 14:00).',
      };
    }

    const slotDuration = oldAppointment.clinic.slotDurationMinutes || 30;
    const newEnd = addMinutes(newStart, slotDuration);

    // Verificar se novo horário colide com algum outro agendamento
    const conflict = await prisma.appointment.findFirst({
      where: {
        clinicId: oldAppointment.clinicId,
        id: { not: oldAppointment.id },
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

    // 1. Atualizar agendamento antigo para RESCHEDULED
    await prisma.appointment.update({
      where: { id: oldAppointment.id },
      data: {
        status: 'RESCHEDULED',
        notes: `Remarcado para ${format(newStart, "dd/MM/yyyy 'às' HH:mm")}`,
      },
    });

    // 2. Criar novo agendamento SCHEDULED
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

    const dataFormatada = format(newStart, "EEEE, dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR });

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
