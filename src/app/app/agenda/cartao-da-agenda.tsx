'use client';

import Link from 'next/link';
import { cva } from 'class-variance-authority';
import { useEffect, useRef, useState, useTransition, type ComponentProps } from 'react';
import { executarAcao } from '@/components/action-error';
import { ErroDeAcao } from '@/components/erro-de-acao';
import { Badge } from '@/components/ui/badge';
import { Botao } from '@/components/ui/botao';
import { FolhaInferior } from '@/components/ui/folha-inferior';
import {
  formatAppointmentStatus,
  formatPrice,
  formatTime,
  type AppointmentStatus,
} from '@/lib/format';
import { telefoneParaWaMe } from '@/lib/telefone';
import { cn } from '@/lib/utils';
import { VARIANTE_DO_ESTADO } from '../tom-do-estado';
import { reopenAppointmentAction, setAppointmentStatusAction } from './actions';
import type { AgendaItem } from './day-grid';

/**
 * O objeto mais importante do produto: uma linha da agenda do dia.
 *
 * Duas decisões vieram do balcão e não são negociáveis:
 *
 * 1. **Tinta de estado na linha inteira, nunca opacidade.** O `opacity: 0.5` de
 *    antes apagava o telefone junto com o resto — e o telefone é justamente o
 *    que se procura num horário que deu errado.
 * 2. **"Compareceu" e "Não veio" na própria linha, com 52px.** "Cancelar" sai
 *    da linha e vai para a folha do "⋯": os três botões colados faziam o polegar
 *    cancelar quem tinha acabado de sentar na cadeira.
 *
 * **Por que não há toast aqui.** O plano da migração previa o `sonner` para
 * confirmar o "Compareceu" com um "Desfazer" ao lado. Ele foi trazido pelo CLI,
 * medido e devolvido, por três motivos:
 *
 * 1. o **P5 da direção de UI proíbe toast no painel** com todas as letras —
 *    "feedback no lugar do dedo, nunca toast; toast é para quem está olhando a
 *    tela inteira, e aqui ninguém está";
 * 2. a confirmação que o toast traria **já existe duas vezes**: a linha troca de
 *    cor debaixo do polegar (`peleDoEstado`) e o "Desfazer" de 20s da §5.7.9
 *    ocupa o lugar das ações logo abaixo — o segundo caminho de volta seria um
 *    "Desfazer" competindo com o outro;
 * 3. o `sonner` puxa o `next-themes`, cujo provedor este projeto não monta, e o
 *    `<Toaster />` no layout raiz desceria junto com a página pública, que
 *    precisa abrir em 3G na porta da barbearia.
 *
 * **O que mudou em 14/08/2026, quando o dono disse que a tela estava feia.** O
 * diagnóstico não foi o formato de lista — foi ruído. Três mudanças, todas no
 * cartão:
 *
 * 1. **A ação recolhe onde há ponteiro** (ver `ACOES_RECOLHEM`). Num dia de
 *    vinte atendimentos eram quarenta botões de ~400px empilhados no bloco de
 *    880px, e a informação sumia no meio deles. No celular nada muda: lá os
 *    botões são o motivo de a tela existir.
 * 2. **A forma sai da duração** (ver `formaDoCartao`). Um corte de 20 min e uma
 *    barba de 1h ocupavam a mesma altura — o tempo, que é o assunto da tela, não
 *    aparecia em lugar nenhum.
 * 3. **O estado se lê por forma** (ver `CONTORNO_DO_ESTADO`), porque a cor já é
 *    identidade do barbeiro e não pode carregar dois significados.
 */

/**
 * **O que este arquivo exporta para a linha do desktop.** Desde 15/08/2026 o
 * mesmo atendimento é desenhado duas vezes: aqui no cartão do celular e em
 * `linha-da-agenda.tsx`, em colunas, no desktop. Dois layouts é o preço aceito
 * (o Outlook e o Todoist pagam o mesmo); duas verdades não é. Então tudo que é
 * **regra** — quanto dura, quando cabe um "não veio", que contorno cada estado
 * tem, quem ganha etiqueta — mora aqui, exportado, e a linha importa. O que fica
 * em cada arquivo é só a arrumação visual.
 */

