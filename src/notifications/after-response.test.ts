import { describe, it, expect, vi, beforeEach } from 'vitest';
import { after } from 'next/server';
import { afterResponse } from './after-response';

vi.mock('next/server', () => ({ after: vi.fn() }));

const afterMock = vi.mocked(after);

describe('afterResponse', () => {
  beforeEach(() => {
    afterMock.mockReset();
  });

  it('entrega a tarefa ao after() do Next em vez de soltar a promessa', () => {
    const tarefa = vi.fn(async () => {});
    afterResponse(tarefa, 'falhou');

    expect(afterMock).toHaveBeenCalledTimes(1);
    // Sem executar o callback, a tarefa não roda: quem espera é a plataforma.
    expect(tarefa).not.toHaveBeenCalled();

    const agendada = afterMock.mock.calls[0][0] as () => void;
    agendada();
    expect(tarefa).toHaveBeenCalledTimes(1);
  });

  it('roda a tarefa mesmo fora de um request scope do Next', async () => {
    afterMock.mockImplementation(() => {
      throw new Error('`after` was called outside a request scope.');
    });
    const tarefa = vi.fn(async () => {});

    expect(() => afterResponse(tarefa, 'falhou')).not.toThrow();
    expect(tarefa).toHaveBeenCalledTimes(1);
  });

  it('não deixa a falha da tarefa virar rejeição não tratada', async () => {
    const erros: unknown[] = [];
    const espiao = vi.spyOn(console, 'error').mockImplementation((...args) => {
      erros.push(args);
    });
    afterMock.mockImplementation((cb) => {
      void (cb as () => void)();
    });

    afterResponse(async () => {
      throw new Error('provider fora do ar');
    }, 'Falha ao notificar');
    await Promise.resolve();
    await Promise.resolve();

    expect(erros).toHaveLength(1);
    espiao.mockRestore();
  });
});
