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

/**
 * Um candidato devolvido pelo `resolve` (o brain oferece como botão/lista).
 *
 * `id` é o valor que o brain devolve depois, como o slot resolvido — para
 * `sessionTime` é o "HH:mm" escolhido, para `serviceName`/`staffName` é o
 * nome. `fields` carrega o resto (ids internos, horário absoluto) como texto:
 * o `CandidateItem` do brain é `{ id, fields: Map<String,String>, label }`
 * sem tolerância a campo desconhecido, então nada solto fora de `fields`.
 */
export type Candidato = {
  id: string;
  fields: Record<string, string>;
  label?: string | null;
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

/**
 * Vocabulário do brain para o resultado do `execute` — não é "criado ou
 * cancelado", é "aplicado, já tinha sido aplicado, ou recusado"
 * (`ExternalActionStatus` no orchestrator, sem tolerância a valor fora
 * desses três).
 */
export type StatusDaAcao = 'SUCCEEDED' | 'DUPLICATE' | 'REJECTED';

/**
 * Resultado do `execute`. Só isso: o `ExternalActionResponse` do brain é
 * `{ status, code, summary }` e não tolera campo a mais — nada de
 * `appointmentId`/`staffName`/etc. soltos aqui; quem quiser esse detalhe lê
 * do texto de `summary`.
 */
export type ResultadoDaAcao = {
  status: StatusDaAcao;
  code: string | null;
  summary: string | null;
};
