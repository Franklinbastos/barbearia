'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

import { cn } from '@/lib/utils';
import { Botao } from './botao';
import { Drawer, DrawerClose, DrawerContent, DrawerTitle } from './drawer';

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
 * descarte; `Tab`/`Shift+Tab` presos; conteúdo de fora inerte; rolagem do fundo
 * travada; `max-height: 92dvh`; `padding-bottom: env(safe-area-inset-bottom)`.
 *
 * Isso tudo era ~80 linhas de efeito escritas na mão. Agora vem do `drawer` do
 * shadcn (estilo `base-nova`), que embrulha o `Drawer` do base-ui: foco preso
 * por sentinela de verdade, retorno ao disparador, resto do documento fora da
 * árvore de acessibilidade, trava de rolagem com compensação de barra, e o
 * arrasto para baixo que a implementação anterior não tinha. A **aparência
 * continua nossa** — ver `DESFAZ_O_BASE_NOVA` e a regra de
 * `[data-slot="drawer-overlay"]` no `globals.css`.
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

function focaveisDe(raiz: HTMLElement | null): HTMLElement[] {
  if (!raiz) return [];
  return Array.from(raiz.querySelectorAll<HTMLElement>(FOCAVEIS));
}

/**
 * O texto-base do `drawer` do base-nova não é neutro: ele decide aparência.
 * Cada linha aqui desfaz exatamente uma dessas decisões, e todas caem por
 * conflito de grupo no `tailwind-merge` — **desde que a variante seja a mesma**.
 * Um `rounded-t-folha` solto perderia para `data-[swipe-direction=down]:rounded-t-xl`
 * pela especificidade do seletor de atributo, então o desfazimento repete a
 * variante; é o motivo de três linhas daqui parecerem verbosas.
 *
 * Sem isto a folha muda em seis pontos medidos com `getComputedStyle` antes e
 * depois: fundo cinza (`--popover`) em vez de branco, texto de 14px em vez de
 * 16, canto de 12px em vez dos 6px da §3.1, uma borda de 1px no topo que nunca
 * existiu, altura máxima de `100dvh − 96px` em vez de 92dvh, e largura colada
 * nas bordas da tela grande em vez dos 560px centrados.
 */
const DESFAZ_O_BASE_NOVA = [
  'bg-background', //  desfaz `bg-popover` (--superficie): a folha é o branco de --bg
  'text-base', //      desfaz `text-sm`: dentro da folha o texto é 16/24, como no resto
  // desfaz `m-(--drawer-inset,0px)`: com `inset-x-0` e `width:auto`, é a margem
  // automática que segura os 560px no meio da tela grande. Mesmo grupo do
  // `tailwind-merge`, então não sobra margem antiga para brigar por ordem.
  'm-[0_auto] max-w-[560px]',
  // desfaz `rounded-t-xl` (8px): o raio da folha é --r-folha, 6px. Vai como valor
  // arbitrário, não como `rounded-t-folha`: o `tailwind-merge` não conhece as
  // chaves de raio que a gente inventou no `@theme`, deixaria as duas classes
  // passarem, e medindo deu 8px — o `xl` do base-nova ganhando por ordem.
  'data-[swipe-direction=down]:rounded-t-[var(--r-folha)]',
  'data-[swipe-direction=down]:border-t-0', //     desfaz `border-t`: a folha não tem borda
  'data-[swipe-axis=y]:[--drawer-content-max-height:92dvh]', // desfaz calc(100dvh-6rem)
  // o "vazamento" que o base-nova pinta abaixo da folha para o arrasto elástico
  // é `--color-popover` por padrão, e apareceria como faixa cinza sob o branco
  '[--drawer-bleed-background:var(--bg)]',
  'shadow-[var(--sombra-folha)]', // a elevação da §3.1; o base-nova não tem nenhuma
  // o `prefers-reduced-motion` era respeitado na implementação anterior e o
  // base-nova não o respeita: sem isto a folha desliza 450ms de qualquer jeito
  'motion-reduce:transition-none',
  // desfaz os 450ms do base-nova. A folha do encaixe abre dezenas de vezes por
  // dia com o cliente esperando em pé, e meio segundo por toque é lentidão que
  // se sente. 200ms fica perto dos 160ms da implementação anterior sem perder o
  // deslize que dá a dica de que dá para arrastar.
  'duration-200',
].join(' ');

