'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Bloco } from '@/components/ui/bloco';
import { Botao } from '@/components/ui/botao';
import { coresDeBarbeiro } from '@/lib/cores-de-barbeiro';
import { formatTime, type AppointmentStatus } from '@/lib/format';
import { CartaoDaAgenda, duracaoEmMinutos } from './cartao-da-agenda';
import { LinhaDaAgenda } from './linha-da-agenda';
import { calcularProximosLivres, type ProximoLivre } from './proximos-livres';
import { Remarcacao, useRemarcacao } from './remarcacao';
import {
  agruparVaosLivres,
  buildVaosLivres,
  FaixaDeVaoLivre,
  pedirEncaixe,
  recortarNoAgora,
  type VaoLivreAgrupado,
} from './vao-livre';

export type AgendaAppointment = {
  id: string;
  staffId: string;
  customerId: string;
  startAt: Date;
  endAt: Date;
  status: AppointmentStatus;
  origin: 'PUBLIC' | 'PANEL' | 'BOT';
  serviceName: string;
  servicePriceCents: number;
  customerName: string;
  customerPhone: string;
};

export type AgendaStaff = { id: string; name: string };

export type AgendaItem = AgendaAppointment & { staffName: string };

/** Barbeiro que saiu da equipe ainda tem atendimento marcado no dia — some da lista de ativos, não da agenda. */
const BARBEIRO_DESCONHECIDO = 'Barbeiro removido';

/**
 * Agenda do dia como **uma lista só**, em ordem de horário.
 *
 * Coluna por barbeiro obriga a rolar o dia inteiro de cada um para descobrir
 * quem está livre às 10h — e no celular vira uma coluna empilhada embaixo da
 * outra. Ordenado por horário, o nome do barbeiro precisa ir em cada cartão,
 * que é o que este retorno já entrega pronto.
 */
export function buildDayList(
  appointments: AgendaAppointment[],
  staffList: AgendaStaff[],
): AgendaItem[] {
  const nomePorId = new Map(staffList.map((b) => [b.id, b.name]));

  return appointments
    .map((a) => ({ ...a, staffName: nomePorId.get(a.staffId) ?? BARBEIRO_DESCONHECIDO }))
    .sort(
      (a, b) =>
        a.startAt.getTime() - b.startAt.getTime() ||
        a.staffName.localeCompare(b.staffName, 'pt-BR') ||
        a.id.localeCompare(b.id),
    );
}

/**
 * Uma linha da lista: o cartão de um atendimento ou a faixa de um vão livre.
 *
 * As duas coisas moram na mesma `<ol>` e na mesma ordem de relógio — é isso que
 * faz a faixa cair entre os dois cartões que a criaram, e não num rodapé de
 * "horários livres" que ninguém relaciona com nada.
 *
 * `LinhaDaLista`, e não `LinhaDaAgenda`: desde 15/08/2026 esse nome é o do
 * componente de colunas do desktop, importado logo acima. TypeScript separa tipo
 * de valor e as duas coisas conviviam sem erro — mas quem lê `chaveDaLinha(linha:
 * LinhaDaAgenda)` num arquivo que renderiza `<LinhaDaAgenda>` lê a coisa errada.
 */
type LinhaDaLista =
  | { tipo: 'cartao'; instante: Date; item: AgendaItem }
  | { tipo: 'vao'; instante: Date; vao: VaoLivreAgrupado };

function intercalarVaos(itens: AgendaItem[], vaos: VaoLivreAgrupado[]): LinhaDaLista[] {
  const linhas: LinhaDaLista[] = [
    ...itens.map((item) => ({ tipo: 'cartao' as const, instante: item.startAt, item })),
    ...vaos.map((vao) => ({ tipo: 'vao' as const, instante: vao.inicio, vao })),
  ];

  // Empate de horário vai para o cartão: o que está marcado se lê antes do que
  // está vago. A ordenação é estável, então o desempate de `buildDayList` entre
  // dois cartões da mesma hora continua valendo.
  return linhas.sort(
    (a, b) =>
      a.instante.getTime() - b.instante.getTime() ||
      (a.tipo === b.tipo ? 0 : a.tipo === 'cartao' ? -1 : 1),
  );
}

/**
 * Chave estável da linha. O vão não tem id no banco, e o `fim` dele é o único
 * lado que não anda: o `inicio` do buraco em curso avança com o relógio, e
 * chavear por ele remontaria a faixa a cada cinco minutos.
 */
