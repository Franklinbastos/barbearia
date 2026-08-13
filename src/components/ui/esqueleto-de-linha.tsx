import { cn } from '@/lib/utils';
import { Skeleton } from './skeleton';

/**
 * Carregando, no lugar do "Carregando…" solto.
 *
 * Ocupa a altura final da linha que vai chegar, para a tela não pular quando o
 * conteúdo entra. Sem pulso e sem shimmer: a única animação do produto é a
 * `.barra-busca`.
 *
 * Por dentro é um laço sobre o `Skeleton` do shadcn, que traz o
 * `data-slot="skeleton"`. O fundo dele (`bg-muted`) já é o `--superficie-2` que
 * `.esqueleto` pedia; o que muda são as duas linhas de `DESFAZ_O_BASE_NOVA`.
 */
export type EsqueletoDeLinhaProps = { altura: number; quantidade: number };

/**
 * O `skeleton` do base-nova pulsa e arredonda em `--radius-md` (2px). A §3.1
 * decidiu o contrário nos dois pontos: nada anima fora da barra de busca, e o
 * raio do produto inteiro é `--r`.
 */
const DESFAZ_O_BASE_NOVA = 'animate-none rounded-[var(--r)]';

export function EsqueletoDeLinha({ altura, quantidade }: EsqueletoDeLinhaProps) {
  return (
    <div role="status" aria-label="Carregando…" className="flex flex-col gap-2">
      {Array.from({ length: Math.max(0, quantidade) }, (_, i) => (
        <Skeleton key={i} className={cn('esqueleto', DESFAZ_O_BASE_NOVA)} style={{ height: altura }} />
      ))}
    </div>
  );
}
