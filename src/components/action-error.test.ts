import { describe, it, expect, vi } from 'vitest';
import { redirect } from 'next/navigation';
import { executarAcao, erroDoRetorno, MENSAGEM_PADRAO_DE_ACAO } from './action-error';

describe('erroDoRetorno', () => {
  it('não vê erro em retorno vazio', () => {
    expect(erroDoRetorno(undefined)).toBeNull();
    expect(erroDoRetorno(null)).toBeNull();
    expect(erroDoRetorno({})).toBeNull();
  });

  it('lê a mensagem de um retorno { erro }', () => {
    expect(erroDoRetorno({ erro: 'Horário já ocupado' })).toBe('Horário já ocupado');
  });

  it('lê também { error } em inglês, porque a action pode mudar', () => {
    expect(erroDoRetorno({ error: 'SLOT_TAKEN' })).toBe('SLOT_TAKEN');
  });

  it('trata ok: false como falha mesmo sem mensagem', () => {
    expect(erroDoRetorno({ ok: false })).toBe(MENSAGEM_PADRAO_DE_ACAO);
  });

  it('não confunde sucesso com falha', () => {
    expect(erroDoRetorno({ ok: true })).toBeNull();
    expect(erroDoRetorno({ erro: '' })).toBeNull();
  });
});

describe('executarAcao', () => {
  it('não avisa nada quando a action passa', async () => {
    const aoFalhar = vi.fn();
    await executarAcao(async () => undefined, aoFalhar);
    expect(aoFalhar).not.toHaveBeenCalled();
  });

  it('avisa quando a action lança — o caso do cancelamento em duas abas', async () => {
    const aoFalhar = vi.fn();
    await executarAcao(async () => {
      throw new Error('Agendamento não encontrado');
    }, aoFalhar);
    expect(aoFalhar).toHaveBeenCalledWith(MENSAGEM_PADRAO_DE_ACAO);
  });

  it('avisa quando a action devolve erro estruturado em vez de lançar', async () => {
    const aoFalhar = vi.fn();
    await executarAcao(async () => ({ erro: 'Este horário já passou' }), aoFalhar);
    expect(aoFalhar).toHaveBeenCalledWith('Este horário já passou');
  });

  it('deixa o redirect do Next passar em vez de engolir', async () => {
    const aoFalhar = vi.fn();
    await expect(
      executarAcao(async () => {
        redirect('/login');
      }, aoFalhar),
    ).rejects.toThrow();
    expect(aoFalhar).not.toHaveBeenCalled();
  });

  it('aceita action síncrona', async () => {
    const aoFalhar = vi.fn();
    await executarAcao(() => {
      throw new Error('boom');
    }, aoFalhar);
    expect(aoFalhar).toHaveBeenCalledWith(MENSAGEM_PADRAO_DE_ACAO);
  });

  it('a mensagem padrão é em pt-BR e não vaza detalhe interno', async () => {
    const aoFalhar = vi.fn();
    await executarAcao(async () => {
      throw new Error('DrizzleQueryError: Failed query: update "appointment"');
    }, aoFalhar);
    expect(aoFalhar).toHaveBeenCalledWith(MENSAGEM_PADRAO_DE_ACAO);
    expect(MENSAGEM_PADRAO_DE_ACAO).toMatch(/tente de novo/i);
    expect(MENSAGEM_PADRAO_DE_ACAO).not.toMatch(/query|error|failed/i);
  });
});
