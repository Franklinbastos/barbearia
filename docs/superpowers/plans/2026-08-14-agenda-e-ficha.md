# Agenda e ficha do cliente — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tirar o ruído da agenda e pôr informação na ficha do cliente, seguindo o que a pesquisa de mercado mostrou.

**Architecture:** As duas telas erram em direções opostas. A agenda tem informação demais competindo — quarenta botões num dia de vinte atendimentos — e falta o gesto que todo produto do ramo tem: clicar no vazio para agendar. A ficha do cliente tem o contrário: o cálculo existe inteiro em `src/domain/indicadores/` e nada chega na tela. O plano começa pelo dado (função pura, testável), depois trata cada tela, e fecha com uma varredura dos padrões — tamanho de controle, calendário, navegação de data e espaçamento — contra o que a pesquisa registrou.

**Tech Stack:** Next.js 15 App Router · React 19 · TypeScript strict · Tailwind v4 · shadcn (`base-nova`, `@base-ui/react`) · Luxon · Vitest · Playwright

**Spec:** `docs/superpowers/specs/2026-08-14-agenda-e-ficha-do-cliente-design.md` — argumenta cada decisão com a fonte. Leia antes de qualquer task.

## Global Constraints

- Diretório: `/home/franklin/dev/barbearia`. Branch `main`. npm.
- **Texto literal não muda**: `Compareceu`, `Não veio`, `Encaixe`, `Desfazer`, `Cancelar`, `Confirmar cancelamento`, `Qualquer barbeiro`. Há e2e casando por nome acessível.
- **Acessibilidade não regride.** Duas regras específicas deste plano:
  - Ação que aparece no ponteiro **tem que aparecer no foco de teclado também** (`focus-within`), senão ela não existe para quem navega por Tab.
  - Ação que sai da vista no desktop **continua na árvore de acessibilidade** — esconder é `opacity`/`visibility` controlado por CSS, nunca `display:none` condicionado a hover, e nunca remoção do DOM.
- **Altura de controle**: 36px (`--altura-controle`) ou 44px (`--tap-min`) em alvo de toque. Qualquer outra é defeito.
- **Largura**: só a régua (`src/components/ui/largura.tsx`) — `formulario` 520, `tabela` 880, `leitura` 1120, `cheia`. `max-w-[Npx]` solto é reprovado por `tests/unit/regua-de-largura.test.ts`.
- **Nada rola de lado em 360px.** Coberto por `tests/e2e/painel-acabamento.spec.ts`.
- **Fuso da barbearia sempre.** Nunca `new Date('YYYY-MM-DD')` nem `toISOString().slice(0,10)`. Use `src/lib/data-local.ts` e `src/lib/format.ts`.
- UI vem do shadcn pelo CLI (`npx shadcn@latest add <nome>`); componente de domínio segue `cva` + `cn()` + `data-slot` + `React.ComponentProps`, sem `forwardRef`.
- **Não subir dev server, navegador ou Playwright em subagente** — derruba a VM do WSL.
- Teste: `DATABASE_URL_TEST=postgres://barbearia:barbearia@localhost:5433/<banco próprio> npx vitest run`. Nunca o banco `barbearia`.
- Commits em pt-BR: `tipo(area): resultado para o usuário`. Quem commita é o orquestrador.

## Mapa de arquivos

**Nasce:**

| Arquivo | Responsabilidade |
|---|---|
| `src/domain/indicadores/perfil-do-cliente.ts` | os quatro números de um cliente, função pura |
| `src/app/app/clientes/[customerId]/indicadores-do-cliente.tsx` | a faixa de quatro cartões |
| `src/app/app/clientes/[customerId]/historico.tsx` | a lista com filtro de status (client component) |
| `src/app/app/agenda/vao-livre.tsx` | a faixa clicável entre dois atendimentos |

**Mudam:** `src/db/repositories/customer.repo.ts`, `src/domain/indicadores/cliente.ts`, `clientes/[customerId]/{page,anonymize-button}.tsx`, `agenda/{day-grid,cartao-da-agenda,barra-de-data,manual-booking-form}.tsx`.

---

## Task 1: O perfil do cliente, em função pura

Bloqueante: as tasks 2 e 3 consomem o tipo que nasce aqui.

**Files:**
- Create: `src/domain/indicadores/perfil-do-cliente.ts`, `src/domain/indicadores/perfil-do-cliente.test.ts`
- Modify: `src/domain/indicadores/cliente.ts`, `src/db/repositories/customer.repo.ts`

