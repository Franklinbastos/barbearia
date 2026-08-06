import { DateTime } from 'luxon';
import { requireSession } from '@/lib/session';
import { db } from '@/db/client';
import { findBarbershopById, listActiveStaff, listActiveServices, listAppointmentsBetween } from '@/db/repositories';
import { DayGrid } from './day-grid';
import { ManualBookingForm } from './manual-booking-form';

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ data?: string }>;
}) {
  const { data } = await searchParams;
  const sessao = await requireSession();

  const loja = await findBarbershopById(db, sessao.barbershopId);
  const timeZone = loja?.timeZone ?? 'America/Sao_Paulo';

  const dia = data && DateTime.fromISO(data, { zone: timeZone }).isValid
    ? DateTime.fromISO(data, { zone: timeZone })
    : DateTime.now().setZone(timeZone).startOf('day');

  const inicio = dia.startOf('day').toJSDate();
  const fim = dia.plus({ days: 1 }).startOf('day').toJSDate();

  const [staffList, servicos, appointments] = await Promise.all([
    listActiveStaff(db, sessao.barbershopId),
    listActiveServices(db, sessao.barbershopId),
    listAppointmentsBetween(db, sessao.barbershopId, inicio, fim),
  ]);

  const dataISO = dia.toISODate()!;
  const ontem = dia.minus({ days: 1 }).toISODate();
  const amanha = dia.plus({ days: 1 }).toISODate();

  return (
    <div>
      <h1>Agenda — {dia.setLocale('pt-BR').toFormat("cccc, d 'de' LLLL")}</h1>
      <nav style={{ display: 'flex', gap: '0.5rem' }}>
        <a href={`/app/agenda?data=${ontem}`}>Ontem</a>
        <a href={`/app/agenda?data=${DateTime.now().setZone(timeZone).toISODate()}`}>Hoje</a>
        <a href={`/app/agenda?data=${amanha}`}>Amanhã</a>
        <form action="/app/agenda" method="get">
          <input type="date" name="data" defaultValue={dataISO} />
          <button type="submit">Ir</button>
        </form>
      </nav>

      <DayGrid
        appointments={appointments}
        staffList={staffList}
        timeZone={timeZone}
      />

      <h2>Encaixe manual</h2>
      {loja ? (
        <ManualBookingForm
          slug={loja.slug}
          services={servicos}
          staffList={staffList}
          defaultDate={dataISO}
          timeZone={timeZone}
        />
      ) : null}
    </div>
  );
}
