// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CartaoIndicador } from './cartao-indicador';

/**
 * O princípio nº 3 do spec e a §5.12 da direção de UI: **cada card explica o
 * cálculo ao ser tocado**. "Ao ser tocado" é literal — o dono usa isto no
 * celular, e uma explicação que só abre no hover não existe para ele.
 *
 * O `Tooltip` do base-ui não serve: a própria documentação do pacote diz que
 * "tooltips are disabled on touch devices" e manda usar `Popover` com
 * `openOnHover` para o ícone de informação. Estes casos são o que impede a
 * troca de volta.
 */

const EXPLICACAO = 'Minutos ocupados ÷ minutos disponíveis.';

function renderizar() {
  return render(
    <CartaoIndicador
      titulo="Ocupação"
      valor="68%"
      apoio="3 h de cadeira vaga"
      explicacao={EXPLICACAO}
    />,
  );
}

function alvoDaExplicacao() {
  return screen.getByRole('button', { name: /como ocupação é calculado/i });
}

describe('CartaoIndicador', () => {
  it('mostra título, número e apoio', () => {
    renderizar();
    expect(screen.getByText('Ocupação')).toBeTruthy();
    expect(screen.getByText('68%')).toBeTruthy();
    expect(screen.getByText('3 h de cadeira vaga')).toBeTruthy();
  });

  it('a explicação não fica na tela antes de alguém pedir', () => {
    renderizar();
    expect(screen.queryByText(EXPLICACAO)).toBeNull();
  });

  it('abre no clique — sem hover nenhum, que é o que o dedo tem', async () => {
    renderizar();
    // `fireEvent.click` dispara só o clique: nada de `mouseover`, que é o
    // caminho que o tooltip usava e o celular não tem.
    fireEvent.click(alvoDaExplicacao());
    expect(await screen.findByText(EXPLICACAO)).toBeTruthy();
  });

  it('abre no toque', async () => {
    renderizar();
    await userEvent.pointer({ keys: '[TouchA]', target: alvoDaExplicacao() });
    expect(await screen.findByText(EXPLICACAO)).toBeTruthy();
  });

  it('o alvo é um botão com nome acessível — quem usa leitor de tela também chega lá', () => {
    renderizar();
    expect(alvoDaExplicacao().tagName).toBe('BUTTON');
  });

  it('a comparação carrega o sentido em palavra, não só em cor', () => {
    render(
      <CartaoIndicador
        titulo="Faturamento"
        valor="R$ 100"
        explicacao="Soma dos concluídos."
        comparacao={{ valor: '+18% que a semana passada', melhorou: true }}
      />,
    );
    expect(screen.getByText('melhor que')).toBeTruthy();
  });
});
