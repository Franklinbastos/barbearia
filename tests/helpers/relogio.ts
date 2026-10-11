import { afterEach, beforeEach, vi } from 'vitest';

/**
 * O "hoje" dos testes que agendam em data fixa (a segunda-feira 2026-09-07).
 *
 * Esses testes foram escritos quando 07/09 ainda era futuro. O domínio calcula
 * a janela de agendamento a partir do relógio real (`createAppointment` e a rota
 * pública não recebem `now`), então, passada a data, a grade volta vazia e o
 * teste falha sem que nada tenha quebrado. Fixar o relógio numa data anterior
 * devolve o cenário de quando foram escritos — e impede que vençam de novo.
 *
 * Por que 20/08 (18 dias antes): tem que caber na janela padrão de 30 dias
 * (`max_advance_days`) e ficar fora da janela de 7 dias que o teste de
 * OUTSIDE_BOOKING_WINDOW da API pública usa.
 */
export const HOJE_DOS_TESTES = new Date('2026-08-20T12:00:00Z');

/**
 * Registra, no arquivo que chamar, um relógio que começa em `agora` e anda em
 * tempo real. Só `Date` é falsificado: `setTimeout`/`setInterval` continuam
 * reais, porque o driver do Postgres depende deles.
 */
export function usarRelogioFixo(agora: Date = HOJE_DOS_TESTES): void {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true });
    vi.setSystemTime(agora);
  });
  afterEach(() => {
    vi.useRealTimers();
  });
}
