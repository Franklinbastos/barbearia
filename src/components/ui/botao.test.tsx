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

describe('Botao — contrato preservado na migração', () => {
  /**
   * Este caso exigia `--tap-md` (52px), a altura de balcão da direção de UI
   * antiga. Em 13/08/2026 o dono decidiu o contrário: fidelidade ao shadcn vence
   * a densidade, e o botão passou a medir o degrau mais alto que a lib tem —
   * `size="lg"`, que no base-nova é `h-9` (36px). O caso fica com o valor novo,
   * porque o que ele realmente guarda continua valendo: a altura é decidida
   * dentro do componente, e não sobra dos 24px que o preflight deixa.
   */
  it('mantém a altura da lib, não a de balcão', () => {
    render(<Botao>Agendar</Botao>);
    const b = screen.getByRole('button', { name: 'Agendar' });
    expect(b.className.split(/\s+/)).toContain('h-9');
  });

  it('aceita className de fora sem perder o que vem de dentro', () => {
    render(<Botao className="w-40">Agendar</Botao>);
    expect(screen.getByRole('button').className).toMatch(/w-40/);
  });

  it('as seis variantes continuam existindo', () => {
    for (const v of ['primario', 'secundario', 'ok', 'perigo', 'perigo-vazado', 'texto'] as const) {
      const { unmount } = render(<Botao variante={v}>X</Botao>);
      expect(screen.getByRole('button')).toBeDefined();
      unmount();
    }
  });

  /**
   * Este caso era o inverso: ele listava as decisões de aparência do base-nova e
   * exigia que **nenhuma** sobrevivesse ao `cn()`, porque um bloco
   * `DESFAZ_O_BASE_NOVA` anulava cada uma para preservar a direção de UI antiga.
   * Em 13/08/2026 o dono decidiu que a lib manda, o bloco saiu inteiro e o teste
   * perdeu o objeto.
   *
   * Invertido, ele continua útil e passa a guardar o contrário: fonte de 14px,
   * peso 500, transição, empurrão de 1px ao apertar, anel de foco da lib e
   * opacidade no desabilitado **têm** que chegar no elemento. Se alguém
   * reintroduzir desfazimento sem querer — um `text-base` ou um
   * `disabled:opacity-100` colado de fora —, a lista acusa na hora.
   */
  it('toda decisão de aparência do base-nova sobrevive ao cn()', () => {
    render(<Botao>Agendar</Botao>);
    const classes = screen.getByRole('button').className.split(/\s+/);

    for (const esperada of [
      'text-sm',
      'font-medium',
      'whitespace-nowrap',
      'shrink-0',
      'bg-clip-padding',
      'transition-all',
      'disabled:opacity-50',
      'active:not-aria-[haspopup]:translate-y-px',
      'focus-visible:ring-ring/50',
      'focus-visible:border-ring',
    ]) {
      expect(classes).toContain(esperada);
    }
  });

  /**
   * O `disabled:border-transparent` que este caso exigia era reposição nossa: a
   * `.btn:disabled` zerava a cor da borda, mas mora em `@layer components` e a
   * cor de cada variante era utilitário, que vence a camada inteira. Com o
   * desfazimento fora, o desabilitado passou a ser o da lib — `opacity-50` no
   * botão todo, borda incluída — e a reposição deixou de ter razão de existir.
   *
   * Invertido, o caso guarda que o apagamento do desabilitado é o da lib e que
   * ninguém reintroduziu a reposição por cima dele.
   */
  it('desabilitado apaga pela opacidade da lib, não pela borda transparente nossa', () => {
    render(
      <Botao variante="perigo" disabled>
        Cancelar
      </Botao>,
    );
    const classes = screen.getByRole('button').className.split(/\s+/);
    expect(classes).toContain('disabled:opacity-50');
    expect(classes).toContain('disabled:pointer-events-none');
    expect(classes).not.toContain('disabled:border-transparent');
  });

  /**
   * `perigo` era sólido — fundo cheio em `--perigo`, texto branco — e o
   * `variant={null}` existia justamente para a `destructive` do base-nova, que é
   * vazada (`bg-destructive/10` com texto na cor), não entrar. A tabela da Task 2
   * mapeou `perigo` em `destructive` de propósito, e a forma passou a ser a de
   * lá.
   *
   * **O matiz não mudou**: `--destructive: var(--perigo)` no `globals.css`, e é
   * `shadcn-nativo.test.ts` que guarda essa ponte. O que mudou é preenchimento,
   * que é forma. A asserção antiga casava por `btn--perigo`, classe que saiu
   * junto com o desfazimento.
   */
  it('a variante perigo é a destructive da lib, com o nosso vermelho por trás', () => {
    render(<Botao variante="perigo">Cancelar</Botao>);
    const classes = screen.getByRole('button').className.split(/\s+/);
    expect(classes).toContain('bg-destructive/10');
    expect(classes).toContain('text-destructive');
    expect(classes).not.toContain('btn--perigo');
  });

  /**
   * Cinco botões do encaixe (`manual-booking-form.tsx`) vivem dentro do
   * `<form>` sem `type` e valem como submit. O `Button` do base-ui embute
   * `type="button"` por padrão; sem esta guarda a migração muda o que cada
   * toque faz, o que é pior que mudar cor.
   */
  it('sem type explícito continua valendo como submit', () => {
    render(<Botao>Salvar</Botao>);
    expect((screen.getByRole('button') as HTMLButtonElement).type).toBe('submit');
  });
});
