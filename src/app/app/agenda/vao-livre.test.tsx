// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  agruparVaosLivres,
  buildVaosLivres,
  FaixaDeVaoLivre,
  assinarPedidoDeEncaixe,
  desviarPedidoDeVao,
  pedirEncaixe,
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
    const pedidos: (PedidoDeEncaixe | undefined)[] = [];
    const cancelar = assinarPedidoDeEncaixe((p) => pedidos.push(p));

    montar('Marcão');
    await userEvent.click(screen.getByRole('button'));

    expect(pedidos).toEqual([{ hora: '09:30', staffId: 's1' }]);
    cancelar();
  });

  it('cancelar a assinatura desliga o ouvinte', () => {
    const pedidos: (PedidoDeEncaixe | undefined)[] = [];
    assinarPedidoDeEncaixe((p) => pedidos.push(p))();

    montar();
    screen.getByRole('button').click();

    expect(pedidos).toEqual([]);
  });

  it('pedir sem hora abre a folha no padrão dela', () => {
    // o estado vazio do dia não apontou hora nenhuma; quem decide a hora padrão
    // é a folha, e copiar o arredondamento dela aqui seria uma segunda regra
    const pedidos: (PedidoDeEncaixe | undefined)[] = [];
    const cancelar = assinarPedidoDeEncaixe((p) => pedidos.push(p));

    pedirEncaixe();

    expect(pedidos).toEqual([undefined]);
    cancelar();
  });
});

describe('agruparVaosLivres', () => {
  const vao = (staffId: string, inicio: Date, minutos: number) => ({
    inicio,
    fim: new Date(inicio.getTime() + minutos * 60_000),
    minutos,
    staffId,
  });

  it('dois barbeiros livres no mesmo instante viram uma faixa só', () => {
    // a captura mostrou "11:45 · 1 h 15 min com Tiago" logo acima de
    // "11:45 · 2 h 45 min com Dono E2E": duas linhas para a mesma notícia
    const agrupados = agruparVaosLivres([vao('s1', d(11, 45), 75), vao('s2', d(11, 45), 165)]);

    expect(agrupados).toHaveLength(1);
    expect(agrupados[0]!.staffId).toBe('s2');
    expect(agrupados[0]!.minutos).toBe(165);
    expect(agrupados[0]!.outros).toEqual([{ staffId: 's1', minutos: 75 }]);
  });

  it('o menor não some: é ele que evita queimar a cadeira grande', () => {
    const [agrupado] = agruparVaosLivres([vao('s1', d(11, 45), 75), vao('s2', d(11, 45), 165)]);
    expect(agrupado!.outros.map((o) => o.staffId)).toEqual(['s1']);
  });

  it('instantes diferentes continuam em faixas diferentes', () => {
    const agrupados = agruparVaosLivres([vao('s1', d(9, 30), 60), vao('s2', d(11), 60)]);
    expect(agrupados.map((a) => a.inicio)).toEqual([d(9, 30), d(11)]);
    expect(agrupados.every((a) => a.outros.length === 0)).toBe(true);
  });

  it('durações iguais desempatam pelo staffId, para o clique não variar entre renders', () => {
    const [agrupado] = agruparVaosLivres([vao('s2', d(11), 60), vao('s1', d(11), 60)]);
    expect(agrupado!.staffId).toBe('s1');
  });

  it('devolve em ordem de horário, que é como a lista lê', () => {
    const agrupados = agruparVaosLivres([vao('s1', d(14), 60), vao('s2', d(9), 60)]);
    expect(agrupados.map((a) => a.staffId)).toEqual(['s2', 's1']);
  });
});

