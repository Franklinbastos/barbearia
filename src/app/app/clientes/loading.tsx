import { CabecalhoDePagina } from '@/components/ui/cabecalho-de-pagina';
import { EsqueletoDeLinha } from '@/components/ui/esqueleto-de-linha';
import { Largura } from '@/components/ui/largura';

export default function CarregandoClientes() {
  return (
    <div className="flex flex-col gap-4">
      <CabecalhoDePagina titulo="Clientes" descricao="Quem já passou pela cadeira, com o telefone à mão." />
      {/* O mesmo degrau da tela pronta: esqueleto mais estreito que a lista faz
          o conteúdo saltar de largura no instante em que carrega. */}
      <Largura tipo="tabela">
        <EsqueletoDeLinha altura={72} quantidade={4} />
      </Largura>
    </div>
  );
}
