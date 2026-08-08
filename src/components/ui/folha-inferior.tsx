'use client';

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Botao } from './botao';


/**
 * A ÚNICA superfície flutuante do produto.
 *
 * Em ≥1024px **continua sendo folha inferior**, com 560px de largura máxima
 * centrada: inventar um modal de desktop dobraria o número de comportamentos de
 * sobreposição para ganhar zero.
 *
 * É o gesto mais usado do painel, e por isso é o único componente com contrato
 * de acessibilidade escrito por extenso (§4.3): `role="dialog"` +
 * `aria-modal="true"` + `aria-labelledby` no `<h2>`; foco que entra no primeiro
 * focável e **volta para o disparador** ao fechar; `Escape` com guarda de
 * descarte; `Tab`/`Shift+Tab` presos por sentinelas focáveis; `inert` no
 * `<main>`; `overflow: hidden` no `<body>` com `scrollbar-gutter`;
 * `max-height: 92dvh`; `padding-bottom: env(safe-area-inset-bottom)`.
 *
 * Tudo isso sem biblioteca: são ~80 linhas de efeito, e a alternativa custaria
 * uma dependência de UI que o projeto decidiu não ter.
 */
export type FolhaInferiorProps = {
  aberta: boolean;
  /** Vira o `aria-labelledby` do diálogo. */
  titulo: string;
  aoFechar: () => void;
  /** Grudado dentro da folha, acima da área segura. */
  rodape?: ReactNode;
  /** `true` ⇒ Escape (e o "Fechar") pedem confirmação antes de descartar. */
  guardaDeDescarte?: boolean;
  children: ReactNode;
};

const FOCAVEIS = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/** Nada a assinar: o "estamos no cliente?" nunca muda depois de responder. */
const SEM_ASSINATURA = () => () => {};
const NO_CLIENTE = () => true;
const NO_SERVIDOR = () => false;

function focaveisDe(raiz: HTMLElement | null): HTMLElement[] {
  if (!raiz) return [];
  return Array.from(raiz.querySelectorAll<HTMLElement>(FOCAVEIS));
}

