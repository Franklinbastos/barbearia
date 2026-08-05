import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().startsWith('postgres', 'DATABASE_URL deve ser uma URL Postgres'),
  AUTH_SECRET: z.string().min(32, 'AUTH_SECRET precisa de pelo menos 32 caracteres'),
  MANAGE_TOKEN_SECRET: z.string().min(32, 'MANAGE_TOKEN_SECRET precisa de pelo menos 32 caracteres'),
  APP_URL: z.string().url('APP_URL deve ser uma URL válida'),
});

export type Env = z.infer<typeof schema>;

export function parseEnv(source: Record<string, unknown>): Env {
  const result = schema.safeParse(source);
  if (!result.success) {
    const detalhes = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Variáveis de ambiente inválidas — ${detalhes}`);
  }
  return result.data;
}

export const env = parseEnv(process.env);
