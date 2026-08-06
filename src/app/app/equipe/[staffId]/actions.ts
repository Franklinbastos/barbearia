'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { DateTime } from 'luxon';
import { db } from '@/db/client';
import { staff, staffService, workingHours, timeOff } from '@/db/schema';
import { requireSession } from '@/lib/session';
import { findBarbershopById, listActiveServices } from '@/db/repositories';
import { validateWorkingBlocks, validateTimeOff } from '@/domain/catalog/schedule-rules';

export type FormState = { erro?: string; ok?: boolean };

async function carregarBarbeiro(staffId: string) {
  const sessao = await requireSession();
  const [barbeiro] = await db
    .select()
    .from(staff)
    .where(and(eq(staff.barbershopId, sessao.barbershopId), eq(staff.id, staffId)))
    .limit(1);
  return { sessao, barbeiro };
}

export async function saveStaffServicesAction(
  staffId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { sessao, barbeiro } = await carregarBarbeiro(staffId);
  if (!barbeiro) return { erro: 'Barbeiro não encontrado' };

  const servicos = await listActiveServices(db, sessao.barbershopId);
  const selecionados = new Set(formData.getAll('serviceIds').map(String));

  await db.transaction(async (tx) => {
    await tx
      .delete(staffService)
      .where(and(eq(staffService.barbershopId, sessao.barbershopId), eq(staffService.staffId, staffId)));

    const linhas = servicos
      .filter((s) => selecionados.has(s.id))
      .map((s) => {
        const override = String(formData.get(`duration_${s.id}`) ?? '').trim();
        return {
          barbershopId: sessao.barbershopId,
          staffId,
          serviceId: s.id,
          durationMinutesOverride: override ? Number(override) : null,
        };
      });

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
  const { sessao, barbeiro } = await carregarBarbeiro(staffId);
  if (!barbeiro) return { erro: 'Barbeiro não encontrado' };

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
  const { sessao, barbeiro } = await carregarBarbeiro(staffId);
  if (!barbeiro) return { erro: 'Barbeiro não encontrado' };

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
  const { sessao, barbeiro } = await carregarBarbeiro(staffId);
  if (!barbeiro) return;

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
