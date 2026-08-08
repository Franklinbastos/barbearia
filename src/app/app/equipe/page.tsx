import Link from 'next/link';
import { requireSession } from '@/lib/session';
import { db } from '@/db/client';
import { listAllStaff } from '@/db/repositories';
import { ErroDeAcao } from '@/components/erro-de-acao';
import { Bloco } from '@/components/ui/bloco';
import { CabecalhoDePagina } from '@/components/ui/cabecalho-de-pagina';
import { Monograma } from '@/components/ui/monograma';
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
    <div className="flex flex-col gap-4">
      <CabecalhoDePagina titulo="Equipe" descricao="Quem atende, o expediente de cada um e quem está de fora." />

      <ErroDeAcao mensagem={erro} />

      {ehDono ? (
        <StaffForm />
      ) : (
        <Bloco>Só o dono da barbearia cadastra e desativa membros da equipe.</Bloco>
      )}

      <div className="max-w-[720px]">
        <ul className="lista">
          {equipe.map((membro) => (
            <li key={membro.id} className={membro.active ? undefined : 'bg-superficie'}>
              <div className="grid min-h-[72px] grid-cols-[1fr_auto] items-center gap-3 p-3">
                {/* A linha inteira leva ao detalhe: "Configurar" era um link de
                    texto de 20px de altura no meio de uma tabela. */}
                <Link
                  href={`/app/equipe/${membro.id}`}
                  className="flex min-w-0 items-center gap-3 no-underline"
                >
                  <Monograma nome={membro.name} />
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-[17px] leading-[22px] font-bold ${
                          membro.active ? '' : 'text-tinta-3'
                        }`}
                      >
                        {membro.name}
                      </span>
                      {membro.active ? null : (
                        <span className="border border-linha bg-superficie-2 px-1.5 text-[11px] leading-[14px] font-bold text-tinta-2">
                          INATIVO
                        </span>
                      )}
                    </span>
                    <span className="text-sm leading-5 text-tinta-2">
                      {membro.role === 'OWNER' ? 'Dono' : 'Barbeiro'}
                    </span>
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

                <div>
                  {/* Desativar a si mesmo é o clique que trancava o dono fora do
                      painel — o servidor recusa, e aqui o botão nem aparece. */}
                  {membro.id === sessao.staffId ? (
                    <span className="text-sm leading-5 font-bold text-tinta-3">Você</span>
                  ) : ehDono ? (
                    <ToggleStaffButton id={membro.id} active={membro.active} />
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
