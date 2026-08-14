// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  buildVaosLivres,
  FaixaDeVaoLivre,
  assinarPedidoDeEncaixe,
  recortarNoAgora,
  type PedidoDeEncaixe,
} from './vao-livre';

const TZ = 'America/Sao_Paulo';

const d = (h: number, m = 0) =>
  new Date(`2026-08-14T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`);

const MARCAO = [{ id: 's1', name: 'Marcão' }];

describe('buildVaosLivres', () => {
  it('acha o buraco entre dois atendimentos do mesmo barbeiro', () => {
    const vaos = buildVaosLivres(
      [
        { staffId: 's1', startAt: d(9), endAt: d(9, 30), status: 'BOOKED' },
        { staffId: 's1', startAt: d(11), endAt: d(11, 30), status: 'BOOKED' },
      ],
      MARCAO,
      30,
    );
    expect(vaos).toHaveLength(1);
    expect(vaos[0]!.minutos).toBe(90);
    expect(vaos[0]!.inicio).toEqual(d(9, 30));
    expect(vaos[0]!.fim).toEqual(d(11));
  });

  it('ignora buraco menor que o serviço mais curto da loja', () => {
    // faixa que não cabe ninguém é ruído: ocupa linha e não leva a lugar nenhum
    const vaos = buildVaosLivres(
      [
        { staffId: 's1', startAt: d(9), endAt: d(9, 30), status: 'BOOKED' },
        { staffId: 's1', startAt: d(9, 45), endAt: d(10, 15), status: 'BOOKED' },
      ],
      MARCAO,
      30,
    );
    expect(vaos).toEqual([]);
  });

  it('buraco do tamanho exato do serviço mais curto vale', () => {
    const vaos = buildVaosLivres(
      [
        { staffId: 's1', startAt: d(9), endAt: d(9, 30), status: 'BOOKED' },
        { staffId: 's1', startAt: d(10), endAt: d(10, 30), status: 'BOOKED' },
      ],
      MARCAO,
      30,
    );
    expect(vaos).toHaveLength(1);
  });

  it('cancelado não ocupa: o horário voltou para a grade', () => {
    const vaos = buildVaosLivres(
      [
        { staffId: 's1', startAt: d(9), endAt: d(9, 30), status: 'BOOKED' },
        { staffId: 's1', startAt: d(10), endAt: d(10, 30), status: 'CANCELED' },
        { staffId: 's1', startAt: d(11), endAt: d(11, 30), status: 'BOOKED' },
      ],
      MARCAO,
      30,
    );
    expect(vaos).toHaveLength(1);
    expect(vaos[0]!.minutos).toBe(90);
  });

  it('falta ocupa: a cadeira ficou reservada e ninguém pôde usar', () => {
    const vaos = buildVaosLivres(
      [
        { staffId: 's1', startAt: d(9), endAt: d(9, 30), status: 'BOOKED' },
        { staffId: 's1', startAt: d(10), endAt: d(10, 30), status: 'NO_SHOW' },
      ],
      MARCAO,
      30,
    );
    expect(vaos[0]!.fim).toEqual(d(10));
  });

  it('cada barbeiro tem o próprio buraco', () => {
    const vaos = buildVaosLivres(
      [
        { staffId: 's1', startAt: d(9), endAt: d(9, 30), status: 'BOOKED' },
        { staffId: 's1', startAt: d(11), endAt: d(11, 30), status: 'BOOKED' },
        { staffId: 's2', startAt: d(9), endAt: d(11, 30), status: 'BOOKED' },
      ],
      [...MARCAO, { id: 's2', name: 'Tiago' }],
      30,
    );
    expect(vaos.map((v) => v.staffId)).toEqual(['s1']);
  });

  it('dia vazio não vira uma faixa gigante', () => {
    // o vão existe ENTRE atendimentos; o dia sem nada já tem o seu estado vazio
    expect(buildVaosLivres([], MARCAO, 30)).toEqual([]);
  });

  it('atendimento sobreposto não inventa vão negativo', () => {
    // encaixe por cima da cadeira ocupada: o fim que vale é o mais tarde dos dois
    const vaos = buildVaosLivres(
      [
        { staffId: 's1', startAt: d(9), endAt: d(11), status: 'BOOKED' },
        { staffId: 's1', startAt: d(9, 30), endAt: d(10), status: 'BOOKED' },
        { staffId: 's1', startAt: d(12), endAt: d(12, 30), status: 'BOOKED' },
      ],
      MARCAO,
      30,
    );
    expect(vaos).toHaveLength(1);
    expect(vaos[0]!.inicio).toEqual(d(11));
  });

  it('barbeiro que saiu da equipe não recebe convite para encaixe', () => {
    // o nome dele já sumiu da lista de ativos; oferecer a cadeira seria marcar
    // cliente com quem não trabalha mais aqui
    const vaos = buildVaosLivres(
      [
        { staffId: 'st-desligado', startAt: d(9), endAt: d(9, 30), status: 'BOOKED' },
        { staffId: 'st-desligado', startAt: d(11), endAt: d(11, 30), status: 'BOOKED' },
      ],
      MARCAO,
      30,
    );
    expect(vaos).toEqual([]);
  });

  it('ordena por horário, para a faixa cair no lugar certo da lista', () => {
    const vaos = buildVaosLivres(
      [
        { staffId: 's2', startAt: d(14), endAt: d(14, 30), status: 'BOOKED' },
        { staffId: 's2', startAt: d(16), endAt: d(16, 30), status: 'BOOKED' },
        { staffId: 's1', startAt: d(9), endAt: d(9, 30), status: 'BOOKED' },
        { staffId: 's1', startAt: d(11), endAt: d(11, 30), status: 'BOOKED' },
      ],
      [...MARCAO, { id: 's2', name: 'Tiago' }],
      30,
    );
    expect(vaos.map((v) => v.staffId)).toEqual(['s1', 's2']);
  });
});