export function FolhaInferior({
  aberta,
  titulo,
  aoFechar,
  rodape,
  guardaDeDescarte = false,
  children,
}: FolhaInferiorProps) {
  // O corpo vem em estado, não em `useRef`, porque o portal do base-ui só monta
  // o conteúdo num segundo commit: no efeito da abertura um `ref` ainda vale
  // `null` e o foco de entrada nunca sairia do lugar. Guardando o nó em estado,
  // o efeito abaixo tem `corpo` na lista de dependências e roda no commit certo.
  const [corpo, setCorpo] = useState<HTMLDivElement | null>(null);
  const confirmacaoRef = useRef<HTMLDivElement | null>(null);
  const disparadorRef = useRef<HTMLElement | null>(null);
  const [confirmandoDescarte, setConfirmandoDescarte] = useState(false);

  // A pergunta de descarte não sobrevive ao fechamento: reabrir a folha
  // mostrando "Descartar o que foi digitado?" seria assombração. O ajuste é em
  // render, não em efeito — é o padrão que o React documenta para estado que
  // depende de prop, e evita o quadro extra em que a pergunta antiga reaparece.
  if (!aberta && confirmandoDescarte) setConfirmandoDescarte(false);

  // Quem abriu a folha, anotado antes de qualquer foco se mexer — este efeito
  // roda no commit em que `aberta` vira `true`, e o portal do base-ui só monta
  // no seguinte. O base-ui também sabe deduzir o disparador sozinho, mas só
  // acerta quando é ele quem move o foco de entrada; como quem move somos nós
  // (ver o efeito abaixo), a anotação dele pararia no próprio controle da folha
  // e o disparador nunca recuperaria o foco.
  useEffect(() => {
    if (!aberta) return;
    const ativo = document.activeElement;
    disparadorRef.current = ativo instanceof HTMLElement && ativo !== document.body ? ativo : null;
  }, [aberta]);

  // O foco de entrada é nosso, e o `initialFocus={false}` lá embaixo desliga o
  // do base-ui — a prisão de foco e o retorno ao disparador continuam sendo dele.
  // São duas diferenças que não dava para acertar por prop:
  //   • **alvo**: o base-ui foca o próprio popup; a folha sempre focou o
  //     primeiro controle do corpo (abrir o encaixe já com o cursor no nome).
  //     `initialFocus` até aceita função, mas o retorno cai no
  //     `getTabbableContent` do popup inteiro, que acha antes o "Fechar".
  //   • **momento**: o base-ui enfileira o foco em microtarefa mais quadro de
  //     animação. Quem abre a folha pelo teclado e já sai digitando perderia as
  //     primeiras teclas, e o teste do contrato mede o foco na hora.
  useEffect(() => {
    if (!aberta || !corpo) return;
    focaveisDe(corpo)[0]?.focus();
  }, [aberta, corpo]);

  // A pergunta de descarte só é útil se o dedo já estiver na resposta segura —
  // "Continuar editando" é o primeiro focável do bloco, de propósito.
  useEffect(() => {
    if (confirmandoDescarte) focaveisDe(confirmacaoRef.current)[0]?.focus();
  }, [confirmandoDescarte]);

  return (
    <Drawer
      open={aberta}
      // Um funil só para os quatro jeitos de fechar — Escape, clique no véu,
      // botão "Fechar" e arrasto para baixo. A guarda de descarte precisa
      // interceptar os quatro, e `cancel()` é o que segura o base-ui.
      onOpenChange={(aberto, detalhes) => {
        if (aberto) return;

        if (confirmandoDescarte) {
          detalhes.cancel();
          // Escape com a pergunta na tela volta para a folha, não fecha nada.
          if (detalhes.reason === 'escape-key') setConfirmandoDescarte(false);
          return;
        }

        if (guardaDeDescarte) {
          detalhes.cancel();
          setConfirmandoDescarte(true);
          return;
        }

        aoFechar();
      }}
    >
      <DrawerContent
        // O base-ui põe `role="dialog"` mas não `aria-modal`; o contrato da
        // §4.3 pede os dois, e há teste casando com o atributo.
        aria-modal="true"
        // quem põe o foco de entrada é o efeito lá em cima — ver o porquê
        initialFocus={false}
        // e o de saída é o disparador que aquele outro efeito anotou
        finalFocus={disparadorRef}
        className={cn(DESFAZ_O_BASE_NOVA)}
      >
        <header
          data-slot="folha-cabecalho"
          className="flex shrink-0 items-center justify-between gap-2 pl-4"
          style={{ minHeight: 48, borderBottom: '1px solid var(--linha)' }}
        >
          <DrawerTitle className="truncate text-[18px] leading-6 font-bold">{titulo}</DrawerTitle>
          <DrawerClose
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
          </DrawerClose>
        </header>

        <div
          ref={setCorpo}
          data-slot="folha-corpo"
          className="flex-1 overflow-y-auto p-4"
          style={rodape ? undefined : { paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}
        >
          {children}
        </div>

        {confirmandoDescarte ? (
          <div
            ref={confirmacaoRef}
            data-slot="folha-descarte"
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
            data-slot="folha-rodape"
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
      </DrawerContent>
    </Drawer>
  );
}