**Interfaces:**
- Produces:
  ```ts
  export type AtendimentoDoCliente = {
    startAt: Date;
    status: 'BOOKED' | 'DONE' | 'NO_SHOW' | 'CANCELED';
    serviceName: string;
    priceCents: number;
    staffName: string;
  };

  export type PerfilDoCliente = {
    /** Soma dos DONE, em centavos. Só o que foi atendido virou dinheiro. */
    totalGastoCents: number;
    /** Quantos DONE. É o "em N atendimentos" do cartão. */
    atendimentos: number;
    /** Mediana dos intervalos entre visitas, em dias. `null` com menos de 2 visitas. */
    intervaloTipico: number | null;
    /** A última visita concluída. `null` se nunca veio. */
    ultimaVisita: Date | null;
    /** Dias desde a última visita. `null` se nunca veio. */
    diasSemVir: number | null;
    /** NO_SHOW / (DONE + NO_SHOW). `null` quando a base é zero — traço, nunca 0%. */
    taxaDeFalta: number | null;
    faltas: number;
    /** O mais frequente entre os DONE. `null` no empate ou sem base. */
    servicoPreferido: string | null;
    barbeiroPreferido: string | null;
    /** `true` quando passou de 1,5× o próprio ritmo. Mesma regra de `listarSumidos`. */
    sumido: boolean;
  };

  export function calcularPerfilDoCliente(
    atendimentos: AtendimentoDoCliente[],
    agora: Date,
  ): PerfilDoCliente;
  ```
- Consumes: `mediana` e `intervalos` de `cliente.ts` — hoje privadas; **exporte-as** em vez de recopiar. Duas cópias da mediana divergiriam no primeiro ajuste, e é ela que faz a métrica funcionar (a doc do arquivo explica: com intervalos 15/15/15/90 a média dá 34 e deixa passar quem sumiu; a mediana dá 15).

- [ ] **Step 1: Escrever o teste**

Criar `src/domain/indicadores/perfil-do-cliente.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { calcularPerfilDoCliente, type AtendimentoDoCliente } from './perfil-do-cliente';

const AGORA = new Date('2026-08-14T12:00:00Z');

function visita(dias: number, extra: Partial<AtendimentoDoCliente> = {}): AtendimentoDoCliente {
  return {
    startAt: new Date(AGORA.getTime() - dias * 86_400_000),
    status: 'DONE',
    serviceName: 'Corte',
    priceCents: 5000,
    staffName: 'Marcão',
    ...extra,
  };
}

describe('calcularPerfilDoCliente', () => {
  it('só o atendido vira dinheiro', () => {
    const p = calcularPerfilDoCliente(
      [visita(30), visita(15), visita(1, { status: 'NO_SHOW' }), visita(0, { status: 'BOOKED' })],
      AGORA,
    );
    // o agendado de hoje e a falta não somam: um ainda não aconteceu, o outro não rendeu
    expect(p.totalGastoCents).toBe(10_000);
    expect(p.atendimentos).toBe(2);
  });

  it('o ritmo é a mediana, não a média', () => {
    // 15/15/15/90 — a média dá 34 e esconde quem sumiu; a mediana dá 15
    const p = calcularPerfilDoCliente(
      [visita(135), visita(45), visita(30), visita(15), visita(0)],
      AGORA,
    );
    expect(p.intervaloTipico).toBe(15);
  });

  it('sem duas visitas não há ritmo', () => {
    expect(calcularPerfilDoCliente([visita(10)], AGORA).intervaloTipico).toBeNull();
    expect(calcularPerfilDoCliente([], AGORA).intervaloTipico).toBeNull();
  });

  it('taxa de falta é traço quando não há base, nunca zero', () => {
    // 0% e "nunca teve chance de faltar" são coisas diferentes, e a tela não pode confundir
    expect(calcularPerfilDoCliente([visita(0, { status: 'BOOKED' })], AGORA).taxaDeFalta).toBeNull();
    expect(calcularPerfilDoCliente([], AGORA).taxaDeFalta).toBeNull();
  });

  it('taxa de falta conta falta sobre o que foi marcado e chegou a acontecer', () => {
    const p = calcularPerfilDoCliente(
      [visita(30), visita(20), visita(10, { status: 'NO_SHOW' }), visita(5, { status: 'CANCELED' })],
      AGORA,
    );
    // cancelado não entra: o horário voltou para a grade, ninguém deixou a cadeira vazia
    expect(p.faltas).toBe(1);
    expect(p.taxaDeFalta).toBeCloseTo(1 / 3);
  });

  it('preferido é o mais frequente entre os atendidos, e empate não elege', () => {
    const p = calcularPerfilDoCliente(
      [visita(30), visita(20), visita(10, { serviceName: 'Barba' })],
      AGORA,
    );
    expect(p.servicoPreferido).toBe('Corte');

    const empate = calcularPerfilDoCliente(
      [visita(30), visita(10, { serviceName: 'Barba' })],
      AGORA,
    );
    expect(empate.servicoPreferido).toBeNull();
  });

  it('barbeiro preferido sai do mesmo critério', () => {
    const p = calcularPerfilDoCliente(
      [visita(30), visita(20), visita(10, { staffName: 'Tiago' })],
      AGORA,
    );
    expect(p.barbeiroPreferido).toBe('Marcão');
  });

  it('sumido é passar de 1,5x o próprio ritmo', () => {
    // ritmo 15; ausente há 30 → 30 > 22,5
    const sumiu = calcularPerfilDoCliente([visita(60), visita(45), visita(30)], AGORA);
    expect(sumiu.intervaloTipico).toBe(15);
    expect(sumiu.diasSemVir).toBe(30);
    expect(sumiu.sumido).toBe(true);

    // mesmo ritmo, ausente há 10 → dentro
    const emDia = calcularPerfilDoCliente([visita(40), visita(25), visita(10)], AGORA);
    expect(emDia.sumido).toBe(false);
  });

  it('quem nunca veio não some', () => {
    const p = calcularPerfilDoCliente([visita(0, { status: 'BOOKED' })], AGORA);
    expect(p.ultimaVisita).toBeNull();
    expect(p.diasSemVir).toBeNull();
    expect(p.sumido).toBe(false);
  });

  it('duas visitas no mesmo dia contam como uma', () => {
    // corte e barba na mesma cadeira são uma ida, não duas — senão o ritmo despenca
    const p = calcularPerfilDoCliente(
      [visita(30), visita(30, { serviceName: 'Barba' }), visita(15)],
      AGORA,
    );
    expect(p.intervaloTipico).toBe(15);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/domain/indicadores/perfil-do-cliente.test.ts`
