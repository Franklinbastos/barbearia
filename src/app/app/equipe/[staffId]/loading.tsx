import { EsqueletoDeLinha } from '@/components/ui/esqueleto-de-linha';

/**
 * O nome do barbeiro é justamente o que ainda não se sabe, então aqui o
 * cabeçalho também é esqueleto — e nas alturas certas, para a tela não pular.
 */
export default function CarregandoBarbeiro() {
  return (
    <div className="flex max-w-[720px] flex-col gap-6">
      <EsqueletoDeLinha altura={44} quantidade={1} />
      <EsqueletoDeLinha altura={72} quantidade={3} />
      <EsqueletoDeLinha altura={140} quantidade={3} />
    </div>
  );
}
