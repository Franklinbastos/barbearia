// @vitest-environment jsdom
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * Em 13/08/2026 os dois `<input type="date">` do painel viraram `Popover` +
 * `Calendar` do shadcn: a barra de data da agenda e o campo "Data" do formulário
 * de bloqueio.
 *
 * **O que este arquivo guarda é o fuso**, que é o único jeito de a troca sair
 * cara. O dia anda pelo produto como `YYYY-MM-DD` *já no fuso da barbearia* — o
 * `page.tsx` da agenda o produz com Luxon, e a action de bloqueio o remonta com
 * `DateTime.fromISO(\`${'${date}'}T${'${hora}'}\`, { zone: loja.timeZone })`. O `Calendar`,
 * por outro lado, fala `Date` do navegador. Duas conversões inocentes deslocam o
 * dia inteiro:
 *
 * - `new Date('2026-08-13')` lê meia-noite **UTC**, e em São Paulo isso é dia 12;
 * - `data.toISOString().slice(0, 10)` devolve o dia **em UTC**, e às 21h em São
 *   Paulo já é o dia seguinte — exatamente o bug que o `isoDateInZone` do
 *   `src/lib/format.ts` foi escrito para tirar do produto.
 *
 * A defesa é não converter: monta-se um `Date` local com aquele ano/mês/dia (ao
 * meio-dia, para o horário de verão não comer a meia-noite) e lê-se de volta
 * pelos getters locais. Como isso é invisível num fuso só, **rode a suíte com
 * `TZ` hostil para valer a pena**:
 *
 *     TZ=Pacific/Kiritimati npx vitest run tests/unit/seletor-de-data.test.tsx
 *     TZ=Pacific/Midway     npx vitest run tests/unit/seletor-de-data.test.tsx
 *
 * São UTC+14 e UTC-11: se sobrar qualquer passagem por UTC no caminho, o dia
 * escorrega num dos dois e um dos casos abaixo cai.
 *
 * **O gatilho da barra é procurado por `/escolher outro dia/`, e não por
 * "Data".** Em 15/08/2026 o `aria-label="Data"` saiu: rótulo escondido que cobre
 * o texto visível reprova na WCAG 2.5.3 (Label in Name), e o nome acessível
 * passou a ser o próprio dia mais a afordância. O trecho fixo é o que sobra de
 * estável — o começo do nome muda todo dia, que é justamente o ponto.
 */

const push = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/app/agenda',
}));

// O formulário de bloqueio importa as server actions, que arrastam o cliente do
// banco para dentro do jsdom. Aqui só interessa o campo de data.
vi.mock('@/app/app/equipe/[staffId]/actions', () => ({
  createTimeOffAction: Object.assign(vi.fn(), { bind: () => vi.fn() }),
  deleteTimeOffAction: vi.fn(),
}));

import { BarraDeData } from '@/app/app/agenda/barra-de-data';
import { TimeOffSection } from '@/app/app/equipe/[staffId]/time-off-section';

beforeAll(() => {
  // O jsdom 29 não traz `matchMedia`, e o `useIsMobile` da sidebar chama no
  // efeito de montagem.
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

  // O popup do calendário é posicionado pelo floating-ui, que observa o gatilho
  // para reposicionar — sem `ResizeObserver` abrir o calendário estoura.
  if (typeof globalThis.ResizeObserver !== 'function') {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }

  if (typeof Element.prototype.scrollIntoView !== 'function') {
    Element.prototype.scrollIntoView = () => {};
  }
});

