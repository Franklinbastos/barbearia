import { env } from '@/lib/env';
import type { NotificationSender, RenderedMessage } from './sender';

const API = 'https://graph.facebook.com/v21.0';

export class MetaWhatsAppSender implements NotificationSender {
  async send(to: string, message: RenderedMessage) {
    if (!env.WHATSAPP_PHONE_NUMBER_ID || !env.WHATSAPP_ACCESS_TOKEN) {
      throw new Error('WhatsApp não configurado');
    }

    const resposta = await fetch(`${API}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: `55${to}`,
        type: 'template',
        template: {
          name: message.templateName,
          language: { code: env.WHATSAPP_LANGUAGE },
          components: [
            {
              type: 'body',
              parameters: message.params.map((text) => ({ type: 'text', text })),
            },
          ],
        },
      }),
    });

    if (!resposta.ok) {
      throw new Error(`Meta respondeu ${resposta.status}: ${await resposta.text()}`);
    }

    const corpo = await resposta.json();
    return { providerMessageId: corpo.messages?.[0]?.id ?? 'sem-id' };
  }
}

class ConsoleSender implements NotificationSender {
  async send(to: string, message: RenderedMessage) {
    console.info(`[whatsapp desligado] para ${to.slice(0, 4)}****: ${message.fallbackText}`);
    return { providerMessageId: 'console' };
  }
}

export function getSender(): NotificationSender {
  return env.WHATSAPP_ENABLED === 'true' ? new MetaWhatsAppSender() : new ConsoleSender();
}
