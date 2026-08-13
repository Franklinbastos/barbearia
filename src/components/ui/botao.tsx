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
 * Por dentro compõe o `Button` do shadcn (estilo `base-nova`), e **desde
 * 13/08/2026 a aparência é a de lá**: altura, recheio, raio, tipografia, anel de
 * foco, transição, o afundamento de 1px ao apertar e a opacidade do
 * desabilitado. Antes havia um bloco `DESFAZ_O_BASE_NOVA` anulando cada uma
 * dessas decisões para preservar a direção de UI antiga; o dono decidiu o
 * contrário, e o bloco saiu inteiro.
 *
 * O que continua nosso é **cor**, e só cor: `ok` e `perigo-vazado` não existem
 * na lib e vêm por utilitário em cima dos tokens da §3.1.
 *
 * A classe `.btn` do `globals.css` deixou de entrar aqui. Ela continua existindo
 * porque sete `<a>`/`<Link>` do app a usam crua e não recebem classe nenhuma da
 * lib — e lá ela agora **copia** o `button` do base-nova em vez de desfazê-lo.
 */
export type BotaoProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: 'primario' | 'secundario' | 'ok' | 'perigo' | 'perigo-vazado' | 'texto';
  /** 'md' = o controle da lib; 'lg' = o mesmo com mais respiro lateral. Padrão 'md'. */
  tamanho?: 'md' | 'lg';
  largura?: 'auto' | 'total';
  /** Desabilita e troca o rótulo pelo `rotuloPendente`. */
  pendente?: boolean;
  rotuloPendente?: string;
};

/**
 * As nossas seis variantes nas quatro da lib. `ok` e `perigo-vazado` caem em
 * `default` e `outline` e recebem a cor por cima — a lib só tem `default` e
 * `destructive` como semântica de cor, e os nossos tons de estado continuam
 * sendo quatro.
 */
const VARIANTE_DA_LIB = {
  primario: 'default',
  secundario: 'outline',
  ok: 'default',
  perigo: 'destructive',
  'perigo-vazado': 'outline',
  texto: 'ghost',
} as const;

export const botaoVariants = cva('', {
  variants: {
    variante: {
      primario: '',
      secundario: '',
      // `bg-primary` do `default` viria por utilitário e venceria qualquer
      // classe de componente, então o verde do "Compareceu" vem por utilitário
      // também. `/80` no hover é a mesma proporção que a lib usa no `default`.
      ok: 'border-transparent bg-ok text-white hover:bg-ok/80',
      perigo: '',
      // `outline` da lib com a cor de `destructive` — a composição não existe lá
      'perigo-vazado': 'border-perigo text-perigo hover:bg-perigo/10 hover:text-perigo',
      texto: '',
    },
    tamanho: {
      // A escala do base-nova para no `lg` (h-9, 36px), que é exatamente
      // `--altura-controle`. Os dois tamanhos daqui usam essa altura; o que o
      // "grande" ganha é recheio lateral, como o `lg` do shadcn clássico.
      md: '',
      lg: 'px-4',
    },
    largura: {
      auto: '',
      total: 'w-full',
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
      type={type ?? 'submit'}
      variant={VARIANTE_DA_LIB[variante]}
      size="lg"
      className={cn(botaoVariants({ variante, tamanho, largura }), className)}
      disabled={disabled || pendente}
      aria-busy={pendente || undefined}
    >
      {pendente && rotuloPendente ? rotuloPendente : children}
    </Button>
  );
}