export function FolhaInferior({
  aberta,
  titulo,
  aoFechar,
  rodape,
  guardaDeDescarte = false,
  children,
}: FolhaInferiorProps) {
  const idTitulo = useId();
  const folhaRef = useRef<HTMLDivElement | null>(null);
  const corpoRef = useRef<HTMLDivElement | null>(null);
  const disparadorRef = useRef<HTMLElement | null>(null);
  const confirmacaoRef = useRef<HTMLDivElement | null>(null);
  const [confirmandoDescarte, setConfirmandoDescarte] = useState(false);

  // `createPortal` precisa de `document`. Vem por `useSyncExternalStore` e não
  // por `useState` em efeito: o servidor responde `false`, o cliente `true`, e
  // não há render em cascata para o lint reclamar.
  const montada = useSyncExternalStore(SEM_ASSINATURA, NO_CLIENTE, NO_SERVIDOR);

  /** Fechar de verdade. O "Fechar" e o Escape passam por `pedirParaFechar`. */
  const pedirParaFechar = useCallback(() => {
    if (guardaDeDescarte) {
      setConfirmandoDescarte(true);
      return;
    }
    aoFechar();
  }, [guardaDeDescarte, aoFechar]);

  // Abertura: guarda o disparador, tranca o fundo, deixa o <main> inerte e põe
  // o foco no primeiro controle do corpo. A limpeza desfaz tudo na ordem
  // inversa e devolve o foco a quem abriu.
  useEffect(() => {
    if (!aberta || !montada) return;

    const disparador = document.activeElement;
    disparadorRef.current = disparador instanceof HTMLElement ? disparador : null;

    const corpo = document.body;
    const overflowAnterior = corpo.style.overflow;
    const goteiraAnterior = corpo.style.scrollbarGutter;
    corpo.style.overflow = 'hidden';
    // Sem isto a página inteira dá um salto lateral da largura da barra de
    // rolagem no instante em que a folha abre.
    corpo.style.scrollbarGutter = 'stable';

    // A folha vai num portal no <body>, então o <main> pode ficar inerte sem
    // que a própria folha caia junto.
    const principal = document.querySelector('main');
    const jaEraInerte = principal?.hasAttribute('inert') ?? false;
    if (principal && !jaEraInerte) principal.setAttribute('inert', '');

    const primeiro = focaveisDe(corpoRef.current)[0] ?? folhaRef.current;
    primeiro?.focus();

    return () => {
      corpo.style.overflow = overflowAnterior;
      corpo.style.scrollbarGutter = goteiraAnterior;
      if (principal && !jaEraInerte) principal.removeAttribute('inert');
      disparadorRef.current?.focus();
      disparadorRef.current = null;
      // A pergunta de descarte não sobrevive ao fechamento: reabrir a folha
      // mostrando "Descartar o que foi digitado?" seria assombração.
      setConfirmandoDescarte(false);
    };
  }, [aberta, montada]);

  // Escape em captura no documento: funciona com o foco em qualquer canto da
  // folha, inclusive dentro de um <input> que engoliria o evento.
  useEffect(() => {
    if (!aberta) return;
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key !== 'Escape') return;
      evento.preventDefault();
      if (confirmandoDescarte) {
        setConfirmandoDescarte(false);
        return;
      }
      pedirParaFechar();
    }
    document.addEventListener('keydown', aoTeclar, true);
    return () => document.removeEventListener('keydown', aoTeclar, true);
  }, [aberta, confirmandoDescarte, pedirParaFechar]);

  // Entrada de 160ms, só quando o sistema não pediu menos movimento. Pela API
  // de animação em vez de CSS para não precisar de keyframe global.
  useEffect(() => {
    if (!aberta || !montada) return;
    const folha = folhaRef.current;
    if (!folha || typeof folha.animate !== 'function') return;
    if (!window.matchMedia?.('(prefers-reduced-motion: no-preference)').matches) return;
    folha.animate(
      [{ transform: 'translateY(8px)', opacity: 0 }, { transform: 'none', opacity: 1 }],
      { duration: 160, easing: 'linear' },
    );
  }, [aberta, montada]);

  // A pergunta de descarte só é útil se o dedo já estiver na resposta segura —
  // "Continuar editando" é o primeiro focável do bloco, de propósito.
  useEffect(() => {
    if (confirmandoDescarte) focaveisDe(confirmacaoRef.current)[0]?.focus();
  }, [confirmandoDescarte]);

  // Fecha o ciclo do Tab sem biblioteca: sair pela frente cai no último
  // focável, sair por trás cai no primeiro.
  function irParaOFim() {
    const lista = focaveisDe(folhaRef.current);
    lista[lista.length - 1]?.focus();
  }
  function irParaOInicio() {
    focaveisDe(folhaRef.current)[0]?.focus();
  }

  if (!aberta || !montada) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div
        aria-hidden="true"
        onClick={pedirParaFechar}
        className="absolute inset-0"
        style={{ background: 'rgb(0 0 0 / .45)' }}
      />

      {/* sentinela de início */}
      <div tabIndex={0} onFocus={irParaOFim} style={{ width: 0, height: 0 }} />

      <div
        ref={folhaRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        tabIndex={-1}
        className="relative flex w-full max-w-[560px] flex-col"
        style={{
          maxHeight: '92dvh',
          background: 'var(--bg)',
          borderTopLeftRadius: 'var(--r-folha)',
          borderTopRightRadius: 'var(--r-folha)',
          boxShadow: 'var(--sombra-folha)',
        }}
      >
        <header
          className="flex shrink-0 items-center justify-between gap-2 pl-4"
          style={{ minHeight: 48, borderBottom: '1px solid var(--linha)' }}
        >
          <h2 id={idTitulo} className="truncate text-[18px] leading-6 font-bold">
            {titulo}
          </h2>
          <button
            type="button"
            onClick={pedirParaFechar}
            aria-label="Fechar"
            className="flex shrink-0 items-center justify-center"
            style={{ width: 48, height: 48, background: 'transparent', border: 0 }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
              <path
                d="M4 4l12 12M16 4L4 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>

        <div
          ref={corpoRef}
          className="flex-1 overflow-y-auto p-4"
          style={rodape ? undefined : { paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}
        >
          {children}
        </div>

        {confirmandoDescarte ? (
          <div
            ref={confirmacaoRef}
            role="group"
            aria-label="Descartar o que foi digitado?"
            className="shrink-0 p-4"
            style={{ borderTop: '1px solid var(--linha)', background: 'var(--alerta-bg)' }}
          >
            <p className="mb-3 text-[14px] leading-5">Descartar o que foi digitado?</p>
            <div className="flex gap-2">
              <Botao variante="secundario" onClick={() => setConfirmandoDescarte(false)}>
                Continuar editando
              </Botao>
              <Botao
                variante="perigo-vazado"
                onClick={() => {
                  setConfirmandoDescarte(false);
                  aoFechar();
                }}
              >
                Descartar
              </Botao>
            </div>
          </div>
        ) : null}

        {rodape ? (
          <div
            className="shrink-0 p-4"
            style={{
              borderTop: '1px solid var(--linha)',
              background: 'var(--bg)',
              paddingBottom: 'calc(16px + env(safe-area-inset-bottom))',
            }}
          >
            {rodape}
          </div>
        ) : null}
      </div>

      {/* sentinela de fim */}
      <div tabIndex={0} onFocus={irParaOInicio} style={{ width: 0, height: 0 }} />
    </div>,
    document.body,
  );
}
