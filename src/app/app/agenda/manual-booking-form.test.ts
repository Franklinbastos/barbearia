// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { act, createElement } from 'react';
import { render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { pedirEncaixe } from './vao-livre';

// A action é server action e arrasta banco e sessão; o que este teste olha é o
// formulário.
vi.mock('./actions', () => ({
  createManualAppointmentAction: async () => ({}),
}));

const { ManualBookingForm } = await import('./manual-booking-form');

const PROPS = {
  slug: 'barbearia',
  services: [{ id: 'sv-1', name: 'Barba', durationMinutes: 20 }],
  staffList: [{ id: 'st-1', name: 'João' }],
  defaultDate: '2026-09-07',
  // Diferente do `defaultDate` de propósito: a agenda navega para qualquer dia,
  // e é o `hojeISO` que diz ao `Calendar` qual deles é hoje **na loja**.
  hojeISO: '2026-09-01',
  timeZone: 'America/Sao_Paulo',
};

const html = renderToStaticMarkup(createElement(ManualBookingForm, PROPS));

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
    // `agenda/page.tsx`: o componente é renderizado no topo — hoje dentro da
    // `acao` da barra de data —, e uma reserva no topo não reservaria nada.
    // Quem guarda a reserva agora é o teste da página.
    expect(html).toMatch(/fixed[^"]*md:hidden/);
  });

  it('no desktop o encaixe é ação de topo, não barra de rodapé', () => {
    // O `hidden md:*` é deste componente, não da barra: `display: none` no pai
    // levaria junto a barra fixa do celular, que é filha do mesmo fragmento.
    expect(html).toMatch(/hidden md:flex/);
  });
});

describe('ManualBookingForm — o vão livre da lista', () => {
  const valorDe = (nome: string) =>
    document.querySelector<HTMLInputElement>(`input[name="${nome}"]`)?.value;

  it('abre com a hora e o barbeiro que o dedo apontou', async () => {
    // é o ponto inteiro do gesto: pedir de novo a hora que a pessoa acabou de
    // apontar é o que fazia a folha desperdiçar o clique no vazio
    render(createElement(ManualBookingForm, PROPS));
    await act(async () => {
      pedirEncaixe({ hora: '09:30', staffId: 'st-1' });
    });

    expect(screen.getByRole('dialog')).toBeDefined();
    // o que vai no envio, não só o que aparece
    expect(valorDe('horaLivre')).toBe('09:30');
    expect(valorDe('staffId')).toBe('st-1');
    expect(valorDe('date')).toBe('2026-09-07');
    // e a hora fica à vista, no mostrador de ±5
    expect(screen.getByText('09:30')).toBeDefined();
  });

  it('o botão "Encaixe" continua abrindo em branco, como sempre', async () => {
    // sem pedido, o comportamento é o de hoje: hora de agora, barbeiro em aberto
    render(createElement(ManualBookingForm, PROPS));
    await act(async () => {
      screen.getAllByRole('button', { name: 'Encaixe' })[0]!.click();
    });

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(valorDe('horaLivre')).not.toBe('09:30');
    expect(valorDe('staffId')).toBe('');
  });
});
