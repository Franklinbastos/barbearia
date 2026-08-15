import { CabecalhoDePagina } from '@/components/ui/cabecalho-de-pagina';
import { EsqueletoDeLinha } from '@/components/ui/esqueleto-de-linha';
import { Largura } from '@/components/ui/largura';

/**
 * O primeiro `loading.tsx` do projeto, e ele nasce na tela mais aberta.
 *
 * Desenha a barra de data e seis linhas na altura final do cartão (76px): a
 * tela não pula quando os dados chegam, e não há spinner nenhum — girar um
 * disco não conta quanto falta.
 *
 * Repete a largura da tela que antecede (§3.7): esqueleto num teto e conteúdo em
 * outro é o mesmo salto que o `loading.tsx` existe para evitar. Repete também a
 * forma da faixa — o "Hoje" e os três controles de navegação, a contagem e, só
 * no desktop, a ação à direita, que é onde o "Encaixe" aparece quando a página
 * chega.
 *
 * O cabeçalho vem inteiro, e não em esqueleto: o título da agenda é texto fixo,
 * então esperar o servidor para escrevê-lo seria fingir demora. É o que Equipe,
 * Serviços e Configurações já fazem no `loading.tsx` delas.
 */
export default function CarregandoAgenda() {
  return (
    <div>
      <Largura tipo="tabela" className="md:mb-3">
        <CabecalhoDePagina
          titulo="Agenda"
          className="mb-0 sr-only md:not-sr-only"
        />
      </Largura>

      {/* `mb-3`, o mesmo da barra de verdade: com `mb-2` a lista do esqueleto
          começava 4px acima da lista que chega, e o pulo de 4px na tela mais
          aberta do produto é exatamente o que este arquivo existe para evitar. */}
      <div className="-mx-3 mb-3 md:-mx-5">
        <div
          className="flex h-16 flex-col justify-center px-3 md:px-5"
          style={{ borderBottom: '1px solid var(--linha)' }}
        >
          <Largura tipo="tabela" className="flex flex-col gap-1">
            <div className="flex h-11 items-center gap-2">
              {/* Mesma ordem da barra de verdade nas duas larguras — `Hoje ‹ ›
                  data` no desktop, `‹ data ›` no celular —, e a mesma largura
                  fixa de 240px no rótulo: esqueleto de 932px para um botão que
                  chega com 240 é o pulo que este arquivo existe para evitar. */}
              <div className="esqueleto hidden h-11 w-16 md:block" />
              <div className="esqueleto -order-3 h-11 w-11 md:order-none" />
              <div className="esqueleto -order-1 h-11 w-11 md:order-none" />
              <div className="esqueleto -order-2 h-11 min-w-0 flex-1 md:order-none md:w-60 md:flex-none" />
              <div className="esqueleto hidden h-4 w-32 md:block md:mr-auto" />
              {/* 36px, não os 44px das setas ao lado: o "Encaixe" é `Botao`, e
                  `--altura-controle` é a altura dele. O esqueleto só serve se
                  for do tamanho do que vai chegar — senão ele mesmo é o pulo
                  que este arquivo existe para evitar. */}
              <div className="esqueleto hidden h-9 w-20 md:block" />
            </div>
            {/* A contagem só é linha de baixo no celular; no desktop ela entrou
                na linha de cima, ao lado do rótulo. */}
            <div className="esqueleto h-4 w-40 md:hidden" />
          </Largura>
        </div>
      </div>

      <Largura tipo="tabela">
        <EsqueletoDeLinha altura={76} quantidade={6} />
      </Largura>
    </div>
  );
}
