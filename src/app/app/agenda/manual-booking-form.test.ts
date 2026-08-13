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

  it('a barra fixa é só do celular — no desktop ela atravessava a tela por baixo da sidebar', () => {
    // A reserva de rodapé saiu daqui e virou `pb-16 md:pb-0` no container de
    // `agenda/page.tsx`: o componente passou a ser renderizado ANTES da lista,
    // para que o botão de desktop apareça no topo, e uma reserva no topo não
    // reservaria nada. Quem guarda a reserva agora é o teste da página.
    expect(html).toMatch(/fixed[^"]*md:hidden/);
  });

  it('no desktop o encaixe é ação de topo, não barra de rodapé', () => {
    expect(html).toMatch(/hidden md:flex/);
  });
});
