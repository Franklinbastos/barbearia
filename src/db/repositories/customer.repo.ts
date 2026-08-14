import { and, eq, ilike, or, desc, asc, sql } from 'drizzle-orm';
import { customer, appointment, staff } from '@/db/schema';
import type { Db } from './types';

/** Transação aberta por `db.transaction`, aceita onde um `Db` é aceito. */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export type DbOrTx = Db | Tx;

/**
 * Política de escrita do nome. A superfície pública é anônima e o nome do
 * cliente vira parâmetro do template de WhatsApp disparado pelo número
 * verificado da barbearia — quem sabe o telefone de alguém não pode reescrever
 * o cadastro dessa pessoa. Só o painel (autenticado) corrige nome.
 */
export type CustomerNamePolicy = { atualizarNome: boolean };

export async function upsertCustomer(
  db: DbOrTx,
  barbershopId: string,
  dados: { name: string; phone: string },
  politica: CustomerNamePolicy = { atualizarNome: true },
) {
  const [linha] = await db
    .insert(customer)
    .values({ barbershopId, name: dados.name, phone: dados.phone })
    .onConflictDoUpdate({
      target: [customer.barbershopId, customer.phone],
      // Sem permissão de renomear, o SET reatribui o nome que já está lá: a
      // linha existente volta em RETURNING sem ser alterada.
      set: politica.atualizarNome ? { name: dados.name } : { name: sql`${customer.name}` },
    })
    .returning();
  return linha;
}

export async function listCustomers(db: Db, barbershopId: string, busca?: string) {
  const filtroBusca = busca
    ? or(ilike(customer.name, `%${busca}%`), ilike(customer.phone, `%${busca}%`))
    : undefined;

  return db
    .select()
    .from(customer)
    .where(and(eq(customer.barbershopId, barbershopId), filtroBusca))
    .orderBy(asc(customer.name))
    .limit(200);
}

export async function findCustomerById(db: Db, barbershopId: string, customerId: string) {
  const [linha] = await db
    .select()
    .from(customer)
    .where(and(eq(customer.barbershopId, barbershopId), eq(customer.id, customerId)))
    .limit(1);
  return linha ?? null;
}

/**
 * O histórico de um cliente, do mais recente para o mais antigo.
 *
 * O nome do barbeiro vem por `innerJoin`, e não por snapshot como o serviço:
 * `appointment.staffId` é `onDelete: 'restrict'`, então a linha do barbeiro
 * nunca some debaixo do atendimento. É o único campo que faltava para a ficha
 * calcular os quatro indicadores em memória, sem consulta nova.
 */
export async function listCustomerHistory(db: Db, barbershopId: string, customerId: string) {
  return db
    .select({
      id: appointment.id,
      startAt: appointment.startAt,
      status: appointment.status,
      serviceName: appointment.serviceNameSnapshot,
      priceCents: appointment.servicePriceCentsSnapshot,
      staffName: staff.name,
    })
    .from(appointment)
    .innerJoin(staff, eq(staff.id, appointment.staffId))
    .where(
      and(eq(appointment.barbershopId, barbershopId), eq(appointment.customerId, customerId)),
    )
    .orderBy(desc(appointment.startAt))
    .limit(100);
}
