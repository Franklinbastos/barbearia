import { EsqueletoDeLinha } from '@/components/ui/esqueleto-de-linha';
import { Largura } from '@/components/ui/largura';

export default function CarregandoFichaDoCliente() {
  return (
    // Mesma régua da ficha que ele antecede, senão o histórico salta de largura
    // quando chega.
    <Largura tipo="tabela" className="flex flex-col gap-6">
      <EsqueletoDeLinha altura={44} quantidade={1} />
      <EsqueletoDeLinha altura={72} quantidade={4} />
    </Largura>
  );
}
