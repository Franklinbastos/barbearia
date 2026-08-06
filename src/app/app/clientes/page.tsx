import Link from 'next/link';
import { requireSession } from '@/lib/session';
import { db } from '@/db/client';
import { listCustomers } from '@/db/repositories';

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ busca?: string }>;
}) {
  const { busca } = await searchParams;
  const sessao = await requireSession();
  const clientes = await listCustomers(db, sessao.barbershopId, busca);

  return (
    <div>
      <h1>Clientes</h1>
      <form action="/app/clientes" method="get">
        <input type="search" name="busca" defaultValue={busca ?? ''} placeholder="Nome ou telefone" />
        <button type="submit">Buscar</button>
      </form>

      <table style={{ marginTop: '1rem', width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Nome</th>
            <th style={{ textAlign: 'left' }}>Telefone</th>
          </tr>
        </thead>
        <tbody>
          {clientes.map((c) => (
            <tr key={c.id}>
              <td>
                <Link href={`/app/clientes/${c.id}`}>{c.name}</Link>
              </td>
              <td>{c.phone}</td>
            </tr>
          ))}
          {clientes.length === 0 ? (
            <tr>
              <td colSpan={2}>Nenhum cliente encontrado.</td>
            </tr>
          ) : null}
        </tbody>
      </table>
      {clientes.length === 200 ? <p>Mostrando os 200 primeiros — refine a busca.</p> : null}
    </div>
  );
}
