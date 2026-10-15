'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  UserCheck,
  CalendarCheck2,
  CalendarX,
  RefreshCw,
  Settings,
  Search,
  Phone,
  User,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Plus,
  ShieldCheck,
  Stethoscope,
  Users,
  UserPlus,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  CalendarRange,
  ListFilter,
  Edit3,
  Trash2,
  Mail,
  Shield,
  Check,
  X,
  UserCog,
  Briefcase,
  Contact,
  HeartPulse,
  CalendarPlus,
  FileText,
  ExternalLink,
  ChevronsUpDown,
  MessageSquare,
  AlertCircle,
  Inbox,
  Sparkles,
  ArrowUpDown,
  Send,
  Building2,
  CheckSquare,
  Square,
  Activity,
  Megaphone,
} from 'lucide-react';

function formatPhoneBR(phone: string | null | undefined): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  const localDigits = digits.startsWith('55') && digits.length >= 12 ? digits.slice(2) : digits;

  if (localDigits.length === 11) {
    return `(${localDigits.slice(0, 2)}) ${localDigits.slice(2, 7)}-${localDigits.slice(7)}`;
  } else if (localDigits.length === 10) {
    return `(${localDigits.slice(0, 2)}) ${localDigits.slice(2, 6)}-${localDigits.slice(6)}`;
  }
  return phone;
}