function chaveDaLinha(linha: LinhaDaLista): string {
  return linha.tipo === 'cartao'
    ? linha.item.id
    : `vao-${linha.vao.staffId}-${linha.vao.fim.getTime()}`;
}

/** Agrupa a lista já ordenada em blocos de uma hora, preservando a ordem. */
function agruparPorHora(linhas: LinhaDaLista[], timeZone: string) {
  const grupos: { hora: string; linhas: LinhaDaLista[] }[] = [];
  for (const linha of linhas) {
    const hora = formatTime(linha.instante, timeZone).slice(0, 2);
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.hora === hora) ultimo.linhas.push(linha);
    else grupos.push({ hora, linhas: [linha] });
  }
  return grupos;
}

/**
 * A linha só vale a linha quando os barbeiros **não** estão todos no mesmo
 * estado.
 *
 * "Marcão livre · Tiago livre" não é notícia: se todo mundo está livre, a
 * própria lista vazia já disse isso. Todo mundo ocupado também não escolhe nada
 * — o balcão vai ter que remarcar de qualquer jeito. O que faz a pergunta "quem
 * está livre agora?" valer uma linha é haver um sim e um não na mesma resposta.
 *
 * `horaISO` nulo é atendimento com data inválida: vira "—" na tela e não conta
 * para nenhum dos dois lados, porque um travessão não é resposta.
 */
function haDiferencaEntreBarbeiros(livres: ProximoLivre[], agora: Date): boolean {
  let temLivre = false;
  let temOcupado = false;

  for (const livre of livres) {
    if (livre.horaISO === null) continue;
    if (new Date(livre.horaISO).getTime() <= agora.getTime()) temLivre = true;
    else temOcupado = true;
    if (temLivre && temOcupado) return true;
  }

  return false;
}

/**
 * "Quem está livre agora?" numa linha (§5.7, item 3).
 *
 * É a resposta de balcão que compra o direito de adiar o quadro de colunas, e
 * sai dos mesmos `appointments` que a página já carregou — zero consulta nova.
 */
function LinhaDeProximosLivres({
  appointments,
  staffList,
  cores,
  agora,
  timeZone,
}: {
  appointments: AgendaAppointment[];
  staffList: AgendaStaff[];
  cores: Map<string, string>;
  agora: Date;
  timeZone: string;
}) {
  const livres = calcularProximosLivres(appointments, staffList, agora);
  if (!haDiferencaEntreBarbeiros(livres, agora)) return null;

  const nomes = new Map(staffList.map((b) => [b.id, b.name]));

  return (
    <p
      data-slot="proximos-livres"
      className="flex min-h-8 flex-wrap items-center gap-x-2 gap-y-1 text-[14px] leading-5"
    >
      {livres.map((livre, indice) => {
        const instante = livre.horaISO ? new Date(livre.horaISO) : null;
        const jaEstaLivre = instante !== null && instante.getTime() <= agora.getTime();
        return (
          <Fragment key={livre.staffId}>
            {indice > 0 ? <span aria-hidden="true" className="text-tinta-3">·</span> : null}
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="inline-block h-2 w-2"
                style={{ background: cores.get(livre.staffId) ?? 'var(--linha)' }}
              />
              <span className="font-bold">{nomes.get(livre.staffId)}</span>
              <span className="text-tinta-2">
                {instante === null ? '—' : jaEstaLivre ? 'livre' : formatTime(instante, timeZone)}
              </span>
            </span>
          </Fragment>
        );
      })}
    </p>
  );
}

/**
 * Piso do vão livre enquanto a página não passar o dela.
 *
 * O certo é o menor `durationMinutes` entre os serviços ativos — que
 * `agenda/page.tsx` já carrega em `listActiveServices` — porque faixa em buraco
 * onde não cabe ninguém é ruído com aparência de ação. Meia hora é o serviço
 * mais curto de barbearia na prática, e serve de piso conservador até lá.
 */
const DURACAO_MINIMA_PADRAO = 30;

