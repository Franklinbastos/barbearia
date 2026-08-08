import { EsqueletoDeLinha } from '@/components/ui/esqueleto-de-linha';

export default function CarregandoFichaDoCliente() {
  return (
    <div className="flex max-w-[720px] flex-col gap-6">
      <EsqueletoDeLinha altura={44} quantidade={1} />
      <EsqueletoDeLinha altura={72} quantidade={4} />
    </div>
  );
}
