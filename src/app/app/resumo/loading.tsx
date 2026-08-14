import { EsqueletoDeLinha } from '@/components/ui/esqueleto-de-linha';

/**
 * O resumo consulta o período inteiro — no mês são milhares de linhas —, então
 * é a tela do painel com mais chance de mostrar o esqueleto de verdade.
 *
 * Desenha a altura final: cabeçalho, a linha do seletor de período e os cards.
 * A tela não pula quando os números chegam, e não há spinner — girar um disco
 * não conta quanto falta.
 *
 * A primeira dobra é a **mesma grade** da tela pronta (§3.7): o resumo é o único
 * lugar do painel sem teto de largura, e o esqueleto de 720px que morava aqui
 * era mais estreito que a fileira inteira de cards — o conteúdo saltava de
 * largura e de forma no instante em que carregava, que é justamente o que este
 * arquivo existe para evitar.
 */
export default function CarregandoResumo() {
  return (
    <div className="flex flex-col gap-6">
      <EsqueletoDeLinha altura={28} quantidade={1} />
      <EsqueletoDeLinha altura={36} quantidade={1} />

      <div
        role="status"
        aria-label="Carregando…"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {/* Quatro fichas na altura do `CartaoIndicador`, e não um bloco só:
            em `xl` a fileira é de quatro, e um retângulo corrido anunciaria uma
            forma que não vai chegar. */}
        <div className="esqueleto h-[140px]" />
        <div className="esqueleto h-[140px]" />
        <div className="esqueleto h-[140px]" />
        <div className="esqueleto h-[140px]" />
      </div>
    </div>
  );
}
