import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  montarUrlDeGrade,
  carregarHorarios,
  MENSAGEM_PADRAO_DE_FALHA,
  type HorarioDisponivel,
} from './availability';

const CONSULTA = { slug: 'barbearia-x', serviceId: 'srv-1', date: '2026-09-09' };

function horario(startAt: string): HorarioDisponivel {
  return { startAt, staffId: 'st-1', staffName: 'João' };
}

/** Promessa que só resolve quando o teste mandar. */
function adiada<T>() {
  let resolver!: (valor: T) => void;
  let rejeitar!: (erro: unknown) => void;
  const promessa = new Promise<T>((res, rej) => {
    resolver = res;
    rejeitar = rej;
  });
  return { promessa, resolver, rejeitar };
}

function respostaOk(slots: HorarioDisponivel[]): Response {
  return { ok: true, status: 200, json: async () => ({ slots }) } as unknown as Response;
}

function respostaErro(status: number, corpo: unknown): Response {
  return { ok: false, status, json: async () => corpo } as unknown as Response;
}

function espioes() {
  return { aoReceber: vi.fn(), aoFalhar: vi.fn() };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('montarUrlDeGrade', () => {
  it('inclui serviço e data', () => {
    const url = montarUrlDeGrade(CONSULTA);
    expect(url).toContain('/api/public/barbearia-x/availability?');
    expect(url).toContain('serviceId=srv-1');
    expect(url).toContain('date=2026-09-09');
    expect(url).not.toContain('staffId');
  });

  it('inclui o barbeiro quando escolhido', () => {
    expect(montarUrlDeGrade({ ...CONSULTA, staffId: 'st-9' })).toContain('staffId=st-9');
  });

  it('escapa o slug', () => {
    expect(montarUrlDeGrade({ ...CONSULTA, slug: 'a/b' })).toContain('/api/public/a%2Fb/availability');
  });
});

describe('carregarHorarios', () => {
  it('entrega os horários recebidos', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respostaOk([horario('2026-09-09T12:00:00.000Z')])));
    const { aoReceber, aoFalhar } = espioes();

    await carregarHorarios(CONSULTA, new AbortController().signal, { aoReceber, aoFalhar });

    expect(aoReceber).toHaveBeenCalledWith([horario('2026-09-09T12:00:00.000Z')]);
    expect(aoFalhar).not.toHaveBeenCalled();
  });

  it('passa o AbortSignal para o fetch', async () => {
    const espiaoFetch = vi.fn(async (_url: string, _init?: RequestInit) => respostaOk([]));
    vi.stubGlobal('fetch', espiaoFetch);
    const controlador = new AbortController();

    await carregarHorarios(CONSULTA, controlador.signal, espioes());

    expect(espiaoFetch.mock.calls[0][1]).toMatchObject({ signal: controlador.signal });
  });

  it('descarta a resposta do dia antigo quando o usuário já trocou de dia', async () => {
    const quarta = adiada<Response>();
    const quinta = adiada<Response>();
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => (String(url).includes('2026-09-09') ? quarta.promessa : quinta.promessa)),
    );

    const espiaoQuarta = espioes();
    const espiaoQuinta = espioes();
    const controladorQuarta = new AbortController();
    const controladorQuinta = new AbortController();

    const pendenteQuarta = carregarHorarios(CONSULTA, controladorQuarta.signal, espiaoQuarta);
    // O usuário troca para quinta antes de a quarta responder.
    controladorQuarta.abort();
    const pendenteQuinta = carregarHorarios(
      { ...CONSULTA, date: '2026-09-10' },
      controladorQuinta.signal,
      espiaoQuinta,
    );

    // A rede lenta devolve a quarta DEPOIS da quinta.
    quinta.resolver(respostaOk([horario('2026-09-10T12:00:00.000Z')]));
    await pendenteQuinta;
    quarta.resolver(respostaOk([horario('2026-09-09T12:00:00.000Z')]));
    await pendenteQuarta;

    expect(espiaoQuarta.aoReceber).not.toHaveBeenCalled();
    expect(espiaoQuarta.aoFalhar).not.toHaveBeenCalled();
    expect(espiaoQuinta.aoReceber).toHaveBeenCalledWith([horario('2026-09-10T12:00:00.000Z')]);
  });

  it('fica em silêncio quando o próprio fetch é abortado', async () => {
    const controlador = new AbortController();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        controlador.abort();
        throw Object.assign(new Error('This operation was aborted'), { name: 'AbortError' });
      }),
    );
    const { aoReceber, aoFalhar } = espioes();

    await carregarHorarios(CONSULTA, controlador.signal, { aoReceber, aoFalhar });

    expect(aoReceber).not.toHaveBeenCalled();
    expect(aoFalhar).not.toHaveBeenCalled();
  });

  it('mostra a mensagem real do servidor em vez de lista vazia muda (429)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        respostaErro(429, {
          error: 'RATE_LIMITED',
          message: 'Muitas consultas. Espere um instante e tente de novo.',
        }),
      ),
    );
    const { aoReceber, aoFalhar } = espioes();

    await carregarHorarios(CONSULTA, new AbortController().signal, { aoReceber, aoFalhar });

    expect(aoReceber).not.toHaveBeenCalled();
    expect(aoFalhar).toHaveBeenCalledWith('Muitas consultas. Espere um instante e tente de novo.');
  });

  it('avisa em 500 mesmo sem mensagem no corpo', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respostaErro(500, {})));
    const { aoReceber, aoFalhar } = espioes();

    await carregarHorarios(CONSULTA, new AbortController().signal, { aoReceber, aoFalhar });

    expect(aoReceber).not.toHaveBeenCalled();
    expect(aoFalhar).toHaveBeenCalledWith(MENSAGEM_PADRAO_DE_FALHA);
  });

  it('avisa quando o corpo do erro nem é JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 502,
        json: async () => {
          throw new SyntaxError('Unexpected token <');
        },
      }) as unknown as Response),
    );
    const { aoReceber, aoFalhar } = espioes();

    await carregarHorarios(CONSULTA, new AbortController().signal, { aoReceber, aoFalhar });

    expect(aoReceber).not.toHaveBeenCalled();
    expect(aoFalhar).toHaveBeenCalledWith(MENSAGEM_PADRAO_DE_FALHA);
  });

  it('avisa quando a rede cai', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    const { aoReceber, aoFalhar } = espioes();

    await carregarHorarios(CONSULTA, new AbortController().signal, { aoReceber, aoFalhar });

    expect(aoFalhar).toHaveBeenCalledWith(MENSAGEM_PADRAO_DE_FALHA);
  });

  it('trata corpo sem a chave slots como lista vazia', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }) as unknown as Response));
    const { aoReceber, aoFalhar } = espioes();

    await carregarHorarios(CONSULTA, new AbortController().signal, { aoReceber, aoFalhar });

    expect(aoReceber).toHaveBeenCalledWith([]);
    expect(aoFalhar).not.toHaveBeenCalled();
  });
});