Expected: FAIL — `Cannot find module './perfil-do-cliente'`.

- [ ] **Step 3: Implementar**

Escreva `perfil-do-cliente.ts`. Exporte `mediana`, `intervalos` e `visitasDistintas` de `cliente.ts` e use — não recopie. O último teste (duas visitas no mesmo dia) é exatamente o que `visitasDistintas` já resolve lá, e o comentário dela explica por quê.

O cabeçalho do arquivo diz o que a spec decidiu: cada número aqui tem um dono no mercado (total gasto é universal; taxa de falta a Booksy mostra; o ritmo por mediana a Phorest calcula por cliente depois de três visitas, como nós) — e por que `null` não é zero.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/domain/indicadores/perfil-do-cliente.test.ts && npx vitest run src/domain/indicadores/`
Expected: PASS. `cliente.test.ts` continua passando sem alteração — exportar função privada não muda comportamento.

- [ ] **Step 5: O barbeiro na query**

`listCustomerHistory` (`src/db/repositories/customer.repo.ts:58`) devolve id, startAt, status, serviceName, priceCents. Falta o barbeiro. Acrescente `staffName: staff.name` com `innerJoin` em `staff`, mantendo o `limit(100)` e a ordem.

Confira em `tests/integration/` se há teste dessa função; se houver, ele tem que cobrir o campo novo.

- [ ] **Step 6: Verificar e commitar**

Run: `DATABASE_URL_TEST=postgres://barbearia:barbearia@localhost:5433/barbearia_p1 npx vitest run && npx tsc --noEmit && npx eslint src`

```bash
git add src/domain/indicadores src/db/repositories/customer.repo.ts
git commit -m "feat(indicadores): o perfil de um cliente em função pura"
```

---

## Task 2: A ficha do cliente

**Files:**
- Create: `src/app/app/clientes/[customerId]/indicadores-do-cliente.tsx`, `.test.tsx`
- Create: `src/app/app/clientes/[customerId]/historico.tsx`, `.test.tsx`
- Modify: `clientes/[customerId]/page.tsx`, `anonymize-button.tsx`, `loading.tsx`

**Interfaces:**
- Consumes: `calcularPerfilDoCliente`, `PerfilDoCliente` da Task 1; `CartaoIndicador` de `src/app/app/resumo/cartao-indicador.tsx`; `Segmentado` de `src/components/ui/segmentado.tsx`; `Monograma`, `Badge`, `Largura`.

- [ ] **Step 1: Escrever o teste dos indicadores**

