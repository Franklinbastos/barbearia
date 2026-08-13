'use client';

import { X } from 'lucide-react';
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
 * arrasto para baixo que a implementação anterior não tinha.
 *
 * **Desde 13/08/2026 a aparência também é a de lá**: fundo em `--popover`, texto
 * de 14px, canto de 12px, borda no topo, `max-height: 100dvh − 6rem`, 450ms de
 * deslize e o véu a 10% com desfoque. Um `DESFAZ_O_BASE_NOVA` de dez linhas
 * anulava cada um desses pontos, e uma regra de `[data-slot="drawer-overlay"]`
 * no `globals.css` repunha o véu antigo. Os dois saíram.
 *
 * Sobraram duas coisas em cima da lib, e nenhuma é aparência:
 *   • `max-w-[560px]` centrado, que é a decisão de a folha **continuar folha**
 *     em ≥1024px em vez de virar modal de desktop;
 *   • `motion-reduce:transition-none`, porque o base-ui não respeita
 *     `prefers-reduced-motion` sozinho.
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
 * O que continua sendo escrito por cima do `drawer` do base-nova, e por quê.
 * Não há mais nada de aparência aqui — ver o cabeçalho do arquivo.
 */
const EM_CIMA_DA_LIB = [
  // `m-(--drawer-inset,0px)` do base-nova cede o lugar para a margem automática
  // que segura os 560px no meio da tela grande. Mesmo grupo do `tailwind-merge`,
  // então não sobra margem antiga para brigar por ordem.
  'm-[0_auto] max-w-[560px]',
  // o base-ui não respeita `prefers-reduced-motion`: sem isto a folha desliza
  // 450ms de qualquer jeito
  'motion-reduce:transition-none',
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
        className={cn(EM_CIMA_DA_LIB)}
      >
        <header
          data-slot="folha-cabecalho"
          className="flex shrink-0 items-center justify-between gap-2 border-b pl-4"
          style={{ minHeight: 48 }}
        >
          <DrawerTitle className="truncate">{titulo}</DrawerTitle>
          <DrawerClose
            aria-label="Fechar"
            className="flex shrink-0 items-center justify-center"
            style={{ width: 48, height: 48, background: 'transparent', border: 0 }}
          >
            {/* O X à mão tinha 12×12 de desenho com traço de 2px numa caixa de
                20px. O `X` do lucide desenha exatamente 12×12 com traço 2 na
                caixa de 24 — `size-6` devolve o mesmo glifo, e a caixa maior
                não move nada porque ela é centrada nos 48px do botão. */}
            <X aria-hidden="true" className="size-6" />
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
            className="shrink-0 border-t p-4"
            style={{ background: 'var(--alerta-bg)' }}
          >
            <p className="mb-3">Descartar o que foi digitado?</p>
            {/* Botão de folha é alvo de dedo antes de ser controle: `--tap-min`
                é o piso de acessibilidade e fica acima dos 36px da lib. */}
            <div className="flex gap-2 [&_button]:min-h-[var(--tap-min)]">
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
            // `--tap-min` pelo mesmo motivo da folha de descarte: o rodapé é
            // onde mora o verbo da folha, e alvo de dedo tem piso próprio.
            className="shrink-0 border-t bg-popover p-4 [&_button]:min-h-[var(--tap-min)]"
            style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}
          >
            {rodape}
          </div>
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}
