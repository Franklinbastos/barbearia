'use client';

import { useActionState, useEffect, useState } from 'react';
import { createManualAppointmentAction, type ManualBookingState } from './actions';

const ESTADO_INICIAL: ManualBookingState = {};

type Servico = { id: string; name: string };
type Barbeiro = { id: string; name: string };
type Slot = { startAt: string; staffId: string; staffName: string };

export function ManualBookingForm({
  slug,
  services,
  staffList,
  defaultDate,
  timeZone,
}: {
  slug: string;
  services: Servico[];
  staffList: Barbeiro[];
  defaultDate: string;
  timeZone: string;
}) {
  const [state, formAction, pending] = useActionState(createManualAppointmentAction, ESTADO_INICIAL);
  const [serviceId, setServiceId] = useState('');
  const [staffId, setStaffId] = useState('');
  const [date, setDate] = useState(defaultDate);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [startAt, setStartAt] = useState('');

  useEffect(() => {
    if (!serviceId || !staffId || !date) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSlots([]);
      return;
    }
    const params = new URLSearchParams({ serviceId, staffId, date });
    fetch(`/api/public/${slug}/availability?${params}`)
      .then((res) => res.json())
      .then((bodyJson) => setSlots(bodyJson.slots ?? []))
      .catch(() => setSlots([]));
  }, [slug, serviceId, staffId, date]);

  return (
    <form action={formAction} style={{ display: 'flex', gap: '0.5rem', alignItems: 'end', flexWrap: 'wrap' }}>
      <label>
        Serviço
        <select name="serviceId" value={serviceId} onChange={(e) => setServiceId(e.target.value)} required>
          <option value="">Selecione</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </label>
      <label>
        Barbeiro
        <select name="staffId" value={staffId} onChange={(e) => setStaffId(e.target.value)} required>
          <option value="">Selecione</option>
          {staffList.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </label>
      <label>
        Data
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      </label>
      <label>
        Horário
        <select name="startAt" value={startAt} onChange={(e) => setStartAt(e.target.value)} required>
          <option value="">Selecione</option>
          {slots.map((s) => (
            <option key={s.startAt} value={s.startAt}>
              {new Date(s.startAt).toLocaleTimeString('pt-BR', { timeZone, hour: '2-digit', minute: '2-digit' })}
            </option>
          ))}
        </select>
      </label>
      <label>
        Nome
        <input name="name" required minLength={2} />
      </label>
      <label>
        Telefone
        <input name="phone" required placeholder="(00) 00000-0000" />
      </label>
      {state.erro ? <p role="alert" style={{ color: 'crimson' }}>{state.erro}</p> : null}
      <button type="submit" disabled={pending}>
        {pending ? 'Agendando…' : 'Agendar'}
      </button>
    </form>
  );
}
