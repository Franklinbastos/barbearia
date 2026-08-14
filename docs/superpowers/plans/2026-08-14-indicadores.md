# Tela de indicadores do dono — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Devolver ao dono os números que o produto já registra e nunca mostrou — dinheiro, ocupação, cliente e comissão.

**Architecture:** Toda a matemática vive em funções puras em `src/domain/indicadores/`, sem I/O, testáveis em milissegundos. Os repositórios ganham consultas de agregação escopadas por barbearia. A tela `/app/resumo` é Server Component que compõe os cards, e o único gráfico é client. Nada de tabela nova além de uma coluna em `staff`.

**Tech Stack:** Next.js 15 App Router · React 19 · TypeScript strict · Drizzle · PostgreSQL 16 · Luxon (fuso) · shadcn (`base-nova`) · recharts (via `chart`) · Vitest · Playwright

**Spec:** `docs/superpowers/specs/2026-08-13-indicadores-design.md` — leia antes de qualquer task. A pesquisa que o embasa está em `docs/superpowers/research/2026-08-13-indicadores-de-barbearia.md`, e é onde estão as fórmulas de mercado citadas.

## Global Constraints

- Diretório: `/home/franklin/dev/barbearia`. Branch `main`. npm. Node 22.
- Tudo em pt-BR com acentuação correta, UTF-8 sem BOM.
- **Todo acesso ao banco passa por `src/db/repositories/`, e toda função recebe `barbershopId` como primeiro parâmetro depois do `db`.** Nenhuma query solta em componente ou rota.
- **A matemática não toca no banco.** `src/domain/indicadores/` recebe dados como argumento e devolve número. É o que permite testar fronteira de fuso e mês sem subir Postgres.
- **Fuso é da barbearia, sempre.** O produto guarda `timestamptz` e converte na borda com Luxon, usando `barbershop.timeZone`. Nunca `new Date('2026-08-13')` nem `toISOString().slice(0,10)` — os dois passam por UTC e deslocam o dia. Para converter dia civil ↔ `Date` no cliente existe `src/lib/data-local.ts`.
- **UI vem do shadcn**, estilo `base-nova`, pelo CLI. Componente de domínio segue o padrão da casa: `cva`, `cn()`, `data-slot`, sem `forwardRef`. Ver `AGENTS.md`.
- Alvo de toque: o do shadcn (36px), exceto barra fixa e folha, que mantêm `--tap-min` de 44px.
- Teste: `DATABASE_URL_TEST=postgres://barbearia:barbearia@localhost:5433/barbearia_test npx vitest run`. Nunca o banco `barbearia`.
- **Não subir dev server nem navegador dentro de subagente** — derruba a VM do WSL. Verificação visual é do orquestrador.
- Commits em pt-BR: `tipo(area): resultado para o usuário`.

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/domain/indicadores/periodo.ts` | resolve Semana/Mês/Hoje/intervalo em `{ inicio, fim }` no fuso da loja |
| `src/domain/indicadores/dinheiro.ts` | faturamento, ticket médio, receita perdida, previsto |
| `src/domain/indicadores/ocupacao.ts` | minutos disponíveis, minutos ocupados, taxa, por dia e por hora |
| `src/domain/indicadores/cliente.ts` | novos vs recorrentes, tempo entre visitas, sumidos, retorno |
| `src/domain/indicadores/comportamento.ts` | falta, cancelamento, cancelamento em cima da hora, origem |
| `src/domain/indicadores/comissao.ts` | comissão por barbeiro e o detalhe por atendimento |
| `src/db/repositories/indicadores.repo.ts` | as consultas de agregação, escopadas por barbearia |
| `src/app/app/resumo/page.tsx` | a tela: compõe os cards |
| `src/app/app/resumo/seletor-de-periodo.tsx` | Semana/Mês/Hoje/intervalo |
| `src/app/app/resumo/cartao-indicador.tsx` | o card de número, com a explicação do cálculo |
| `src/app/app/resumo/grafico-de-ocupacao.tsx` | o único gráfico (client) |
| `src/app/app/resumo/tabela-por-barbeiro.tsx` | tabela no desktop, lista no celular |
| `src/app/app/resumo/clientes-sumidos.tsx` | lista com WhatsApp |
| `src/app/app/comissao/page.tsx` | o detalhe atendimento a atendimento |

---

## Task 1: Período e o esqueleto da tela

Sem esta task nenhuma outra tem onde aparecer. Entrega uma tela que já responde "quantos atendimentos nesta semana".

**Files:**
- Create: `src/domain/indicadores/periodo.ts`, `src/app/app/resumo/page.tsx`, `src/app/app/resumo/seletor-de-periodo.tsx`, `src/app/app/resumo/loading.tsx`
- Modify: `src/components/panel-nav.tsx`
- Test: `src/domain/indicadores/periodo.test.ts`

**Interfaces:**
- Consumes: `listAppointmentsBetween(db, barbershopId, from, to)` de `@/db/repositories`
- Produces:
  - `type Periodo = 'hoje' | 'semana' | 'mes' | 'livre'`
  - `type Janela = { inicio: Date; fim: Date; rotulo: string; periodo: Periodo }`
  - `resolverPeriodo(params: { periodo?: string; de?: string; ate?: string; timeZone: string; agora?: DateTime }): Janela`
  - `janelaAnterior(janela: Janela, timeZone: string): Janela` — o período imediatamente anterior, para comparação

- [ ] **Step 1: Escrever o teste do período**

Criar `src/domain/indicadores/periodo.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { DateTime } from 'luxon';
import { resolverPeriodo, janelaAnterior } from './periodo';

const TZ = 'America/Sao_Paulo';
// Sexta-feira, 14/08/2026, 15h em São Paulo.
const AGORA = DateTime.fromISO('2026-08-14T15:00', { zone: TZ });

