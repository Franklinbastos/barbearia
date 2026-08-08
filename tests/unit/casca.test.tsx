// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PanelNav } from '@/components/panel-nav';

describe('PanelNav', () => {
  const props = { nomeDaLoja: 'Barbearia do Marcão', ativo: '/app/agenda' };

  it('lista as cinco seções do painel', () => {
    render(<PanelNav {...props} />);
    for (const secao of ['Agenda', 'Serviços', 'Equipe', 'Clientes', 'Configurações']) {
      expect(screen.getByRole('link', { name: secao })).toBeDefined();
    }
  });

  it('marca a seção ativa por aria-current, não só por peso da fonte', () => {
    render(<PanelNav {...props} />);
    expect(screen.getByRole('link', { name: 'Agenda' }).getAttribute('aria-current')).toBe('page');
  });

  it('oferece sair da conta — hoje não existe logout em lugar nenhum', () => {
    render(<PanelNav {...props} />);
    expect(screen.getByRole('button', { name: /sair/i })).toBeDefined();
  });

  it('a nav é rolável por dentro, não empurra a página', () => {
    const { container } = render(<PanelNav {...props} />);
    const nav = container.querySelector('nav');
    expect(nav?.className).toMatch(/overflow-x-auto|nav-rolavel/);
  });
});
