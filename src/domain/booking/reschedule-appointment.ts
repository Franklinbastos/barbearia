import { and, eq } from 'drizzle-orm';
import { appointment, notificationLog } from '@/db/schema';
import {
  findAppointmentById,
  findBarbershopById,
  listStaffForService,
  type Db,
} from '@/db/repositories';
import { MENSAGEM_DE_COLISAO } from './create-walk-in';
import { NotFoundError, SlotTakenError, SlotUnavailableError, isExclusionViolation } from './errors';

/**
 * Remarcar sem cancelar (§2.1 do plano de 15/08/2026).
 *
 * Hoje mudar alguém de horário é cancelar e criar de novo — e o cancelamento
 * dispara WhatsApp de cancelamento para quem só queria trocar de hora.
 *
 * Três coisas aqui não são preferência:
 *
 * 1. **Quem decide colisão é a constraint `EXCLUDE`**, traduzida por
 *    `isExclusionViolation`. Não há segunda verificação: uma checagem prévia
 *    passaria sob corrida, e sem a tradução o erro volta 500 em vez de 409 — foi
 *    o defeito que a review da Fase 1 achou no encaixe.
 * 2. **O snapshot de nome, preço e duração não muda.** É o que o histórico e a
 *    comissão leem: remarcar não é renegociar. A duração vem do snapshot mesmo
 *    quando o barbeiro muda, e é dela que o novo fim é recalculado.
 * 3. **A mensagem de colisão é a do encaixe**, importada de `create-walk-in.ts`.
 *    Duas frases para a mesma recusa divergiriam no primeiro ajuste.
 */
export type RescheduleInput = {
  appointmentId: string;
  barbershopId: string;
  novoInicio: Date;
  novoStaffId?: string; // ausente = mantém o barbeiro
  avisarCliente: boolean;
};

/**
 * O que fica registrado enquanto o envio não existe. Os templates da Meta estão
 * presos em burocracia, então a linha nasce `FAILED` com o motivo escrito: no
 * dia em que o envio existir, ele acha a fila pronta em vez de um histórico
 * vazio.
 */
export const ENVIO_PENDENTE = 'Envio pendente: template não aprovado';

export async function rescheduleAppointment(db: Db, input: RescheduleInput): Promise<void> {
  const loja = await findBarbershopById(db, input.barbershopId);
  if (!loja) throw new NotFoundError('Barbearia não encontrada');

  if (Number.isNaN(input.novoInicio.getTime())) {
    throw new SlotUnavailableError('Horário inválido');
  }

  const atual = await findAppointmentById(db, input.barbershopId, input.appointmentId);
  if (!atual) throw new NotFoundError('Agendamento não encontrado');

  // Cancelado não se remarca: o horário dele já voltou para a grade e pode ter
  // sido vendido. A `EXCLUDE` também o ignora (`WHERE status <> 'CANCELED'`),
  // então sem esta recusa o cancelado atravessaria por cima de quem ficou.
  if (atual.status === 'CANCELED') {
    throw new SlotUnavailableError('Esse atendimento foi cancelado e não pode ser remarcado');
  }

  const novoStaffId = input.novoStaffId ?? atual.staffId;

  if (novoStaffId !== atual.staffId) {
    // Mesma guarda do encaixe: `listStaffForService` já filtra por barbearia,
    // barbeiro ativo e serviço ativo. O serviço nulo é o do catálogo apagado —
    // aí não há como afirmar que o novo barbeiro faz aquilo, e mudar de cadeira
    // fica fora.
    if (!atual.serviceId) {
      throw new NotFoundError('O serviço deste atendimento saiu do catálogo; troque só a hora');
    }
    const vinculos = await listStaffForService(db, input.barbershopId, atual.serviceId);
    if (!vinculos.some((c) => c.id === novoStaffId)) {
      throw new NotFoundError('Esse barbeiro não faz esse serviço');
    }
  }

  // A duração é a do snapshot, não a do serviço de hoje nem a do barbeiro novo:
  // 30 min às 9h continua 30 min às 11h. O fim recalcula do início.
  const duracao = atual.serviceDurationMinutesSnapshot;
  if (!Number.isFinite(duracao) || duracao <= 0) {
    throw new SlotUnavailableError('Duração do atendimento inválida');
  }
  const novoFim = new Date(input.novoInicio.getTime() + duracao * 60_000);

  // Remarcar para onde já está é no-op. A `EXCLUDE` não compara a linha consigo
  // mesma, então não haveria conflito de qualquer jeito — o que este atalho
  // evita é gravar aviso de mudança para um cliente que não mudou de nada.
  const mesmoLugar =
    input.novoInicio.getTime() === atual.startAt.getTime() && novoStaffId === atual.staffId;
  if (mesmoLugar) return;

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(appointment)
        .set({ staffId: novoStaffId, startAt: input.novoInicio, endAt: novoFim })
        .where(
          and(
            eq(appointment.barbershopId, input.barbershopId),
            eq(appointment.id, input.appointmentId),
          ),
        );

      if (!input.avisarCliente) return;

      // `onConflictDoUpdate` e não uma linha nova: o único por
      // `(appointmentId, type)` é a trava de reserva do `notify.ts` e não pode
      // ganhar coluna (ver o comentário do schema). Remarcar a segunda vez
      // reabre a mesma linha em vez de estourar — e é o certo, porque o aviso
      // que interessa é o da última remarcação, não o da penúltima.
      await tx
        .insert(notificationLog)
        .values({
          barbershopId: input.barbershopId,
          appointmentId: input.appointmentId,
          type: 'RESCHEDULE',
          status: 'FAILED',
          error: ENVIO_PENDENTE,
        })
        .onConflictDoUpdate({
          target: [notificationLog.appointmentId, notificationLog.type],
          set: {
            status: 'FAILED',
            error: ENVIO_PENDENTE,
            providerMessageId: null,
            sentAt: new Date(),
          },
        });
    });
  } catch (erro) {
    if (isExclusionViolation(erro)) throw new SlotTakenError(MENSAGEM_DE_COLISAO);
    throw erro;
  }
}
