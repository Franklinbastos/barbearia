'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, inArray } from 'drizzle-orm';
import { DateTime } from 'luxon';
import { db } from '@/db/client';
import { appointment } from '@/db/schema';
import { findBarbershopById, listBusyRanges, listStaffForService } from '@/db/repositories';
import { requireSession } from '@/lib/session';
import { cancelAppointment, createWalkInAppointment, rescheduleAppointment } from '@/domain/booking';
import { countAppointmentsByStaff } from '@/domain/booking/staff-load';
import { resolverInicioDoEncaixe } from './encaixe';

export async function setAppointmentStatusAction(
  appointmentId: string,
  status: 'DONE' | 'NO_SHOW' | 'CANCELED',
) {
  const sessao = await requireSession();

  if (status === 'CANCELED') {
    // origin PANEL: a barbearia logada pode fechar atendimento que já começou ou
    // que já passou. O padrão de cancelAppointment é o caminho restrito do cliente.
    await cancelAppointment(db, sessao.barbershopId, appointmentId, { origin: 'PANEL' });
  } else {
    await db
      .update(appointment)
      .set({ status })
      .where(
        and(eq(appointment.barbershopId, sessao.barbershopId), eq(appointment.id, appointmentId)),
      );
  }

  revalidatePath('/app/agenda');
}

/**
 * O "Desfazer" da agenda: volta um atendimento fechado para `BOOKED`.
 *
 * `CANCELED` **nunca** entra. Cancelar libera o horário na grade pública, e
 * entre o cancelamento e o arrependimento o slot pode já ter sido revendido —
 * reabrir por cima criaria dois clientes na mesma cadeira. Para esse caso a
 * tela oferece "Reagendar", não "Reabrir".
 *
 * O filtro de status vai no `WHERE` junto com o `barbershopId`: assim a decisão
 * é do banco, numa instrução só, e não sobra janela entre ler e escrever.
 */
export async function reopenAppointmentAction(
  appointmentId: string,
): Promise<{ erro: string } | undefined> {
  const sessao = await requireSession();

  const reabertos = await db
    .update(appointment)
    .set({ status: 'BOOKED' })
    .where(
      and(
        eq(appointment.barbershopId, sessao.barbershopId),
        eq(appointment.id, appointmentId),
        inArray(appointment.status, ['DONE', 'NO_SHOW']),
      ),
    )
    .returning({ id: appointment.id });

  if (reabertos.length === 0) {
    return { erro: 'Não foi possível reabrir este horário. Agendamento cancelado não volta — use o encaixe para remarcar.' };
  }

  revalidatePath('/app/agenda');
}

export type ManualBookingState = { erro?: string; ok?: boolean };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function texto(formData: FormData, campo: string): string {
  const valor = formData.get(campo);
  return typeof valor === 'string' ? valor.trim() : '';
}

/**
 * "Primeiro que vagar" (§5.8): o balcão manda `staffId` vazio e o servidor
 * desempata.
 *
 * O critério é o mesmo do "Qualquer barbeiro" da página pública — entre os que
 * estão de fato livres naquele instante, fica com quem tem menos atendimentos
 * no dia —, só que sem passar pela grade: o encaixe existe justamente para
 * horários que a grade não tem.
 *
 * Empate mantém a ordem alfabética que `listStaffForService` já devolve:
 * resultado estável, sem sorteio.
 */
async function escolherBarbeiroDoEncaixe(
  barbershopId: string,
  serviceId: string,
  inicio: Date,
  timeZone: string,
): Promise<string | null> {
  const candidatos = await listStaffForService(db, barbershopId, serviceId);

  const livres: { id: string }[] = [];
  for (const candidato of candidatos) {
    const duracao = Number(candidato.effectiveDurationMinutes);
    if (!Number.isFinite(duracao) || duracao <= 0) continue;
    const fim = new Date(inicio.getTime() + duracao * 60_000);
    const ocupado = await listBusyRanges(db, barbershopId, candidato.id, inicio, fim);
    if (ocupado.length === 0) livres.push({ id: candidato.id });
  }

  if (livres.length === 0) return null;
  if (livres.length === 1) return livres[0].id;

  const dia = DateTime.fromJSDate(inicio).setZone(timeZone);
  const carga = await countAppointmentsByStaff(
    db,
    barbershopId,
    livres.map((c) => c.id),
    dia.startOf('day').toJSDate(),
    dia.plus({ days: 1 }).startOf('day').toJSDate(),
  );

  return livres.reduce((melhor, atual) =>
    (carga.get(atual.id) ?? 0) < (carga.get(melhor.id) ?? 0) ? atual : melhor,
  ).id;
}

