'use client';

import type { ComponentProps } from 'react';
import { cva } from 'class-variance-authority';
import { CalendarClock, Plus } from 'lucide-react';

import { cn } from '@/lib/utils';
import { formatDuration, formatTime, type AppointmentStatus } from '@/lib/format';

/**
 * O buraco entre dois atendimentos vira o jeito de agendar (§1.3, item 3 do
 * spec de 14/08/2026).
 *
 * Em Fresha, Square, Vagaro, Acuity e Cal.com **clicar no vazio é o gesto
 * primário de marcar**. Aqui o encaixe era um botão no topo que abria uma folha
 * pedindo a hora que a pessoa já tinha apontado com o dedo. O `EmptyCell` do
 * Cal.com é o padrão copiado: no lugar do vazio, um bloco fantasma diz a hora e
 * a duração. A nossa lista não tem eixo de tempo, então a faixa carrega o
 * tamanho do buraco por escrito em vez de por comprimento.
 *
 * **O piso é o serviço mais curto da loja.** Faixa em todo buraco de cinco
 * minutos enche a tela e não leva a lugar nenhum: é ruído com aparência de
 * ação. `duracaoMinima` é quem segura isso, e vem de fora — do menor
 * `durationMinutes` entre os serviços ativos.
 */

/** O que a conta precisa saber de um atendimento. Subconjunto do `AgendaAppointment`. */
export type AtendimentoNaGrade = {
  staffId: string;
  startAt: Date;
  endAt: Date;
  status: AppointmentStatus;
};

export type VaoLivre = {
  inicio: Date;
  fim: Date;
  /** Tamanho do buraco em minutos — é o que a faixa mostra. */
  minutos: number;
  staffId: string;
};

/**
 * **A regra de status não é nova.** É a mesma de
 * `src/domain/indicadores/ocupacao.ts`, onde ela já está decidida e testada:
 * `NO_SHOW` **ocupa** — a cadeira ficou reservada e ninguém pôde usar —, e
 * `CANCELED` **não ocupa**, porque o horário voltou para a grade e pode ser
 * vendido de novo. Duas regras para a mesma pergunta divergiriam no primeiro
 * ajuste, e aí a agenda ofereceria um vão que a ocupação conta como cheio.
 */
const OCUPAM = new Set<AppointmentStatus>(['BOOKED', 'DONE', 'NO_SHOW']);

/**
 * Os buracos do dia, um por barbeiro, em ordem de horário.
 *
 * Pura e sem DOM de propósito, no mesmo espírito do `buildDayList` que mora no
 * `day-grid.tsx`: é a parte que decide, e decidir se testa em milissegundo.
 *
 * Três decisões que o teste trava:
 *
 * 1. **O vão existe ENTRE atendimentos.** Dia vazio não vira uma faixa gigante
 *    das 8h às 20h — ele já tem o seu estado vazio, com o convite ao encaixe.
 *    Também não há vão antes do primeiro nem depois do último: sem expediente
 *    carregado aqui, qualquer ponta seria chute.
 * 2. **Cada barbeiro tem o próprio buraco.** A cadeira do João estar livre não
 *    diz nada sobre a do Tiago.
 * 3. **Barbeiro fora da equipe ativa não recebe convite.** Ele ainda tem
 *    atendimento marcado no dia (o cartão continua na lista), mas oferecer a
 *    cadeira dele seria marcar cliente com quem não trabalha mais aqui.
 *
 * Não recebe fuso: buraco é aritmética de instante, e a única coisa que precisa
 * de fuso é o texto — trabalho da faixa, não da conta.
 */
