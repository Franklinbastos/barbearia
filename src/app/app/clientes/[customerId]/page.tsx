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
import { Badge } from '@/components/ui/badge';
import { Bloco } from '@/components/ui/bloco';
import { CabecalhoDePagina } from '@/components/ui/cabecalho-de-pagina';
import { Card } from '@/components/ui/card';
import { VARIANTE_DO_ESTADO } from '../../tom-do-estado';
import { NotesForm } from './notes-form';
import { AnonymizeButton } from './anonymize-button';

const TITULO_DE_SECAO = 'text-lg leading-6 font-bold';

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
                      {/* O `TOM_DO_ESTADO` de quatro tons desenhados à mão saiu:
                          a variante agora vem de `tom-do-estado.ts`, que o
                          cartão da agenda também lê — as duas telas discordavam
                          sobre o "Não veio". */}
                      <Badge variant={VARIANTE_DO_ESTADO[estado]}>
                        {formatAppointmentStatus(estado)}
                      </Badge>
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
