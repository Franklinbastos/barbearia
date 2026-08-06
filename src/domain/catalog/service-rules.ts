import { z } from 'zod';

const MAX_DURACAO_MINUTOS = 8 * 60;

export function parsePriceToCents(texto: string): number {
  const limpo = String(texto).replace(/[^\d,.-]/g, '').replace(',', '.');
  if (!/\d/.test(limpo)) {
    throw new Error('Informe um preço válido, como 40 ou 40,50');
  }
  const valor = Number(limpo);
  if (!Number.isFinite(valor) || valor < 0) {
    throw new Error('Informe um preço válido, como 40 ou 40,50');
  }
  return Math.round(valor * 100);
}

const schema = z.object({
  name: z.string().trim().min(2, 'Informe o nome do serviço'),
  durationMinutes: z.coerce
    .number()
    .int('A duração deve ser em minutos inteiros')
    .positive('A duração deve ser maior que zero')
    .max(MAX_DURACAO_MINUTOS, 'A duração não pode passar de 8 horas'),
  priceCents: z.string(),
});

export function validateServiceInput(input: unknown, _slotMinutes: number) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);
  return {
    name: parsed.data.name,
    durationMinutes: parsed.data.durationMinutes,
    priceCents: parsePriceToCents(parsed.data.priceCents),
  };
}
