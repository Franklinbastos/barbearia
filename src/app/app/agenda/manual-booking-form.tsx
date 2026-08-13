'use client';

import { CalendarDays } from 'lucide-react';
import { ptBR } from 'react-day-picker/locale';
import { useActionState, useEffect, useMemo, useState } from 'react';
import { carregarHorarios, type HorarioDisponivel } from '@/components/availability';
import { ErroDeAcao } from '@/components/erro-de-acao';
import { Bloco } from '@/components/ui/bloco';
import { Botao } from '@/components/ui/botao';
import { Calendar } from '@/components/ui/calendar';
import { Campo } from '@/components/ui/campo';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { EsqueletoDeLinha } from '@/components/ui/esqueleto-de-linha';
import { FichasDeEscolha, type FichaDeEscolha } from '@/components/ui/fichas-de-escolha';
import { FolhaInferior } from '@/components/ui/folha-inferior';
import { Segmentado } from '@/components/ui/segmentado';
import { coresDeBarbeiro } from '@/lib/cores-de-barbeiro';
import { dataParaISO, isoParaData } from '@/lib/data-local';
import { formatDayLabelLong, formatDuration, formatTime } from '@/lib/format';
import { aplicarMascaraTelefone } from '@/lib/telefone';
import { createManualAppointmentAction, type ManualBookingState } from './actions';
import { avisoDeHorarioLivre, deslocarHora, horaDeAgoraArredondada } from './encaixe';

/**
 * Encaixe / walk-in (§5.8).
 *
 * Era um formulário de oito controles em `flexWrap` pendurado no fim da agenda.
 * Virou a folha inferior aberta pela barra fixa "Encaixe", com dois modos: o
 * cara já está na cadeira, ou alguém ligou. São dois trabalhos diferentes, e
 * atender os dois pelo mesmo formulário é o que fazia o formulário ter oito
 * campos.
 *
 * A server action não mudou de forma: as fichas carregam `staffId` e
 * `serviceId` em `<input type="hidden">`, e a semântica de `startAt` da grade
 * contra `horaLivre` digitado continua sendo resolvida por
 * `resolverInicioDoEncaixe`.
 */

const ESTADO_INICIAL: ManualBookingState = {};
const ID_DO_FORMULARIO = 'formulario-de-encaixe';

/** Ficha que manda `staffId=""` — o servidor desempata por carga do dia. */
const PRIMEIRO_QUE_VAGAR = '';

type Servico = { id: string; name: string; durationMinutes?: number };
type Barbeiro = { id: string; name: string };

type Modo = 'agora' | 'marcar';

const MODOS: { valor: Modo; rotulo: string }[] = [
  { valor: 'agora', rotulo: 'Agora' },
  { valor: 'marcar', rotulo: 'Marcar hora' },
];

