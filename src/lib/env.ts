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

const urlHttpsOpcional = (mensagem: string) =>
  z.preprocess(
    (valor) => (typeof valor === 'string' && valor.trim() === '' ? undefined : valor),
    z
      .string()
      .url(mensagem)
      .refine((valor) => new URL(valor).protocol === 'https:', `${mensagem}; use HTTPS`)
      .optional(),
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
    TEMPRA_BILLING_ENABLED: z.enum(['true', 'false']).default('false'),
    TEMPRA_BILLING_URL: z.string().url('TEMPRA_BILLING_URL deve ser uma URL válida').optional(),
    TEMPRA_BILLING_API_KEY: z.string().optional(),
    TEMPRA_BILLING_LOW_BALANCE_PERCENT: z.coerce.number().min(0).max(100).default(10),
    TEMPRA_BILLING_RETURN_URL: urlHttpsOpcional(
      'TEMPRA_BILLING_RETURN_URL deve ser uma URL válida',
    ),
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
    if (valores.WHATSAPP_ENABLED === 'true') {
      for (const campo of ['WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_ACCESS_TOKEN'] as const) {
        if ((valores[campo] ?? '').trim() === '') {
          ctx.addIssue({
            code: 'custom',
            path: [campo],
            message: `${campo} é obrigatório quando WHATSAPP_ENABLED=true`,
          });
        }
      }
    }

    if (valores.TEMPRA_BILLING_ENABLED === 'true') {
      for (const campo of ['TEMPRA_BILLING_URL', 'TEMPRA_BILLING_API_KEY'] as const) {
        if ((valores[campo] ?? '').trim() === '') {
          ctx.addIssue({
            code: 'custom',
            path: [campo],
            message: `${campo} é obrigatório quando TEMPRA_BILLING_ENABLED=true`,
          });
        }
      }
      const chave = segredo(32, 'TEMPRA_BILLING_API_KEY').safeParse(
        valores.TEMPRA_BILLING_API_KEY,
      );
      if (!chave.success && (valores.TEMPRA_BILLING_API_KEY ?? '').trim() !== '') {
        ctx.addIssue({
          code: 'custom',
          path: ['TEMPRA_BILLING_API_KEY'],
          message: chave.error.issues[0]?.message ?? 'TEMPRA_BILLING_API_KEY é inválida',
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
