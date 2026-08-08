// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Segmentado } from './segmentado';

const OPCOES = [
  { valor: 'agora', rotulo: 'Agora' },
  { valor: 'marcar', rotulo: 'Marcar hora' },
] as const;

function montar(valor: 'agora' | 'marcar' = 'agora') {
  const aoTrocar = vi.fn();
  render(
    <Segmentado
      rotuloDoGrupo="Modo do encaixe"
      opcoes={[...OPCOES]}
      valor={valor}
      aoTrocar={aoTrocar}
    />,
  );
  return { aoTrocar };
}

describe('Segmentado', () => {
  it('é um grupo rotulado, não dois botões soltos', () => {
    montar();
    expect(screen.getByRole('group', { name: 'Modo do encaixe' })).toBeDefined();
  });

  it('marca o modo ativo com aria-pressed', () => {
    montar('agora');
    expect(screen.getByRole('button', { name: 'Agora' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Marcar hora' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
  });

  it('troca de modo com um toque', async () => {
    const { aoTrocar } = montar('agora');
    await userEvent.click(screen.getByRole('button', { name: 'Marcar hora' }));
    expect(aoTrocar).toHaveBeenCalledWith('marcar');
  });

  it('tocar no modo que já está ativo não troca nada', async () => {
    const { aoTrocar } = montar('agora');
    await userEvent.click(screen.getByRole('button', { name: 'Agora' }));
    expect(aoTrocar).not.toHaveBeenCalled();
  });

  it('cada modo carrega a própria altura de balcão (--tap-md, 52px na §3.1)', () => {
    // A altura vem do controle, não de classe utilitária colada pela tela: é a
    // diferença entre um alvo de 52px e o texto de 24px que o preflight deixa.
    montar();
    for (const rotulo of ['Agora', 'Marcar hora']) {
      const botao = screen.getByRole('button', { name: rotulo });
      expect(botao.style.minHeight).toBe('var(--tap-md)');
    }
  });
});