/** Só depois disso um "não veio" é possível — antes, o botão nem existe. */
const MINUTOS_ATE_PODER_FALTAR = 10;

/** A duração do atendimento em minutos: a conta que a forma do cartão e a coluna
 *  de hora da linha faziam cada uma por conta própria. */
export function duracaoEmMinutos(item: { startAt: Date; endAt: Date }): number {
  return (item.endAt.getTime() - item.startAt.getTime()) / 60_000;
}

/** Se o "Não veio" já pode ser oferecido para este atendimento, agora. */
export function jaPodeFaltar(item: { startAt: Date }, agora: Date): boolean {
  return agora.getTime() >= item.startAt.getTime() + MINUTOS_ATE_PODER_FALTAR * 60_000;
}

/** Janela do "Desfazer" logo depois de mexer no estado. */
const SEGUNDOS_DE_DESFAZER = 20;

/**
 * A forma sai da **duração**, e não da altura renderizada — é o `displayType` do
 * Cal.com. Decidir pelo conteúdo aguenta mudança de densidade; decidir pela
 * altura obriga a medir o DOM e volta a errar quando a fonte ou o zoom muda.
 *
 * Os cortes são os da spec: abaixo de 40 min o atendimento cabe numa linha, até
 * 45 min em duas, e o que passa disso fica com a linha completa de hoje. É a
 * régua que separa um corte rápido de uma barba — a diferença que o dono lê de
 * longe sem precisar de eixo de tempo na tela.
 */
const MINUTOS_DO_CARTAO_CURTO = 40;
const MINUTOS_DO_CARTAO_MEDIO = 45;

export type FormaDoCartao = 'compacto' | 'medio' | 'completo';

export function formaDoCartao(item: { startAt: Date; endAt: Date }): FormaDoCartao {
  const minutos = duracaoEmMinutos(item);
  if (minutos < MINUTOS_DO_CARTAO_CURTO) return 'compacto';
  if (minutos <= MINUTOS_DO_CARTAO_MEDIO) return 'medio';
  return 'completo';
}

/**
 * Estado por **forma**, não por cor. A cor da aresta de 4px já é a identidade de
 * quem atende (§3.5) e não pode virar status também; a §3.6 já reserva o
 * tracejado para "vazio", que é exatamente o que estes dois estados são — o
 * horário existiu e ninguém sentou na cadeira. `DONE` e `BOOKED` ficam cheios: um
 * aconteceu, o outro ainda vai acontecer.
 *
 * A etiqueta de estado continua na linha. O que muda é que agora o estado se lê
 * sem ela e sem cor nenhuma — a regra que `tom-do-estado.ts` fecha com "cor
 * nunca é o único portador".
 */
export const CONTORNO_DO_ESTADO = {
  BOOKED: 'cheio',
  DONE: 'cheio',
  NO_SHOW: 'tracejado',
  CANCELED: 'tracejado',
} as const satisfies Record<AppointmentStatus, 'cheio' | 'tracejado'>;

/**
 * O `group` da raiz é o que faz `group-hover` e `group-focus-within` existirem
 * lá embaixo: tirar essa classe daqui é recolher a ação e nunca mais mostrá-la.
 */
export const cartaoDaAgendaVariants = cva('group border-l-4 px-3', {
  variants: {
    forma: {
      // A altura mínima é o único lugar em que a duração vira tamanho. Escala de
      // 4px: 56, 68 e os 76px que o cartão sempre teve (§5.7, item 7).
      compacto: 'min-h-14 py-2',
      medio: 'min-h-17 py-2.5',
      completo: 'min-h-19 py-2.5',
    },
    contorno: {
      cheio: 'border-solid',
      tracejado: 'border-dashed',
    },
  },
  defaultVariants: { forma: 'completo', contorno: 'cheio' },
});

