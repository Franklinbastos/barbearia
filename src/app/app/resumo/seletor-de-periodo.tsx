'use client';

import { CalendarRange } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { DateRange } from 'react-day-picker';
import { ptBR } from 'react-day-picker/locale';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Segmentado } from '@/components/ui/segmentado';
import type { Periodo } from '@/domain/indicadores/periodo';
import { dataParaISO, isoParaData } from '@/lib/data-local';

/**
 * O seletor de período do resumo (§5 do spec): Hoje, Semana, Mês e um intervalo
 * livre.
 *
 * **A URL é o estado.** Não há `useState` guardando qual período está ativo —
 * ele chega por prop, vindo do `?periodo=` que o Server Component leu. É o que
 * faz a tela ser endereçável: o dono manda `/app/resumo?periodo=mes` para o
 * contador e o contador vê o mesmo mês. O único estado local é o do popover
 * aberto e o rascunho do intervalo, que não são informação da tela.
 *
 * **Semana é o padrão** e por isso o botão dela também navega com `?periodo=`
 * explícito: sem o parâmetro a tela mostra a semana do mesmo jeito, mas deixar
 * a URL sem dizer qual período está ativo quebra o "volta e é a mesma tela".
 *
 * **Por que `Segmentado` e não três `<Link>`.** O componente já existe, traz o
 * `role="group"`, o `aria-pressed` de cada botão e a navegação por seta do
 * `ToggleGroup`; três links soltos chegariam ao leitor de tela sem nada disso e
 * sem dizer qual está ativo. Ele fala por callback, então quem navega é o
 * `router.push` — mesma coisa que a `barra-de-data` da agenda faz quando o
 * `Calendar` escolhe um dia.
 *
 * **Fuso.** As datas do intervalo andam como `YYYY-MM-DD` *já no fuso da
 * barbearia* — quem as produz é o `page.tsx`, com Luxon. O `Calendar` fala
 * `Date` do navegador, e a regra aqui é a mesma da agenda: **não converter**.
 * `isoParaData` e `dataParaISO` só olham os getters locais, então a ida e a
 * volta são exatas mesmo com o navegador em outro fuso. Nada de
 * `new Date('2026-08-13')` nem `toISOString().slice(0, 10)`.
 */
export type SeletorDePeriodoProps = {
  /** O período ativo, já resolvido pelo servidor. */
  periodo: Periodo;
  /** Como a janela se chama — "10 a 16 de agosto". Vira o rótulo do botão de intervalo. */
  rotulo: string;
  /** Pontas do intervalo livre, inclusivas, em `YYYY-MM-DD` do fuso da loja. */
  de?: string;
  ate?: string;
  /** "Hoje" da barbearia, para o `Calendar` não marcar o dia do navegador. */
  hojeISO: string;
};

const OPCOES: { valor: Periodo; rotulo: string }[] = [
  { valor: 'hoje', rotulo: 'Hoje' },
  { valor: 'semana', rotulo: 'Semana' },
  { valor: 'mes', rotulo: 'Mês' },
];

export function SeletorDePeriodo({ periodo, rotulo, de, ate, hojeISO }: SeletorDePeriodoProps) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);

  const intervaloAtual: DateRange | undefined =
    periodo === 'livre' && de && ate ? { from: isoParaData(de), to: isoParaData(ate) } : undefined;

  // Rascunho porque escolher intervalo são dois toques: navegar no primeiro
  // fecharia o calendário com uma janela de um dia que ninguém pediu.
  const [rascunho, setRascunho] = useState<DateRange | undefined>(intervaloAtual);

  function trocarPeriodo(novo: Periodo) {
    router.push(`/app/resumo?periodo=${novo}`);
  }

  function aplicarIntervalo() {
    if (!rascunho?.from || !rascunho.to) return;
    setAberto(false);
    router.push(
      `/app/resumo?periodo=livre&de=${dataParaISO(rascunho.from)}&ate=${dataParaISO(rascunho.to)}`,
    );
  }

  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
      <Segmentado
        rotuloDoGrupo="Período"
        // Com o intervalo livre ativo nenhum dos três fica apertado, e é o certo:
        // "Semana" aceso enquanto a tela mostra 3 a 9 de agosto seria mentira.
        valor={periodo}
        opcoes={OPCOES}
        aoTrocar={trocarPeriodo}
      />

      <Popover
        open={aberto}
        onOpenChange={(estado) => {
          setAberto(estado);
          // Reabrir depois de desistir volta ao que a tela mostra, não ao meio
          // da escolha anterior.
          if (estado) setRascunho(intervaloAtual);
        }}
      >
        <PopoverTrigger
          render={
            <Button
              variant={periodo === 'livre' ? 'default' : 'outline'}
              className="justify-between font-normal md:w-auto"
            >
              <CalendarRange aria-hidden="true" />
              <span className="truncate">
                {periodo === 'livre' ? rotulo : 'Escolher datas'}
              </span>
            </Button>
          }
        />
        <PopoverContent align="end" className="w-auto p-0">
          <Calendar
            mode="range"
            locale={ptBR}
            autoFocus
            selected={rascunho}
            onSelect={setRascunho}
            defaultMonth={rascunho?.from ?? isoParaData(hojeISO)}
            today={isoParaData(hojeISO)}
          />
          <div className="border-t border-border p-2">
            <Button
              className="w-full"
              disabled={!rascunho?.from || !rascunho.to}
              onClick={aplicarIntervalo}
            >
              Ver este período
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