Criar `indicadores-do-cliente.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IndicadoresDoCliente } from './indicadores-do-cliente';
import type { PerfilDoCliente } from '@/domain/indicadores/perfil-do-cliente';

const BASE: PerfilDoCliente = {
  totalGastoCents: 25_000, atendimentos: 5, intervaloTipico: 15,
  ultimaVisita: new Date('2026-07-12T14:00:00Z'), diasSemVir: 33,
  taxaDeFalta: 0.2, faltas: 1, servicoPreferido: 'Corte',
  barbeiroPreferido: 'Marcão', sumido: true,
};

describe('IndicadoresDoCliente', () => {
  it('mostra os quatro cartões', () => {
    render(<IndicadoresDoCliente perfil={BASE} timeZone="America/Sao_Paulo" />);
    expect(screen.getByText('R$ 250,00')).toBeInTheDocument();
    expect(screen.getByText('em 5 atendimentos')).toBeInTheDocument();
    expect(screen.getByText(/15 dias/)).toBeInTheDocument();
    expect(screen.getByText('20%')).toBeInTheDocument();
    expect(screen.getByText('Corte')).toBeInTheDocument();
  });

  it('sem base, o número vira traço — nunca zero', () => {
    // "0% de falta" e "nunca teve chance de faltar" são coisas diferentes
    const novo = { ...BASE, taxaDeFalta: null, faltas: 0, intervaloTipico: null };
    render(<IndicadoresDoCliente perfil={novo} timeZone="America/Sao_Paulo" />);
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('todo cartão explica como o número sai', () => {
    // o `explicacao` do CartaoIndicador é obrigatório de propósito: "corta a cada
    // 15 dias" sem dizer que é mediana não é número em que o dono confia
    const { container } = render(<IndicadoresDoCliente perfil={BASE} timeZone="America/Sao_Paulo" />);
    const cartoes = container.querySelectorAll('[data-slot="card"]');
    expect(cartoes.length).toBe(4);
    cartoes.forEach((c) => {
      expect(c.querySelector('[aria-label*="Como"], [aria-label*="calcul"]')).not.toBeNull();
    });
  });
});
```

O último caso depende de como o `CartaoIndicador` rotula o gatilho do `Popover` — **abra `src/app/app/resumo/cartao-indicador.tsx` e case com o que está lá**, em vez de assumir.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/app/app/clientes`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar a faixa de indicadores**

Quatro `<CartaoIndicador>` na grade da §5.12 (`grid-cols-1 sm:grid-cols-2 xl:grid-cols-4`), exatamente como `/app/resumo` faz — **abra `resumo/page.tsx:274` e use a mesma grade**, não uma parecida.

| Cartão | Valor | Apoio | Explicação (o `Popover`) |
|---|---|---|---|
| Total gasto | `R$ 250,00` | `em 5 atendimentos` | soma do que ele já pagou; agendamento futuro e falta não entram |
| Corta a cada | `15 dias` | `última visita em 12 de julho` | **mediana** dos intervalos dele, não a média — e por que isso importa |
| Faltas | `20%` | `1 falta de 5` | falta sobre o que foi marcado e aconteceu; cancelado não conta, porque o horário voltou para a grade |
| Preferidos | `Corte` | `com Marcão` | o mais frequente entre os atendidos; empate não elege |

Formatação vem de `src/lib/format.ts` (`formatPrice`) — o cartão não formata nada, e a data por extenso segue o fuso da loja.

- [ ] **Step 4: A identidade e o selo**

Em `page.tsx`: `← Clientes`, `<Monograma nome tamanho={56} />`, nome, telefone. Ao lado do nome, **no máximo um** `<Badge>`, e só quando for verdade:

- `Sumido há 33 dias` — quando `perfil.sumido`
- `Cliente novo` — quando `atendimentos <= 1`

Nunca os dois. Se as duas condições baterem, sumido ganha: é a que pede ação.

- [ ] **Step 5: O histórico com filtro**

`historico.tsx`, client component. A lista de 72px que já existe em `page.tsx`, mais um `<Segmentado>` acima com `Todos / Concluídos / Faltas` — é o padrão de Fresha e Square, e o `Segmentado` já existe com a API `{ opcoes, valor, aoTrocar, rotuloDoGrupo }`.

O filtro é estado de cliente, não querystring: é leitura rápida durante um atendimento, não link para compartilhar.

Quando o filtro esvazia a lista, o vazio diz qual filtro está ligado — "Nenhuma falta registrada", não "Nenhum atendimento ainda", que é a frase de quem nunca veio.

- [ ] **Step 6: O botão de anonimizar**

Fica onde está — rodapé, separado por `border-t`, só para o dono. O que muda é o nome na confirmação: nomeie o cliente. "Confirmar remoção" vira **"Remover os dados de Marcos"** — o NN/g manda nomear o objeto e rotular o botão com o resultado, nunca com "Sim".

Se `anonymize-button.tsx` usa `<BotaoDeConfirmacao>`, passe o nome por prop; não recopie o componente.

- [ ] **Step 7: Verificar e commitar**

Run: `DATABASE_URL_TEST=postgres://barbearia:barbearia@localhost:5433/barbearia_p2 npx vitest run src/app/app/clientes src/domain && npx tsc --noEmit`

```bash
git add "src/app/app/clientes/[customerId]"
git commit -m "feat(clientes): a ficha mostra quanto ele gasta, de quanto em quanto tempo vem e se sumiu"
```

