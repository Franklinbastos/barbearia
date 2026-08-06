import type { RenderedMessage } from './sender';

export type MessageData = {
  customerName: string;
  shopName: string;
  staffName: string;
  serviceName: string;
  startAt: Date;
  timeZone: string;
  manageUrl: string;
};

function data(d: MessageData) {
  return d.startAt.toLocaleDateString('pt-BR', {
    timeZone: d.timeZone, day: '2-digit', month: '2-digit',
  });
}

function hora(d: MessageData) {
  return d.startAt.toLocaleTimeString('pt-BR', {
    timeZone: d.timeZone, hour: '2-digit', minute: '2-digit',
  });
}

export function renderConfirmation(d: MessageData): RenderedMessage {
  return {
    templateName: 'agendamento_confirmado',
    params: [d.customerName, d.shopName, data(d), hora(d), d.staffName],
    fallbackText:
      `Olá, ${d.customerName}! Seu horário na ${d.shopName} está confirmado: ` +
      `${d.serviceName} com ${d.staffName} em ${data(d)} às ${hora(d)}. ` +
      `Precisa cancelar? ${d.manageUrl}`,
  };
}

export function renderReminder(d: MessageData): RenderedMessage {
  return {
    templateName: 'agendamento_lembrete',
    params: [d.customerName, d.shopName, hora(d), d.staffName],
    fallbackText:
      `Oi, ${d.customerName}! Lembrete do seu horário hoje na ${d.shopName} ` +
      `às ${hora(d)} com ${d.staffName}. Até já!`,
  };
}

export function renderCancellation(d: MessageData): RenderedMessage {
  return {
    templateName: 'agendamento_cancelado',
    params: [d.customerName, d.shopName, data(d), hora(d)],
    fallbackText:
      `${d.customerName}, seu horário na ${d.shopName} em ${data(d)} às ${hora(d)} ` +
      `foi cancelado. Quando quiser, é só marcar outro.`,
  };
}