describe('BarraDeData', () => {
  it('rotula o dia que veio do servidor, sem deslocar', () => {
    render(
      <BarraDeData
        dataISO="2026-08-13"
        hojeISO="2026-08-13"
        contagens={{ total: 3, aAtender: 2 }}
      />,
    );
    const gatilho = screen.getByRole('button', { name: /escolher outro dia/ });
    expect(gatilho.textContent).toContain('quinta');
    expect(gatilho.textContent).toContain('13 de agosto');
  });

  it('as setas continuam sendo <Link> com ?data=', () => {
    // O e2e depende de a agenda abrir no dia certo, e é a URL que carrega isso.
    render(
      <BarraDeData
        dataISO="2026-08-13"
        hojeISO="2026-08-13"
        contagens={{ total: 0, aAtender: 0 }}
      />,
    );
    expect(screen.getByRole('link', { name: 'Ontem' }).getAttribute('href')).toBe(
      '/app/agenda?data=2026-08-12',
    );
    expect(screen.getByRole('link', { name: 'Amanhã' }).getAttribute('href')).toBe(
      '/app/agenda?data=2026-08-14',
    );
  });

  it('abre o calendário em pt-BR, com "hoje" no dia da barbearia', async () => {
    render(
      <BarraDeData
        dataISO="2026-08-13"
        hojeISO="2026-08-13"
        contagens={{ total: 0, aAtender: 0 }}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /escolher outro dia/ }));

    // Rótulo do `react-day-picker` traduzido — se o `locale` sumir, isto vira
    // "Go to the Previous Month".
    expect(await screen.findByRole('button', { name: 'Ir para o mês anterior' })).toBeDefined();

    // "Hoje" é o `hojeISO` que o servidor mandou no fuso da loja, e não o
    // relógio do navegador: com `TZ=Pacific/Kiritimati` o navegador já está em
    // outro dia, e mesmo assim o marcado é 13.
    expect(
      screen.getByRole('button', { name: 'Hoje, quinta-feira, 13 de agosto de 2026, selecionado' }),
    ).toBeDefined();
  });

  it('escolher um dia navega para a mesma URL que as setas montam', async () => {
    push.mockClear();
    render(
      <BarraDeData
        dataISO="2026-08-13"
        hojeISO="2026-08-13"
        contagens={{ total: 0, aAtender: 0 }}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /escolher outro dia/ }));
    await userEvent.click(screen.getByRole('button', { name: 'sábado, 1 de agosto de 2026' }));

    expect(push).toHaveBeenCalledWith('/app/agenda?data=2026-08-01');
  });

  it('a ponta do mês não escorrega para o dia anterior', async () => {
    // 1º e 31 são onde um deslocamento de fuso muda também o mês, e não só o dia.
    push.mockClear();
    render(
      <BarraDeData
        dataISO="2026-03-01"
        hojeISO="2026-03-01"
        contagens={{ total: 0, aAtender: 0 }}
      />,
    );
    expect(screen.getByRole('button', { name: /escolher outro dia/ }).textContent).toContain(
      '1 de março',
    );

    await userEvent.click(screen.getByRole('button', { name: /escolher outro dia/ }));
    await userEvent.click(screen.getByRole('button', { name: 'terça-feira, 31 de março de 2026' }));

    expect(push).toHaveBeenCalledWith('/app/agenda?data=2026-03-31');
  });
});

describe('TimeOffSection', () => {
  it('o campo "Data" é o gatilho do calendário, e ele alimenta o campo escondido', async () => {
    const { container } = render(
      <TimeOffSection staffId="s1" bloqueios={[]} timeZone="America/Sao_Paulo" />,
    );

    // O rótulo continua ligado ao controle: o `Campo` pendura o `id` no gatilho,
    // e é isso que mantém `getByLabelText('Data')` funcionando depois da troca.
    const gatilho = screen.getByLabelText('Data');
    expect(gatilho.tagName).toBe('BUTTON');
    expect(gatilho.textContent).toContain('Escolher data');

    // O que a action lê é o campo escondido — sem ele o bloqueio vai sem data.
    const escondido = container.querySelector<HTMLInputElement>(
      'input[type="hidden"][name="date"]',
    );
    expect(escondido).not.toBeNull();
    expect(escondido!.value).toBe('');

    await userEvent.click(gatilho);
    await userEvent.click(await screen.findByRole('button', { name: /, 15 de / }));

    // O dia que saiu no campo é o mesmo que foi tocado, em qualquer `TZ`.
    expect(escondido!.value).toMatch(/^\d{4}-\d{2}-15$/);
    expect(screen.getByLabelText('Data').textContent).toContain('15 de');
  });
});
