import OpenAI from 'openai';
import {
  buscarConsultaAtual,
  buscarHorariosDisponiveis,
  cancelarConsulta,
  confirmarRemarcacao,
} from './tools';

export const SYSTEM_PROMPT = `Você é a assistente virtual inteligente de atendimento e gestão de consultas da clínica médica.

DIRETRIZES FUNDAMENTAIS DE ATENDIMENTO E FLUXO:
1. **Saudação Inicial e Menu de Opções:** Quando o paciente mandar uma saudação (ex: "oi", "olá", "bom dia", "boa tarde", "boa noite") ou iniciar o contato, dê boas-vindas acolhedoras e apresente de forma muito clara as 3 opções de atendimento:
   - 1️⃣ *Consultar agendamento* (Verificar detalhes da consulta marcada)
   - 2️⃣ *Remarcar consulta* (Ver horários livres e escolher nova data)
   - 3️⃣ *Desmarcar consulta* (Cancelar agendamento existente)

2. **Identificação e Consulta:** Quando o paciente escolher consultar (opção 1), utilize a ferramenta \`buscar_consulta_atual\` para trazer os detalhes da consulta.

3. **Prevenção de Alucinação (REGRA CRÍTICA DE REMARCAÇÃO):** NUNCA invente ou prometa um horário vago sem antes chamar a ferramenta \`buscar_horarios_disponiveis\`. Se o paciente escolher remarcar (opção 2), consulte primeiro a grade oficial.

4. **Confirmação de Remarcação:** Antes de chamar \`confirmar_remarcacao\`, confirme se o paciente aceita a nova data e horário.

5. **Cancelamento:** Se o paciente escolher desmarcar (opção 3), identifique a consulta e chame \`cancelar_consulta\`.

6. **Transbordo Humano:** Dores graves, urgências médicas, dúvidas sobre receitas ou reclamações devem ser direcionadas imediatamente para a recepção humana.

7. **Formatação Amigável para WhatsApp:** Use negritos em *datas* e *horários*, emojis moderados e parágrafos curtos.`;

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
      description: 'Consulta a grade de horários livres do médico cruzando expediente com agendamentos existentes.',
      parameters: {
        type: 'object',
        properties: {
          data_desejada: {
            type: 'string',
            description: 'Data no formato AAAA-MM-DD para a qual o paciente deseja agendar.',
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
            description: 'Nova data e horário no formato AAAA-MM-DD HH:mm (ex: 2026-09-15 14:30).',
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
 * Processador principal da conversa do Agente de IA com suporte a OpenAI / GenAI / Motor Inteligente Interno
 */
export async function processAgentMessage({
  patientPhone,
  userMessage,
  conversationHistory = [],
  clinicId,
}: ProcessMessageOptions): Promise<AgentProcessResult> {
  const toolsExecuted: Array<{ name: string; args: any; result: any }> = [];

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

          // Injetar telefone do paciente se necessário
          if (toolName === 'buscar_consulta_atual' && !toolArgs.telefone_paciente) {
            toolArgs.telefone_paciente = patientPhone;
          }

          const toolResult = await executeToolCall(toolName, toolArgs, clinicId);
          toolsExecuted.push({ name: toolName, args: toolArgs, result: toolResult });

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(toolResult),
          });
        }

        // Fazer nova requisição com os resultados das ferramentas
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
  const msgLower = userMessage.toLowerCase();

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

  // Opção 1: Consultar agendamento (Digitou "1" ou "consultar")
  if (
    msgLower === '1' ||
    msgLower.includes('consultar') ||
    msgLower.includes('minha consulta') ||
    msgLower.includes('ver agendamento') ||
    msgLower.includes('quando é')
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

  // Opção 3: Desmarcar / Cancelar consulta (Digitou "3" ou "desmarcar" ou "cancelar")
  if (
    msgLower === '3' ||
    msgLower.includes('desmarcar') ||
    msgLower.includes('cancelar') ||
    msgLower.includes('desistir') ||
    msgLower.includes('não vou poder')
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

  // Opção 2: Remarcar consulta (Digitou "2" ou "remarcar" ou horários)
  if (
    msgLower === '2' ||
    msgLower.includes('remarcar') ||
    msgLower.includes('mudar') ||
    msgLower.includes('horário') ||
    msgLower.includes('vago') ||
    msgLower.includes('quarta') ||
    msgLower.includes('terça') ||
    msgLower.includes('quinta') ||
    msgLower.includes('sexta') ||
    msgLower.includes('segunda')
  ) {
    const today = new Date();
    let targetDate = new Date(today);
    targetDate.setDate(today.getDate() + 1);

    if (msgLower.includes('hoje')) {
      targetDate = today;
    } else if (msgLower.includes('terça') || msgLower.includes('terca')) {
      targetDate.setDate(today.getDate() + ((2 + 7 - today.getDay()) % 7 || 7));
    } else if (msgLower.includes('quarta')) {
      targetDate.setDate(today.getDate() + ((3 + 7 - today.getDay()) % 7 || 7));
    } else if (msgLower.includes('quinta')) {
      targetDate.setDate(today.getDate() + ((4 + 7 - today.getDay()) % 7 || 7));
    } else if (msgLower.includes('sexta')) {
      targetDate.setDate(today.getDate() + ((5 + 7 - today.getDay()) % 7 || 7));
    }

    const dateStr = targetDate.toISOString().split('T')[0];
    const resHorarios = await buscarHorariosDisponiveis(dateStr, 'qualquer', clinicId);
    toolsExecuted.push({ name: 'buscar_horarios_disponiveis', args: { data_desejada: dateStr }, result: resHorarios });

    if (resHorarios.data?.slots?.length > 0) {
      return {
        reply: `📅 *Horários Disponíveis para Agendamento*\n\n${resHorarios.message}\n\nQual desses horários fica melhor para você? Responda com o horário desejado (ex: *14:00*) para confirmarmos!`,
        toolsExecuted,
      };
    } else {
      return {
        reply: `${resHorarios.message} Deseja consultar outra data?`,
        toolsExecuted,
      };
    }
  }

  // 5. Confirmação de horário específico
  const timeMatch = msgLower.match(/(\d{1,2})(?:[:h](\d{2}))?/);
  if (timeMatch || msgLower.includes('sim') || msgLower.includes('pode ser') || msgLower.includes('confirmo')) {
    const resAtual = await buscarConsultaAtual(patientPhone, clinicId);
    toolsExecuted.push({ name: 'buscar_consulta_atual', args: { telefone_paciente: patientPhone }, result: resAtual });

    if (resAtual.data?.appointmentId) {
      // Tentar encontrar a data mencionada nas mensagens anteriores do histórico
      let targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + 1); // Padrão: amanhã

      for (let i = history.length - 1; i >= 0; i--) {
        const dateMatch = history[i].content.match(/(\d{2})\/(\d{2})\/(\d{4})/);
        if (dateMatch) {
          const day = parseInt(dateMatch[1], 10);
          const month = parseInt(dateMatch[2], 10) - 1;
          const year = parseInt(dateMatch[3], 10);
          targetDate = new Date(year, month, day);
          break;
        }
      }

      const hour = timeMatch ? parseInt(timeMatch[1], 10) : 14;
      const min = timeMatch && timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
      targetDate.setHours(hour, min, 0, 0);

      const novaDataHoraStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')} ${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;

      const resRemarcar = await confirmarRemarcacao(resAtual.data.appointmentId, novaDataHoraStr);
      toolsExecuted.push({
        name: 'confirmar_remarcacao',
        args: { agendamento_id: resAtual.data.appointmentId, nova_data_hora: novaDataHoraStr },
        result: resRemarcar,
      });

      return {
        reply: `${resRemarcar.message}\n\nSua consulta foi atualizada e o seu novo comprovante de agendamento já está ativo. Caso precise de mais algo, estou à disposição!`,
        toolsExecuted,
      };
    }
  }

  return {
    reply: `Olá! Sou a assistente de reagendamentos da clínica. Como posso ajudar com a sua consulta? Você pode me perguntar sobre seus horários agendados, reagendar ou cancelar.`,
    toolsExecuted,
  };
}