describe('recortarNoAgora', () => {
  const vao = (inicio: Date, fim: Date) => ({
    inicio,
    fim,
    minutos: (fim.getTime() - inicio.getTime()) / 60_000,
    staffId: 's1',
  });

  it('buraco que já fechou não vira faixa', () => {
    // encaixar às 10:30 quando são 14:00 marcaria cliente no passado, e nada no
    // servidor recusa isso
    expect(recortarNoAgora([vao(d(9, 30), d(11))], d(14), 30)).toEqual([]);
  });

  it('buraco em curso é recortado, não descartado', () => {
    // às 10:15 a cadeira livre das 10 às 12 ainda vende 1 h 45 min — é a faixa
    // mais útil do dia, e some se a regra for só "começou no passado"
    const [recortado] = recortarNoAgora([vao(d(10), d(12))], d(10, 15), 30);
    expect(recortado!.inicio).toEqual(d(10, 15));
    expect(recortado!.minutos).toBe(105);
  });

  it('a hora recortada sobe para o passo de ±5 da folha', () => {
    // arredondar para baixo devolveria a hora ao passado, que é o defeito
    const [recortado] = recortarNoAgora([vao(d(10), d(12))], d(10, 16), 30);
    expect(recortado!.inicio).toEqual(d(10, 20));
  });

  it('o piso vale de novo depois do recorte', () => {
    // sobra de 20 minutos não cabe ninguém: volta a ser ruído
    expect(recortarNoAgora([vao(d(10), d(12))], d(11, 40), 30)).toEqual([]);
  });

  it('buraco que ainda não começou passa intacto — é o dia de amanhã', () => {
    const futuro = vao(d(15), d(16));
    expect(recortarNoAgora([futuro], d(10), 30)).toEqual([futuro]);
  });
});

describe('FaixaDeVaoLivre', () => {
  const VAO = { inicio: d(12, 30), fim: d(14), minutos: 90, staffId: 's1' };

  /** A faixa é uma linha da `<ol class="lista">`, e `<li>` solto avisa no console. */
  const montar = (nomeDoBarbeiro?: string) =>
    render(
      <ol>
        <FaixaDeVaoLivre vao={VAO} nomeDoBarbeiro={nomeDoBarbeiro} timeZone={TZ} />
      </ol>,
    );

  it('é um botão de verdade, com a ação inteira no nome acessível', () => {
    // `<div onClick>` não recebe Tab, não responde a Enter e não é anunciado.
    // O nome começa pelo verbo e **contém o texto visível inteiro** (WCAG
    // 2.5.3): quem comanda por voz fala o que lê na tela.
    montar('Marcão');

    const botao = screen.getByRole('button', {
      name: 'Encaixar às 09:30 · 1 h 30 min livre com Marcão',
    });
    expect(botao.getAttribute('aria-label')).toContain(botao.textContent);
    expect(botao.tagName).toBe('BUTTON');
    expect(botao.getAttribute('type')).toBe('button');
    // 44px de alvo (--tap-min), a régua de alvo de toque
    expect(botao.className).toMatch(/min-h-11/);
  });

  it('diz o tamanho do buraco em vez de só marcar que existe', () => {
    // é o que a timeline dos concorrentes entrega por comprimento; sem eixo de
    // tempo, a lista entrega por escrito
    montar('Marcão');
    expect(screen.getByText('09:30 · 1 h 30 min livre com Marcão')).toBeDefined();
  });

  it('com um barbeiro só, a faixa não repete o nome dele', () => {
    montar();
    expect(
      screen.getByRole('button', { name: 'Encaixar às 09:30 · 1 h 30 min livre' }),
    ).toBeDefined();
    expect(screen.queryByText(/com /)).toBeNull();
  });

  it('clicar pede o encaixe com a hora e o barbeiro que o dedo apontou', async () => {
    const pedidos: PedidoDeEncaixe[] = [];
    const cancelar = assinarPedidoDeEncaixe((p) => pedidos.push(p));

    montar('Marcão');
    await userEvent.click(screen.getByRole('button'));

    expect(pedidos).toEqual([{ hora: '09:30', staffId: 's1' }]);
    cancelar();
  });

  it('cancelar a assinatura desliga o ouvinte', () => {
    const pedidos: PedidoDeEncaixe[] = [];
    assinarPedidoDeEncaixe((p) => pedidos.push(p))();

    montar();
    screen.getByRole('button').click();

    expect(pedidos).toEqual([]);
  });
});
