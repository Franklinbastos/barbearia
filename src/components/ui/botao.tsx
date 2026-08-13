import type { ButtonHTMLAttributes } from 'react';
import { cva } from 'class-variance-authority';

import { cn } from '@/lib/utils';
import { Button } from './button';

/**
 * O botão do produto inteiro.
 *
 * Existe porque o preflight do Tailwind zera fundo, borda e padding de
 * `<button>`: sem uma casa que carregue a altura, os ~60 botões do app viram
 * texto solto de 24px de alto. Altura é propriedade de componente, nunca
 * classe utilitária que alguém lembra de colar.
 *
 * `pendente` é a segunda razão: todo botão que dispara ação precisa desabilitar
 * e dizer que está trabalhando, e isso não pode depender de cada tela.
 *
 * Por dentro compõe o `Button` do shadcn (estilo `base-nova`), que traz o
 * primitivo do base-ui, o `data-slot="button"` e o `cva`. A **aparência
 * continua nossa**: vem das classes `.btn`/`.btn--*` da §3.1, que também são
 * usadas cruas por sete `<a>`/`<Link>` do app e por isso seguem sendo a única
 * fonte do valor. O que o `cva` daqui acrescenta é o desfazimento das decisões
 * de aparência que o base-nova embute — ver `DESFAZ_O_BASE_NOVA`.
 */
export type BotaoProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: 'primario' | 'secundario' | 'ok' | 'perigo' | 'perigo-vazado' | 'texto';
  /** 'md' = 52px, 'lg' = 56px. Padrão 'md'. */
  tamanho?: 'md' | 'lg';
  largura?: 'auto' | 'total';
  /** Desabilita e troca o rótulo pelo `rotuloPendente`. */
  pendente?: boolean;
  rotuloPendente?: string;
};

/**
 * O texto-base do `button` do base-nova não é neutro: ele decide aparência.
 * Cada linha aqui desfaz exatamente uma dessas decisões, e todas caem por
 * conflito de grupo no `tailwind-merge` — nada some por ordem de declaração.
 *
 * Sem isto a tela muda, que é o defeito que esta migração não pode cometer:
 * o botão encolheria a fonte para 14px, pararia de quebrar linha em 360px,
 * afundaria 1px ao ser apertado, trocaria o `--anel` de foco por um anel de
 * 3px próprio e ficaria translúcido quando desabilitado.
 */
const DESFAZ_O_BASE_NOVA = [
  'shrink', //             desfaz `shrink-0`: em linha de botões, `.btn` encolhe
  'whitespace-normal', //  desfaz `whitespace-nowrap`: rótulo longo quebra em 360px
  'bg-clip-border', //     desfaz `bg-clip-padding`, que abriria 1px de página sob a borda
  'transition-[background-color] duration-[120ms] ease-linear', // desfaz `transition-all`
  'active:not-aria-[haspopup]:translate-y-0', // desfaz o empurrão de 1px ao apertar
  'disabled:opacity-100', // desfaz `disabled:opacity-50`; o desabilitado nosso é cinza, não translúcido
  // repõe o `border-color: transparent` que `.btn:disabled` já dava: a cor da
  // borda de cada variante agora é utilitário, e utilitário vence a camada de
  // componente inteira. Sem isto o botão desabilitado guarda a borda colorida.
  'disabled:border-transparent',
  // devolve o `--anel` da §3.1 no lugar do anel próprio do base-nova: o `ring-3`
  // continua declarado, só que transparente, e a sombra volta a ser a nossa.
  'focus-visible:ring-transparent focus-visible:shadow-[var(--anel)]',
].join(' ');

/**
 * As classes `.btn--*` moram em `@layer components` e o base-nova escreve
 * `border`/`border-transparent` em `@layer utilities`, que vence a camada
 * inteira independente de especificidade. Por isso a cor da borda de cada
 * variante é repetida como utilitário — inclusive sob `focus-visible:`, para
 * derrubar o `focus-visible:border-ring`.
 */
export const botaoVariants = cva(['btn', 'font-bold', DESFAZ_O_BASE_NOVA], {
  variants: {
    variante: {
      primario: 'border-transparent focus-visible:border-transparent',
      secundario: 'btn--sec border-linha focus-visible:border-linha',
      ok: 'btn--ok border-ok focus-visible:border-ok',
      perigo: 'btn--perigo border-perigo focus-visible:border-perigo',
      'perigo-vazado': 'btn--perigo-vazado border-2 border-perigo focus-visible:border-perigo',
      texto: 'btn--texto font-normal border-transparent focus-visible:border-transparent',
    },
    tamanho: {
      // `.btn` já carrega a altura; o utilitário existe para o `className` de
      // fora poder trocá-la pelo `tailwind-merge` (o painel usa `min-h-11` e
      // `min-h-12`) e para desfazer o `text-sm` do base-nova.
      md: 'min-h-[var(--tap-md)] text-base',
      lg: 'btn--lg min-h-[var(--tap-lg)] text-lg/6',
    },
    largura: {
      auto: '',
      total: 'btn--tot',
    },
  },
  defaultVariants: { variante: 'primario', tamanho: 'md', largura: 'auto' },
});

export function Botao({
  variante = 'primario',
  tamanho = 'md',
  largura = 'auto',
  pendente = false,
  rotuloPendente,
  className,
  disabled,
  type,
  children,
  ...resto
}: BotaoProps) {
  return (
    <Button
      {...resto}
      // O `Button` do base-ui embute `type="button"`, mas `<button>` sem `type`
      // dentro de `<form>` é submit — e cinco botões do encaixe contam com isso.
      // Repor o padrão nativo mantém o DOM igual ao de antes da migração.
      type={type ?? 'submit'}
      // `variant`/`size` em `null` desligam a paleta do base-nova de propósito:
      // `destructive` lá é vazado (`bg-destructive/10`) e `outline` pinta fundo
      // (`bg-background`, `dark:bg-input/30`), enquanto o nosso `perigo` é sólido
      // e o `secundario` é transparente. Mapear mudaria cancelar e secundário.
      variant={null}
      size={null}
      className={cn(botaoVariants({ variante, tamanho, largura }), className)}
      disabled={disabled || pendente}
      aria-busy={pendente || undefined}
    >
      {pendente && rotuloPendente ? rotuloPendente : children}
    </Button>
  );
}