export function buildVaosLivres(
  atendimentos: AtendimentoNaGrade[],
  staffList: { id: string; name: string }[],
  duracaoMinima: number,
): VaoLivre[] {
  const ativos = new Set(staffList.map((b) => b.id));
  const porBarbeiro = new Map<string, AtendimentoNaGrade[]>();

  for (const a of atendimentos) {
    if (!OCUPAM.has(a.status) || !ativos.has(a.staffId)) continue;
    if (a.endAt.getTime() <= a.startAt.getTime()) continue;
    porBarbeiro.set(a.staffId, [...(porBarbeiro.get(a.staffId) ?? []), a]);
  }

  const minimoEmMs = duracaoMinima * 60_000;
  const vaos: VaoLivre[] = [];

  for (const [staffId, doBarbeiro] of porBarbeiro) {
    const ordenados = [...doBarbeiro].sort((x, y) => x.startAt.getTime() - y.startAt.getTime());
    // O fim que vale é o mais tarde já visto, não o do atendimento anterior:
    // com um encaixe por cima da cadeira ocupada, o "anterior" termina antes do
    // que o engoliu e o buraco sairia negativo.
    let fimOcupado = ordenados[0]!.endAt.getTime();

    for (const a of ordenados.slice(1)) {
      const buraco = a.startAt.getTime() - fimOcupado;
      if (buraco >= minimoEmMs) {
        vaos.push({
          inicio: new Date(fimOcupado),
          fim: new Date(a.startAt.getTime()),
          minutos: Math.round(buraco / 60_000),
          staffId,
        });
      }
      fimOcupado = Math.max(fimOcupado, a.endAt.getTime());
    }
  }

  // Ordenado por horário porque é assim que a lista lê: a faixa tem que cair
  // entre os dois cartões que a criaram. O `staffId` desempata para a ordem não
  // variar entre renders.
  return vaos.sort(
    (x, y) => x.inicio.getTime() - y.inicio.getTime() || x.staffId.localeCompare(y.staffId),
  );
}

/** Um vão e os outros barbeiros que estão livres no mesmo instante. */
export type VaoLivreAgrupado = VaoLivre & {
  /** Do maior buraco para o menor. Vazio quando só um barbeiro está livre ali. */
  outros: { staffId: string; minutos: number }[];
};

/**
 * Uma faixa por instante, e não uma por barbeiro.
 *
 * A captura de 15/08/2026 mostrou "11:45 · 1 h 15 min livre com Tiago" logo
 * acima de "11:45 · 2 h 45 min livre com Dono E2E": duas linhas repetindo a
 * mesma hora para dizer a mesma notícia — às 11:45 tem cadeira vaga. O que
 * decide é o instante; o barbeiro é detalhe de quem atende.
 *
 * A cabeça do grupo é o **maior** buraco, porque é ele que responde "cabe o
 * serviço longo?". Os menores viram `outros` em vez de sumir: mandar um corte
 * de 30 min para a cadeira de 2 h 45 min quando havia uma de 1 h 15 min queima
 * o buraco grande à toa — o balcão precisa ver as duas para escolher.
 *
 * Vem depois de `recortarNoAgora` de propósito: o recorte alinha o início ao
 * passo de ±5, e é ele que faz dois buracos de horas diferentes começarem no
 * mesmo instante.
 */
export function agruparVaosLivres(vaos: VaoLivre[]): VaoLivreAgrupado[] {
  const porInstante = new Map<number, VaoLivre[]>();
  for (const vao of vaos) {
    const chave = vao.inicio.getTime();
    const grupo = porInstante.get(chave);
    if (grupo) grupo.push(vao);
    else porInstante.set(chave, [vao]);
  }

  const agrupados: VaoLivreAgrupado[] = [];
  for (const grupo of porInstante.values()) {
    // `staffId` desempata durações iguais para a cabeça — e portanto o clique —
    // não variar entre renders.
    const [maior, ...resto] = [...grupo].sort(
      (x, y) => y.minutos - x.minutos || x.staffId.localeCompare(y.staffId),
    );
    agrupados.push({
      ...maior!,
      outros: resto.map((v) => ({ staffId: v.staffId, minutos: v.minutos })),
    });
  }

  return agrupados.sort((x, y) => x.inicio.getTime() - y.inicio.getTime());
}

