'use client';

/**
 * Aviso de falha de server action, colado no botão que disparou a ação.
 *
 * Fica num componente próprio porque a regra é sempre a mesma: nada de erro em
 * `console`, nada de tela em branco — o usuário precisa ver, no mesmo lugar em
 * que clicou, que a ação não aconteceu.
 */
export function ErroDeAcao({ mensagem }: { mensagem: string | null }) {
  if (!mensagem) return null;
  return (
    <span role="alert" style={{ color: 'crimson' }}>
      {mensagem}
    </span>
  );
}