describe('resolverPeriodo', () => {
  it('sem parâmetro nenhum devolve a semana corrente', () => {
    const j = resolverPeriodo({ timeZone: TZ, agora: AGORA });
    expect(j.periodo).toBe('semana');
    // segunda 00:00 até segunda seguinte 00:00
    expect(DateTime.fromJSDate(j.inicio).setZone(TZ).toISODate()).toBe('2026-08-10');
    expect(DateTime.fromJSDate(j.fim).setZone(TZ).toISODate()).toBe('2026-08-17');
  });

  it('hoje é o dia civil da barbearia, não 24h para trás', () => {
    const j = resolverPeriodo({ periodo: 'hoje', timeZone: TZ, agora: AGORA });
    expect(DateTime.fromJSDate(j.inicio).setZone(TZ).toISO()).toContain('2026-08-14T00:00');
    expect(DateTime.fromJSDate(j.fim).setZone(TZ).toISODate()).toBe('2026-08-15');
  });

  it('mês vai do dia 1 ao dia 1 do mês seguinte', () => {
    const j = resolverPeriodo({ periodo: 'mes', timeZone: TZ, agora: AGORA });
    expect(DateTime.fromJSDate(j.inicio).setZone(TZ).toISODate()).toBe('2026-08-01');
    expect(DateTime.fromJSDate(j.fim).setZone(TZ).toISODate()).toBe('2026-09-01');
  });

  it('intervalo livre respeita as duas pontas, com o fim inclusivo no dia', () => {
    const j = resolverPeriodo({ periodo: 'livre', de: '2026-08-03', ate: '2026-08-09', timeZone: TZ, agora: AGORA });
    expect(DateTime.fromJSDate(j.inicio).setZone(TZ).toISODate()).toBe('2026-08-03');
    // fim exclusivo no dia seguinte: quem marcou às 18h do dia 9 tem que entrar
    expect(DateTime.fromJSDate(j.fim).setZone(TZ).toISODate()).toBe('2026-08-10');
  });

  it('intervalo invertido é corrigido em vez de devolver janela vazia', () => {
    const j = resolverPeriodo({ periodo: 'livre', de: '2026-08-09', ate: '2026-08-03', timeZone: TZ, agora: AGORA });
    expect(j.inicio.getTime()).toBeLessThan(j.fim.getTime());
  });

  it('período desconhecido cai na semana em vez de quebrar', () => {
    expect(resolverPeriodo({ periodo: 'trimestre', timeZone: TZ, agora: AGORA }).periodo).toBe('semana');
  });

  it('usa o fuso da barbearia, não o do servidor', () => {
    const manaus = resolverPeriodo({ periodo: 'hoje', timeZone: 'America/Manaus', agora: AGORA });
    // 15h em SP é 14h em Manaus, mesmo dia civil; o início muda de instante
    expect(manaus.inicio.toISOString()).not.toBe(
      resolverPeriodo({ periodo: 'hoje', timeZone: TZ, agora: AGORA }).inicio.toISOString(),
    );
  });
});

