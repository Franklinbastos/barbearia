'use client';

import { Bloco } from '@/components/ui/bloco';

/**
 * Aviso de falha de server action, colado no botão que disparou a ação.
 *
 * Fica num componente próprio porque a regra é sempre a mesma: nada de erro em
 * `console`, nada de tela em branco — o usuário precisa ver, no mesmo lugar em
 * que clicou, que a ação não aconteceu.
 *
 * A pele é o `<Bloco tom="perigo">`: a cor de erro inline que havia aqui (e em
 * mais dez arquivos) não passava no contraste do tema escuro.
 */
export function ErroDeAcao({ mensagem }: { mensagem: string | null | undefined }) {
  if (!mensagem) return null;
  return (
    <Bloco tom="perigo" papel="alert" compacto>
      {mensagem}
    </Bloco>
  );
}
