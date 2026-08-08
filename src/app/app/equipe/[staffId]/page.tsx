import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/session';
import { db } from '@/db/client';
import {
  findStaffById,
  findBarbershopById,
  listActiveServices,
  listStaffServiceLinks,
  listWorkingHoursForStaff,
  listTimeOffForStaff,
} from '@/db/repositories';
import { CabecalhoDePagina } from '@/components/ui/cabecalho-de-pagina';
import { ServicesForm } from './services-form';
import { WorkingHoursForm } from './working-hours-form';
import { TimeOffSection } from './time-off-section';

const DIAS_SEMANA = [1, 2, 3, 4, 5, 6, 7];

const TITULO_DE_SECAO = 'text-lg leading-6 font-bold';

export default async function StaffDetailPage({
  params,
}: {
  params: Promise<{ staffId: string }>;
}) {
  const { staffId } = await params;
  const sessao = await requireSession();

  const barbeiro = await findStaffById(db, sessao.barbershopId, staffId);
  if (!barbeiro) notFound();

  const loja = await findBarbershopById(db, sessao.barbershopId);
  const servicos = await listActiveServices(db, sessao.barbershopId);
  const vinculos = await listStaffServiceLinks(db, sessao.barbershopId, staffId);
  const selecionados = new Map(vinculos.map((v) => [v.serviceId, v.durationMinutesOverride]));
  const expediente = await listWorkingHoursForStaff(db, sessao.barbershopId, staffId);
  const bloqueios = await listTimeOffForStaff(db, sessao.barbershopId, staffId, new Date());

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link href="/app/equipe" className="text-sm leading-5">
          ← Equipe
        </Link>
        <CabecalhoDePagina
          titulo={barbeiro.name}
          descricao={barbeiro.role === 'OWNER' ? 'Dono' : 'Barbeiro'}
        />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className={TITULO_DE_SECAO}>Serviços</h2>
        <ServicesForm staffId={staffId} servicos={servicos} selecionados={selecionados} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className={TITULO_DE_SECAO}>Expediente</h2>
        {/* Sete formulários irmãos, um por dia: cada um salva sozinho e diz qual
            dia salvou. Em ≥768px cabem dois por linha sem apertar as horas. */}
        <div className="grid max-w-[720px] gap-3 md:grid-cols-2">
          {DIAS_SEMANA.map((weekday) => (
            <WorkingHoursForm
              key={weekday}
              staffId={staffId}
              weekday={weekday}
              blocos={expediente.filter((b) => b.weekday === weekday)}
            />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className={TITULO_DE_SECAO}>Bloqueios</h2>
        <TimeOffSection
          staffId={staffId}
          bloqueios={bloqueios}
          timeZone={loja?.timeZone ?? 'America/Sao_Paulo'}
        />
      </section>
    </div>
  );
}
