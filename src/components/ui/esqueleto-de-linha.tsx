import { Skeleton } from './skeleton';

/**
 * Carregando, no lugar do "Carregando…" solto.
 *
 * Ocupa a altura final da linha que vai chegar, para a tela não pular quando o
 * conteúdo entra.
 *
 * Por dentro é um laço sobre o `Skeleton` do shadcn, que traz o
 * `data-slot="skeleton"`, o `bg-muted`, o `rounded-md` e **o pulso**. Havia um
 * `DESFAZ_O_BASE_NOVA` de duas linhas desligando o pulso e forçando o raio
 * antigo, porque a direção de UI dizia que a única animação do produto era a
 * barra de busca. Saiu em 13/08/2026: a lib venceu.
 *
 * `motion-reduce:animate-none` fica. Não é aparência, é acessibilidade — e o
 * `animate-pulse` da lib não respeita a preferência do sistema sozinho.
 */
export type EsqueletoDeLinhaProps = { altura: number; quantidade: number };

export function EsqueletoDeLinha({ altura, quantidade }: EsqueletoDeLinhaProps) {
  return (
    <div role="status" aria-label="Carregando…" className="flex flex-col gap-2">
      {Array.from({ length: Math.max(0, quantidade) }, (_, i) => (
        <Skeleton key={i} className="motion-reduce:animate-none" style={{ height: altura }} />
      ))}
    </div>
  );
}
