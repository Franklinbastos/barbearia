'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatDayLabelLong, formatDayParts, isoDateInZone } from '@/lib/format';
import { carregarHorarios } from '@/components/availability';
import { Botao } from '@/components/ui/botao';
import { Bloco } from '@/components/ui/bloco';
import { Card, CardContent } from '@/components/ui/card';
import { TiraDeDias, type DiaDaTira } from '@/components/ui/tira-de-dias';
import { GradeDeHorarios, type EscolhaDeHorario } from '@/components/ui/grade-de-horarios';
import type { AvailabilitySlot } from '../types';

/** Dias que cabem na grade 7×2 sem rolagem. Acima disso existe "Outro dia". */
const DIAS_NA_TIRA = 14;

const UM_DIA = 86_400_000;

/** Meio-dia UTC como âncora: somar 24h nunca pula nem repete um dia civil. */
function somarDias(isoDate: string, dias: number): string {
  return new Date(new Date(`${isoDate}T12:00:00Z`).getTime() + dias * UM_DIA)
    .toISOString()
    .slice(0, 10);
}

/**
 * Quais dias da tira têm vaga, numa consulta só.
 *
 * Falha em silêncio de propósito: a tira é enfeite informativo, e a grade do
 * dia continua sendo a fonte da verdade. Um 429 aqui não pode virar bloco
 * vermelho sobre uma tela que está funcionando.
 */
async function carregarDiasComVaga(
  consulta: { slug: string; serviceId: string; staffId?: string; from: string; to: string },
  signal: AbortSignal,
): Promise<Map<string, boolean> | null> {
  const params = new URLSearchParams({
    serviceId: consulta.serviceId,
    from: consulta.from,
    to: consulta.to,
  });
  if (consulta.staffId) params.set('staffId', consulta.staffId);

  try {
    const res = await fetch(
      `/api/public/${encodeURIComponent(consulta.slug)}/availability/days?${params}`,
      { signal },
    );
    if (signal.aborted || !res.ok) return null;

    const corpo: unknown = await res.json();
    const lista = (corpo as { days?: unknown })?.days;
    if (!Array.isArray(lista)) return null;

    const mapa = new Map<string, boolean>();
    for (const item of lista as { date?: unknown; hasSlots?: unknown }[]) {
      if (typeof item?.date === 'string') mapa.set(item.date, item.hasSlots === true);
    }
    return mapa;
  } catch {
    return null;
  }
}

function montarDias(hojeIso: string, timeZone: string, maxAdvanceDays: number): DiaDaTira[] {
  // `maxAdvanceDays` é a distância do último dia aceito, então hoje + N são
  // N+1 fichas — a mesma conta de `bookingWindowLimit`.
  const quantidade = Math.max(1, Math.min(DIAS_NA_TIRA, maxAdvanceDays + 1));

  return Array.from({ length: quantidade }, (_, i) => {
    const iso = somarDias(hojeIso, i);
    const { diaSemana, dia } = formatDayParts(iso, timeZone);
    return {
      iso,
      rotulo: i === 0 ? 'HOJE' : i === 1 ? 'AMANHÃ' : diaSemana,
      numero: dia,
      // Enquanto a resposta de `/days` não chega, ninguém finge saber.
      situacao: 'desconhecido' as const,
    };
  });
}

/**
 * Etapa 3: dia e horário (§5.4 da direção de UI).
 *
 * O dia **não** mora aqui: é prop controlada pelo `BookingWizard`. Este passo é
 * desmontado quando o cliente vai digitar o contato, e com o dia no estado
 * local quem escolhia sexta voltava do 409 olhando a grade de hoje.
 */
