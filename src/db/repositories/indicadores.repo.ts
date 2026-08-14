import { and, asc, eq, gt, gte, lt } from 'drizzle-orm';

import { appointment, customer, staff, timeOff, workingHours } from '@/db/schema';
import type { VisitaDoCliente } from '@/domain/indicadores/cliente';
import type { AtendimentoBruto } from '@/domain/indicadores/dinheiro';
import type { BlocoDeTrabalho, Bloqueio } from '@/domain/indicadores/ocupacao';
import type { Db } from './types';

/**
 * As consultas de agregação da tela de resumo (§3 do spec).
 *
 * **Este arquivo é a única porta entre o banco e a matemática dos
 * indicadores.** `src/domain/indicadores/` não importa Drizzle nem conhece
 * `db`: recebe o que sai daqui como argumento e devolve número. É o que permite
 * testar borda de fuso, dia em curso e definição de cliente sumido em
 * milissegundos, sem Postgres.
 *
 * **Todas escopam por `barbershopId`**, que vem logo depois do `db` como em
 * todo o resto de `src/db/repositories/`. Uma consulta de agregação que
 * esquecesse o escopo não quebraria teste nenhum de tela: só somaria o
 * movimento do vizinho ao do dono, e o número continuaria parecendo certo.
 *
 * O tipo de retorno de cada função é o tipo que o módulo de domínio já declara
 * (`BlocoDeTrabalho`, `Bloqueio`, `VisitaDoCliente`, `AtendimentoBruto`), e não
 * um tipo novo: se as duas pontas divergirem, é aqui que o `tsc` acusa.
 */

/**
 * O denominador da ocupação: o expediente de cada barbeiro e os bloqueios que
 * tocam a janela.
 *
 * **O expediente não é filtrado pela janela** porque `working_hours` guarda
 * relógio de parede por dia da semana, sem data — quem transforma `weekday` +
 * `'09:00:00'` em instante é `calcularOcupacao`, dia a dia e no fuso da loja.
 * Filtrar aqui exigiria repetir essa conversão em SQL, com o fuso do servidor,
 * que é exatamente o erro que a §"Fuso" das instruções proíbe.
 *
 * **Barbeiro desativado fica de fora.** As linhas de `working_hours` dele
 * sobrevivem à desativação, e contá-las abriria um denominador de cadeira que
 * não existe mais: a barbearia apareceria com ocupação despencando no mês em
 * que alguém saiu. Os atendimentos antigos dele continuam existindo, mas
 * `calcularOcupacao` só conta ocupado **dentro** do disponível, então eles
 * simplesmente não entram — nem no numerador nem no denominador.
 *
 * **Os bloqueios, sim, são filtrados**, e por interseção (`startAt < fim` e
 * `endAt > inicio`), a mesma convenção de `listBusyRanges`: um `time_off` que
 * começa na véspera e entra pela manhã tem que descontar a parte de dentro.
 * Quem termina exatamente no início da janela, ou começa exatamente no fim,
 * não intersecta nada — o `fim` é exclusivo em toda a casa.
 */
export async function listarExpedienteEBloqueios(
  db: Db,
  barbershopId: string,
  inicio: Date,
  fim: Date,
): Promise<{ expediente: BlocoDeTrabalho[]; bloqueios: Bloqueio[] }> {
  const expediente = await db
    .select({
      staffId: workingHours.staffId,
      weekday: workingHours.weekday,
      startTime: workingHours.startTime,
      endTime: workingHours.endTime,
    })
    .from(workingHours)
    .innerJoin(staff, eq(staff.id, workingHours.staffId))
    .where(and(eq(workingHours.barbershopId, barbershopId), eq(staff.active, true)))
    .orderBy(asc(workingHours.weekday), asc(workingHours.startTime));

  const bloqueios = await db
    .select({ staffId: timeOff.staffId, startAt: timeOff.startAt, endAt: timeOff.endAt })
    .from(timeOff)
    .where(
      and(
        eq(timeOff.barbershopId, barbershopId),
        lt(timeOff.startAt, fim),
        gt(timeOff.endAt, inicio),
      ),
    )
    .orderBy(asc(timeOff.startAt));

  return { expediente, bloqueios };
}

/**
 * O histórico de visitas de cada cliente, a partir de `desde` — a matéria-prima
 * de "cliente sumido", "novos vs recorrentes" e "tempo entre visitas".
 *
 * **Só `DONE`.** O ritmo de um cliente é feito do que ele de fato cortou;
 * agendado do futuro, falta e cancelamento não são visita, e contá-los
 * inventaria um intervalo típico que nunca existiu.
 *
 * A janela é aberta à direita de propósito: quem chama passa um ano para trás,
 * e o corte de sumiço precisa enxergar o histórico inteiro, não só o período
 * selecionado na tela — é a diferença entre "sumiu" e "não veio esta semana".
 *
 * O agrupamento é feito aqui, em JavaScript, e não com `array_agg`: são poucos
 * milhares de linhas por barbearia num ano, e o `array_agg` de `timestamptz`
 * volta como texto do driver, o que traria conversão de fuso para dentro do
 * repositório — justamente onde ela não pode estar.
 */
