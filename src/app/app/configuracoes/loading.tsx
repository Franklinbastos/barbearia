import { CabecalhoDePagina } from '@/components/ui/cabecalho-de-pagina';
import { EsqueletoDeLinha } from '@/components/ui/esqueleto-de-linha';
import { Largura } from '@/components/ui/largura';

/**
 * O esqueleto desenha a tela que vai chegar: três seções anotadas — título e
 * descrição fora do card, card abaixo —, na ordem em que a página as monta.
 *
 * A ordem importa tanto quanto a altura, e é a da página: **identidade → link →
 * regras**, com o salvar no fim. Esqueleto na ordem errada é o mesmo salto que
 * este arquivo existe para evitar, só que de posição em vez de largura.
 *
 * As alturas são a estimativa do desktop, onde as regras ficam em duas colunas.
 * No celular tudo empilha e o card cresce — o esqueleto erra para menos, que é
 * o lado certo de errar: sobra rola, falta salta.
 *
 * O cabeçalho vem inteiro, e não em esqueleto: o título é texto fixo, e esperar
 * o servidor para escrevê-lo seria fingir demora. É o que Equipe e Serviços já
 * fazem.
 */
export default function CarregandoConfiguracoes() {
  return (
    <div className="flex flex-col gap-4">
      <CabecalhoDePagina
        titulo="Configurações"
        descricao="O link de agendamento da loja e as regras da agenda."
      />

      {/* O mesmo degrau da tela pronta (§3.7): esqueleto num teto e conteúdo em
          outro salta de largura no instante em que carrega. */}
      <Largura tipo="tabela" className="flex flex-col gap-4">
        {/* Identidade — só título, sem descrição, como na tela pronta.
            `gap-3` entre a anotação e o card, como na `SecaoDeAjustes`. */}
        <div className="flex flex-col gap-3">
          <div className="esqueleto h-6 w-32" />
          <EsqueletoDeLinha altura={300} quantidade={1} />
        </div>

        {/* Link de agendamento. */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <div className="esqueleto h-6 w-44" />
            <div className="esqueleto h-5 w-80 max-w-full" />
          </div>
          <EsqueletoDeLinha altura={230} quantidade={1} />
        </div>

        {/* Regras da agenda. */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <div className="esqueleto h-6 w-40" />
            <div className="esqueleto h-5 w-64 max-w-full" />
          </div>
          <EsqueletoDeLinha altura={300} quantidade={1} />
        </div>

        {/* O salvar fecha a tela, e mede o `Botao` de 36px com os 32px de
            respiro que o Carbon pede acima dele. */}
        <div className="esqueleto mt-8 h-9 w-48" />
      </Largura>
    </div>
  );
}
