import { z } from 'zod';

export const GRADES_PERMITIDAS = [10, 15, 20, 30, 45, 60] as const;

function fusoValido(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('pt-BR', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const schema = z.object({
  name: z.string().trim().min(2, 'Informe o nome da barbearia'),
  slotMinutes: z.coerce
    .number()
    .int()
    .refine((v) => (GRADES_PERMITIDAS as readonly number[]).includes(v), {
      message: `A grade precisa ser uma destas: ${GRADES_PERMITIDAS.join(', ')} minutos`,
    }),
  minLeadMinutes: z.coerce.number().int().min(0, 'A antecedência mínima não pode ser negativa').max(10080),
  maxAdvanceDays: z.coerce.number().int().positive().max(365, 'A janela de agendamento não pode passar de 365 dias'),
  timeZone: z.string().refine(fusoValido, 'Fuso horário inválido'),
});

export function validateShopSettings(input: unknown) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);
  return parsed.data;
}
