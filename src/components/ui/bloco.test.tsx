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

  it('os cinco tons existem e cada um leva a própria classe', () => {
    for (const tom of ['info', 'ok', 'perigo', 'alerta', 'agora'] as const) {
      const { container, unmount } = render(<Bloco tom={tom}>X</Bloco>);
      const caixa = container.firstElementChild as HTMLElement;
      expect(screen.getByText('X')).toBeDefined();
      expect(caixa.className).toContain('bloco');
      if (tom !== 'info') expect(caixa.className).toContain(`bloco--${tom}`);
      unmount();
    }
  });

  it('a ação aparece dentro do bloco', () => {
    render(<Bloco acao={<button>Tentar de novo</button>}>Falhou</Bloco>);
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeDefined();
  });

  it('compacto encolhe o texto e o recheio, e o normal não', () => {
    const { container: compacto } = render(<Bloco compacto>X</Bloco>);
    expect((compacto.firstElementChild as HTMLElement).className).toMatch(/\btext-sm\b/);

    const { container: normal } = render(<Bloco>X</Bloco>);
    const classes = (normal.firstElementChild as HTMLElement).className;
    expect(classes).toMatch(/\btext-base\b/);
    expect(classes).toMatch(/\bp-4\b/);
  });

  it('desfaz as decisões de aparência do base-nova', () => {
    // Cada uma destas mudaria uma tela: `grid` afasta os dois parágrafos do
    // /error, `w-full` e `text-left` desmontam o vazio centralizado da agenda,
    // e o `border` do base-nova apaga a barra de 4px da esquerda.
    const { container } = render(<Bloco>X</Bloco>);
    const classes = (container.firstElementChild as HTMLElement).className;
    const lista = classes.split(/\s+/);
    expect(lista).not.toContain('grid');
    expect(lista).not.toContain('w-full');
    expect(classes).toMatch(/\bborder-l-4\b/);
    expect(classes).toMatch(/\[text-align:inherit\]/);
  });
});
