import { requireSession } from '@/lib/session';
import { db } from '@/db/client';
import { listAllServices } from '@/db/repositories';
import { ServicoForm } from './servico-form';
import { ToggleButton } from './toggle-button';

function formatarPreco(priceCents: number) {
  return (priceCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default async function ServicosPage() {
  const sessao = await requireSession();
  const servicos = await listAllServices(db, sessao.barbershopId);

  return (
    <div>
      <h1>Serviços</h1>
      <ServicoForm />
      <table style={{ marginTop: '1.5rem', width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Nome</th>
            <th style={{ textAlign: 'left' }}>Duração</th>
            <th style={{ textAlign: 'left' }}>Preço</th>
            <th style={{ textAlign: 'left' }}>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {servicos.map((s) => (
            <tr key={s.id}>
              <td>{s.name}</td>
              <td>{s.durationMinutes} min</td>
              <td>{formatarPreco(s.priceCents)}</td>
              <td>{s.active ? 'Ativo' : 'Inativo'}</td>
              <td>
                <ToggleButton id={s.id} active={s.active} />
              </td>
            </tr>
          ))}
          {servicos.length === 0 ? (
            <tr>
              <td colSpan={5}>Nenhum serviço cadastrado ainda.</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
