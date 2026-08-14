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
 */
export default function CarregandoAgenda() {
  return (
    <div>
      <div className="-mx-3 mb-2 md:-mx-5">
        <div
          className="flex h-16 flex-col justify-center px-3 md:px-5"
          style={{ borderBottom: '1px solid var(--linha)' }}
        >
          <Largura tipo="leitura" className="flex flex-col gap-1">
            <div className="flex h-11 items-center gap-2">
              <div className="grid min-w-0 flex-1 grid-cols-[44px_1fr_44px] items-center gap-2">
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

      <Largura tipo="leitura">
        <EsqueletoDeLinha altura={76} quantidade={6} />
      </Largura>
    </div>
  );
}
