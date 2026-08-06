'use client';

import { useActionState } from 'react';
import { saveStaffServicesAction, type FormState } from './actions';

const ESTADO_INICIAL: FormState = {};

type Servico = { id: string; name: string; durationMinutes: number };

export function ServicesForm({
  staffId,
  servicos,
  selecionados,
}: {
  staffId: string;
  servicos: Servico[];
  selecionados: Map<string, number | null>;
}) {
  const action = saveStaffServicesAction.bind(null, staffId);
  const [state, formAction, pending] = useActionState(action, ESTADO_INICIAL);

  return (
    <form action={formAction}>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {servicos.map((s) => {
          const marcado = selecionados.has(s.id);
          const override = selecionados.get(s.id);
          return (
            <li key={s.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <label>
                <input type="checkbox" name="serviceIds" value={s.id} defaultChecked={marcado} />
                {s.name} (padrão {s.durationMinutes} min)
              </label>
              <label>
                Duração própria (min)
                <input
                  type="number"
                  name={`duration_${s.id}`}
                  min={1}
                  defaultValue={override ?? ''}
                  placeholder="usa o padrão"
                />
              </label>
            </li>
          );
        })}
      </ul>
      {state.erro ? <p role="alert" style={{ color: 'crimson' }}>{state.erro}</p> : null}
      <button type="submit" disabled={pending}>
        {pending ? 'Salvando…' : 'Salvar serviços'}
      </button>
    </form>
  );
}
