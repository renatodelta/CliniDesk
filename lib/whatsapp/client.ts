export type SendResult = { success: boolean; data?: any; error?: string };

export interface WhatsAppButton {
  id: string;
  title: string;
}

/**
 * Envio via Meta WhatsApp Cloud API oficial (Graph API) com suporte a botões interativos
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/messages/interactive-reply-buttons-messages
 */
async function sendViaMetaCloudApi(
  cleanPhone: string,
  messageText: string,
  buttons?: WhatsAppButton[]
): Promise<SendResult> {
  const accessToken = (process.env.META_ACCESS_TOKEN || '').replace(/['"]/g, '').trim();
  const phoneNumberId = (process.env.META_PHONE_NUMBER_ID || '').replace(/['"]/g, '').trim();
  const graphVersion = (process.env.META_GRAPH_VERSION || 'v21.0').replace(/['"]/g, '').trim();

  try {
    let payload: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanPhone,
    };

    if (buttons && buttons.length > 0) {
      payload.type = 'interactive';
      payload.interactive = {
        type: 'button',
        body: { text: messageText },
        action: {
          buttons: buttons.slice(0, 3).map((b) => ({
            type: 'reply',
            reply: {
              id: b.id,
              title: b.title.slice(0, 20), // Limite máximo da Meta é 20 caracteres por botão
            },
          })),
        },
      };
    } else {
      payload.type = 'text';
      payload.text = { preview_url: false, body: messageText };
    }

    const response = await fetch(`https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('❌ Erro Meta Cloud API:', response.status, JSON.stringify(data));
      // Fallback: se falhou com botões interativos, tenta reenviar como texto simples
      if (buttons && buttons.length > 0) {
        console.warn('⚠️ Tentando fallback para texto simples na Meta Cloud API...');
        return sendViaMetaCloudApi(cleanPhone, messageText);
      }
      return { success: false, error: `Meta API Error ${response.status}: ${data?.error?.message || 'desconhecido'}`, data };
    }
    return { success: true, data };
  } catch (err: any) {
    console.error('❌ Exceção ao enviar via Meta Cloud API:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Utilitário para envio de mensagens via API de WhatsApp
 * Suporta botões interativos clicáveis e texto simples com detecção automática de opções SIM/NÃO.
 * Prioridade: Meta Cloud API oficial -> Evolution API / Z-API -> Simulação
 */
export async function sendWhatsAppMessage(
  toPhone: string,
  messageText: string,
  explicitButtons?: WhatsAppButton[]
): Promise<SendResult> {
  const apiKey = process.env.WHATSAPP_API_KEY;
  const instanceName = process.env.EVOLUTION_INSTANCE_NAME || 'default';

  // Sanitizar telefone para formato E.164 limpo (apenas números)
  const cleanPhone = toPhone.replace(/\D/g, '');

  // Detectar automaticamente opções [1] SIM e [2] NÃO se nenhum botão for passado explicitamente
  let buttonsToSend = explicitButtons;
  let textToSend = messageText;

  if (!buttonsToSend) {
    const hasSimNao = /\[1\]\s*SIM[\s\S]*\[2\]\s*NÃO/i.test(messageText);
    if (hasSimNao) {
      buttonsToSend = [
        { id: 'btn_sim', title: 'SIM' },
        { id: 'btn_nao', title: 'NÃO' },
      ];
      // Limpa os sufixos "[1] SIM \n [2] NÃO" do corpo do texto para exibir os botões nativos limpos
      textToSend = messageText.replace(/\n+\s*\[1\]\s*SIM[\s\S]*\[2\]\s*NÃO\s*$/i, '').trim();
    }
  }

  console.log(
    `📱 [WhatsApp API Outbound] Para: ${cleanPhone} | Mensagem: "${textToSend.replace(/\n/g, ' ')}" | Botões: ${
      buttonsToSend ? buttonsToSend.map((b) => b.title).join(', ') : 'Nenhum'
    }`
  );

  // 1. Meta Cloud API oficial (usada se configurada)
  if (process.env.META_ACCESS_TOKEN && process.env.META_PHONE_NUMBER_ID) {
    return sendViaMetaCloudApi(cleanPhone, textToSend, buttonsToSend);
  }

  let formattedApiUrl = process.env.WHATSAPP_API_URL || '';
  if (formattedApiUrl && !formattedApiUrl.startsWith('http://') && !formattedApiUrl.startsWith('https://')) {
    formattedApiUrl = `https://${formattedApiUrl}`;
  }

  if (!formattedApiUrl || !apiKey || apiKey.includes('seu-token') || formattedApiUrl.includes('example')) {
    console.log('ℹ️ [WhatsApp Simulation] API de WhatsApp não configurada ou em modo simulação. Mensagem processada localmente.');
    return {
      success: true,
      data: { simulated: true, toPhone: cleanPhone, text: textToSend, buttons: buttonsToSend },
    };
  }

  try {
    // 2. Evolution API v1 / v2
    const targetEndpoint = buttonsToSend && buttonsToSend.length > 0
      ? `${formattedApiUrl.replace(/\/$/, '')}/message/sendButtons/${instanceName}`
      : `${formattedApiUrl.replace(/\/$/, '')}/message/sendText/${instanceName}`;

    const payload = buttonsToSend && buttonsToSend.length > 0
      ? {
          number: cleanPhone,
          title: 'CliniDesk',
          description: textToSend,
          buttons: buttonsToSend.map((b) => ({
            type: 'reply',
            displayText: b.title,
            id: b.id,
          })),
        }
      : {
          number: cleanPhone,
          text: textToSend,
          options: { delay: 1200, presence: 'composing' },
        };

    const response = await fetch(targetEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn('⚠️ Erro com endpoint de botões, tentando envio como texto:', response.status, errText);
      // Fallback para envio como texto se botões não forem suportados na instância
      const fallbackResp = await fetch(`${formattedApiUrl.replace(/\/$/, '')}/message/sendText/${instanceName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: apiKey,
        },
        body: JSON.stringify({
          number: cleanPhone,
          text: messageText, // Envia o texto original completo com [1] SIM e [2] NÃO
          options: { delay: 1200, presence: 'composing' },
        }),
      });
      if (!fallbackResp.ok) {
        return { success: false, error: `WhatsApp API Error ${fallbackResp.status}` };
      }
      return { success: true, data: await fallbackResp.json() };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (err: any) {
    console.error('❌ Exceção ao disparar mensagem no WhatsApp:', err.message);
    return { success: false, error: err.message };
  }
}
