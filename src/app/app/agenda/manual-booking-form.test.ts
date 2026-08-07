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
    services: [{ id: 'sv-1', name: 'Barba' }],
    staffList: [{ id: 'st-1', name: 'João' }],
    defaultDate: '2026-09-07',
    timeZone: 'America/Sao_Paulo',
  }),
);

describe('ManualBookingForm', () => {
  it('manda o dia junto com o formulário, e não só na consulta da grade', () => {
    expect(html).toMatch(/name="date"/);
  });

  it('deixa digitar um horário livre, além de escolher um da grade', () => {
    expect(html).toMatch(/name="horaLivre"/);
    expect(html).toMatch(/type="time"/);
    expect(html).toMatch(/name="startAt"/);
  });

  it('explica em pt-BR que o horário digitado é encaixe fora da grade', () => {
    expect(html.toLowerCase()).toContain('fora da grade');
  });

  /** A tag inteira que contém o atributo — React não garante ordem de atributo. */
  function tagCom(atributo: string): string {
    const onde = html.indexOf(atributo);
    expect(onde, `atributo ${atributo}`).toBeGreaterThan(-1);
    return html.slice(html.lastIndexOf('<', onde), html.indexOf('>', onde) + 1);
  }

  it('começa na grade normal, com o campo de hora livre desligado', () => {
    expect(tagCom('name="horaLivre"')).toContain('disabled');
    expect(tagCom('name="startAt"')).not.toContain('disabled');
  });
});
