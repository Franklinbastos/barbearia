import { requireSession } from '@/lib/session';
import { db } from '@/db/client';
import { findBarbershopById } from '@/db/repositories';
import { PanelNav } from '@/components/panel-nav';

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const sessao = await requireSession();
  const loja = await findBarbershopById(db, sessao.barbershopId);

  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <PanelNav shopName={loja?.name ?? 'Barbearia'} />
      <main style={{ flex: 1, padding: '1.5rem' }}>{children}</main>
    </div>
  );
}
