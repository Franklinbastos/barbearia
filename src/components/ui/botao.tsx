import type { ButtonHTMLAttributes } from 'react';

/**
 * O botão do produto inteiro.
 *
 * Existe porque o preflight do Tailwind zera fundo, borda e padding de
 * `<button>`: sem uma casa que carregue a altura, os ~60 botões do app viram
 * texto solto de 24px de alto. Altura é propriedade de componente, nunca
 * classe utilitária que alguém lembra de colar.
 *
 * `pendente` é a segunda razão: todo botão que dispara ação precisa desabilitar
 * e dizer que está trabalhando, e isso não pode depender de cada tela.
 */
export type BotaoProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: 'primario' | 'secundario' | 'ok' | 'perigo' | 'perigo-vazado' | 'texto';
  /** 'md' = 52px, 'lg' = 56px. Padrão 'md'. */
  tamanho?: 'md' | 'lg';
  largura?: 'auto' | 'total';
  /** Desabilita e troca o rótulo pelo `rotuloPendente`. */
  pendente?: boolean;
  rotuloPendente?: string;
};

const CLASSE_DA_VARIANTE: Record<NonNullable<BotaoProps['variante']>, string> = {
  primario: '',
  secundario: 'btn--sec',
  ok: 'btn--ok',
  perigo: 'btn--perigo',
  'perigo-vazado': 'btn--perigo-vazado',
  texto: 'btn--texto',
};

export function Botao({
  variante = 'primario',
  tamanho = 'md',
  largura = 'auto',
  pendente = false,
  rotuloPendente,
  className,
  disabled,
  children,
  ...resto
}: BotaoProps) {
  const classes = [
    'btn',
    CLASSE_DA_VARIANTE[variante],
    tamanho === 'lg' ? 'btn--lg' : '',
    largura === 'total' ? 'btn--tot' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      {...resto}
      className={classes}
      disabled={disabled || pendente}
      aria-busy={pendente || undefined}
    >
      {pendente && rotuloPendente ? rotuloPendente : children}
    </button>
  );
}
