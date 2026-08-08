/**
 * Carregando, no lugar do "Carregando…" solto.
 *
 * Ocupa a altura final da linha que vai chegar, para a tela não pular quando o
 * conteúdo entra. Sem pulso e sem shimmer: a única animação do produto é a
 * `.barra-busca`.
 */
export type EsqueletoDeLinhaProps = { altura: number; quantidade: number };

export function EsqueletoDeLinha({ altura, quantidade }: EsqueletoDeLinhaProps) {
  return (
    <div role="status" aria-label="Carregando…" className="flex flex-col gap-2">
      {Array.from({ length: Math.max(0, quantidade) }, (_, i) => (
        <div key={i} className="esqueleto" style={{ height: altura }} />
      ))}
    </div>
  );
}