export function DayGrid({
  appointments,
  staffList,
  timeZone,
  dataISO,
  hojeISO,
  agoraISO,
  duracaoMinima = DURACAO_MINIMA_PADRAO,
}: {
  appointments: AgendaAppointment[];
  staffList: AgendaStaff[];
  timeZone: string;
  /** Dia mostrado, `YYYY-MM-DD` no fuso da loja. */
  dataISO: string;
  /** Hoje no fuso da loja — decide a régua do agora e a linha de próximos livres. */
  hojeISO: string;
  /** Instante do servidor. Vira o relógio do cliente sem divergência de hidratação. */
  agoraISO: string;
  /** Menor serviço da loja, em minutos: o piso do que vira faixa de vão livre. */
  duracaoMinima?: number;
}) {
  // UM relógio para a lista inteira: cada cartão recebe `agora` por prop em vez
  // de abrir o seu próprio intervalo.
  const [agora, setAgora] = useState(() => new Date(agoraISO));
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const itens = useMemo(() => buildDayList(appointments, staffList), [appointments, staffList]);
  const cores = useMemo(() => coresDeBarbeiro(staffList), [staffList]);
  const nomes = useMemo(() => new Map(staffList.map((b) => [b.id, b.name])), [staffList]);

  // A lista sabe do modo para acender as faixas e trocar o verbo do rótulo
  // delas. Quem guarda o modo é o módulo de `remarcacao.tsx`, porque ele tem que
  // atravessar a troca de dia.
  const remarcacao = useRemarcacao();
  const remarcandoPara = remarcacao.customerName ?? undefined;

  // O caminho de volta: a lista é a única que sabe quanto dura o atendimento
  // escolhido, e o modo precisa disso para o piso das faixas. Roda uma vez, no
  // dia em que o "Remarcar" foi clicado — depois o número viaja com o modo.
  const remarcado = useMemo(
    () => itens.find((i) => i.id === remarcacao.appointmentId),
    [itens, remarcacao.appointmentId],
  );
  const { informarDuracao } = remarcacao;
  useEffect(() => {
    if (remarcado) informarDuracao(remarcado.id, duracaoEmMinutos(remarcado));
  }, [remarcado, informarDuracao]);

  // Vão de 30 min não é destino para um atendimento de uma hora: em modo
  // remarcação o piso é a duração **daquele** atendimento, e não o serviço mais
  // curto da loja. Oferecer o buraco pequeno seria oferecer um clique que a
  // constraint recusa.
  const piso = remarcacao.duracaoMinutos ?? duracaoMinima;

  // O buraco é do dia; o que dá para vender dele é do relógio. `recortarNoAgora`
  // resolve os três casos com uma regra: o dia de ontem some inteiro, a manhã de
  // hoje some, o buraco em curso encolhe até agora e o dia de amanhã fica.
  //
  // O agrupamento vem por último: é o recorte que alinha o início ao passo de
  // ±5, e dois buracos que começavam em horas diferentes só viram o mesmo
  // instante depois dele.
  const vaos = useMemo(
    () =>
      agruparVaosLivres(
        recortarNoAgora(buildVaosLivres(appointments, staffList, piso), agora, piso),
      ),
    [appointments, staffList, piso, agora],
  );

  const linhas = useMemo(() => intercalarVaos(itens, vaos), [itens, vaos]);
  const grupos = useMemo(() => agruparPorHora(linhas, timeZone), [linhas, timeZone]);

  const eHoje = dataISO === hojeISO;
  const regua = useRef<HTMLLIElement>(null);
  const jaAncorou = useRef(false);

  // Às 15h o barbeiro abria o app e caía nas 8h, com sete telas de rolagem até
  // o presente. A âncora roda uma vez, na montagem.
  useEffect(() => {
    if (!eHoje || jaAncorou.current) return;
    jaAncorou.current = true;
    regua.current?.scrollIntoView?.({ block: 'center' });
  }, [eHoje]);

  // O dia vazio é uma frase e a ação, no lugar da lista — sem ilustração e sem
  // a linha de próximos livres por cima. O Carbon classifica isto como *user
  // action empty state* e cobra equilíbrio: "more content doesn't necessarily
  // mean it's a better solution as there is a cognitive cost for having more
  // content on the page". "Marcão livre · Tiago livre" era o exemplo perfeito do
  // custo sem a notícia — se não há nada marcado, todo mundo está livre.
  //
  // O botão sai do texto e vira botão: "use o encaixe" mandava procurar a ação
  // em outro canto da tela, e a ação é a única coisa que se faz num dia vazio.
  // O aviso do modo entra também no dia vazio: navegar para um dia sem nada não
  // pode apagar da tela o único sinal de que a próxima faixa clicada remarca
  // alguém. Sem faixa aqui não há o que apontar, mas `Esc` e "Desistir"
  // continuam à mão.
  const modoDeRemarcacao = (
    <Remarcacao dataISO={dataISO} timeZone={timeZone} nomePorStaff={nomes} />
  );

  if (itens.length === 0) {
    return (
      <div data-slot="agenda-vazia" className="text-center">
        {modoDeRemarcacao}
        <Bloco
          acao={
            // `() => pedirEncaixe()` e não `pedirEncaixe`: o handler passaria o
            // evento de clique no lugar do pedido, e a folha abriria com um
            // `staffId` que não existe. Sem pedido ela escolhe o dia mostrado e
            // a hora de agora, que é o padrão do botão "Encaixe" da barra.
            <Botao type="button" onClick={() => pedirEncaixe()}>
              Encaixe
            </Botao>
          }
        >
          <p className="text-[16px] leading-6">Nenhum agendamento neste dia.</p>
        </Bloco>
      </div>
    );
  }

  // A régua entra antes da primeira **linha** que ainda não começou — cartão ou
  // faixa de vão livre. Olhar só os cartões deixava uma faixa das 10:30 acima da
  // linha do agora das 10:15, e a régua existe justamente para separar o que já
  // passou do que ainda vai acontecer. Se nada resta, ela fecha a lista.
  const proxima = eHoje ? linhas.find((l) => l.instante.getTime() > agora.getTime()) : undefined;
  const reguaNoFim = eHoje && proxima === undefined;

  const Regua = (
    <li ref={regua} aria-label="Agora" className="relative" style={{ border: 0, height: 2 }}>
      <span className="block h-0.5 w-full" style={{ background: 'var(--agora)' }} />
      <span
        aria-hidden="true"
        className="absolute top-[-3px] left-0 block h-2 w-2 rounded-full"
        style={{ background: 'var(--agora)' }}
      />
    </li>
  );

  return (
    <>
      {modoDeRemarcacao}

      {eHoje && staffList.length > 1 ? (
        <LinhaDeProximosLivres
          appointments={appointments}
          staffList={staffList}
          cores={cores}
          agora={agora}
          timeZone={timeZone}
        />
      ) : null}

      <ol className="lista">
        {grupos.map((grupo) => (
          <Fragment key={grupo.hora}>
            <li
              className="sticky top-16 z-[5] flex h-7 items-center px-3 text-[14px] leading-5 font-bold text-tinta-3"
              style={{ background: 'var(--superficie)' }}
            >
              {grupo.hora}h
            </li>
            {grupo.linhas.map((linha) => (
              <Fragment key={chaveDaLinha(linha)}>
                {proxima === linha ? Regua : null}
                {linha.tipo === 'vao' ? (
                  <FaixaDeVaoLivre
                    vao={linha.vao}
                    // Com um barbeiro só, repetir o nome dele em toda faixa não
                    // informa nada — só ocupa a linha.
                    nomeDoBarbeiro={staffList.length > 1 ? nomes.get(linha.vao.staffId) : undefined}
                    outrosBarbeiros={linha.vao.outros.map((o) => ({
                      nome: nomes.get(o.staffId) ?? BARBEIRO_DESCONHECIDO,
                      minutos: o.minutos,
                    }))}
                    timeZone={timeZone}
                    remarcandoPara={remarcandoPara}
                  />
                ) : (
                  // Os dois no DOM, trocados por CSS. Condicional de JS por
                  // largura não serve: o servidor não sabe a largura da janela, e
                  // decidir num `useEffect` faria a lista inteira piscar na
                  // primeira pintura. `display:none` **aqui** é o certo, ao
                  // contrário das ações recolhidas: é layout alternativo, não
                  // ação escondida — o leitor de tela lê um dos dois, nunca os
                  // dois, e nenhum caminho se perde.
                  <>
                    <CartaoDaAgenda
                      item={linha.item}
                      timeZone={timeZone}
                      corDoBarbeiro={cores.get(linha.item.staffId) ?? 'var(--linha)'}
                      agora={agora}
                      className="md:hidden"
                    />
                    <LinhaDaAgenda
                      item={linha.item}
                      timeZone={timeZone}
                      corDoBarbeiro={cores.get(linha.item.staffId) ?? 'var(--linha)'}
                      agora={agora}
                      className="hidden md:block"
                    />
                  </>
                )}
              </Fragment>
            ))}
          </Fragment>
        ))}
        {reguaNoFim ? Regua : null}
      </ol>
    </>
  );
}
