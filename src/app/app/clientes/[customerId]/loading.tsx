import { EsqueletoDeLinha } from '@/components/ui/esqueleto-de-linha';
import { Largura } from '@/components/ui/largura';

export default function CarregandoFichaDoCliente() {
  return (
    // Mesma anatomia da ficha que ele antecede, régua por régua: identidade sem
    // teto, cartões em `leitura` e o histórico em `tabela` — esqueleto na
    // largura errada é o mesmo salto que ele existe para evitar.
    <div className="flex flex-col gap-6">
      {/* 84px é a identidade inteira: o "← Clientes" de 20, o respiro de 8 e a
          linha de 56 do monograma ao lado do nome e do telefone. */}
      <EsqueletoDeLinha altura={84} quantidade={1} />

      <Largura tipo="leitura">
        {/* A grade é a mesma dos quatro cartões. `aria-hidden` porque o bloco de
            cima já anunciou "Carregando…": quatro repetições da mesma frase são
            ruído para quem ouve a tela. */}
        <div aria-hidden="true" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <EsqueletoDeLinha key={i} altura={132} quantidade={1} />
          ))}
        </div>
      </Largura>

      <Largura tipo="tabela" className="flex flex-col gap-6">
        <EsqueletoDeLinha altura={72} quantidade={4} />
      </Largura>
    </div>
  );
}
