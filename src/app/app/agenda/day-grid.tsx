'use client';

import { useTransition } from 'react';
import { setAppointmentStatusAction } from './actions';

export type AgendaAppointment = {
  id: string;
  staffId: string;
  startAt: Date;
  endAt: Date;
  status: 'BOOKED' | 'DONE' | 'CANCELED' | 'NO_SHOW';
  origin: 'PUBLIC' | 'PANEL' | 'BOT';
  serviceName: string;
  servicePriceCents: number;
  customerName: string;
  customerPhone: string;
};

export type AgendaStaff = { id: string; name: string };

export function buildDayColumns(appointments: AgendaAppointment[], staffList: AgendaStaff[]) {
  return staffList.map((barbeiro) => ({
    staff: barbeiro,
    items: appointments
      .filter((a) => a.staffId === barbeiro.id)
      .sort((a, b) => a.startAt.getTime() - b.startAt.getTime()),
  }));
}

function formatarHora(data: Date, timeZone: string) {
  return data.toLocaleTimeString('pt-BR', { timeZone, hour: '2-digit', minute: '2-digit' });
}

function formatarPreco(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function AppointmentCard({ item, timeZone }: { item: AgendaAppointment; timeZone: string }) {
  const [pending, startTransition] = useTransition();

  function marcar(status: 'DONE' | 'NO_SHOW' | 'CANCELED') {
    startTransition(() => setAppointmentStatusAction(item.id, status));
  }

  const cancelado = item.status === 'CANCELED';

  return (
    <li style={{ border: '1px solid #333', padding: '0.5rem', opacity: cancelado ? 0.5 : 1 }}>
      <div>
        {formatarHora(item.startAt, timeZone)}–{formatarHora(item.endAt, timeZone)} · {item.serviceName} · {formatarPreco(item.servicePriceCents)}
      </div>
      <div>{item.customerName} — {item.customerPhone}</div>
      <div>Status: {item.status}</div>
      {item.status === 'BOOKED' ? (
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="button" disabled={pending} onClick={() => marcar('DONE')}>Compareceu</button>
          <button type="button" disabled={pending} onClick={() => marcar('NO_SHOW')}>Não veio</button>
          <button type="button" disabled={pending} onClick={() => marcar('CANCELED')}>Cancelar</button>
        </div>
      ) : null}
    </li>
  );
}

export function DayGrid({
  appointments,
  staffList,
  timeZone,
}: {
  appointments: AgendaAppointment[];
  staffList: AgendaStaff[];
  timeZone: string;
}) {
  const colunas = buildDayColumns(appointments, staffList);

  return (
    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
      {colunas.map((coluna) => (
        <div key={coluna.staff.id} style={{ minWidth: '260px', flex: '1 1 260px' }}>
          <h3>{coluna.staff.name}</h3>
          <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {coluna.items.map((item) => (
              <AppointmentCard key={item.id} item={item} timeZone={timeZone} />
            ))}
            {coluna.items.length === 0 ? <li>Nenhum agendamento.</li> : null}
          </ul>
        </div>
      ))}
    </div>
  );
}
