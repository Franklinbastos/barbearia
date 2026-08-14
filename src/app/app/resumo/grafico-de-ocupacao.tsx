'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

/**
 * Ocupação por hora do dia — **o único gráfico da tela** (§3.2 do spec).
 *
 * O princípio nº 1 é "número, não gráfico", e este é a exceção declarada:
 * aqui a **forma da curva é a informação**. Ninguém decide nada com a lista
 * "9h: 80%, 10h: 78%, 11h: 40%"; olhando as barras, o buraco das 11 salta, e
 * onde afunda é onde promover. Qualquer segundo gráfico nesta tela precisa
 * passar por esse mesmo teste antes de entrar.
 *
 * **As horas vêm do domínio, não de um `for` de 0 a 23.** `calcularOcupacao`
 * devolve só as horas que têm expediente na janela — a barbearia que abre às 9
 * e fecha às 19 não mostra uma barra zerada às 3 da manhã, que leria como
 * ociosidade em vez de loja fechada.
 *
 * **Client Component** porque recharts mede o container no navegador. É o único
 * pedaço de cliente da tela além do seletor de período, e recebe os números já
 * calculados: nenhuma conta acontece aqui.
 */
export type PontoDeOcupacao = {
  /** Hora local da barbearia, 0 a 23. */
  hora: number;
  /** Fração de 0 a 1, como o domínio devolve. */
  taxa: number;
};

export type GraficoDeOcupacaoProps = {
  dados: PontoDeOcupacao[];
};

/** O que vai para o recharts: percentual inteiro, que é o que o eixo desenha. */
type BarraDeOcupacao = { hora: number; ocupacao: number };

const CONFIG = {
  ocupacao: { label: 'Ocupação', color: 'var(--marca)' },
} satisfies ChartConfig;

function rotuloDaHora(hora: number): string {
  return `${hora}h`;
}

export function GraficoDeOcupacao({ dados }: GraficoDeOcupacaoProps) {
  // A conversão para percentual é feita aqui, e não no domínio: a matemática
  // fala em fração de 0 a 1 em todo lugar, e quem formata é a borda.
  const pontos: BarraDeOcupacao[] = dados.map((p) => ({
    hora: p.hora,
    ocupacao: Math.round(p.taxa * 100),
  }));

  return (
    <ChartContainer
      config={CONFIG}
      // `aspect-video` do container deixaria a barra fininha no celular; a
      // altura fixa mantém a curva legível em 360px sem rolagem lateral.
      className="aspect-auto h-[220px] w-full"
    >
      <BarChart data={pontos} margin={{ top: 8, right: 4, bottom: 0, left: -16 }} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="hora"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          // Em telas estreitas o eixo cabe de duas em duas horas; sem isto os
          // rótulos se sobrepõem e viram borrão.
          interval="preserveStartEnd"
          minTickGap={12}
          tickFormatter={rotuloDaHora}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={44}
          domain={[0, 100]}
          ticks={[0, 50, 100]}
          tickFormatter={(valor: number) => `${valor}%`}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              labelFormatter={(_rotulo, carga) => {
                const barra = carga?.[0]?.payload as BarraDeOcupacao | undefined;
                return barra ? `${rotuloDaHora(barra.hora)} às ${rotuloDaHora(barra.hora + 1)}` : '';
              }}
              formatter={(valor) => `${String(valor)}% ocupado`}
            />
          }
        />
        <Bar dataKey="ocupacao" name="Ocupação" fill="var(--color-ocupacao)" radius={4} />
      </BarChart>
    </ChartContainer>
  );
}
