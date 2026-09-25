import OpenAI from 'openai';
import {
  buscarConsultaAtual,
  buscarHorariosDisponiveis,
  cancelarConsulta,
  confirmarRemarcacao,
} from './tools';

export const SYSTEM_PROMPT = `Você é a assistente virtual inteligente de atendimento e gestão de consultas da plataforma CliniDesk.

DIRETRIZES FUNDAMENTAIS DE ATENDIMENTO E FLUXO:
1. **Saudação Inicial e Menu de Opções:** Quando o paciente mandar uma saudação (ex: "oi", "olá", "bom dia", "boa tarde", "boa noite") ou iniciar o contato, dê boas-vindas acolhedoras e apresente de forma clara as opções de atendimento:
   - 1️⃣ *Consultar agendamento* (Verificar detalhes da sua consulta)
   - 2️⃣ *Remarcar consulta* (Escolher um novo dia ou horário)
   - 3️⃣ *Desmarcar consulta* (Cancelar o seu agendamento)

2. **Fluxo de Remarcação (OPÇÃO 2) - REGRA CRÍTICA DE OURO:**
   - Quando o paciente solicitar remarcação (ex: "2", "remarcar", "sim", "quero remarcar"), **NUNCA invoque a ferramenta \`buscar_horarios_disponiveis\` se o paciente NÃO tiver digitado a nova data na própria mensagem dele!**
   - NUNCA use a data da consulta atual do paciente ou datas passadas no histórico para chamar a busca de horários!
   - Se o paciente não informou a nova data na mensagem atual, RESPONDA IMEDIATAMENTE pedindo para ele informar a data desejada no formato **DD/MM/AA** (ex: *25/09/26* ou *28/09/26*).
   - Apenas invoque \`buscar_horarios_disponiveis\` se a mensagem do paciente contiver uma data explícita (ex: "25/09/26", "28/09/2026", "amanhã", "segunda-feira").

3. **Exibição de Horários e Escolha:**
   - Se houver horários livres na data consultada, apresente a lista de horários (ex: *08:00*, *08:30*, *09:00*, *14:00*) e peça para o paciente escolher o horário de sua preferência.
   - Se a data for um dia sem atendimento (ex: Sábado/Domingo/Folga) ou sem vagas, informe educadamente o motivo e peça para o paciente digitar outra data no formato **DD/MM/AA**.

4. **Confirmação de Remarcação:**
   - Assim que o paciente selecionar um horário válido (ex: "*09:00*"), invoque a ferramenta \`confirmar_remarcacao\` informando o agendamento_id e a nova data e horário.

5. **Cancelamento (OPÇÃO 3):**
   - Se o paciente escolher desmarcar (opção 3), identifique o agendamento e invoque a ferramenta \`cancelar_consulta\`.

6. **Transbordo Humano:** Dores graves, sintomas de emergência médica ou dúvidas clínicas ativam o protocolo imediato de transbordo para a recepção humana.

7. **Formatação para WhatsApp:** Use negritos em *datas* e *horários*, emojis moderados e parágrafos curtos.`;

