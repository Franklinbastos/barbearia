import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/session';
import { db } from '@/db/client';
import { findBarbershopById, findCustomerById, listCustomerHistory } from '@/db/repositories';
import {
  formatDateTime,
  formatAppointmentStatus,
  formatPrice,
  type AppointmentStatus,
} from '@/lib/format';
import { Bloco } from '@/components/ui/bloco';
import { CabecalhoDePagina } from '@/components/ui/cabecalho-de-pagina';
import { Card } from '@/components/ui/card';
import { NotesForm } from './notes-form';
import { AnonymizeButton } from './anonymize-button';

const TITULO_DE_SECAO = 'text-lg leading-6 font-bold';

/** Estado do atendimento como tom de etiqueta — cor nunca é o único portador. */
const TOM_DO_ESTADO: Record<AppointmentStatus, string> = {
  BOOKED: 'border-linha bg-superficie-2 text-tinta-2',
  DONE: 'border-ok bg-ok-bg text-tinta',
  CANCELED: 'border-perigo bg-perigo-bg text-tinta',
  NO_SHOW: 'border-alerta bg-alerta-bg text-tinta',
};

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
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link href="/app/clientes" className="text-sm leading-5">
          ← Clientes
        </Link>
        <CabecalhoDePagina titulo={cliente.name} descricao={cliente.phone} />
      </div>

      <section className="flex max-w-[720px] flex-col gap-3">
        <h2 className={TITULO_DE_SECAO}>Histórico</h2>
        {historico.length === 0 ? (
          <Bloco>Nenhum atendimento ainda.</Bloco>
        ) : (
          // O histórico é caixa de conteúdo, então vira card; o "Nenhum
          // atendimento ainda" acima continua sendo `Bloco`, que é mensagem.
          <Card className="gap-0 py-0">
            <ul className="lista border-t-0 [&>li:last-child]:border-b-0">
              {historico.map((h) => {
                const estado = h.status as AppointmentStatus;
                return (
                  <li key={h.id}>
                    <div className="grid min-h-[72px] grid-cols-[1fr_auto] items-center gap-3 p-3">
                      <div className="flex min-w-0 flex-col gap-1">
                        <span className="text-[17px] leading-[22px] font-bold">
                          {formatDateTime(h.startAt, timeZone)}
                        </span>
                        <span className="text-sm leading-5 text-tinta-2">
                          {h.serviceName} · {formatPrice(h.priceCents)}
                        </span>
                      </div>
                      <span
                        className={`border px-1.5 py-0.5 text-[11px] leading-[14px] font-bold ${TOM_DO_ESTADO[estado]}`}
                      >
                        {formatAppointmentStatus(estado)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className={TITULO_DE_SECAO}>Notas</h2>
        <NotesForm customerId={customerId} notes={cliente.notes} />
      </section>

      {sessao.role === 'OWNER' ? (
        <section className="flex max-w-[520px] flex-col gap-3">
          <h2 className={TITULO_DE_SECAO}>Privacidade</h2>
          <AnonymizeButton customerId={customerId} />
        </section>
      ) : null}
    </div>
  );
}
