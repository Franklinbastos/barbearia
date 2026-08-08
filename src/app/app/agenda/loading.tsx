import { EsqueletoDeLinha } from '@/components/ui/esqueleto-de-linha';

/**
 * O primeiro `loading.tsx` do projeto, e ele nasce na tela mais aberta.
 *
 * Desenha a barra de data e seis linhas na altura final do cartão (76px): a
 * tela não pula quando os dados chegam, e não há spinner nenhum — girar um
 * disco não conta quanto falta.
 */
export default function CarregandoAgenda() {
  return (
    <div>
      <div className="-mx-3 mb-2 md:-mx-5">
        <div
          className="flex h-16 flex-col justify-center gap-1 px-3 md:px-5"
          style={{ borderBottom: '1px solid var(--linha)' }}
        >
          <div className="grid h-11 grid-cols-[44px_1fr_44px_44px] items-center gap-2">
            <div className="esqueleto h-11" />
            <div className="esqueleto h-11" />
            <div className="esqueleto h-11" />
            <div className="esqueleto h-11" />
          </div>
          <div className="esqueleto h-4 w-40" />
        </div>
      </div>

      <EsqueletoDeLinha altura={76} quantidade={6} />
    </div>
  );
}