/**
 * Passo do mostrador de ±5 da folha de encaixe. A hora oferecida cai no mesmo
 * passo para o número da faixa e o do mostrador serem o mesmo número.
 *
 * Arredondar em instante, sem fuso, é seguro aqui: todo deslocamento de fuso em
 * uso é múltiplo de 15 minutos, então o múltiplo de 5 no relógio absoluto é
 * múltiplo de 5 no relógio de parede também.
 */
const PASSO_DO_MOSTRADOR_MS = 5 * 60_000;

/**
 * O que sobra dos vãos a partir de `agora` — e é aqui que a faixa deixa de
 * mentir a hora.
 *
 * `buildVaosLivres` é aritmética do dia inteiro e não conhece relógio. Quem
 * conhece é a tela, e ela tem duas coisas a resolver:
 *
 * 1. **Buraco que já fechou não vira faixa.** Encaixar às 10:30 quando são 14:00
 *    marcaria cliente no passado, e nada no servidor recusa isso — a agenda de
 *    ontem não oferece encaixe pelo mesmo motivo.
 * 2. **Buraco em curso é recortado, não descartado.** Às 10:15, com a cadeira
 *    livre das 10:00 às 12:00, o que está vago é 1 h 45 min a partir de agora —
 *    e essa é justamente a faixa mais útil do dia. Oferecer "10:00 · 2 h" seria
 *    errar a hora e o tamanho de uma vez.
 *
 * O piso é reaplicado depois do recorte: o que sobrou do buraco pode não caber
 * mais ninguém, e aí ele volta a ser ruído.
 */
export function recortarNoAgora(
  vaos: VaoLivre[],
  agora: Date,
  duracaoMinima: number,
): VaoLivre[] {
  const minimoEmMs = duracaoMinima * 60_000;
  const recortados: VaoLivre[] = [];

  for (const vao of vaos) {
    if (vao.inicio.getTime() >= agora.getTime()) {
      recortados.push(vao);
      continue;
    }

    // Para cima, ao contrário do `horaDeAgoraArredondada` do encaixe: lá o
    // cliente já sentou e a hora é passado recente de propósito; aqui a hora
    // ainda vai ser vendida, e arredondar para baixo a jogaria no passado.
    const inicio = Math.ceil(agora.getTime() / PASSO_DO_MOSTRADOR_MS) * PASSO_DO_MOSTRADOR_MS;
    const sobra = vao.fim.getTime() - inicio;
    if (sobra < minimoEmMs) continue;

    recortados.push({ ...vao, inicio: new Date(inicio), minutos: Math.round(sobra / 60_000) });
  }

  return recortados;
}

/** Hora (`HH:mm` no fuso da loja) e barbeiro que o dedo apontou. */
export type PedidoDeEncaixe = { hora: string; staffId: string };

/**
 * `pedido` é opcional porque nem todo chamador apontou uma hora: o estado vazio
 * do dia só quer abrir a folha, e quem decide a hora padrão dali é a própria
 * folha (`horaDeAgoraArredondada`). Copiar esse arredondamento aqui seria uma
 * segunda regra para a mesma pergunta.
 */
type Ouvinte = (pedido?: PedidoDeEncaixe) => void;
const ouvintes = new Set<Ouvinte>();

/**
 * O canal entre a faixa e a folha de encaixe.
 *
 * **Por que não é prop.** A folha (`ManualBookingForm`) mora na barra de data e
 * a faixa mora na lista: são irmãs debaixo de `agenda/page.tsx`, que é Server
 * Component e não guarda estado para ninguém. Levantar o estado exigiria um
 * provedor de cliente envolvendo a página inteira — muito mais peça para uma
 * mensagem de mão única, disparada por clique, que ninguém precisa ler depois.
 *
 * Nada fica guardado: clique sem ouvinte se perde, e é o certo — a folha está
 * montada sempre que a lista está.
 */
export function assinarPedidoDeEncaixe(ouvinte: Ouvinte): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