export async function listarHistoricoDeClientes(
  db: Db,
  barbershopId: string,
  desde: Date,
): Promise<VisitaDoCliente[]> {
  const linhas = await db
    .select({
      customerId: customer.id,
      nome: customer.name,
      telefone: customer.phone,
      quando: appointment.startAt,
    })
    .from(appointment)
    .innerJoin(customer, eq(customer.id, appointment.customerId))
    .where(
      and(
        eq(appointment.barbershopId, barbershopId),
        eq(appointment.status, 'DONE'),
        gte(appointment.startAt, desde),
      ),
    )
    .orderBy(asc(customer.name), asc(appointment.startAt));

  const porCliente = new Map<string, VisitaDoCliente>();

  for (const linha of linhas) {
    const atual = porCliente.get(linha.customerId);
    if (atual) {
      atual.visitas.push(linha.quando);
      continue;
    }
    porCliente.set(linha.customerId, {
      customerId: linha.customerId,
      nome: linha.nome,
      telefone: linha.telefone,
      visitas: [linha.quando],
    });
  }

  return [...porCliente.values()];
}

/**
 * **Há duas consultas de atendimento, e elas recortam a janela de jeitos
 * diferentes de propósito.** Se um dia alguém as reunir "porque são iguais", um
 * dos dois indicadores passa a mentir — e nenhum teste de tela acusa.
 *
 * - `listarAtendimentosIniciadosNoPeriodo` (`startAt` dentro da janela) serve a
 *   **dinheiro e comportamento**: faturamento, ticket médio, comissão, receita
 *   perdida, falta, cancelamento, origem, novos vs recorrentes. São números que
 *   pertencem inteiros ao dia em que o atendimento **começou**.
 * - `listarAtendimentosQueOcupamOPeriodo` (interseção) serve **só à ocupação**,
 *   que mede minuto de cadeira e corta a parte de dentro da janela.
 *
 * O caso que separa as duas: um corte das 23:40 de domingo às 00:10 de segunda.
 * Pela interseção ele entra na segunda-feira e leva o preço inteiro junto — o
 * faturamento da semana seguinte ganha um corte que aconteceu na semana
 * anterior, e a comissão do barbeiro muda de fechamento. Para a ocupação da
 * segunda, porém, aqueles 10 minutos de cadeira ocupada são reais e têm que
 * entrar.
 *
 * **Por que nenhuma das duas é `listAppointmentsBetween`.** Aquela consulta
 * serve à agenda e traz o que a agenda desenha: nome do cliente e do serviço.
 * Faltam os dois campos de que os indicadores vivem — `customerId`, que é a
 * chave de novos vs recorrentes, e `canceledAt`, que é o único jeito de separar
 * o cancelamento com aviso do cancelamento em cima da hora (§3.4). Alargar a
 * consulta da agenda para carregar coluna que ela não desenha seria pior do que
 * ter duas projeções do mesmo `appointment`.
 */
const COLUNAS_DO_INDICADOR = {
  id: appointment.id,
  staffId: appointment.staffId,
  customerId: appointment.customerId,
  startAt: appointment.startAt,
  endAt: appointment.endAt,
  status: appointment.status,
  origin: appointment.origin,
  precoCents: appointment.servicePriceCentsSnapshot,
  canceledAt: appointment.canceledAt,
};

/**
 * Os atendimentos que **começaram** dentro da janela — a lista de **dinheiro e
 * comportamento**.
 *
 * O recorte é `inicio <= startAt < fim`, e não a interseção da agenda: valor,
 * comissão, falta e origem são atributos do atendimento inteiro, e atendimento
 * inteiro só cabe num período — o em que ele começou. Quem usa interseção aqui
 * soma o preço de um corte de domingo ao faturamento da segunda.
 *
 * O `fim` é exclusivo, como em toda a casa.
 */
export async function listarAtendimentosIniciadosNoPeriodo(
  db: Db,
  barbershopId: string,
  inicio: Date,
  fim: Date,
): Promise<AtendimentoBruto[]> {
  return db
    .select(COLUNAS_DO_INDICADOR)
    .from(appointment)
    .where(
      and(
        eq(appointment.barbershopId, barbershopId),
        gte(appointment.startAt, inicio),
        lt(appointment.startAt, fim),
      ),
    )
    .orderBy(asc(appointment.startAt));
}

/**
 * Os atendimentos que **tocam** a janela — a lista da **ocupação**, e só dela.
 *
 * Recorte por interseção (`startAt < fim` e `endAt > inicio`), a mesma convenção
 * de `listBusyRanges` e `listAppointmentsBetween`: um atendimento que começa
 * antes da meia-noite e atravessa para dentro da janela ocupou cadeira lá
 * dentro, e `calcularOcupacao` corta exatamente a parte que interessa. Quem
 * termina no `inicio`, ou começa no `fim`, não intersecta nada.
 *
 * **Não use esta lista para somar dinheiro.** Ela traz atendimento cujo preço
 * pertence a outro período.
 */
export async function listarAtendimentosQueOcupamOPeriodo(
  db: Db,
  barbershopId: string,
  inicio: Date,
  fim: Date,
): Promise<AtendimentoBruto[]> {
  return db
    .select(COLUNAS_DO_INDICADOR)
    .from(appointment)
    .where(
      and(
        eq(appointment.barbershopId, barbershopId),
        lt(appointment.startAt, fim),
        gt(appointment.endAt, inicio),
      ),
    )
    .orderBy(asc(appointment.startAt));
}
