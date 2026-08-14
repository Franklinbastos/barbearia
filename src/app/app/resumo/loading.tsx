import { EsqueletoDeLinha } from '@/components/ui/esqueleto-de-linha';

/**
 * O resumo consulta o período inteiro — no mês são milhares de linhas —, então
 * é a tela do painel com mais chance de mostrar o esqueleto de verdade.
 *
 * Desenha a altura final: cabeçalho, a linha do seletor de período e os cards.
 * A tela não pula quando os números chegam, e não há spinner — girar um disco
 * não conta quanto falta.
 */
export default function CarregandoResumo() {
  return (
    <div className="flex flex-col gap-4">
      <EsqueletoDeLinha altura={28} quantidade={1} />
      <EsqueletoDeLinha altura={36} quantidade={1} />
      <div className="max-w-[720px]">
        <EsqueletoDeLinha altura={140} quantidade={1} />
      </div>
    </div>
  );
}
