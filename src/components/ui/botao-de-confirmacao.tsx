'use client';

import { useEffect, useRef, useState } from 'react';
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
 */
export type BotaoDeConfirmacaoProps = {
  /** "Cancelar meu horário" */
  rotulo: string;
  /** "Confirmar cancelamento" */
  rotuloConfirmar: string;
  aoConfirmar: () => void;
  /** Padrão 4 — depois volta sozinho ao rótulo original. */
  segundos?: number;
  pendente?: boolean;
  /** Mostrado no lugar do rótulo enquanto `pendente` — "Cancelando…". */
  rotuloPendente?: string;
  variante?: 'perigo' | 'secundario';
};

export function BotaoDeConfirmacao({
  rotulo,
  rotuloConfirmar,
  aoConfirmar,
  segundos = 4,
  pendente = false,
  rotuloPendente,
  variante = 'perigo',
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
      type="button"
      variante={armado ? 'perigo' : variante}
      onClick={aoTocar}
      pendente={pendente}
      rotuloPendente={rotuloPendente}
      // Armado ele é o único destino do olho: some a borda vazada e vira
      // preenchimento cheio, para o segundo toque não ser distraído.
      className={armado ? 'font-bold' : undefined}
    >
      <span aria-live="polite">{armado ? rotuloConfirmar : rotulo}</span>
    </Botao>
  );
}