export function ManualBookingForm({
  slug,
  services,
  staffList,
  defaultDate,
  timeZone,
}: {
  slug: string;
  services: Servico[];
  staffList: Barbeiro[];
  defaultDate: string;
  timeZone: string;
}) {
  const [state, formAction, pending] = useActionState(createManualAppointmentAction, ESTADO_INICIAL);

  const [aberta, setAberta] = useState(false);
  const [modo, setModo] = useState<Modo>('agora');
  const [serviceId, setServiceId] = useState('');
  const [staffId, setStaffId] = useState(PRIMEIRO_QUE_VAGAR);
  const [date, setDate] = useState(defaultDate);
  const [slots, setSlots] = useState<HorarioDisponivel[]>([]);
  const [carregandoGrade, setCarregandoGrade] = useState(false);
  const [startAt, setStartAt] = useState('');
  // No modo "Marcar hora" o atendente ainda pode sair da grade de propósito —
  // o encaixe continua sendo escolha consciente, só que rotulada.
  const [foraDaGrade, setForaDaGrade] = useState(false);
  const [horaLivre, setHoraLivre] = useState('');
  const [erroGrade, setErroGrade] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [agendou, setAgendou] = useState(false);
  const [calendarioAberto, setCalendarioAberto] = useState(false);

  const cores = useMemo(() => coresDeBarbeiro(staffList), [staffList]);

  // A grade é a mesma consulta de sempre; com "Primeiro que vagar" ela vem sem
  // `staffId` e traz um horário por barbeiro, exatamente como na pública.
  useEffect(() => {
    if (!aberta || !serviceId || !date) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSlots([]);
      setErroGrade(null);
      return;
    }

    const controlador = new AbortController();
    setErroGrade(null);
    setCarregandoGrade(true);

    void carregarHorarios(
      // origem PANEL: o balcão precisa enxergar horário fora da janela de
      // maxAdvanceDays, que só vale para o cliente marcando sozinho.
      { slug, serviceId, staffId: staffId || undefined, date, origem: 'PANEL' },
      controlador.signal,
      {
        aoReceber: (recebidos) => {
          setSlots(recebidos);
          setCarregandoGrade(false);
        },
        aoFalhar: (mensagem) => {
          setSlots([]);
          setErroGrade(mensagem);
          setCarregandoGrade(false);
        },
      },
    );

    return () => controlador.abort();
  }, [aberta, slug, serviceId, staffId, date, recarga]);

  // Sucesso fecha a folha e zera o balcão para o próximo. Falha **não** fecha:
  // refazer quatro campos porque o horário foi tomado é o momento em que o
  // atendente fecha o app e volta para o caderno. Só a pastilha tomada sai, e a
  // grade recarrega sozinha.
  useEffect(() => {
    if (state.ok) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAberta(false);
      setAgendou(true);
      setServiceId('');
      setStaffId(PRIMEIRO_QUE_VAGAR);
      setStartAt('');
      setHoraLivre('');
      setName('');
      setPhone('');
      setRecarga((n) => n + 1);
      return;
    }
    if (state.erro) {
      setStartAt('');
      setRecarga((n) => n + 1);
    }
  }, [state]);

  function abrir() {
    setModo('agora');
    setForaDaGrade(false);
    setDate(defaultDate);
    setHoraLivre(horaDeAgoraArredondada(new Date(), timeZone));
    setAberta(true);
  }

  function trocarModo(novo: Modo) {
    setModo(novo);
    setStartAt('');
    setForaDaGrade(false);
    setHoraLivre(novo === 'agora' ? horaDeAgoraArredondada(new Date(), timeZone) : '');
  }

  const fichasDeBarbeiro: FichaDeEscolha[] = [
    { valor: PRIMEIRO_QUE_VAGAR, rotulo: 'Primeiro que vagar' },
    ...staffList.map((b) => ({ valor: b.id, rotulo: b.name, cor: cores.get(b.id) })),
  ];

  const fichasDeServico: FichaDeEscolha[] = services.map((s) => ({
    valor: s.id,
    rotulo: s.name,
    detalhe: s.durationMinutes ? formatDuration(s.durationMinutes) : undefined,
  }));

  // Com "Primeiro que vagar" a grade traz um horário por barbeiro: o balcão
  // escolhe a hora, não a pessoa.
  const horariosUnicos = useMemo(() => {
    const vistos = new Set<string>();
    return slots.filter((s) => (vistos.has(s.startAt) ? false : (vistos.add(s.startAt), true)));
  }, [slots]);

  // O aviso de fora-da-grade só aparece depois de escolher a hora, nunca antes.
  const horaParaAvisar = modo === 'agora' || foraDaGrade ? horaLivre : '';
  const aviso = avisoDeHorarioLivre(horaParaAvisar, slots, timeZone);

  const temAlgoDigitado =
    name.trim() !== '' || phone.trim() !== '' || serviceId !== '' || startAt !== '';

  return (
    <>
      {/* A barra fixa é do balcão: polegar no rodapé, tela pequena, cliente em
          pé na frente. No desktop ela atravessava a largura inteira por baixo da
          sidebar e ficava órfã — a ação passa a morar no topo, que é onde o
          shadcn põe ação de página. O rodapé é reservado pelo `pb-16` do
          container em `agenda/page.tsx`, porque este componente agora vem antes
          da lista. */}
      <div
        className="fixed inset-x-0 bottom-0 z-30 bg-bg px-3 py-1.5 md:hidden"
        style={{
          boxShadow: 'var(--sombra-barra)',
          paddingBottom: 'calc(6px + env(safe-area-inset-bottom))',
        }}
      >
        <Botao largura="total" onClick={abrir}>
          Encaixe
        </Botao>
      </div>

      <div className="mb-3 hidden md:flex md:justify-end">
        <Botao onClick={abrir}>Encaixe</Botao>
      </div>

      {/* Permanente e fora da folha: o leitor de tela precisa ouvir a
          confirmação mesmo depois de a folha fechar. */}
      <p role="status" className="sr-only">
        {agendou ? 'Encaixe agendado.' : ''}
      </p>

      <FolhaInferior
        aberta={aberta}
        titulo="Encaixe"
        aoFechar={() => setAberta(false)}
        guardaDeDescarte={temAlgoDigitado}
        rodape={
          <div className="flex flex-col gap-3">
            {state.erro ? (
              <Bloco tom="perigo" papel="alert" compacto>
                {state.erro}
              </Bloco>
            ) : null}
            <Botao
              type="submit"
              form={ID_DO_FORMULARIO}
              tamanho="lg"
              largura="total"
              pendente={pending}
              rotuloPendente="Agendando…"
            >
              Agendar
            </Botao>
          </div>
        }
      >
        <form id={ID_DO_FORMULARIO} action={formAction} className="flex flex-col gap-4">
          <Segmentado
            rotuloDoGrupo="Quando é o atendimento"
            opcoes={MODOS}
            valor={modo}
            aoTrocar={trocarModo}
          />

          <div className="flex flex-col gap-2">
            <span className="text-[14px] leading-5 font-bold text-tinta-2">Barbeiro</span>
            <FichasDeEscolha
              rotuloDoGrupo="Barbeiro"
              opcoes={fichasDeBarbeiro}
              valor={staffId}
              aoTrocar={setStaffId}
              nomeDoCampoOculto="staffId"
            />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[14px] leading-5 font-bold text-tinta-2">Serviço</span>
            <FichasDeEscolha
              rotuloDoGrupo="Serviço"
              opcoes={fichasDeServico}
              valor={serviceId}
              aoTrocar={setServiceId}
              nomeDoCampoOculto="serviceId"
            />
          </div>

          {/* O dia dá sentido à hora digitada, e por isso vai junto no envio
              mesmo quando não aparece na tela. */}
          {modo === 'agora' ? (
            <input type="hidden" name="date" value={date} />
          ) : (
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Data</span>
              {/* O dia continua indo como campo escondido: o Calendar não é um
                  controle de formulário e a server action espera `date`. */}
              <input type="hidden" name="date" value={date} />
              <Popover open={calendarioAberto} onOpenChange={setCalendarioAberto}>
                <PopoverTrigger
                  render={
                    <Botao variante="secundario" largura="total" type="button">
                      <CalendarDays aria-hidden="true" className="size-4" />
                      {formatDayLabelLong(date, timeZone)}
                    </Botao>
                  }
                />
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    locale={ptBR}
                    selected={isoParaData(date)}
                    defaultMonth={isoParaData(date)}
                    onSelect={(escolhido) => {
                      if (!escolhido) return;
                      setDate(dataParaISO(escolhido));
                      setCalendarioAberto(false);
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <span className="text-[14px] leading-5 font-bold text-tinta-2">Horário</span>

            {modo === 'agora' ? (
              <div className="grid grid-cols-[48px_1fr_48px] items-center gap-2">
                <Botao
                  variante="secundario"
                  aria-label="Cinco minutos antes"
                  className="min-h-12 px-0"
                  onClick={() => setHoraLivre((h) => deslocarHora(h, -5))}
                >
                  −5
                </Botao>
                <output
                  className="flex items-center justify-center text-[22px] leading-7 font-bold"
                  style={{
                    minHeight: 'var(--tap-md)',
                    border: '1px solid var(--linha)',
                    borderRadius: 'var(--r)',
                  }}
                >
                  {horaLivre}
                </output>
                <Botao
                  variante="secundario"
                  aria-label="Cinco minutos depois"
                  className="min-h-12 px-0"
                  onClick={() => setHoraLivre((h) => deslocarHora(h, 5))}
                >
                  +5
                </Botao>
                <input type="hidden" name="horaLivre" value={horaLivre} />
              </div>
            ) : (
              <>
                <Botao
                  variante="secundario"
                  largura="total"
                  aria-pressed={foraDaGrade}
                  onClick={() => {
                    setForaDaGrade((ligado) => !ligado);
                    setStartAt('');
                    setHoraLivre('');
                  }}
                >
                  Fora da grade
                </Botao>

                {foraDaGrade ? (
                  <Campo rotulo="Horário do encaixe">
                    <input
                      type="time"
                      name="horaLivre"
                      step={300}
                      value={horaLivre}
                      onChange={(e) => setHoraLivre(e.target.value)}
                      required
                    />
                  </Campo>
                ) : carregandoGrade ? (
                  <>
                    <div className="barra-busca" />
                    <EsqueletoDeLinha altura={56} quantidade={6} />
                  </>
                ) : erroGrade ? (
                  <Bloco
                    tom="perigo"
                    papel="alert"
                    acao={
                      <Botao variante="secundario" onClick={() => setRecarga((n) => n + 1)}>
                        Tentar de novo
                      </Botao>
                    }
                  >
                    {erroGrade}
                  </Bloco>
                ) : horariosUnicos.length === 0 ? (
                  <Bloco
                    acao={
                      <Botao variante="secundario" onClick={() => trocarModo('agora')}>
                        Encaixar agora
                      </Botao>
                    }
                  >
                    Nenhum horário livre neste dia.
                  </Bloco>
                ) : (
                  <div role="group" aria-label="Horários livres" className="grid grid-cols-3 gap-2">
                    {horariosUnicos.map((s) => {
                      const ativo = s.startAt === startAt;
                      return (
                        <button
                          key={s.startAt}
                          type="button"
                          aria-pressed={ativo}
                          onClick={() => setStartAt(s.startAt)}
                          className="flex items-center justify-center text-[16px] leading-6"
                          style={{
                            minHeight: 'var(--tap-lg)',
                            borderRadius: 'var(--r)',
                            background: ativo ? 'var(--superficie-2)' : 'transparent',
                            border: ativo ? '2px solid var(--tinta)' : '1px solid var(--linha)',
                            fontWeight: ativo ? 700 : 400,
                          }}
                        >
                          {formatTime(s.startAt, timeZone)}
                        </button>
                      );
                    })}
                    <input type="hidden" name="startAt" value={startAt} />
                  </div>
                )}
              </>
            )}

            {aviso ? (
              <Bloco tom="alerta" papel="status" compacto>
                {aviso}
              </Bloco>
            ) : null}
          </div>

          {/* Cliente por último, de propósito: trava-se a cadeira primeiro, e o
              nome o cliente soletra enquanto o atendente digita. */}
          <Campo rotulo="Nome">
            <input
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
              autoComplete="name"
            />
          </Campo>

          <Campo rotulo="Telefone">
            <input
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(aplicarMascaraTelefone(e.target.value))}
              required
              placeholder="(00) 00000-0000"
            />
          </Campo>

          <ErroDeAcao mensagem={erroGrade && modo === 'agora' ? erroGrade : null} />
        </form>
      </FolhaInferior>
    </>
  );
}
