import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { db } from '@/db/client';
import { env } from '@/lib/env';

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg' }),
  secret: env.AUTH_SECRET,
  baseURL: env.APP_URL,
  emailAndPassword: { enabled: true, minPasswordLength: 8 },
  session: { expiresIn: 60 * 60 * 24 * 30 },
  // Sem este plugin, `auth.api.signUpEmail` chamado de dentro de uma Server
  // Action cria o usuário e a sessão no banco mas não grava o cookie: o dono
  // termina o cadastro e cai na tela de entrar. Tem que ser o ÚLTIMO da lista.
  plugins: [nextCookies()],
});
