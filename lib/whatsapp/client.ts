type SendResult = { success: boolean; data?: any; error?: string };

/**
 * Envio via Meta WhatsApp Cloud API oficial (Graph API)
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/messages/text-messages
 */
async function sendViaMetaCloudApi(cleanPhone: string, messageText: string): Promise<SendResult> {
  const accessToken = process.env.META_ACCESS_TOKEN!;
  const phoneNumberId = process.env.META_PHONE_NUMBER_ID!;
  const graphVersion = process.env.META_GRAPH_VERSION || 'v26.0';

  try {
    const response = await fetch(`https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanPhone,
        type: 'text',
        text: { preview_url: false, body: messageText },
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('❌ Erro Meta Cloud API:', response.status, JSON.stringify(data));
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
 * Prioridade: Meta Cloud API oficial -> Evolution API / Z-API -> Simulação
 */
export async function sendWhatsAppMessage(toPhone: string, messageText: string): Promise<SendResult> {
  const apiKey = process.env.WHATSAPP_API_KEY;
  const instanceName = process.env.EVOLUTION_INSTANCE_NAME || 'default';

  // Sanitizar telefone para formato E.164 limpo (apenas números)
  const cleanPhone = toPhone.replace(/\D/g, '');

  console.log(`📱 [WhatsApp API Outbound] Para: ${cleanPhone} | Mensagem: "${messageText.replace(/\n/g, ' ')}"`);

  // Meta Cloud API oficial (usada se configurada)
  if (process.env.META_ACCESS_TOKEN && process.env.META_PHONE_NUMBER_ID) {
    return sendViaMetaCloudApi(cleanPhone, messageText);
  }

  let formattedApiUrl = process.env.WHATSAPP_API_URL || '';
  if (formattedApiUrl && !formattedApiUrl.startsWith('http://') && !formattedApiUrl.startsWith('https://')) {
    formattedApiUrl = `https://${formattedApiUrl}`;
  }

  if (!formattedApiUrl || !apiKey || apiKey.includes('seu-token') || formattedApiUrl.includes('example')) {
    console.log('ℹ️ [WhatsApp Simulation] API de WhatsApp não configurada ou em modo simulação. Mensagem processada localmente.');
    return {
      success: true,
      data: { simulated: true, toPhone: cleanPhone, text: messageText },
    };
  }

  try {
    // Exemplo de integração padrão com Evolution API v1/v2
    const targetEndpoint = `${formattedApiUrl.replace(/\/$/, '')}/message/sendText/${instanceName}`;

    const response = await fetch(targetEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey,
      },
      body: JSON.stringify({
        number: cleanPhone,
        text: messageText,
        options: {
          delay: 1200,
          presence: 'composing',
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('❌ Erro de envio WhatsApp API:', response.status, errText);
      return { success: false, error: `WhatsApp API Error ${response.status}: ${errText}` };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (err: any) {
    console.error('❌ Exceção ao disparar mensagem no WhatsApp:', err.message);
    return { success: false, error: err.message };
  }
}
