// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FolhaInferior } from './folha-inferior';

function abrir(extra: Partial<React.ComponentProps<typeof FolhaInferior>> = {}) {
  const aoFechar = vi.fn();
  render(
    <FolhaInferior aberta titulo="Encaixe" aoFechar={aoFechar} {...extra}>
      <button>Primeiro</button>
      <button>Último</button>
    </FolhaInferior>,
  );
  return { aoFechar };
}

describe('FolhaInferior', () => {
  it('é um diálogo modal rotulado pelo título', () => {
    abrir();
    const d = screen.getByRole('dialog');
    expect(d.getAttribute('aria-modal')).toBe('true');
    expect(d.getAttribute('aria-labelledby')).toBeTruthy();
    expect(screen.getByText('Encaixe')).toBeDefined();
  });

  it('põe o foco no primeiro elemento focável ao abrir', () => {
    abrir();
    expect(document.activeElement?.textContent).toBe('Primeiro');
  });

  it('Escape fecha', async () => {
    const { aoFechar } = abrir();
    await userEvent.keyboard('{Escape}');
    expect(aoFechar).toHaveBeenCalled();
  });

  it('com guarda de descarte, Escape não fecha direto', async () => {
    const { aoFechar } = abrir({ guardaDeDescarte: true });
    await userEvent.keyboard('{Escape}');
    expect(aoFechar).not.toHaveBeenCalled();
  });

  it('fechada não renderiza nada', () => {
    render(<FolhaInferior aberta={false} titulo="X" aoFechar={vi.fn()}><button>Y</button></FolhaInferior>);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('devolve o foco ao disparador quando fecha', async () => {
    function Cena() {
      const [aberta, setAberta] = React.useState(false);
      return (
        <>
          <button onClick={() => setAberta(true)}>Encaixe</button>
          <FolhaInferior aberta={aberta} titulo="Encaixe" aoFechar={() => setAberta(false)}>
            <button>Dentro</button>
          </FolhaInferior>
        </>
      );
    }
    render(<Cena />);
    const disparador = screen.getByRole('button', { name: 'Encaixe' });
    await userEvent.click(disparador);
    await userEvent.keyboard('{Escape}');
    expect(document.activeElement).toBe(disparador);
  });

  it('o conteúdo de fora fica inerte enquanto aberta', () => {
    render(
      <>
        <main><button>Fora</button></main>
        <FolhaInferior aberta titulo="Encaixe" aoFechar={() => {}}>
          <button>Dentro</button>
        </FolhaInferior>
      </>,
    );
    // com a folha aberta, o botão de fora não pode ser alcançável
    expect(screen.getByRole('button', { name: 'Dentro' })).toBeDefined();
    const fora = screen.queryByRole('button', { name: 'Fora' });
    expect(fora === null || fora.closest('[inert]') !== null).toBe(true);
  });
});