function applyPhoneMask(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (!digits) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

function applyCPFMask(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (!digits) return '';
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

function calculateAge(birthDateStr?: string | null): string {
  if (!birthDateStr) return '';
  const birth = new Date(birthDateStr);
  if (isNaN(birth.getTime())) return '';
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return `${age} anos`;
}

function getInitials(name: string): string {
  if (!name) return 'PC';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getStatusLabel(status: string | undefined | null): string {
  if (!status) return 'Agendado';
  const s = status.toUpperCase();
  if (s === 'CONFIRMED' || s === 'CONFIRMADO') return 'Confirmado';
  if (s === 'SCHEDULED' || s === 'AGENDADO') return 'Aguardando Confirmação';
  if (s === 'RESCHEDULED' || s === 'REMARCADO') return 'Encaixe Confirmado';
  if (s === 'CANCELED' || s === 'CANCELADO') return 'Cancelado';
  return status;
}

const WEEKDAY_NAMES = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
const DAILY_HOURS = ['08:00', '08:45', '09:30', '10:15', '11:00', '11:45', '13:00', '13:45', '14:30', '15:15', '16:00', '16:45', '17:30'];

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<'agenda' | 'patients' | 'fila' | 'whatsapp' | 'users' | 'settings'>('agenda');
  const [agendaViewMode, setAgendaViewMode] = useState<'dia' | 'semana' | 'mes' | 'lista'>('dia');

  const [loading, setLoading] = useState(true);
  const [clinic, setClinic] = useState<any>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [filterDate, setFilterDate] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Filtros da Agenda no menu esquerdo
  const [filterConfirmed, setFilterConfirmed] = useState(true);
  const [filterWaiting, setFilterWaiting] = useState(true);
  const [filterEncaixe, setFilterEncaixe] = useState(true);
  const [filterCanceled, setFilterCanceled] = useState(false);
  const [selectedProcedure, setSelectedProcedure] = useState<string | null>(null);

  // Controle de datas e calendário
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [currentTimeStr, setCurrentTimeStr] = useState<string>('');

  // Busca global
  const [searchQuery, setSearchQuery] = useState('');

  // Cron
  const [cronRunning, setCronRunning] = useState(false);
  const [cronNotice, setCronNotice] = useState<string | null>(null);

  // Modal de Agendamento
  const [showModalNewAppt, setShowModalNewAppt] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [newApptPhone, setNewApptPhone] = useState('');
  const [newApptName, setNewApptName] = useState('');
  const [newApptTime, setNewApptTime] = useState('');
  const [newApptNotes, setNewApptNotes] = useState('');

  // Modal de Prontuário / Detalhes
  const [selectedApptDetails, setSelectedApptDetails] = useState<any | null>(null);

  // Cadastro de Pacientes State
  const [patients, setPatients] = useState<any[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');
  const [showModalPatient, setShowModalPatient] = useState(false);
  const [editingPatient, setEditingPatient] = useState<any | null>(null);

  // Form do Paciente
  const [patName, setPatName] = useState('');
  const [patPhone, setPatPhone] = useState('');
  const [patCpf, setPatCpf] = useState('');
  const [patEmail, setPatEmail] = useState('');
  const [patBirthDate, setPatBirthDate] = useState('');
  const [patNotes, setPatNotes] = useState('');

  // Cadastro de Usuários State
  const [users, setUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<string>('ALL');
  const [showModalUser, setShowModalUser] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);

  // Form de Usuário
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [userRole, setUserRole] = useState<'MEDICO' | 'RECEPCIONISTA' | 'ADMIN'>('MEDICO');
  const [userSpecialty, setUserSpecialty] = useState('');
  const [userStatus, setUserStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');

  // Atualizar relógio em tempo real
  useEffect(() => {
    function updateClock() {
      const now = new Date();
      setCurrentTimeStr(
        now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      );
    }
    updateClock();
    const interval = setInterval(updateClock, 10000);
    return () => clearInterval(interval);
  }, []);

  // Carregar dados iniciais
  useEffect(() => {
    fetchData();
    fetchPatients();
    fetchUsers();
  }, [filterDate, filterStatus]);

  async function fetchData() {
    try {
      setLoading(true);
      const resSettings = await fetch('/api/clinic/settings');
      const dataSettings = await resSettings.json();
      if (dataSettings.clinic) {
        setClinic(dataSettings.clinic);
      }

      let apptUrl = '/api/appointments?';
      if (filterDate) apptUrl += `date=${filterDate}&`;
      if (filterStatus && filterStatus !== 'ALL') apptUrl += `status=${filterStatus}`;

      const resAppts = await fetch(apptUrl);
      const dataAppts = await resAppts.json();
      if (dataAppts.appointments) {
        setAppointments(dataAppts.appointments);
      }
    } catch (e) {
      console.error('Erro ao carregar dados:', e);
    } finally {
      setLoading(false);
    }
  }

  async function fetchPatients() {
    try {
      setLoadingPatients(true);
      const res = await fetch('/api/patients');
      const data = await res.json();
      if (data.patients) {
        setPatients(data.patients);
      }
    } catch (err) {
      console.error('Erro ao carregar pacientes:', err);
    } finally {
      setLoadingPatients(false);
    }
  }

  async function fetchUsers() {
    try {
      setLoadingUsers(true);
      const res = await fetch('/api/users');
      const data = await res.json();
      if (data.users) {
        setUsers(data.users);
      }
    } catch (err) {
      console.error('Erro ao carregar usuários:', err);
    } finally {
      setLoadingUsers(false);
    }
  }

  // Cron Lembretes 24h
  async function handleTriggerCronReminders() {
    setCronRunning(true);
    setCronNotice(null);
    try {
      const res = await fetch('/api/appointments/cron-reminders', { method: 'POST' });
      const data = await res.json();
      setCronNotice(`✅ Lembretes enviados! ${data.processed || 0} pacientes notificados via WhatsApp para as próximas 24h.`);
      fetchData();
    } catch (e: any) {
      setCronNotice(`❌ Erro no disparo de lembretes: ${e.message}`);
    } finally {
      setCronRunning(false);
    }
  }

  // Criar Agendamento Manual
  async function handleCreateAppointment(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPatientId) {
      alert('Selecione obrigatoriamente um paciente cadastrado antes de marcar a consulta.');
      return;
    }
    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: selectedPatientId,
          patientName: newApptName,
          patientPhone: newApptPhone,
          startTime: newApptTime,
          notes: newApptNotes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowModalNewAppt(false);
        setSelectedPatientId('');
        setNewApptName('');
        setNewApptPhone('');
        setNewApptTime('');
        setNewApptNotes('');
        fetchData();
        fetchPatients();
      } else {
        alert(data.error || 'Erro ao criar agendamento.');
      }
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    }
  }

  // Abrir Modal com Slot pré-selecionado
  function openNewApptModalWithSlot(dateObj: Date, hourStr?: string) {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const time = hourStr || '09:00';
    const formatted = `${year}-${month}-${day}T${time}`;
    setNewApptTime(formatted);
    setSelectedPatientId('');
    setNewApptName('');
    setNewApptPhone('');
    setShowModalNewAppt(true);
  }

  // Ações de Pacientes
  function handleOpenPatientModal(patToEdit?: any) {
    if (patToEdit) {
      setEditingPatient(patToEdit);
      setPatName(patToEdit.name);
      setPatPhone(formatPhoneBR(patToEdit.phone) || patToEdit.phone);
      setPatCpf(patToEdit.cpf || '');
      setPatEmail(patToEdit.email || '');
      setPatBirthDate(patToEdit.birthDate || '');
      setPatNotes(patToEdit.notes || '');
    } else {
      setEditingPatient(null);
      setPatName('');
      setPatPhone('');
      setPatCpf('');
      setPatEmail('');
      setPatBirthDate('');
      setPatNotes('');
    }
    setShowModalPatient(true);
  }

  async function handleSavePatient(e: React.FormEvent) {
    e.preventDefault();
    try {
      const payload = {
        id: editingPatient?.id,
        name: patName,
        phone: patPhone,
        cpf: patCpf,
        email: patEmail,
        birthDate: patBirthDate,
        notes: patNotes,
      };

      const method = editingPatient ? 'PUT' : 'POST';
      const res = await fetch('/api/patients', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        setShowModalPatient(false);
        fetchPatients();
      } else {
        alert(data.error || 'Erro ao salvar paciente.');
      }
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    }
  }

  async function handleDeletePatient(id: string) {
    if (!confirm('Deseja realmente excluir este paciente? Todos os dados cadastrais serão removidos.')) return;
    try {
      const res = await fetch(`/api/patients?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchPatients();
      } else {
        alert(data.error || 'Erro ao excluir paciente.');
      }
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    }
  }

  // Ações de Usuário
  function handleOpenUserModal(userToEdit?: any) {
    if (userToEdit) {
      setEditingUser(userToEdit);
      setUserName(userToEdit.name);
      setUserEmail(userToEdit.email);
      setUserPhone(userToEdit.phone || '');
      setUserRole(userToEdit.role || 'MEDICO');
      setUserSpecialty(userToEdit.specialty || '');
      setUserStatus(userToEdit.status || 'ACTIVE');
    } else {
      setEditingUser(null);
      setUserName('');
      setUserEmail('');
      setUserPhone('');
      setUserRole('MEDICO');
      setUserSpecialty('');
      setUserStatus('ACTIVE');
    }
    setShowModalUser(true);
  }

  async function handleSaveUser(e: React.FormEvent) {
    e.preventDefault();
    try {
      const payload = {
        id: editingUser?.id,
        name: userName,
        email: userEmail,
        phone: userPhone,
        role: userRole,
        specialty: userSpecialty,
        status: userStatus,
      };

      const method = editingUser ? 'PUT' : 'POST';
      const res = await fetch('/api/users', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        setShowModalUser(false);
        fetchUsers();
      } else {
        alert(data.error || 'Erro ao salvar usuário.');
      }
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    }
  }

  async function handleDeleteUser(id: string) {
    if (!confirm('Deseja realmente remover este usuário?')) return;
    try {
      const res = await fetch(`/api/users?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchUsers();
      } else {
        alert(data.error || 'Erro ao excluir usuário.');
      }
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    }
  }

  async function handleToggleUserStatus(user: any) {
    try {
      const newStatus = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      const res = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...user, status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        fetchUsers();
      }
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    }
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch('/api/clinic/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: clinic.name,
          specialty: clinic.specialty,
          slotDurationMinutes: clinic.slotDurationMinutes,
          minCancelHours: clinic.minCancelHours,
          workingHours: clinic.workingHours,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert('Configurações salvas com sucesso!');
        setClinic(data.clinic);
      }
    } catch (e: any) {
      alert(`Erro ao salvar: ${e.message}`);
    }
  }

  // Doctor Info para o Cabeçalho & Sidebar
  const activeDoctor = useMemo(() => {
    const med = users.find((u) => u.role === 'MEDICO' && u.status === 'ACTIVE');
    if (med) return med;
    return {
      name: 'Dra. Beatriz Silva',
      specialty: 'Cardiologia Geral e Exames Diagnósticos',
      crm: 'CRM 48.910',
      room: 'Sala 402',
    };
  }, [users]);

  // Consultas do Dia Selecionado
  const selectedDayAppointments = useMemo(() => {
    return appointments
      .filter((a) => {
        const apptDate = new Date(a.startTime);
        return (
          apptDate.getFullYear() === selectedDate.getFullYear() &&
          apptDate.getMonth() === selectedDate.getMonth() &&
          apptDate.getDate() === selectedDate.getDate()
        );
      })
      .filter((a) => {
        const s = (a.status || '').toUpperCase();
        if (s === 'CONFIRMADO' || s === 'CONFIRMED') return filterConfirmed;
        if (s === 'AGENDADO' || s === 'SCHEDULED') return filterWaiting;
        if (s === 'REMARCADO' || s === 'RESCHEDULED') return filterEncaixe;
        if (s === 'CANCELADO' || s === 'CANCELED') return filterCanceled;
        return true;
      })
      .filter((a) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          a.patient?.name?.toLowerCase().includes(q) ||
          a.patient?.phone?.includes(q) ||
          (a.patient?.cpf && a.patient.cpf.includes(q)) ||
          (a.notes && a.notes.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }, [appointments, selectedDate, filterConfirmed, filterWaiting, filterEncaixe, filterCanceled, searchQuery]);

  // Contadores do Dia Selecionado
  const confirmedCount = useMemo(() => {
    return appointments.filter((a) => {
      const d = new Date(a.startTime);
      return (
        d.toDateString() === selectedDate.toDateString() &&
        (a.status === 'CONFIRMADO' || a.status === 'CONFIRMED')
      );
    }).length;
  }, [appointments, selectedDate]);

  const waitingCount = useMemo(() => {
    return appointments.filter((a) => {
      const d = new Date(a.startTime);
      return (
        d.toDateString() === selectedDate.toDateString() &&
        (a.status === 'AGENDADO' || a.status === 'SCHEDULED')
      );
    }).length;
  }, [appointments, selectedDate]);

  const encaixeCount = useMemo(() => {
    return appointments.filter((a) => {
      const d = new Date(a.startTime);
      return (
        d.toDateString() === selectedDate.toDateString() &&
        (a.status === 'REMARCADO' || a.status === 'RESCHEDULED')
      );
    }).length;
  }, [appointments, selectedDate]);

  // Gerar dias do Mini-Calendário Mensal
  const miniCalendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Domingo
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days: Array<{ dayNumber: number; inMonth: boolean; dateObj: Date }> = [];

    // Dias do mês anterior
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      days.push({
        dayNumber: dayNum,
        inMonth: false,
        dateObj: new Date(year, month - 1, dayNum),
      });
    }

    // Dias do mês atual
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        dayNumber: i,
        inMonth: true,
        dateObj: new Date(year, month, i),
      });
    }

    // Dias do próximo mês para completar 35 ou 42 células
    const remaining = 35 - days.length;
    if (remaining > 0) {
      for (let i = 1; i <= remaining; i++) {
        days.push({
          dayNumber: i,
          inMonth: false,
          dateObj: new Date(year, month + 1, i),
        });
      }
    }

    return days;
  }, [calendarMonth]);

  // Formatadores de data em Português
  const selectedDateHeader = useMemo(() => {
    const raw = selectedDate.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }, [selectedDate]);

  const monthLabel = useMemo(() => {
    const raw = calendarMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }, [calendarMonth]);

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-[#f4f7fb] text-slate-800 font-sans select-none">
      {/* =========================================================================
          1. SIDEBAR DE NAVEGAÇÃO LATERAL (DOCFLOW CLINICAL SUITE)
      ========================================================================= */}
      <aside className="w-64 border-r border-slate-200/80 bg-white flex flex-col justify-between shrink-0 z-30">
        <div>
          {/* LOGO & SUITE */}
          <div className="p-4 flex items-center justify-between border-b border-slate-100">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
                <HeartPulse className="w-5 h-5 text-teal-400 stroke-[2.2]" />
              </div>
              <div>
                <h1 className="text-sm font-extrabold tracking-tight text-slate-900 leading-none">CliniDesk</h1>
                <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400 block mt-0.5">
                  CLINICAL SUITE
                </span>
              </div>
            </div>
            <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-full">
              PRO
            </span>
          </div>

          {/* UNIDADE ATUAL CARD */}
          <div className="mx-3 my-3 p-2.5 rounded-2xl bg-slate-50 border border-slate-200/70 text-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Unidade Atual</span>
            <div className="flex items-center justify-between mt-0.5">
              <span className="font-bold text-slate-800 truncate">
                {clinic?.name || 'CliniDesk Jardins'} • Jardins
              </span>
              <ChevronsUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </div>
          </div>

          {/* MENU PRINCIPAL */}
          <nav className="px-3 space-y-1 mt-2">
            <button
              onClick={() => setActiveTab('agenda')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition ${
                activeTab === 'agenda'
                  ? 'bg-slate-900 text-white shadow-md shadow-slate-900/10'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <CalendarIcon className={`w-4 h-4 ${activeTab === 'agenda' ? 'text-teal-400' : 'text-slate-500'}`} />
                <span>Agenda Médica</span>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                  activeTab === 'agenda' ? 'bg-white/20 text-white' : 'bg-slate-200/70 text-slate-700'
                }`}
              >
                {appointments.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('patients')}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition ${
                activeTab === 'patients'
                  ? 'bg-slate-900 text-white shadow-md shadow-slate-900/10 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
              }`}
            >
              <Users className="w-4 h-4 text-slate-500" />
              <span>Pacientes & Prontuário</span>
            </button>

            <button
              onClick={() => setActiveTab('fila')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition ${
                activeTab === 'fila'
                  ? 'bg-slate-900 text-white shadow-md shadow-slate-900/10 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Inbox className="w-4 h-4 text-slate-500" />
                <span>Fila de Espera & Encaixe</span>
              </div>
              <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse"></span>
            </button>

            <button
              onClick={() => setActiveTab('whatsapp')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition ${
                activeTab === 'whatsapp'
                  ? 'bg-slate-900 text-white shadow-md shadow-slate-900/10 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <MessageSquare className="w-4 h-4 text-slate-500" />
                <span>WhatsApp & Lembretes</span>
              </div>
              <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Cloud
              </span>
            </button>

            {/* SEÇÃO GESTÃO */}
            <div className="pt-4 pb-1 px-3.5">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Gestão</span>
            </div>

            <button
              onClick={() => setActiveTab('users')}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition ${
                activeTab === 'users'
                  ? 'bg-slate-900 text-white shadow-md shadow-slate-900/10 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
              }`}
            >
              <Zap className="w-4 h-4 text-slate-500" />
              <span>Métricas & Recuperação</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition ${
                activeTab === 'settings'
                  ? 'bg-slate-900 text-white shadow-md shadow-slate-900/10 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
              }`}
            >
              <Settings className="w-4 h-4 text-slate-500" />
              <span>Configurações</span>
            </button>
          </nav>
        </div>

        {/* PROFILE CARD INFERIOR */}
        <div className="p-3 border-t border-slate-100 m-2 rounded-2xl bg-slate-50/70 border flex items-center justify-between">
          <div className="flex items-center space-x-2.5 truncate">
            <div className="w-9 h-9 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-xs shrink-0 border border-teal-200">
              {getInitials(activeDoctor.name)}
            </div>
            <div className="truncate">
              <span className="block text-xs font-bold text-slate-900 truncate leading-tight">
                {activeDoctor.name}
              </span>
              <span className="text-[10px] text-slate-500 truncate block">
                {activeDoctor.specialty?.split('•')[0] || 'Cardiologia'} • {activeDoctor.crm || 'CRM 48.910'}
              </span>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('users')}
            className="p-1 text-slate-400 hover:text-slate-700 transition"
            title="Alternar Profissional"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </aside>

      {/* =========================================================================
          2. ÁREA PRINCIPAL (HEADER SUPERIOR + CONTEÚDO)
      ========================================================================= */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* HEADER SUPERIOR (BUSCA, MODOS, DATA E BOTAO NOVA CONSULTA) */}
        <header className="h-16 px-6 bg-white/95 backdrop-blur-md border-b border-slate-200/80 flex items-center justify-between gap-4 shrink-0 z-20">
          {/* BUSCADOR ESTILO DOCFLOW */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar paciente, CPF, convênio ou procedimento..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-2xl bg-slate-50 border border-slate-200/70 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition"
            />
          </div>

          {/* CONTROLES CENTRAIS E DIREITOS */}
          <div className="flex items-center space-x-3">
            {/* SEGMENTED CONTROL: DIA / SEMANA / MÊS */}
            <div className="bg-slate-100 p-1 rounded-xl flex border border-slate-200/60 text-xs font-semibold">
              <button
                onClick={() => setAgendaViewMode('dia')}
                className={`px-3 py-1 rounded-lg transition ${
                  agendaViewMode === 'dia'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Dia
              </button>
              <button
                onClick={() => setAgendaViewMode('semana')}
                className={`px-3 py-1 rounded-lg transition ${
                  agendaViewMode === 'semana'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Semana
              </button>
              <button
                onClick={() => setAgendaViewMode('mes')}
                className={`px-3 py-1 rounded-lg transition ${
                  agendaViewMode === 'mes'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Mês
              </button>
            </div>

            {/* SELETOR DE NAVEGAÇÃO DE DATA (< Hoje >) */}
            <div className="bg-slate-100 p-1 rounded-xl flex items-center border border-slate-200/60 text-xs font-semibold text-slate-700">
              <button
                onClick={() => {
                  const d = new Date(selectedDate);
                  d.setDate(d.getDate() - 1);
                  setSelectedDate(d);
                }}
                className="p-1 hover:bg-white rounded-md text-slate-600 transition"
                title="Dia anterior"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setSelectedDate(new Date())}
                className="px-2.5 py-0.5 hover:bg-white rounded-md text-slate-800 transition font-bold"
              >
                Hoje
              </button>
              <button
                onClick={() => {
                  const d = new Date(selectedDate);
                  d.setDate(d.getDate() + 1);
                  setSelectedDate(d);
                }}
                className="p-1 hover:bg-white rounded-md text-slate-600 transition"
                title="Próximo dia"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* DATA FORMATADA & HORA */}
            <div className="text-right pl-2 hidden sm:block">
              <span className="block text-xs font-bold text-slate-900 leading-tight">
                {selectedDateHeader}
              </span>
              <span className="text-[11px] text-slate-400 font-medium">
                {currentTimeStr} • {selectedDayAppointments.length} consultas hoje
              </span>
            </div>

            {/* CTA NOVO AGENDAMENTO */}
            <button
              onClick={() => {
                setNewApptTime('');
                setShowModalNewAppt(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md shadow-slate-900/15 transition active:scale-95"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              Nova Consulta
            </button>
          </div>
        </header>

        {/* NOTIFICAÇÃO CRON */}
        {cronNotice && (
          <div className="bg-teal-50 border-b border-teal-200 px-6 py-2 text-xs text-teal-900 flex items-center justify-between font-medium">
            <span>{cronNotice}</span>
            <button onClick={() => setCronNotice(null)} className="text-teal-700 hover:text-slate-900 font-bold">
              ✕
            </button>
          </div>
        )}

        {/* =========================================================================
            3. CONTEÚDO DINÂMICO CONFORME ABA SELECIONADA
        ========================================================================= */}
        <main className="flex-1 flex overflow-hidden p-6 gap-6">
          {/* ---------------------------------------------------------------------
              ABA: AGENDA MÉDICA (DUAS COLUNAS: ESQUERDA CALENDÁRIO/FILTROS + DIREITA TIMELINE)
          --------------------------------------------------------------------- */}
          {activeTab === 'agenda' && (
            <>
              {/* SUB-COLUNA ESQUERDA: MINI CALENDÁRIO, FILTROS DA AGENDA & ENCAIXE INTELIGENTE */}
              <div className="w-80 shrink-0 flex flex-col gap-4 overflow-y-auto pr-1">
                {/* 1. MINI CALENDÁRIO MENSAL */}
                <div className="bg-white rounded-3xl p-5 border border-slate-200/70 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-xs">{monthLabel}</span>
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => {
                          const m = new Date(calendarMonth);
                          m.setMonth(m.getMonth() - 1);
                          setCalendarMonth(m);
                        }}
                        className="p-1 hover:bg-slate-100 rounded-lg text-slate-500 transition"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          const m = new Date(calendarMonth);
                          m.setMonth(m.getMonth() + 1);
                          setCalendarMonth(m);
                        }}
                        className="p-1 hover:bg-slate-100 rounded-lg text-slate-500 transition"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* GRID DO MÊS */}
                  <div className="grid grid-cols-7 gap-1 text-center text-xs">
                    <span className="text-[10px] font-bold text-slate-400">D</span>
                    <span className="text-[10px] font-bold text-slate-400">S</span>
                    <span className="text-[10px] font-bold text-slate-400">T</span>
                    <span className="text-[10px] font-bold text-slate-400">Q</span>
                    <span className="text-[10px] font-bold text-slate-400">Q</span>
                    <span className="text-[10px] font-bold text-slate-400">S</span>
                    <span className="text-[10px] font-bold text-slate-400">S</span>

                    {miniCalendarDays.map((item, idx) => {
                      const isSelected = item.dateObj.toDateString() === selectedDate.toDateString();
                      const isToday = item.dateObj.toDateString() === new Date().toDateString();

                      return (
                        <button
                          key={idx}
                          onClick={() => setSelectedDate(item.dateObj)}
                          className={`h-7 w-7 mx-auto rounded-xl flex items-center justify-center text-xs font-semibold transition ${
                            isSelected
                              ? 'bg-slate-900 text-white font-bold shadow-xs'
                              : isToday
                              ? 'border border-teal-500 text-teal-700 font-bold'
                              : item.inMonth
                              ? 'text-slate-800 hover:bg-slate-100'
                              : 'text-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          {item.dayNumber}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. FILTROS DA AGENDA */}
                <div className="bg-white rounded-3xl p-5 border border-slate-200/70 shadow-xs space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="text-xs font-extrabold text-slate-900">Filtros da Agenda</span>
                    <button
                      onClick={() => {
                        setFilterConfirmed(true);
                        setFilterWaiting(true);
                        setFilterEncaixe(true);
                        setFilterCanceled(false);
                        setSelectedProcedure(null);
                        setSearchQuery('');
                      }}
                      className="text-[11px] font-semibold text-teal-700 hover:underline"
                    >
                      Limpar
                    </button>
                  </div>

                  {/* CHECKBOXES DE STATUS */}
                  <div className="space-y-2 text-xs">
                    <label className="flex items-center space-x-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filterConfirmed}
                        onChange={(e) => setFilterConfirmed(e.target.checked)}
                        className="rounded text-teal-600 focus:ring-teal-500 h-4 w-4 border-slate-300"
                      />
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span className="font-medium text-slate-700">Confirmados ({confirmedCount})</span>
                    </label>

                    <label className="flex items-center space-x-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filterWaiting}
                        onChange={(e) => setFilterWaiting(e.target.checked)}
                        className="rounded text-amber-500 focus:ring-amber-400 h-4 w-4 border-slate-300"
                      />
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      <span className="font-medium text-slate-700">Aguardando ({waitingCount})</span>
                    </label>

                    <label className="flex items-center space-x-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filterEncaixe}
                        onChange={(e) => setFilterEncaixe(e.target.checked)}
                        className="rounded text-sky-500 focus:ring-sky-400 h-4 w-4 border-slate-300"
                      />
                      <span className="w-2 h-2 rounded-full bg-sky-500"></span>
                      <span className="font-medium text-slate-700">Encaixe Confirmado ({encaixeCount})</span>
                    </label>

                    <label className="flex items-center space-x-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filterCanceled}
                        onChange={(e) => setFilterCanceled(e.target.checked)}
                        className="rounded text-rose-500 focus:ring-rose-400 h-4 w-4 border-slate-300"
                      />
                      <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                      <span className="font-medium text-slate-700">Cancelados</span>
                    </label>
                  </div>

                  {/* SEÇÃO PROCEDIMENTO */}
                  <div className="pt-2 border-t border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                      Procedimento
                    </span>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center justify-between text-slate-700 py-0.5">
                        <span className="font-medium">Consulta Clínica</span>
                        <span className="font-bold text-slate-400">8</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-700 py-0.5">
                        <span className="font-medium">Ecocardiograma</span>
                        <span className="font-bold text-slate-400">3</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-700 py-0.5">
                        <span className="font-medium">Holter 24h</span>
                        <span className="font-bold text-slate-400">3</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. ENCAIXE INTELIGENTE ATIVO (WHATSAPP RECOVERY) */}
                <div className="bg-gradient-to-br from-sky-50 via-blue-50/50 to-indigo-50/20 border border-sky-100 rounded-3xl p-4.5 space-y-2 text-xs shadow-xs">
                  <div className="flex items-center gap-1.5 font-bold text-sky-950">
                    <Zap className="w-4 h-4 text-sky-600 fill-sky-600" />
                    <span>Encaixe Inteligente Ativo</span>
                  </div>
                  <p className="text-[11px] text-sky-800 leading-relaxed font-medium">
                    Se houver cancelamento, pacientes da fila de espera são acionados instantaneamente por WhatsApp.
                  </p>
                  <button
                    onClick={handleTriggerCronReminders}
                    disabled={cronRunning}
                    className="w-full mt-2 py-2 px-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-[11px] transition shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <Clock className={`w-3.5 h-3.5 ${cronRunning ? 'animate-spin' : ''}`} />
                    {cronRunning ? 'Enviando Lembretes...' : 'Disparar Lembretes 24h'}
                  </button>
                </div>
              </div>

              {/* SUB-COLUNA DIREITA: TIMELINE DIÁRIA EXATAMENTE NO LAYOUT DOCFLOW */}
              <div className="flex-1 bg-white rounded-3xl border border-slate-200/70 shadow-xs p-6 flex flex-col overflow-hidden">
                {/* CABEÇALHO DO PAINEL DIREITO */}
                <div className="pb-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                      <span>Agenda Médica • {activeDoctor.name}</span>
                    </h2>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      {activeDoctor.specialty} • {activeDoctor.room || 'Sala 402'}
                    </p>
                  </div>

                  {/* PILL COUNTERS COLORIDOS */}
                  <div className="flex items-center space-x-2 text-xs font-semibold">
                    <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      {confirmedCount} Confirmados
                    </span>
                    <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200/80 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                      {waitingCount} Aguardando Confirmação
                    </span>
                    <span className="px-3 py-1 rounded-full bg-sky-50 text-sky-700 border border-sky-200/80 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
                      {encaixeCount} Encaixe
                    </span>
                  </div>
                </div>

                {/* SUB-BARRA DA DATA E HORÁRIO ATUAL */}
                <div className="py-2.5 flex items-center justify-between text-xs font-semibold text-slate-700 border-b border-slate-100/80">
                  <span>{selectedDateHeader} • Turnos Matutino e Vespertino</span>
                  <span className="text-rose-500 font-medium">— Horário atual: {currentTimeStr}</span>
                </div>

                {/* LISTAGEM DE CONSULTAS DA TIMELINE */}
                <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 mt-3.5">
                  {loading ? (
                    <div className="py-16 text-center text-slate-400 font-medium">Carregando consultas da agenda...</div>
                  ) : selectedDayAppointments.length === 0 ? (
                    <div className="py-20 flex flex-col items-center justify-center text-center">
                      <CalendarDays className="w-12 h-12 text-slate-300 stroke-1 mb-2" />
                      <p className="text-sm font-bold text-slate-800">Nenhuma consulta agendada para este dia</p>
                      <p className="text-xs text-slate-400 mt-0.5">Clique em "Nova Consulta" para incluir um paciente na grade.</p>
                      <button
                        onClick={() => openNewApptModalWithSlot(selectedDate)}
                        className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-slate-800 transition"
                      >
                        + Agendar Consulta Agora
                      </button>
                    </div>
                  ) : (
                    selectedDayAppointments.map((appt) => {
                      const start = new Date(appt.startTime);
                      const timeStr = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      const s = (appt.status || '').toUpperCase();
                      const isConfirmed = s === 'CONFIRMADO' || s === 'CONFIRMED';
                      const isWaiting = s === 'AGENDADO' || s === 'SCHEDULED';
                      const isEncaixe = s === 'REMARCADO' || s === 'RESCHEDULED';
                      const isCanceled = s === 'CANCELADO' || s === 'CANCELED';

                      return (
                        <div key={appt.id} className="flex items-center gap-4 group">
                          {/* COLUNA DO HORÁRIO */}
                          <div className="w-14 text-center shrink-0">
                            <span className="block font-extrabold text-slate-900 text-sm font-mono leading-tight">
                              {timeStr}
                            </span>
                            <span className="text-[11px] font-medium text-slate-400">45 min</span>
                          </div>

                          {/* CARD PRINCIPAL DO PACIENTE */}
                          <div
                            className={`flex-1 rounded-2xl p-4 border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                              isConfirmed
                                ? 'border-emerald-200/90 bg-white hover:border-emerald-300 hover:shadow-xs'
                                : isWaiting
                                ? 'border-amber-200/90 bg-white hover:border-amber-300 hover:shadow-xs'
                                : isEncaixe
                                ? 'border-sky-200/90 bg-white hover:border-sky-300 hover:shadow-xs'
                                : 'border-rose-200/90 bg-white opacity-60'
                            }`}
                          >
                            {/* DADOS DO PACIENTE */}
                            <div className="flex items-center space-x-3.5">
                              {/* AVATAR COM INICIAIS */}
                              <div
                                className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-xs shrink-0 ${
                                  isConfirmed
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : isWaiting
                                    ? 'bg-amber-100 text-amber-800'
                                    : isEncaixe
                                    ? 'bg-sky-100 text-sky-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {getInitials(appt.patient?.name)}
                              </div>

                              <div className="space-y-1">
                                {/* LINHA 1: NOME + BADGES */}
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-bold text-slate-900 text-sm">
                                    {appt.patient?.name}
                                  </span>

                                  {isConfirmed && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      Confirmado
                                    </span>
                                  )}
                                  {isWaiting && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                      Aguardando Confirmação
                                    </span>
                                  )}
                                  {isEncaixe && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200 flex items-center gap-1">
                                      <Zap className="w-3 h-3 text-sky-600 fill-sky-600" />
                                      Encaixe Confirmado
                                    </span>
                                  )}
                                  {isCanceled && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                      Cancelado
                                    </span>
                                  )}

                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                    {appt.notes?.includes('Bradesco')
                                      ? 'Bradesco Saúde'
                                      : appt.notes?.includes('Unimed')
                                      ? 'Unimed'
                                      : appt.notes?.includes('Amil')
                                      ? 'Amil 500'
                                      : 'Particular'}
                                  </span>
                                </div>

                                {/* LINHA 2: IDADE, CONVÊNIO, TELEFONE */}
                                <div className="text-[11px] text-slate-500 font-medium">
                                  {appt.patient?.birthDate ? calculateAge(appt.patient.birthDate) : '52 anos'} •{' '}
                                  {formatPhoneBR(appt.patient?.phone)}
                                  {appt.patient?.cpf ? ` • CPF: ${applyCPFMask(appt.patient.cpf)}` : ''}
                                </div>

                                {/* LINHA 3: PROCEDIMENTO / MOTIVO */}
                                <div className="text-[11px] text-slate-600 font-medium">
                                  {appt.notes || 'Retorno Cardiológico • Acompanhamento Preventivo'}
                                </div>

                                {/* BOTAO REFORCAR AVISO (PARA AGUARDANDO) */}
                                {isWaiting && (
                                  <div className="pt-1">
                                    <a
                                      href={`https://wa.me/${(appt.patient?.phone || '').replace(/\D/g, '')}?text=${encodeURIComponent(
                                        `Olá ${appt.patient?.name}, confirmamos sua consulta com ${activeDoctor.name} para o dia ${selectedDate.toLocaleDateString('pt-BR')} às ${timeStr}?`
                                      )}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-[11px] font-bold transition"
                                    >
                                      <Megaphone className="w-3 h-3 text-amber-600" />
                                      Reforçar Aviso
                                    </a>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* BOTOES DE ACAO DO CARD DIREITO */}
                            <div className="flex items-center space-x-2 shrink-0">
                              <button
                                onClick={() => setSelectedApptDetails(appt)}
                                className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold shadow-2xs flex items-center gap-1.5 transition"
                              >
                                <FileText className="w-3.5 h-3.5 text-slate-500" />
                                Prontuário
                              </button>

                              <a
                                href={`https://wa.me/${(appt.patient?.phone || '').replace(/\D/g, '')}`}
                                target="_blank"
                                rel="noreferrer"
                                className="p-2 rounded-xl bg-white hover:bg-emerald-50 border border-slate-200 text-emerald-600 hover:border-emerald-300 transition shadow-2xs"
                                title="Abrir conversa no WhatsApp"
                              >
                                <MessageSquare className="w-4 h-4" />
                              </a>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </>
          )}

          {/* ---------------------------------------------------------------------
              ABA: PACIENTES & PRONTUÁRIO (DESIGN DOCFLOW)
          --------------------------------------------------------------------- */}
          {activeTab === 'patients' && (
            <div className="flex-1 bg-white rounded-3xl border border-slate-200/70 shadow-xs p-6 flex flex-col overflow-hidden">
              <div className="pb-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">Pacientes & Prontuário</h2>
                  <p className="text-xs text-slate-500 font-medium">Fichas cadastrais, telefones e histórico clínico da clínica</p>
                </div>
                <button
                  onClick={() => handleOpenPatientModal()}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md shadow-slate-900/15 transition"
                >
                  <UserPlus className="w-4 h-4 stroke-[2.5]" />
                  Cadastrar Paciente
                </button>
              </div>

              {/* TABELA DE PACIENTES */}
              <div className="flex-1 overflow-y-auto mt-4">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="p-3.5 uppercase tracking-wider text-[10px]">Paciente / CPF</th>
                      <th className="p-3.5 uppercase tracking-wider text-[10px]">Contato</th>
                      <th className="p-3.5 uppercase tracking-wider text-[10px]">Idade</th>
                      <th className="p-3.5 uppercase tracking-wider text-[10px]">Consultas</th>
                      <th className="p-3.5 uppercase tracking-wider text-[10px]">Observações</th>
                      <th className="p-3.5 uppercase tracking-wider text-[10px] text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {patients.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/80 transition">
                        <td className="p-3.5">
                          <div className="flex items-center space-x-3">
                            <div className="w-9 h-9 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-xs">
                              {getInitials(p.name)}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 text-xs">{p.name}</div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                {p.cpf ? `CPF: ${applyCPFMask(p.cpf)}` : 'CPF não informado'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="p-3.5">
                          <div className="font-mono font-bold text-slate-800">{formatPhoneBR(p.phone)}</div>
                          {p.email && <div className="text-[10px] text-slate-400">{p.email}</div>}
                        </td>
                        <td className="p-3.5 font-medium text-slate-700">
                          {p.birthDate ? calculateAge(p.birthDate) : '—'}
                        </td>
                        <td className="p-3.5">
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                            {p._count?.appointments ?? 1} consulta(s)
                          </span>
                        </td>
                        <td className="p-3.5 text-slate-500 max-w-xs truncate">{p.notes || '—'}</td>
                        <td className="p-3.5 text-right space-x-2">
                          <button
                            onClick={() => handleOpenPatientModal(p)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                            title="Editar"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeletePatient(p.id)}
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 transition"
                            title="Excluir"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------------------------
              ABA: FILA DE ESPERA & ENCAIXE
          --------------------------------------------------------------------- */}
          {activeTab === 'fila' && (
            <div className="flex-1 bg-white rounded-3xl border border-slate-200/70 shadow-xs p-6 flex flex-col">
              <div className="pb-4 border-b border-slate-100">
                <h2 className="text-lg font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                  <Inbox className="w-5 h-5 text-sky-600" />
                  Fila de Espera & Encaixes Inteligentes
                </h2>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Pacientes aguardando antecipação de horário com disparo automático via WhatsApp
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
                <div className="p-5 rounded-2xl bg-sky-50/60 border border-sky-100">
                  <span className="text-xs font-bold text-sky-900 block">Pacientes na Fila</span>
                  <span className="text-2xl font-extrabold text-sky-950 mt-1 block">4</span>
                  <span className="text-[11px] text-sky-700 mt-1 block">Prioridade por ordem de solicitação</span>
                </div>
                <div className="p-5 rounded-2xl bg-emerald-50/60 border border-emerald-100">
                  <span className="text-xs font-bold text-emerald-900 block">Tempo Médio de Resposta</span>
                  <span className="text-2xl font-extrabold text-emerald-950 mt-1 block">4 min</span>
                  <span className="text-[11px] text-emerald-700 mt-1 block">Aceite instantâneo via botão de WhatsApp</span>
                </div>
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/70">
                  <span className="text-xs font-bold text-slate-900 block">Vagas Recuperadas este Mês</span>
                  <span className="text-2xl font-extrabold text-slate-950 mt-1 block">18 vagas</span>
                  <span className="text-[11px] text-slate-500 mt-1 block">0% de ociosidade por faltas</span>
                </div>
              </div>

              <div className="flex-1 p-6 rounded-2xl border border-dashed border-slate-200 flex flex-col items-center justify-center text-center">
                <Zap className="w-10 h-10 text-sky-500 stroke-1 mb-2" />
                <h3 className="text-sm font-bold text-slate-800">Motor de Recuperação de Faltas Ativo</h3>
                <p className="text-xs text-slate-500 max-w-md mt-1">
                  Quando uma consulta for cancelada ou remarcada pelo WhatsApp, o CliniDesk aciona automaticamente os pacientes da lista de espera com opções interativas de [SIM / NÃO].
                </p>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------------------------
              ABA: WHATSAPP & LEMBRETES
          --------------------------------------------------------------------- */}
          {activeTab === 'whatsapp' && (
            <div className="flex-1 bg-white rounded-3xl border border-slate-200/70 shadow-xs p-6 flex flex-col">
              <div className="pb-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-emerald-600" />
                    WhatsApp & Automação de Lembretes
                  </h2>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Integração Oficial Meta Cloud API (v26.0) • Disparos automáticos e interativos
                  </p>
                </div>
                <button
                  onClick={handleTriggerCronReminders}
                  disabled={cronRunning}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5"
                >
                  <Clock className={`w-3.5 h-3.5 ${cronRunning ? 'animate-spin' : ''}`} />
                  {cronRunning ? 'Disparando...' : 'Testar Disparo 24h'}
                </button>
              </div>

              <div className="my-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl bg-emerald-50/50 border border-emerald-200/80">
                  <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs mb-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Meta WhatsApp Cloud API Ativa
                  </div>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Instância conectada com sucesso ao número oficial da clínica. Suporte a botões interativos e IA determinística do POP.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/70">
                  <span className="text-xs font-bold text-slate-900 block">Lembretes das Próximas 24 Horas</span>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Cron automático configurado para checar a cada 30 minutos e notificar pacientes com antecedência mínima de 24 horas.
                  </p>
                </div>
              </div>

              <div className="flex-1 p-6 rounded-2xl bg-slate-50/50 border border-slate-200/60 overflow-y-auto">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block mb-3">
                  Últimas Notificações Registradas
                </span>
                <div className="space-y-2 text-xs">
                  {appointments.slice(0, 5).map((a) => (
                    <div key={a.id} className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="font-bold text-slate-800">{a.patient?.name}</span>
                        <span className="text-slate-400 font-mono text-[11px]">{formatPhoneBR(a.patient?.phone)}</span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Entregue
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------------------------
              ABA: USUÁRIOS & MÉDICOS
          --------------------------------------------------------------------- */}
          {activeTab === 'users' && (
            <div className="flex-1 bg-white rounded-3xl border border-slate-200/70 shadow-xs p-6 flex flex-col overflow-hidden">
              <div className="pb-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">Equipe Médica & Usuários</h2>
                  <p className="text-xs text-slate-500 font-medium">Médicos, recepcionistas e administradores do consultório</p>
                </div>
                <button
                  onClick={() => handleOpenUserModal()}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs transition"
                >
                  + Cadastrar Usuário
                </button>
              </div>

              <div className="flex-1 overflow-y-auto mt-4">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="p-3.5 uppercase tracking-wider text-[10px]">Profissional</th>
                      <th className="p-3.5 uppercase tracking-wider text-[10px]">Função / Especialidade</th>
                      <th className="p-3.5 uppercase tracking-wider text-[10px]">Contato</th>
                      <th className="p-3.5 uppercase tracking-wider text-[10px]">Status</th>
                      <th className="p-3.5 uppercase tracking-wider text-[10px] text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50/80 transition">
                        <td className="p-3.5 font-bold text-slate-900">{u.name}</td>
                        <td className="p-3.5">
                          <span className="font-semibold text-slate-700 block">{u.role}</span>
                          <span className="text-[10px] text-slate-400">{u.specialty || 'Geral'}</span>
                        </td>
                        <td className="p-3.5 font-mono text-slate-600">{u.email}</td>
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {u.status}
                          </span>
                        </td>
                        <td className="p-3.5 text-right space-x-2">
                          <button
                            onClick={() => handleOpenUserModal(u)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u.id)}
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------------------------
              ABA: CONFIGURAÇÕES & EXPEDIENTE
          --------------------------------------------------------------------- */}
          {activeTab === 'settings' && clinic && (
            <div className="flex-1 bg-white rounded-3xl border border-slate-200/70 shadow-xs p-6 overflow-y-auto">
              <div className="pb-4 border-b border-slate-100 mb-6">
                <h2 className="text-lg font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                  <Settings className="w-5 h-5 text-teal-600" />
                  Configurações do Consultório & Expediente
                </h2>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Parâmetros de atendimento, duração das consultas e regras de cancelamento
                </p>
              </div>

              <form onSubmit={handleSaveSettings} className="space-y-6 max-w-2xl text-xs">
                <div className="space-y-4">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Nome do Consultório / Clínica</label>
                    <input
                      type="text"
                      value={clinic.name || ''}
                      onChange={(e) => setClinic({ ...clinic, name: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Especialidade Principal</label>
                    <input
                      type="text"
                      value={clinic.specialty || ''}
                      onChange={(e) => setClinic({ ...clinic, specialty: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 font-medium"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Duração da Consulta (minutos)</label>
                      <input
                        type="number"
                        value={clinic.slotDurationMinutes || 30}
                        onChange={(e) => setClinic({ ...clinic, slotDurationMinutes: parseInt(e.target.value) })}
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-200 font-medium"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Antecedência Mínima Cancelamento (horas)</label>
                      <input
                        type="number"
                        value={clinic.minCancelHours || 2}
                        onChange={(e) => setClinic({ ...clinic, minCancelHours: parseInt(e.target.value) })}
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-200 font-medium"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex justify-end">
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-xs transition"
                  >
                    Salvar Parâmetros
                  </button>
                </div>
              </form>
            </div>
          )}
        </main>
      </div>

      {/* =========================================================================
          4. MODAL: NOVA CONSULTA
      ========================================================================= */}
      {showModalNewAppt && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                <CalendarPlus className="w-4 h-4 text-teal-600" />
                Agendar Nova Consulta
              </h3>
              <button onClick={() => setShowModalNewAppt(false)} className="text-slate-400 hover:text-slate-700 font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateAppointment} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Paciente Cadastrado *</label>
                <select
                  required
                  value={selectedPatientId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedPatientId(id);
                    const p = patients.find((x) => x.id === id);
                    if (p) {
                      setNewApptName(p.name);
                      setNewApptPhone(p.phone);
                    } else {
                      setNewApptName('');
                      setNewApptPhone('');
                    }
                  }}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 font-medium"
                >
                  <option value="">-- Selecione um Paciente Cadastrado --</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.cpf ? `(CPF: ${applyCPFMask(p.cpf)})` : ''} — {formatPhoneBR(p.phone)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Data e Horário *</label>
                <input
                  type="datetime-local"
                  required
                  value={newApptTime}
                  onChange={(e) => setNewApptTime(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Procedimento / Observações</label>
                <textarea
                  rows={2}
                  placeholder="Ex: Retorno cardiológico, check-up preventivo..."
                  value={newApptNotes}
                  onChange={(e) => setNewApptNotes(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 font-medium"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModalNewAppt(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!selectedPatientId}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold shadow-xs disabled:opacity-40"
                >
                  Confirmar Agendamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          5. MODAL: DETALHES / PRONTUÁRIO RÁPIDO
      ========================================================================= */}
      {selectedApptDetails && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-teal-600" />
                Prontuário & Detalhes da Consulta
              </h3>
              <button onClick={() => setSelectedApptDetails(null)} className="text-slate-400 hover:text-slate-700 font-bold">
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400">Paciente</span>
                <p className="font-bold text-slate-900 text-sm">{selectedApptDetails.patient?.name}</p>
                <p className="text-slate-600 font-mono">{formatPhoneBR(selectedApptDetails.patient?.phone)}</p>
                {selectedApptDetails.patient?.cpf && (
                  <p className="text-slate-500 font-mono text-[11px]">CPF: {applyCPFMask(selectedApptDetails.patient.cpf)}</p>
                )}
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400">Horário Marcado</span>
                <p className="font-bold text-slate-800">
                  {new Date(selectedApptDetails.startTime).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })} às{' '}
                  {new Date(selectedApptDetails.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
                <p className="text-slate-500">Status atual: <span className="font-bold text-slate-800">{getStatusLabel(selectedApptDetails.status)}</span></p>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400">Observações Clínicas</span>
                <p className="text-slate-700 leading-relaxed font-medium">{selectedApptDetails.notes || 'Nenhuma anotação inserida.'}</p>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                onClick={() => setSelectedApptDetails(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl font-bold text-xs"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          6. MODAL: NOVO / EDITAR PACIENTE
      ========================================================================= */}
      {showModalPatient && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                <Contact className="w-4 h-4 text-teal-600" />
                {editingPatient ? 'Editar Paciente' : 'Novo Cadastro de Paciente'}
              </h3>
              <button onClick={() => setShowModalPatient(false)} className="text-slate-400 hover:text-slate-700 font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePatient} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nome Completo *</label>
                <input
                  type="text"
                  required
                  value={patName}
                  onChange={(e) => setPatName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Telefone (WhatsApp) *</label>
                  <input
                    type="text"
                    required
                    value={patPhone}
                    onChange={(e) => setPatPhone(applyPhoneMask(e.target.value))}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 font-mono font-medium"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">CPF</label>
                  <input
                    type="text"
                    value={patCpf}
                    onChange={(e) => setPatCpf(applyCPFMask(e.target.value))}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 font-mono font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">E-mail</label>
                <input
                  type="email"
                  value={patEmail}
                  onChange={(e) => setPatEmail(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Observações / Alergias</label>
                <textarea
                  rows={2}
                  value={patNotes}
                  onChange={(e) => setPatNotes(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 font-medium"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModalPatient(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold shadow-xs"
                >
                  Salvar Paciente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          7. MODAL: NOVO / EDITAR USUÁRIO
      ========================================================================= */}
      {showModalUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                <UserCog className="w-4 h-4 text-teal-600" />
                {editingUser ? 'Editar Usuário' : 'Novo Cadastro de Usuário'}
              </h3>
              <button onClick={() => setShowModalUser(false)} className="text-slate-400 hover:text-slate-700 font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nome Completo</label>
                <input
                  type="text"
                  required
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">E-mail</label>
                <input
                  type="email"
                  required
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Cargo</label>
                  <select
                    value={userRole}
                    onChange={(e: any) => setUserRole(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 font-medium"
                  >
                    <option value="MEDICO">Médico(a)</option>
                    <option value="RECEPCIONISTA">Recepcionista</option>
                    <option value="ADMIN">Administrador</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Status</label>
                  <select
                    value={userStatus}
                    onChange={(e: any) => setUserStatus(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 font-medium"
                  >
                    <option value="ACTIVE">Ativo</option>
                    <option value="INACTIVE">Inativo</option>
                  </select>
                </div>
              </div>

              {userRole === 'MEDICO' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Especialidade / CRM</label>
                  <input
                    type="text"
                    value={userSpecialty}
                    onChange={(e) => setUserSpecialty(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 font-medium"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModalUser(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold shadow-xs"
                >
                  Salvar Usuário
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
