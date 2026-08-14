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
 * forma da faixa — três controles de navegação e, só no desktop, a ação à
 * direita, que é onde o "Encaixe" aparece quando a página chega.
 *
 * O cabeçalho vem inteiro, e não em esqueleto: título e descrição da agenda são
 * texto fixo, então esperar o servidor para escrevê-los seria fingir demora. É o
 * que Equipe, Serviços e Configurações já fazem no `loading.tsx` delas.
 */
export default function CarregandoAgenda() {
  return (
    <div>
      <Largura tipo="tabela" className="md:mb-3">
        <CabecalhoDePagina
          titulo="Agenda"
          descricao="Quem vem, a que horas e com quem."
          className="mb-0 sr-only md:not-sr-only"
        />
      </Largura>

      <div className="-mx-3 mb-2 md:-mx-5">
        <div
          className="flex h-16 flex-col justify-center px-3 md:px-5"
          style={{ borderBottom: '1px solid var(--linha)' }}
        >
          <Largura tipo="tabela" className="flex flex-col gap-1">
            <div className="flex h-11 items-center gap-2">
              {/* Mesma grade da barra de verdade, colunas fixas do desktop
                  inclusive: esqueleto de 932px para um botão que chega com 240
                  é o pulo que este arquivo existe para evitar. */}
              <div className="grid min-w-0 flex-1 grid-cols-[44px_1fr_44px] items-center gap-2 md:grid-cols-[44px_240px_44px]">
                <div className="esqueleto h-11" />
                <div className="esqueleto h-11" />
                <div className="esqueleto h-11" />
              </div>
              {/* 36px, não os 44px das setas ao lado: o "Encaixe" é `Botao`, e
                  `--altura-controle` é a altura dele. O esqueleto só serve se
                  for do tamanho do que vai chegar — senão ele mesmo é o pulo
                  que este arquivo existe para evitar. */}
              <div className="esqueleto hidden h-9 w-20 md:block" />
            </div>
            <div className="esqueleto h-4 w-40" />
          </Largura>
        </div>
      </div>

      <Largura tipo="tabela">
        <EsqueletoDeLinha altura={76} quantidade={6} />
      </Largura>
    </div>
  );
}
