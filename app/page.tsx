'use client';

import { useState, useEffect } from 'react';
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
} from 'lucide-react';

function formatPhoneBR(phone: string | null | undefined): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  const localDigits = (digits.startsWith('55') && digits.length >= 12) ? digits.slice(2) : digits;

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

function getStatusLabel(status: string | undefined | null): string {
  if (!status) return 'Agendado';
  const s = status.toUpperCase();
  if (s === 'SCHEDULED' || s === 'AGENDADO') return 'Agendado';
  if (s === 'CONFIRMED' || s === 'CONFIRMADO') return 'Confirmado';
  if (s === 'RESCHEDULED' || s === 'REMARCADO') return 'Remarcado';
  if (s === 'CANCELED' || s === 'CANCELADO') return 'Cancelado';
  return status;
}

function getStatusBadgeStyle(status: string | undefined | null): string {
  const s = (status || '').toUpperCase();
  if (s === 'CONFIRMED' || s === 'CONFIRMADO') {
    return 'bg-emerald-50 text-emerald-800 border-emerald-200';
  }
  if (s === 'SCHEDULED' || s === 'AGENDADO') {
    return 'bg-sky-50 text-sky-800 border-sky-200';
  }
  if (s === 'RESCHEDULED' || s === 'REMARCADO') {
    return 'bg-amber-50 text-amber-800 border-amber-200';
  }
  return 'bg-rose-50 text-rose-800 border-rose-200';
}

// Utilitários de data
function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Segunda-feira como inicio
  const start = new Date(d.setDate(diff));
  start.setHours(0, 0, 0, 0);
  return start;
}

function getWeekDays(baseDate: Date): Date[] {
  const start = getStartOfWeek(baseDate);
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    days.push(day);
  }
  return days;
}

