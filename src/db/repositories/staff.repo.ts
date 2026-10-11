import { and, eq, asc, gt, gte, lt, sql } from 'drizzle-orm';
import { staff, staffService, service, workingHours, timeOff } from '@/db/schema';
import type { Db } from './types';

export async function listActiveStaff(db: Db, barbershopId: string) {
  return db
    .select()
    .from(staff)
    .where(and(eq(staff.barbershopId, barbershopId), eq(staff.active, true)))
    .orderBy(asc(staff.name));
}

export async function listAllStaff(db: Db, barbershopId: string) {
  return db
    .select()
    .from(staff)
    .where(eq(staff.barbershopId, barbershopId))
    .orderBy(asc(staff.name));
}

export async function findStaffById(db: Db, barbershopId: string, staffId: string) {
  const [linha] = await db
    .select()
    .from(staff)
    .where(and(eq(staff.barbershopId, barbershopId), eq(staff.id, staffId)))
    .limit(1);
  return linha ?? null;
}

export async function listStaffForService(db: Db, barbershopId: string, serviceId: string) {
  return db
    .select({
      id: staff.id,
      name: staff.name,
      photoUrl: staff.photoUrl,
      effectiveDurationMinutes: sql<number>`coalesce(${staffService.durationMinutesOverride}, ${service.durationMinutes})`,
    })
    .from(staffService)
    .innerJoin(staff, eq(staff.id, staffService.staffId))
    .innerJoin(service, eq(service.id, staffService.serviceId))
    .where(
      and(
        eq(staffService.barbershopId, barbershopId),
        eq(staffService.serviceId, serviceId),
        eq(staff.active, true),
        eq(service.active, true),
      ),
    )
    .orderBy(asc(staff.name));
}

export async function listWorkingHours(db: Db, barbershopId: string, staffId: string, weekday: number) {
  return db
    .select()
    .from(workingHours)
    .where(
      and(
        eq(workingHours.barbershopId, barbershopId),
        eq(workingHours.staffId, staffId),
        eq(workingHours.weekday, weekday),
      ),
    )
    .orderBy(asc(workingHours.startTime));
}

export async function listWorkingHoursForStaff(db: Db, barbershopId: string, staffId: string) {
  return db
    .select()
    .from(workingHours)
    .where(and(eq(workingHours.barbershopId, barbershopId), eq(workingHours.staffId, staffId)))
    .orderBy(asc(workingHours.weekday), asc(workingHours.startTime));
}

/** Expediente de todos os barbeiros da loja — a agenda precisa dele para saber quem folga em cada dia. */
export async function listWorkingHoursForBarbershop(db: Db, barbershopId: string) {
  return db
    .select({
      staffId: workingHours.staffId,
      weekday: workingHours.weekday,
      startTime: workingHours.startTime,
      endTime: workingHours.endTime,
    })
    .from(workingHours)
    .where(eq(workingHours.barbershopId, barbershopId))
    .orderBy(asc(workingHours.staffId), asc(workingHours.weekday), asc(workingHours.startTime));
}

/** Bloqueios (folga, almoço) de todos os barbeiros que tocam a janela [from, to). */
export async function listTimeOffBetween(db: Db, barbershopId: string, from: Date, to: Date) {
  return db
    .select({
      id: timeOff.id,
      staffId: timeOff.staffId,
      startAt: timeOff.startAt,
      endAt: timeOff.endAt,
      reason: timeOff.reason,
    })
    .from(timeOff)
    .where(and(eq(timeOff.barbershopId, barbershopId), lt(timeOff.startAt, to), gt(timeOff.endAt, from)))
    .orderBy(asc(timeOff.startAt));
}

export async function listStaffServiceLinks(db: Db, barbershopId: string, staffId: string) {
  return db
    .select()
    .from(staffService)
    .where(and(eq(staffService.barbershopId, barbershopId), eq(staffService.staffId, staffId)));
}

export async function listTimeOffForStaff(db: Db, barbershopId: string, staffId: string, from: Date) {
  return db
    .select()
    .from(timeOff)
    .where(
      and(
        eq(timeOff.barbershopId, barbershopId),
        eq(timeOff.staffId, staffId),
        gte(timeOff.endAt, from),
      ),
    )
    .orderBy(asc(timeOff.startAt));
}