/**
 * Onde há ponteiro fino, a linha em repouso mostra só informação e as ações
 * aparecem no hover **ou** no foco de teclado. Três coisas aqui não são gosto:
 *
 * 1. **`opacity` + `pointer-events`, nunca `display:none` nem remoção do DOM.**
 *    O botão continua na ordem de tabulação e no leitor de tela, e o espaço fica
 *    reservado — a linha não salta quando ele aparece.
 * 2. **`group-focus-within` junto com `group-hover`, sempre os dois.** Ação que
 *    só existe no ponteiro não existe para quem navega por Tab. As duas regras
 *    revelam por seletor mais específico que o de esconder, então vencem sem
 *    depender da ordem em que o Tailwind imprime as classes.
 * 3. **A condição de esconder é a MESMA de revelar: `(hover: hover)`, e não só a
 *    largura.** Um tablet de 800px passa no `md:` e não tem hover nenhum; sem
 *    essa guarda, "Compareceu" ficaria inalcançável justamente em quem só tem o
 *    dedo. `md:group-hover:` já compila dentro de `@media (hover: hover)` — usar
 *    a mesma consulta para esconder é o que garante que não sobra aparelho em
 *    que a ação some e nada a traz de volta. `pointer-fine` cobriria o tablet,
 *    mas deixaria de fora o aparelho de ponteiro fino sem hover (caneta), onde
 *    "Compareceu" não tem segundo caminho: a folha do "⋯" não o carrega.
 */
const ACOES_RECOLHEM = [
  'transition-opacity motion-reduce:transition-none',
  'md:[@media(hover:hover)]:opacity-0 md:[@media(hover:hover)]:pointer-events-none',
  'md:group-hover:opacity-100 md:group-hover:pointer-events-auto',
  'md:group-focus-within:opacity-100 md:group-focus-within:pointer-events-auto',
].join(' ');

export type CartaoDaAgendaProps = ComponentProps<'li'> & {
  item: AgendaItem;
  timeZone: string;
  /** String CSS pronta, de `cores-de-barbeiro.ts`. */
  corDoBarbeiro: string;
  /** Injetado pelo pai: UM `setInterval` de 60s alimenta a lista inteira. */
  agora: Date;
};

type Pele = { fundo: string; aresta: string; corDaHora: string };

function peleDoEstado(item: AgendaItem, agora: Date, corDoBarbeiro: string): Pele {
  switch (item.status) {
    case 'DONE':
      return { fundo: 'var(--ok-bg)', aresta: 'var(--ok)', corDaHora: 'var(--tinta)' };
    case 'NO_SHOW':
      return { fundo: 'var(--perigo-bg)', aresta: 'var(--perigo)', corDaHora: 'var(--tinta)' };
    case 'CANCELED':
      return { fundo: 'var(--superficie)', aresta: 'var(--perigo)', corDaHora: 'var(--tinta-3)' };
    default: {
      // Estado ganha do barbeiro só nos três finais; enquanto está agendado, a
      // aresta continua sendo quem atende — que é o que se lê de relance.
      const acontecendoAgora =
        agora.getTime() >= item.startAt.getTime() && agora.getTime() < item.endAt.getTime();
      return {
        fundo: acontecendoAgora ? 'var(--agora-bg)' : 'var(--bg)',
        aresta: corDoBarbeiro,
        corDaHora: acontecendoAgora ? 'var(--agora)' : 'var(--tinta)',
      };
    }
  }
}

/**
 * "Agendado" não ganha etiqueta, e é de propósito: o cartão de um horário que
 * ainda não aconteceu é a maioria do dia, e uma etiqueta em toda linha não
 * distingue nada. Só os três desfechos aparecem.
 */
export function estadoNaEtiquetaDe(status: AppointmentStatus) {
  return status === 'BOOKED' ? null : status;
}

/**
 * Confirmação em dois tempos para o "Cancelar" da folha.
 *
 * É o mesmo gesto do `<BotaoDeConfirmacao>` desenhado na §4.3 — enquanto aquele
 * componente não existe no repositório, a folha carrega a sua própria versão
 * mínima em vez de um `confirm()` do navegador.
 */
