import { formatDuration, formatPrice } from '@/lib/format';
import { Bloco } from '@/components/ui/bloco';
import type { CatalogService } from '../types';

/**
 * Etapa 1: escolha do serviço (§5.2 da direção de UI).
 *
 * A lista chega pronta por prop — o catálogo é montado no servidor, então esta
 * etapa sai preenchida no HTML inicial e não existe mais estado de carregando
 * nem de erro aqui.
 *
 * Cada `<li>` é uma linha inteira clicável de 72px: nome e duração à esquerda,
 * preço à direita. Sem chevron — a linha ser botão já é a afordância, e o nome
 * acessível resultante ("Corte 30 min R$ 45,00") é o que o e2e casa com
 * `/corte/i`.
 */
export function ServiceStep({
  servicos,
  aoEscolher,
}: {
  servicos: CatalogService[];
  aoEscolher: (servico: CatalogService) => void;
}) {
  return (
    <section>
      <h2 className="mt-4 mb-3 text-[22px] leading-7 font-bold">
        <span aria-hidden="true" className="mb-2 block h-[3px] w-8 bg-marca" />
        Escolha o serviço
      </h2>

      {servicos.length === 0 ? (
        <Bloco tom="alerta">
          A agenda desta barbearia ainda não está disponível. Volte em breve.
        </Bloco>
      ) : (
        <ul className="lista">
          {servicos.map((servico) => {
            const preco = formatPrice(servico.priceCents);
            const gratis = servico.priceCents === 0;

            return (
              <li key={servico.id}>
                <button
                  type="button"
                  onClick={() => aoEscolher(servico)}
                  className="lista-btn grid-cols-[1fr_auto] gap-x-3 md:min-h-16 md:grid-cols-[1fr_120px]"
                >
                  <span className="flex flex-col gap-0.5">
                    <span className="text-lg leading-6 font-semibold text-tinta">{servico.name}</span>
                    {/* --tinta-2, nunca --tinta-3: duração e preço são informação
                        de decisão, não enfeite (P2 da direção). */}
                    <span className="text-sm leading-5 text-tinta-2">
                      {formatDuration(servico.durationMinutes)}
                    </span>
                  </span>
                  <span
                    className={
                      gratis
                        ? 'text-right text-base leading-6 font-bold text-ok'
                        : 'text-right text-lg leading-6 font-bold text-tinta'
                    }
                  >
                    {preco}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
