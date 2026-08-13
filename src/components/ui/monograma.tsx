import { cva } from 'class-variance-authority';

import { cn } from '@/lib/utils';

/**
 * Iniciais no lugar da foto que não existe: `staff.photoUrl` é `null` em 100%
 * das linhas, e uma lista de barbeiros sem nenhuma âncora visual é só texto.
 *
 * Quadrado de canto reto, como todo o resto do produto — círculo lê como
 * aplicativo de loja. Fica `aria-hidden`: o nome está sempre escrito ao lado, e
 * o leitor de tela não precisa ouvir as iniciais duas vezes.
 *
 * **Por que não usa o `avatar` do shadcn.** Ele é `'use client'`, e os quatro
 * chamadores são Server Components — `/app/equipe` e `/app/clientes` são listas
 * inteiras de servidor. Trazer uma fronteira de cliente para desenhar duas
 * letras é JS a mais sem nada em troca: o avatar do base-nova é redondo, tem
 * 32px e desenha um anel de 1px no `::after`, então seriam seis decisões
 * desfeitas para sobrar um `<span>` com iniciais. Quando a foto existir, aqui
 * entra um `<img>` com fallback — não uma dependência.
 *
 * A anatomia segue o padrão da casa: `cva` para variante, `cn` para compor e
 * `data-slot` nas partes.
 */
export type MonogramaProps = { nome: string; tamanho?: 40 | 56 };

const monogramaVariants = cva(
  'inline-flex shrink-0 items-center justify-center rounded-[var(--r)] bg-muted font-bold text-muted-foreground select-none',
  {
    variants: {
      tamanho: {
        40: 'size-10 text-base',
        56: 'size-14 text-lg',
      },
    },
    defaultVariants: { tamanho: 40 },
  },
);

export function iniciaisDe(nome: string): string {
  const palavras = nome.trim().split(/\s+/).filter(Boolean);
  if (palavras.length === 0) return '';
  const primeira = palavras[0][0] ?? '';
  const ultima = palavras.length > 1 ? (palavras[palavras.length - 1][0] ?? '') : '';
  return (primeira + ultima).toUpperCase();
}

export function Monograma({ nome, tamanho = 40 }: MonogramaProps) {
  return (
    <span
      data-slot="monograma"
      aria-hidden="true"
      className={cn(monogramaVariants({ tamanho }))}
    >
      {iniciaisDe(nome)}
    </span>
  );
}
