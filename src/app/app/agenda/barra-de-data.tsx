'use client';

import { format } from 'date-fns';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ptBR } from 'react-day-picker/locale';
import { useState } from 'react';

import { Button, buttonVariants } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { dataParaISO, isoParaData } from '@/lib/data-local';
import { cn } from '@/lib/utils';

/**
 * A barra de data da agenda (§5.7, item 2).
 *
 * Fica grudada no topo porque a lista é longa e "que dia é este?" é a pergunta
 * que se faz no meio da rolagem. As setas são `<Link>` do Next e não `<a href>`
 * cru: na tela mais aberta do produto, recarregar o documento inteiro para
 * andar um dia muda a sensação de velocidade. Elas continuam sendo links de
 * verdade — só vestem o `buttonVariants` da lib em vez do contorno à mão.
 *
 * A legenda de contagem substitui a faixa de quatro blocos de resumo: 64px da
 * primeira dobra para um filtro que ninguém usa com cliente esperando é enfeite
 * que custa rolagem. E nunca diz "HOJE" — a barra navega para qualquer dia, e o
 * rótulo mentiria.
 *
 * **O seletor do meio.** Era `<input type="date">` mais um botão "Ir"; desde
 * 13/08/2026 é `Popover` + `Calendar` do shadcn, e escolher o dia já navega —
 * o "Ir" some porque não há mais um valor pendente de submeter.
 *
 * **Fuso.** O dia da agenda anda pelo mundo como `YYYY-MM-DD` *já no fuso da
 * barbearia* (o `page.tsx` o produz com Luxon). O `Calendar` fala `Date` do
 * navegador, então a única regra aqui é **não converter**: `isoParaData` monta
 * um `Date` local com aquele ano/mês/dia, e `dataParaISO` lê de volta pelos
 * getters locais. Nenhum dos dois passa por UTC, então a ida e a volta são
 * exatas em qualquer fuso de navegador — inclusive quando ele não é o da loja.
 *
 * O que **não** se pode fazer aqui, e é o erro que este comentário existe para
 * evitar: `new Date('2026-08-13')` (o padrão lê como meia-noite UTC, e em
 * São Paulo isso é dia 12) e `data.toISOString().slice(0, 10)` (que devolve o
 * dia em UTC, e às 21h em São Paulo já é o dia seguinte) — o mesmo erro que o
 * `isoDateInZone` do `src/lib/format.ts` foi criado para tirar do produto.
 */
export type BarraDeDataProps = {
  dataISO: string;
  hojeISO: string;
  contagens: { total: number; aAtender: number };
};

/**
 * Alvo de 44px das setas. Continua acima dos 36px de controle da lib porque
 * esta é barra fixa: o `--tap-min` da §3.6 é piso de acessibilidade, não a
 * densidade antiga de balcão que a reforma aposentou.
 */
const ALVO_44 = 'size-11 shrink-0';

function deslocarDia(iso: string, dias: number): string {
  const [ano, mes, dia] = iso.split('-').map(Number);
  const base = new Date(Date.UTC(ano!, mes! - 1, dia!));
  base.setUTCDate(base.getUTCDate() + dias);
  return base.toISOString().slice(0, 10);
}

/**
 * "sexta, 14 de agosto". Sem o "-feira", como o `formatDayLabelLong` — o botão
 * divide uma linha de 360px com duas setas de 44px.
 *
 * Formata a partir do `Date` flutuante montado pelo `isoParaData`, e por isso
 * não recebe fuso: o dia já é o da loja, e mandar o `Intl` reinterpretá-lo em
 * outro fuso é justamente a conversão que deslocaria o rótulo.
 */
function rotuloDoDia(dia: Date): string {
  return format(dia, "EEEE, d 'de' MMMM", { locale: ptBR }).replace('-feira', '');
}

export function BarraDeData({ dataISO, hojeISO, contagens }: BarraDeDataProps) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);

  const ontem = deslocarDia(dataISO, -1);
  const amanha = deslocarDia(dataISO, 1);
  const eHoje = dataISO === hojeISO;
  const diaSelecionado = isoParaData(dataISO);

  return (
    <div className="-mx-3 mb-2 md:-mx-5">
      <div className="sticky top-0 z-10 flex h-16 flex-col justify-center gap-1 border-b border-border bg-background px-3 md:px-5">
        <div className="grid h-11 grid-cols-[44px_1fr_44px] items-center gap-2">
          <Link
            href={`/app/agenda?data=${ontem}`}
            aria-label="Ontem"
            className={cn(buttonVariants({ variant: 'outline', size: 'icon' }), ALVO_44)}
          >
            <ChevronLeft aria-hidden="true" />
          </Link>

          <Popover open={aberto} onOpenChange={setAberto}>
            <PopoverTrigger
              render={
                <Button
                  variant="outline"
                  aria-label="Data"
                  className="h-11 w-full justify-between px-3 font-normal"
                >
                  <span className="truncate">{rotuloDoDia(diaSelecionado)}</span>
                  <CalendarDays aria-hidden="true" />
                </Button>
              }
            />
            <PopoverContent align="center" className="w-auto p-0">
              <Calendar
                mode="single"
                locale={ptBR}
                autoFocus
                selected={diaSelecionado}
                defaultMonth={diaSelecionado}
                // "Hoje" é o de quem abriu a loja, não o do relógio do
                // navegador: o servidor já mandou `hojeISO` no fuso dela.
                today={isoParaData(hojeISO)}
                onSelect={(escolhido) => {
                  if (!escolhido) return;
                  setAberto(false);
                  // Mesma URL que as setas montam — a agenda continua sendo uma
                  // tela endereçável por `?data=`.
                  router.push(`/app/agenda?data=${dataParaISO(escolhido)}`);
                }}
              />
            </PopoverContent>
          </Popover>

          <Link
            href={`/app/agenda?data=${amanha}`}
            aria-label="Amanhã"
            className={cn(buttonVariants({ variant: 'outline', size: 'icon' }), ALVO_44)}
          >
            <ChevronRight aria-hidden="true" />
          </Link>
        </div>

        <p className="h-5 text-[12px] leading-4 font-bold tracking-wide text-muted-foreground uppercase">
          {contagens.total} no dia · {contagens.aAtender} a atender
        </p>
      </div>

      {eHoje ? null : (
        <div className="px-3 pt-2 md:px-5">
          <Link
            href="/app/agenda"
            className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'w-full no-underline')}
          >
            Voltar para hoje
          </Link>
        </div>
      )}
    </div>
  );
}
