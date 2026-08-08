/**
 * Iniciais no lugar da foto que não existe: `staff.photoUrl` é `null` em 100%
 * das linhas, e uma lista de barbeiros sem nenhuma âncora visual é só texto.
 *
 * Quadrado de canto reto, como todo o resto do produto — círculo lê como
 * aplicativo de loja. Fica `aria-hidden`: o nome está sempre escrito ao lado, e
 * o leitor de tela não precisa ouvir as iniciais duas vezes.
 */
export type MonogramaProps = { nome: string; tamanho?: 40 | 56 };

const CLASSE_DO_TAMANHO: Record<40 | 56, string> = {
  40: 'h-10 w-10 text-base',
  56: 'h-14 w-14 text-lg',
};

export function iniciaisDe(nome: string): string {
  const palavras = nome.trim().split(/\s+/).filter(Boolean);
  if (palavras.length === 0) return '';
  const primeira = palavras[0][0] ?? '';
  const ultima = palavras.length > 1 ? (palavras[palavras.length - 1][0] ?? '') : '';
  return (primeira + ultima).toUpperCase();
}

export function Monograma({ nome, tamanho = 40 }: MonogramaProps) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-cx bg-superficie-2 font-bold text-tinta-2 ${CLASSE_DO_TAMANHO[tamanho]}`}
    >
      {iniciaisDe(nome)}
    </span>
  );
}