/**
 * O desvio do canal — **um canal só, com dois destinos possíveis**.
 *
 * A remarcação (§2.1 do plano de 15/08/2026) precisa exatamente do mesmo
 * recado que o encaixe: "o dedo apontou este vão". Um segundo canal para o
 * mesmo clique seria duas listas de ouvintes para a mesma pergunta — e, pior,
 * as duas responderiam: a `ManualBookingForm` assina este aqui e abriria a
 * folha de encaixe por cima da confirmação de remarcação.
 *
 * Por isso quem entra em modo remarcação registra um desvio. Enquanto ele
 * existe, o pedido vai para ele e **não** chega aos ouvintes de encaixe. Sair do
 * modo devolve o canal ao dono de sempre.
 *
 * Fica em `vao-livre.tsx`, e não em `remarcacao.tsx`, porque o dono do canal é
 * quem o publica; o modo continua sendo estado de `remarcacao.tsx`, que só
 * pendura e despendura a função daqui.
 */
let desvio: ((pedido: PedidoDeEncaixe) => void) | null = null;

export function desviarPedidoDeVao(destino: (pedido: PedidoDeEncaixe) => void): () => void {
  desvio = destino;
  return () => {
    if (desvio === destino) desvio = null;
  };
}

export function pedirEncaixe(pedido?: PedidoDeEncaixe): void {
  // Sem pedido é o botão "Encaixe" do dia vazio, não uma faixa: ele nunca vira
  // remarcação, porque não apontou hora nenhuma.
  if (pedido && desvio) {
    desvio(pedido);
    return;
  }
  for (const ouvinte of [...ouvintes]) ouvinte(pedido);
}

/**
 * **Faixa, não cartão**: altura de uma linha, borda tracejada, tinta secundária.
 * O vazio não pode competir com o que está marcado — ele é o convite, não o
 * assunto. Sem variante ainda: vão livre não tem estado nem tom, e a única
 * diferença de conteúdo (nomear ou não o barbeiro) é dado, não aparência.
 */
export const faixaDeVaoLivreVariants = cva(
  'flex w-full min-h-11 items-center gap-2 rounded-cx border px-3 text-left text-[14px] leading-5 hover:bg-superficie active:bg-superficie-2',
  {
    variants: {
      /**
       * `destino` é a faixa em modo remarcação: ela deixa de ser convite e passa
       * a ser onde o atendimento vai pousar. A borda fecha e a tinta sobe — e o
       * que diz o estado de verdade não é isso, é o nome acessível do botão, que
       * troca de "Encaixar às…" para "Remarcar Fulano para…". Estado que se lê
       * só por cor (ou só por borda) é defeito.
       */
      papel: {
        convite: 'border-dashed border-linha text-tinta-2',
        destino: 'border-solid border-tinta-2 text-tinta',
      },
    },
    defaultVariants: { papel: 'convite' },
  },
);

