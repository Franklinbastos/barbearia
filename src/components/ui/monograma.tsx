import { cva } from 'class-variance-authority';

import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from './avatar';

/**
 * Iniciais no lugar da foto que não existe: `staff.photoUrl` é `null` em 100%
 * das linhas, e uma lista de barbeiros sem nenhuma âncora visual é só texto.
 *
 * Fica `aria-hidden`: o nome está sempre escrito ao lado, e o leitor de tela não
 * precisa ouvir as iniciais duas vezes.
 *
 * **Decisão revertida em 13/08/2026.** Até aqui este arquivo era implementação
 * própria, e o comentário dizia por quê: o `avatar` do shadcn é `'use client'`,
 * os chamadores de `/app/equipe` e `/app/clientes` são Server Components, e
 * adotar a lib custaria uma fronteira de cliente mais seis decisões desfeitas
 * (o avatar de lá é redondo, tem 32px e desenha um anel de 1px no `::after`)
 * para sobrar um `<span>` com duas letras.
 *
 * O dono trocou o critério: fidelidade à biblioteca vale mais que economia de
 * JS e mais que a direção de UI antiga. Então o quadrado de canto reto virou o
 * círculo com anel do base-nova, e as três decisões que sustentavam a
 * implementação própria caíram junto:
 *
 * - a fronteira de cliente **deixou de ser objeção** — o `<Avatar>` atravessa a
 *   fronteira sozinho, e este arquivo continua sem `'use client'`, então quem
 *   renderiza do servidor segue renderizando do servidor;
 * - o tamanho 40 **deixou de precisar de ajuste**: é exatamente o `size="lg"` da
 *   lib, e o `40` daqui virou o nome do tamanho de lá;
 * - o `AvatarFallback` é o lugar onde a foto entra quando existir — o `<img>`
 *   com fallback que o comentário antigo prometia escrever à mão já está pronto
 *   em `<AvatarImage>`.
 *
 * O que sobrou de nosso é o tamanho 56, que a lib não tem, e a regra de compor
 * as iniciais.
 */
export type MonogramaProps = { nome: string; tamanho?: 40 | 56 };

/**
 * `40` não acrescenta classe nenhuma de propósito: é o `size="lg"` do avatar da
 * lib, na vírgula. Só o `56` precisa de utilitário, porque não existe lá.
 */
export const monogramaVariants = cva('', {
  variants: {
    tamanho: {
      40: '',
      56: 'size-14',
    },
  },
  defaultVariants: { tamanho: 40 },
});

export function iniciaisDe(nome: string): string {
  const palavras = nome.trim().split(/\s+/).filter(Boolean);
  if (palavras.length === 0) return '';
  const primeira = palavras[0][0] ?? '';
  const ultima = palavras.length > 1 ? (palavras[palavras.length - 1][0] ?? '') : '';
  return (primeira + ultima).toUpperCase();
}

export function Monograma({ nome, tamanho = 40 }: MonogramaProps) {
  return (
    <Avatar aria-hidden="true" size="lg" className={cn(monogramaVariants({ tamanho }))}>
      <AvatarFallback className={cn(tamanho === 56 ? 'text-base' : undefined)}>
        {iniciaisDe(nome)}
      </AvatarFallback>
    </Avatar>
  );
}
