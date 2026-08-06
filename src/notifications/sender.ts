export type RenderedMessage = {
  /** Nome do template aprovado na Meta. */
  templateName: string;
  /** Parâmetros posicionais do template, na ordem em que foram registrados. */
  params: string[];
  /** Texto legível, usado em log e em senders que não usam template. */
  fallbackText: string;
};

export interface NotificationSender {
  send(to: string, message: RenderedMessage): Promise<{ providerMessageId: string }>;
}