const WEEKDAY_NAMES = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
const DAILY_HOURS = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<'agenda' | 'patients' | 'users' | 'settings'>('agenda');
  const [agendaViewMode, setAgendaViewMode] = useState<'lista' | 'dia' | 'semana'>('semana');

  const [loading, setLoading] = useState(true);
  const [clinic, setClinic] = useState<any>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [filterDate, setFilterDate] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Controle de datas para Visão Diária e Semanal
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

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

  // Carregar dados iniciais
  useEffect(() => {
    fetchData();
    fetchPatients();
    fetchUsers();
  }, [filterDate, filterStatus]);

  async function fetchData() {
    try {
      setLoading(true);
      // Carregar Clínica
      const resSettings = await fetch('/api/clinic/settings');
      const dataSettings = await resSettings.json();
      if (dataSettings.clinic) {
        setClinic(dataSettings.clinic);
      }

      // Carregar Agendamentos
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

  // Cron Lembretes
  async function handleTriggerCronReminders() {
    setCronRunning(true);
    setCronNotice(null);
    try {
      const res = await fetch('/api/appointments/cron-reminders', { method: 'POST' });
      const data = await res.json();
      setCronNotice(`✅ Lembretes enviados! ${data.processed} agendamentos notificados para as próximas 24h.`);
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

  // Abrir Modal de Agendamento com Data/Hora pré-preenchidas
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

  // Abrir Modal de Agendamento pré-preenchido com Paciente Cadastrado
  function handleQuickApptForPatient(patient: any) {
    setSelectedPatientId(patient.id);
    setNewApptName(patient.name);
    setNewApptPhone(formatPhoneBR(patient.phone) || patient.phone);
    setNewApptTime('');
    setNewApptNotes(`Agendamento direto para ${patient.name}`);
    setShowModalNewAppt(true);
  }

  // Salvar Configurações
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

  // Ações de Pacientes (CRUD)
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

  // Ações de Usuário (CRUD)
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

  // Contadores KPIs
  const totalAppts = appointments.length;
  const confirmedCount = appointments.filter((a) => a.status === 'CONFIRMADO' || a.status === 'CONFIRMED').length;
  const rescheduledCount = appointments.filter((a) => a.status === 'REMARCADO' || a.status === 'RESCHEDULED').length;
  const canceledCount = appointments.filter((a) => a.status === 'CANCELADO' || a.status === 'CANCELED').length;

  // Filtro de Pacientes
  const filteredPatients = patients.filter((p) => {
    if (!patientSearch) return true;
    const query = patientSearch.toLowerCase();
    return (
      p.name.toLowerCase().includes(query) ||
      p.phone.toLowerCase().includes(query) ||
      (p.cpf && p.cpf.toLowerCase().includes(query)) ||
      (p.email && p.email.toLowerCase().includes(query))
    );
  });

  // Filtro de Usuários
  const filteredUsers = users.filter((u) => {
    const matchesRole = userRoleFilter === 'ALL' || u.role === userRoleFilter;
    const matchesSearch =
      !userSearch ||
      u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.specialty && u.specialty.toLowerCase().includes(userSearch.toLowerCase()));
    return matchesRole && matchesSearch;
  });

  // Datas da semana atual
  const weekDays = getWeekDays(selectedDate);
  const weekStartStr = weekDays[0].toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const weekEndStr = weekDays[6].toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* HEADER SUPERIOR CLEAN & SAÚDE */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-md px-6 py-4 flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center space-x-3.5">
          <div className="h-11 w-11 rounded-2xl bg-gradient-to-tr from-teal-600 to-emerald-500 flex items-center justify-center shadow-md shadow-teal-600/20 text-white">
            <Stethoscope className="h-6 w-6 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900">CliniDesk</h1>
              <span className="px-2 py-0.5 text-[10px] font-semibold bg-teal-50 text-teal-700 border border-teal-200/60 rounded-md">
                Gestão Médica
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {clinic ? `${clinic.name} • ${clinic.specialty}` : 'Carregando clínica...'}
            </p>
          </div>
        </div>

        {/* STATUS BADGES & AÇÕES */}
        <div className="flex items-center flex-wrap gap-3 text-xs font-medium">
          <div className="flex items-center px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-700 font-semibold shadow-xs">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse mr-2"></span>
            Sistema Online
          </div>
          <button
            onClick={handleTriggerCronReminders}
            disabled={cronRunning}
            className="flex items-center px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-semibold transition shadow-md shadow-teal-700/15 disabled:opacity-50"
          >
            <Clock className={`h-3.5 w-3.5 mr-1.5 ${cronRunning ? 'animate-spin' : ''}`} />
            {cronRunning ? 'Enviando Lembretes...' : 'Disparar Lembretes 24h'}
          </button>
          <button
            onClick={() => {
              setNewApptTime('');
              setShowModalNewAppt(true);
            }}
            className="flex items-center px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition shadow-md shadow-emerald-600/15"
          >
            <Plus className="h-4 w-4 mr-1.5 stroke-[2.5]" />
            Novo Agendamento
          </button>
        </div>
      </header>

      {/* NOTIFICAÇÃO CRON */}
      {cronNotice && (
        <div className="bg-teal-50 border-b border-teal-200 px-6 py-2.5 text-xs text-teal-900 flex items-center justify-between font-medium">
          <span>{cronNotice}</span>
          <button onClick={() => setCronNotice(null)} className="text-teal-700 hover:text-slate-900 font-bold text-sm">
            ✕
          </button>
        </div>
      )}

      {/* PAINEL PRINCIPAL */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* KPI CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="medical-card medical-card-hover rounded-2xl p-5 flex items-center justify-between border-l-4 border-l-teal-600">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total de Consultas</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{totalAppts}</p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
              <CalendarIcon className="h-5 w-5" />
            </div>
          </div>

          <div className="medical-card medical-card-hover rounded-2xl p-5 flex items-center justify-between border-l-4 border-l-emerald-500">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Confirmadas</p>
              <p className="text-2xl font-bold text-emerald-700 mt-1">{confirmedCount}</p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <UserCheck className="h-5 w-5" />
            </div>
          </div>

          <div className="medical-card medical-card-hover rounded-2xl p-5 flex items-center justify-between border-l-4 border-l-amber-500">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Remarcações</p>
              <p className="text-2xl font-bold text-amber-700 mt-1">{rescheduledCount}</p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <CalendarCheck2 className="h-5 w-5" />
            </div>
          </div>

          <div className="medical-card medical-card-hover rounded-2xl p-5 flex items-center justify-between border-l-4 border-l-purple-500">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pacientes Cadastrados</p>
              <p className="text-2xl font-bold text-purple-700 mt-1">{patients.length}</p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
              <Contact className="h-5 w-5" />
            </div>
          </div>
        </div>

        {/* NAVEGAÇÃO PRINCIPAL DAS ABAS */}
        <div className="flex flex-wrap bg-slate-200/60 p-1.5 rounded-2xl w-fit gap-1 border border-slate-200">
          <button
            onClick={() => setActiveTab('agenda')}
            className={`flex items-center px-4 py-2 font-semibold text-xs rounded-xl transition ${
              activeTab === 'agenda'
                ? 'bg-white text-teal-800 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <CalendarIcon className="h-4 w-4 mr-2 text-teal-600" />
            Agenda & Consultas
          </button>
          <button
            onClick={() => setActiveTab('patients')}
            className={`flex items-center px-4 py-2 font-semibold text-xs rounded-xl transition ${
              activeTab === 'patients'
                ? 'bg-white text-teal-800 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Contact className="h-4 w-4 mr-2 text-teal-600" />
            Cadastro de Pacientes
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center px-4 py-2 font-semibold text-xs rounded-xl transition ${
              activeTab === 'users'
                ? 'bg-white text-teal-800 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Users className="h-4 w-4 mr-2 text-teal-600" />
            Cadastro de Usuários
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center px-4 py-2 font-semibold text-xs rounded-xl transition ${
              activeTab === 'settings'
                ? 'bg-white text-teal-800 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Settings className="h-4 w-4 mr-2 text-teal-600" />
            Expediente & Parâmetros
          </button>
        </div>

        {/* ABA 1: AGENDA DE CONSULTAS */}
        {activeTab === 'agenda' && (
          <div className="space-y-4">
            {/* SELETOR DE MODO DE VISUALIZAÇÃO E CONTROLES DE NAVEGAÇÃO DA AGENDA */}
            <div className="medical-card p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 border border-slate-200 shadow-xs">
              {/* TROCA DE MODOS: DIA | SEMANA | LISTA */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  onClick={() => setAgendaViewMode('semana')}
                  className={`flex items-center px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    agendaViewMode === 'semana'
                      ? 'bg-white text-teal-800 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <CalendarRange className="h-3.5 w-3.5 mr-1.5 text-teal-600" />
                  Visão Semanal
                </button>
                <button
                  onClick={() => setAgendaViewMode('dia')}
                  className={`flex items-center px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    agendaViewMode === 'dia'
                      ? 'bg-white text-teal-800 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <CalendarDays className="h-3.5 w-3.5 mr-1.5 text-teal-600" />
                  Visão Diária
                </button>
                <button
                  onClick={() => setAgendaViewMode('lista')}
                  className={`flex items-center px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    agendaViewMode === 'lista'
                      ? 'bg-white text-teal-800 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <ListFilter className="h-3.5 w-3.5 mr-1.5 text-teal-600" />
                  Visão em Lista
                </button>
              </div>

              {/* CONTROLES DE NAVEGAÇÃO DE DATA (CONFORME MODO SELECIONADO) */}
              {agendaViewMode === 'semana' && (
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-1 bg-white border border-slate-200 rounded-xl p-1 shadow-2xs">
                    <button
                      onClick={() => {
                        const d = new Date(selectedDate);
                        d.setDate(d.getDate() - 7);
                        setSelectedDate(d);
                      }}
                      className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition"
                      title="Semana anterior"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setSelectedDate(new Date())}
                      className="px-3 py-1 text-xs font-bold text-teal-800 hover:bg-teal-50 rounded-lg transition"
                    >
                      Esta Semana
                    </button>
                    <button
                      onClick={() => {
                        const d = new Date(selectedDate);
                        d.setDate(d.getDate() + 7);
                        setSelectedDate(d);
                      }}
                      className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition"
                      title="Próxima semana"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                  <span className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 font-mono">
                    {weekStartStr} — {weekEndStr}
                  </span>
                </div>
              )}

              {agendaViewMode === 'dia' && (
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-1 bg-white border border-slate-200 rounded-xl p-1 shadow-2xs">
                    <button
                      onClick={() => {
                        const d = new Date(selectedDate);
                        d.setDate(d.getDate() - 1);
                        setSelectedDate(d);
                      }}
                      className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition"
                      title="Dia anterior"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setSelectedDate(new Date())}
                      className="px-3 py-1 text-xs font-bold text-teal-800 hover:bg-teal-50 rounded-lg transition"
                    >
                      Hoje
                    </button>
                    <button
                      onClick={() => {
                        const d = new Date(selectedDate);
                        d.setDate(d.getDate() + 1);
                        setSelectedDate(d);
                      }}
                      className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition"
                      title="Próximo dia"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                  <input
                    type="date"
                    value={selectedDate.toISOString().slice(0, 10)}
                    onChange={(e) => {
                      if (e.target.value) {
                        const [y, m, d] = e.target.value.split('-').map(Number);
                        setSelectedDate(new Date(y, m - 1, d));
                      }
                    }}
                    className="medical-input px-3 py-1 rounded-xl text-xs font-medium"
                  />
                  <span className="text-xs font-bold text-slate-800 capitalize">
                    {selectedDate.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
                  </span>
                </div>
              )}

              {agendaViewMode === 'lista' && (
                <div className="flex flex-wrap items-center gap-3">
                  <div>
                    <input
                      type="date"
                      value={filterDate}
                      onChange={(e) => setFilterDate(e.target.value)}
                      className="medical-input px-3 py-1.5 rounded-lg text-xs font-medium"
                    />
                  </div>
                  <div>
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="medical-input px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-slate-200"
                    >
                      <option value="ALL">Todos os Status</option>
                      <option value="AGENDADO">Agendado</option>
                      <option value="CONFIRMADO">Confirmado</option>
                      <option value="REMARCADO">Remarcado</option>
                      <option value="CANCELADO">Cancelado</option>
                    </select>
                  </div>
                  {(filterDate || filterStatus !== 'ALL') && (
                    <button
                      onClick={() => {
                        setFilterDate('');
                        setFilterStatus('ALL');
                      }}
                      className="text-xs text-teal-700 hover:underline font-semibold"
                    >
                      Limpar Filtros
                    </button>
                  )}
                </div>
              )}

              <button
                onClick={fetchData}
                className="flex items-center px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition"
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1.5 text-slate-500" />
                Atualizar
              </button>
            </div>

            {/* VIZUALIZAÇÃO 1: VISÃO SEMANAL (7 DIAS) */}
            {agendaViewMode === 'semana' && (
              <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
                {weekDays.map((dayDate, idx) => {
                  const isToday = dayDate.toDateString() === new Date().toDateString();
                  const dayAppts = appointments.filter((a) => {
                    const apptDate = new Date(a.startTime);
                    return (
                      apptDate.getFullYear() === dayDate.getFullYear() &&
                      apptDate.getMonth() === dayDate.getMonth() &&
                      apptDate.getDate() === dayDate.getDate()
                    );
                  }).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

                  return (
                    <div
                      key={idx}
                      className={`medical-card rounded-2xl flex flex-col border transition ${
                        isToday ? 'border-teal-500 ring-2 ring-teal-500/20 bg-teal-50/10' : 'border-slate-200'
                      }`}
                    >
                      {/* HEADER DO DIA */}
                      <div className={`p-3 border-b text-center rounded-t-2xl ${isToday ? 'bg-teal-700 text-white' : 'bg-slate-100/90 text-slate-800'}`}>
                        <p className="text-[11px] font-bold uppercase tracking-wider">{WEEKDAY_NAMES[idx]}</p>
                        <p className={`text-base font-extrabold ${isToday ? 'text-white' : 'text-slate-900'}`}>
                          {dayDate.getDate()} {dayDate.toLocaleDateString('pt-BR', { month: 'short' })}
                        </p>
                        {isToday && (
                          <span className="inline-block mt-0.5 px-2 py-0.2 text-[9px] font-extrabold bg-white text-teal-800 rounded-full">
                            Hoje
                          </span>
                        )}
                      </div>

                      {/* LISTA DE CONSULTAS DO DIA */}
                      <div className="p-2 flex-1 space-y-2 min-h-[360px] overflow-y-auto">
                        {dayAppts.length === 0 ? (
                          <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-400">
                            <p className="text-xs font-medium">Sem consultas</p>
                            <button
                              onClick={() => openNewApptModalWithSlot(dayDate)}
                              className="mt-2 text-[10px] text-teal-700 hover:text-teal-900 font-bold underline flex items-center"
                            >
                              <Plus className="h-3 w-3 mr-0.5" /> Agendar
                            </button>
                          </div>
                        ) : (
                          dayAppts.map((appt) => {
                            const timeStr = new Date(appt.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                            return (
                              <div
                                key={appt.id}
                                className={`p-2.5 rounded-xl border text-xs space-y-1 shadow-xs transition hover:scale-[1.02] ${getStatusBadgeStyle(appt.status)}`}
                              >
                                <div className="flex items-center justify-between font-bold">
                                  <span className="text-[11px] font-mono flex items-center">
                                    <Clock className="h-3 w-3 mr-1 text-slate-500" />
                                    {timeStr}
                                  </span>
                                  <span className="text-[9px] uppercase px-1.5 py-0.5 rounded font-extrabold bg-white/90 border border-slate-200">
                                    {getStatusLabel(appt.status)}
                                  </span>
                                </div>
                                <div className="font-bold text-slate-900 truncate" title={appt.patient?.name}>
                                  {appt.patient?.name}
                                </div>
                                <div className="text-[10px] text-slate-600 font-mono">
                                  {formatPhoneBR(appt.patient?.phone)}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* BOTÃO ADICIONAR RÁPIDO */}
                      <div className="p-2 border-t border-slate-100 text-center">
                        <button
                          onClick={() => openNewApptModalWithSlot(dayDate)}
                          className="w-full py-1.5 px-2 rounded-xl bg-slate-100 hover:bg-teal-50 text-slate-700 hover:text-teal-800 text-[11px] font-bold transition flex items-center justify-center"
                        >
                          <Plus className="h-3.5 w-3.5 mr-1 text-teal-600" /> Novo Slot
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* VIZUALIZAÇÃO 2: VISÃO DIÁRIA (GRADE POR HORÁRIO HORA A HORA) */}
            {agendaViewMode === 'dia' && (
              <div className="medical-card rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
                <div className="bg-slate-100/90 px-6 py-3 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <CalendarDays className="h-5 w-5 text-teal-600" />
                    <h3 className="font-bold text-slate-900 text-sm">
                      Agenda Diária — {selectedDate.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                    </h3>
                  </div>
                  <span className="text-xs text-slate-500 font-medium">
                    Expediente: 08:00 às 18:00
                  </span>
                </div>

                <div className="divide-y divide-slate-200">
                  {DAILY_HOURS.map((hourStr) => {
                    const slotHour = parseInt(hourStr.split(':')[0]);
                    const hourAppts = appointments.filter((a) => {
                      const apptDate = new Date(a.startTime);
                      return (
                        apptDate.getFullYear() === selectedDate.getFullYear() &&
                        apptDate.getMonth() === selectedDate.getMonth() &&
                        apptDate.getDate() === selectedDate.getDate() &&
                        apptDate.getHours() === slotHour
                      );
                    });

                    return (
                      <div key={hourStr} className="flex flex-col sm:flex-row items-stretch hover:bg-slate-50/60 transition min-h-[72px]">
                        {/* COLUNA DO HORÁRIO */}
                        <div className="w-full sm:w-28 bg-slate-50 p-4 border-r border-slate-200 flex items-center justify-center font-mono text-xs font-bold text-slate-700">
                          <Clock className="h-3.5 w-3.5 mr-1.5 text-teal-600" />
                          {hourStr}
                        </div>

                        {/* CONTEÚDO DO SLOT */}
                        <div className="flex-1 p-3 flex items-center">
                          {hourAppts.length === 0 ? (
                            <div className="w-full flex items-center justify-between">
                              <span className="text-xs text-slate-400 italic">Horário Livre</span>
                              <button
                                onClick={() => openNewApptModalWithSlot(selectedDate, hourStr)}
                                className="px-3 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-bold transition flex items-center border border-teal-200/80"
                              >
                                <Plus className="h-3.5 w-3.5 mr-1 text-teal-600" /> Agendar às {hourStr}
                              </button>
                            </div>
                          ) : (
                            <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-3">
                              {hourAppts.map((appt) => (
                                <div
                                  key={appt.id}
                                  className={`p-3 rounded-xl border flex items-center justify-between text-xs shadow-2xs ${getStatusBadgeStyle(appt.status)}`}
                                >
                                  <div>
                                    <div className="font-bold text-slate-900 text-sm">{appt.patient?.name}</div>
                                    <div className="text-[11px] text-slate-600 font-mono mt-0.5">
                                      {formatPhoneBR(appt.patient?.phone)}
                                    </div>
                                    {appt.notes && (
                                      <p className="text-[10px] text-slate-500 mt-1 italic">
                                        Obs: {appt.notes}
                                      </p>
                                    )}
                                  </div>

                                  <div className="text-right space-y-1">
                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border inline-block bg-white/90 border-slate-200">
                                      {getStatusLabel(appt.status)}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* VIZUALIZAÇÃO 3: VISÃO EM LISTA (TABELA TRADICIONAL) */}
            {agendaViewMode === 'lista' && (
              <div className="medical-card rounded-2xl overflow-hidden border border-slate-200 shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100/80 text-slate-600 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-4 uppercase tracking-wider text-[11px]">Horário / Data</th>
                        <th className="p-4 uppercase tracking-wider text-[11px]">Paciente</th>
                        <th className="p-4 uppercase tracking-wider text-[11px]">Telefone</th>
                        <th className="p-4 uppercase tracking-wider text-[11px]">Status</th>
                        <th className="p-4 uppercase tracking-wider text-[11px]">Observações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {loading ? (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-slate-400 font-medium">
                            Carregando agendamentos...
                          </td>
                        </tr>
                      ) : appointments.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-slate-500 font-medium">
                            Nenhum agendamento encontrado para os filtros selecionados.
                          </td>
                        </tr>
                      ) : (
                        appointments.map((appt) => {
                          const start = new Date(appt.startTime);
                          const dateFormatted = start.toLocaleDateString('pt-BR', {
                            weekday: 'short',
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          });
                          const timeFormatted = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                          return (
                            <tr key={appt.id} className="hover:bg-slate-50/80 transition">
                              <td className="p-4 font-semibold text-slate-900">
                                <div className="text-slate-900 font-bold text-sm">{timeFormatted}</div>
                                <div className="text-[11px] text-slate-500 font-medium">{dateFormatted}</div>
                              </td>
                              <td className="p-4">
                                <div className="font-bold text-slate-800">{appt.patient?.name}</div>
                                <div className="text-[10px] text-slate-400 font-mono">ID: {appt.patient?.id.slice(0, 8)}</div>
                              </td>
                              <td className="p-4 text-slate-700 font-mono font-medium">{formatPhoneBR(appt.patient?.phone)}</td>
                              <td className="p-4">
                                <span
                                  className={`px-3 py-1 rounded-full text-[11px] font-bold border inline-flex items-center ${getStatusBadgeStyle(appt.status)}`}
                                >
                                  {(appt.status === 'CONFIRMADO' || appt.status === 'CONFIRMED') && <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-emerald-600" />}
                                  {(appt.status === 'AGENDADO' || appt.status === 'SCHEDULED') && <Clock className="h-3.5 w-3.5 mr-1 text-sky-600" />}
                                  {(appt.status === 'REMARCADO' || appt.status === 'RESCHEDULED') && <RefreshCw className="h-3.5 w-3.5 mr-1 text-amber-600" />}
                                  {(appt.status === 'CANCELADO' || appt.status === 'CANCELED') && <CalendarX className="h-3.5 w-3.5 mr-1 text-rose-600" />}
                                  {getStatusLabel(appt.status)}
                                </span>
                              </td>
                              <td className="p-4 text-slate-600 text-[11px] font-medium leading-relaxed">
                                {appt.notes || 'Sem observações'}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ABA 2: CADASTRO DE PACIENTES */}
        {activeTab === 'patients' && (
          <div className="space-y-6">
            {/* TOPO: BARRA DE PESQUISA E BOTÃO ADICIONAR PACIENTE */}
            <div className="medical-card p-5 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
              <div className="flex items-center space-x-3 w-full sm:w-auto">
                <div className="relative w-full sm:w-80">
                  <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar por nome, telefone, CPF ou e-mail..."
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    className="medical-input w-full pl-9 pr-3.5 py-2 rounded-xl text-xs font-medium"
                  />
                </div>
                {patientSearch && (
                  <button
                    onClick={() => setPatientSearch('')}
                    className="text-xs text-teal-700 hover:underline font-semibold whitespace-nowrap"
                  >
                    Limpar Busca
                  </button>
                )}
              </div>

              <button
                onClick={() => handleOpenPatientModal()}
                className="flex items-center px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs transition shadow-md shadow-teal-700/15 w-full sm:w-auto justify-center"
              >
                <UserPlus className="h-4 w-4 mr-1.5 stroke-[2.5]" />
                Cadastrar Paciente
              </button>
            </div>

            {/* TABELA DE PACIENTES */}
            <div className="medical-card rounded-2xl overflow-hidden border border-slate-200 shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/80 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-4 uppercase tracking-wider text-[11px]">Paciente / CPF</th>
                      <th className="p-4 uppercase tracking-wider text-[11px]">Contato (Telefone & E-mail)</th>
                      <th className="p-4 uppercase tracking-wider text-[11px]">Nascimento / Idade</th>
                      <th className="p-4 uppercase tracking-wider text-[11px]">Consultas</th>
                      <th className="p-4 uppercase tracking-wider text-[11px]">Observações / Alergias</th>
                      <th className="p-4 uppercase tracking-wider text-[11px] text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loadingPatients ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-400 font-medium">
                          Carregando pacientes...
                        </td>
                      </tr>
                    ) : filteredPatients.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-500 font-medium">
                          Nenhum paciente encontrado.
                        </td>
                      </tr>
                    ) : (
                      filteredPatients.map((p) => {
                        const apptCount = p._count?.appointments ?? 0;
                        const ageStr = calculateAge(p.birthDate);

                        return (
                          <tr key={p.id} className="hover:bg-slate-50/80 transition">
                            <td className="p-4">
                              <div className="flex items-center space-x-3">
                                <div className="h-9 w-9 rounded-full bg-teal-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                                  {p.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div className="font-bold text-slate-900 text-xs">{p.name}</div>
                                  <div className="text-[10px] text-slate-500 font-mono">
                                    CPF: {p.cpf ? applyCPFMask(p.cpf) : 'Não informado'}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="space-y-0.5">
                                <div className="flex items-center space-x-1.5 font-mono text-slate-800 font-bold">
                                  <Phone className="h-3.5 w-3.5 text-teal-600" />
                                  <span>{formatPhoneBR(p.phone)}</span>
                                </div>
                                {p.email && (
                                  <div className="flex items-center space-x-1.5 text-slate-500 font-medium">
                                    <Mail className="h-3 w-3 text-slate-400" />
                                    <span>{p.email}</span>
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="p-4 font-medium text-slate-700">
                              {p.birthDate ? (
                                <div>
                                  <div className="font-semibold text-slate-900">
                                    {new Date(p.birthDate).toLocaleDateString('pt-BR')}
                                  </div>
                                  <div className="text-[10px] text-teal-700 font-bold">{ageStr}</div>
                                </div>
                              ) : (
                                <span className="text-slate-400 italic">Não informada</span>
                              )}
                            </td>
                            <td className="p-4">
                              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-teal-50 text-teal-800 border border-teal-200 inline-flex items-center">
                                <CalendarIcon className="h-3 w-3 mr-1 text-teal-600" />
                                {apptCount} consulta{apptCount !== 1 ? 's' : ''}
                              </span>
                            </td>
                            <td className="p-4 text-slate-600 text-[11px] font-medium max-w-xs truncate" title={p.notes}>
                              {p.notes || <span className="text-slate-400 italic">Sem anotações</span>}
                            </td>
                            <td className="p-4 text-right space-x-1.5">
                              <button
                                onClick={() => handleQuickApptForPatient(p)}
                                className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 transition"
                                title="Agendar Consulta Rápida"
                              >
                                <CalendarPlus className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleOpenPatientModal(p)}
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-teal-50 text-slate-600 hover:text-teal-800 transition"
                                title="Editar Paciente"
                              >
                                <Edit3 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeletePatient(p.id)}
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 transition"
                                title="Excluir Paciente"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ABA 3: CADASTRO DE USUÁRIOS */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            {/* TOPO: BARRA DE PESQUISA, FILTROS E BOTÃO ADICIONAR */}
            <div className="medical-card p-5 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
              <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                <div className="relative w-full sm:w-72">
                  <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar por nome, e-mail ou especialidade..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="medical-input w-full pl-9 pr-3.5 py-2 rounded-xl text-xs font-medium"
                  />
                </div>

                <select
                  value={userRoleFilter}
                  onChange={(e) => setUserRoleFilter(e.target.value)}
                  className="medical-input px-3.5 py-2 rounded-xl text-xs font-medium bg-white border border-slate-200"
                >
                  <option value="ALL">Todos os Cargos</option>
                  <option value="MEDICO">Médicos</option>
                  <option value="RECEPCIONISTA">Recepcionistas</option>
                  <option value="ADMIN">Administradores</option>
                </select>
              </div>

              <button
                onClick={() => handleOpenUserModal()}
                className="flex items-center px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs transition shadow-md shadow-teal-700/15 w-full sm:w-auto justify-center"
              >
                <UserPlus className="h-4 w-4 mr-1.5 stroke-[2.5]" />
                Cadastrar Usuário
              </button>
            </div>

            {/* TABELA DE USUÁRIOS */}
            <div className="medical-card rounded-2xl overflow-hidden border border-slate-200 shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/80 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-4 uppercase tracking-wider text-[11px]">Usuário / Nome</th>
                      <th className="p-4 uppercase tracking-wider text-[11px]">E-mail</th>
                      <th className="p-4 uppercase tracking-wider text-[11px]">Telefone</th>
                      <th className="p-4 uppercase tracking-wider text-[11px]">Cargo / Especialidade</th>
                      <th className="p-4 uppercase tracking-wider text-[11px]">Status</th>
                      <th className="p-4 uppercase tracking-wider text-[11px] text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loadingUsers ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-400 font-medium">
                          Carregando usuários...
                        </td>
                      </tr>
                    ) : filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-500 font-medium">
                          Nenhum usuário cadastrado.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((u) => (
                        <tr key={u.id} className="hover:bg-slate-50/80 transition">
                          <td className="p-4">
                            <div className="flex items-center space-x-3">
                              <div className="h-9 w-9 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-xs">
                                {u.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="font-bold text-slate-900 text-xs">{u.name}</div>
                                <div className="text-[10px] text-slate-400 font-mono">ID: {u.id.slice(0, 8)}</div>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 font-medium text-slate-700">
                            <div className="flex items-center space-x-1.5">
                              <Mail className="h-3.5 w-3.5 text-slate-400" />
                              <span>{u.email}</span>
                            </div>
                          </td>
                          <td className="p-4 font-mono font-medium text-slate-700">
                            {formatPhoneBR(u.phone) || '—'}
                          </td>
                          <td className="p-4">
                            <div className="space-y-0.5">
                              <span
                                className={`px-2.5 py-0.5 rounded-md text-[10px] font-extrabold border inline-block ${
                                  u.role === 'MEDICO'
                                    ? 'bg-teal-50 text-teal-800 border-teal-200'
                                    : u.role === 'ADMIN'
                                    ? 'bg-purple-50 text-purple-800 border-purple-200'
                                    : 'bg-sky-50 text-sky-800 border-sky-200'
                                }`}
                              >
                                {u.role === 'MEDICO' && 'MÉDICO(A)'}
                                {u.role === 'ADMIN' && 'ADMINISTRADOR'}
                                {u.role === 'RECEPCIONISTA' && 'RECEPCIONISTA'}
                              </span>
                              {u.specialty && (
                                <p className="text-[11px] text-slate-500 font-medium">{u.specialty}</p>
                              )}
                            </div>
                          </td>
                          <td className="p-4">
                            <button
                              onClick={() => handleToggleUserStatus(u)}
                              className={`px-3 py-1 rounded-full text-[10px] font-bold border inline-flex items-center cursor-pointer transition ${
                                u.status === 'ACTIVE'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                                  : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                              }`}
                            >
                              <span
                                className={`h-2 w-2 rounded-full mr-1.5 ${
                                  u.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-slate-400'
                                }`}
                              ></span>
                              {u.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
                            </button>
                          </td>
                          <td className="p-4 text-right space-x-2">
                            <button
                              onClick={() => handleOpenUserModal(u)}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-teal-50 text-slate-600 hover:text-teal-800 transition"
                              title="Editar Usuário"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteUser(u.id)}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 transition"
                              title="Excluir Usuário"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ABA 4: CONFIGURAÇÃO DE EXPEDIENTE & PARÂMETROS DA CLÍNICA */}
        {activeTab === 'settings' && clinic && (
          <div className="max-w-4xl mx-auto medical-card rounded-2xl p-6 border border-slate-200 space-y-6 shadow-sm">
            <div className="border-b border-slate-200 pb-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center">
                <Settings className="h-5 w-5 mr-2 text-teal-600" />
                Configurações do Expediente & Regras Médicas
              </h2>
              <p className="text-xs text-slate-500 mt-1 font-medium">
                Defina os horários de atendimento da clínica para o cruzamento automático sem alucinação de horários.
              </p>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-6 text-xs">
              {/* DADOS BÁSICOS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Nome da Clínica / Profissional</label>
                  <input
                    type="text"
                    value={clinic.name || ''}
                    onChange={(e) => setClinic({ ...clinic, name: e.target.value })}
                    className="medical-input w-full px-3.5 py-2 rounded-xl text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Especialidade Médica</label>
                  <input
                    type="text"
                    value={clinic.specialty || ''}
                    onChange={(e) => setClinic({ ...clinic, specialty: e.target.value })}
                    className="medical-input w-full px-3.5 py-2 rounded-lg text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Duração da Consulta (minutos)</label>
                  <select
                    value={clinic.slotDurationMinutes || 30}
                    onChange={(e) => setClinic({ ...clinic, slotDurationMinutes: parseInt(e.target.value) })}
                    className="medical-input w-full px-3.5 py-2 rounded-xl text-xs font-medium bg-white"
                  >
                    <option value={15}>15 minutos</option>
                    <option value={30}>30 minutos (Padrão)</option>
                    <option value={45}>45 minutos</option>
                    <option value={60}>60 minutos (1 hora)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Antecedência Mínima de Cancelamento (Horas)</label>
                  <input
                    type="number"
                    value={clinic.minCancelHours || 2}
                    onChange={(e) => setClinic({ ...clinic, minCancelHours: parseInt(e.target.value) })}
                    className="medical-input w-full px-3.5 py-2 rounded-xl text-xs font-medium"
                  />
                </div>
              </div>

              {/* INSTRUÇÕES DO SYSTEM PROMPT */}
              <div className="bg-teal-50/70 p-4.5 rounded-2xl border border-teal-200/80 space-y-2.5">
                <h4 className="font-bold text-teal-900 text-xs flex items-center">
                  <ShieldCheck className="h-4 w-4 mr-1.5 text-teal-700" />
                  Diretrizes da Plataforma CliniDesk
                </h4>
                <ul className="list-disc list-inside text-teal-800 space-y-1 text-[11px] font-medium leading-relaxed">
                  <li>O sistema consulta a grade médica oficial antes de permitir novos slots.</li>
                  <li>Cancelamentos com menos de <strong>{clinic.minCancelHours || 2} horas</strong> de antecedência requerem autorização da recepção.</li>
                  <li>Parâmetros de atendimento atualizados aplicam-se imediatamente ao controle de agendamentos.</li>
                </ul>
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-200">
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-xl text-xs transition shadow-md shadow-teal-700/15"
                >
                  Salvar Configurações
                </button>
              </div>
            </form>
          </div>
        )}
      </main>

      {/* MODAL CRIAR AGENDAMENTO MANUAL */}
      {showModalNewAppt && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="medical-card w-full max-w-md rounded-2xl p-6 border border-slate-200 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center">
                <Plus className="h-4 w-4 mr-1 text-emerald-600" />
                Criar Novo Agendamento
              </h3>
              <button onClick={() => setShowModalNewAppt(false)} className="text-slate-400 hover:text-slate-700 font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateAppointment} className="space-y-3.5 text-xs">
              {/* SELETOR DE PACIENTE CADASTRADO */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">Paciente Cadastrado *</label>
                <select
                  required
                  value={selectedPatientId}
                  onChange={(e) => {
                    const pId = e.target.value;
                    setSelectedPatientId(pId);
                    const p = patients.find((item) => item.id === pId);
                    if (p) {
                      setNewApptName(p.name);
                      setNewApptPhone(formatPhoneBR(p.phone) || p.phone);
                    } else {
                      setNewApptName('');
                      setNewApptPhone('');
                    }
                  }}
                  className="medical-input w-full px-3.5 py-2 rounded-xl text-xs font-medium bg-white border border-slate-200"
                >
                  <option value="">-- Selecione um Paciente Cadastrado --</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.cpf ? `(CPF: ${applyCPFMask(p.cpf)})` : ''} — {formatPhoneBR(p.phone)}
                    </option>
                  ))}
                </select>
              </div>

              {!selectedPatientId ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-900 text-xs space-y-2">
                  <div className="flex items-center font-bold">
                    <AlertTriangle className="h-4 w-4 mr-1.5 text-amber-600 shrink-0" />
                    <span>Paciente Não Cadastrado</span>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
                    O fluxo do sistema exige que o paciente esteja previamente cadastrado antes de realizar o agendamento de uma consulta.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setShowModalNewAppt(false);
                      handleOpenPatientModal();
                    }}
                    className="w-full py-1.5 px-3 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs transition flex items-center justify-center shadow-xs"
                  >
                    <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                    Cadastrar Paciente Primeiro
                  </button>
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl space-y-1">
                  <div className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Dados do Paciente Selecionado:</div>
                  <div className="font-bold text-slate-900">{newApptName}</div>
                  <div className="font-mono text-slate-600 text-[11px]">{newApptPhone}</div>
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-bold mb-1">Data e Horário de Início *</label>
                <input
                  type="datetime-local"
                  required
                  value={newApptTime}
                  onChange={(e) => setNewApptTime(e.target.value)}
                  className="medical-input w-full px-3.5 py-2 rounded-xl text-xs font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Observações (Opcional)</label>
                <textarea
                  rows={2}
                  placeholder="Motivo da consulta..."
                  value={newApptNotes}
                  onChange={(e) => setNewApptNotes(e.target.value)}
                  className="medical-input w-full px-3.5 py-2 rounded-xl text-xs font-medium"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowModalNewAppt(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!selectedPatientId}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md shadow-emerald-600/15 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Salvar Agendamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CADASTRO / EDIÇÃO DE PACIENTE */}
      {showModalPatient && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="medical-card w-full max-w-lg rounded-2xl p-6 border border-slate-200 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center">
                <Contact className="h-4 w-4 mr-1.5 text-teal-600" />
                {editingPatient ? 'Editar Ficha do Paciente' : 'Novo Cadastro de Paciente'}
              </h3>
              <button onClick={() => setShowModalPatient(false)} className="text-slate-400 hover:text-slate-700 font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePatient} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Nome Completo do Paciente *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Carlos Eduardo Oliveira"
                  value={patName}
                  onChange={(e) => setPatName(e.target.value)}
                  className="medical-input w-full px-3.5 py-2 rounded-xl text-xs font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Telefone (com DDD) *</label>
                  <input
                    type="text"
                    required
                    placeholder="(11) 99999-1111"
                    value={patPhone}
                    onChange={(e) => setPatPhone(applyPhoneMask(e.target.value))}
                    className="medical-input w-full px-3.5 py-2 rounded-xl text-xs font-mono font-medium"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">CPF</label>
                  <input
                    type="text"
                    placeholder="000.000.000-00"
                    value={patCpf}
                    onChange={(e) => setPatCpf(applyCPFMask(e.target.value))}
                    className="medical-input w-full px-3.5 py-2 rounded-xl text-xs font-mono font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">E-mail</label>
                  <input
                    type="email"
                    placeholder="paciente@email.com"
                    value={patEmail}
                    onChange={(e) => setPatEmail(e.target.value)}
                    className="medical-input w-full px-3.5 py-2 rounded-xl text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Data de Nascimento</label>
                  <input
                    type="date"
                    value={patBirthDate}
                    onChange={(e) => setPatBirthDate(e.target.value)}
                    className="medical-input w-full px-3.5 py-2 rounded-xl text-xs font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Observações Clínicas / Histórico / Alergias</label>
                <textarea
                  rows={3}
                  placeholder="Anotações relevantes para o atendimento..."
                  value={patNotes}
                  onChange={(e) => setPatNotes(e.target.value)}
                  className="medical-input w-full px-3.5 py-2 rounded-xl text-xs font-medium"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowModalPatient(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl font-bold text-xs shadow-md shadow-teal-700/15"
                >
                  {editingPatient ? 'Salvar Alterações' : 'Cadastrar Paciente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CADASTRO / EDIÇÃO DE USUÁRIO */}
      {showModalUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="medical-card w-full max-w-md rounded-2xl p-6 border border-slate-200 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center">
                <UserCog className="h-4 w-4 mr-1.5 text-teal-600" />
                {editingUser ? 'Editar Usuário' : 'Novo Cadastro de Usuário'}
              </h3>
              <button onClick={() => setShowModalUser(false)} className="text-slate-400 hover:text-slate-700 font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Nome Completo</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Dra. Juliana Lima"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="medical-input w-full px-3.5 py-2 rounded-xl text-xs font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">E-mail Profissional</label>
                <input
                  type="email"
                  required
                  placeholder="exemplo@clinidesk.com.br"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  className="medical-input w-full px-3.5 py-2 rounded-xl text-xs font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Telefone / Celular</label>
                  <input
                    type="text"
                    placeholder="(11) 99999-8888"
                    value={userPhone}
                    onChange={(e) => setUserPhone(applyPhoneMask(e.target.value))}
                    className="medical-input w-full px-3.5 py-2 rounded-xl text-xs font-mono font-medium"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Cargo / Função</label>
                  <select
                    value={userRole}
                    onChange={(e: any) => setUserRole(e.target.value)}
                    className="medical-input w-full px-3.5 py-2 rounded-xl text-xs font-medium bg-white border border-slate-200"
                  >
                    <option value="MEDICO">Médico(a)</option>
                    <option value="RECEPCIONISTA">Recepcionista</option>
                    <option value="ADMIN">Administrador</option>
                  </select>
                </div>
              </div>

              {userRole === 'MEDICO' && (
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Especialidade / CRM</label>
                  <input
                    type="text"
                    placeholder="Ex: Pediatria • CRM-SP 123456"
                    value={userSpecialty}
                    onChange={(e) => setUserSpecialty(e.target.value)}
                    className="medical-input w-full px-3.5 py-2 rounded-xl text-xs font-medium"
                  />
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-bold mb-1">Status da Conta</label>
                <select
                  value={userStatus}
                  onChange={(e: any) => setUserStatus(e.target.value)}
                  className="medical-input w-full px-3.5 py-2 rounded-xl text-xs font-medium bg-white border border-slate-200"
                >
                  <option value="ACTIVE">Ativo</option>
                  <option value="INACTIVE">Inativo</option>
                </select>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowModalUser(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl font-bold text-xs shadow-md shadow-teal-700/15"
                >
                  {editingUser ? 'Salvar Alterações' : 'Cadastrar Usuário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
