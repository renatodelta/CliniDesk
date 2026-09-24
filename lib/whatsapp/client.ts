/**
 * Utilitário para envio de mensagens via API de WhatsApp (Evolution API / Z-API)
 */
export async function sendWhatsAppMessage(toPhone: string, messageText: string): Promise<{ success: boolean; data?: any; error?: string }> {
  const apiUrl = process.env.WHATSAPP_API_URL;
  const apiKey = process.env.WHATSAPP_API_KEY;
  const instanceName = process.env.EVOLUTION_INSTANCE_NAME || 'default';

  // Sanitizar telefone para formato E.164 limpo (apenas números)
  const cleanPhone = toPhone.replace(/\D/g, '');

  console.log(`📱 [WhatsApp API Outbound] Para: ${cleanPhone} | Mensagem: "${messageText.replace(/\n/g, ' ')}"`);

  if (!apiUrl || !apiKey || apiKey.includes('seu-token') || apiUrl.includes('example')) {
    console.log('ℹ️ [WhatsApp Simulation] API de WhatsApp não configurada ou em modo simulação. Mensagem processada localmente.');
    return {
      success: true,
      data: { simulated: true, toPhone: cleanPhone, text: messageText },
    };
  }

  try {
    // Exemplo de integração padrão com Evolution API v1/v2
    const targetEndpoint = `${apiUrl.replace(/\/$/, '')}/message/sendText/${instanceName}`;

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
