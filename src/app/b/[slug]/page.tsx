import { notFound } from 'next/navigation';
import { db } from '@/db/client';
import { findBarbershopBySlug, listActiveServices } from '@/db/repositories';
import { BookingWizard } from './booking-wizard';

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const loja = await findBarbershopBySlug(db, slug);
  if (!loja) notFound();

  const servicos = await listActiveServices(db, loja.id);

  if (servicos.length === 0) {
    return (
      <main>
        <h1>{loja.name}</h1>
        <p>A agenda desta barbearia ainda não está disponível. Volte em breve.</p>
      </main>
    );
  }

  return (
    <main>
      <h1>{loja.name}</h1>
      <BookingWizard slug={slug} timeZone={loja.timeZone} maxAdvanceDays={loja.maxAdvanceDays} />
    </main>
  );
}