export async function createManualAppointmentAction(
  _prev: ManualBookingState,
  formData: FormData,
): Promise<ManualBookingState> {
  // Encaixe é operação de balcão: o BARBER também encaixa, não só o OWNER.
  const sessao = await requireSession();

  const loja = await findBarbershopById(db, sessao.barbershopId);
  if (!loja) return { erro: 'Barbearia não encontrada.' };

  const serviceId = texto(formData, 'serviceId');
  const staffId = texto(formData, 'staffId');
  if (!UUID.test(serviceId)) return { erro: 'Escolha um serviço.' };
  // Vazio é a ficha "Primeiro que vagar", e não campo esquecido: o servidor já
  // sabe desempatar por carga, e o painel jogava isso fora.
  if (staffId !== '' && !UUID.test(staffId)) return { erro: 'Escolha um barbeiro.' };

  const startAt = resolverInicioDoEncaixe({
    startAt: texto(formData, 'startAt'),
    date: texto(formData, 'date'),
    hora: texto(formData, 'horaLivre'),
    timeZone: loja.timeZone,
  });
  if (!startAt) return { erro: 'Informe um horário válido para o encaixe.' };

  const barbeiro =
    staffId !== ''
      ? staffId
      : await escolherBarbeiroDoEncaixe(sessao.barbershopId, serviceId, startAt, loja.timeZone);
  if (!barbeiro) return { erro: 'Nenhum barbeiro livre nesse horário. Escolha outro horário.' };

  const name = texto(formData, 'name');
  if (name.length < 2 || name.length > 80) return { erro: 'Informe o nome do cliente.' };

  const phone = texto(formData, 'phone').replace(/\D/g, '');
  if (phone.length < 10 || phone.length > 13) return { erro: 'Informe um telefone com DDD.' };

  try {
    // Caminho próprio do balcão: fora da grade, sem antecedência mínima e sem
    // janela máxima — quem está com o cliente na cadeira sabe o que faz.
    await createWalkInAppointment(db, {
      barbershopId: sessao.barbershopId,
      serviceId,
      staffId: barbeiro,
      startAt,
      customer: { name, phone },
    });
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : 'Não foi possível agendar' };
  }

  revalidatePath('/app/agenda');
  return { ok: true };
}

export type RescheduleAppointmentState = { erro?: string; ok?: boolean };

/**
 * Remarcar sem cancelar (§2.1 do plano de 15/08/2026).
 *
 * O dia e a hora vêm separados, como no encaixe, e a tradução para instante é a
 * **mesma** `resolverInicioDoEncaixe`: `HH:mm` só vira instante com o fuso da
 * barbearia junto, e uma segunda cópia dessa conta divergiria no primeiro
 * ajuste. O dia vem no formulário porque quem está escolhendo pode ter rolado
 * para outra data — "semana que vem, mesma hora" é o caso mais comum.
 *
 * `staffId` é o dono do vão que o dedo apontou: a faixa é por barbeiro, e
 * ignorá-lo mandaria o cliente para a cadeira errada — ou para cima de quem já
 * está nela.
 */
export async function rescheduleAppointmentAction(
  _prev: RescheduleAppointmentState,
  formData: FormData,
): Promise<RescheduleAppointmentState> {
  const sessao = await requireSession();

  const loja = await findBarbershopById(db, sessao.barbershopId);
  if (!loja) return { erro: 'Barbearia não encontrada.' };

  const appointmentId = texto(formData, 'appointmentId');
  const staffId = texto(formData, 'staffId');
  if (!UUID.test(appointmentId)) return { erro: 'Agendamento não informado.' };
  // Vazio é "mantém o barbeiro": o domínio decide isso, não o formulário.
  if (staffId !== '' && !UUID.test(staffId)) return { erro: 'Barbeiro inválido.' };

  const novoInicio = resolverInicioDoEncaixe({
    date: texto(formData, 'date'),
    hora: texto(formData, 'hora'),
    timeZone: loja.timeZone,
  });
  if (!novoInicio) return { erro: 'Informe um horário válido.' };

  try {
    await rescheduleAppointment(db, {
      appointmentId,
      barbershopId: sessao.barbershopId,
      novoInicio,
      novoStaffId: staffId === '' ? undefined : staffId,
      avisarCliente: formData.get('avisarCliente') !== null,
    });
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : 'Não foi possível remarcar' };
  }

  revalidatePath('/app/agenda');
  return { ok: true };
}

