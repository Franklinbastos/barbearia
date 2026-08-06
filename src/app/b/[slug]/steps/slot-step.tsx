'use client';

import { useEffect, useState } from 'react';
import { formatDayLabel, formatTime } from '@/lib/format';
import type { AvailabilitySlot } from '../types';

function isoDateInZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(date);
}

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

  async function carregar() {
    setSlots(null);
    setErro(null);
    try {
      const params = new URLSearchParams({ serviceId, date: dia });
      if (staffId) params.set('staffId', staffId);
      const res = await fetch(`/api/public/${slug}/availability?${params}`);
      if (!res.ok) throw new Error('Não foi possível carregar os horários');
      const bodyJson = await res.json();
      setSlots(bodyJson.slots);
    } catch {
      setErro('Não foi possível carregar os horários.');
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dia, serviceId, staffId]);

  return (
    <div>
      <h2>Escolha o horário</h2>
      <button type="button" onClick={onVoltar}>Voltar</button>
      <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto' }}>
        {dias.map((d) => (
          <button
            key={d}
            type="button"
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
          <button type="button" onClick={carregar}>Tentar de novo</button>
        </div>
      ) : null}
      {slots && slots.length === 0 ? <p>Nenhum horário livre neste dia.</p> : null}
      {slots && slots.length > 0 ? (
        <ul style={{ listStyle: 'none', padding: 0, display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {slots.map((s) => (
            <li key={`${s.staffId}-${s.startAt}`}>
              <button type="button" onClick={() => onSelect(s)}>
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