describe('janelaAnterior', () => {
  it('a semana anterior tem a mesma duração e termina onde a atual começa', () => {
    const atual = resolverPeriodo({ timeZone: TZ, agora: AGORA });
    const antes = janelaAnterior(atual, TZ);
    expect(antes.fim.getTime()).toBe(atual.inicio.getTime());
    expect(antes.fim.getTime() - antes.inicio.getTime()).toBe(atual.fim.getTime() - atual.inicio.getTime());
  });

  it('o mês anterior respeita o calendário, não 30 dias fixos', () => {
    const marco = resolverPeriodo({ periodo: 'livre', de: '2026-03-01', ate: '2026-03-31', timeZone: TZ, agora: AGORA });
    const fevereiro = janelaAnterior({ ...marco, periodo: 'mes' }, TZ);
    expect(DateTime.fromJSDate(fevereiro.inicio).setZone(TZ).toISODate()).toBe('2026-02-01');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/domain/indicadores/periodo.test.ts`
Expected: FAIL — `Cannot find module './periodo'`.

- [ ] **Step 3: Implementar o período**

Criar `src/domain/indicadores/periodo.ts`. Usar Luxon com `setZone(timeZone)`. A semana começa na **segunda** (`startOf('week')` do Luxon já faz isso com o locale padrão ISO). O `fim` é sempre exclusivo — meia-noite do dia seguinte —, que é a mesma convenção de `listAppointmentsBetween`.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/domain/indicadores/periodo.test.ts`
Expected: PASS, 9 testes.

- [ ] **Step 5: Montar a tela e o seletor**

`src/app/app/resumo/page.tsx` — Server Component, no padrão de `src/app/app/agenda/page.tsx`: `requireSession()`, `findBarbershopById` para o `timeZone`, `resolverPeriodo` a partir de `searchParams`, e por ora só `listAppointmentsBetween` mostrando a contagem de atendimentos do período.

`seletor-de-periodo.tsx` — `Segmentado` (que já existe) com Hoje/Semana/Mês, mais um `Popover`+`Calendar` para o intervalo livre, no mesmo padrão de `barra-de-data.tsx`. Navega por `<Link>` com `?periodo=`, sem estado de cliente.

`loading.tsx` com `EsqueletoDeLinha`.

- [ ] **Step 6: Pôr "Resumo" na sidebar**

Em `src/components/panel-nav.tsx`, primeira posição, antes de Agenda. Ícone `ChartColumn` do lucide.

`tests/unit/casca.test.tsx` afirma as cinco seções — atualize para seis, sem apagar o teste.

- [ ] **Step 7: Verificar**

Run: `DATABASE_URL_TEST=postgres://barbearia:barbearia@localhost:5433/barbearia_test npx vitest run && npx tsc --noEmit && npx eslint src tests && npm run build`

- [ ] **Step 8: Commit**

```bash
git add src/domain/indicadores src/app/app/resumo src/components/panel-nav.tsx tests/unit/casca.test.tsx
git commit -m "feat(resumo): tela de indicadores com seletor de período"
```

---

## Task 2: Dinheiro e comportamento

O que o dono olha primeiro, e sai direto de `appointment` sem configuração nenhuma.

**Files:**
- Create: `src/domain/indicadores/dinheiro.ts`, `src/domain/indicadores/comportamento.ts`, `src/app/app/resumo/cartao-indicador.tsx`
- Modify: `src/app/app/resumo/page.tsx`
- Test: `src/domain/indicadores/dinheiro.test.ts`, `src/domain/indicadores/comportamento.test.ts`

**Interfaces:**
- Consumes: `Janela` da Task 1
- Produces:
  - `type AtendimentoBruto = { id: string; staffId: string; customerId: string; startAt: Date; endAt: Date; status: 'BOOKED' | 'DONE' | 'CANCELED' | 'NO_SHOW'; origin: 'PUBLIC' | 'PANEL' | 'BOT'; precoCents: number; canceledAt: Date | null }`
  - `calcularDinheiro(itens: AtendimentoBruto[], agora: Date): { faturamentoCents: number; ticketMedioCents: number; atendimentos: number; perdidoCents: number; previstoCents: number }`
  - `calcularComportamento(itens: AtendimentoBruto[]): { taxaFalta: number; taxaCancelamento: number; cancelamentoEmCimaDaHora: number; porOrigem: Record<'PUBLIC' | 'PANEL' | 'BOT', number> }`
  - `CartaoIndicador` com props `{ titulo: string; valor: string; apoio?: string; comparacao?: { valor: string; melhorou: boolean }; explicacao: string }`

- [ ] **Step 1: Escrever o teste do dinheiro**

Criar `src/domain/indicadores/dinheiro.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { calcularDinheiro, type AtendimentoBruto } from './dinheiro';

const AGORA = new Date('2026-08-14T18:00:00Z');

function item(over: Partial<AtendimentoBruto> = {}): AtendimentoBruto {
  return {
    id: crypto.randomUUID(),
    staffId: 'a',
    customerId: 'c1',
    startAt: new Date('2026-08-14T12:00:00Z'),
    endAt: new Date('2026-08-14T12:30:00Z'),
    status: 'DONE',
    origin: 'PUBLIC',
    precoCents: 4500,
    canceledAt: null,
    ...over,
  };
}

describe('calcularDinheiro', () => {
  it('faturamento conta só o que foi atendido', () => {
    const r = calcularDinheiro(
      [item(), item(), item({ status: 'CANCELED' }), item({ status: 'NO_SHOW' })],
      AGORA,
    );
    expect(r.faturamentoCents).toBe(9000);
    expect(r.atendimentos).toBe(2);
  });

  it('agendado do futuro é previsto, nunca faturamento', () => {
    const r = calcularDinheiro(
      [item(), item({ status: 'BOOKED', startAt: new Date('2026-08-20T12:00:00Z') })],
      AGORA,
    );
    expect(r.faturamentoCents).toBe(4500);
    expect(r.previstoCents).toBe(4500);
  });

  it('ticket médio é faturamento sobre atendimentos, não sobre tudo', () => {
    const r = calcularDinheiro([item({ precoCents: 4000 }), item({ precoCents: 6000 }), item({ status: 'NO_SHOW' })], AGORA);
    expect(r.ticketMedioCents).toBe(5000);
  });

  it('receita perdida é o preço de quem faltou', () => {
    const r = calcularDinheiro([item(), item({ status: 'NO_SHOW', precoCents: 7000 })], AGORA);
    expect(r.perdidoCents).toBe(7000);
  });

  it('período sem atendimento devolve zero sem dividir por zero', () => {
    const r = calcularDinheiro([], AGORA);
    expect(r).toEqual({ faturamentoCents: 0, ticketMedioCents: 0, atendimentos: 0, perdidoCents: 0, previstoCents: 0 });
  });

  it('usa o preço do snapshot, não o preço atual do serviço', () => {
    // o snapshot é o contrato: mudar o preço amanhã não reescreve o histórico
    const r = calcularDinheiro([item({ precoCents: 3000 })], AGORA);
    expect(r.faturamentoCents).toBe(3000);
  });
});
```

- [ ] **Step 2: Escrever o teste do comportamento**

Criar `src/domain/indicadores/comportamento.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { calcularComportamento } from './comportamento';
import type { AtendimentoBruto } from './dinheiro';

function item(over: Partial<AtendimentoBruto> = {}): AtendimentoBruto {
  return {
    id: crypto.randomUUID(), staffId: 'a', customerId: 'c1',
    startAt: new Date('2026-08-14T12:00:00Z'), endAt: new Date('2026-08-14T12:30:00Z'),
    status: 'DONE', origin: 'PUBLIC', precoCents: 4500, canceledAt: null, ...over,
  };
}

describe('calcularComportamento', () => {
  it('taxa de falta é falta sobre atendido mais falta — cancelado não entra', () => {
    const r = calcularComportamento([
      item(), item(), item(), item({ status: 'NO_SHOW' }), item({ status: 'CANCELED' }),
    ]);
    expect(r.taxaFalta).toBeCloseTo(0.25); // 1 de 4, e não 1 de 5
  });

  it('taxa de cancelamento é sobre o total do período', () => {
    const r = calcularComportamento([item(), item(), item({ status: 'CANCELED' }), item({ status: 'CANCELED' })]);
    expect(r.taxaCancelamento).toBeCloseTo(0.5);
  });

  it('cancelamento em cima da hora é o que caiu a menos de 24h do horário', () => {
    const r = calcularComportamento([
      item({
        status: 'CANCELED',
        startAt: new Date('2026-08-14T12:00:00Z'),
        canceledAt: new Date('2026-08-14T09:00:00Z'), // 3h antes
      }),
      item({
        status: 'CANCELED',
        startAt: new Date('2026-08-20T12:00:00Z'),
        canceledAt: new Date('2026-08-14T09:00:00Z'), // 6 dias antes
      }),
    ]);
    expect(r.cancelamentoEmCimaDaHora).toBe(1);
  });

  it('cancelado sem canceledAt não conta como em cima da hora', () => {
    const r = calcularComportamento([item({ status: 'CANCELED', canceledAt: null })]);
    expect(r.cancelamentoEmCimaDaHora).toBe(0);
  });

  it('conta a origem de cada agendamento', () => {
    const r = calcularComportamento([item(), item({ origin: 'PANEL' }), item({ origin: 'PANEL' }), item({ origin: 'BOT' })]);
    expect(r.porOrigem).toEqual({ PUBLIC: 1, PANEL: 2, BOT: 1 });
  });

  it('sem nada devolve zero em tudo', () => {
    const r = calcularComportamento([]);
    expect(r.taxaFalta).toBe(0);
    expect(r.taxaCancelamento).toBe(0);
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run src/domain/indicadores/`
Expected: FAIL nos dois módulos novos.

- [ ] **Step 4: Implementar**

`dinheiro.ts` e `comportamento.ts`, funções puras. Atenção ao denominador da taxa de falta: é `DONE + NO_SHOW`, não o total — cancelado é outro fenômeno e tem taxa própria (§3.4 do spec).

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/domain/indicadores/`
Expected: PASS, 12 novos.

- [ ] **Step 6: O card e a primeira dobra**

`cartao-indicador.tsx`: `Card` do shadcn, título pequeno em `muted-foreground`, número grande em `tabular-nums`, linha de apoio, e a comparação com o período anterior como `Badge`. A `explicacao` vai num `Tooltip` — foi o que o Phorest acertou e é o que faz o dono confiar no número.

Em `page.tsx`, os quatro cards da primeira dobra: Faturamento (com comparação), Ocupação (placeholder até a Task 3), Ticket médio e Taxa de falta (com a receita perdida no apoio).

- [ ] **Step 7: Verificar e commitar**

Run: `DATABASE_URL_TEST=... npx vitest run && npx tsc --noEmit && npx eslint src tests`

```bash
git add src/domain/indicadores src/app/app/resumo
git commit -m "feat(resumo): faturamento, ticket, falta e origem do agendamento"
```

---

## Task 3: Ocupação

O diferencial competitivo: **nenhum produto brasileiro tem ocupação como número.** É também a conta mais fácil de errar, porque o denominador é onde a métrica mente.

**Files:**
- Create: `src/domain/indicadores/ocupacao.ts`, `src/app/app/resumo/grafico-de-ocupacao.tsx`
- Modify: `src/db/repositories/indicadores.repo.ts` (criado aqui), `src/app/app/resumo/page.tsx`
- Test: `src/domain/indicadores/ocupacao.test.ts`

**Interfaces:**
- Consumes: `AtendimentoBruto` da Task 2, `Janela` da Task 1
- Produces:
  - `type BlocoDeTrabalho = { staffId: string; weekday: number; startTime: string; endTime: string }`
  - `type Bloqueio = { staffId: string; startAt: Date; endAt: Date }`
  - `calcularOcupacao(args: { itens: AtendimentoBruto[]; expediente: BlocoDeTrabalho[]; bloqueios: Bloqueio[]; janela: Janela; timeZone: string; agora: Date }): { minutosDisponiveis: number; minutosOcupados: number; taxa: number; porBarbeiro: Map<string, { disponiveis: number; ocupados: number; taxa: number }>; porDiaDaSemana: { weekday: number; taxa: number }[]; porHora: { hora: number; taxa: number }[] }`
  - `listarExpedienteEBloqueios(db, barbershopId, inicio, fim)` em `indicadores.repo.ts`

- [ ] **Step 1: Escrever o teste da ocupação**

O arquivo mais importante do plano. Criar `src/domain/indicadores/ocupacao.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { DateTime } from 'luxon';
import { calcularOcupacao, type BlocoDeTrabalho } from './ocupacao';
import type { AtendimentoBruto } from './dinheiro';

const TZ = 'America/Sao_Paulo';

/** Segunda 10/08/2026, das 09:00 às 12:00 = 180 minutos. */
const EXPEDIENTE: BlocoDeTrabalho[] = [
  { staffId: 'a', weekday: 1, startTime: '09:00:00', endTime: '12:00:00' },
];

const JANELA_SEGUNDA = {
  inicio: DateTime.fromISO('2026-08-10T00:00', { zone: TZ }).toJSDate(),
  fim: DateTime.fromISO('2026-08-11T00:00', { zone: TZ }).toJSDate(),
  rotulo: 'seg, 10 de agosto',
  periodo: 'hoje' as const,
};

/** Fim do dia: nada de "já passou" para descontar. */
const DEPOIS = DateTime.fromISO('2026-08-10T23:00', { zone: TZ }).toJSDate();

function em(hora: string): Date {
  return DateTime.fromISO(`2026-08-10T${hora}`, { zone: TZ }).toJSDate();
}

function item(inicio: string, fim: string, over: Partial<AtendimentoBruto> = {}): AtendimentoBruto {
  return {
    id: crypto.randomUUID(), staffId: 'a', customerId: 'c1',
    startAt: em(inicio), endAt: em(fim),
    status: 'DONE', origin: 'PUBLIC', precoCents: 4500, canceledAt: null, ...over,
  };
}

const base = { expediente: EXPEDIENTE, bloqueios: [], janela: JANELA_SEGUNDA, timeZone: TZ, agora: DEPOIS };

describe('calcularOcupacao — denominador', () => {
  it('disponível é o expediente do dia', () => {
    const r = calcularOcupacao({ ...base, itens: [] });
    expect(r.minutosDisponiveis).toBe(180);
    expect(r.taxa).toBe(0);
  });

  it('bloqueio sai do disponível — hora que o barbeiro não estava lá não conta contra ele', () => {
    const r = calcularOcupacao({
      ...base, itens: [],
      bloqueios: [{ staffId: 'a', startAt: em('10:00'), endAt: em('11:00') }],
    });
    expect(r.minutosDisponiveis).toBe(120);
  });

  it('bloqueio que passa das bordas do expediente só desconta a parte que intersecta', () => {
    const r = calcularOcupacao({
      ...base, itens: [],
      bloqueios: [{ staffId: 'a', startAt: em('07:00'), endAt: em('10:00') }],
    });
    expect(r.minutosDisponiveis).toBe(120); // só das 9 às 10 conta
  });

  it('num dia em curso, o que ainda não chegou não é disponível', () => {
    // são 10:00; das 10 às 12 ainda pode ser vendido, mas não é ociosidade
    const r = calcularOcupacao({ ...base, itens: [], agora: em('10:00') });
    expect(r.minutosDisponiveis).toBe(60);
  });

  it('dia sem expediente não entra na conta', () => {
    const domingo = {
      ...JANELA_SEGUNDA,
      inicio: DateTime.fromISO('2026-08-09T00:00', { zone: TZ }).toJSDate(),
      fim: DateTime.fromISO('2026-08-10T00:00', { zone: TZ }).toJSDate(),
    };
    const r = calcularOcupacao({ ...base, itens: [], janela: domingo });
    expect(r.minutosDisponiveis).toBe(0);
    expect(r.taxa).toBe(0); // e não NaN
  });
});

describe('calcularOcupacao — numerador', () => {
  it('atendido ocupa', () => {
    const r = calcularOcupacao({ ...base, itens: [item('09:00', '10:00')] });
    expect(r.minutosOcupados).toBe(60);
    expect(r.taxa).toBeCloseTo(60 / 180);
  });

  it('agendado ainda não atendido também ocupa: a cadeira está reservada', () => {
    const r = calcularOcupacao({ ...base, itens: [item('09:00', '10:00', { status: 'BOOKED' })] });
    expect(r.minutosOcupados).toBe(60);
  });

  it('FALTA OCUPA — é o ponto do indicador', () => {
    // a cadeira ficou reservada, ninguém pôde usar, e o dono precisa ver isso
    const r = calcularOcupacao({ ...base, itens: [item('09:00', '10:00', { status: 'NO_SHOW' })] });
    expect(r.minutosOcupados).toBe(60);
  });

  it('cancelado não ocupa: o horário voltou para a grade', () => {
    const r = calcularOcupacao({ ...base, itens: [item('09:00', '10:00', { status: 'CANCELED' })] });
    expect(r.minutosOcupados).toBe(0);
  });

  it('atendimento que vaza do expediente conta só a parte de dentro', () => {
    const r = calcularOcupacao({ ...base, itens: [item('11:30', '13:00')] });
    expect(r.minutosOcupados).toBe(30);
  });
});

describe('calcularOcupacao — recortes', () => {
  it('separa por barbeiro, cada um com o próprio expediente', () => {
    const r = calcularOcupacao({
      ...base,
      expediente: [
        ...EXPEDIENTE,
        { staffId: 'b', weekday: 1, startTime: '09:00:00', endTime: '10:00:00' },
      ],
      itens: [item('09:00', '10:00'), item('09:00', '09:30', { staffId: 'b' })],
    });
    expect(r.porBarbeiro.get('a')).toMatchObject({ disponiveis: 180, ocupados: 60 });
    expect(r.porBarbeiro.get('b')).toMatchObject({ disponiveis: 60, ocupados: 30 });
    expect(r.minutosDisponiveis).toBe(240);
  });

  it('agrupa por dia da semana — é o que responde se a terça está vazia', () => {
    const semana = {
      ...JANELA_SEGUNDA,
      inicio: DateTime.fromISO('2026-08-10T00:00', { zone: TZ }).toJSDate(),
      fim: DateTime.fromISO('2026-08-17T00:00', { zone: TZ }).toJSDate(),
      periodo: 'semana' as const,
    };
    const r = calcularOcupacao({
      ...base,
      janela: semana,
      agora: DateTime.fromISO('2026-08-17T00:00', { zone: TZ }).toJSDate(),
      expediente: [
        { staffId: 'a', weekday: 1, startTime: '09:00:00', endTime: '12:00:00' },
        { staffId: 'a', weekday: 2, startTime: '09:00:00', endTime: '12:00:00' },
      ],
      itens: [item('09:00', '12:00')], // segunda cheia, terça vazia
    });
    const segunda = r.porDiaDaSemana.find((d) => d.weekday === 1);
    const terca = r.porDiaDaSemana.find((d) => d.weekday === 2);
    expect(segunda?.taxa).toBeCloseTo(1);
    expect(terca?.taxa).toBe(0);
  });

  it('agrupa por hora do dia', () => {
    const r = calcularOcupacao({ ...base, itens: [item('09:00', '10:00')] });
    expect(r.porHora.find((h) => h.hora === 9)?.taxa).toBeCloseTo(1);
    expect(r.porHora.find((h) => h.hora === 11)?.taxa).toBe(0);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/domain/indicadores/ocupacao.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar a ocupação**

Criar `src/domain/indicadores/ocupacao.ts`. O caminho: para cada dia da janela, para cada barbeiro, montar os intervalos de expediente daquele `weekday` em instantes absolutos (Luxon, no fuso da loja), subtrair `time_off` que intersecta, cortar no `agora` se o dia estiver em curso, e somar. O numerador é a interseção dos atendimentos não cancelados com esses intervalos.

Cuidado com fuso: `startTime`/`endTime` são hora local (`'09:00:00'`); os `Date` de atendimento e bloqueio são absolutos. A conversão local→absoluto é por dia, com `DateTime.fromISO(\`${dia}T${hora}\`, { zone })` — o mesmo idioma de `src/domain/availability/compute.ts`.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/domain/indicadores/ocupacao.test.ts`
Expected: PASS, 13 testes.

- [ ] **Step 5: A consulta**

Criar `src/db/repositories/indicadores.repo.ts` com `listarExpedienteEBloqueios(db, barbershopId, inicio, fim)`, devolvendo `{ expediente: BlocoDeTrabalho[]; bloqueios: Bloqueio[] }`. Exportar do `index.ts`.

Teste de integração em `tests/integration/indicadores.test.ts`: que a consulta traz só a barbearia pedida e só bloqueios que intersectam a janela.

- [ ] **Step 6: O gráfico**

`grafico-de-ocupacao.tsx`, client, com `ChartContainer` do shadcn sobre recharts. Barras por hora do dia. É o **único** gráfico da tela: a forma da curva é a informação, e onde afunda é onde promover.

Ligar o card de Ocupação da primeira dobra, com as horas vagas no apoio.

- [ ] **Step 7: Verificar e commitar**

Run: `DATABASE_URL_TEST=... npx vitest run && npx tsc --noEmit && npx eslint src tests && npm run build`

```bash
git add src/domain/indicadores src/db/repositories src/app/app/resumo tests/integration
git commit -m "feat(resumo): taxa de ocupação, horas vagas e ocupação por hora"
```

---

## Task 4: Cliente

**Files:**
- Create: `src/domain/indicadores/cliente.ts`, `src/app/app/resumo/clientes-sumidos.tsx`
- Modify: `src/db/repositories/indicadores.repo.ts`, `src/app/app/resumo/page.tsx`
- Test: `src/domain/indicadores/cliente.test.ts`

**Interfaces:**
- Consumes: `AtendimentoBruto` da Task 2
- Produces:
  - `type VisitaDoCliente = { customerId: string; nome: string; telefone: string; visitas: Date[] }`
  - `calcularClientes(historico: VisitaDoCliente[], janela: Janela): { atendidos: number; novos: number; recorrentes: number; diasEntreVisitas: number | null; taxaRetorno: number }`
  - `listarSumidos(historico: VisitaDoCliente[], agora: Date): { customerId: string; nome: string; telefone: string; ultimaVisita: Date; intervaloTipico: number; diasAtraso: number }[]`
  - `listarVieramUmaVezSo(historico: VisitaDoCliente[], agora: Date): { customerId: string; nome: string; telefone: string; unicaVisita: Date }[]`
  - `listarHistoricoDeClientes(db, barbershopId, desde)` em `indicadores.repo.ts`

- [ ] **Step 1: Escrever o teste — a definição de sumido é o que importa**

Criar `src/domain/indicadores/cliente.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { listarSumidos, listarVieramUmaVezSo, calcularClientes, type VisitaDoCliente } from './cliente';

const AGORA = new Date('2026-08-14T12:00:00Z');

function dias(n: number): Date {
  return new Date(AGORA.getTime() - n * 24 * 60 * 60 * 1000);
}

function cliente(nome: string, atras: number[]): VisitaDoCliente {
  return {
    customerId: nome, nome, telefone: '11999998888',
    visitas: atras.map(dias).sort((a, b) => a.getTime() - b.getTime()),
  };
}

describe('listarSumidos — o corte é o ritmo de cada um', () => {
  it('quem corta a cada 15 dias e sumiu há 40 está sumido', () => {
    const r = listarSumidos([cliente('Quinzenal', [100, 85, 70, 55, 40])], AGORA);
    expect(r.map((c) => c.nome)).toContain('Quinzenal');
  });

  it('quem corta a cada 60 dias e sumiu há 40 NÃO está sumido', () => {
    // este é o caso que a regra dos 30 dias erra, e é o motivo da métrica existir
    const r = listarSumidos([cliente('Bimestral', [220, 160, 100, 40])], AGORA);
    expect(r.map((c) => c.nome)).not.toContain('Bimestral');
  });

  it('o corte é 1,5x o intervalo típico', () => {
    // intervalo de 20 dias; 25 dias de ausência ainda não é sumiço
    expect(listarSumidos([cliente('Recente', [60, 40, 20, 25])], AGORA)).toHaveLength(0);
    // 40 dias passa de 1,5 x 20 = 30
    expect(listarSumidos([cliente('Atrasado', [100, 80, 60, 40])], AGORA)).toHaveLength(1);
  });

  it('usa mediana, não média — um retorno atrasado não pode distorcer o corte', () => {
    // intervalos: 15, 15, 15, 90 → média 34, mediana 15
    const r = listarSumidos([cliente('ComUmSumico', [150, 60, 45, 30, 25])], AGORA);
    expect(r).toHaveLength(1);
  });

  it('com menos de 3 visitas não há ritmo para medir', () => {
    expect(listarSumidos([cliente('Duas', [200, 150])], AGORA)).toHaveLength(0);
  });

  it('ordena pelo mais atrasado em relação ao próprio ritmo, não pelo mais antigo', () => {
    const r = listarSumidos(
      [
        cliente('PoucoAtrasado', [120, 90, 60, 30]), // ritmo 30, ausente 30 → 1,0x
        cliente('MuitoAtrasado', [80, 70, 60, 50]),  // ritmo 10, ausente 50 → 5,0x
      ],
      AGORA,
    );
    expect(r[0].nome).toBe('MuitoAtrasado');
  });

  it('devolve o número de dias de atraso, para a tela poder explicar', () => {
    const r = listarSumidos([cliente('X', [100, 85, 70, 40])], AGORA);
    expect(r[0].diasAtraso).toBeGreaterThan(0);
    expect(r[0].intervaloTipico).toBeGreaterThan(0);
  });
});

describe('listarVieramUmaVezSo', () => {
  it('separa quem veio uma vez e não voltou — é outro problema', () => {
    const r = listarVieramUmaVezSo([cliente('Unico', [90]), cliente('Fiel', [90, 60, 30])], AGORA);
    expect(r.map((c) => c.nome)).toEqual(['Unico']);
  });

  it('quem veio ontem pela primeira vez ainda não é caso perdido', () => {
    expect(listarVieramUmaVezSo([cliente('Ontem', [1])], AGORA)).toHaveLength(0);
  });
});

describe('calcularClientes', () => {
  const janela = { inicio: dias(7), fim: AGORA, rotulo: 'semana', periodo: 'semana' as const };

  it('novo é quem teve a primeira visita da vida dentro da janela', () => {
    const r = calcularClientes([cliente('Novo', [3]), cliente('Velho', [200, 100, 3])], janela);
    expect(r.novos).toBe(1);
    expect(r.recorrentes).toBe(1);
    expect(r.atendidos).toBe(2);
  });

  it('tempo médio entre visitas ignora quem só veio uma vez', () => {
    const r = calcularClientes([cliente('Um', [3]), cliente('Dois', [33, 3])], janela);
    expect(r.diasEntreVisitas).toBe(30);
  });

  it('sem histórico devolve nulo em vez de zero — zero dia entre visitas mentiria', () => {
    expect(calcularClientes([], janela).diasEntreVisitas).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar, ver falhar, implementar, ver passar**

Run: `npx vitest run src/domain/indicadores/cliente.test.ts`

A mediana é o detalhe que faz a métrica funcionar: com intervalos `[15, 15, 15, 90]` a média dá 34 e o corte vira 51 dias, deixando passar quem sumiu; a mediana dá 15 e o corte vira 22.

- [ ] **Step 3: A consulta e a tela**

`listarHistoricoDeClientes(db, barbershopId, desde)` — para cada cliente com `DONE`, as datas ordenadas. Um ano de histórico basta.

`clientes-sumidos.tsx`: lista com nome, "corta a cada X dias, sumiu há Y" e botão de WhatsApp com texto pronto — `wa.me` com mensagem sugerindo o retorno. Sem botão, é acusação e não ferramenta.

Card de Clientes: atendidos, novos vs recorrentes, tempo médio entre visitas, taxa de retorno.

- [ ] **Step 4: Verificar e commitar**

Run: `DATABASE_URL_TEST=... npx vitest run && npx tsc --noEmit && npx eslint src tests`

```bash
git add src/domain/indicadores src/db/repositories src/app/app/resumo
git commit -m "feat(resumo): clientes sumidos pelo ritmo de cada um, e retorno"
```

---

## Task 5: Comissão

O número central da operação, e o único que precisa de configuração.

**Files:**
- Create: `src/domain/indicadores/comissao.ts`, `src/app/app/comissao/page.tsx`, `src/app/app/resumo/tabela-por-barbeiro.tsx`
- Modify: `src/db/schema/staff.ts`, `src/app/app/equipe/[staffId]/page.tsx` e `actions.ts`, `src/app/app/resumo/page.tsx`
- Test: `src/domain/indicadores/comissao.test.ts`, `tests/integration/comissao.test.ts`

**Interfaces:**
- Consumes: `AtendimentoBruto` da Task 2, ocupação da Task 3
- Produces:
  - `staff.commissionPercent: integer | null` — inteiro de 0 a 100, nulo = sem comissão
  - `calcularComissao(itens: AtendimentoBruto[], barbeiros: { id: string; nome: string; percentual: number | null }[]): { staffId: string; nome: string; percentual: number; baseCents: number; comissaoCents: number; atendimentos: number }[]`
  - `detalharComissao(itens: AtendimentoBruto[], staffId: string, percentual: number): { appointmentId: string; quando: Date; servico: string; precoCents: number; comissaoCents: number }[]`

- [ ] **Step 1: Migration do percentual**

Acrescentar a `src/db/schema/staff.ts`:

```ts
/**
 * Percentual de comissão do barbeiro, inteiro de 0 a 100. Nulo = barbeiro sem
 * comissão (dono que não tira, ou quem aluga a cadeira), e a linha some do
 * relatório em vez de aparecer zerada.
 */
commissionPercent: integer('commission_percent'),
```

Rodar `npm run db:generate` e migrar.

- [ ] **Step 2: Escrever o teste da comissão**

Criar `src/domain/indicadores/comissao.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { calcularComissao, detalharComissao } from './comissao';
import type { AtendimentoBruto } from './dinheiro';

function item(over: Partial<AtendimentoBruto> = {}): AtendimentoBruto {
  return {
    id: crypto.randomUUID(), staffId: 'a', customerId: 'c1',
    startAt: new Date('2026-08-14T12:00:00Z'), endAt: new Date('2026-08-14T12:30:00Z'),
    status: 'DONE', origin: 'PUBLIC', precoCents: 5000, canceledAt: null, ...over,
  };
}

const BARBEIROS = [
  { id: 'a', nome: 'João', percentual: 40 },
  { id: 'b', nome: 'Pedro', percentual: 50 },
  { id: 'c', nome: 'Dono', percentual: null },
];

describe('calcularComissao', () => {
  it('aplica o percentual sobre o que o barbeiro produziu', () => {
    const r = calcularComissao([item(), item()], BARBEIROS);
    const joao = r.find((x) => x.staffId === 'a')!;
    expect(joao.baseCents).toBe(10000);
    expect(joao.comissaoCents).toBe(4000);
  });

  it('cada barbeiro com o próprio percentual', () => {
    const r = calcularComissao([item(), item({ staffId: 'b' })], BARBEIROS);
    expect(r.find((x) => x.staffId === 'a')!.comissaoCents).toBe(2000);
    expect(r.find((x) => x.staffId === 'b')!.comissaoCents).toBe(2500);
  });

  it('barbeiro sem percentual não aparece — nulo não é zero', () => {
    const r = calcularComissao([item({ staffId: 'c' })], BARBEIROS);
    expect(r.find((x) => x.staffId === 'c')).toBeUndefined();
  });

  it('falta e cancelamento não geram comissão', () => {
    const r = calcularComissao([item({ status: 'NO_SHOW' }), item({ status: 'CANCELED' })], BARBEIROS);
    expect(r.find((x) => x.staffId === 'a')?.comissaoCents ?? 0).toBe(0);
  });

  it('agendado do futuro não gera comissão: ainda não foi atendido', () => {
    const r = calcularComissao([item({ status: 'BOOKED' })], BARBEIROS);
    expect(r.find((x) => x.staffId === 'a')?.comissaoCents ?? 0).toBe(0);
  });

  it('arredonda o centavo para baixo, e a soma do detalhe bate com o total', () => {
    // 3333 centavos a 40% = 1333,2 → 1333
    const itens = [item({ precoCents: 3333 }), item({ precoCents: 3333 }), item({ precoCents: 3333 })];
    const total = calcularComissao(itens, BARBEIROS).find((x) => x.staffId === 'a')!;
    const detalhe = detalharComissao(itens, 'a', 40);
    expect(detalhe.reduce((s, d) => s + d.comissaoCents, 0)).toBe(total.comissaoCents);
  });
});

describe('detalharComissao', () => {
  it('devolve uma linha por atendimento — é o que encerra a discussão do fechamento', () => {
    const d = detalharComissao([item(), item()], 'a', 40);
    expect(d).toHaveLength(2);
    expect(d[0].comissaoCents).toBe(2000);
  });

  it('só do barbeiro pedido', () => {
    expect(detalharComissao([item(), item({ staffId: 'b' })], 'a', 40)).toHaveLength(1);
  });
});
```

Repare no caso do arredondamento: se o total for calculado sobre a soma e o detalhe linha a linha, os dois divergem em centavos — e é exatamente o tipo de divergência que gera a briga que a funcionalidade existe para evitar. O total tem que ser a soma das linhas.

- [ ] **Step 3: Rodar, ver falhar, implementar, ver passar**

Run: `npx vitest run src/domain/indicadores/comissao.test.ts`
Expected: PASS, 8 testes.

- [ ] **Step 4: Configuração no cadastro do barbeiro**

Em `src/app/app/equipe/[staffId]/page.tsx`, campo de percentual (0 a 100, vazio = sem comissão), com validação na action. Escopo por `barbershopId` como todas as outras actions do arquivo.

Teste de integração em `tests/integration/comissao.test.ts`: percentual fora da faixa é recusado, e barbeiro de outra barbearia não pode ser editado.

- [ ] **Step 5: A tabela por barbeiro e a tela de detalhe**

`tabela-por-barbeiro.tsx`: `Table` do shadcn no desktop, lista de `Card` no celular. Colunas: barbeiro, atendimentos, faturamento, ticket médio, ocupação, taxa de falta, clientes novos, **taxa de retorno** e comissão.

A taxa de retorno por barbeiro (§3.5 do spec) reusa `calcularClientes` da Task 4, filtrando o histórico por `staffId`. É a métrica que separa "tem clientela própria" de "pega o que cai" — 8 de 19 produtos têm, nenhum brasileiro com esse recorte.

`src/app/app/comissao/page.tsx`: por barbeiro e período, uma linha por atendimento com data, cliente, serviço, valor e comissão, e o total no rodapé.

- [ ] **Step 6: Verificar e commitar**

Run: `DATABASE_URL_TEST=... npx vitest run && npx tsc --noEmit && npx eslint src tests && npm run build`

```bash
git add src/domain/indicadores src/db src/app/app drizzle tests
git commit -m "feat(comissao): percentual por barbeiro e fechamento atendimento a atendimento"
```

---

## Task 6: Estados vazios, e2e e a direção

**Files:**
- Modify: os componentes de `src/app/app/resumo/`, `docs/superpowers/design/2026-08-07-direcao-de-ui.md`
- Test: `tests/e2e/resumo.spec.ts`

- [ ] **Step 1: Os três estados vazios**

O spec é explícito em que aqui não é detalhe:

- **Barbearia sem histórico** — não mostrar `0,0%` em tudo. Dizer que os números aparecem depois dos primeiros atendimentos.
- **Período sem atendimento** — "nenhum atendimento nesta semana", com atalho para a semana anterior.
- **Barbeiro sem comissão configurada** — link para configurar, não zero.

- [ ] **Step 2: O e2e**

Criar `tests/e2e/resumo.spec.ts`: com a barbearia semeada, entrar no painel, abrir Resumo, e conferir que os quatro cards da primeira dobra aparecem com número, que trocar para Mês muda a URL e o conteúdo, e que a barbearia sem atendimento mostra o estado vazio em vez de zeros.

- [ ] **Step 3: Atualizar a direção de UI**

O documento não menciona tela de indicadores. Acrescentar a seção descrevendo o padrão de card de número (número em `tabular-nums`, título em `muted-foreground`, explicação no tooltip) e a regra de que **gráfico só entra quando a forma da curva é a informação** — hoje isso vale para um só, a ocupação por hora.

- [ ] **Step 4: Verificação final**

```bash
docker exec barbearia-postgres psql -U barbearia -d postgres -c "DROP DATABASE IF EXISTS barbearia_ind"
docker exec barbearia-postgres psql -U barbearia -d postgres -c "CREATE DATABASE barbearia_ind"
DATABASE_URL_TEST=postgres://barbearia:barbearia@localhost:5433/barbearia_ind npx tsx src/db/migrate.ts
DATABASE_URL_TEST=postgres://barbearia:barbearia@localhost:5433/barbearia_ind npx vitest run
DATABASE_URL_TEST=postgres://barbearia:barbearia@localhost:5433/barbearia_ind npx vitest run
npx tsc --noEmit && npx eslint src tests && npm run build && npx playwright test
```

Expected: suíte verde duas vezes no mesmo banco, e2e passando.

- [ ] **Step 5: Commit**

```bash
git add src docs tests
git commit -m "feat(resumo): estados vazios, e2e e direção atualizada"
```

---

## Ordem

1 é bloqueante. Depois dela, 2, 3 e 4 são independentes entre si — 2 e 4 mexem só em `src/domain/indicadores/` e na página, 3 acrescenta o repositório. A 5 depende da 3 (a tabela por barbeiro mostra ocupação). A 6 fecha.

Cada task entrega tela funcionando. Se o tempo acabar na 3, o dono já tem faturamento, ticket, falta e ocupação — que é mais do que qualquer concorrente brasileiro entrega.

## O risco

**A ocupação é a conta que mais erra calado.** Denominador errado não quebra teste nem estoura tela: só mostra 45% onde é 80%, e o dono toma decisão errada com número que parece certo. Por isso a Task 3 tem 13 testes, e a maioria é sobre o denominador — bloqueio, dia em curso, dia sem expediente, atendimento que vaza da borda.

**O segundo risco é a comissão.** Divergência de centavo entre o total e a soma do detalhe destrói a confiança na funcionalidade inteira, porque é justamente na conferência linha a linha que o barbeiro vai olhar.

## Fora de escopo, com decisão registrada

Custo, margem e lucro real (Fase 3, exige três números do dono); caixa contra faturamento; estoque e retail attachment; rebooking rate (o fluxo não tem remarcação, então nasceria zerado); coorte de retenção (precisa de 6 a 12 meses); clube de assinatura; alerta proativo; e comissão progressiva, por serviço, de produto e o modelo Salão Parceiro — este último muda o modelo de dados quando entrar, porque exige separar cota-parte por atendimento.
