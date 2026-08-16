import { describe, it, expect, vi } from 'vitest';
import type { Db } from '@/db/repositories';
import type { LojaDoBrain, ServicoDoBrain, BarbeiroDoBrain } from './tipos';

// Domínio mockado: o resolver só orquestra; a grade de verdade tem teste próprio.
vi.mock('@/domain/booking', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/domain/booking')>()),
  getAvailability: vi.fn(),
}));

vi.mock('@/domain/booking/create-appointment', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/domain/booking/create-appointment')>()),
  escolherBarbeiro: vi.fn(),
}));

vi.mock('@/db/repositories', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/db/repositories')>()),
  listFutureAppointmentsByCustomerPhone: vi.fn(),
}));

import { getAvailability, NotFoundError } from '@/domain/booking';
import { escolherBarbeiro } from '@/domain/booking/create-appointment';
import { listFutureAppointmentsByCustomerPhone } from '@/db/repositories';
import { resolverCandidatos } from './resolver';

const db = {} as unknown as Db;
const loja: LojaDoBrain = {
  id: 'loja-1',
  slug: 'barbearia-teste',
  name: 'Barbearia do Zé',
  timeZone: 'America/Sao_Paulo',
  maxAdvanceDays: 30,
};
const servicos: ServicoDoBrain[] = [{ id: 's1', name: 'Corte', durationMinutes: 30, priceCents: 4000 }];
const equipe: BarbeiroDoBrain[] = [
  { id: 'b1', name: 'João' },
  { id: 'b2', name: 'Pedro' },
];

const disponivel = vi.mocked(getAvailability);
const escolher = vi.mocked(escolherBarbeiro);
const listarFuturos = vi.mocked(listFutureAppointmentsByCustomerPhone);

// Reset feito no corpo de cada teste, não em `beforeEach`: no vitest 4, resetar
// um mock de fábrica dentro do hook faz o erro lançado pelo mock vazar como
// falha, mesmo quando o código sob teste o captura. Inline não tem esse efeito.
function limpar() {
  disponivel.mockReset();
  escolher.mockReset();
  listarFuturos.mockReset();
}

