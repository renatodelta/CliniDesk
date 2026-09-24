'use client';

import { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  UserCheck,
  CalendarCheck2,
  CalendarX,
  RefreshCw,
  MessageSquare,
  Settings,
  Send,
  Sparkles,
  Search,
  Phone,
  User,
  CheckCircle2,
  AlertTriangle,
  Bot,
  Zap,
  Activity,
  Plus,
  ShieldCheck,
  Stethoscope,
  HeartPulse,
  Sliders,
  Check,
  ArrowRight,
} from 'lucide-react';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<'agenda' | 'simulator' | 'settings'>('agenda');
  const [loading, setLoading] = useState(true);
  const [clinic, setClinic] = useState<any>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [filterDate, setFilterDate] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Estados do Simulador de WhatsApp
  const [simPhone, setSimPhone] = useState<string>('+5511999991111');
  const [simMessage, setSimMessage] = useState<string>('');
  const [chatLog, setChatLog] = useState<Array<{ sender: 'user' | 'assistant'; text: string; time: string }>>([
    {
      sender: 'assistant',
      text: 'Olá! Sou a assistente virtual de agendamentos. Como posso ajudar com a sua consulta médica hoje?',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [lastToolsExecuted, setLastToolsExecuted] = useState<any[]>([]);
  const [simulating, setSimulating] = useState(false);
  const [cronRunning, setCronRunning] = useState(false);
  const [cronNotice, setCronNotice] = useState<string | null>(null);

  // Estados do Formulário de Novo Agendamento
  const [showModalNewAppt, setShowModalNewAppt] = useState(false);
  const [newApptPhone, setNewApptPhone] = useState('+5511999994444');
  const [newApptName, setNewApptName] = useState('');
  const [newApptTime, setNewApptTime] = useState('');
  const [newApptNotes, setNewApptNotes] = useState('');

  // Carregar dados iniciais
  useEffect(() => {
    fetchData();
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

  // Simular mensagem no Chat IA
  async function handleSendSimulatedMessage(customText?: string) {
    const textToSend = customText || simMessage;
    if (!textToSend.trim() || simulating) return;

    const userTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setChatLog((prev) => [...prev, { sender: 'user', text: textToSend, time: userTime }]);
    if (!customText) setSimMessage('');
    setSimulating(true);

    try {
      const res = await fetch('/api/chat/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientPhone: simPhone,
          messageText: textToSend,
        }),
      });

      const data = await res.json();
      const botTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      if (data.reply) {
        setChatLog((prev) => [...prev, { sender: 'assistant', text: data.reply, time: botTime }]);
      }
      if (data.toolsExecuted) {
        setLastToolsExecuted(data.toolsExecuted);
      }

      // Recarregar agendamentos em background
      fetchData();
    } catch (err: any) {
      console.error('Erro ao enviar mensagem simulada:', err);
    } finally {
      setSimulating(false);
    }
  }

  // Executar Cron de Lembretes 24h
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
    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientName: newApptName || 'Novo Paciente',
          patientPhone: newApptPhone,
          startTime: newApptTime,
          notes: newApptNotes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowModalNewAppt(false);
        setNewApptName('');
        setNewApptTime('');
        setNewApptNotes('');
        fetchData();
      } else {
        alert(data.error || 'Erro ao criar agendamento.');
      }
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    }
  }

  // Salvar Configurações de Expediente
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

  // Contadores KPIs
  const totalAppts = appointments.length;
  const confirmedCount = appointments.filter((a) => a.status === 'CONFIRMED').length;
  const rescheduledCount = appointments.filter((a) => a.status === 'RESCHEDULED').length;
  const canceledCount = appointments.filter((a) => a.status === 'CANCELED').length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col">
      {/* HEADER SUPERIOR CLEAN & SAÚDE */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-md px-6 py-4 flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center space-x-3.5">
          <div className="h-11 w-11 rounded-2xl bg-gradient-to-tr from-teal-600 to-emerald-500 flex items-center justify-center shadow-md shadow-teal-600/20 text-white">
            <Stethoscope className="h-6 w-6 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900">CliniDesk AI</h1>
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
            WhatsApp Ativo
          </div>
          <div className="flex items-center px-3.5 py-1.5 rounded-full bg-sky-50 border border-sky-200/80 text-sky-700 font-semibold shadow-xs">
            <Zap className="h-3.5 w-3.5 mr-1.5 text-sky-600" />
            IA Tool Calling Pronta
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
            onClick={() => setShowModalNewAppt(true)}
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
        {/* KPI CARDS LIMPOS E SUAVES */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="medical-card medical-card-hover rounded-2xl p-5 flex items-center justify-between border-l-4 border-l-teal-600">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total de Consultas</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{totalAppts}</p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
              <Calendar className="h-5 w-5" />
            </div>
          </div>

          <div className="medical-card medical-card-hover rounded-2xl p-5 flex items-center justify-between border-l-4 border-l-emerald-500">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Confirmadas (WhatsApp)</p>
              <p className="text-2xl font-bold text-emerald-700 mt-1">{confirmedCount}</p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <UserCheck className="h-5 w-5" />
            </div>
          </div>

          <div className="medical-card medical-card-hover rounded-2xl p-5 flex items-center justify-between border-l-4 border-l-amber-500">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Remarcações IA</p>
              <p className="text-2xl font-bold text-amber-700 mt-1">{rescheduledCount}</p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <CalendarCheck2 className="h-5 w-5" />
            </div>
          </div>

          <div className="medical-card medical-card-hover rounded-2xl p-5 flex items-center justify-between border-l-4 border-l-rose-400">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Canceladas</p>
              <p className="text-2xl font-bold text-rose-600 mt-1">{canceledCount}</p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <CalendarX className="h-5 w-5" />
            </div>
          </div>
        </div>

        {/* NAVEGAÇÃO POR ABAS AGRADÁVEIS */}
        <div className="flex bg-slate-200/60 p-1.5 rounded-2xl w-fit space-x-1 border border-slate-200">
          <button
            onClick={() => setActiveTab('agenda')}
            className={`flex items-center px-4 py-2 font-semibold text-xs rounded-xl transition ${
              activeTab === 'agenda'
                ? 'bg-white text-teal-800 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Calendar className="h-4 w-4 mr-2 text-teal-600" />
            Agenda & Consultas
          </button>
          <button
            onClick={() => setActiveTab('simulator')}
            className={`flex items-center px-4 py-2 font-semibold text-xs rounded-xl transition ${
              activeTab === 'simulator'
                ? 'bg-white text-teal-800 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <MessageSquare className="h-4 w-4 mr-2 text-teal-600" />
            Simulador WhatsApp IA
            <span className="ml-2 px-2 py-0.5 text-[10px] bg-teal-100 text-teal-800 rounded-full font-bold">
              Tool Calling Live
            </span>
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
            {/* BARRA DE FILTROS */}
            <div className="medical-card p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Filtrar por Data</label>
                  <input
                    type="date"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="medical-input px-3 py-1.5 rounded-lg text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Status da Consulta</label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="medical-input px-3 py-1.5 rounded-lg text-xs font-medium"
                  >
                    <option value="ALL">Todos os Status</option>
                    <option value="SCHEDULED">SCHEDULED (Agendados)</option>
                    <option value="CONFIRMED">CONFIRMED (Confirmados)</option>
                    <option value="RESCHEDULED">RESCHEDULED (Remarcados)</option>
                    <option value="CANCELED">CANCELED (Cancelados)</option>
                  </select>
                </div>
                {(filterDate || filterStatus !== 'ALL') && (
                  <button
                    onClick={() => {
                      setFilterDate('');
                      setFilterStatus('ALL');
                    }}
                    className="mt-5 text-xs text-teal-700 hover:underline font-semibold"
                  >
                    Limpar Filtros
                  </button>
                )}
              </div>

              <button
                onClick={fetchData}
                className="flex items-center px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition"
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1.5 text-slate-500" />
                Atualizar Lista
              </button>
            </div>

            {/* TABELA DE AGENDAMENTOS */}
            <div className="medical-card rounded-2xl overflow-hidden border border-slate-200 shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/80 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-4 uppercase tracking-wider text-[11px]">Horário / Data</th>
                      <th className="p-4 uppercase tracking-wider text-[11px]">Paciente</th>
                      <th className="p-4 uppercase tracking-wider text-[11px]">Telefone (WhatsApp)</th>
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
                            <td className="p-4 text-slate-700 font-mono font-medium">{appt.patient?.phone}</td>
                            <td className="p-4">
                              <span
                                className={`px-3 py-1 rounded-full text-[11px] font-bold border inline-flex items-center ${
                                  appt.status === 'CONFIRMED'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    : appt.status === 'SCHEDULED'
                                    ? 'bg-sky-50 text-sky-800 border-sky-200'
                                    : appt.status === 'RESCHEDULED'
                                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                                    : 'bg-rose-50 text-rose-800 border-rose-200'
                                }`}
                              >
                                {appt.status === 'CONFIRMED' && <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-emerald-600" />}
                                {appt.status === 'SCHEDULED' && <Clock className="h-3.5 w-3.5 mr-1 text-sky-600" />}
                                {appt.status === 'RESCHEDULED' && <RefreshCw className="h-3.5 w-3.5 mr-1 text-amber-600" />}
                                {appt.status === 'CANCELED' && <CalendarX className="h-3.5 w-3.5 mr-1 text-rose-600" />}
                                {appt.status}
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
          </div>
        )}

        {/* ABA 2: SIMULADOR DE WHATSAPP IA + INSPECTOR DE TOOL CALLING */}
        {activeTab === 'simulator' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* CHAT WHATSAPP TEMA CLARO E AGRADÁVEL (7 COLS) */}
            <div className="lg:col-span-7 medical-card rounded-2xl overflow-hidden flex flex-col h-[650px] border border-slate-200 shadow-md">
              {/* CHAT HEADER WHATSAPP AMIGÁVEL */}
              <div className="bg-teal-700 px-4 py-3 text-white flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm backdrop-blur-xs">
                      <MessageSquare className="h-5 w-5" />
                    </div>
                    <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-400 border-2 border-teal-700"></span>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Simulador WhatsApp - CliniDesk</h3>
                    <p className="text-[11px] text-teal-100 flex items-center font-medium">
                      <span className="font-mono text-white mr-1.5 font-bold">{simPhone}</span> • Atendimento Automático IA
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={simPhone}
                    onChange={(e) => setSimPhone(e.target.value)}
                    className="bg-white/10 text-white placeholder-teal-200 border border-white/20 px-2.5 py-1 rounded-lg text-[11px] font-mono w-32 focus:outline-none"
                    title="Telefone do Paciente em Simulação"
                  />
                  <button
                    onClick={() => {
                      setChatLog([
                        {
                          sender: 'assistant',
                          text: 'Olá! Sou a assistente virtual da clínica. Como posso ajudar com a sua consulta hoje?',
                          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        },
                      ]);
                      setLastToolsExecuted([]);
                    }}
                    className="p-1.5 rounded-lg text-teal-100 hover:text-white hover:bg-white/10 transition"
                    title="Reiniciar conversa"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* CHAT BODY */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#e5ddd5]/30">
                {chatLog.map((msg, index) => (
                  <div
                    key={index}
                    className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-xs shadow-xs ${
                        msg.sender === 'user'
                          ? 'bg-emerald-700 text-white rounded-br-none font-medium'
                          : 'bg-white text-slate-800 border border-slate-200/80 rounded-bl-none font-medium'
                      }`}
                    >
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                      <span className={`block text-[9px] text-right mt-1 font-mono ${msg.sender === 'user' ? 'text-emerald-100' : 'text-slate-400'}`}>
                        {msg.time}
                      </span>
                    </div>
                  </div>
                ))}
                {simulating && (
                  <div className="flex items-center space-x-2 text-xs text-teal-700 bg-teal-50 p-2.5 rounded-xl border border-teal-200 font-semibold w-fit">
                    <Sparkles className="h-4 w-4 animate-spin text-teal-600" />
                    <span>IA consultando agenda e gerando resposta...</span>
                  </div>
                )}
              </div>

              {/* CENÁRIOS DE ATALHO */}
              <div className="bg-slate-50 border-t border-slate-200 p-2.5 flex items-center gap-2 overflow-x-auto text-[11px]">
                <span className="text-slate-500 font-bold text-[10px] whitespace-nowrap uppercase tracking-wider">
                  Testes Rápidos:
                </span>
                <button
                  onClick={() => handleSendSimulatedMessage('Olá, tenho alguma consulta agendada?')}
                  className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 font-semibold whitespace-nowrap transition border border-slate-300 shadow-2xs"
                >
                  🔍 Buscar Minha Consulta
                </button>
                <button
                  onClick={() => handleSendSimulatedMessage('Gostaria de ver horários vagos para quarta-feira')}
                  className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 font-semibold whitespace-nowrap transition border border-slate-300 shadow-2xs"
                >
                  📅 Horários Disponíveis
                </button>
                <button
                  onClick={() => handleSendSimulatedMessage('Pode me remarcar para quarta-feira às 09h? Sim, confirmo!')}
                  className="px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold whitespace-nowrap transition border border-teal-200 shadow-2xs"
                >
                  ✅ Confirmar Remarcação
                </button>
                <button
                  onClick={() => handleSendSimulatedMessage('Quero cancelar minha consulta de amanhã')}
                  className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 font-semibold whitespace-nowrap transition border border-slate-300 shadow-2xs"
                >
                  ❌ Cancelar Consulta
                </button>
                <button
                  onClick={() => handleSendSimulatedMessage('Estou sentindo muita dor forte no peito e falta de ar')}
                  className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold whitespace-nowrap transition border border-rose-200 shadow-2xs"
                >
                  🚨 Transbordo Emergência
                </button>
              </div>

              {/* CHAT INPUT */}
              <div className="bg-white p-3 border-t border-slate-200 flex items-center space-x-2">
                <input
                  type="text"
                  placeholder="Digite como se fosse o paciente no WhatsApp..."
                  value={simMessage}
                  onChange={(e) => setSimMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendSimulatedMessage()}
                  className="flex-1 medical-input px-3.5 py-2 rounded-xl text-xs font-medium"
                />
                <button
                  onClick={() => handleSendSimulatedMessage()}
                  disabled={simulating || !simMessage.trim()}
                  className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl font-bold text-xs transition flex items-center shadow-md shadow-teal-700/15 disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5 mr-1.5" />
                  Enviar
                </button>
              </div>
            </div>

            {/* INSPECTOR DE FUNCTION CALLING / TOOL EXECUTIONS (5 COLS) */}
            <div className="lg:col-span-5 medical-card rounded-2xl p-5 flex flex-col h-[650px] border border-slate-200 space-y-4 overflow-y-auto shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center space-x-2">
                  <Zap className="h-5 w-5 text-teal-600" />
                  <h3 className="text-sm font-bold text-slate-900">Inspector de Tool Calling</h3>
                </div>
                <span className="text-[10px] bg-teal-50 text-teal-800 border border-teal-200 px-2.5 py-0.5 rounded-full font-bold font-mono">
                  Structured Outputs
                </span>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed font-medium">
                Execução autônoma em tempo real das funções determinísticas acionadas pelo modelo de IA:
              </p>

              {lastToolsExecuted.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center text-slate-400 space-y-2">
                  <Bot className="h-8 w-8 text-teal-600/50" />
                  <p className="text-xs font-semibold text-slate-600">Nenhuma ferramenta acionada na última interação.</p>
                  <p className="text-[11px] text-slate-400">
                    Envie uma mensagem como <span className="text-teal-700 font-mono font-bold">"quais horários vagos?"</span> no simulador.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {lastToolsExecuted.map((tool, idx) => (
                    <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-teal-800 font-mono flex items-center">
                          <CheckCircle2 className="h-4 w-4 mr-1.5 text-emerald-600" />
                          {tool.name}()
                        </span>
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                          Sucesso
                        </span>
                      </div>

                      {/* ARGUMENTOS */}
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                          Entrada (Parâmetros):
                        </span>
                        <pre className="bg-slate-900 p-2.5 rounded-lg text-[11px] font-mono text-teal-300 overflow-x-auto">
                          {JSON.stringify(tool.args, null, 2)}
                        </pre>
                      </div>

                      {/* RETORNO */}
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                          Retorno Determinístico:
                        </span>
                        <div className="bg-white p-3 rounded-lg border border-slate-200 text-[11px] text-slate-700 space-y-1">
                          <p className="font-semibold text-emerald-800">{tool.result?.message}</p>
                          {tool.result?.data && (
                            <pre className="text-[10px] font-mono text-slate-500 mt-1 pt-1.5 border-t border-slate-100 overflow-x-auto">
                              {JSON.stringify(tool.result.data, null, 2)}
                            </pre>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ABA 3: CONFIGURAÇÃO DE EXPEDIENTE & PARÂMETROS DA CLÍNICA */}
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

              {/* INSTRUÇÕES DO SYSTEM PROMPT E WHATSAPP */}
              <div className="bg-teal-50/70 p-4.5 rounded-2xl border border-teal-200/80 space-y-2.5">
                <h4 className="font-bold text-teal-900 text-xs flex items-center">
                  <ShieldCheck className="h-4 w-4 mr-1.5 text-teal-700" />
                  Diretrizes de Segurança do Agente IA
                </h4>
                <ul className="list-disc list-inside text-teal-800 space-y-1 text-[11px] font-medium leading-relaxed">
                  <li>O agente sempre consultará a grade médica oficial antes de prometer slots para o paciente.</li>
                  <li>Cancelamentos com menos de <strong>{clinic.minCancelHours || 2} horas</strong> de antecedência serão direcionados para a recepção humana.</li>
                  <li>Perguntas sobre diagnósticos médicos ativam o protocolo imediato de transbordo.</li>
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

            <form onSubmit={handleCreateAppointment} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Nome do Paciente</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Carlos Silva"
                  value={newApptName}
                  onChange={(e) => setNewApptName(e.target.value)}
                  className="medical-input w-full px-3.5 py-2 rounded-xl text-xs font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Telefone (WhatsApp com DDD)</label>
                <input
                  type="text"
                  required
                  placeholder="+5511999994444"
                  value={newApptPhone}
                  onChange={(e) => setNewApptPhone(e.target.value)}
                  className="medical-input w-full px-3.5 py-2 rounded-xl text-xs font-mono font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Data e Horário de Início</label>
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

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModalNewAppt(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md shadow-emerald-600/15"
                >
                  Salvar Agendamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
