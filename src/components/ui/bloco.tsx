import type { ReactNode } from 'react';

/**
 * Toda caixa de mensagem do produto: informação, confirmação, erro, alerta e
 * "acontecendo agora".
 *
 * Substitui os três tons de alerta inline que estavam espalhados por 11
 * arquivos, nenhum deles legível no tema escuro.
 *
 * `papel` vira `role`: `'alert'` para o erro que o usuário precisa ouvir agora,
 * `'status'` para a confirmação que pode esperar a pausa do leitor de tela.
 */
export type BlocoProps = {
  tom?: 'info' | 'ok' | 'perigo' | 'alerta' | 'agora';
  papel?: 'alert' | 'status';
  compacto?: boolean;
  /** Botão abaixo do texto. */
  acao?: ReactNode;
  children: ReactNode;
};

export function Bloco({ tom = 'info', papel, compacto = false, acao, children }: BlocoProps) {
  const classes = ['bloco', tom === 'info' ? '' : `bloco--${tom}`, compacto ? 'bloco--compacto' : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div role={papel} className={classes}>
      {children}
      {acao ? <div className="mt-3">{acao}</div> : null}
    </div>
  );
}
