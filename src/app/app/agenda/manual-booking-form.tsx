'use client';

import { useActionState, useEffect, useState } from 'react';
import { formatTime } from '@/lib/format';
import { carregarHorarios, type HorarioDisponivel } from '@/components/availability';
import { createManualAppointmentAction, type ManualBookingState } from './actions';
import { avisoDeHorarioLivre } from './encaixe';

const ESTADO_INICIAL: ManualBookingState = {};

type Servico = { id: string; name: string };
type Barbeiro = { id: string; name: string };

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
  const [slots, setSlots] = useState<HorarioDisponivel[]>([]);
  const [startAt, setStartAt] = useState('');
  // O balcão começa na grade normal; o encaixe é escolha consciente do atendente.
  const [horaLivreLigada, setHoraLivreLigada] = useState(false);
  const [horaLivre, setHoraLivre] = useState('');
  const [erroGrade, setErroGrade] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    if (!serviceId || !staffId || !date) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSlots([]);
      setErroGrade(null);
      return;
    }

    const controlador = new AbortController();
    setErroGrade(null);

    // Resposta de uma combinação que o atendente já trocou é descartada dentro
    // de `carregarHorarios`; erro do servidor vira mensagem, não lista vazia.
    void carregarHorarios(
      // origem PANEL: o balcão precisa enxergar horário fora da janela de
      // maxAdvanceDays, que só vale para o cliente marcando sozinho.
      { slug, serviceId, staffId, date, origem: 'PANEL' },
      controlador.signal,
      {
        aoReceber: setSlots,
        aoFalhar: (mensagem) => {
          setSlots([]);
          setErroGrade(mensagem);
        },
      },
    );

    return () => controlador.abort();
  }, [slug, serviceId, staffId, date, recarga]);

  // Depende do objeto de estado inteiro, não de `state.ok`: dois encaixes
  // seguidos devolvem `ok: true` das duas vezes e o segundo precisa limpar
  // igual ao primeiro.
  useEffect(() => {
    if (!state.ok) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStartAt('');
    setHoraLivre('');
    setName('');
    setPhone('');
    // O horário recém-ocupado não pode continuar na lista.
    setRecarga((n) => n + 1);
  }, [state]);

  const aviso = horaLivreLigada ? avisoDeHorarioLivre(horaLivre, slots, timeZone) : null;

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
      {/* O dia vai junto no envio: é ele que dá sentido à hora digitada. */}
      <label>
        Data
        <input
          type="date"
          name="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
      </label>
      <label>
        Horário
        <select
          name="startAt"
          value={startAt}
          onChange={(e) => setStartAt(e.target.value)}
          disabled={horaLivreLigada}
          required={!horaLivreLigada}
        >
          <option value="">Selecione</option>
          {slots.map((s) => (
            <option key={s.startAt} value={s.startAt}>
              {formatTime(s.startAt, timeZone)}
            </option>
          ))}
        </select>
      </label>
      <label>
        <input
          type="checkbox"
          checked={horaLivreLigada}
          onChange={(e) => setHoraLivreLigada(e.target.checked)}
        />
        Encaixe fora da grade
      </label>
      <label>
        Horário do encaixe
        <input
          type="time"
          name="horaLivre"
          disabled={!horaLivreLigada}
          required={horaLivreLigada}
          step={300}
          value={horaLivre}
          onChange={(e) => setHoraLivre(e.target.value)}
        />
      </label>
      <label>
        Nome
        <input name="name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
      </label>
      <label>
        Telefone
        <input
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
          placeholder="(00) 00000-0000"
        />
      </label>
      {aviso ? <p role="status" style={{ color: 'darkorange' }}>{aviso}</p> : null}
      {erroGrade ? <p role="alert" style={{ color: 'crimson' }}>{erroGrade}</p> : null}
      {state.erro ? <p role="alert" style={{ color: 'crimson' }}>{state.erro}</p> : null}
      {state.ok ? <p role="status">Encaixe agendado.</p> : null}
      <button type="submit" disabled={pending}>
        {pending ? 'Agendando…' : 'Agendar'}
      </button>
    </form>
  );
}
