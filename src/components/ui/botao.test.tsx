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
  it('mantém a altura de balcão, não a do shadcn', () => {
    render(<Botao>Agendar</Botao>);
    const b = screen.getByRole('button', { name: 'Agendar' });
    // 52px vem de --tap-md; o default do shadcn é 32px e não serve para o balcão
    expect(b.className).toMatch(/tap-md|h-\[52px\]|min-h-\[var\(--tap-md\)\]/);
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
   * O texto-base do `button` do base-nova carrega decisão de aparência que não é
   * a nossa: fonte de 14px, peso 500, empurrão de 1px ao apertar, anel de foco
   * próprio, opacidade no desabilitado. Se qualquer uma sobreviver ao `cn()`,
   * a tela mudou — e mudar tela é o defeito que esta migração não pode cometer.
   */
  it('nenhuma decisão de aparência do base-nova sobrevive ao cn()', () => {
    render(<Botao>Agendar</Botao>);
    const classes = screen.getByRole('button').className.split(/\s+/);

    for (const proibida of [
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
      expect(classes).not.toContain(proibida);
    }
  });

  /**
   * `.btn:disabled` zera a cor da borda, mas mora em `@layer components` e a cor
   * de cada variante agora é utilitário — e utilitário vence a camada inteira,
   * especificidade à parte. Sem o `disabled:border-transparent` o botão
   * desabilitado fica com a borda colorida acesa sobre o cinza.
   */
  it('desabilitado perde a borda colorida, como sempre perdeu', () => {
    render(
      <Botao variante="perigo" disabled>
        Cancelar
      </Botao>,
    );
    expect(screen.getByRole('button').className.split(/\s+/)).toContain(
      'disabled:border-transparent',
    );
  });

  it('a variante perigo continua sólida, não vazada como a destructive do base-nova', () => {
    render(<Botao variante="perigo">Cancelar</Botao>);
    const classes = screen.getByRole('button').className.split(/\s+/);
    expect(classes).toContain('btn--perigo');
    expect(classes).not.toContain('bg-destructive/10');
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
