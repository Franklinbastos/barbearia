'use client';

import { useState, useTransition } from 'react';
import { executarAcao } from '@/components/action-error';
import { ErroDeAcao } from '@/components/erro-de-acao';
import { formatAppointmentStatus, formatTime, type AppointmentStatus } from '@/lib/format';
import { setAppointmentStatusAction } from './actions';

export type AgendaAppointment = {
  id: string;
  staffId: string;
  startAt: Date;
  endAt: Date;
  status: AppointmentStatus;
  origin: 'PUBLIC' | 'PANEL' | 'BOT';
  serviceName: string;
  servicePriceCents: number;
  customerName: string;
  customerPhone: string;
};

export type AgendaStaff = { id: string; name: string };

export type AgendaItem = AgendaAppointment & { staffName: string };

/** Barbeiro que saiu da equipe ainda tem atendimento marcado no dia — some da lista de ativos, não da agenda. */
const BARBEIRO_DESCONHECIDO = 'Barbeiro removido';

/**
 * Agenda do dia como **uma lista só**, em ordem de horário.
 *
 * Coluna por barbeiro obriga a rolar o dia inteiro de cada um para descobrir
 * quem está livre às 10h — e no celular vira uma coluna empilhada embaixo da
 * outra. Ordenado por horário, o nome do barbeiro precisa ir em cada cartão,
 * que é o que este retorno já entrega pronto.
 */
export function buildDayList(
  appointments: AgendaAppointment[],
  staffList: AgendaStaff[],
): AgendaItem[] {
  const nomePorId = new Map(staffList.map((b) => [b.id, b.name]));

  return appointments
    .map((a) => ({ ...a, staffName: nomePorId.get(a.staffId) ?? BARBEIRO_DESCONHECIDO }))
    .sort(
      (a, b) =>
        a.startAt.getTime() - b.startAt.getTime() ||
        a.staffName.localeCompare(b.staffName, 'pt-BR') ||
        a.id.localeCompare(b.id),
    );
}

function formatarPreco(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function AppointmentCard({ item, timeZone }: { item: AgendaItem; timeZone: string }) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function marcar(status: 'DONE' | 'NO_SHOW' | 'CANCELED') {
    setErro(null);
    startTransition(() => executarAcao(() => setAppointmentStatusAction(item.id, status), setErro));
  }

  const cancelado = item.status === 'CANCELED';

  return (
    <li style={{ border: '1px solid #333', padding: '0.5rem', opacity: cancelado ? 0.5 : 1 }}>
      <div>
        <strong>
          {formatTime(item.startAt, timeZone)}–{formatTime(item.endAt, timeZone)}
        </strong>{' '}
        · {item.staffName}
      </div>
      <div>
        {item.serviceName} · {formatarPreco(item.servicePriceCents)}
      </div>
      <div>
        {item.customerName} — {item.customerPhone}
      </div>
      <div>{formatAppointmentStatus(item.status)}</div>
      {item.status === 'BOOKED' ? (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" disabled={pending} onClick={() => marcar('DONE')}>
            Compareceu
          </button>
          <button type="button" disabled={pending} onClick={() => marcar('NO_SHOW')}>
            Não veio
          </button>
          <button type="button" disabled={pending} onClick={() => marcar('CANCELED')}>
            Cancelar
          </button>
        </div>
      ) : null}
      <ErroDeAcao mensagem={erro} />
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
  const itens = buildDayList(appointments, staffList);

  if (itens.length === 0) {
    return <p>Nenhum agendamento neste dia.</p>;
  }

  return (
    <ul
      style={{
        listStyle: 'none',
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
      }}
    >
      {itens.map((item) => (
        <AppointmentCard key={item.id} item={item} timeZone={timeZone} />
      ))}
    </ul>
  );
}
