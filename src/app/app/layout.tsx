import { requireSession } from '@/lib/session';
import { db } from '@/db/client';
import { findBarbershopById, findStaffById } from '@/db/repositories';
import { PanelNav } from '@/components/panel-nav';

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const sessao = await requireSession();
  const [loja, eu] = await Promise.all([
    findBarbershopById(db, sessao.barbershopId),
    findStaffById(db, sessao.barbershopId, sessao.staffId),
  ]);

  return (
    <div className="flex min-h-full flex-col">
      <PanelNav nomeDaLoja={loja?.name ?? 'Barbearia'} nomeDoUsuario={eu?.name} />
      {/* 12px, não 24: em 360px são 336px úteis, e é o que faz a agenda caber
          sem rolagem lateral. O respiro de desktop entra a partir de 768px. */}
      <main className="mx-auto w-full max-w-[1400px] flex-1 p-3 md:p-5">{children}</main>
    </div>
  );
}
