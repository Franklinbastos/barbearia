// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DateTime } from 'luxon';

import { resolverPeriodo, janelaAnterior } from '@/domain/indicadores/periodo';
import {
  EstadoVazio,
  PeriodoSemAtendimento,
  SemHistorico,
  estadoDoResumo,
  linkDoPeriodoAnterior,
  rotuloDoAtalhoAnterior,
} from './estado-vazio';

/**
 * §5 do spec: "estados vazios, que aqui não são detalhe". O que este arquivo
 * guarda é a diferença entre os dois zeros — barbearia que nunca atendeu e
 * período que não teve atendimento —, porque a tela precisa dizer coisas
 * diferentes em cada um. Mostrar `0,0%` nos dois é o defeito que o princípio
 * nº 6 do spec existe para impedir.
 */

const TZ = 'America/Sao_Paulo';
const AGORA = DateTime.fromISO('2026-08-14T15:00', { zone: TZ });

const SEMANA = resolverPeriodo({ timeZone: TZ, agora: AGORA });
const ANTERIOR = janelaAnterior(SEMANA, TZ);

describe('estadoDoResumo', () => {
  it('com atendimento na janela, a tela mostra número', () => {
    expect(
      estadoDoResumo({ itensDaJanela: 3, itensDoHistorico: 3, clientesComVisita: 2 }),
    ).toBe('com-numeros');
  });

  it('sem nada em lugar nenhum, é barbearia sem histórico', () => {
    expect(
      estadoDoResumo({ itensDaJanela: 0, itensDoHistorico: 0, clientesComVisita: 0 }),
    ).toBe('sem-historico');
  });

  it('janela vazia mas com movimento em volta é período sem atendimento', () => {
    expect(
      estadoDoResumo({ itensDaJanela: 0, itensDoHistorico: 12, clientesComVisita: 0 }),
    ).toBe('periodo-vazio');
  });

  it('quem só tem cliente antigo não é barbearia nova', () => {
    // O dono abriu um período de 2024 numa loja que roda desde sempre: o
    // histórico em torno daquela janela está vazio, mas a loja tem movimento.
    expect(
      estadoDoResumo({ itensDaJanela: 0, itensDoHistorico: 0, clientesComVisita: 40 }),
    ).toBe('periodo-vazio');
  });

  it('um atendimento na janela basta — mesmo cancelado, houve o que contar', () => {
    expect(
      estadoDoResumo({ itensDaJanela: 1, itensDoHistorico: 1, clientesComVisita: 0 }),
    ).toBe('com-numeros');
  });
});

describe('linkDoPeriodoAnterior', () => {
  it('aponta para o intervalo livre exato do período anterior, com o fim inclusivo', () => {
    // A semana atual é 10 a 16; a anterior é 3 a 9 — e não 3 a 10, que é o
    // `fim` exclusivo da janela e mostraria a segunda-feira duas vezes.
    expect(linkDoPeriodoAnterior(ANTERIOR, TZ)).toBe(
      '/app/resumo?periodo=livre&de=2026-08-03&ate=2026-08-09',
    );
  });

  it('não passa por UTC: o dia é o civil da barbearia', () => {
    const hoje = resolverPeriodo({ periodo: 'hoje', timeZone: TZ, agora: AGORA });
    const ontem = janelaAnterior(hoje, TZ);
    // Em Manaus e em São Paulo o dia civil é o mesmo; o instante, não. Um
    // `toISOString().slice(0,10)` devolveria 2026-08-13T03:00Z → "2026-08-13"
    // em SP e mudaria de dia em qualquer fuso a leste.
    expect(linkDoPeriodoAnterior(ontem, TZ)).toContain('de=2026-08-13&ate=2026-08-13');
  });
});

describe('rotuloDoAtalhoAnterior', () => {
  it('fala o nome do período na voz de quem conversa com o dono', () => {
    expect(rotuloDoAtalhoAnterior(SEMANA)).toBe('Ver a semana passada');
    expect(rotuloDoAtalhoAnterior({ ...SEMANA, periodo: 'mes' })).toBe('Ver o mês passado');
    expect(rotuloDoAtalhoAnterior({ ...SEMANA, periodo: 'hoje' })).toBe('Ver ontem');
    expect(rotuloDoAtalhoAnterior({ ...SEMANA, periodo: 'livre' })).toBe('Ver o período anterior');
  });
});

describe('EstadoVazio', () => {
  it('mostra título, explicação e a ação, sem número nenhum', () => {
    const { container } = render(
      <EstadoVazio titulo="Nada aqui" texto="Explicação." acao={{ href: '/app/agenda', rotulo: 'Abrir a agenda' }} />,
    );

    expect(screen.getByText('Nada aqui')).toBeTruthy();
    expect(screen.getByText('Explicação.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Abrir a agenda' }).getAttribute('href')).toBe(
      '/app/agenda',
    );
    // O ponto do estado vazio: nenhum "0%" na tela.
    expect(container.textContent).not.toMatch(/\d+([.,]\d+)?%/);
  });

  it('sem ação, não inventa botão', () => {
    render(<EstadoVazio titulo="Nada" texto="Só isso." />);
    expect(screen.queryByRole('link')).toBeNull();
  });
});

describe('SemHistorico', () => {
  it('diz que os números aparecem depois dos primeiros atendimentos, e leva à agenda', () => {
    const { container } = render(<SemHistorico />);
    expect(container.textContent).toMatch(/primeiros atendimentos/i);
    expect(screen.getByRole('link').getAttribute('href')).toBe('/app/agenda');
    expect(container.textContent).not.toMatch(/0%|R\$ 0/);
  });
});

describe('PeriodoSemAtendimento', () => {
  it('diz que o período não teve atendimento e oferece o anterior', () => {
    const { container } = render(
      <PeriodoSemAtendimento janela={SEMANA} anterior={ANTERIOR} timeZone={TZ} />,
    );

    expect(container.textContent).toContain(SEMANA.rotulo);
    const atalho = screen.getByRole('link', { name: 'Ver a semana passada' });
    expect(atalho.getAttribute('href')).toBe('/app/resumo?periodo=livre&de=2026-08-03&ate=2026-08-09');
  });
});
