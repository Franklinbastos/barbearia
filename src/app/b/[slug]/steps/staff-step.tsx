import { Botao } from '@/components/ui/botao';
import { Bloco } from '@/components/ui/bloco';
import { Monograma } from '@/components/ui/monograma';
import type { CatalogStaff } from '../types';

/**
 * Etapa 2: escolha do barbeiro (§5.3 da direção de UI).
 *
 * "Qualquer barbeiro" vem primeiro e deliberadamente maior: é a opção mais
 * rápida para o cliente e a única que liga o desempate por carga do servidor
 * (`escolherBarbeiro`). O texto é literal — o e2e clica por esse nome.
 *
 * Sem foto: `staff.photoUrl` é `null` em 100% das linhas, então a âncora visual
 * de cada barbeiro é o `<Monograma>`.
 */
export function StaffStep({
  equipe,
  servicoId,
  aoEscolher,
  aoVoltar,
}: {
  equipe: CatalogStaff[];
  servicoId: string;
  aoEscolher: (staffId: string | undefined, staffName: string | undefined) => void;
  aoVoltar: () => void;
}) {
  const atendem = equipe.filter((barbeiro) => barbeiro.serviceIds.includes(servicoId));

  return (
    <section>
      <Botao variante="texto" onClick={aoVoltar}>
        <span aria-hidden="true">←</span> Voltar
      </Botao>

      <h2 className="mt-4 mb-3 text-[22px] leading-7 font-bold">
        <span aria-hidden="true" className="mb-2 block h-[3px] w-8 bg-marca" />
        Escolha o barbeiro
      </h2>

      {/* Aresta de 6px em --marca e borda de 2px em --tinta: os dois únicos
          lugares da etapa onde a cor da loja aparece (§3.4). */}
      <button
        type="button"
        onClick={() => aoEscolher(undefined, undefined)}
        className="flex min-h-[88px] w-full flex-col justify-center gap-1 rounded-cx border-2 border-l-[6px] border-tinta border-l-marca bg-marca-suave p-4 text-left"
      >
        <span className="text-lg leading-6 font-bold text-tinta">Qualquer barbeiro</span>
        <span className="text-sm leading-5 text-tinta-2">Mais horários livres</span>
      </button>

      {atendem.length === 0 ? (
        <div className="mt-4">
          <Bloco
            tom="alerta"
            acao={
              <Botao variante="secundario" onClick={aoVoltar}>
                Escolher outro serviço
              </Botao>
            }
          >
            Nenhum barbeiro disponível para esse serviço no momento.
          </Bloco>
        </div>
      ) : (
        <>
          <p className="mt-5 mb-2 text-xs leading-4 font-bold tracking-[0.06em] text-tinta-3 uppercase">
            Ou escolha quem vai te atender
          </p>

          <ul className="lista">
            {atendem.map((barbeiro) => (
              <li key={barbeiro.id}>
                <button
                  type="button"
                  onClick={() => aoEscolher(barbeiro.id, barbeiro.name)}
                  className="lista-btn grid-cols-[40px_1fr] gap-x-3 md:min-h-16"
                >
                  <Monograma nome={barbeiro.name} />
                  <span className="text-lg leading-6 font-semibold text-tinta">{barbeiro.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
