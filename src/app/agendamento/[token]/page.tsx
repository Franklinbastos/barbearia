import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { appointment, barbershop, staff } from '@/db/schema';
import { verifyManageToken } from '@/lib/tokens';
import { CancelForm } from './cancel-form';

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const verificado = verifyManageToken(token);
  if (!verificado) notFound();

  const [linha] = await db
    .select({
      id: appointment.id,
      startAt: appointment.startAt,
      status: appointment.status,
      serviceName: appointment.serviceNameSnapshot,
      staffName: staff.name,
      shopName: barbershop.name,
      shopSlug: barbershop.slug,
      timeZone: barbershop.timeZone,
    })
    .from(appointment)
    .innerJoin(staff, eq(staff.id, appointment.staffId))
    .innerJoin(barbershop, eq(barbershop.id, appointment.barbershopId))
    .where(eq(appointment.id, verificado.appointmentId))
    .limit(1);

  if (!linha) notFound();

  const quando = linha.startAt.toLocaleString('pt-BR', {
    timeZone: linha.timeZone,
    dateStyle: 'full',
    timeStyle: 'short',
  });

  return (
    <main>
      <h1>Seu horário na {linha.shopName}</h1>
      <p>{linha.serviceName} com {linha.staffName}</p>
      <p>{quando}</p>
      {linha.status === 'CANCELED' ? (
        <p>Este agendamento foi cancelado.</p>
      ) : (
        <>
          <CancelForm token={token} />
          <a href={`/b/${linha.shopSlug}`}>Marcar outro horário</a>
        </>
      )}
    </main>
  );
}
