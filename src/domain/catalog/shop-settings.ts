import { z } from 'zod';

export const GRADES_PERMITIDAS = [10, 15, 20, 30, 45, 60] as const;

/**
 * Os doze matizes da marca da loja (§3.4), de 30 em 30 graus no círculo.
 *
 * O dono escolhe **um número** e só isso: L e croma são travados em
 * `oklch(0.45 0.09 H)` no claro e `oklch(0.82 0.09 H)` no escuro, valores que
 * cabem no sRGB em todo o círculo. Doze fichas no lugar de `input type="color"`
 * é menos escolha e zero cor feia — e nenhuma delas produz botão ilegível.
 */
export const MATIZES_PERMITIDOS = [
  0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330,
] as const;

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
  // Campo ausente e campo vazio significam a mesma coisa — sem cor, preto e
  // branco. Só depois disso o valor é confrontado com a paleta: matiz livre
  // vindo por FormData adulterado é recusado como qualquer outro dado inválido.
  accentHue: z
    .union([z.string(), z.number(), z.null()])
    .optional()
    .transform((valor) => {
      if (valor === '' || valor === null || valor === undefined) return null;
      return Number(valor);
    })
    .refine(
      (valor) => valor === null || (MATIZES_PERMITIDOS as readonly number[]).includes(valor),
      { message: 'A cor da loja precisa ser uma das doze da paleta' },
    ),
});

export function validateShopSettings(input: unknown) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);
  return parsed.data;
}
