import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { requireSession } from '@/lib/session';
import { db } from '@/db/client';
import { listCustomers } from '@/db/repositories';
import { Bloco } from '@/components/ui/bloco';
import { Botao } from '@/components/ui/botao';
import { CabecalhoDePagina } from '@/components/ui/cabecalho-de-pagina';
import { Campo } from '@/components/ui/campo';
import { Card } from '@/components/ui/card';
import { Monograma } from '@/components/ui/monograma';

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ busca?: string }>;
}) {
  const { busca } = await searchParams;
  const sessao = await requireSession();
  const clientes = await listCustomers(db, sessao.barbershopId, busca);

  return (
    <div className="flex flex-col gap-4">
      <CabecalhoDePagina titulo="Clientes" descricao="Quem já passou pela cadeira, com o telefone à mão." />

      {/* Formulário GET de verdade: a busca continua no endereço, então o
          resultado é compartilhável e o botão de voltar funciona. */}
      <form action="/app/clientes" method="get" className="flex max-w-[520px] items-end gap-2">
        {/* min-w-0: sem isto o flex-1 não encolhe abaixo da largura intrínseca
            do <input> e a página inteira rola de lado em 360px. */}
        <div className="min-w-0 flex-1">
          <Campo rotulo="Nome ou telefone">
            <input type="search" name="busca" inputMode="search" defaultValue={busca ?? ''} />
          </Campo>
        </div>
        <Botao type="submit" variante="secundario">
          Buscar
        </Botao>
      </form>

      {clientes.length === 0 ? (
        <Bloco>Nenhum cliente encontrado.</Bloco>
      ) : (
        // `gap-0 py-0` e lista de ponta a ponta: o recheio do card duplicaria o
        // da linha e afastaria as divisórias das bordas.
        <Card className="max-w-[720px] gap-0 py-0">
          <ul className="lista border-t-0 [&>li:last-child]:border-b-0">
            {clientes.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/app/clientes/${c.id}`}
                  className="flex min-h-[72px] items-center gap-3 p-3 no-underline"
                >
                  <Monograma nome={c.name} />
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="text-[17px] leading-[22px] font-bold">{c.name}</span>
                    <span className="text-sm leading-5 text-tinta-2">{c.phone}</span>
                  </span>
                  {/* Mesma seta da lista de equipe: `size-5` repõe o desenho de
                      5×10 e o `-mr-1.5` desconta a folga da caixa do lucide. */}
                  <ChevronRight
                    aria-hidden="true"
                    strokeWidth={2.4}
                    className="ml-auto -mr-1.5 size-5 shrink-0"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {clientes.length === 200 ? (
        <Bloco tom="alerta">Mostrando os 200 primeiros — refine a busca.</Bloco>
      ) : null}
    </div>
  );
}
