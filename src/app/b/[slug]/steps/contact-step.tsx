'use client';

import { useState } from 'react';
import {
  formatDayLabelLong,
  formatDuration,
  formatPrice,
  formatTime,
  isoDateInZone,
} from '@/lib/format';
import { aplicarMascaraTelefone } from '@/lib/telefone';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { ErroDeAcao } from '@/components/erro-de-acao';
import type { Resultado } from '../types';

/** Onde o contato do cliente recorrente fica guardado neste aparelho. */
const CHAVE_DO_CONTATO = 'barbearia:contato';

export type ContatoGuardado = { nome?: string; telefone?: string };

/**
 * Contato de quem já marcou nesta barbearia, deste aparelho.
 *
 * O `autoComplete` do navegador falha na WebView do WhatsApp e do Instagram,
 * que é justamente de onde o cliente vem — sem isto ele redigita nome e
 * telefone a cada corte.
 */
export function lerContatoGuardado(): ContatoGuardado | null {
  if (typeof window === 'undefined') return null;

  try {
    const cru = window.localStorage.getItem(CHAVE_DO_CONTATO);
    if (!cru) return null;
    const lido: unknown = JSON.parse(cru);
    if (typeof lido !== 'object' || lido === null) return null;
    return lido as ContatoGuardado;
  } catch {
    // Modo anônimo do iOS lança ao ler o localStorage. Pré-preencher é um
    // conforto, nunca um requisito: sem ele o formulário continua inteiro.
    return null;
  }
}

function guardarContato(contato: ContatoGuardado) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(CHAVE_DO_CONTATO, JSON.stringify(contato));
  } catch {
    /* idem */
  }
}

/**
 * Etapa 4: contato e confirmação (§5.5 da direção de UI).
 *
 * Nome e telefone **não** moram aqui: são estado do `BookingWizard`. Este passo
 * é desmontado quando o 409 devolve o cliente à grade, e com os campos no
 * estado local ele voltava com os dois em branco — na hora exata em que já
 * tinha perdido o horário.
 */
