import Link from 'next/link';
import { requireSession } from '@/lib/session';
import { db } from '@/db/client';
import { listAllStaff } from '@/db/repositories';
import { StaffForm } from './staff-form';
import { ToggleStaffButton } from './toggle-staff-button';

export default async function EquipePage() {
  const sessao = await requireSession();
  const equipe = await listAllStaff(db, sessao.barbershopId);

  return (
    <div>
      <h1>Equipe</h1>
      <StaffForm />
      <table style={{ marginTop: '1.5rem', width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Nome</th>
            <th style={{ textAlign: 'left' }}>Papel</th>
            <th style={{ textAlign: 'left' }}>Status</th>
            <th />
            <th />
          </tr>
        </thead>
        <tbody>
          {equipe.map((membro) => (
            <tr key={membro.id}>
              <td>{membro.name}</td>
              <td>{membro.role === 'OWNER' ? 'Dono' : 'Barbeiro'}</td>
              <td>{membro.active ? 'Ativo' : 'Inativo'}</td>
              <td>
                <Link href={`/app/equipe/${membro.id}`}>Configurar</Link>
              </td>
              <td>
                <ToggleStaffButton id={membro.id} active={membro.active} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
