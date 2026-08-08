import { CabecalhoDePagina } from '@/components/ui/cabecalho-de-pagina';
import { EsqueletoDeLinha } from '@/components/ui/esqueleto-de-linha';

export default function CarregandoClientes() {
  return (
    <div className="flex flex-col gap-4">
      <CabecalhoDePagina titulo="Clientes" descricao="Quem já passou pela cadeira, com o telefone à mão." />
      <div className="max-w-[720px]">
        <EsqueletoDeLinha altura={72} quantidade={4} />
      </div>
    </div>
  );
}
