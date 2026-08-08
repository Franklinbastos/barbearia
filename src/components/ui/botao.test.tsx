// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Botao } from './botao';

describe('Botao', () => {
  it('é um button de verdade com o texto acessível', () => {
    render(<Botao>Agendar</Botao>);
    expect(screen.getByRole('button', { name: 'Agendar' })).toBeDefined();
  });

  it('quando pendente, desabilita e troca o rótulo', () => {
    render(<Botao pendente rotuloPendente="Agendando…">Agendar</Botao>);
    const b = screen.getByRole('button');
    expect(b.hasAttribute('disabled')).toBe(true);
    expect(b.textContent).toBe('Agendando…');
  });

  it('sem rotuloPendente mantém o texto original e ainda desabilita', () => {
    render(<Botao pendente>Salvar</Botao>);
    const b = screen.getByRole('button');
    expect(b.hasAttribute('disabled')).toBe(true);
    expect(b.textContent).toBe('Salvar');
  });

  it('repassa type e onClick sem engolir', () => {
    render(<Botao type="submit">Enviar</Botao>);
    expect(screen.getByRole('button').getAttribute('type')).toBe('submit');
  });
});