describe('resolverCandidatos', () => {
  it('resolve serviceName com o catálogo, sem tocar no banco', async () => {
    limpar();
    const r = await resolverCandidatos(db, loja, servicos, equipe, {
      slotToResolve: 'serviceName',
      slots: {},
    });
    expect(r.candidates.map((c) => c.id)).toEqual(['Corte']);
    expect(r.candidates.map((c) => c.fields.serviceId)).toEqual(['s1']);
    expect(disponivel).not.toHaveBeenCalled();
  });

  it('resolve staffName com a equipe', async () => {
    limpar();
    const r = await resolverCandidatos(db, loja, servicos, equipe, {
      slotToResolve: 'staffName',
      slots: {},
    });
    expect(r.candidates.map((c) => c.id)).toEqual(['João', 'Pedro']);
    expect(r.candidates.map((c) => c.fields.staffId)).toEqual(['b1', 'b2']);
  });

  it('resolve sessionTime pela grade, um candidato por horário', async () => {
    limpar();
    const slots = [
      { staffId: 'b1', staffName: 'João', start: new Date('2026-08-20T12:00:00Z'), end: new Date('2026-08-20T12:30:00Z'), durationMinutes: 30 },
      { staffId: 'b2', staffName: 'Pedro', start: new Date('2026-08-20T12:00:00Z'), end: new Date('2026-08-20T12:30:00Z'), durationMinutes: 30 },
      { staffId: 'b1', staffName: 'João', start: new Date('2026-08-20T12:30:00Z'), end: new Date('2026-08-20T13:00:00Z'), durationMinutes: 30 },
    ];
    disponivel.mockResolvedValue(slots);
    // Mock de escolherBarbeiro: devolve sempre o primeiro slot (simula
    // desempate sem diferença de carga). Para os testes de carga, há teste específico.
    escolher.mockImplementation(async (_db, _bid, candidatos) => candidatos[0]);

    const r = await resolverCandidatos(db, loja, servicos, equipe, {
      slotToResolve: 'sessionTime',
      slots: { serviceName: 'Corte', sessionDate: '2026-08-20' },
    });

    expect(r.candidates.map((c) => c.id)).toEqual(['09:00', '09:30']);
    // Um candidato por horário: o escolher resolve entre múltiplos barbeiros
    // livres no mesmo horário; o mock retorna sempre o primeiro.
    expect(r.candidates.map((c) => c.fields.staffName)).toEqual(['João', 'João']);
    expect(disponivel).toHaveBeenCalledWith(db, expect.objectContaining({ serviceId: 's1', date: '2026-08-20' }));
  });

  it('respeita o limite de candidatos', async () => {
    limpar();
    const slots = [
      { staffId: 'b1', staffName: 'João', start: new Date('2026-08-20T12:00:00Z'), end: new Date('2026-08-20T12:30:00Z'), durationMinutes: 30 },
      { staffId: 'b1', staffName: 'João', start: new Date('2026-08-20T12:30:00Z'), end: new Date('2026-08-20T13:00:00Z'), durationMinutes: 30 },
    ];
    disponivel.mockResolvedValue(slots);
    escolher.mockImplementation(async (_db, _bid, candidatos) => candidatos[0]);

    const r = await resolverCandidatos(db, loja, servicos, equipe, {
      slotToResolve: 'sessionTime',
      slots: { serviceName: 'Corte', sessionDate: '2026-08-20' },
      limit: 1,
    });
    expect(r.candidates).toHaveLength(1);
  });

  it('pede o serviço quando falta para resolver horário', async () => {
    limpar();
    const r = await resolverCandidatos(db, loja, servicos, equipe, {
      slotToResolve: 'sessionTime',
      slots: { sessionDate: '2026-08-20' },
    });
    expect(r.candidates).toEqual([]);
    expect(r.message).toMatch(/serviço/i);
    expect(disponivel).not.toHaveBeenCalled();
  });

  it('pede a data quando falta para resolver horário', async () => {
    limpar();
    const r = await resolverCandidatos(db, loja, servicos, equipe, {
      slotToResolve: 'sessionTime',
      slots: { serviceName: 'Corte' },
    });
    expect(r.candidates).toEqual([]);
    expect(r.message).toMatch(/dia/i);
  });

  it('devolve a mensagem do domínio quando a grade recusa', async () => {
    limpar();
    disponivel.mockImplementation(async () => {
      throw new NotFoundError('Data inválida');
    });
    const r = await resolverCandidatos(db, loja, servicos, equipe, {
      slotToResolve: 'sessionTime',
      slots: { serviceName: 'Corte', sessionDate: 'xx' },
    });
    expect(r.candidates).toEqual([]);
    expect(r.message).toBe('Data inválida');
  });

  it('devolve vazio para slot desconhecido', async () => {
    limpar();
    const r = await resolverCandidatos(db, loja, servicos, equipe, {
      slotToResolve: 'cor_favorita',
      slots: {},
    });
    expect(r.candidates).toEqual([]);
    expect(r.message).toMatch(/não sei/i);
  });

  it('usa escolherBarbeiro para desempate quando há múltiplos barbeiros', async () => {
    limpar();
    const slots = [
      { staffId: 'b1', staffName: 'João', start: new Date('2026-08-20T12:00:00Z'), end: new Date('2026-08-20T12:30:00Z'), durationMinutes: 30 },
      { staffId: 'b2', staffName: 'Pedro', start: new Date('2026-08-20T12:00:00Z'), end: new Date('2026-08-20T12:30:00Z'), durationMinutes: 30 },
    ];
    disponivel.mockResolvedValue(slots);
    // Mock: escolher o segundo (Pedro) em vez do primeiro (João)
    escolher.mockImplementation(async (_db, _bid, candidatos) => candidatos[1]);

    const r = await resolverCandidatos(db, loja, servicos, equipe, {
      slotToResolve: 'sessionTime',
      slots: { serviceName: 'Corte', sessionDate: '2026-08-20' },
    });

    expect(r.candidates).toHaveLength(1);
    expect(r.candidates[0].fields.staffName).toBe('Pedro');
    expect(escolher).toHaveBeenCalled();
  });

  it('resolve appointmentId listando agendamentos futuros do cliente', async () => {
    limpar();
    listarFuturos.mockResolvedValue([
      {
        id: 'apt-1',
        startAt: new Date('2026-08-25T14:00:00Z'),
        serviceName: 'Corte',
        staffName: 'João',
      },
      {
        id: 'apt-2',
        startAt: new Date('2026-08-27T10:30:00Z'),
        serviceName: 'Barba',
        staffName: 'Pedro',
      },
    ]);

    const r = await resolverCandidatos(db, loja, servicos, equipe, {
      slotToResolve: 'appointmentId',
      slots: { customerPhone: '11999999999' },
    });

    expect(r.candidates).toHaveLength(2);
    expect(r.candidates.map((c) => c.id)).toEqual(['apt-1', 'apt-2']);
    // Label deve conter serviço, data/hora e barbeiro em formato legível
    expect(r.candidates[0].label).toMatch(/Corte.*João/);
    expect(listarFuturos).toHaveBeenCalledWith(db, loja.id, '11999999999', expect.any(Date));
  });

  it('recusa resolver appointmentId sem telefone', async () => {
    limpar();
    const r = await resolverCandidatos(db, loja, servicos, equipe, {
      slotToResolve: 'appointmentId',
      slots: {},
    });
    expect(r.candidates).toEqual([]);
    expect(r.message).toMatch(/telefone/i);
  });

  it('informa quando não há agendamentos futuros para cancelar', async () => {
    limpar();
    listarFuturos.mockResolvedValue([]);

    const r = await resolverCandidatos(db, loja, servicos, equipe, {
      slotToResolve: 'appointmentId',
      slots: { customerPhone: '11999999999' },
    });

    expect(r.candidates).toEqual([]);
    expect(r.message).toMatch(/não achei/i);
  });
});
