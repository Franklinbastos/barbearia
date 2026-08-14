import type { ComponentProps } from 'react';
import { cva } from 'class-variance-authority';
import { DateTime } from 'luxon';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { Janela } from '@/domain/indicadores/periodo';
import { cn } from '@/lib/utils';

/**
 * Os estados vazios do resumo (§5 e princípio nº 6 do spec: "zero é resposta").
 *
 * **Aqui não é detalhe.** Uma tela de indicadores que abre com `0,0%` em tudo
 * ensina a coisa errada em dois casos opostos e o dono não tem como distinguir:
 * a barbearia que ainda não atendeu ninguém e a semana em que ninguém apareceu.
 * A primeira precisa saber que o número vem depois do primeiro corte; a segunda
 * precisa de um caminho para a semana passada, que é onde o número existe. Zero
 * não responde nenhuma das duas, e pior: um `0%` de ocupação numa loja recém
 * criada lê como cadeira parada, que é uma acusação falsa.
 *
 * **Três estados, três textos:**
 *
 * 1. `sem-historico` — a loja não tem atendimento nenhum em volta do período nem
 *    no último ano. Substitui a tela inteira: sem denominador não há um único
 *    número honesto para mostrar.
 * 2. `periodo-vazio` — houve movimento antes, mas não nesta janela. A tela
 *    troca os cards por um convite ao período anterior; a lista de clientes
 *    sumidos **fica**, porque ela não depende da janela e é justamente o que o
 *    dono pode fazer numa semana parada.
 * 3. Barbeiro sem comissão configurada — não é tela, é célula: vive em
 *    `tabela-por-barbeiro.tsx`, onde `comissaoCents === null` vira o link
 *    "configurar" em vez de `R$ 0,00`.
 *
 * **Sem `'use client'`.** Texto e links; nenhum estado.
 */
export type EstadoDoResumo = 'sem-historico' | 'periodo-vazio' | 'com-numeros';

export type ContagemDoResumo = {
  /** Atendimentos dentro da janela escolhida, de qualquer status. */
  itensDaJanela: number;
  /** Atendimentos no ano em torno da janela — o que a tabela por barbeiro lê. */
  itensDoHistorico: number;
  /** Clientes com visita concluída nos últimos 12 meses **do relógio**. */
  clientesComVisita: number;
};

/**
 * Qual dos três estados a tela está vivendo.
 *
 * **Por que duas contagens de histórico e não uma.** O histórico de
 * atendimentos é ancorado na *janela* (um ano antes dela, para saber quem é
 * cliente novo); o de clientes é ancorado no *relógio*. Quem abre um período de
 * 2024 numa loja movimentada zera o primeiro e não o segundo — e chamar essa
 * loja de "barbearia sem histórico" seria falso. Os dois juntos separam "nunca
 * houve nada" de "não houve nesta janela" sem precisar de uma consulta a mais.
 */
export function estadoDoResumo(contagem: ContagemDoResumo): EstadoDoResumo {
  if (contagem.itensDaJanela > 0) return 'com-numeros';
  if (contagem.itensDoHistorico === 0 && contagem.clientesComVisita === 0) return 'sem-historico';
  return 'periodo-vazio';
}

/** Dia civil da barbearia em `YYYY-MM-DD`. Nunca `toISOString()`, que passa por UTC. */
function diaDaLoja(instante: Date, timeZone: string): string {
  return DateTime.fromJSDate(instante).setZone(timeZone).toISODate()!;
}

/**
 * O endereço do período anterior, como intervalo livre.
 *
 * Semana, mês e hoje não têm `?periodo=` para "o anterior" — a URL só sabe
 * dizer *qual* período, não *quantos para trás*. O atalho vira então o
 * intervalo livre com as duas pontas explícitas, que é a mesma coisa que o
 * calendário do seletor produz. O `ate` é o **último dia inclusivo**: a janela
 * guarda o `fim` exclusivo, e mandá-lo cru mostraria a segunda-feira seguinte
 * dentro da semana passada.
 */
export function linkDoPeriodoAnterior(anterior: Janela, timeZone: string): string {
  const de = diaDaLoja(anterior.inicio, timeZone);
  const ate = diaDaLoja(
    DateTime.fromJSDate(anterior.fim).setZone(timeZone).minus({ days: 1 }).toJSDate(),
    timeZone,
  );
  return `/app/resumo?periodo=livre&de=${de}&ate=${ate}`;
}

/** Como o botão do atalho se chama, dado o período que está na tela. */
export function rotuloDoAtalhoAnterior(janela: Janela): string {
  if (janela.periodo === 'hoje') return 'Ver ontem';
  if (janela.periodo === 'mes') return 'Ver o mês passado';
  if (janela.periodo === 'semana') return 'Ver a semana passada';
  return 'Ver o período anterior';
}

export const estadoVazioVariants = cva('items-center text-center');

export type EstadoVazioProps = Omit<ComponentProps<'div'>, 'title'> & {
  titulo: string;
  /** Uma ou duas frases: o que aconteceu e o que fazer. */
  texto: string;
  acao?: { href: string; rotulo: string };
};

/**
 * O card de estado vazio. Centralizado e sem número — a ausência de dígito na
 * tela é o próprio recado.
 */
export function EstadoVazio({ titulo, texto, acao, className, ...resto }: EstadoVazioProps) {
  return (
    <Card data-slot="estado-vazio" className={cn(estadoVazioVariants(), className)} {...resto}>
      <CardContent className="flex max-w-[52ch] flex-col items-center gap-3 py-6">
        <p data-slot="estado-vazio-titulo" className="text-[17px] leading-[22px] font-bold">
          {titulo}
        </p>
        <p className="text-base leading-6 text-muted-foreground">{texto}</p>

        {acao ? (
          <Button
            variant="outline"
            render={<Link href={acao.href} className="no-underline" />}
          >
            {acao.rotulo}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** Estado 1: a barbearia ainda não tem o que medir. */
export function SemHistorico() {
  return (
    <EstadoVazio
      data-slot="resumo-sem-historico"
      titulo="Ainda não há atendimento para medir"
      texto="Os números deste resumo — faturamento, ocupação, ticket médio e falta — aparecem depois dos primeiros atendimentos registrados na agenda. Nada aqui precisa ser configurado antes."
      acao={{ href: '/app/agenda', rotulo: 'Abrir a agenda' }}
    />
  );
}

export type PeriodoSemAtendimentoProps = {
  janela: Janela;
  anterior: Janela;
  timeZone: string;
};

/** Estado 2: houve movimento antes, não nesta janela. */
export function PeriodoSemAtendimento({ janela, anterior, timeZone }: PeriodoSemAtendimentoProps) {
  return (
    <EstadoVazio
      data-slot="resumo-periodo-vazio"
      titulo={`Nenhum atendimento em ${janela.rotulo}`}
      texto="Não houve nada marcado nem atendido neste período, então não há faturamento, ocupação nem taxa para calcular. O período anterior tem número."
      acao={{
        href: linkDoPeriodoAnterior(anterior, timeZone),
        rotulo: rotuloDoAtalhoAnterior(janela),
      }}
    />
  );
}
