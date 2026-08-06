import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
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
    .limit(1);

  if (!vinculo) redirect('/signup');

  return {
    userId: sessao.user.id,
    barbershopId: vinculo.barbershopId,
    staffId: vinculo.id,
    role: vinculo.role as 'OWNER' | 'BARBER',
  };
}
