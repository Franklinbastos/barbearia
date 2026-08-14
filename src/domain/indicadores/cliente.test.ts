import { describe, it, expect } from 'vitest';
import { listarSumidos, listarVieramUmaVezSo, calcularClientes, type VisitaDoCliente } from './cliente';

const AGORA = new Date('2026-08-14T12:00:00Z');

function dias(n: number): Date {
  return new Date(AGORA.getTime() - n * 24 * 60 * 60 * 1000);
}

function cliente(nome: string, atras: number[]): VisitaDoCliente {
  return {
    customerId: nome, nome, telefone: '11999998888',
    visitas: atras.map(dias).sort((a, b) => a.getTime() - b.getTime()),
  };
}

describe('listarSumidos — o corte é o ritmo de cada um', () => {
  it('quem corta a cada 15 dias e sumiu há 40 está sumido', () => {
    const r = listarSumidos([cliente('Quinzenal', [100, 85, 70, 55, 40])], AGORA);
    expect(r.map((c) => c.nome)).toContain('Quinzenal');
  });

  it('quem corta a cada 60 dias e sumiu há 40 NÃO está sumido', () => {
    // este é o caso que a regra dos 30 dias erra, e é o motivo da métrica existir
    const r = listarSumidos([cliente('Bimestral', [220, 160, 100, 40])], AGORA);
    expect(r.map((c) => c.nome)).not.toContain('Bimestral');
  });

  it('o corte é 1,5x o intervalo típico', () => {
    // intervalo de 20 dias; 25 dias de ausência ainda não é sumiço
    expect(listarSumidos([cliente('Recente', [60, 40, 20, 25])], AGORA)).toHaveLength(0);
    // 40 dias passa de 1,5 x 20 = 30
    expect(listarSumidos([cliente('Atrasado', [100, 80, 60, 40])], AGORA)).toHaveLength(1);
  });

  it('usa mediana, não média — um retorno atrasado não pode distorcer o corte', () => {
    // intervalos: 15, 15, 15, 90 → média 34, mediana 15
    const r = listarSumidos([cliente('ComUmSumico', [150, 60, 45, 30, 25])], AGORA);
    expect(r).toHaveLength(1);
  });

  it('com menos de 3 visitas não há ritmo para medir', () => {
    expect(listarSumidos([cliente('Duas', [200, 150])], AGORA)).toHaveLength(0);
  });

  it('ordena pelo mais atrasado em relação ao próprio ritmo, não pelo mais antigo', () => {
    const r = listarSumidos(
      [
        cliente('PoucoAtrasado', [120, 90, 60, 30]), // ritmo 30, ausente 30 → 1,0x
        cliente('MuitoAtrasado', [80, 70, 60, 50]),  // ritmo 10, ausente 50 → 5,0x
      ],
      AGORA,
    );
    expect(r[0].nome).toBe('MuitoAtrasado');
  });

  it('devolve o número de dias de atraso, para a tela poder explicar', () => {
    const r = listarSumidos([cliente('X', [100, 85, 70, 40])], AGORA);
    expect(r[0].diasAtraso).toBeGreaterThan(0);
    expect(r[0].intervaloTipico).toBeGreaterThan(0);
  });

  it('entre dois sumidos, quem está mais atrasado contra o próprio ritmo vem antes de quem sumiu há mais tempo', () => {
    // o teste acima não prova a ordenação: PoucoAtrasado está a 1,0x do ritmo,
    // é filtrado antes do sort e a lista fica com um item só. Aqui os dois
    // passam do corte, e a ordem por ausência crua seria a inversa.
    const r = listarSumidos(
      [
        cliente('RitmoLento', [300, 240, 180, 120]), // ritmo 60, ausente 120 → 2,0x
        cliente('RitmoRapido', [80, 70, 60, 50]), //    ritmo 10, ausente  50 → 5,0x
      ],
      AGORA,
    );
    expect(r.map((c) => c.nome)).toEqual(['RitmoRapido', 'RitmoLento']);
  });

  it('diz de quanto em quanto tempo o cliente corta, em dias inteiros', () => {
    const [r] = listarSumidos([cliente('Quinzenal', [100, 85, 70, 55, 40])], AGORA);
    expect(r.intervaloTipico).toBe(15);
    expect(r.diasAtraso).toBe(25); // ausente há 40, corta a cada 15
  });
});

