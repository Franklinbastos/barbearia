import { CabecalhoDePagina } from '@/components/ui/cabecalho-de-pagina';
import { EsqueletoDeLinha } from '@/components/ui/esqueleto-de-linha';

export default function CarregandoConfiguracoes() {
  return (
    <div className="flex flex-col gap-4">
      <CabecalhoDePagina
        titulo="Configurações"
        descricao="O endereço público da loja e as regras da agenda."
      />
      <div className="max-w-[520px] flex flex-col gap-3">
        <EsqueletoDeLinha altura={72} quantidade={1} />
        <EsqueletoDeLinha altura={76} quantidade={5} />
      </div>
    </div>
  );
}