function CancelarEmDoisTempos({
  pendente,
  aoConfirmar,
}: {
  pendente: boolean;
  aoConfirmar: () => void;
}) {
  const [armado, setArmado] = useState(false);

  useEffect(() => {
    if (!armado) return;
    const t = setTimeout(() => setArmado(false), 4000);
    return () => clearTimeout(t);
  }, [armado]);

  return (
    <div aria-live="polite">
      <Botao
        variante={armado ? 'perigo' : 'perigo-vazado'}
        largura="total"
        pendente={pendente}
        rotuloPendente="Cancelando…"
        onClick={() => (armado ? aoConfirmar() : setArmado(true))}
      >
        {armado ? 'Confirmar cancelamento' : 'Cancelar'}
      </Botao>
    </div>
  );
}

export function CartaoDaAgenda({
  item,
  timeZone,
  corDoBarbeiro,
  agora,
  className,
  ...resto
}: CartaoDaAgendaProps) {
  const [pendente, iniciarTransicao] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [folhaAberta, setFolhaAberta] = useState(false);
  const [mostrandoDesfazer, setMostrandoDesfazer] = useState(false);
  const [avisoDaFolha, setAvisoDaFolha] = useState<string | null>(null);
  const relogioDoDesfazer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (relogioDoDesfazer.current) clearTimeout(relogioDoDesfazer.current);
  }, []);

  function abrirJanelaDeDesfazer() {
    setMostrandoDesfazer(true);
    if (relogioDoDesfazer.current) clearTimeout(relogioDoDesfazer.current);
    relogioDoDesfazer.current = setTimeout(
      () => setMostrandoDesfazer(false),
      SEGUNDOS_DE_DESFAZER * 1000,
    );
  }

  function marcar(status: 'DONE' | 'NO_SHOW' | 'CANCELED') {
    setErro(null);
    iniciarTransicao(async () => {
      let deuCerto = true;
      await executarAcao(
        () => setAppointmentStatusAction(item.id, status),
        (mensagem) => {
          deuCerto = false;
          setErro(mensagem);
        },
      );
      // Cancelar não entra na janela de "Desfazer": o horário volta para a
      // grade pública no mesmo instante e pode ser revendido antes dos 20s.
      if (deuCerto && status !== 'CANCELED') abrirJanelaDeDesfazer();
      if (deuCerto) setFolhaAberta(false);
    });
  }

  function reabrir() {
    setErro(null);
    iniciarTransicao(async () => {
      await executarAcao(() => reopenAppointmentAction(item.id), setErro);
      setMostrandoDesfazer(false);
      setFolhaAberta(false);
    });
  }

  async function copiarTelefone() {
    try {
      await navigator.clipboard.writeText(item.customerPhone);
      setAvisoDaFolha('Telefone copiado.');
    } catch {
      setAvisoDaFolha('Não foi possível copiar. Toque em "Ligar para o cliente".');
    }
  }

  const pele = peleDoEstado(item, agora, corDoBarbeiro);
  const cancelado = item.status === 'CANCELED';
  const finalizado = item.status === 'DONE' || item.status === 'NO_SHOW';
  const podeFaltar = jaPodeFaltar(item, agora);
  const estadoNaEtiqueta = estadoNaEtiquetaDe(item.status);
  const forma = formaDoCartao(item);

  /**
   * O "⋯" nomeia o cliente porque agora ele carrega muito mais: no desktop é a
   * única afordância da linha em repouso, e no cartão curto é o único caminho
   * para o telefone. Num dia de vinte atendimentos, vinte botões chamados só
   * "Mais ações" deixam quem usa leitor de tela sem saber de quem é cada um.
   */
  const rotuloDoMais = `Mais ações para ${item.customerName}`;

  /** "Corte · R$ 40,00 · **Marcão**", a linha que o cartão curto puxa para cima. */
  const servicoPrecoBarbeiro = (
    <>
      {item.serviceName} · {formatPrice(item.servicePriceCents)} ·{' '}
      <strong className="font-bold text-tinta">{item.staffName}</strong>
    </>
  );

  return (
    <li
      {...resto}
      data-slot="cartao-da-agenda"
      data-forma={forma}
      className={cn(
        cartaoDaAgendaVariants({ forma, contorno: CONTORNO_DO_ESTADO[item.status] }),
        className,
      )}
      style={{
        background: pele.fundo,
        borderLeftColor: pele.aresta,
        // O traço é do cartão, não da lista: a divisória de 1px entre linhas
        // (`.lista > li`) continua cheia, senão o dia inteiro parece picotado.
        borderBottomStyle: 'solid',
      }}
    >
      <div className="grid grid-cols-[64px_1fr] gap-x-3">
        <div>
          <div
            className="text-[20px] leading-6 font-extrabold"
            style={{ color: pele.corDaHora }}
          >
            {formatTime(item.startAt, timeZone)}
          </div>
          <div className="text-[13px] leading-4 text-tinta-3">
            {formatTime(item.endAt, timeZone)}
          </div>
        </div>

        <div className="min-w-0">
          {/* Só o cartão curto quebra linha, e só ele precisa da folga vertical.
              As outras formas ficam com a linha única de sempre: nome à
              esquerda, etiquetas encostadas na direita. */}
          <div
            className={cn(
              'flex gap-x-2',
              forma === 'compacto' ? 'flex-wrap items-baseline gap-y-1' : 'items-start',
            )}
          >
            <span
              data-slot="nome-do-cliente"
              className={cn(
                'min-w-0 truncate text-[17px] leading-[22px] font-bold',
                // `flex-1` é base zero: o nome entrega toda a largura ao vizinho
                // e vira "Marc…". No cartão curto ele mede o próprio conteúdo e
                // só para de crescer a partir de `sm`, que é onde o serviço
                // passa a caber ao lado. Abaixo disso o serviço desce sozinho —
                // quem some da linha é a largura, nunca a informação. O corte é
                // `sm` e não `md` de propósito: a pergunta aqui é se cabe, não
                // que aparelho é.
                forma === 'compacto' ? 'grow sm:grow-0' : 'flex-1',
                // Riscar o nome é o que faz o cancelado se ler sem cor nenhuma.
                cancelado && 'text-tinta-3 line-through',
              )}
            >
              {item.customerName}
            </span>
            {/* As duas etiquetas eram desenho à mão: 11px, peso 700, versal e
                `borderRadius: var(--r)`. Com o raio em 10px elas viraram pílula
                torta, e a lib já tem a forma certa — o `Badge` do base-nova é
                `h-5`, `rounded-4xl` e `text-xs`, então aqui só entra o
                `shrink-0` que a linha precisa para não espremer o nome. */}
            {item.origin === 'PANEL' ? (
              <Badge variant="secondary" className="shrink-0">
                Encaixe
              </Badge>
            ) : null}
            {estadoNaEtiqueta ? (
              <Badge variant={VARIANTE_DO_ESTADO[estadoNaEtiqueta]} className="shrink-0">
                {formatAppointmentStatus(estadoNaEtiqueta)}
              </Badge>
            ) : null}
            {/* O serviço vem DEPOIS das etiquetas de propósito. A quebra de
                linha do flex respeita a ordem: pondo o serviço antes, é a
                etiqueta que desce sozinha e o cartão curto ganha uma terceira
                linha — o contrário do que ele existe para fazer. */}
            {forma === 'compacto' ? (
              <span
                data-slot="servico-na-linha-do-nome"
                className="min-w-0 truncate text-[14px] leading-5 text-tinta-2 sm:grow"
              >
                {servicoPrecoBarbeiro}
              </span>
            ) : null}
          </div>

          {forma === 'compacto' ? null : (
            <div className="text-[14px] leading-5 text-tinta-2">{servicoPrecoBarbeiro}</div>
          )}

          {/* O telefone é a terceira linha, e é ela que separa o cartão completo
              do médio. Fora dele o número não se perde: mora na folha do "⋯",
              com "Ligar para o cliente" e "Copiar telefone". */}
          {forma === 'completo' ? (
            <a
              href={`tel:${item.customerPhone}`}
              className="inline-flex min-h-11 items-center text-[14px] leading-5"
            >
              {item.customerPhone}
            </a>
          ) : null}
        </div>
      </div>

      {mostrandoDesfazer ? (
        <div className="mt-2">
          <Botao
            variante="secundario"
            largura="total"
            className="min-h-11"
            pendente={pendente}
            rotuloPendente="Desfazendo…"
            onClick={reabrir}
          >
            Desfazer
          </Botao>
        </div>
      ) : item.status === 'BOOKED' ? (
        <div className="mt-2 flex gap-2">
          {/* Os dois verbos recolhem; o "⋯" fica. É um alvo de 44px contra os
              ~400px de cada verbo, e é o único caminho para o telefone e para o
              "Cancelar" — some ele no repouso e a linha em desktop fica sem
              nenhuma afordância. */}
          <div
            data-slot="acoes-do-cartao"
            className={cn('grid flex-1 gap-2', ACOES_RECOLHEM)}
            style={{ gridTemplateColumns: podeFaltar ? '1fr 1fr' : '1fr' }}
          >
            <Botao
              variante="ok"
              pendente={pendente}
              rotuloPendente="Salvando…"
              onClick={() => marcar('DONE')}
            >
              Compareceu
            </Botao>
            {podeFaltar ? (
              <Botao
                variante="perigo-vazado"
                pendente={pendente}
                rotuloPendente="Salvando…"
                onClick={() => marcar('NO_SHOW')}
              >
                Não veio
              </Botao>
            ) : null}
          </div>
          <Botao
            variante="secundario"
            aria-label={rotuloDoMais}
            className="w-11 shrink-0 px-0"
            onClick={() => setFolhaAberta(true)}
          >
            ⋯
          </Botao>
        </div>
      ) : (
        <div className="mt-2 flex justify-end">
          <Botao
            variante="secundario"
            aria-label={rotuloDoMais}
            className="min-h-11 w-11 px-0"
            onClick={() => setFolhaAberta(true)}
          >
            ⋯
          </Botao>
        </div>
      )}

      {/* Um alerta só: com a folha aberta o aviso vive dentro dela, senão o
          leitor de tela ouviria a mesma frase duas vezes. */}
      {folhaAberta ? null : <ErroDeAcao mensagem={erro} />}

      <FolhaInferior
        aberta={folhaAberta}
        titulo={`${formatTime(item.startAt, timeZone)} · ${item.customerName}`}
        aoFechar={() => {
          setFolhaAberta(false);
          setAvisoDaFolha(null);
        }}
      >
        <div className="flex flex-col gap-3">
          <a href={`tel:${item.customerPhone}`} className="btn btn--sec btn--tot">
            Ligar para o cliente
          </a>
          <Botao variante="secundario" largura="total" onClick={copiarTelefone}>
            Copiar telefone
          </Botao>

          <a
            href={`https://wa.me/${telefoneParaWaMe(item.customerPhone)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn--sec btn--tot"
          >
            Abrir no WhatsApp
          </a>

          <Link href={`/app/clientes/${item.customerId}`} className="btn btn--sec btn--tot">
            Ver ficha do cliente
          </Link>

          {finalizado ? (
            <Botao
              variante="secundario"
              largura="total"
              pendente={pendente}
              rotuloPendente="Reabrindo…"
              onClick={reabrir}
            >
              Reabrir (voltar para agendado)
            </Botao>
          ) : null}

          <p role="status" className="text-[14px] leading-5 text-tinta-2">
            {avisoDaFolha}
          </p>

          {item.status === 'BOOKED' ? (
            <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--linha)' }}>
              <CancelarEmDoisTempos pendente={pendente} aoConfirmar={() => marcar('CANCELED')} />
            </div>
          ) : null}

          <ErroDeAcao mensagem={erro} />
        </div>
      </FolhaInferior>
    </li>
  );
}
