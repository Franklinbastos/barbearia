'use client';

import { useEffect, useState } from 'react';
import { formatDayLabel, formatTime, isoDateInZone } from '@/lib/format';
import { carregarHorarios } from '@/components/availability';
import type { AvailabilitySlot } from '../types';

function diasCandidatos(timeZone: string, maxAdvanceDays: number): string[] {
  const hoje = new Date();
  return Array.from({ length: Math.max(maxAdvanceDays, 1) }, (_, i) =>
    isoDateInZone(new Date(hoje.getTime() + i * 86_400_000), timeZone),
  );
}

export function SlotStep({
  slug,
  serviceId,
  staffId,
  timeZone,
  maxAdvanceDays,
  onSelect,
  onVoltar,
}: {
  slug: string;
  serviceId: string;
  staffId?: string;
  timeZone: string;
  maxAdvanceDays: number;
  onSelect: (slot: AvailabilitySlot) => void;
  onVoltar: () => void;
}) {
  const dias = diasCandidatos(timeZone, maxAdvanceDays);
  const [dia, setDia] = useState(dias[0]);
  const [slots, setSlots] = useState<AvailabilitySlot[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    const controlador = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSlots(null);
    setErro(null);

    // A resposta de um dia que o usuário já abandonou é descartada dentro de
    // `carregarHorarios` — ver o AbortSignal.
    void carregarHorarios(
      { slug, serviceId, staffId, date: dia },
      controlador.signal,
      { aoReceber: setSlots, aoFalhar: setErro },
    );

    return () => controlador.abort();
  }, [slug, dia, serviceId, staffId, tentativa]);

  return (
    <div>
      <h2>Escolha o horário</h2>
      <button type="button" onClick={onVoltar}>Voltar</button>
      <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto' }}>
        {dias.map((d) => (
          <button
            key={d}
            type="button"
            aria-pressed={d === dia}
            onClick={() => setDia(d)}
            style={{ fontWeight: d === dia ? 'bold' : 'normal' }}
          >
            {formatDayLabel(d, timeZone)}
          </button>
        ))}
      </div>

      {slots === null && !erro ? <p>Carregando horários…</p> : null}
      {erro ? (
        <div>
          <p role="alert">{erro}</p>
          <button type="button" onClick={() => setTentativa((n) => n + 1)}>Tentar de novo</button>
        </div>
      ) : null}
      {slots && slots.length === 0 ? <p>Nenhum horário livre neste dia.</p> : null}
      {slots && slots.length > 0 ? (
        <ul style={{ listStyle: 'none', padding: 0, display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {slots.map((s) => (
            <li key={`${s.staffId}-${s.startAt}`}>
              <button type="button" data-testid="slot" onClick={() => onSelect(s)}>
                {formatTime(s.startAt, timeZone)}
                {!staffId ? ` — ${s.staffName}` : ''}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