/** "A e B"; "A, B e C". O último separador é "e", como se fala. */
function juntarNomes(nomes: string[]): string {
  if (nomes.length <= 1) return nomes[0] ?? '';
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`;
}

/**
 * O texto da faixa, no mesmo idioma de separador do cartão e da linha de
 * próximos livres: "10:30 · 1 h 30 min livre com João".
 *
 * Com mais de um barbeiro livre no mesmo instante há dois casos, e a diferença
 * importa:
 *
 * - **Durações iguais** — "11:45 · 1 h 30 min livre com Tiago e Marcão". A
 *   duração é uma só; repeti-la por nome seria relatório.
 * - **Durações diferentes** — "11:45 · livre com Marcão (2 h 45 min) e Tiago
 *   (1 h 15 min)". O maior vem primeiro porque é ele que responde "cabe o
 *   serviço longo?", e o menor fica à vista porque é ele que evita queimar a
 *   cadeira grande com um corte de 30 minutos.
 */
function textoDaFaixa(
  hora: string,
  minutos: number,
  nomeDoBarbeiro: string | undefined,
  outros: { nome: string; minutos: number }[],
): string {
  if (nomeDoBarbeiro === undefined || outros.length === 0) {
    const comQuem = nomeDoBarbeiro ? ` com ${nomeDoBarbeiro}` : '';
    return `${hora} · ${formatDuration(minutos)} livre${comQuem}`;
  }

  if (outros.every((o) => o.minutos === minutos)) {
    return `${hora} · ${formatDuration(minutos)} livre com ${juntarNomes([
      nomeDoBarbeiro,
      ...outros.map((o) => o.nome),
    ])}`;
  }

  return `${hora} · livre com ${juntarNomes([
    `${nomeDoBarbeiro} (${formatDuration(minutos)})`,
    ...outros.map((o) => `${o.nome} (${formatDuration(o.minutos)})`),
  ])}`;
}

export type FaixaDeVaoLivreProps = Omit<ComponentProps<'li'>, 'children'> & {
  vao: VaoLivre;
  /** Ausente com um barbeiro só: repetir o nome dele em toda faixa não informa nada. */
  nomeDoBarbeiro?: string;
  /**
   * Os outros barbeiros livres no mesmo instante, do maior buraco para o menor.
   * Quem resolve nome é a lista, que já tem o mapa de `staffId` → nome; aqui só
   * chega o que vai virar texto.
   */
  outrosBarbeiros?: { nome: string; minutos: number }[];
  timeZone: string;
  /**
   * Nome de quem está sendo remarcado, quando o modo está ligado. Presente ⇒ a
   * faixa é destino, e o clique cai no desvio do canal em vez de abrir a folha
   * de encaixe.
   */
  remarcandoPara?: string;
};

export function FaixaDeVaoLivre({
  vao,
  nomeDoBarbeiro,
  outrosBarbeiros = [],
  timeZone,
  remarcandoPara,
  className,
  ...resto
}: FaixaDeVaoLivreProps) {
  const hora = formatTime(vao.inicio, timeZone);
  const texto = textoDaFaixa(hora, vao.minutos, nomeDoBarbeiro, outrosBarbeiros);
  const destino = remarcandoPara !== undefined;

  return (
    <li data-slot="vao-livre" className={cn('px-3 py-1', className)} {...resto}>
      {/* `<button>` de verdade, nunca `<div onClick>`: o vazio clicável precisa
          receber Tab, responder a Enter e ser anunciado como ação. O nome
          acessível começa pelo verbo — quem ouve "1 h 30 min livre" sem ele não
          sabe que aquilo abre alguma coisa — e **contém o texto visível inteiro**
          (WCAG 2.5.3): quem comanda por voz fala o que está escrito na tela, e um
          nome que só cruza em pedaços não casa com o que ele falou. */}
      <button
        type="button"
        data-slot="vao-livre-acao"
        // O verbo troca junto com o papel: em modo remarcação este botão não
        // encaixa ninguém novo, move quem já estava marcado — e quem ouve o
        // rótulo precisa saber disso antes de apertar.
        aria-label={destino ? `Remarcar ${remarcandoPara} para ${texto}` : `Encaixar às ${texto}`}
        className={cn(faixaDeVaoLivreVariants({ papel: destino ? 'destino' : 'convite' }))}
        onClick={() => pedirEncaixe({ hora, staffId: vao.staffId })}
      >
        {destino ? (
          <CalendarClock aria-hidden="true" className="size-4 shrink-0" />
        ) : (
          <Plus aria-hidden="true" className="size-4 shrink-0" />
        )}
        {/* Com um barbeiro a frase cabe numa linha e `truncate` protege o
            layout de um nome absurdo. Com dois ela passa de 50 caracteres e
            cortar esconderia justamente o segundo nome — aí ela quebra, e o
            `min-h-11` já reserva a altura. */}
        <span className={outrosBarbeiros.length > 0 ? 'min-w-0 break-words' : 'truncate'}>
          {texto}
        </span>
      </button>
    </li>
  );
}
