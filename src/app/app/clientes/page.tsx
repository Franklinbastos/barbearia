import Link from 'next/link';
import { requireSession } from '@/lib/session';
import { db } from '@/db/client';
import { listCustomers } from '@/db/repositories';
import { Bloco } from '@/components/ui/bloco';
import { Botao } from '@/components/ui/botao';
import { CabecalhoDePagina } from '@/components/ui/cabecalho-de-pagina';
import { Campo } from '@/components/ui/campo';
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
        <div className="max-w-[720px]">
          <ul className="lista">
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
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 8 12"
                    className="ml-auto h-3 w-2 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M1.5 1l5 5-5 5" />
                  </svg>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {clientes.length === 200 ? (
        <Bloco tom="alerta">Mostrando os 200 primeiros — refine a busca.</Bloco>
      ) : null}
    </div>
  );
}