describe('listarVieramUmaVezSo', () => {
  it('separa quem veio uma vez e não voltou — é outro problema', () => {
    const r = listarVieramUmaVezSo([cliente('Unico', [90]), cliente('Fiel', [90, 60, 30])], AGORA);
    expect(r.map((c) => c.nome)).toEqual(['Unico']);
  });

  it('quem veio ontem pela primeira vez ainda não é caso perdido', () => {
    expect(listarVieramUmaVezSo([cliente('Ontem', [1])], AGORA)).toHaveLength(0);
  });

  it('cabelo e barba no mesmo dia são uma visita só, não três', () => {
    // entram na agenda como atendimentos separados; contá-los como visitas
    // distintas daria intervalos de zero dia e tiraria o cliente desta lista
    const r = listarVieramUmaVezSo([cliente('CabeloEBarba', [200, 200, 200])], AGORA);
    expect(r.map((c) => c.nome)).toEqual(['CabeloEBarba']);
  });
});

describe('calcularClientes', () => {
  const janela = { inicio: dias(7), fim: AGORA, rotulo: 'semana', periodo: 'semana' as const };

  it('novo é quem teve a primeira visita da vida dentro da janela', () => {
    const r = calcularClientes([cliente('Novo', [3]), cliente('Velho', [200, 100, 3])], janela);
    expect(r.novos).toBe(1);
    expect(r.recorrentes).toBe(1);
    expect(r.atendidos).toBe(2);
  });

  it('tempo médio entre visitas ignora quem só veio uma vez', () => {
    const r = calcularClientes([cliente('Um', [3]), cliente('Dois', [33, 3])], janela);
    expect(r.diasEntreVisitas).toBe(30);
  });

  it('sem histórico devolve nulo em vez de zero — zero dia entre visitas mentiria', () => {
    expect(calcularClientes([], janela).diasEntreVisitas).toBeNull();
  });
});

describe('calcularClientes — taxa de retorno', () => {
  it('coorte que ainda não teve 90 dias para voltar não vira percentual', () => {
    // 1 dos 2 estreantes da semana voltou. Contar só ele no denominador daria
    // 100% de retorno toda semana em que alguém volta — o número mais bonito e
    // mais falso da tela. Enquanto a coorte não amadurece, não há taxa.
    const semana = { inicio: dias(7), fim: AGORA, rotulo: 'semana', periodo: 'semana' as const };
    const r = calcularClientes(
      [cliente('VoltouRapido', [5, 1]), cliente('AindaNaoVoltou', [3])],
      semana,
      AGORA,
    );
    expect(r.taxaRetorno).toBe(0);
  });

  it('com a coorte madura, é a fração dos estreantes que voltou em até 90 dias', () => {
    const janelaAntiga = { inicio: dias(160), fim: dias(130), rotulo: 'mês', periodo: 'mes' as const };
    const r = calcularClientes(
      [cliente('Voltou', [150, 90]), cliente('NaoVoltou', [150])],
      janelaAntiga,
      AGORA,
    );
    expect(r.taxaRetorno).toBeCloseTo(0.5);
  });

  it('voltar depois de 90 dias não conta como retorno — a coorte tem prazo', () => {
    const janelaAntiga = { inicio: dias(160), fim: dias(130), rotulo: 'mês', periodo: 'mes' as const };
    // estreou há 150 dias e só reapareceu há 20: voltou, mas fora do prazo
    const r = calcularClientes([cliente('VoltouTardeDemais', [150, 20])], janelaAntiga, AGORA);
    expect(r.taxaRetorno).toBe(0);
  });

  it('a maturidade da coorte é contada até agora, não até o fim da janela', () => {
    // a janela fechou 20 dias depois da estreia, mas de lá para cá passaram 150
    const janelaAntiga = { inicio: dias(160), fim: dias(130), rotulo: 'mês', periodo: 'mes' as const };
    const r = calcularClientes([cliente('NaoVoltou', [150])], janelaAntiga, AGORA);
    expect(r.taxaRetorno).toBe(0);
    expect(r.novos).toBe(1);
  });
});