// Definição das ferramentas no formato OpenAI JSON Schema
const openaiTools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'buscar_consulta_atual',
      description: 'Localiza a consulta futura mais próxima agendada para o paciente pelo seu número de telefone.',
      parameters: {
        type: 'object',
        properties: {
          telefone_paciente: {
            type: 'string',
            description: 'Telefone do paciente com DDD (ex: 11999991111).',
          },
        },
        required: ['telefone_paciente'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'buscar_horarios_disponiveis',
      description: 'Consulta a grade de horários livres do médico para uma NOVA data especificamente digitada pelo paciente. NUNCA chame com a data da consulta atual do paciente ou sem que o paciente tenha enviado a data desejada na mensagem.',
      parameters: {
        type: 'object',
        properties: {
          data_desejada: {
            type: 'string',
            description: 'Nova data desejada pelo paciente no formato DD/MM/AA ou AAAA-MM-DD. NÃO use a data da consulta atual do paciente.',
          },
          periodo: {
            type: 'string',
            enum: ['manha', 'tarde', 'noite', 'qualquer'],
            description: 'Período do dia preferido pelo paciente.',
          },
        },
        required: ['data_desejada'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancelar_consulta',
      description: 'Cancela um agendamento existente respeitando o prazo mínimo de antecedência.',
      parameters: {
        type: 'object',
        properties: {
          agendamento_id: {
            type: 'string',
            description: 'ID do agendamento a ser cancelado.',
          },
          motivo: {
            type: 'string',
            description: 'Motivo informado pelo paciente para o cancelamento.',
          },
        },
        required: ['agendamento_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'confirmar_remarcacao',
      description: 'Efetiva a remarcação de um agendamento criando um novo registro e alterando o antigo.',
      parameters: {
        type: 'object',
        properties: {
          agendamento_id: {
            type: 'string',
            description: 'ID do agendamento atual a ser remarcado.',
          },
          nova_data_hora: {
            type: 'string',
            description: 'Nova data e horário no formato AAAA-MM-DD HH:mm (ex: 2026-09-25 14:30).',
          },
        },
        required: ['agendamento_id', 'nova_data_hora'],
      },
    },
  },
];

/**
 * Executa uma Tool chamada pela IA
 */
async function executeToolCall(toolName: string, toolArgs: any, clinicId?: string) {
  console.log(`🤖 Executando ferramenta IA [${toolName}] com argumentos:`, toolArgs);
  switch (toolName) {
    case 'buscar_consulta_atual':
      return await buscarConsultaAtual(toolArgs.telefone_paciente, clinicId);
    case 'buscar_horarios_disponiveis':
      return await buscarHorariosDisponiveis(toolArgs.data_desejada, toolArgs.periodo, clinicId);
    case 'cancelar_consulta':
      return await cancelarConsulta(toolArgs.agendamento_id, toolArgs.motivo);
    case 'confirmar_remarcacao':
      return await confirmarRemarcacao(toolArgs.agendamento_id, toolArgs.nova_data_hora);
    default:
      return { success: false, message: `Ferramenta desconhecida: ${toolName}` };
  }
}

export interface ProcessMessageOptions {
  patientPhone: string;
  userMessage: string;
  conversationHistory?: Array<{ role: 'user' | 'assistant' | 'system' | 'tool'; content: string }>;
  clinicId?: string;
}

export interface AgentProcessResult {
  reply: string;
  toolsExecuted: Array<{ name: string; args: any; result: any }>;
}

/**
 * Extrai datas no formato DD/MM/AA, DD/MM/AAAA ou termos amigáveis (hoje, amanhã, dia da semana)
 */
function extractDateFromText(text: string): { dateStr: string; formattedStr: string } | null {
  const msgLower = text.toLowerCase().trim();
  const today = new Date();

  // 1. Match DD/MM/YY ou DD/MM/YYYY ou DD/MM
  const dateMatch = msgLower.match(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/);
  if (dateMatch) {
    const day = parseInt(dateMatch[1], 10);
    const month = parseInt(dateMatch[2], 10);
    let year = dateMatch[3] ? parseInt(dateMatch[3], 10) : today.getFullYear();
    if (year < 100) year += 2000;

    const d = new Date(year, month - 1, day);
    if (!isNaN(d.getTime())) {
      const dateISO = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const formatted = d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
      return { dateStr: dateISO, formattedStr: formatted };
    }
  }

  // 2. Match por extenso tipo "25 de setembro de 2026" ou "25 de setembro"
  const extensoMatch = msgLower.match(/\b(\d{1,2})\s+de\s+([a-zçáéíóú]+)(?:\s+de\s+(\d{4}))?\b/i);
  if (extensoMatch) {
    const day = parseInt(extensoMatch[1], 10);
    const monthStr = extensoMatch[2].toLowerCase();
    let year = extensoMatch[3] ? parseInt(extensoMatch[3], 10) : today.getFullYear();
    const monthsMap: Record<string, number> = {
      janeiro: 0, fevereiro: 1, marco: 2, março: 2, abril: 3, maio: 4, junho: 5,
      julho: 6, agosto: 7, setembro: 8, outubro: 9, novembro: 10, dezembro: 11
    };
    if (monthsMap[monthStr] !== undefined) {
      const d = new Date(year, monthsMap[monthStr], day);
      if (!isNaN(d.getTime())) {
        const dateISO = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const formatted = d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
        return { dateStr: dateISO, formattedStr: formatted };
      }
    }
  }

  if (msgLower.includes('hoje')) {
    const dateISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return { dateStr: dateISO, formattedStr: 'Hoje' };
  }

  if (msgLower.includes('amanhã') || msgLower.includes('amanha')) {
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const dateISO = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
    return { dateStr: dateISO, formattedStr: 'Amanhã' };
  }

  const weekDaysMap: Record<string, number> = {
    'domingo': 0,
    'segunda': 1,
    'terça': 2,
    'terca': 2,
    'quarta': 3,
    'quinta': 4,
    'sexta': 5,
    'sábado': 6,
    'sabado': 6,
  };

  for (const [dayName, dayNum] of Object.entries(weekDaysMap)) {
    if (msgLower.includes(dayName)) {
      const target = new Date(today);
      let diff = (dayNum + 7 - today.getDay()) % 7;
      if (diff === 0) diff = 7;
      target.setDate(today.getDate() + diff);
      const dateISO = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`;
      return { dateStr: dateISO, formattedStr: target.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' }) };
    }
  }

  return null;
}

/**
 * Processador principal da conversa do Agente de IA com suporte a OpenAI / GenAI / Motor Inteligente Interno
 */
export async function processAgentMessage({
  patientPhone,
  userMessage,
  conversationHistory = [],
  clinicId,
}: ProcessMessageOptions): Promise<AgentProcessResult> {
  const toolsExecuted: Array<{ name: string; args: any; result: any }> = [];
  const msgLower = userMessage.toLowerCase().trim();
  const extractedDate = extractDateFromText(userMessage);

  // Trava de segurança: Se a mensagem for "2", "remarcar", "sim" sem data explícita, nunca chama busca de horários!
  const isRescheduleIntent =
    msgLower === '2' ||
    msgLower === 'remarcar' ||
    msgLower.includes('remarcar consulta') ||
    msgLower === 'sim' ||
    msgLower === 'quero' ||
    msgLower.includes('outra data');

  if (isRescheduleIntent && !extractedDate) {
    return {
      reply: `📅 *Remarcação de Consulta*\n\nPara qual data você gostaria de verificar os horários disponíveis?\n\nPor favor, digite a data no formato **DD/MM/AA** (ex: *25/09/26* ou *28/09/26*).`,
      toolsExecuted,
    };
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (apiKey && apiKey.startsWith('sk-') && !apiKey.includes('sua-chave')) {
    try {
      const openai = new OpenAI({ apiKey });

      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: 'system', content: SYSTEM_PROMPT + `\nTelefone do paciente atual: ${patientPhone}` },
        ...conversationHistory.map((msg) => ({
          role: msg.role === 'tool' ? ('assistant' as const) : msg.role,
          content: msg.content,
        })),
        { role: 'user', content: userMessage },
      ];

      let response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        tools: openaiTools,
        tool_choice: 'auto',
      });

      let responseMessage = response.choices[0].message;

      // Se o modelo quis chamar ferramentas
      while (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
        messages.push(responseMessage);

        for (const toolCall of responseMessage.tool_calls) {
          const toolName = toolCall.function.name;
          const toolArgs = JSON.parse(toolCall.function.arguments || '{}');

          if (toolName === 'buscar_consulta_atual' && !toolArgs.telefone_paciente) {
            toolArgs.telefone_paciente = patientPhone;
          }

          // Se o modelo tentou chamar buscar_horarios_disponiveis sem que o usuário tenha digitado uma data
          if (toolName === 'buscar_horarios_disponiveis' && !extractedDate) {
            return {
              reply: `📅 *Remarcação de Consulta*\n\nPara qual data você gostaria de verificar os horários disponíveis?\n\nPor favor, digite a data no formato **DD/MM/AA** (ex: *25/09/26* ou *28/09/26*).`,
              toolsExecuted,
            };
          }

          const toolResult = await executeToolCall(toolName, toolArgs, clinicId);
          toolsExecuted.push({ name: toolName, args: toolArgs, result: toolResult });

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(toolResult),
          });
        }

        response = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages,
          tools: openaiTools,
        });
        responseMessage = response.choices[0].message;
      }

      return {
        reply: responseMessage.content || 'Desculpe, não consegui processar a resposta.',
        toolsExecuted,
      };
    } catch (err: any) {
      console.warn('Alerta na chamada da OpenAI API (usando motor inteligente interno):', err.message);
    }
  }

  // MOTOR INTELIGENTE INTERNO (Deterministic Pattern Matcher com Function Calling Real para Testes/Dev)
  return await processWithFallbackIntelligence(patientPhone, userMessage, conversationHistory, clinicId);
}

/**
 * Motor heurístico inteligente com Tool Calling real para ambientes de dev ou sem chave API externa ativada
 */
async function processWithFallbackIntelligence(
  patientPhone: string,
  userMessage: string,
  history: Array<{ role: string; content: string }>,
  clinicId?: string
): Promise<AgentProcessResult> {
  const toolsExecuted: Array<{ name: string; args: any; result: any }> = [];
  const msgLower = userMessage.toLowerCase().trim();

  // 1. Saudação inicial / Entrada do paciente (Oi, Olá, Bom dia, Boa tarde, Boa noite, Menu)
  const isGreeting =
    msgLower === 'oi' ||
    msgLower === 'olá' ||
    msgLower === 'ola' ||
    msgLower.startsWith('bom dia') ||
    msgLower.startsWith('boa tarde') ||
    msgLower.startsWith('boa noite') ||
    msgLower === 'menu' ||
    msgLower === 'início' ||
    msgLower === 'inicio';

  if (isGreeting) {
    const resAtual = await buscarConsultaAtual(patientPhone, clinicId);
    toolsExecuted.push({ name: 'buscar_consulta_atual', args: { telefone_paciente: patientPhone }, result: resAtual });

    let infoConsulta = '';
    if (resAtual.success && resAtual.data?.appointmentId) {
      infoConsulta = `\n\n📌 *Sua Consulta Atual:* ${resAtual.data.specialty} em *${resAtual.message.split('Data: ')[1]?.split('\n')[0] || ''}*`;
    }

    return {
      reply: `Olá! Seja muito bem-vindo(a) à nossa clínica médica. 🩺✨${infoConsulta}\n\nComo posso ajudar você hoje? Por favor, digite o número ou opção desejada:\n\n1️⃣ *Consultar Agendamento* (Verificar detalhes da sua consulta)\n2️⃣ *Remarcar Consulta* (Escolher um novo dia ou horário)\n3️⃣ *Desmarcar Consulta* (Cancelar o seu agendamento)\n\nComo posso te auxiliar?`,
      toolsExecuted,
    };
  }

  // 2. Opção 1: Consultar agendamento (Digitou "1" ou "consultar")
  if (
    msgLower === '1' ||
    msgLower === 'consultar' ||
    msgLower.includes('consultar agendamento') ||
    msgLower.includes('minha consulta') ||
    msgLower.includes('ver agendamento')
  ) {
    const resAtual = await buscarConsultaAtual(patientPhone, clinicId);
    toolsExecuted.push({ name: 'buscar_consulta_atual', args: { telefone_paciente: patientPhone }, result: resAtual });

    if (resAtual.success && resAtual.data?.appointmentId) {
      return {
        reply: `📋 *Detalhes da sua Consulta:*\n\n${resAtual.message}\n\nComo deseja prosseguir?\n1️⃣ *Manter consulta*\n2️⃣ *Remarcar consulta*\n3️⃣ *Desmarcar consulta*`,
        toolsExecuted,
      };
    } else {
      return {
        reply: `Não localizei nenhuma consulta futura agendada no seu número. Gostaria de *2* (Ver horários para agendar uma consulta)?`,
        toolsExecuted,
      };
    }
  }

  // 3. Opção 3: Desmarcar / Cancelar consulta (Digitou "3" ou "desmarcar" ou "cancelar")
  if (
    msgLower === '3' ||
    msgLower === 'desmarcar' ||
    msgLower.includes('desmarcar consulta') ||
    msgLower.includes('cancelar consulta') ||
    msgLower.includes('desistir')
  ) {
    const resAtual = await buscarConsultaAtual(patientPhone, clinicId);
    toolsExecuted.push({ name: 'buscar_consulta_atual', args: { telefone_paciente: patientPhone }, result: resAtual });

    if (resAtual.data?.appointmentId) {
      const resCancel = await cancelarConsulta(resAtual.data.appointmentId, 'Solicitado pelo paciente via WhatsApp');
      toolsExecuted.push({ name: 'cancelar_consulta', args: { agendamento_id: resAtual.data.appointmentId }, result: resCancel });
      return {
        reply: `${resCancel.message}\n\nSe precisar agendar uma nova consulta no futuro, estamos à disposição!`,
        toolsExecuted,
      };
    } else {
      return {
        reply: `Não encontrei nenhuma consulta ativa agendada no seu número para ser desmarcada.`,
        toolsExecuted,
      };
    }
  }

  // 4. Verificação de data no texto (ex: 25/09/26 ou 28/09/2026)
  const extractedDate = extractDateFromText(userMessage);

  // Se o paciente digitou "2" ou "remarcar" SEM informar a data:
  if (
    (msgLower === '2' ||
      msgLower === 'remarcar' ||
      msgLower.includes('remarcar consulta') ||
      msgLower === 'sim' ||
      msgLower === 'quero' ||
      msgLower.includes('outra data')) &&
    !extractedDate
  ) {
    return {
      reply: `📅 *Remarcação de Consulta*\n\nPara qual data você gostaria de verificar os horários disponíveis?\n\nPor favor, digite a data no formato **DD/MM/AA** (ex: *25/09/26* ou *28/09/26*).`,
      toolsExecuted,
    };
  }

  // Se uma data foi informada ou a mensagem contém pedido de horários para uma data específica:
  if (extractedDate) {
    const resHorarios = await buscarHorariosDisponiveis(extractedDate.dateStr, 'qualquer', clinicId);
    toolsExecuted.push({ name: 'buscar_horarios_disponiveis', args: { data_desejada: extractedDate.dateStr }, result: resHorarios });

    if (resHorarios.data?.slots?.length > 0) {
      return {
        reply: `📅 *Horários Disponíveis em ${extractedDate.formattedStr}:*\n\n${resHorarios.data.slots.map((s: string) => `• *${s}*`).join('\n')}\n\nPor favor, responda com o horário desejado (ex: *${resHorarios.data.slots[0]}*) para confirmarmos a sua remarcação!`,
        toolsExecuted,
      };
    } else {
      return {
        reply: `⚠️ ${resHorarios.message}\n\nPor favor, informe outra data no formato **DD/MM/AA** (ex: *28/09/26*) para consultarmos a agenda.`,
        toolsExecuted,
      };
    }
  }

  // 5. Confirmação de horário específico (ex: "09:00", "09:00h", "16:15", "13:15")
  const timeMatch = msgLower.match(/\b(\d{1,2})[:h](\d{2})?\b|\b(\d{1,2})h\b/);
  if (timeMatch) {
    const resAtual = await buscarConsultaAtual(patientPhone, clinicId);
    toolsExecuted.push({ name: 'buscar_consulta_atual', args: { telefone_paciente: patientPhone }, result: resAtual });

    // Buscar a última data consultada de remarcação no histórico recente
    let targetDateStr: string | null = null;

    // 1. Procurar nas mensagens de horários disponíveis ou respostas de remarcação do histórico (do mais recente para o mais antigo)
    for (let i = history.length - 1; i >= 0; i--) {
      const msg = history[i].content;
      if (msg.includes('Horários Disponíveis') || msg.includes('Remarcação') || msg.match(/\d{1,2}[\/\-]\d{1,2}/)) {
        const dateMatch = extractDateFromText(msg);
        if (dateMatch) {
          targetDateStr = dateMatch.dateStr;
          break;
        }
      }
    }

    // 2. Fallback: procurar qualquer data no histórico se a busca acima falhar
    if (!targetDateStr) {
      for (let i = history.length - 1; i >= 0; i--) {
        const dateMatch = extractDateFromText(history[i].content);
        if (dateMatch) {
          targetDateStr = dateMatch.dateStr;
          break;
        }
      }
    }

    // 3. Se nenhuma data for encontrada no histórico, usar o dia de amanhã como fallback de segurança
    if (!targetDateStr) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      targetDateStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
    }

    let hour = 14;
    let min = 0;

    if (timeMatch[1]) hour = parseInt(timeMatch[1], 10);
    else if (timeMatch[3]) hour = parseInt(timeMatch[3], 10);

    if (timeMatch[2]) min = parseInt(timeMatch[2], 10);

    const novaDataHoraStr = `${targetDateStr} ${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;

    const resRemarcar = await confirmarRemarcacao(resAtual.data?.appointmentId || '', novaDataHoraStr, patientPhone);
    toolsExecuted.push({
      name: 'confirmar_remarcacao',
      args: { agendamento_id: resAtual.data?.appointmentId, nova_data_hora: novaDataHoraStr, telefone_paciente: patientPhone },
      result: resRemarcar,
    });

    return {
      reply: `${resRemarcar.message}\n\nSua consulta foi atualizada no sistema. Se precisar de algo mais, estamos à disposição!`,
      toolsExecuted,
    };
  }

  return {
    reply: `Olá! Para te ajudar com a sua consulta, escolha uma das opções abaixo enviando o número correspondente:\n\n1️⃣ *Consultar Agendamento*\n2️⃣ *Remarcar Consulta* (Informe a data em formato DD/MM/AA)\n3️⃣ *Desmarcar Consulta*`,
    toolsExecuted,
  };
}
