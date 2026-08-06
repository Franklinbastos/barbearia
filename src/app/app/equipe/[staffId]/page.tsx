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
import { ServicesForm } from './services-form';
import { WorkingHoursForm } from './working-hours-form';
import { TimeOffSection } from './time-off-section';

const DIAS_SEMANA = [1, 2, 3, 4, 5, 6, 7];

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
    <div>
      <h1>{barbeiro.name}</h1>

      <h2>Serviços</h2>
      <ServicesForm staffId={staffId} servicos={servicos} selecionados={selecionados} />

      <h2>Expediente</h2>
      {DIAS_SEMANA.map((weekday) => (
        <WorkingHoursForm
          key={weekday}
          staffId={staffId}
          weekday={weekday}
          blocos={expediente.filter((b) => b.weekday === weekday)}
        />
      ))}

      <h2>Bloqueios</h2>
      <TimeOffSection staffId={staffId} bloqueios={bloqueios} timeZone={loja?.timeZone ?? 'America/Sao_Paulo'} />
    </div>
  );
}
