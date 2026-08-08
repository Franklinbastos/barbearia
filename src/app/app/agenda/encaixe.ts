import { DateTime } from 'luxon';
import { formatTime } from '@/lib/format';

/**
 * Horário do encaixe: o formulário do painel oferece dois caminhos e este
 * módulo é o único lugar que decide qual vale.
 *
 * A conversão mora aqui, e não no componente, porque o servidor precisa repetir
 * exatamente a mesma conta: `14:05` só vira instante com o fuso da barbearia
 * junto, e o fuso do navegador do atendente não tem nada a ver com isso.
 */

/** `HH:mm` ou `HH:mm:ss` — alguns navegadores mandam os segundos. */
const HORA = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/;
const DIA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Normaliza para `HH:mm`. Devolve nulo para qualquer coisa que não seja hora. */
export function normalizarHora(hora: string): string | null {
  const casou = HORA.exec(hora.trim());
  return casou ? `${casou[1]}:${casou[2]}` : null;
}

/**
 * A hora de agora, arredondada **para baixo** no passo do mostrador (§5.8).
 *
 * Para baixo, sempre: o cliente já sentou. Arredondar para cima marcaria o
 * atendimento para um instante que ainda não chegou e deixaria um buraco de
 * quatro minutos na agenda por puro efeito de conta.
 */
export function horaDeAgoraArredondada(agora: Date, timeZone: string, passo = 5): string {
  const instante = DateTime.fromJSDate(agora).setZone(timeZone);
  const minuto = Math.floor(instante.minute / passo) * passo;
  return instante.set({ minute: minuto, second: 0, millisecond: 0 }).toFormat('HH:mm');
}

/** Minutos num dia — o teto dos botões −5/+5. */
const MINUTOS_DO_DIA = 24 * 60;

/**
 * Os botões "−5" e "+5" do mostrador.
 *
 * **Não** viram o dia: o encaixe é sempre no dia mostrado na agenda, e passar
 * da meia-noite marcaria o cliente na data errada sem ninguém perceber. Nas
 * pontas o valor simplesmente para. Hora inválida volta como veio — quem avisa
 * é a validação, não um pulo silencioso.
 */
export function deslocarHora(hora: string, minutos: number): string {
  const normalizada = normalizarHora(hora);
  if (!normalizada) return hora;

  const [h, m] = normalizada.split(':').map(Number);
  const total = h * 60 + m + minutos;
  if (total < 0 || total > MINUTOS_DO_DIA - 5) return normalizada;

  const hh = String(Math.floor(total / 60)).padStart(2, '0');
  const mm = String(total % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

export type EscolhaDeHorario = {
  /** Instante ISO vindo do `<select>` da grade. */
  startAt?: string;
  /** Dia civil (`YYYY-MM-DD`) do formulário, no fuso da barbearia. */
  date?: string;
  /** Hora digitada no campo de encaixe. */
  hora?: string;
  timeZone: string;
};

/**
 * A hora digitada manda: se o atendente escreveu algo no campo de encaixe, é
 * porque o horário da grade não servia. Hora digitada inválida é recusa, nunca
 * queda silenciosa para o horário da grade — o balcão precisa ver o erro.
 */
export function resolverInicioDoEncaixe(escolha: EscolhaDeHorario): Date | null {
  const digitada = (escolha.hora ?? '').trim();

  if (digitada !== '') {
    const hora = normalizarHora(digitada);
    if (!hora) return null;

    const dia = (escolha.date ?? '').trim();
    if (!DIA_ISO.test(dia)) return null;

    const instante = DateTime.fromISO(`${dia}T${hora}`, { zone: escolha.timeZone });
    return instante.isValid ? instante.toJSDate() : null;
  }

  const daGrade = (escolha.startAt ?? '').trim();
  if (daGrade === '') return null;

  const instante = DateTime.fromISO(daGrade, { zone: escolha.timeZone });
  return instante.isValid ? instante.toJSDate() : null;
}

/**
 * Aviso de que a hora digitada não existe na grade normal. Só isso: não é
 * recusa. O encaixe fora da grade é o motivo de o campo existir, mas o
 * atendente tem que enxergar que está saindo do padrão.
 */
export function avisoDeHorarioLivre(
  hora: string,
  grade: { startAt: string }[],
  timeZone: string,
): string | null {
  const normalizada = normalizarHora(hora);
  if (!normalizada) return null;

  const naGrade = grade.some((slot) => formatTime(slot.startAt, timeZone) === normalizada);
  if (naGrade) return null;

  return `${normalizada} está fora da grade normal — vai entrar como encaixe.`;
}
