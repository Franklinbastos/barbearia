'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { executarAcao } from '@/components/action-error';
import { ErroDeAcao } from '@/components/erro-de-acao';
import { Botao } from '@/components/ui/botao';
import { FolhaInferior } from '@/components/ui/folha-inferior';
import { formatAppointmentStatus, formatPrice, formatTime } from '@/lib/format';
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
 */

/** Só depois disso um "não veio" é possível — antes, o botão nem existe. */
const MINUTOS_ATE_PODER_FALTAR = 10;

/** Janela do "Desfazer" logo depois de mexer no estado. */
const SEGUNDOS_DE_DESFAZER = 20;

export type CartaoDaAgendaProps = {
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

const COR_DO_ESTADO: Record<string, { texto: string; fundo: string }> = {
  DONE: { texto: 'var(--ok)', fundo: 'var(--bg)' },
  NO_SHOW: { texto: 'var(--perigo)', fundo: 'var(--bg)' },
  CANCELED: { texto: 'var(--tinta-3)', fundo: 'var(--bg)' },
};

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

export function CartaoDaAgenda({ item, timeZone, corDoBarbeiro, agora }: CartaoDaAgendaProps) {
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
  const podeFaltar =
    agora.getTime() >= item.startAt.getTime() + MINUTOS_ATE_PODER_FALTAR * 60_000;
  const corDoBadge = COR_DO_ESTADO[item.status];

  return (
    <li
      className="px-3 py-2.5"
      style={{
        minHeight: 76,
        background: pele.fundo,
        borderLeft: `4px solid ${pele.aresta}`,
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
          <div className="flex items-start gap-2">
            <span
              className="min-w-0 flex-1 truncate text-[17px] leading-[22px] font-bold"
              style={cancelado ? { textDecoration: 'line-through', color: 'var(--tinta-3)' } : undefined}
            >
              {item.customerName}
            </span>
            {item.origin === 'PANEL' ? (
              <span
                className="shrink-0 px-1 text-[11px] leading-[14px] font-bold uppercase"
                style={{
                  background: 'var(--alerta-bg)',
                  border: '1px solid var(--alerta)',
                  borderRadius: 'var(--r)',
                  color: 'var(--tinta)',
                }}
              >
                Encaixe
              </span>
            ) : null}
            {corDoBadge ? (
              <span
                className="shrink-0 px-1 text-[11px] leading-[14px] font-bold uppercase"
                style={{
                  background: corDoBadge.fundo,
                  border: `1px solid ${corDoBadge.texto}`,
                  borderRadius: 'var(--r)',
                  color: corDoBadge.texto,
                }}
              >
                {formatAppointmentStatus(item.status)}
              </span>
            ) : null}
          </div>

          <div className="text-[14px] leading-5 text-tinta-2">
            {item.serviceName} · {formatPrice(item.servicePriceCents)} ·{' '}
            <strong className="font-bold text-tinta">{item.staffName}</strong>
          </div>

          <a
            href={`tel:${item.customerPhone}`}
            className="inline-flex min-h-11 items-center text-[14px] leading-5"
          >
            {item.customerPhone}
          </a>
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
        <div
          className="mt-2 grid gap-2"
          style={{ gridTemplateColumns: podeFaltar ? '1fr 1fr 44px' : '1fr 44px' }}
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
          <Botao
            variante="secundario"
            aria-label="Mais ações"
            className="px-0"
            onClick={() => setFolhaAberta(true)}
          >
            ⋯
          </Botao>
        </div>
      ) : (
        <div className="mt-2 flex justify-end">
          <Botao
            variante="secundario"
            aria-label="Mais ações"
            className="min-h-11 px-0"
            style={{ width: 44 }}
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
