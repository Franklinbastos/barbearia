import type { AppointmentStatus } from '@/lib/format';

/**
 * Estado do atendimento como variante do `Badge` do shadcn.
 *
 * Antes de 13/08/2026 cada tela desenhava a própria etiqueta à mão, e as duas
 * discordavam: "Não veio" era âmbar no histórico do cliente e vermelho no cartão
 * da agenda. Com a etiqueta vindo da lib, o mapa vira uma coisa só e mora aqui —
 * o cartão da agenda e o histórico do cliente leem a mesma linha.
 *
 * A leitura das quatro variantes, que são as únicas que a lib oferece:
 *
 * - `default` (cheia, na tinta) para **Compareceu** — é o desfecho bom e o único
 *   que merece peso na linha;
 * - `destructive` (vermelho suave) para **Não veio**, que é o desfecho que custa
 *   dinheiro e o que se procura quando se olha o dia de trás para frente;
 * - `outline` para **Cancelado**, que já chega com o nome riscado no cartão:
 *   etiqueta cheia ali seria a segunda ênfase na mesma informação;
 * - `secondary` para **Agendado**, o estado sem notícia.
 *
 * Cor nunca é o único portador: o texto da etiqueta é o próprio rótulo do
 * estado, escrito por `formatAppointmentStatus`.
 */
export const VARIANTE_DO_ESTADO = {
  BOOKED: 'secondary',
  DONE: 'default',
  CANCELED: 'outline',
  NO_SHOW: 'destructive',
} as const satisfies Record<AppointmentStatus, 'default' | 'secondary' | 'destructive' | 'outline'>;