describe('FaixaDeVaoLivre — mais de um barbeiro no mesmo instante', () => {
  const VAO = { inicio: d(12, 30), fim: d(15, 15), minutos: 165, staffId: 's2' };

  const montar = (outrosBarbeiros: { nome: string; minutos: number }[]) =>
    render(
      <ol>
        <FaixaDeVaoLivre
          vao={VAO}
          nomeDoBarbeiro="Dono E2E"
          outrosBarbeiros={outrosBarbeiros}
          timeZone={TZ}
        />
      </ol>,
    );

  it('durações diferentes: a maior primeiro, e o outro nomeado com a dele', () => {
    // a maior responde "cabe o serviço longo?"; a menor evita mandar um corte
    // de 30 min para a cadeira de 2 h 45 min
    montar([{ nome: 'Tiago', minutos: 75 }]);
    expect(
      screen.getByText('09:30 · livre com Dono E2E (2 h 45 min) e Tiago (1 h 15 min)'),
    ).toBeDefined();
  });

  it('durações iguais: uma duração só e os dois nomes', () => {
    // repetir a mesma duração por nome seria relatório, não decisão
    montar([{ nome: 'Tiago', minutos: 165 }]);
    expect(screen.getByText('09:30 · 2 h 45 min livre com Dono E2E e Tiago')).toBeDefined();
  });

  it('três barbeiros: a lista se lê como se fala', () => {
    montar([
      { nome: 'Tiago', minutos: 165 },
      { nome: 'Marcão', minutos: 165 },
    ]);
    expect(screen.getByText('09:30 · 2 h 45 min livre com Dono E2E, Tiago e Marcão')).toBeDefined();
  });

  it('o nome acessível continua contendo o texto visível inteiro', () => {
    // WCAG 2.5.3: quem comanda por voz fala o que lê na tela
    montar([{ nome: 'Tiago', minutos: 75 }]);
    const botao = screen.getByRole('button');
    expect(botao.getAttribute('aria-label')).toContain(botao.textContent);
    expect(botao.getAttribute('aria-label')).toMatch(/^Encaixar às /);
  });

  it('a frase longa quebra em vez de ser cortada, para o segundo nome não sumir', () => {
    // `truncate` a 360px cortaria em "… e Ti"; o `min-h-11` já reserva a altura
    montar([{ nome: 'Tiago', minutos: 75 }]);
    const texto = screen.getByText(/Dono E2E/);
    expect(texto.className).not.toMatch(/truncate/);
  });
});

describe('o canal do vão em modo remarcação', () => {
  const VAO = { inicio: d(12, 30), fim: d(14), minutos: 90, staffId: 's1' };

  const montar = (remarcandoPara?: string) =>
    render(
      <ol>
        <FaixaDeVaoLivre vao={VAO} nomeDoBarbeiro="Marcão" timeZone={TZ} remarcandoPara={remarcandoPara} />
      </ol>,
    );

  it('o desvio come o pedido: a folha de encaixe não abre por cima da remarcação', async () => {
    // Um segundo canal faria as duas responderem ao mesmo clique — a folha de
    // encaixe assina este aqui.
    const naFolhaDeEncaixe: (PedidoDeEncaixe | undefined)[] = [];
    const naRemarcacao: PedidoDeEncaixe[] = [];
    const largarEncaixe = assinarPedidoDeEncaixe((p) => naFolhaDeEncaixe.push(p));
    const largarDesvio = desviarPedidoDeVao((p) => naRemarcacao.push(p));

    montar('Marcos');
    await userEvent.click(screen.getByRole('button'));

    expect(naRemarcacao).toEqual([{ hora: '09:30', staffId: 's1' }]);
    expect(naFolhaDeEncaixe).toHaveLength(0);

    largarDesvio();
    largarEncaixe();
  });

  it('desfazer o desvio devolve o clique ao dono de sempre', async () => {
    const naFolhaDeEncaixe: (PedidoDeEncaixe | undefined)[] = [];
    const largarEncaixe = assinarPedidoDeEncaixe((p) => naFolhaDeEncaixe.push(p));
    desviarPedidoDeVao(() => {})();

    montar();
    await userEvent.click(screen.getByRole('button'));

    expect(naFolhaDeEncaixe).toEqual([{ hora: '09:30', staffId: 's1' }]);
    largarEncaixe();
  });

  it('o botão sem hora (dia vazio) nunca vira remarcação', () => {
    // `pedirEncaixe()` sem pedido é o convite do dia vazio: ele não apontou
    // horário nenhum, então não há para onde mover ninguém.
    const naRemarcacao: PedidoDeEncaixe[] = [];
    const naFolhaDeEncaixe: (PedidoDeEncaixe | undefined)[] = [];
    const largarEncaixe = assinarPedidoDeEncaixe((p) => naFolhaDeEncaixe.push(p));
    const largarDesvio = desviarPedidoDeVao((p) => naRemarcacao.push(p));

    pedirEncaixe();

    expect(naRemarcacao).toHaveLength(0);
    expect(naFolhaDeEncaixe).toEqual([undefined]);

    largarDesvio();
    largarEncaixe();
  });

  it('o verbo do rótulo troca junto com o modo — estado não se lê só por realce', () => {
    montar('Marcos');
    const botao = screen.getByRole('button');
    expect(botao.getAttribute('aria-label')).toBe(
      'Remarcar Marcos para 09:30 · 1 h 30 min livre com Marcão',
    );
    // WCAG 2.5.3 continua valendo: o nome contém o texto visível inteiro.
    expect(botao.getAttribute('aria-label')).toContain(botao.textContent);
  });

  it('fora do modo a faixa continua sendo convite de encaixe', () => {
    montar();
    expect(screen.getByRole('button').getAttribute('aria-label')).toMatch(/^Encaixar às /);
  });
});
