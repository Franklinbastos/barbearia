// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Historico, type AtendimentoDoHistorico } from './historico';

/**
 * O filtro de status é o padrão de Fresha e Square, e o que o dono faz com ele
 * é uma pergunta só: "esse aí já me deu bolo?".
 *
 * O caso que não pode quebrar é o do vazio: quando o filtro esvazia a lista, a
 * frase tem que dizer **qual filtro está ligado**. "Nenhum atendimento ainda" é
 * a frase de quem nunca veio, e dizê-la para quem veio dez vezes e nunca faltou
 * é mentir na cara do dono.
 */

const TZ = 'America/Sao_Paulo';

function item(over: Partial<AtendimentoDoHistorico> = {}): AtendimentoDoHistorico {
  return {
    id: 'a1',
    // 09:00 em São Paulo, 12:00 em UTC.
    startAt: new Date('2026-09-07T12:00:00Z'),
    status: 'DONE',
    serviceName: 'Corte',
    priceCents: 4000,
    ...over,
  };
}

const TRES = [
  item({ id: 'a1', status: 'DONE' }),
  item({ id: 'a2', status: 'NO_SHOW' }),
  item({ id: 'a3', status: 'BOOKED' }),
];

function linhas() {
  return screen.queryAllByRole('listitem');
}

describe('Historico', () => {
  const tzOriginal = process.env.TZ;
  // O servidor da Vercel roda em UTC: é aí que a hora sem fuso sai errada.
  beforeAll(() => {
    process.env.TZ = 'UTC';
  });
  afterAll(() => {
    process.env.TZ = tzOriginal;
  });

  it('mostra o horário no fuso da barbearia e o status em pt-BR', () => {
    render(<Historico atendimentos={[item({ status: 'BOOKED' })]} timeZone={TZ} />);
    const texto = screen.getByRole('listitem').textContent ?? '';
    expect(texto).toContain('07/09/2026');
    expect(texto).toContain('09:00');
    expect(texto).not.toContain('12:00');
    expect(texto).toContain('Agendado');
    expect(texto).not.toContain('BOOKED');
  });

  it('começa em Todos, com a lista inteira', () => {
    render(<Historico atendimentos={TRES} timeZone={TZ} />);
    expect(screen.getByRole('group', { name: /histórico/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Todos' }).getAttribute('aria-pressed')).toBe('true');
    expect(linhas().length).toBe(3);
  });

  it('Concluídos deixa só quem compareceu', async () => {
    render(<Historico atendimentos={TRES} timeZone={TZ} />);
    await userEvent.click(screen.getByRole('button', { name: 'Concluídos' }));
    expect(linhas().length).toBe(1);
    expect(screen.getByText('Compareceu')).toBeTruthy();
  });

  it('Faltas deixa só quem não veio', async () => {
    render(<Historico atendimentos={TRES} timeZone={TZ} />);
    await userEvent.click(screen.getByRole('button', { name: 'Faltas' }));
    expect(linhas().length).toBe(1);
    expect(screen.getByText('Não veio')).toBeTruthy();
  });

  it('quando o filtro esvazia a lista, o vazio diz qual filtro está ligado', async () => {
    render(<Historico atendimentos={[item({ status: 'DONE' })]} timeZone={TZ} />);
    await userEvent.click(screen.getByRole('button', { name: 'Faltas' }));
    expect(linhas().length).toBe(0);
    // Duas vezes de propósito: a caixa que se vê e a linha viva que se ouve.
    expect(screen.getAllByText('Nenhuma falta registrada.').length).toBe(2);
    // A frase de quem nunca veio não pode aparecer para quem veio.
    expect(screen.queryByText('Nenhum atendimento ainda.')).toBeNull();
  });

  it('o filtro responde para quem não vê a lista', async () => {
    // O `aria-pressed` diz qual botão ficou apertado; a lista encolhendo abaixo
    // dele não diz nada. Sem esta linha o filtro é controle sem retorno no
    // leitor de tela.
    render(<Historico atendimentos={TRES} timeZone={TZ} />);
    const aviso = screen.getByRole('status');
    expect(aviso.textContent).toBe('3 atendimentos na lista.');

    await userEvent.click(screen.getByRole('button', { name: 'Faltas' }));
    expect(aviso.textContent).toBe('1 atendimento na lista.');

    await userEvent.click(screen.getByRole('button', { name: 'Concluídos' }));
    expect(aviso.textContent).toBe('1 atendimento na lista.');
  });

  it('a região viva já está montada antes de o filtro mudar', () => {
    // Região que nasce junto com o texto não é anunciada por todo leitor: sem
    // atendimento nenhum ela continua na árvore, calada.
    render(<Historico atendimentos={[]} timeZone={TZ} />);
    expect(screen.getByRole('status').textContent).toBe('');
  });

  it('sem nenhum atendimento não há o que filtrar', () => {
    render(<Historico atendimentos={[]} timeZone={TZ} />);
    expect(screen.getByText('Nenhum atendimento ainda.')).toBeTruthy();
    expect(screen.queryByRole('group')).toBeNull();
  });
});
