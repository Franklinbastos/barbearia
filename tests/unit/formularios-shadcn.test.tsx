// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ServicesForm } from '@/app/app/equipe/[staffId]/services-form';
import { NotesForm } from '@/app/app/clientes/[customerId]/notes-form';
import { SettingsForm } from '@/app/app/configuracoes/settings-form';

/**
 * Em 13/08/2026 três controles crus do painel viraram componentes da lib:
 * `<input type="checkbox">` virou `Checkbox`, os dois `<select>` viraram
 * `Select` e o `<textarea>` virou `Textarea`.
 *
 * O que este arquivo guarda **não é aparência** — é o contrato com as server
 * actions, que não mudaram uma linha. O `Select` e o `Checkbox` do base-ui não
 * são elementos nativos; eles emitem o campo do formulário por dentro. Se um dia
 * alguém trocar a lib, controlar o valor à mão ou acrescentar um
 * `<input type="hidden">` "por segurança", o `FormData` muda de forma debaixo de
 * `saveStaffServicesAction` e `saveSettingsAction` sem que nenhum outro teste
 * perceba. Os casos abaixo contam **quantas vezes** cada nome aparece.
 */
beforeAll(() => {
  // O jsdom 29 não implementa nenhum dos três, e o popup do `Select` do base-ui
  // chama os três ao montar o posicionador.
  if (typeof window.matchMedia !== 'function') {
    window.matchMedia = (query: string) =>
      ({
        media: query,
        matches: false,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList;
  }
  if (typeof window.ResizeObserver !== 'function') {
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
  if (typeof Element.prototype.scrollIntoView !== 'function') {
    Element.prototype.scrollIntoView = () => {};
  }
});

/** O `<form>` que o componente montou, para ler o `FormData` que ele mandaria. */
function dadosDoFormulario(container: HTMLElement): FormData {
  const form = container.querySelector('form');
  if (!form) throw new Error('o componente não montou nenhum <form>');
  return new FormData(form);
}

const SERVICOS = [
  { id: 'srv-corte', name: 'Corte', durationMinutes: 30 },
  { id: 'srv-barba', name: 'Barba', durationMinutes: 20 },
];

describe('ServicesForm — o Checkbox da lib no lugar do input cru', () => {
  it('marca cada serviço com um checkbox de verdade, com nome acessível', () => {
    render(
      <ServicesForm
        staffId="staff-1"
        servicos={SERVICOS}
        selecionados={new Map([['srv-corte', null]])}
      />,
    );

    const caixas = screen.getAllByRole('checkbox');
    expect(caixas).toHaveLength(2);
    expect(caixas[0].getAttribute('aria-checked')).toBe('true');
    expect(caixas[1].getAttribute('aria-checked')).toBe('false');
  });

  it('manda serviceIds uma vez por serviço marcado — nunca duas', () => {
    const { container } = render(
      <ServicesForm
        staffId="staff-1"
        servicos={SERVICOS}
        selecionados={new Map([['srv-corte', 45]])}
      />,
    );

    const dados = dadosDoFormulario(container);
    expect(dados.getAll('serviceIds')).toEqual(['srv-corte']);
    expect(dados.get('duration_srv-corte')).toBe('45');
    expect(dados.get('duration_srv-barba')).toBe('');
  });

  it('clicar na linha inteira marca e desmarca — e o FormData acompanha', async () => {
    const usuario = userEvent.setup();
    const { container } = render(
      <ServicesForm staffId="staff-1" servicos={SERVICOS} selecionados={new Map()} />,
    );

    // O alvo é o texto do serviço, não o quadradinho: é a linha inteira que o
    // balcão toca, e o `<label>` por fora é o que faz isso funcionar.
    await usuario.click(screen.getByText('Barba'));
    expect(dadosDoFormulario(container).getAll('serviceIds')).toEqual(['srv-barba']);

    await usuario.click(screen.getByText('Barba'));
    expect(dadosDoFormulario(container).getAll('serviceIds')).toEqual([]);
  });

  it('a duração própria continua com o nome acessível que traz o serviço junto', () => {
    render(<ServicesForm staffId="staff-1" servicos={SERVICOS} selecionados={new Map()} />);
    expect(screen.getByLabelText('Duração própria (min) — Corte')).toBeDefined();
  });
});

describe('NotesForm — o Textarea da lib no lugar do textarea cru', () => {
  it('continua sendo um textarea ligado ao rótulo "Notas"', () => {
    render(<NotesForm customerId="cli-1" notes="Corta sempre na máquina 2." />);

    const campo = screen.getByLabelText('Notas');
    expect(campo.tagName).toBe('TEXTAREA');
    expect(campo.getAttribute('data-slot')).toBe('textarea');
    expect((campo as HTMLTextAreaElement).name).toBe('notes');
  });

  it('manda o texto digitado em notes', async () => {
    const usuario = userEvent.setup();
    const { container } = render(<NotesForm customerId="cli-1" notes={null} />);

    await usuario.type(screen.getByLabelText('Notas'), 'Cliente novo');
    expect(dadosDoFormulario(container).get('notes')).toBe('Cliente novo');
  });
});

const LOJA = {
  name: 'Barbearia do Marcão',
  slotMinutes: 30,
  minLeadMinutes: 60,
  maxAdvanceDays: 30,
  timeZone: 'America/Sao_Paulo',
  accentHue: 210,
};

describe('SettingsForm — o Select da lib no lugar do select nativo', () => {
  it('manda timeZone e slotMinutes uma única vez, sem campo oculto duplicado', () => {
    const { container } = render(<SettingsForm loja={LOJA} />);

    const dados = dadosDoFormulario(container);
    expect(dados.getAll('timeZone')).toEqual(['America/Sao_Paulo']);
    expect(dados.getAll('slotMinutes')).toEqual(['30']);
    // Os outros campos da mesma action seguem intactos.
    expect(dados.get('name')).toBe('Barbearia do Marcão');
    expect(dados.get('minLeadMinutes')).toBe('60');
    expect(dados.get('maxAdvanceDays')).toBe('30');
    expect(dados.getAll('accentHue')).toEqual(['210']);
  });

  it('o disparador mostra o rótulo do item, não o valor cru', () => {
    render(<SettingsForm loja={LOJA} />);
    // "30 min" e não "30": é o `items` do `Select.Root` que faz o `SelectValue`
    // resolver o rótulo.
    expect(screen.getByText('30 min')).toBeDefined();
  });

  it('o rótulo do campo continua ligado ao controle', () => {
    render(<SettingsForm loja={LOJA} />);
    const disparador = screen.getByLabelText('Fuso horário');
    expect(disparador.getAttribute('data-slot')).toBe('select-trigger');
  });

  it('trocar a grade troca o que a server action recebe', async () => {
    const usuario = userEvent.setup();
    const { container } = render(<SettingsForm loja={LOJA} />);

    await usuario.click(screen.getByLabelText('Grade de horários (minutos)'));
    await usuario.click(await screen.findByRole('option', { name: '15 min' }));

    expect(dadosDoFormulario(container).getAll('slotMinutes')).toEqual(['15']);
  });
});
