import { CabecalhoDePagina } from '@/components/ui/cabecalho-de-pagina';
import { EsqueletoDeLinha } from '@/components/ui/esqueleto-de-linha';
import { Largura } from '@/components/ui/largura';

/** Mesmo degrau da página, senão a lista salta de largura quando o conteúdo chega. */
export default function CarregandoEquipe() {
  return (
    <Largura tipo="tabela" className="flex flex-col gap-4">
      <CabecalhoDePagina titulo="Equipe" descricao="Quem atende, o expediente de cada um e quem está de fora." />
      <EsqueletoDeLinha altura={72} quantidade={4} />
    </Largura>
  );
}
