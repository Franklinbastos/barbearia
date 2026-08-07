'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, inArray } from 'drizzle-orm';
import { DateTime } from 'luxon';
import { z } from 'zod';
import { db } from '@/db/client';
import { staff, staffService, workingHours, timeOff } from '@/db/schema';
import { requireOwner, type PanelSession } from '@/lib/session';
import { findBarbershopById, listActiveServices } from '@/db/repositories';
import { validateWorkingBlocks, validateTimeOff } from '@/domain/catalog/schedule-rules';

export type FormState = { erro?: string; ok?: boolean };

type BarbeiroCarregado =
  | { ok: true; sessao: PanelSession; barbeiro: typeof staff.$inferSelect }
  | { ok: false; erro: string };

async function carregarBarbeiro(staffId: string): Promise<BarbeiroCarregado> {
  const acesso = await requireOwner();
  if (!acesso.ok) return { ok: false, erro: acesso.erro };
  const sessao = acesso.sessao;

  const [barbeiro] = await db
    .select()
    .from(staff)
    .where(and(eq(staff.barbershopId, sessao.barbershopId), eq(staff.id, staffId)))
    .limit(1);

  if (!barbeiro) return { ok: false, erro: 'Barbeiro não encontrado' };
  return { ok: true, sessao, barbeiro };
}

/** Teto de 8h, o mesmo que `service-rules.ts` impõe à duração do serviço. */
const MAX_DURACAO_MINUTOS = 480;

/**
 * Campo vazio vira `null` (usa a duração do serviço). Qualquer outra coisa
 * precisa ser inteiro de 1 a 480: `'0'` é truthy em JavaScript, gravava zero e
 * derrubava o cálculo da grade com 500 em toda consulta daquele serviço.
 */
const duracaoPropria = z
  .string()
  .trim()
  .refine((v) => v === '' || /^\d+$/.test(v), 'A duração própria precisa ser um número inteiro de minutos')
  .transform((v) => (v === '' ? null : Number(v)))
  .refine(
    (v) => v === null || (v >= 1 && v <= MAX_DURACAO_MINUTOS),
    `A duração própria precisa ficar entre 1 e ${MAX_DURACAO_MINUTOS} minutos`,
  );

export async function saveStaffServicesAction(
  staffId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const carregado = await carregarBarbeiro(staffId);
  if (!carregado.ok) return { erro: carregado.erro };
  const { sessao } = carregado;

  const servicos = await listActiveServices(db, sessao.barbershopId);
  const selecionados = new Set(formData.getAll('serviceIds').map(String));
  const escolhidos = servicos.filter((s) => selecionados.has(s.id));

  const linhas: Array<{
    barbershopId: string;
    staffId: string;
    serviceId: string;
    durationMinutesOverride: number | null;
  }> = [];

  for (const s of escolhidos) {
    const parsed = duracaoPropria.safeParse(String(formData.get(`duration_${s.id}`) ?? ''));
    if (!parsed.success) return { erro: `${s.name}: ${parsed.error.issues[0].message}` };
    linhas.push({
      barbershopId: sessao.barbershopId,
      staffId,
      serviceId: s.id,
      durationMinutesOverride: parsed.data,
    });
  }

  const idsAtivos = servicos.map((s) => s.id);

  await db.transaction(async (tx) => {
    // Só os vínculos dos serviços ATIVOS entram na troca. O formulário não
    // mostra serviço inativo, então apagar tudo destruía em silêncio o vínculo
    // do barbeiro com o serviço que a barbearia desligou no inverno.
    if (idsAtivos.length > 0) {
      await tx
        .delete(staffService)
        .where(
          and(
            eq(staffService.barbershopId, sessao.barbershopId),
            eq(staffService.staffId, staffId),
            inArray(staffService.serviceId, idsAtivos),
          ),
        );
    }

    if (linhas.length > 0) await tx.insert(staffService).values(linhas);
  });

  revalidatePath(`/app/equipe/${staffId}`);
  return { ok: true };
}

const DIAS_SEMANA = [1, 2, 3, 4, 5, 6, 7];
const MAX_BLOCOS_POR_DIA = 3;

export async function saveWorkingHoursAction(
  staffId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const carregado = await carregarBarbeiro(staffId);
  if (!carregado.ok) return { erro: carregado.erro };
  const { sessao } = carregado;

  const weekday = Number(formData.get('weekday'));
  if (!DIAS_SEMANA.includes(weekday)) return { erro: 'Dia da semana inválido' };

  const blocos: Array<{ startTime: string; endTime: string }> = [];
  for (let i = 1; i <= MAX_BLOCOS_POR_DIA; i++) {
    const startTime = String(formData.get(`block${i}_start`) ?? '').trim();
    const endTime = String(formData.get(`block${i}_end`) ?? '').trim();
    if (startTime && endTime) blocos.push({ startTime, endTime });
  }

  try {
    validateWorkingBlocks(blocos);
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : 'Expediente inválido' };
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(workingHours)
      .where(
        and(
          eq(workingHours.barbershopId, sessao.barbershopId),
          eq(workingHours.staffId, staffId),
          eq(workingHours.weekday, weekday),
        ),
      );

    if (blocos.length > 0) {
      await tx.insert(workingHours).values(
        blocos.map((b) => ({ ...b, weekday, barbershopId: sessao.barbershopId, staffId })),
      );
    }
  });

  revalidatePath(`/app/equipe/${staffId}`);
  return { ok: true };
}

export async function createTimeOffAction(
  staffId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const carregado = await carregarBarbeiro(staffId);
  if (!carregado.ok) return { erro: carregado.erro };
  const { sessao } = carregado;

  const loja = await findBarbershopById(db, sessao.barbershopId);
  if (!loja) return { erro: 'Barbearia não encontrada' };

  const date = String(formData.get('date') ?? '');
  const startTime = String(formData.get('startTime') ?? '');
  const endTime = String(formData.get('endTime') ?? '');
  const reason = String(formData.get('reason') ?? '').trim() || null;

  const startAt = DateTime.fromISO(`${date}T${startTime}`, { zone: loja.timeZone }).toJSDate();
  const endAt = DateTime.fromISO(`${date}T${endTime}`, { zone: loja.timeZone }).toJSDate();

  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
    return { erro: 'Informe data e horários válidos' };
  }

  try {
    validateTimeOff(startAt, endAt);
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : 'Bloqueio inválido' };
  }

  await db.insert(timeOff).values({ barbershopId: sessao.barbershopId, staffId, startAt, endAt, reason });

  revalidatePath(`/app/equipe/${staffId}`);
  return { ok: true };
}

export async function deleteTimeOffAction(staffId: string, timeOffId: string) {
  const carregado = await carregarBarbeiro(staffId);
  if (!carregado.ok) return;
  const { sessao } = carregado;

  await db
    .delete(timeOff)
    .where(
      and(
        eq(timeOff.barbershopId, sessao.barbershopId),
        eq(timeOff.staffId, staffId),
        eq(timeOff.id, timeOffId),
      ),
    );

  revalidatePath(`/app/equipe/${staffId}`);
}
