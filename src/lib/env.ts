import { z } from 'zod';

/**
 * Segredo que veio do `.env.example` não pode passar por ter comprimento certo:
 * o README manda copiar o arquivo, e um `AUTH_SECRET` público permite forjar a
 * sessão de qualquer barbearia. Casa com os placeholders do exemplo em
 * qualquer idioma que já usamos.
 */
const PLACEHOLDER = /^(change|troque|outro-segredo|exemplo|example|coloque|substitua)/i;

const segredo = (minimo: number, nome: string) =>
  z
    .string()
    .min(minimo, `${nome} precisa de pelo menos ${minimo} caracteres`)
    .refine(
      (v) => !PLACEHOLDER.test(v.trim()),
      `${nome} ainda está com o valor de exemplo — gere um segredo aleatório`,
    );

const schema = z
  .object({
    DATABASE_URL: z.string().startsWith('postgres', 'DATABASE_URL deve ser uma URL Postgres'),
    AUTH_SECRET: segredo(32, 'AUTH_SECRET'),
    MANAGE_TOKEN_SECRET: segredo(32, 'MANAGE_TOKEN_SECRET'),
    APP_URL: z.string().url('APP_URL deve ser uma URL válida'),
    WHATSAPP_ENABLED: z.enum(['true', 'false']).default('false'),
    WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
    WHATSAPP_ACCESS_TOKEN: z.string().optional(),
    WHATSAPP_LANGUAGE: z.string().default('pt_BR'),
    CRON_SECRET: segredo(16, 'CRON_SECRET'),
    // Piso de 60: o cron do vercel.json roda de hora em hora. Janela menor que o
    // intervalo abre buraco entre execuções e alguns agendamentos nunca recebem
    // lembrete — a execução das 10h olharia 10:00-10:30 e a das 11h olharia
    // 11:00-11:30, deixando 10:31-11:00 sem ninguém.
    REMINDER_WINDOW_MINUTES: z.coerce
      .number()
      .int()
      .min(60, 'REMINDER_WINDOW_MINUTES precisa ser pelo menos 60, o intervalo do cron')
      .default(180),
  })
  // Com o WhatsApp ligado e sem credencial, todo envio vira uma linha FAILED no
  // log que ninguém olha — o cliente simplesmente não recebe a confirmação.
  .superRefine((valores, ctx) => {
    if (valores.WHATSAPP_ENABLED !== 'true') return;
    for (const campo of ['WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_ACCESS_TOKEN'] as const) {
      if ((valores[campo] ?? '').trim() === '') {
        ctx.addIssue({
          code: 'custom',
          path: [campo],
          message: `${campo} é obrigatório quando WHATSAPP_ENABLED=true`,
        });
      }
    }
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
