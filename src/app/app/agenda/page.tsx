import { DateTime } from 'luxon';
import { requireSession } from '@/lib/session';
import { db } from '@/db/client';
import { findBarbershopById, listActiveStaff, listActiveServices, listAppointmentsBetween } from '@/db/repositories';
import { CabecalhoDePagina } from '@/components/ui/cabecalho-de-pagina';
import { Largura } from '@/components/ui/largura';
import { BarraDeData } from './barra-de-data';
import { DayGrid } from './day-grid';
import { ManualBookingForm } from './manual-booking-form';

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ data?: string }>;
}) {
  const { data } = await searchParams;
  const sessao = await requireSession();

  const loja = await findBarbershopById(db, sessao.barbershopId);
  const timeZone = loja?.timeZone ?? 'America/Sao_Paulo';

  const agora = DateTime.now().setZone(timeZone);
  const dia = data && DateTime.fromISO(data, { zone: timeZone }).isValid
    ? DateTime.fromISO(data, { zone: timeZone })
    : agora.startOf('day');

  const inicio = dia.startOf('day').toJSDate();
  const fim = dia.plus({ days: 1 }).startOf('day').toJSDate();

  const [staffList, servicos, appointments] = await Promise.all([
    listActiveStaff(db, sessao.barbershopId),
    listActiveServices(db, sessao.barbershopId),
    listAppointmentsBetween(db, sessao.barbershopId, inicio, fim),
  ]);

  const dataISO = dia.toISODate()!;
  const hojeISO = agora.toISODate()!;

  // "8 no dia" não conta cancelado: o horário voltou para a grade e não é mais
  // trabalho do dia. "A atender" é só o que ainda está agendado.
  const contagens = {
    total: appointments.filter((a) => a.status !== 'CANCELED').length,
    aAtender: appointments.filter((a) => a.status === 'BOOKED').length,
  };

  // O piso do vão livre é o serviço mais curto que a loja de fato vende. Sem
  // isto o `DayGrid` cai no padrão de 30 minutos, e a faixa mente nos dois
  // sentidos: some um buraco de 20 numa loja que faz pezinho em 15, e oferece
  // um buraco de 30 numa loja cujo corte mais rápido leva 45.
  const duracaoMinima = servicos.length
    ? Math.min(...servicos.map((s) => s.durationMinutes))
    : undefined;

  return (
    // pb-16 reserva o rodapé para a barra fixa do celular; no desktop ela não existe
    <div className="pb-16 md:pb-0">
      {/* Esta era a única tela do painel sem título à vista, e no desktop isso
          fazia a agenda parecer de outro produto: as cinco irmãs abrem com o
          mesmo `<CabecalhoDePagina>` e esta abria direto na barra de data.

          No celular ele continua escondido — a primeira dobra é do balcão, e
          40px de cabeçalho custam meia linha da lista —, mas agora por `md:` e
          não por `sr-only` sempre. `sr-only md:not-sr-only` esconde só o olho: o
          `<h1>` continua na árvore de acessibilidade nas duas larguras, e no
          celular ele nem é item do fluxo (o `sr-only` o tira com
          `position: absolute`), então não sobra buraco nenhum acima da barra.

          O `mb-0` desliga a margem que o componente traz para o espaço vir do
          `md:mb-3` daqui: a margem própria dele só valeria no desktop, e no
          celular seria folga de um bloco invisível. */}
      <Largura tipo="tabela" className="md:mb-3">
        <CabecalhoDePagina
          titulo="Agenda"
          descricao="Quem vem, a que horas e com quem."
          className="mb-0 sr-only md:not-sr-only"
        />
      </Largura>

      {/* O encaixe entra pela `acao` da barra em vez de virar um bloco próprio
          logo abaixo dela: no desktop é a primeira ação da tela e agora divide a
          linha com a navegação de dia. A barra não sabe que é encaixe — ela só
          reserva o lugar à direita. No celular nada disso aparece: o que o
          `ManualBookingForm` mostra é a barra fixa do rodapé, que é
          `position: fixed` e não liga para onde está no documento. */}
      <BarraDeData
        dataISO={dataISO}
        hojeISO={hojeISO}
        contagens={contagens}
        acao={
          loja ? (
            <ManualBookingForm
              slug={loja.slug}
              services={servicos}
              staffList={staffList}
              defaultDate={dataISO}
              hojeISO={hojeISO}
              timeZone={timeZone}
            />
          ) : null
        }
      />

      {/* `tabela`, o mesmo degrau de Serviços, Equipe e Clientes (§3.7): a
          agenda é lista com ação, igual a elas, e era a única do painel em
          `leitura` — lado a lado na navegação ela pulava 240px para fora do
          alinhamento das irmãs. O cartão não fica apertado em 880: ele é
          `[64px_1fr]` com uma linha de ação de `1fr 1fr 44px`, e nessa largura
          cada botão ainda sai com ~400px.

          A barra de data segue este mesmo teto por dentro — esqueleto, barra e
          lista num degrau só, senão o degrau só mudaria de lugar. */}
      <Largura tipo="tabela">
        <DayGrid
          appointments={appointments}
          staffList={staffList}
          timeZone={timeZone}
          dataISO={dataISO}
          hojeISO={hojeISO}
          agoraISO={agora.toJSDate().toISOString()}
          duracaoMinima={duracaoMinima}
        />
      </Largura>
    </div>
  );
}
