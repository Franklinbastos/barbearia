// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Campo } from './campo';

describe('Campo', () => {
  it('o rótulo encontra o controle — é assim que o e2e acha o campo', () => {
    render(
      <Campo rotulo="Seu nome">
        <input name="nome" />
      </Campo>,
    );
    expect(screen.getByLabelText('Seu nome')).toBeDefined();
  });

  it('erro vira mensagem anunciada', () => {
    render(
      <Campo rotulo="Telefone" erro="Informe um telefone com DDD">
        <input />
      </Campo>,
    );
    const alerta = screen.getByRole('alert');
    expect(alerta.textContent).toBe('Informe um telefone com DDD');
  });

  it('sem erro não renderiza alerta vazio', () => {
    render(
      <Campo rotulo="Telefone">
        <input />
      </Campo>,
    );
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('prefixo é elemento real, não placeholder', () => {
    render(
      <Campo rotulo="Preço" prefixo="R$">
        <input />
      </Campo>,
    );
    expect(screen.getByText('R$')).toBeDefined();
  });

  it('mantém a altura de balcão', () => {
    const { container } = render(
      <Campo rotulo="Seu nome">
        <input />
      </Campo>,
    );
    const input = container.querySelector('input');
    expect(input?.className ?? '').toMatch(/tap-md|h-\[52px\]/);
  });

  /**
   * A altura, a borda, o raio e os 16px que impedem o zoom do iOS vêm do
   * seletor `.campo > input` da §3.1. Se o controle deixar de ser filho direto
   * do contêiner `.campo`, o campo inteiro perde a moldura de uma vez só — e
   * nenhum teste de rótulo pega isso.
   */
  it('o controle continua filho direto de .campo', () => {
    const { container } = render(
      <Campo rotulo="Seu nome">
        <input />
      </Campo>,
    );
    expect(container.querySelector('.campo > input')).not.toBeNull();
  });

  it('com prefixo o controle sai de baixo do seletor e a moldura passa a ser do invólucro', () => {
    const { container } = render(
      <Campo rotulo="Preço" prefixo="R$">
        <input />
      </Campo>,
    );
    expect(container.querySelector('.campo > input')).toBeNull();
    expect(container.querySelector('input')?.className ?? '').toMatch(/border-0/);
  });

  it('o erro liga a borda de erro do contêiner', () => {
    const { container } = render(
      <Campo rotulo="Telefone" erro="Faltou o DDD">
        <input />
      </Campo>,
    );
    expect(container.querySelector('.campo--erro')).not.toBeNull();
  });

  it('dica e erro são descrições ligadas ao controle', () => {
    render(
      <Campo rotulo="Notas" dica="Só a equipe vê." erro="Escreva alguma coisa">
        <textarea />
      </Campo>,
    );
    const controle = screen.getByLabelText('Notas');
    const descritores = (controle.getAttribute('aria-describedby') ?? '').split(/\s+/);
    expect(descritores.length).toBe(2);
    for (const id of descritores) {
      expect(document.getElementById(id)).not.toBeNull();
    }
  });

  it('não atropela o id que o chamador já tinha dado ao controle', () => {
    render(
      <Campo rotulo="Seu nome">
        <input id="nome-do-cliente" />
      </Campo>,
    );
    expect(screen.getByLabelText('Seu nome').getAttribute('id')).toBe('nome-do-cliente');
  });

  it('marca o controle como inválido quando há erro', () => {
    render(
      <Campo rotulo="Telefone" erro="Faltou o DDD">
        <input />
      </Campo>,
    );
    expect(screen.getByLabelText('Telefone').getAttribute('aria-invalid')).toBe('true');
  });

  /**
   * O `field`, o `label` e o `input` do base-nova trazem tipografia própria —
   * 14px sem entrelinha, peso 500, cinza de texto secundário e um recuo
   * negativo na descrição. A §3.1 já decidiu outra coisa para cada um deles.
   * Se alguma dessas classes sobreviver ao `cn()`, o campo mudou de cara.
   */
  it('nenhuma decisão de tipografia do base-nova sobrevive ao cn()', () => {
    const { container } = render(
      <Campo rotulo="Seu nome" dica="Como te chamam." erro="Escreva alguma coisa">
        <input />
      </Campo>,
    );

    const classesDe = (seletor: string) =>
      (container.querySelector(seletor)?.className ?? '').split(/\s+/);

    expect(classesDe('[data-slot=field]')).not.toContain('gap-2');
    expect(classesDe('[data-slot=field-label]')).not.toContain('leading-none');
    expect(classesDe('[data-slot=field-label]')).not.toContain('font-medium');
    expect(classesDe('[data-slot=field-description]')).not.toContain('text-muted-foreground');
    expect(classesDe('[data-slot=field-description]')).not.toContain('nth-last-2:-mt-1');
    expect(classesDe('[data-slot=field-error]')).not.toContain('font-normal');
  });
});
