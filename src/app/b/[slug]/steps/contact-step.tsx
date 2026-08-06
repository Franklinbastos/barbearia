'use client';

import { useState } from 'react';
import type { Resultado } from '../types';

function aplicarMascaraTelefone(valor: string): string {
  const digitos = valor.replace(/\D/g, '').slice(0, 11);
  if (digitos.length <= 2) return digitos;
  if (digitos.length <= 7) return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`;
  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
}

export function ContactStep({
  slug,
  serviceId,
  staffId,
  startAt,
  onDone,
  onSlotTaken,
  onVoltar,
}: {
  slug: string;
  serviceId: string;
  staffId?: string;
  startAt: string;
  onDone: (resultado: Resultado) => void;
  onSlotTaken: (message: string) => void;
  onVoltar: () => void;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);

    try {
      const res = await fetch(`/api/public/${slug}/appointments`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ serviceId, staffId, startAt, name, phone }),
      });

      if (res.status === 409) {
        const { message } = await res.json();
        onSlotTaken(message);
        return;
      }

      if (!res.ok) {
        const { message } = await res.json();
        setErro(message ?? 'Não foi possível confirmar o agendamento');
        return;
      }

      const resultado: Resultado = await res.json();
      onDone(resultado);
    } catch {
      setErro('Não foi possível confirmar. Verifique sua conexão e tente de novo.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div>
      <h2>Seus dados</h2>
      <button type="button" onClick={onVoltar}>Voltar</button>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <label>
          Nome
          <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
        </label>
        <label>
          Telefone
          <input
            value={phone}
            onChange={(e) => setPhone(aplicarMascaraTelefone(e.target.value))}
            placeholder="(00) 00000-0000"
            required
          />
        </label>
        {erro ? <p role="alert" style={{ color: 'crimson' }}>{erro}</p> : null}
        <button type="submit" disabled={enviando}>
          {enviando ? 'Confirmando…' : 'Confirmar horário'}
        </button>
      </form>
    </div>
  );
}
