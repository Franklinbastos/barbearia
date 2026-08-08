import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// A action é server action e arrasta banco e sessão; o que este teste olha é o
// formulário.
vi.mock('./actions', () => ({
  createManualAppointmentAction: async () => ({}),
}));

const { ManualBookingForm } = await import('./manual-booking-form');

const html = renderToStaticMarkup(
  createElement(ManualBookingForm, {
    slug: 'barbearia',
    services: [{ id: 'sv-1', name: 'Barba', durationMinutes: 20 }],
    staffList: [{ id: 'st-1', name: 'João' }],
    defaultDate: '2026-09-07',
    timeZone: 'America/Sao_Paulo',
  }),
);

describe('ManualBookingForm', () => {
  it('o que fica na agenda é a barra fixa "Encaixe", não um formulário de oito campos', () => {
    // A folha nasce fechada: sem ela aberta, o formulário inteiro não existe no
    // documento — nada de oito controles pendurados no fim da página.
    expect(html).toContain('Encaixe');
    expect(html).not.toMatch(/name="name"/);
    expect(html).not.toMatch(/name="phone"/);
  });

  it('a barra fixa carrega a confirmação para o leitor de tela, fora da folha', () => {
    // "Encaixe agendado." precisa ser ouvido depois de a folha fechar.
    expect(html).toMatch(/role="status"/);
  });

  it('reserva a altura da barra fixa para ela não cobrir o último cartão', () => {
    expect(html).toMatch(/height:64px/);
  });
});
