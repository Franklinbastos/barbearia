import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { requireSession } from '@/lib/session';
import { db } from '@/db/client';
import { listAllStaff } from '@/db/repositories';
import { ErroDeAcao } from '@/components/erro-de-acao';
import { Badge } from '@/components/ui/badge';
import { Bloco } from '@/components/ui/bloco';
import { CabecalhoDePagina } from '@/components/ui/cabecalho-de-pagina';
import { Card } from '@/components/ui/card';
import { Largura } from '@/components/ui/largura';
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
    // Uma largura só para a tela (§3.7): cabeçalho, formulário e lista dividem o
    // teto de `tabela`. Antes o card do formulário tinha 520px e o da lista
    // 720px, um logo acima do outro, com o degrau à vista.
    <Largura tipo="tabela" className="flex flex-col gap-4">
      <CabecalhoDePagina titulo="Equipe" descricao="Quem atende, o expediente de cada um e quem está de fora." />

      <ErroDeAcao mensagem={erro} />

      {ehDono ? (
        <StaffForm />
      ) : (
        <Bloco>Só o dono da barbearia cadastra e desativa membros da equipe.</Bloco>
      )}

      {/* `gap-0 py-0`: o recheio do card cairia fora das divisórias, e a linha de
          72px já tem o seu. Do card fica a moldura — anel, raio e fundo. */}
      <Card className="gap-0 py-0">
        <ul className="lista border-t-0 [&>li:last-child]:border-b-0">
          {equipe.map((membro) => (
            // `--superficie-2` porque o fundo do card já é `--superficie`: sem
            // isso o membro inativo ficaria igual ao ativo.
            <li key={membro.id} className={membro.active ? undefined : 'bg-superficie-2'}>
              {/* Cada linha é uma grade própria, então uma coluna de ação `auto`
                  resolve larguras diferentes em cada uma — a linha do "Você" é
                  bem mais estreita que a do botão — e a seta do fim do nome
                  dança de posição a cada linha. O mínimo iguala todas. */}
              <div className="grid min-h-[72px] grid-cols-[1fr_minmax(104px,auto)] items-center gap-3 p-3">
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
                      {/* Mesma etiqueta e mesma variante da lista de serviços —
                          o "INATIVO" das duas telas é a mesma informação. */}
                      {membro.active ? null : <Badge variant="outline">INATIVO</Badge>}
                    </span>
                    <span className="text-sm leading-5 text-tinta-2">
                      {membro.role === 'OWNER' ? 'Dono' : 'Barbeiro'}
                    </span>
                  </span>
                  {/* A seta à mão era 5×10 de desenho numa caixa de 8×12. O
                      `ChevronRight` do lucide tem a mesma proporção: em `size-5`
                      o glifo sai com os mesmos 5×10, e o `-mr-1.5` desconta a
                      folga que a caixa maior acrescentaria à direita. O traço
                      vai a 2.4 de viewBox para render os mesmos 2px. */}
                  <ChevronRight
                    aria-hidden="true"
                    strokeWidth={2.4}
                    className="ml-auto -mr-1.5 size-5 shrink-0"
                  />
                </Link>

                <div className="flex justify-end">
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
      </Card>
    </Largura>
  );
}
