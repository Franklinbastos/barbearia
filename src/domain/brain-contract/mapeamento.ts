import { DateTime } from 'luxon';

/**
 * O brain fala em nomes ("Corte", "João"), o domínio da barbearia trabalha com
 * ids. Estas funções fazem a ponte, e só isso — a resolução real (grade,
 * colisão, janela) continua sendo do domínio.
 */

/** Baixa a caixa e tira acento: "João" e "joao" batem, "Barba " e "barba" também. */
export function normalizarTexto(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

export function acharPorNome<T extends { name: string }>(
  itens: T[],
  nome: string | undefined | null,
): T | null {
  if (!nome || nome.trim() === '') return null;
  const alvo = normalizarTexto(nome);
  return itens.find((i) => normalizarTexto(i.name) === alvo) ?? null;
}

/**
 * Junta data (YYYY-MM-DD) e horário (HH:mm) no fuso da barbearia e devolve o
 * instante absoluto. Data ou hora malformada devolve `null` — quem chama decide
 * a mensagem, aqui não se inventa horário.
 */
export function montarInicio(
  date: string | undefined | null,
  time: string | undefined | null,
  timeZone: string,
): Date | null {
  if (!date || !time) return null;
  const dt = DateTime.fromISO(`${date}T${time}`, { zone: timeZone });
  return dt.isValid ? dt.toJSDate() : null;
}

/** Instante absoluto para "HH:mm" no fuso da barbearia. */
export function horaLocal(instante: Date, timeZone: string): string {
  return DateTime.fromJSDate(instante).setZone(timeZone).toFormat('HH:mm');
}

/** Centavos para "R$ 40,00". */
export function formatarPreco(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