---

## Task 3: A agenda para de gritar

Três mudanças no cartão. É a task que resolve o "está feia" do desktop.

**Files:**
- Modify: `src/app/app/agenda/cartao-da-agenda.tsx`
- Test: `src/app/app/agenda/cartao-da-agenda.test.tsx`

- [ ] **Step 1: Escrever o teste**

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CartaoDaAgenda } from './cartao-da-agenda';

const ITEM = {
  id: 'a1', customerName: 'Marcos', customerPhone: '11999999999',
  serviceName: 'Corte', servicePriceCents: 5000, staffId: 's1', staffName: 'Marcão',
  status: 'BOOKED' as const, origin: 'PUBLIC' as const,
  startAt: new Date('2026-08-14T13:00:00Z'), endAt: new Date('2026-08-14T13:30:00Z'),
};

const props = {
  timeZone: 'America/Sao_Paulo',
  corDoBarbeiro: 'var(--linha)',
  agora: new Date('2026-08-14T12:00:00Z'),
};

describe('CartaoDaAgenda', () => {
  it('as ações continuam na árvore de acessibilidade mesmo recolhidas', () => {
    // esconder no desktop é decisão visual; sumir do DOM tiraria a ação de quem
    // navega por teclado e de quem usa leitor de tela
    render(<CartaoDaAgenda item={ITEM} {...props} />);
    expect(screen.getByRole('button', { name: 'Compareceu' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Não veio' })).toBeInTheDocument();
  });

  it('o bloco de ações reage a foco, não só a ponteiro', () => {
    // `group-hover` sozinho é ação que não existe para quem usa Tab
    const { container } = render(<CartaoDaAgenda item={ITEM} {...props} />);
    const acoes = container.querySelector('[data-slot="acoes-do-cartao"]');
    expect(acoes?.className).toMatch(/focus-within/);
  });

  it('atendimento curto ocupa menos que atendimento longo', () => {
    // a duração é o assunto da tela e hoje não aparece em lugar nenhum
    const curto = render(<CartaoDaAgenda item={ITEM} {...props} />);
    const cartaoCurto = curto.container.querySelector('[data-slot="cartao-da-agenda"]');
    expect(cartaoCurto?.getAttribute('data-forma')).toBe('compacto');

    const longo = render(
      <CartaoDaAgenda
        item={{ ...ITEM, id: 'a2', endAt: new Date('2026-08-14T14:00:00Z') }}
        {...props}
      />,
    );
    const cartaoLongo = longo.container.querySelector('[data-slot="cartao-da-agenda"][data-forma]');
    expect(cartaoLongo?.getAttribute('data-forma')).toBe('completo');
  });

  it('cancelado se distingue por forma, não só por cor', () => {
    // quem não distingue cor precisa enxergar o estado; o traço no nome resolve
    const { container } = render(
      <CartaoDaAgenda item={{ ...ITEM, status: 'CANCELED' }} {...props} />,
    );
    expect(container.querySelector('[data-slot="cartao-da-agenda"]')?.className).toMatch(
      /border-dashed/,
    );
  });
});
```

Ajuste os campos de `ITEM` ao tipo real — **abra `day-grid.tsx` e copie a forma de `AgendaAppointment`**.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/app/app/agenda/cartao-da-agenda.test.tsx`

- [ ] **Step 3: A ação recolhe no desktop**

Hoje "Compareceu" e "Não veio" estão sempre visíveis. Num dia de vinte atendimentos são quarenta botões de ~400px empilhados no bloco de 880px, e a informação some no meio deles.

No desktop eles aparecem quando o ponteiro entra na linha **ou quando qualquer filho recebe foco** — `group-hover` e `group-focus-within` juntos, sempre os dois. No celular continuam sempre visíveis: não há ponteiro, e lá eles são o motivo de a tela existir.

Recolher é `opacity` + `pointer-events`, **nunca `display:none` nem remoção do DOM** — a ação tem que continuar alcançável por Tab e anunciável por leitor de tela. Reserve o espaço para a linha não saltar quando o botão aparece.

- [ ] **Step 4: A forma muda com a duração**

`data-forma` calculado da duração, como o Cal.com faz — decidindo pelo **conteúdo**, não pela altura renderizada, que é o que aguenta mudança de densidade:

- abaixo de 40 min → `compacto`: hora, nome e serviço numa linha
- 40 a 45 min → `medio`: duas linhas
- acima → `completo`: como está hoje

O telefone como link de 44px sai do cartão compacto e continua na folha do `⋯` — é o que faz a linha curta caber numa linha.

- [ ] **Step 5: Status por forma, cor livre para o barbeiro**

A cor já é identidade do barbeiro (aresta de 4px, §3.5) e não pode virar status também. O Cal.com resolve com `cva`: borda tracejada para o que não está confirmado, tracejado com `line-through` para o cancelado. A etiqueta de estado continua — o que muda é que agora o estado se lê sem ela.

- [ ] **Step 6: Verificar e commitar**

Run: `DATABASE_URL_TEST=postgres://barbearia:barbearia@localhost:5433/barbearia_p3 npx vitest run src/app/app/agenda && npx tsc --noEmit`

```bash
git add src/app/app/agenda/cartao-da-agenda.tsx src/app/app/agenda/cartao-da-agenda.test.tsx
git commit -m "fix(agenda): a ação recolhe no desktop e o cartão encolhe com a duração"
```

---

## Task 4: O vão livre vira o jeito de agendar

O ganho maior desta rodada. Em Fresha, Square, Vagaro, Acuity e Cal.com, clicar no vazio é o jeito primário de agendar; aqui o encaixe é um botão que pede a hora que a pessoa já apontou com o dedo.

**Files:**
- Create: `src/app/app/agenda/vao-livre.tsx`, `vao-livre.test.tsx`
- Modify: `src/app/app/agenda/day-grid.tsx`, `day-grid.test.ts`, `manual-booking-form.tsx`

**Interfaces:**
- Produces: `buildVaosLivres(itens, staffList, duracaoMinima, timeZone): VaoLivre[]` — função **pura e exportada**, testável sem DOM, no mesmo espírito do `buildDayList` que já vive nesse arquivo.
  ```ts
  export type VaoLivre = { inicio: Date; fim: Date; minutos: number; staffId: string };
  ```

- [ ] **Step 1: Escrever o teste da função pura**

```ts
import { describe, it, expect } from 'vitest';
import { buildVaosLivres } from './vao-livre';

const d = (h: number, m = 0) => new Date(`2026-08-14T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`);

describe('buildVaosLivres', () => {
  it('acha o buraco entre dois atendimentos do mesmo barbeiro', () => {
    const vaos = buildVaosLivres(
      [
        { staffId: 's1', startAt: d(9), endAt: d(9, 30), status: 'BOOKED' },
        { staffId: 's1', startAt: d(11), endAt: d(11, 30), status: 'BOOKED' },
      ],
      [{ id: 's1', name: 'Marcão' }],
      30,
    );
    expect(vaos).toHaveLength(1);
    expect(vaos[0]!.minutos).toBe(90);
  });

  it('ignora buraco menor que o serviço mais curto da loja', () => {
    // faixa que não cabe ninguém é ruído: ocupa linha e não leva a lugar nenhum
    const vaos = buildVaosLivres(
      [
        { staffId: 's1', startAt: d(9), endAt: d(9, 30), status: 'BOOKED' },
        { staffId: 's1', startAt: d(9, 45), endAt: d(10, 15), status: 'BOOKED' },
      ],
      [{ id: 's1', name: 'Marcão' }],
      30,
    );
    expect(vaos).toEqual([]);
  });

  it('cancelado não ocupa: o horário voltou para a grade', () => {
    const vaos = buildVaosLivres(
      [
        { staffId: 's1', startAt: d(9), endAt: d(9, 30), status: 'BOOKED' },
        { staffId: 's1', startAt: d(10), endAt: d(10, 30), status: 'CANCELED' },
        { staffId: 's1', startAt: d(11), endAt: d(11, 30), status: 'BOOKED' },
      ],
      [{ id: 's1', name: 'Marcão' }],
      30,
    );
    expect(vaos).toHaveLength(1);
    expect(vaos[0]!.minutos).toBe(90);
  });

  it('falta ocupa: a cadeira ficou reservada e ninguém pôde usar', () => {
    const vaos = buildVaosLivres(
      [
        { staffId: 's1', startAt: d(9), endAt: d(9, 30), status: 'BOOKED' },
        { staffId: 's1', startAt: d(10), endAt: d(10, 30), status: 'NO_SHOW' },
      ],
      [{ id: 's1', name: 'Marcão' }],
      30,
    );
    expect(vaos[0]!.fim).toEqual(d(10));
  });

  it('cada barbeiro tem o próprio buraco', () => {
    const vaos = buildVaosLivres(
      [
        { staffId: 's1', startAt: d(9), endAt: d(9, 30), status: 'BOOKED' },
        { staffId: 's1', startAt: d(11), endAt: d(11, 30), status: 'BOOKED' },
        { staffId: 's2', startAt: d(9), endAt: d(11, 30), status: 'BOOKED' },
      ],
      [{ id: 's1', name: 'Marcão' }, { id: 's2', name: 'Tiago' }],
      30,
    );
    expect(vaos.map((v) => v.staffId)).toEqual(['s1']);
  });

  it('dia vazio não vira uma faixa gigante', () => {
    // o vão existe ENTRE atendimentos; o dia sem nada já tem o seu estado vazio
    expect(buildVaosLivres([], [{ id: 's1', name: 'Marcão' }], 30)).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar, ver falhar, implementar**

A regra de status é a mesma que `src/domain/indicadores/ocupacao.ts` já usa e testa: **`NO_SHOW` ocupa** (a cadeira estava reservada, ninguém pôde usar), **`CANCELED` não ocupa** (voltou para a grade). Não invente uma segunda regra — leia a de lá.

`duracaoMinima` vem do menor `durationMinutes` entre os serviços ativos, que `agenda/page.tsx` já carrega em `listActiveServices`.

- [ ] **Step 3: A faixa na lista**

Entre dois cartões, uma **faixa discreta** — não um cartão: altura de uma linha, borda tracejada, texto "1h30 livre com Marcão". Clicar abre a folha de encaixe **com a hora e o barbeiro já preenchidos**.

É `<button>` de verdade, com `aria-label` dizendo a ação inteira ("Encaixar às 9:30 com Marcão"), alvo de 44px, e nunca `<div onClick>`.

Com um barbeiro só, a faixa não repete o nome dele.

- [ ] **Step 4: A folha recebe a hora**

`ManualBookingForm` hoje abre com a data do dia e o resto em branco. Ganha props opcionais de hora inicial e barbeiro; quando vêm preenchidas, os campos já chegam escolhidos. Sem elas, o comportamento é o de hoje — o botão "Encaixe" do topo continua funcionando igual.

- [ ] **Step 5: Verificar e commitar**

Run: `DATABASE_URL_TEST=postgres://barbearia:barbearia@localhost:5433/barbearia_p4 npx vitest run src/app/app/agenda && npx tsc --noEmit`

```bash
git add src/app/app/agenda
git commit -m "feat(agenda): clicar no vão livre abre o encaixe com a hora pronta"
```

---

## Task 5: Padrões — controle, calendário, data e espaçamento

A varredura que o dono pediu: garantir que tamanho de elemento, calendário, navegação de data, posição e espaçamento batam com o que a pesquisa registrou.

**Files:**
- Modify: `src/app/app/agenda/barra-de-data.tsx`, `src/components/ui/calendar.tsx` (se preciso), `src/app/globals.css` (só se um token faltar)
- Test: `tests/unit/padroes-de-controle.test.ts`

- [ ] **Step 1: A trava dos tamanhos**

Criar `tests/unit/padroes-de-controle.test.ts`, varrendo as fontes de `src/app/app` e `src/components/ui`:

```ts
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Altura de controle é 36px (`--altura-controle`) ou 44px (`--tap-min`). Qualquer
 * outra é decisão que alguém tomou no olho — foi assim que apareceram fichas de
 * cor com 48px e esqueleto de 44 onde chega um botão de 36.
 */
const ALTURAS_PERMITIDAS = new Set(['h-9', 'h-11', 'min-h-9', 'min-h-11', 'size-9', 'size-11']);

function fontes(dir: string): { arquivo: string; texto: string }[] {
  return readdirSync(resolve(process.cwd(), dir), { recursive: true })
    .filter((f): f is string => typeof f === 'string' && f.endsWith('.tsx'))
    .map((f) => ({ arquivo: `${dir}/${f}`, texto: readFileSync(resolve(process.cwd(), `${dir}/${f}`), 'utf8') }));
}

describe('padrões de controle', () => {
  it('nenhuma altura de controle fora da régua de 36/44', () => {
    const infratores: string[] = [];
    for (const { arquivo, texto } of [...fontes('src/app/app'), ...fontes('src/components/ui')]) {
      // `h-[NNpx]` explícito num botão/campo é o que a régua existe para evitar
      for (const achado of texto.matchAll(/(?:min-)?h-\[(\d+)px\]/g)) {
        const px = Number(achado[1]);
        if (px !== 36 && px !== 44) infratores.push(`${arquivo}: ${achado[0]}`);
      }
    }
    expect(infratores).toEqual([]);
  });

  it('a régua de alturas nomeadas cobre o que se usa', () => {
    expect(ALTURAS_PERMITIDAS.has('h-9')).toBe(true);
  });
});
```

O primeiro caso pode acusar coisas legítimas (altura de linha de lista, de cartão, de esqueleto). Restrinja o regex ao que é **controle** — botão, campo, gatilho —, e o que sobrar como legítimo ganha comentário no teste dizendo por quê. **Não relaxe o teste para o zero**: se não der para distinguir por fonte, liste as exceções nominalmente com o motivo de cada uma.

- [ ] **Step 2: A navegação de data**

O que a pesquisa mostrou sobre densidade e navegação:

- **Densidade se resolve na vertical, nunca na horizontal** (Acuity: "the width of the columns remains the same regardless of the zoom setting").
- **A linha do agora é do desktop** — a Vagaro marca o ajuste como "Computer only". Nós já temos e ela funciona; o que importa é não sacrificar nada por ela no celular.
- Todo produto oferece **Day / Week / Month** ou equivalente. Nós temos só Day, e isso está certo para a Fase 1 — mas o seletor de data precisa deixar óbvio que o dia é a unidade.

Confira na `barra-de-data.tsx`, e conserte o que estiver fora:
1. As setas e o gatilho de data têm 44px de alvo (barra fixa) — já têm, confirme que continua depois da Task 3.
2. O `Calendar` do `Popover` mostra o dia de hoje marcado com o "hoje" **da barbearia**, não o do navegador — já é `today={isoParaData(hojeISO)}`; confirme que segue.
3. O espaçamento entre a barra e o primeiro item da lista é o mesmo em todas as telas do painel: nenhum valor solto, só a escala de 4px.

- [ ] **Step 3: O espaçamento**

Varra `src/app/app/agenda` e `src/app/app/clientes/[customerId]` atrás de `gap-`, `p-`, `m-` fora da escala do Tailwind (`gap-[13px]` e afins). A escala é de 4px; valor fora dela é decisão tomada no olho.

- [ ] **Step 4: Verificar e commitar**

Run: `DATABASE_URL_TEST=postgres://barbearia:barbearia@localhost:5433/barbearia_p5 npx vitest run && npx tsc --noEmit && npx eslint src tests`

```bash
git add src tests
git commit -m "test(ui): trava a régua de altura de controle e alinha o espaçamento"
```

---

## Task 6: Fechamento

**Files:**
- Modify: `tests/e2e/painel-acabamento.spec.ts`
- Modify: `docs/superpowers/design/2026-08-07-direcao-de-ui.md`

- [ ] **Step 1: O e2e das duas telas**

Acrescente ao spec que já existe, sem criar arquivo novo:

- a ficha de um cliente com histórico mostra os quatro cartões e o filtro de status funciona
- a agenda com dois atendimentos separados mostra a faixa de vão livre, e clicar nela abre a folha com a hora preenchida
- em 1280px, as ações do cartão aparecem ao focar por teclado (`Tab` até o cartão) — é a regressão mais provável desta rodada

**Não execute o Playwright** — escreva e pare. Quem roda é o orquestrador.

- [ ] **Step 2: Registrar as decisões na direção de UI**

A §5.7 (agenda) e a §5.11 ganham o que a pesquisa fechou: o formato de lista agora tem fonte externa a sustentá-lo, a ação recolhe no desktop, o vão livre é clicável, e status se lê por forma. Nasce uma seção para a ficha do cliente, que não tinha nenhuma.

Cite as fontes como o resto do documento faz. O que a pesquisa **não** achou também vale registrar — não existe bloco oficial do shadcn para nenhuma das duas telas, e não existe estudo comparando lista e grade em tela pequena.

- [ ] **Step 3: Verificação final**

```bash
npm run db:migrate
DATABASE_URL_TEST=postgres://barbearia:barbearia@localhost:5433/barbearia_p6 npx tsx src/db/migrate.ts
DATABASE_URL_TEST=postgres://barbearia:barbearia@localhost:5433/barbearia_p6 npx vitest run
npx tsc --noEmit && npx eslint src tests && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src tests docs
git commit -m "test(painel): cobre a ficha do cliente e o vão livre da agenda"
```

---

## Ordem

A Task 1 é bloqueante. Depois dela, **2, 3, 4 e 5 são independentes** e não se cruzam em arquivo:

| Frente | Arquivos |
|---|---|
| 2 — ficha | `src/app/app/clientes/[customerId]/` |
| 3 — cartão | `src/app/app/agenda/cartao-da-agenda.tsx` |
| 4 — vão livre | `src/app/app/agenda/{vao-livre,day-grid,manual-booking-form}.tsx` |
| 5 — padrões | `barra-de-data.tsx`, `tests/unit/` |

As tasks 3 e 4 ficam no mesmo diretório e **não podem tocar o mesmo arquivo**: o cartão é da 3, a lista e a folha são da 4. A 6 fecha.

## O risco

A regressão mais provável é a ação recolhida da Task 3: se `display:none` entrar no lugar de `opacity`, ou se o `focus-within` faltar, "Compareceu" deixa de existir para quem usa teclado ou leitor de tela — e nenhum teste de aparência pega isso. Por isso o e2e da Task 6 navega por `Tab`, e por isso o teste de unidade da Task 3 exige o botão no DOM e o `focus-within` na classe.

A segunda é o vão livre virar ruído: faixa em todo buraco de 5 minutos enche a tela e não leva a lugar nenhum. O piso é o serviço mais curto da loja, e há teste para isso.