export function ContactStep({
  slug,
  serviceId,
  serviceName,
  staffId,
  staffName,
  startAt,
  durationMinutes,
  priceCents,
  timeZone,
  whatsappConfigurado,
  nome,
  telefone,
  contatoDoAparelho,
  aoTrocarNome,
  aoTrocarTelefone,
  onDone,
  onSlotTaken,
  onVoltar,
}: {
  slug: string;
  serviceId: string;
  serviceName: string;
  staffId?: string;
  staffName?: string;
  startAt: string;
  durationMinutes: number;
  priceCents: number;
  timeZone: string;
  whatsappConfigurado: boolean;
  nome: string;
  telefone: string;
  /** Os campos vieram do `localStorage`, e não da mão do cliente agora. */
  contatoDoAparelho: boolean;
  aoTrocarNome: (valor: string) => void;
  aoTrocarTelefone: (valor: string) => void;
  onDone: (resultado: Resultado) => void;
  onSlotTaken: (message: string) => void;
  onVoltar: () => void;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  /** Enquanto o cliente não mexer, o que está na tela veio do aparelho dele. */
  const [mexeu, setMexeu] = useState(false);
  const [limpou, setLimpou] = useState(false);

  const mostrarLimpar = contatoDoAparelho && !mexeu && !limpou;

  function limparContato() {
    aoTrocarNome('');
    aoTrocarTelefone('');
    setLimpou(true);
    guardarContato({});
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);

    try {
      const res = await fetch(`/api/public/${slug}/appointments`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ serviceId, staffId, startAt, name: nome, phone: telefone }),
      });

      if (res.status === 409) {
        const { message } = await res.json();
        onSlotTaken(message);
        return;
      }

      if (!res.ok) {
        const { message } = await res.json();
        setErro(message ?? 'Não foi possível confirmar o agendamento');
        return;
      }

      const resultado: Resultado = await res.json();
      guardarContato({ nome, telefone });
      onDone(resultado);
    } catch {
      setErro('Não foi possível confirmar. Verifique sua conexão e tente de novo.');
    } finally {
      setEnviando(false);
    }
  }

  const dia = formatDayLabelLong(isoDateInZone(startAt, timeZone), timeZone);
  const diaComMaiuscula = dia.charAt(0).toUpperCase() + dia.slice(1);

  return (
    <section>
      <Botao variante="texto" onClick={onVoltar}>
        <span aria-hidden="true">←</span> Voltar
      </Botao>

      <h2 className="mt-4 mb-3 text-[22px] leading-7 font-bold">
        <span aria-hidden="true" className="mb-2 block h-[3px] w-8 bg-marca" />
        Seus dados
      </h2>

      {/*
        Bloco de compromisso (§5.5): a única dúvida real desta tela é "é isso
        mesmo que eu marquei?", e ela se responde aqui em vez de custar uma tela
        de revisão. A aresta em `--marca` não cabe na API do `<Bloco>`, então a
        classe é usada crua só neste ponto.
      */}
      <div
        className="bloco relative"
        style={{ padding: '12px 14px', borderLeftColor: 'var(--marca)' }}
      >
        <p className="pr-20 text-base leading-6 text-tinta-2">
          {diaComMaiuscula} ·{' '}
          <strong className="text-[28px] leading-8 font-extrabold text-tinta">
            {formatTime(startAt, timeZone)}
          </strong>
        </p>
        <p className="text-base leading-6 text-tinta-2">
          {serviceName} · {formatDuration(durationMinutes)}
        </p>
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-base leading-6 text-tinta-2">
            {staffName ? `com ${staffName}` : 'com o primeiro barbeiro livre'}
          </p>
          <p className="text-lg leading-6 font-bold text-tinta">{formatPrice(priceCents)}</p>
        </div>

        <div className="absolute top-1 right-1">
          <Botao variante="texto" onClick={onVoltar}>
            Trocar
          </Botao>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
        <Campo rotulo="Seu nome">
          <input
            value={nome}
            onChange={(e) => {
              setMexeu(true);
              aoTrocarNome(e.target.value);
            }}
            autoComplete="name"
            required
            minLength={2}
            maxLength={80}
          />
        </Campo>

        <Campo rotulo="Telefone">
          {/* A página pública é de celular: sem `type`/`inputMode` de telefone o
              teclado abre alfabético e o cliente digita número letra por letra. */}
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={telefone}
            onChange={(e) => {
              setMexeu(true);
              aoTrocarTelefone(aplicarMascaraTelefone(e.target.value));
            }}
            placeholder="(00) 00000-0000"
            required
          />
        </Campo>

        {mostrarLimpar ? (
          <div>
            {/* Dentro do formulário, botão sem `type` é botão de envio: sem
                isto, "Limpar" mandava o agendamento. */}
            <Botao type="button" variante="texto" onClick={limparContato}>
              Não é você? Limpar
            </Botao>
          </div>
        ) : null}

        {/* Dizer o que acontece depois de confirmar é o argumento mais barato
            contra o abandono no último toque. */}
        <p className="text-sm leading-5 text-tinta-2">
          {whatsappConfigurado
            ? 'Confirmação e lembrete no WhatsApp'
            : 'Só usamos seu telefone para confirmar e avisar do horário.'}
        </p>

        <ErroDeAcao mensagem={erro} />

        {/* Barra fixa: o botão de confirmar não pode depender de o cliente
            rolar até o fim do formulário. Em ≥768px vira bloco no fim do
            documento e o botão encolhe para a direita. */}
        <div
          className="sticky bottom-0 -mx-4 border-t border-linha bg-bg px-4 pt-3 shadow-[var(--sombra-barra)] md:static md:mx-0 md:flex md:justify-end md:border-0 md:px-0 md:shadow-none"
          style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom))' }}
        >
          <Botao
            type="submit"
            tamanho="lg"
            largura="total"
            pendente={enviando}
            rotuloPendente="Confirmando…"
            className="md:w-auto md:min-w-[240px]"
          >
            Confirmar horário
          </Botao>
        </div>
      </form>
    </section>
  );
}
