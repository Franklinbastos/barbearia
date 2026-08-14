import { CabecalhoDePagina } from '@/components/ui/cabecalho-de-pagina';
import { EsqueletoDeLinha } from '@/components/ui/esqueleto-de-linha';
import { Largura } from '@/components/ui/largura';

export default function CarregandoConfiguracoes() {
  return (
    <div className="flex flex-col gap-4">
      <CabecalhoDePagina
        titulo="Configurações"
        descricao="O endereço público da loja e as regras da agenda."
      />
      {/* Dois blocos porque a tela que chega são dois cards — Identidade e
          Regras da agenda —, na mesma largura de leitura deles. Esqueleto mais
          estreito que o conteúdo faz a tela saltar no instante em que carrega. */}
      <Largura tipo="leitura">
        <EsqueletoDeLinha altura={280} quantidade={2} />
      </Largura>
    </div>
  );
}
