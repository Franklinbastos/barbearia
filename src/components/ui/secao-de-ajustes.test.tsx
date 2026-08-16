// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SecaoDeAjustes } from './secao-de-ajustes';

describe('SecaoDeAjustes', () => {
  it('o título fica FORA do card', () => {
    // é o defeito medido: "Nome da barbearia" em x=588 e "Endereço público" em
    // x=424, no mesmo card, porque metade do conteúdo respeitava uma coluna de
    // rótulo que a outra metade ignorava
    const { container } = render(
      <SecaoDeAjustes titulo="Identidade"><input aria-label="Nome" /></SecaoDeAjustes>,
    );
    const card = container.querySelector('[data-slot="card"]');
    expect(card).not.toBeNull();
    expect(card!.textContent).not.toContain('Identidade');
    expect(screen.getByRole('heading', { name: 'Identidade' })).toBeDefined();
  });

  it('a descrição é opcional', () => {
    const { container } = render(<SecaoDeAjustes titulo="Regras">x</SecaoDeAjustes>);
    expect(container.querySelector('[data-slot="secao-descricao"]')).toBeNull();
  });

  it('o título é h2 — a página já tem o h1', () => {
    render(<SecaoDeAjustes titulo="Identidade">x</SecaoDeAjustes>);
    expect(screen.getByRole('heading', { level: 2, name: 'Identidade' })).toBeDefined();
  });

  it('marca as partes com data-slot', () => {
    const { container } = render(
      <SecaoDeAjustes titulo="Identidade" descricao="O que o cliente vê.">x</SecaoDeAjustes>,
    );
    expect(container.querySelector('[data-slot="secao-de-ajustes"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="secao-titulo"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="secao-descricao"]')).not.toBeNull();
  });

  it('o título e a descrição andam juntos, fora do card', () => {
    // a descrição explica o título; separada dele por um espaço igual ao que a
    // separa do card, vira uma terceira coisa boiando acima dele
    const { container } = render(
      <SecaoDeAjustes titulo="Identidade" descricao="O que o cliente vê.">x</SecaoDeAjustes>,
    );
    const anotacao = container.querySelector('[data-slot="secao-anotacao"]');
    expect(anotacao?.querySelector('[data-slot="secao-titulo"]')).not.toBeNull();
    expect(anotacao?.querySelector('[data-slot="secao-descricao"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="card"]')!.textContent).not.toContain(
      'O que o cliente vê.',
    );
  });

  it('repassa className e props para a <section>', () => {
    // é `React.ComponentProps<'section'>`: quem monta a página precisa poder
    // dar um id à seção sem recopiar o componente
    const { container } = render(
      <SecaoDeAjustes titulo="Identidade" id="identidade" className="mt-8">
        x
      </SecaoDeAjustes>,
    );
    const secao = container.querySelector('[data-slot="secao-de-ajustes"]')!;
    expect(secao.id).toBe('identidade');
    expect(secao.className).toContain('mt-8');
    expect(secao.className).toContain('flex-col');
  });
});
