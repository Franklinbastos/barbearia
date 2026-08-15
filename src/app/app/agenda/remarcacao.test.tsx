// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { act } from 'react';
import { AvisoDeRemarcacao, assinarRemarcacao, type RemarcacaoContexto } from './remarcacao';

/**
 * O modo de remarcação é o primeiro estado modal da agenda: enquanto ele está
 * ligado, clicar numa faixa de vão livre significa outra coisa. Por isso o que
 * se testa aqui não é a aparência do aviso, e sim as duas garantias que impedem
 * a próxima ação de surpreender — o aviso existe enquanto o modo existe, e
 * `Esc` sempre desliga.
 */

/** Lê o modo do módulo sem montar componente nenhum. */
function contextoAtual(): RemarcacaoContexto {
  let visto!: RemarcacaoContexto;
  assinarRemarcacao((c) => {
    visto = c;
  })();
  return visto;
}

afterEach(() => {
  contextoAtual().sair();
});

describe('o modo de remarcação', () => {
  it('começa desligado, e desligado não mostra aviso nenhum', () => {
    const { container } = render(<AvisoDeRemarcacao contexto={contextoAtual()} />);
    expect(contextoAtual().appointmentId).toBeNull();
    expect(container.textContent).toBe('');
  });

  it('ligado, diz de quem é a remarcação e como sair', () => {
    act(() => contextoAtual().entrar('appt-1', 'Marcos'));
    render(<AvisoDeRemarcacao contexto={contextoAtual()} />);

    expect(screen.getByRole('status').textContent).toContain(
      'Escolhendo novo horário para Marcos',
    );
    // O `Esc` está escrito porque atalho que ninguém vê não é caminho.
    expect(screen.getByRole('status').textContent).toContain('Esc para desistir');
    expect(screen.getByRole('button', { name: 'Desistir' })).toBeTruthy();
  });

  it('avisa quem já estava assinando quando o modo liga e quando desliga', () => {
    const vistos: (string | null)[] = [];
    const desassinar = assinarRemarcacao((c) => vistos.push(c.appointmentId));

    contextoAtual().entrar('appt-9', 'Marcos');
    contextoAtual().sair();
    desassinar();

    expect(vistos).toEqual([null, 'appt-9', null]);
  });

  it('mantém o modo entre dias — a lista remonta, o modo não', () => {
    act(() => contextoAtual().entrar('appt-1', 'Marcos'));
    const { unmount } = render(<AvisoDeRemarcacao contexto={contextoAtual()} />);
    unmount();

    // Navegar para outro dia é exatamente isto: a árvore some e volta. O modo
    // sobrevive porque mora no módulo, e "semana que vem, mesma hora" é o caso
    // mais comum de todos.
    render(<AvisoDeRemarcacao contexto={contextoAtual()} />);
    expect(screen.getByRole('status').textContent).toContain('Marcos');
  });

  it('Esc desliga o modo de qualquer lugar da página', () => {
    act(() => contextoAtual().entrar('appt-1', 'Marcos'));
    render(<AvisoDeRemarcacao contexto={contextoAtual()} />);

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(contextoAtual().appointmentId).toBeNull();
  });

  it('outra tecla não desliga o modo por acidente', () => {
    act(() => contextoAtual().entrar('appt-1', 'Marcos'));
    render(<AvisoDeRemarcacao contexto={contextoAtual()} />);

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    });

    expect(contextoAtual().appointmentId).toBe('appt-1');
  });

  it('desmontar o aviso solta o ouvinte de teclado', () => {
    act(() => contextoAtual().entrar('appt-1', 'Marcos'));
    const { unmount } = render(<AvisoDeRemarcacao contexto={contextoAtual()} />);
    const soltar = vi.spyOn(document, 'removeEventListener');

    unmount();

    expect(soltar).toHaveBeenCalledWith('keydown', expect.any(Function));
    soltar.mockRestore();
  });
});

describe('o piso das faixas em modo remarcação', () => {
  it('começa sem duração: até a lista informar, vale o piso da loja', () => {
    contextoAtual().entrar('appt-1', 'Marcos');
    expect(contextoAtual().duracaoMinutos).toBeNull();
  });

  it('guarda a duração que a lista informa', () => {
    contextoAtual().entrar('appt-1', 'Marcos');
    contextoAtual().informarDuracao('appt-1', 60);
    expect(contextoAtual().duracaoMinutos).toBe(60);
  });

  it('ignora duração de outro atendimento', () => {
    contextoAtual().entrar('appt-1', 'Marcos');
    contextoAtual().informarDuracao('appt-2', 90);
    expect(contextoAtual().duracaoMinutos).toBeNull();
  });

  it('informar a mesma duração de novo não avisa ninguém — seria laço de render', () => {
    contextoAtual().entrar('appt-1', 'Marcos');
    contextoAtual().informarDuracao('appt-1', 60);

    let avisos = 0;
    const desassinar = assinarRemarcacao(() => {
      avisos += 1;
    });
    contextoAtual().informarDuracao('appt-1', 60);
    desassinar();

    // 1 é o aviso de boas-vindas do próprio `assinarRemarcacao`.
    expect(avisos).toBe(1);
  });

  it('a duração morre com o modo', () => {
    contextoAtual().entrar('appt-1', 'Marcos');
    contextoAtual().informarDuracao('appt-1', 60);
    contextoAtual().sair();
    expect(contextoAtual().duracaoMinutos).toBeNull();
  });
});
