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
 * Os atendimentos da janela, no formato que a matemática dos indicadores
 * consome.
 *
 * **Por que não `listAppointmentsBetween`.** Aquela consulta serve à agenda e
 * traz o que a agenda desenha: nome do cliente e do serviço. Faltam os dois
 * campos de que os indicadores vivem — `customerId`, que é a chave de novos vs
 * recorrentes, e `canceledAt`, que é o único jeito de separar o cancelamento
 * com aviso do cancelamento em cima da hora (§3.4). Alargar a consulta da
 * agenda para carregar coluna que ela não desenha seria pior do que ter duas
 * projeções do mesmo `appointment`.
 *
 * O recorte é por **interseção** (`startAt < fim` e `endAt > inicio`), igual ao
 * da agenda: um atendimento que começa antes da meia-noite e atravessa para
 * dentro da janela ainda ocupou cadeira lá dentro, e `calcularOcupacao` já
 * corta a parte que interessa.
 */
export async function listarAtendimentosDoPeriodo(
  db: Db,
  barbershopId: string,
  inicio: Date,
  fim: Date,
): Promise<AtendimentoBruto[]> {
  return db
    .select({
      id: appointment.id,
      staffId: appointment.staffId,
      customerId: appointment.customerId,
      startAt: appointment.startAt,
      endAt: appointment.endAt,
      status: appointment.status,
      origin: appointment.origin,
      precoCents: appointment.servicePriceCentsSnapshot,
      canceledAt: appointment.canceledAt,
    })
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
