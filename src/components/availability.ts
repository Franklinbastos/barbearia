/**
 * Consulta da grade pública de horários, compartilhada pela página pública e
 * pelo encaixe manual do painel.
 *
 * Duas coisas moram aqui de propósito:
 *
 * 1. **Descarte de resposta obsoleta.** Quem troca de dia rápido em rede lenta
 *    dispara duas requisições; sem guarda, a resposta antiga pinta sob o rótulo
 *    do dia novo e o cliente confirma o dia errado. Todo retorno passa pelo
 *    `AbortSignal` antes de virar estado.
 * 2. **Erro do servidor não vira lista vazia.** 400, 429 e 500 têm mensagem no
 *    corpo; engolir isso faz a tela dizer "sem horário" quando o problema é
 *    outro.
 */

export type HorarioDisponivel = { startAt: string; staffId: string; staffName: string };

/**
 * De onde a grade está sendo pedida.
 *
 * `PUBLIC` é a página do cliente: passa pelo slug e respeita a janela de
 * `maxAdvanceDays`. `PANEL` é o balcão logado, que precisa enxergar horário
 * fora dessa janela para encaixar — o tenant vem da sessão, não da URL.
 */
export type OrigemDaGrade = 'PUBLIC' | 'PANEL';

export type ConsultaDeGrade = {
  slug: string;
  serviceId: string;
  date: string;
  staffId?: string;
  origem?: OrigemDaGrade;
};

export type AcoesDeGrade = {
  aoReceber: (horarios: HorarioDisponivel[]) => void;
  aoFalhar: (mensagem: string) => void;
};

export const MENSAGEM_PADRAO_DE_FALHA = 'Não foi possível carregar os horários.';

export function montarUrlDeGrade({
  slug,
  serviceId,
  date,
  staffId,
  origem = 'PUBLIC',
}: ConsultaDeGrade): string {
  const params = new URLSearchParams({ serviceId, date });
  if (staffId) params.set('staffId', staffId);
  if (origem === 'PANEL') return `/api/panel/availability?${params}`;
  return `/api/public/${encodeURIComponent(slug)}/availability?${params}`;
}

function mensagemDoCorpo(corpo: unknown): string {
  if (corpo && typeof corpo === 'object' && 'message' in corpo) {
    const mensagem = (corpo as { message: unknown }).message;
    if (typeof mensagem === 'string' && mensagem.trim() !== '') return mensagem;
  }
  return MENSAGEM_PADRAO_DE_FALHA;
}

function ehAbortado(erro: unknown): boolean {
  return erro instanceof Error && erro.name === 'AbortError';
}

/**
 * Busca a grade e entrega o resultado por `acoes` — mas só se `signal` ainda
 * estiver válido. Nunca lança: falha vira `aoFalhar`, cancelamento vira
 * silêncio.
 */
export async function carregarHorarios(
  consulta: ConsultaDeGrade,
  signal: AbortSignal,
  acoes: AcoesDeGrade,
): Promise<void> {
  try {
    const res = await fetch(montarUrlDeGrade(consulta), { signal });
    if (signal.aborted) return;

    if (!res.ok) {
      let corpo: unknown = null;
      try {
        corpo = await res.json();
      } catch {
        corpo = null;
      }
      if (signal.aborted) return;
      acoes.aoFalhar(mensagemDoCorpo(corpo));
      return;
    }

    const corpo: unknown = await res.json();
    if (signal.aborted) return;

    const slots =
      corpo && typeof corpo === 'object' && Array.isArray((corpo as { slots?: unknown }).slots)
        ? ((corpo as { slots: HorarioDisponivel[] }).slots)
        : [];
    acoes.aoReceber(slots);
  } catch (erro) {
    if (signal.aborted || ehAbortado(erro)) return;
    acoes.aoFalhar(MENSAGEM_PADRAO_DE_FALHA);
  }
}
