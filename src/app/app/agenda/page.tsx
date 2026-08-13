import { DateTime } from 'luxon';
import { requireSession } from '@/lib/session';
import { db } from '@/db/client';
import { findBarbershopById, listActiveStaff, listActiveServices, listAppointmentsBetween } from '@/db/repositories';
import { formatDayLabelLong } from '@/lib/format';
import { BarraDeData } from './barra-de-data';
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

  const agora = DateTime.now().setZone(timeZone);
  const dia = data && DateTime.fromISO(data, { zone: timeZone }).isValid
    ? DateTime.fromISO(data, { zone: timeZone })
    : agora.startOf('day');

  const inicio = dia.startOf('day').toJSDate();
  const fim = dia.plus({ days: 1 }).startOf('day').toJSDate();

  const [staffList, servicos, appointments] = await Promise.all([
    listActiveStaff(db, sessao.barbershopId),
    listActiveServices(db, sessao.barbershopId),
    listAppointmentsBetween(db, sessao.barbershopId, inicio, fim),
  ]);

  const dataISO = dia.toISODate()!;
  const hojeISO = agora.toISODate()!;

  // "8 no dia" não conta cancelado: o horário voltou para a grade e não é mais
  // trabalho do dia. "A atender" é só o que ainda está agendado.
  const contagens = {
    total: appointments.filter((a) => a.status !== 'CANCELED').length,
    aAtender: appointments.filter((a) => a.status === 'BOOKED').length,
  };

  return (
    // pb-16 reserva o rodapé para a barra fixa do celular; no desktop ela não existe
    <div className="pb-16 md:pb-0">
      {/* O título não ocupa altura na primeira dobra — a barra de data já diz
          que dia é este, e 40px de cabeçalho custam meia linha da lista. Fica
          para o leitor de tela e para a estrutura do documento. */}
      <h1 className="sr-only">Agenda — {formatDayLabelLong(dataISO, timeZone)}</h1>

      <BarraDeData dataISO={dataISO} hojeISO={hojeISO} contagens={contagens} />

      {/* Vem antes da lista de propósito: no desktop o botão de "Encaixe" mora
          aqui, ao lado do topo, e é a primeira ação da tela. No celular o que
          aparece é a barra fixa do rodapé, que é `position: fixed` e não liga
          para a ordem no documento. */}
      {loja ? (
        <ManualBookingForm
          slug={loja.slug}
          services={servicos}
          staffList={staffList}
          defaultDate={dataISO}
          timeZone={timeZone}
        />
      ) : null}

      <DayGrid
        appointments={appointments}
        staffList={staffList}
        timeZone={timeZone}
        dataISO={dataISO}
        hojeISO={hojeISO}
        agoraISO={agora.toJSDate().toISOString()}
      />

    </div>
  );
}
