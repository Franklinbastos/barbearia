import Link from 'next/link';
import { requireSession } from '@/lib/session';
import { db } from '@/db/client';
import { listAllStaff } from '@/db/repositories';
import { StaffForm } from './staff-form';
import { ToggleStaffButton } from './toggle-staff-button';
import type { CodigoErroEquipe } from './actions';

/**
 * A querystring é editável por qualquer um, então a página só reconhece códigos
 * conhecidos. Código desconhecido não vira aviso nenhum.
 */
const MENSAGENS_DE_ERRO: Record<CodigoErroEquipe, string> = {
  SEM_PERMISSAO: 'Só o dono pode mexer na equipe.',
  MEMBRO_INEXISTENTE: 'Esse membro da equipe não existe nesta barbearia.',
  ULTIMO_DONO: 'A barbearia precisa de pelo menos um dono ativo.',
  NAO_PODE_DESATIVAR_A_SI: 'Você não pode desativar o próprio acesso. Peça isso a outro dono.',
};

export default async function EquipePage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro: codigoErro } = await searchParams;
  const erro =
    codigoErro && codigoErro in MENSAGENS_DE_ERRO
      ? MENSAGENS_DE_ERRO[codigoErro as CodigoErroEquipe]
      : null;
  const sessao = await requireSession();
  const equipe = await listAllStaff(db, sessao.barbershopId);
  const ehDono = sessao.role === 'OWNER';

  return (
    <div>
      <h1>Equipe</h1>

      {erro ? (
        <p role="alert" style={{ color: '#b00020', margin: '0.75rem 0' }}>
          {erro}
        </p>
      ) : null}

      {ehDono ? (
        <StaffForm />
      ) : (
        <p>Só o dono da barbearia cadastra e desativa membros da equipe.</p>
      )}

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
                {/* Desativar a si mesmo é o clique que trancava o dono fora do
                    painel — o servidor recusa, e aqui o botão nem aparece. */}
                {membro.id === sessao.staffId ? (
                  <span>Você</span>
                ) : ehDono ? (
                  <ToggleStaffButton id={membro.id} active={membro.active} />
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
