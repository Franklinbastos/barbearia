import { CabecalhoDePagina } from '@/components/ui/cabecalho-de-pagina';
import { EsqueletoDeLinha } from '@/components/ui/esqueleto-de-linha';

export default function CarregandoEquipe() {
  return (
    <div className="flex flex-col gap-4">
      <CabecalhoDePagina titulo="Equipe" descricao="Quem atende, o expediente de cada um e quem está de fora." />
      <div className="max-w-[720px]">
        <EsqueletoDeLinha altura={72} quantidade={4} />
      </div>
    </div>
  );
}
