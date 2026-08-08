'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Bloco } from '@/components/ui/bloco';
import { coresDeBarbeiro } from '@/lib/cores-de-barbeiro';
import { formatTime, type AppointmentStatus } from '@/lib/format';
import { CartaoDaAgenda } from './cartao-da-agenda';
import { calcularProximosLivres } from './proximos-livres';

export type AgendaAppointment = {
  id: string;
  staffId: string;
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

/** Agrupa a lista já ordenada em blocos de uma hora, preservando a ordem. */
function agruparPorHora(itens: AgendaItem[], timeZone: string) {
  const grupos: { hora: string; itens: AgendaItem[] }[] = [];
  for (const item of itens) {
    const hora = formatTime(item.startAt, timeZone).slice(0, 2);
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.hora === hora) ultimo.itens.push(item);
    else grupos.push({ hora, itens: [item] });
  }
  return grupos;
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
  const nomes = new Map(staffList.map((b) => [b.id, b.name]));

  return (
    <p className="flex min-h-8 flex-wrap items-center gap-x-2 gap-y-1 text-[14px] leading-5">
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

export function DayGrid({
  appointments,
  staffList,
  timeZone,
  dataISO,
  hojeISO,
  agoraISO,
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
  const grupos = useMemo(() => agruparPorHora(itens, timeZone), [itens, timeZone]);

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

  if (itens.length === 0) {
    return (
      <>
        {eHoje && staffList.length > 1 ? (
          <LinhaDeProximosLivres
            appointments={appointments}
            staffList={staffList}
            cores={cores}
            agora={agora}
            timeZone={timeZone}
          />
        ) : null}
        <div className="text-center">
          <Bloco>
            <p className="text-[16px] leading-6">Nenhum agendamento neste dia.</p>
            <p className="text-[14px] leading-5 text-tinta-2">
              Use o encaixe para marcar quem chegou no balcão.
            </p>
          </Bloco>
        </div>
      </>
    );
  }

  // A régua entra antes do primeiro atendimento que ainda não começou; se todos
  // já passaram, ela fecha a lista.
  const proximo = eHoje ? itens.find((i) => i.startAt.getTime() > agora.getTime()) : undefined;
  const reguaNoFim = eHoje && proximo === undefined;

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
            {grupo.itens.map((item) => (
              <Fragment key={item.id}>
                {proximo?.id === item.id ? Regua : null}
                <CartaoDaAgenda
                  item={item}
                  timeZone={timeZone}
                  corDoBarbeiro={cores.get(item.staffId) ?? 'var(--linha)'}
                  agora={agora}
                />
              </Fragment>
            ))}
          </Fragment>
        ))}
        {reguaNoFim ? Regua : null}
      </ol>
    </>
  );
}
