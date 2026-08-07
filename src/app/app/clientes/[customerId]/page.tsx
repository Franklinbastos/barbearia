import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/session';
import { db } from '@/db/client';
import { findBarbershopById, findCustomerById, listCustomerHistory } from '@/db/repositories';
import { formatDateTime, formatAppointmentStatus, type AppointmentStatus } from '@/lib/format';
import { NotesForm } from './notes-form';
import { AnonymizeButton } from './anonymize-button';

function formatarPreco(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await params;
  const sessao = await requireSession();

  const cliente = await findCustomerById(db, sessao.barbershopId, customerId);
  if (!cliente) notFound();

  const [loja, historico] = await Promise.all([
    findBarbershopById(db, sessao.barbershopId),
    listCustomerHistory(db, sessao.barbershopId, customerId),
  ]);
  const timeZone = loja?.timeZone ?? 'America/Sao_Paulo';

  return (
    <div>
      <h1>{cliente.name}</h1>
      <p>{cliente.phone}</p>

      <h2>Histórico</h2>
      <ul>
        {historico.map((h) => (
          <li key={h.id}>
            {formatDateTime(h.startAt, timeZone)} — {h.serviceName} — {formatarPreco(h.priceCents)} —{' '}
            {formatAppointmentStatus(h.status as AppointmentStatus)}
          </li>
        ))}
        {historico.length === 0 ? <li>Nenhum atendimento ainda.</li> : null}
      </ul>

      <h2>Notas</h2>
      <NotesForm customerId={customerId} notes={cliente.notes} />

      {sessao.role === 'OWNER' ? (
        <>
          <h2>Privacidade</h2>
          <AnonymizeButton customerId={customerId} />
        </>
      ) : null}
    </div>
  );
}
