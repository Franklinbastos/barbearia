'use client';

import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { cva } from 'class-variance-authority';

import { cn } from '@/lib/utils';
import { Botao } from './botao';

/**
 * Confirmação em dois tempos — substitui **todo** `confirm()` do projeto.
 *
 * O diálogo do navegador não é estilizável, some sob a WebView do WhatsApp,
 * chega em inglês em parte dos aparelhos e não diz de qual barbearia está
 * falando. Aqui o próprio botão troca de função: o primeiro toque arma, o
 * segundo executa, e depois de `segundos` sem confirmação ele volta sozinho ao
 * rótulo original — ninguém fica com um botão perigoso armado na tela.
 *
 * A troca de rótulo é anunciada por `aria-live="polite"`: para quem usa leitor
 * de tela, um botão que muda de função sem avisar é uma armadilha.
 *
 * **Por que não veio do shadcn.** O `alert-dialog` é o equivalente de catálogo
 * e resolve outro problema: ele abre uma segunda superfície flutuante, e a §4.3
 * trava a folha inferior como a única do produto. O gesto daqui é o botão
 * virando a própria confirmação, sob o mesmo dedo. Por dentro segue o padrão da
 * casa — `cva`, `cn` e `data-slot` — e compõe o `<Botao>`, que é quem carrega a
 * altura de balcão e o estado pendente.
 */
export type BotaoDeConfirmacaoProps = Omit<
  ComponentProps<typeof Botao>,
  'variante' | 'children' | 'onClick'
> & {
  /** "Cancelar meu horário" */
  rotulo: string;
  /** "Confirmar cancelamento" */
  rotuloConfirmar: string;
  aoConfirmar: () => void;
  /** Padrão 4 — depois volta sozinho ao rótulo original. */
  segundos?: number;
  variante?: 'perigo' | 'secundario';
};

/**
 * Armado ele é o único destino do olho: o rótulo engrossa e a variante vira
 * `perigo` cheio, para o segundo toque não ser distraído.
 */
export const botaoDeConfirmacaoVariants = cva('', {
  variants: {
    armado: { true: 'font-bold', false: '' },
  },
  defaultVariants: { armado: false },
});

export function BotaoDeConfirmacao({
  rotulo,
  rotuloConfirmar,
  aoConfirmar,
  segundos = 4,
  pendente = false,
  variante = 'perigo',
  className,
  ...resto
}: BotaoDeConfirmacaoProps) {
  const [armado, setArmado] = useState(false);
  const relogio = useRef<ReturnType<typeof setTimeout> | null>(null);

  function desarmar() {
    if (relogio.current !== null) {
      clearTimeout(relogio.current);
      relogio.current = null;
    }
    setArmado(false);
  }

  // Desmontar com o relógio correndo é o caso comum: o clique de confirmação
  // troca a tela inteira.
  useEffect(() => {
    return () => {
      if (relogio.current !== null) clearTimeout(relogio.current);
    };
  }, []);

  function aoTocar() {
    if (pendente) return;

    if (!armado) {
      setArmado(true);
      relogio.current = setTimeout(() => {
        relogio.current = null;
        setArmado(false);
      }, segundos * 1000);
      return;
    }

    desarmar();
    aoConfirmar();
  }

  return (
    <Botao
      {...resto}
      data-slot="botao-de-confirmacao"
      type="button"
      variante={armado ? 'perigo' : variante}
      onClick={aoTocar}
      pendente={pendente}
      className={cn(botaoDeConfirmacaoVariants({ armado }), className)}
    >
      <span data-slot="botao-de-confirmacao-rotulo" aria-live="polite">
        {armado ? rotuloConfirmar : rotulo}
      </span>
    </Botao>
  );
}
