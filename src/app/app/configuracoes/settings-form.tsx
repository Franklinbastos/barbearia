'use client';

import { useActionState } from 'react';
import { saveSettingsAction, type SettingsState } from './actions';
import { GRADES_PERMITIDAS } from '@/domain/catalog/shop-settings';

const ESTADO_INICIAL: SettingsState = {};

const FUSOS_BRASIL = [
  'America/Noronha',
  'America/Sao_Paulo',
  'America/Manaus',
  'America/Cuiaba',
  'America/Boa_Vista',
  'America/Porto_Velho',
  'America/Rio_Branco',
];

type Loja = {
  name: string;
  slotMinutes: number;
  minLeadMinutes: number;
  maxAdvanceDays: number;
  timeZone: string;
};

export function SettingsForm({ loja }: { loja: Loja }) {
  const [state, formAction, pending] = useActionState(saveSettingsAction, ESTADO_INICIAL);

  return (
    <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: 420 }}>
      <label>
        Nome da barbearia
        <input name="name" defaultValue={loja.name} required minLength={2} />
      </label>
      <label>
        Fuso horário
        <select name="timeZone" defaultValue={loja.timeZone} required>
          {FUSOS_BRASIL.map((tz) => (
            <option key={tz} value={tz}>{tz}</option>
          ))}
        </select>
      </label>
      <label>
        Grade de horários (minutos)
        <select name="slotMinutes" defaultValue={loja.slotMinutes} required>
          {GRADES_PERMITIDAS.map((g) => (
            <option key={g} value={g}>{g} min</option>
          ))}
        </select>
      </label>
      <label>
        Antecedência mínima (minutos)
        <input name="minLeadMinutes" type="number" min={0} defaultValue={loja.minLeadMinutes} required />
      </label>
      <label>
        Janela máxima de agendamento (dias)
        <input name="maxAdvanceDays" type="number" min={1} max={365} defaultValue={loja.maxAdvanceDays} required />
      </label>
      {state.erro ? <p role="alert" style={{ color: 'crimson' }}>{state.erro}</p> : null}
      <button type="submit" disabled={pending}>
        {pending ? 'Salvando…' : 'Salvar configurações'}
      </button>
    </form>
  );
}
