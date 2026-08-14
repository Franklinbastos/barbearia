/**
 * Casca do "brain" (atendente agnóstico) sobre o domínio da barbearia.
 *
 * O brain conversa com qualquer domínio externo por um contrato HTTP de quatro
 * endpoints, cujos schemas versionados vivem em `./schemas/` (cópia fiel do
 * contrato v1 do brain). Estes tipos são o lado TypeScript desse contrato — o
 * bastante para o `/barbearia` responder no formato que o brain espera, sem que
 * nenhum arquivo de domínio existente precise mudar.
 *
 * O mapa das operações do contrato para o modelo da barbearia:
 *   marcar_horario   → getAvailability + createAppointment (origin 'BOT')
 *   cancelar_horario → cancelAppointment
 */

/** Um slot de intenção declarado no catálogo (casa com `intentSlots` do schema). */
export type SlotDeIntencao = {
  name: string;
  format?: string | null;
  hint?: string | null;
  alwaysMissing?: boolean | null;
  resolutionStrategy?: string | null;
  resolverKey?: string | null;
  minimumSlots?: string[] | null;
  /** Valores conhecidos, montados a partir de serviços/equipe da barbearia. */
  values?: string[];
};

export type DicaDeUx = {
  label?: string | null;
  emoji?: string | null;
  showInMenu?: boolean | null;
  inverseOperation?: string | null;
  suggestedNextOperations?: string[] | null;
  temporalPolicy?: string | null;
  supportsCollectiveMode?: boolean | null;
};

export type IntentDoMenu = {
  name: string;
  behavior: string;
  replyText?: string | null;
};

export type MenuDeConversa = {
  offerText?: string | null;
  intents?: IntentDoMenu[] | null;
};

export type CopyDaOperacao = {
  candidateSelectionPromptsBySlot?: Record<string, string> | null;
  candidateButtonTemplatesBySlot?: Record<string, string[]> | null;
  confirmationTemplate?: string | null;
};

/** Resposta do `GET .../catalog` — casa com `catalog-response.schema.json`. */
export type RespostaDeCatalogo = {
  operations: string[];
  intentSlots: Record<string, SlotDeIntencao[]>;
  uxHints: Record<string, DicaDeUx> | null;
  slotDisplayNames?: Record<string, string> | null;
  copyHintsByOperation?: Record<string, CopyDaOperacao> | null;
  profileRole?: string | null;
  conversationMenu?: MenuDeConversa | null;
};

/** Loja como a casca precisa dela: só o que entra na resposta e nas contas. */
export type LojaDoBrain = {
  id: string;
  slug: string;
  name: string;
  timeZone: string;
  maxAdvanceDays: number;
};

export type ServicoDoBrain = {
  id: string;
  name: string;
  durationMinutes: number;
  priceCents: number;
};

export type BarbeiroDoBrain = {
  id: string;
  name: string;
};

/** Um candidato devolvido pelo `resolve` (o brain oferece como botão/lista). */
export type Candidato = {
  value: string;
  label: string;
  serviceId?: string;
  staffId?: string;
  staffName?: string;
  startAt?: string;
};

export type RespostaDeResolucao = {
  slotToResolve: string;
  resolverKey: string;
  candidates: Candidato[];
  message?: string | null;
};

/** Resposta do `authorize` — casa com `authorize-response.schema.json`. */
export type RespostaDeAutorizacao = {
  allowed: boolean;
  message: string | null;
};

export type StatusDaAcao = 'CREATED' | 'CANCELED' | 'REJECTED';

/** Resultado do `execute`. `status` é a chave que o brain lê; o route mapeia para HTTP. */
export type ResultadoDaAcao = {
  status: StatusDaAcao;
  code?: string | null;
  actionName: string;
  idempotencyKey: string;
  message: string | null;
  appointmentId?: string;
  startAt?: string;
  staffId?: string;
  staffName?: string;
  externalReference?: string | null;
};
