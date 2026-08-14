/**
 * O dinheiro do período (§3.1 do spec).
 *
 * Matemática pura: recebe a lista de atendimentos já filtrada pela `Janela` e
 * devolve número. Nada de banco aqui — é o que permite testar a regra do
 * faturamento em milissegundos, sem subir Postgres.
 */

/**
 * Um atendimento cru, do jeito que sai do banco, com só o que a matemática dos
 * indicadores precisa. **É o tipo comum de `src/domain/indicadores/`**:
 * ocupação, comportamento e comissão importam daqui em vez de cada um declarar
 * o seu, porque os quatro têm que concordar sobre o que é um atendimento.
 *
 * `precoCents` é o **snapshot** gravado no agendamento
 * (`servicePriceCentsSnapshot`), nunca o preço atual do serviço: mudar a tabela
 * de preços amanhã não pode reescrever o faturamento de ontem.
 *
 * `canceledAt` é o que permite separar o cancelamento com aviso do
 * cancelamento em cima da hora (§3.4) — dado que a maioria dos sistemas
 * descarta e que aqui é indicador.
 */
export type AtendimentoBruto = {
  id: string;
  staffId: string;
  customerId: string;
  startAt: Date;
  endAt: Date;
  status: 'BOOKED' | 'DONE' | 'CANCELED' | 'NO_SHOW';
  origin: 'PUBLIC' | 'PANEL' | 'BOT';
  /** Preço em centavos congelado no momento do agendamento. */
  precoCents: number;
  /** Quando o cancelamento aconteceu, ou `null` se não foi cancelado. */
  canceledAt: Date | null;
};

export type ResumoDeDinheiro = {
  /** Soma do preço dos `DONE`. É o realizado, e só ele. */
  faturamentoCents: number;
  /** Faturamento ÷ atendimentos, arredondado ao centavo. Zero se não houve nenhum. */
  ticketMedioCents: number;
  /** Quantidade de `DONE` — o denominador do ticket. */
  atendimentos: number;
  /** Soma do preço dos `NO_SHOW`: o que a falta custou. */
  perdidoCents: number;
  /** Soma do preço do que está agendado e ainda vai acontecer. Nunca somado ao faturamento. */
  previstoCents: number;
};

/**
 * Faturamento, ticket médio, receita perdida e previsto de uma lista de
 * atendimentos.
 *
 * **Faturamento conta só `DONE`.** Agendado não é dinheiro: enquanto o corte
 * não aconteceu, o cliente ainda pode faltar ou cancelar. Somar `BOOKED` ao
 * realizado é o erro que faz o dono fechar o mês com um número que nunca
 * entrou no caixa. O agendado do futuro sai separado, em `previstoCents`, como
 * o "Sales Breakdown" do Vagaro faz.
 *
 * **Ticket médio é sobre `DONE`, não sobre o total.** Dividir pelo total
 * (com falta e cancelamento dentro) derruba o ticket sem que nada tenha
 * mudado no preço — seria a taxa de falta disfarçada de ticket.
 *
 * O `agora` decide o que é futuro. `BOOKED` com horário já passado não é
 * previsto (a hora foi e o dono não fechou o atendimento) nem faturamento (não
 * foi confirmado como feito): fica de fora dos dois, e o lugar de cobrar esse
 * fechamento é a agenda, não o resumo.
 */
export function calcularDinheiro(itens: AtendimentoBruto[], agora: Date): ResumoDeDinheiro {
  let faturamentoCents = 0;
  let atendimentos = 0;
  let perdidoCents = 0;
  let previstoCents = 0;

  for (const item of itens) {
    if (item.status === 'DONE') {
      faturamentoCents += item.precoCents;
      atendimentos += 1;
      continue;
    }

    if (item.status === 'NO_SHOW') {
      perdidoCents += item.precoCents;
      continue;
    }

    if (item.status === 'BOOKED' && item.startAt.getTime() >= agora.getTime()) {
      previstoCents += item.precoCents;
    }
  }

  return {
    faturamentoCents,
    // Sem atendimento não há ticket: zero, e não a divisão por zero que viraria
    // `NaN` e apareceria na tela como "R$ NaN".
    ticketMedioCents: atendimentos === 0 ? 0 : Math.round(faturamentoCents / atendimentos),
    atendimentos,
    perdidoCents,
    previstoCents,
  };
}
