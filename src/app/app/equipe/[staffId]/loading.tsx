import { EsqueletoDeLinha } from '@/components/ui/esqueleto-de-linha';
import { Largura } from '@/components/ui/largura';

/**
 * O nome do barbeiro é justamente o que ainda não se sabe, então aqui o
 * cabeçalho também é esqueleto — e nas alturas certas, para a tela não pular.
 *
 * A largura é a mesma da tela que ele antecede, e por isso está declarada de
 * novo: `loading.tsx` é outra árvore de render, não herda o `<Largura>` do
 * `page.tsx`. Fora de sincronia, o conteúdo salta de largura no instante em que
 * chega — que é o mesmo defeito, só que em movimento.
 */
export default function CarregandoBarbeiro() {
  return (
    <Largura tipo="tabela" className="flex flex-col gap-6">
      <EsqueletoDeLinha altura={44} quantidade={1} />
      <EsqueletoDeLinha altura={72} quantidade={3} />
      <EsqueletoDeLinha altura={140} quantidade={3} />
    </Largura>
  );
}
