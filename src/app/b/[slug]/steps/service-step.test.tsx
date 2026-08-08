// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ServiceStep } from './service-step';

const servicos = [
  { id: 's1', name: 'Corte', durationMinutes: 30, priceCents: 4500 },
  { id: 's2', name: 'Luzes', durationMinutes: 90, priceCents: 15000 },
];

describe('ServiceStep', () => {
  it('cada serviço é um botão cujo nome acessível traz duração e preço', () => {
    render(<ServiceStep servicos={servicos} aoEscolher={vi.fn()} />);
    const b = screen.getByRole('button', { name: /corte/i });
    expect(b.textContent).toMatch(/30 min/);
    expect(b.textContent).toMatch(/R\$\s?45,00/);
  });

  it('mostra hora e minuto para serviço longo', () => {
    render(<ServiceStep servicos={servicos} aoEscolher={vi.fn()} />);
    expect(screen.getByRole('button', { name: /luzes/i }).textContent).toMatch(/1 h 30 min/);
  });

  it('sem serviço cadastrado, explica em vez de mostrar lista vazia', () => {
    render(<ServiceStep servicos={[]} aoEscolher={vi.fn()} />);
    expect(screen.getByText(/ainda não está disponível/i)).toBeDefined();
  });
});