export function SlotStep({
  slug,
  serviceId,
  staffId,
  timeZone,
  maxAdvanceDays,
  dia,
  aoTrocarDia,
  telefoneDaLoja,
  onSelect,
  onVoltar,
}: {
  slug: string;
  serviceId: string;
  staffId?: string;
  timeZone: string;
  maxAdvanceDays: number;
  dia: string;
  aoTrocarDia: (iso: string) => void;
  telefoneDaLoja: string | null;
  onSelect: (escolha: EscolhaDeHorario) => void;
  onVoltar: () => void;
}) {
  const hojeIso = useMemo(() => isoDateInZone(new Date(), timeZone), [timeZone]);
  const dias = useMemo(
    () => montarDias(hojeIso, timeZone, maxAdvanceDays),
    [hojeIso, timeZone, maxAdvanceDays],
  );
  const maxIso = somarDias(hojeIso, maxAdvanceDays);

  const [vagasPorDia, setVagasPorDia] = useState<Map<string, boolean> | null>(null);
  const [slots, setSlots] = useState<AvailabilitySlot[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    const controlador = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSlots(null);
    setErro(null);

    // A resposta de um dia que o usuário já abandonou é descartada dentro de
    // `carregarHorarios` — ver o AbortSignal.
    void carregarHorarios(
      { slug, serviceId, staffId, date: dia },
      controlador.signal,
      { aoReceber: setSlots, aoFalhar: setErro },
    );

    return () => controlador.abort();
  }, [slug, dia, serviceId, staffId, tentativa]);

  // A tira inteira numa consulta só, e **não** por dia: o dia trocado não
  // dispara nada aqui. Só serviço e barbeiro mudam quais dias têm vaga.
  useEffect(() => {
    const controlador = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVagasPorDia(null);

    void carregarDiasComVaga(
      { slug, serviceId, staffId, from: dias[0].iso, to: dias[dias.length - 1].iso },
      controlador.signal,
    ).then((mapa) => {
      if (mapa && !controlador.signal.aborted) setVagasPorDia(mapa);
    });

    return () => controlador.abort();
  }, [slug, serviceId, staffId, dias]);

  const diasDaTira = useMemo(
    () =>
      dias.map((d) => ({
        ...d,
        // Dia fora da resposta (além do teto da rota) continua "desconhecido":
        // ausência não é o mesmo que "cheio".
        situacao: !vagasPorDia?.has(d.iso)
          ? ('desconhecido' as const)
          : vagasPorDia.get(d.iso)
            ? ('livre' as const)
            : ('cheio' as const),
      })),
    [dias, vagasPorDia],
  );

  // O "próximo dia com vaga" sai da resposta que já está na mão — nenhuma ida
  // nova ao servidor. É a diferença entre uma pergunta e catorze toques.
  const proximoComVaga = useMemo(
    () => diasDaTira.find((d) => d.iso > dia && d.situacao === 'livre')?.iso ?? null,
    [diasDaTira, dia],
  );

  const telefoneSoDigitos = telefoneDaLoja ? telefoneDaLoja.replace(/\D/g, '') : '';
  const proximoDia = somarDias(dia, 1);
  const dentroDaJanela = proximoDia <= maxIso;

  return (
    <section>
      <Botao variante="texto" onClick={onVoltar}>
        <span aria-hidden="true">←</span> Voltar
      </Botao>

      <h2 className="mt-4 mb-3 text-[22px] leading-7 font-bold">
        <span aria-hidden="true" className="mb-2 block h-[3px] w-8 bg-marca" />
        Escolha o horário
      </h2>

      <TiraDeDias dias={diasDaTira} selecionado={dia} aoSelecionar={aoTrocarDia} maxIso={maxIso} />

      {/* O dia por extenso existe porque a ficha da tira mostra só o número: com
          "Outro dia" o cliente pode estar num mês que a tira nem desenha. */}
      <p className="mt-1 mb-3 text-sm leading-5 text-tinta-2">
        {formatDayLabelLong(dia, timeZone)}
      </p>

      {slots === null && !erro ? (
        <div>
          <div className="barra-busca" />
          <p role="status" className="mt-2 text-sm leading-5 text-tinta-2">
            Carregando horários…
          </p>
          {/* Esqueletos na medida final da ficha, para nada saltar quando a
              resposta chega. */}
          <ul aria-hidden="true" className="mt-2 grid grid-cols-3 gap-2 md:grid-cols-4">
            {Array.from({ length: 6 }, (_, i) => (
              <li key={i} className="esqueleto h-16" />
            ))}
          </ul>
        </div>
      ) : null}

      {erro ? (
        <Bloco
          tom="perigo"
          papel="alert"
          acao={
            <Botao variante="secundario" onClick={() => setTentativa((n) => n + 1)}>
              Tentar de novo
            </Botao>
          }
        >
          {erro}
        </Bloco>
      ) : null}

      {slots && slots.length === 0 ? (
        <Bloco
          acao={
            <div className="flex flex-col items-stretch gap-2">
              {/* "não quero amanhã, quero sexta" — o jurado-cliente. Primeiro
                  da pilha porque é a resposta que ele veio buscar. */}
              {proximoComVaga ? (
                <Botao largura="total" onClick={() => aoTrocarDia(proximoComVaga)}>
                  Ver o próximo dia com vaga
                </Botao>
              ) : null}
              {dentroDaJanela ? (
                <Botao variante="secundario" largura="total" onClick={() => aoTrocarDia(proximoDia)}>
                  {dia === hojeIso ? 'Ir para amanhã' : 'Ir para o dia seguinte'}
                </Botao>
              ) : null}
              {telefoneSoDigitos ? (
                <a
                  className="btn btn--sec btn--tot"
                  href={`https://wa.me/55${telefoneSoDigitos}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Falar no WhatsApp
                </a>
              ) : null}
            </div>
          }
        >
          Nenhum horário livre neste dia.
        </Bloco>
      ) : null}

      {slots && slots.length > 0 ? (
        // Os grupos de horário viram uma caixa de conteúdo só. `size="sm"` põe o
        // recheio em 12px em vez de 16: em 360px a diferença é a ficha de
        // horário ficar com 96px em vez de 93, e é ela que carrega o número.
        <Card size="sm" className="mt-1">
          <CardContent>
            <GradeDeHorarios
              slots={slots}
              timeZone={timeZone}
              barbeiroEscolhido={Boolean(staffId)}
              aoEscolher={onSelect}
            />
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}
