// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Bloco } from './bloco';

describe('Bloco', () => {
  it('papel alert vira role=alert — é o que o leitor de tela anuncia na hora', () => {
    render(
      <Bloco tom="perigo" papel="alert">
        Não deu
      </Bloco>,
    );
    expect(screen.getByRole('alert').textContent).toBe('Não deu');
  });

  it('papel status vira role=status', () => {
    render(
      <Bloco tom="ok" papel="status">
        Salvo
      </Bloco>,
    );
    expect(screen.getByRole('status').textContent).toBe('Salvo');
  });

  it('sem papel não vira região anunciada', () => {
    // O `alert` do shadcn embute `role="alert"` no elemento. Onze dos treze usos
    // do Bloco são texto informativo parado na tela; anunciá-los na hora é ruído.
    render(<Bloco>Informação comum</Bloco>);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });

  /**
   * A cor de cada tom vinha das classes `.bloco--*` do `globals.css`. Desde
   * 13/08/2026 a caixa é o `alert` do base-nova, e o `bg-card` do `default` chega
   * como utilitário — que vence a camada de componente inteira, especificidade à
   * parte. Por isso o fundo de estado também virou utilitário. As classes
   * `.bloco--*` continuam no `globals.css` para os usos crus da página pública;
   * o que mudou é por onde o componente pinta.
   *
   * O que o caso guarda é o mesmo de antes: os cinco tons existem e cada um leva
   * a própria cor, sem dois caírem no mesmo fundo.
   */
  it('os cinco tons existem e cada um leva a própria cor', () => {
    const FUNDO_DO_TOM = {
      info: 'bg-card',
      ok: 'bg-ok-bg',
      perigo: 'bg-perigo-bg',
      alerta: 'bg-alerta-bg',
      agora: 'bg-agora-bg',
    } as const;

    for (const [tom, fundo] of Object.entries(FUNDO_DO_TOM)) {
      const { container, unmount } = render(
        <Bloco tom={tom as keyof typeof FUNDO_DO_TOM}>X</Bloco>,
      );
      const classes = (container.firstElementChild as HTMLElement).className.split(/\s+/);
      expect(screen.getByText('X')).toBeDefined();
      expect(classes).toContain(fundo);
      // a borda de estado acompanha o fundo — `info` fica com a da lib
      if (tom !== 'info') expect(classes).toContain(`border-${tom}`);
      unmount();
    }
  });

  it('a ação aparece dentro do bloco', () => {
    render(<Bloco acao={<button>Tentar de novo</button>}>Falhou</Bloco>);
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeDefined();
  });

  /**
   * A escala desceu um degrau inteiro em 13/08/2026: o normal era 16px com
   * recheio de 16px (`text-base p-4`) e passou a ser o do `alert` da lib — 14px
   * com `px-2.5 py-2`. O compacto, que era 14px, desceu junto para 12px.
   * O caso fica: o que ele guarda é que os dois degraus continuam existindo e
   * que o compacto é mesmo menor que o normal.
   */
  it('compacto encolhe o texto e o recheio, e o normal não', () => {
    const compactoClasses = (
      render(<Bloco compacto>X</Bloco>).container.firstElementChild as HTMLElement
    ).className;
    expect(compactoClasses).toMatch(/\btext-xs\b/);
    expect(compactoClasses).toMatch(/\bpx-2\b/);
    expect(compactoClasses).toMatch(/\bpy-1\.5\b/);

    const normalClasses = (render(<Bloco>X</Bloco>).container.firstElementChild as HTMLElement)
      .className;
    expect(normalClasses).toMatch(/\btext-sm\b/);
    expect(normalClasses).toMatch(/\bpx-2\.5\b/);
    expect(normalClasses).toMatch(/\bpy-2\b/);
  });

  /**
   * Este caso era o inverso: ele exigia que o `grid`, a largura total, o
   * alinhamento à esquerda e a borda dos quatro lados do base-nova fossem
   * desfeitos, para preservar a barra de 4px na esquerda que era a marca visual
   * do bloco na direção antiga. Em 13/08/2026 o dono decidiu que a lib manda, o
   * desfazimento saiu inteiro e o teste perdeu o objeto.
   *
   * Invertido, ele guarda que a forma da lib chega inteira — e que ninguém
   * ressuscitou a barra de 4px por engano.
   */
  it('as decisões de aparência do base-nova sobrevivem ao cn()', () => {
    const { container } = render(<Bloco>X</Bloco>);
    const classes = (container.firstElementChild as HTMLElement).className;
    const lista = classes.split(/\s+/);
    expect(lista).toContain('grid');
    expect(lista).toContain('w-full');
    expect(lista).toContain('text-left');
    expect(lista).toContain('border');
    expect(classes).not.toMatch(/\bborder-l-4\b/);
    expect(classes).not.toMatch(/\[text-align:inherit\]/);
  });
});
