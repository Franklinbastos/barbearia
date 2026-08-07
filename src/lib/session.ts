import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { and, asc, eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/db/client';
import { staff } from '@/db/schema';

export type PanelSession = {
  userId: string;
  barbershopId: string;
  staffId: string;
  role: 'OWNER' | 'BARBER';
};

export async function requireSession(): Promise<PanelSession> {
  const sessao = await auth.api.getSession({ headers: await headers() });
  if (!sessao?.user) redirect('/login');

  const [vinculo] = await db
    .select()
    .from(staff)
    .where(and(eq(staff.userId, sessao.user.id), eq(staff.active, true)))
    // Sem ORDER BY, o LIMIT 1 devolve a linha na ordem física do heap: um UPDATE
    // qualquer reescreve a linha no fim e o usuário vinculado a duas barbearias
    // trocaria de tenant entre requisições. O vínculo mais antigo manda, e o id
    // desempata quando dois vínculos nascem no mesmo instante.
    .orderBy(asc(staff.createdAt), asc(staff.id))
    .limit(1);

  if (!vinculo) redirect('/signup');

  return {
    userId: sessao.user.id,
    barbershopId: vinculo.barbershopId,
    staffId: vinculo.id,
    role: vinculo.role as 'OWNER' | 'BARBER',
  };
}

export const MENSAGEM_SO_DONO = 'Só o dono da barbearia pode fazer isso.';

export type ResultadoDeSessao =
  | { ok: true; sessao: PanelSession }
  | { ok: false; erro: string };

/**
 * Política de papéis do painel: cadastro — equipe, expediente, bloqueios,
 * serviços, preço, configurações da barbearia e remoção de dados pessoais — é
 * só do OWNER; a agenda do dia (marcar compareceu, marcar não veio, cancelar,
 * encaixar) e a anotação na ficha do cliente o BARBER também opera.
 *
 * Devolve o erro em vez de lançar porque as actions do painel entregam a falha
 * ao formulário; quem não tem formulário converte o erro em `redirect`.
 */
export async function requireOwner(): Promise<ResultadoDeSessao> {
  const sessao = await requireSession();
  if (sessao.role !== 'OWNER') return { ok: false, erro: MENSAGEM_SO_DONO };
  return { ok: true, sessao };
}
