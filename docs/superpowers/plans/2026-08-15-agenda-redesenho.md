# A agenda, redesenhada — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A agenda deixar de ser o layout de celular esticado, e o dono poder remarcar um cliente sem cancelar.

**Architecture:** Três frentes que se somam na mesma tela. A **barra** vira uma linha só, com "Hoje" como botão fixo em vez de faixa solta. A **lista**, no desktop, vira colunas alinhadas de 48px em vez de cartões de 100px com 380px de vazio — e o fundo verde/vermelho sai, porque o fundo é o canal do hover e a cor já é do barbeiro. E **reagendar** deixa de ser cancelar-e-refazer: clica no atendimento, clica em remarcar, clica no novo horário. No celular nada disso muda: lá a tela está boa.

**Tech Stack:** Next.js 15 App Router · React 19 · TypeScript strict · Tailwind v4 · shadcn (`base-nova`, `@base-ui/react`) · Drizzle · Luxon · Vitest · Playwright

**Spec:** `docs/superpowers/specs/2026-08-15-agenda-redesenho-design.md` — cada decisão com a fonte. Leia antes de tocar em qualquer arquivo.

## Global Constraints

- Diretório: `/home/franklin/dev/barbearia`. Branch `main`. npm.
- **O celular não muda.** Abaixo de 768px a tela fica como está: cartão empilhado, botões de 44px, barra fixa no rodapé. Todo trabalho de layout desta rodada é `md:` para cima. Outlook chama de Compact, Todoist de Mini view — dois layouts distintos, nunca um esticado.
- **Texto literal não muda**: `Compareceu`, `Não veio`, `Encaixe`, `Desfazer`, `Cancelar`, `Confirmar cancelamento`, `Qualquer barbeiro`. Há e2e casando por nome acessível.
- **Acessibilidade**: ação revelada por ponteiro responde a foco de teclado (`focus-within`) e continua no DOM — `opacity`/`pointer-events`, nunca `display:none`. Ação revelada no hover **precisa de outro caminho** (Polaris), e hoje não tem: a folha do `⋯` não carrega "Compareceu". Corrigir isso é obrigatório, não opcional.
- **Altura de controle**: 36px (`--altura-controle`) ou 44px (`--tap-min`) em alvo de toque. Alvo de ponteiro no desktop pode 32px (WCAG 2.2 SC 2.5.8 pede 24).
- **Largura só pela régua** (`src/components/ui/largura.tsx`). `max-w-[Npx]` solto reprova em `tests/unit/regua-de-largura.test.ts`.
- **Espaçamento na escala de 4px.**
- **Fuso da barbearia sempre.** Nunca `new Date('YYYY-MM-DD')` nem `toISOString().slice(0,10)`; use `src/lib/data-local.ts` e `src/lib/format.ts`.
- **Nada rola de lado em 360px.** Coberto por `tests/e2e/painel-acabamento.spec.ts`.
- **Não subir dev server, navegador ou Playwright em subagente.**
- Teste: `DATABASE_URL_TEST=postgres://barbearia:barbearia@localhost:5433/<banco próprio> npx vitest run`.
- **Depois de qualquer migration, `npm run db:migrate`.** Já derrubou a suíte duas vezes nesta sessão.
- Commits em pt-BR. Quem commita é o orquestrador.

## Mapa de arquivos

**Nasce:**

| Arquivo | Responsabilidade |
|---|---|
| `src/app/app/agenda/linha-da-agenda.tsx` | a linha de colunas do desktop |
| `src/app/app/agenda/menu-da-linha.tsx` | o `⋯` e o que tem dentro |
| `src/domain/booking/reschedule-appointment.ts` | remarcar, com a mesma guarda de colisão do encaixe |
| `src/app/app/agenda/remarcacao.tsx` | o estado "escolhendo novo horário" |

**Mudam:** `agenda/{page,barra-de-data,day-grid,cartao-da-agenda,vao-livre,actions,loading}.tsx`, `src/db/schema/notification.ts`.

---

## Task 1: A barra vira uma linha

**Files:**
- Modify: `src/app/app/agenda/barra-de-data.tsx`, `agenda/page.tsx`, `agenda/loading.tsx`
- Test: `src/app/app/agenda/barra-de-data.test.ts`

**Interfaces:**
- Produces: `BarraDeData` ganha `contagens` já existente e passa a renderizá-la inline; o botão `Hoje` nasce aqui.

- [ ] **Step 1: Escrever o teste**

Acrescentar a `src/app/app/agenda/barra-de-data.test.ts`:

```ts
describe('a barra de uma linha só', () => {
  it('o "Hoje" é botão da barra, não faixa embaixo', () => {
    // era um <Link w-full> numa faixa própria, que aparecia e sumia mudando a
    // altura da barra e ficava alinhado com nada
    expect(barra).not.toMatch(/Voltar para hoje/);
    expect(barra).toMatch(/>Hoje</);
  });

  it('as duas setas ficam juntas, do mesmo lado', () => {
    // nenhuma fonte da pesquisa cerca o rótulo com uma seta de cada lado;
    // Google, FullCalendar, react-big-calendar e o ReUI agrupam
    const grade = barra.match(/grid-cols-\[[^\]]+\]/g) ?? [];
    expect(grade.join(' ')).not.toMatch(/44px_1fr_44px/);
  });

  it('o "Hoje" desabilita em vez de sumir quando já é hoje', () => {
    // é o que o FullCalendar faz; sumir muda a largura dos vizinhos a cada dia
    expect(barra).toMatch(/disabled=\{eHoje\}|disabled=\{.*hoje/i);
  });

  it('a contagem é inline, não uma faixa de 20px', () => {
    expect(barra).not.toMatch(/<p[^>]*h-5[^>]*>\s*\{contagens/);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/app/app/agenda/barra-de-data.test.ts`

- [ ] **Step 3: Montar a linha**

Ordem, da esquerda para a direita — é a do Google, do exemplo canônico do FullCalendar (`end: 'today prev,next'`), do react-big-calendar e do ReUI, que é a lib do nosso próprio stack:

```
[ Hoje ] [ ‹ ] [ › ]   [ sexta, 15 de agosto ▾ ]   6 no dia · 3 a atender  ·········  [ Encaixe ]
```

1. **`Hoje`** — primeiro, sempre presente, `disabled` quando o dia mostrado já é hoje. Some a faixa de baixo, some o botão de 1400px que já precisou de remendo, e a barra para de mudar de altura conforme o dia.
2. **`‹` `›` juntas**, depois do `Hoje`. Dois alvos de 44px lado a lado: uma mão, um lugar.
3. **O rótulo da data** continua botão que abre o `Popover` com o `Calendar` — é o único pedaço da barra que já estava certo, e é o que Fresha, Mangomint e Outlook fazem. Mantenha os 240px do desktop e o `today={isoParaData(hojeISO)}`.
4. **A contagem inline**, depois do rótulo, em `--tinta-3`. É `titleMetadata` do Polaris: "brief, important and non-interactive status information". **Some quando o dia está vazio** — quem fala aí é o estado vazio, não um "0 no dia · 0 a atender", que é ruído com forma de dado.
5. **`Encaixe`** na ponta direita, empurrado por `flex-1`.

**No celular a ordem fica `[ ‹ ] [ data ▾ ] [ › ]`** como está hoje: o rótulo precisa de ~250px e três botões antes dele truncariam "sexta, 15 de agosto", que o Material 3 proíbe em letra ("Don't truncate the headline text"). O "ir para hoje" no celular vira **um item dentro do popover do calendário**.

- [ ] **Step 4: Cortar o subtítulo**

`page.tsx` passa `descricao="Quem vem, a que horas e com quem."` ao `CabecalhoDePagina`. Sai. Falha nos três critérios do Polaris para o que acompanha um título — não é breve, não é status, e não informa nada a quem abre a tela cinquenta vezes por dia. O `<h1>` fica (as cinco telas irmãs têm, e a consistência de navegação é o motivo dele existir aqui).

Ganho medido: ~24px da primeira dobra, mais os ~12px que a faixa da contagem devolve.

- [ ] **Step 5: Verificar e commitar**

Run: `DATABASE_URL_TEST=postgres://barbearia:barbearia@localhost:5433/barbearia_a1 npx vitest run src/app/app/agenda && npx tsc --noEmit`

```bash
git add src/app/app/agenda
git commit -m "fix(agenda): a barra vira uma linha, e o Hoje deixa de ser faixa solta"
```

---

## Task 2: A linha do desktop

A task que resolve o "está horrível". **Só `md:` para cima.**

**Files:**
- Create: `src/app/app/agenda/linha-da-agenda.tsx`, `.test.tsx`
- Modify: `src/app/app/agenda/cartao-da-agenda.tsx`, `day-grid.tsx`

**Interfaces:**
- Produces: `LinhaDaAgenda` — mesmas props do `CartaoDaAgenda`, renderização de colunas. O `CartaoDaAgenda` continua existindo e continua sendo o do celular.

- [ ] **Step 1: Escrever o teste**

```tsx
// @vitest-environment jsdom
describe('LinhaDaAgenda', () => {
  it('não pinta o fundo por status', () => {
    // o fundo é o canal do hover (Carbon) e a cor já é do barbeiro (§3.5);
    // fundo colorido sozinho entrega 1 dos 3 portadores que o Carbon exige
    const { container } = render(<LinhaDaAgenda item={{ ...ITEM, status: 'DONE' }} {...props} />);
    const linha = container.querySelector('[data-slot="linha-da-agenda"]');
    expect(linha?.className).not.toMatch(/bg-ok|bg-perigo|bg-green|bg-red/);
  });

  it('todo atendimento tem a mesma altura', () => {
    // Carbon: "use the same row height … don't mix row heights". A duração
    // vira número escrito na coluna 1, não altura que ninguém mede a olho.
    const curto = render(<LinhaDaAgenda item={ITEM} {...props} />);
    const longo = render(<LinhaDaAgenda item={{ ...ITEM, id: 'b', endAt: MAIS_UMA_HORA }} {...props} />);
    const h = (r: RenderResult) =>
      r.container.querySelector('[data-slot="linha-da-agenda"]')?.className.match(/h-\d+/)?.[0];
    expect(h(curto)).toBe(h(longo));
  });

  it('a duração aparece escrita', () => {
    render(<LinhaDaAgenda item={ITEM} {...props} />);
    expect(screen.getByText(/30 min/)).toBeInTheDocument();
  });

  it('o menu fica na linha e sempre visível', () => {
    // Carbon: "the overflow menu icons are persistent on each row"
    const { container } = render(<LinhaDaAgenda item={ITEM} {...props} />);
    const menu = container.querySelector('[data-slot="menu-da-linha"]');
    expect(menu).not.toBeNull();
    expect(menu?.className).not.toMatch(/opacity-0/);
  });

  it('os verbos recolhem por opacidade e voltam no foco', () => {
    const { container } = render(<LinhaDaAgenda item={ITEM} {...props} />);
    const acoes = container.querySelector('[data-slot="verbos-da-linha"]');
    expect(acoes?.className).toMatch(/focus-within/);
    expect(screen.getByRole('button', { name: /Compareceu/ })).toBeInTheDocument();
  });

  it('o telefone sai da linha', () => {
    // é ele que obriga a terceira linha de conteúdo; vive na folha e na ficha
    const { container } = render(<LinhaDaAgenda item={ITEM} {...props} />);
    expect(container.querySelector('a[href^="tel:"]')).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

- [ ] **Step 3: As sete colunas**

880 − 4 de aresta − 24 de recheio = 852 úteis, `gap-x-3`:

| Faixa | Largura | Conteúdo | Alinhamento |
|---|---|---|---|
| aresta | 4px | cor do barbeiro; cheia ou tracejada conforme o desfecho | — |
| Hora | 72px | `09:00` 16/700 `tabular-nums`; `30 min` 12px em `--tinta-3` | esquerda |
| Cliente | `1.3fr` | 15/600, `truncate` | esquerda |
| Serviço | `1fr` | 14px `--tinta-2`, `truncate` | esquerda |
| Barbeiro | 116px | ponto de 8px na cor + nome, `truncate` | esquerda |
| Preço | 76px | 14px `tabular-nums` | **direita** (Polaris) |
| Estado | 92px | `<Badge>` de `VARIANTE_DO_ESTADO`; vazio em `BOOKED` | esquerda, x fixo |
| Ações | 108px | 3 alvos de 32px | direita |

**Altura 48px**, uma linha de texto — o "default" do Carbon.

A etiqueta de estado numa coluna de x fixo é o que corrige a etiqueta errante: hoje ela aparece ora colada no nome, ora no canto oposto, na mesma tela.

- [ ] **Step 4: As ações na própria linha**

Última célula, centradas na vertical, 32×32:

- Os dois verbos viram **ícone-botão** em `opacity-60`, subindo a 1 em `group-hover` **e** `group-focus-within`. Não somem — ficam quietos. Responde aos dois lados do aviso do NN/g: nem quarenta botões gritando, nem ação invisível.
- **`Tooltip` obrigatório** nos dois, e `aria-label` com o nome do cliente.
- O `⋯` fica **sempre em 100%**. É a afordância mínima da linha.
- Quando "Não veio" ainda não pode aparecer, a célula reserva os 32px vazios — a coluna não dança.

- [ ] **Step 5: Trocar por breakpoint**

`day-grid.tsx` renderiza `<CartaoDaAgenda className="md:hidden">` e `<LinhaDaAgenda className="hidden md:grid">`. **Os dois no DOM**, nunca condicional de JS por largura — renderização de servidor não sabe a largura da janela, e alternar em `useEffect` faria a lista piscar.

Isso duplica o conteúdo na árvore de acessibilidade. Marque o que está escondido com `aria-hidden` **conforme o breakpoint via CSS** não é possível — então: o cartão do celular recebe `md:hidden` e o `aria-hidden` fica de fora; leitor de tela em desktop lê a linha, e o cartão escondido por `display:none` não é lido. `display:none` **aqui** é o certo, ao contrário das ações, porque é layout alternativo e não ação escondida.

- [ ] **Step 6: Verificar e commitar**

Run: `DATABASE_URL_TEST=postgres://barbearia:barbearia@localhost:5433/barbearia_a2 npx vitest run src/app/app/agenda && npx tsc --noEmit`

```bash
git add src/app/app/agenda
git commit -m "feat(agenda): no desktop a lista vira colunas alinhadas de 48px"
```

---

## Task 3: O menu da linha

O `⋯` deixa de ser só "cancelar" e vira o caminho para tudo que não cabe na linha.

**Files:**
- Create: `src/app/app/agenda/menu-da-linha.tsx`, `.test.tsx`
- Modify: `src/app/app/agenda/cartao-da-agenda.tsx`

**Interfaces:**
- Consumes: `Tooltip`, `DropdownMenu` (ou a `FolhaInferior` no celular)

- [ ] **Step 1: O conteúdo do menu**

| Item | Por quê |
|---|---|
| **Compareceu** / **Não veio** | Polaris: ação revelada no hover *"must also be accessible in another way"*. Hoje não há. É a correção de acessibilidade mais importante da rodada. |
| **Remarcar** | entra desabilitado nesta task; a Task 4 liga |
| **Abrir no WhatsApp** | o telefone já está no cadastro; falta o caminho que o dono usa de verdade |
| **Ver ficha do cliente** | a ficha ganhou quatro indicadores em 14/08 e a agenda não leva até ela |
| **Ligar** | o `tel:` que saiu da linha |
| **Cancelar** | continua com a confirmação em dois tempos |

**No celular é `FolhaInferior`; no desktop é `DropdownMenu`.** A folha de 560px no desktop para seis itens é desperdício, e o menu no celular é alvo pequeno demais.

O link do WhatsApp usa `https://wa.me/<telefone>` com o número normalizado por `src/lib/telefone.ts` — **não invente formatação nova**, essa função existe e é testada.

- [ ] **Step 2: Teste, implementação, verificação**

O teste garante os seis itens, o `aria-label` nomeando o cliente, e que "Compareceu" existe dentro do menu (é o caso que protege o teclado).

Run: `DATABASE_URL_TEST=postgres://barbearia:barbearia@localhost:5433/barbearia_a3 npx vitest run src/app/app/agenda && npx tsc --noEmit`

```bash
git add src/app/app/agenda
git commit -m "feat(agenda): o menu da linha leva ao WhatsApp, à ficha e ao cancelamento"
```

---

## Task 4: Remarcar sem cancelar

O buraco maior. Hoje mudar alguém de horário é cancelar e criar de novo — e o cancelamento manda WhatsApp de cancelamento para quem só queria trocar de hora.

**Files:**
- Create: `src/domain/booking/reschedule-appointment.ts`, `.test.ts`
- Create: `src/app/app/agenda/remarcacao.tsx`, `.test.tsx`
- Modify: `src/app/app/agenda/actions.ts`, `day-grid.tsx`, `vao-livre.tsx`, `src/db/schema/notification.ts`

**Interfaces:**
- Produces:
  ```ts
  export type RescheduleInput = {
    appointmentId: string;
    barbershopId: string;
    novoInicio: Date;
    novoStaffId?: string;   // ausente = mantém o barbeiro
    avisarCliente: boolean;
  };
  export async function rescheduleAppointment(db: Db, input: RescheduleInput): Promise<void>;
  ```

- [ ] **Step 1: O teste do domínio**

```ts
describe('rescheduleAppointment', () => {
  it('move o atendimento e preserva o snapshot de serviço e preço', async () => {
    // o snapshot é o que o histórico e a comissão leem; remarcar não é
    // renegociar o preço
  });

  it('preserva a duração ao mudar de hora', async () => {
    // 30 min às 9h continua 30 min às 11h — o fim recalcula do início
  });

  it('recusa colisão com a mesma mensagem do encaixe', async () => {
    // a constraint EXCLUDE é quem decide; `isExclusionViolation` traduz para
    // SlotTakenError, e sem isso volta 500 em vez de 409 — foi o defeito que a
    // review da Fase 1 achou e que só aparece sob corrida
  });

  it('não colide consigo mesmo ao mover para o horário que já ocupa', async () => {
    // remarcar de 9h para 9h é no-op, não conflito
  });

  it('recusa remarcar o que já foi cancelado', async () => {});

  it('registra a intenção de avisar quando avisarCliente é true', async () => {});
});
```

- [ ] **Step 2: Implementar o domínio**

Reuse a guarda de colisão de `create-walk-in.ts` — leia aquele arquivo. A constraint `EXCLUDE` do Postgres é quem decide, e `isExclusionViolation` traduz o `23P01` para `SlotTakenError`. **Não escreva uma segunda verificação de conflito**: a checagem prévia é conveniência, a constraint é a verdade.

Ao mover para outro barbeiro, valide que ele atende aquele serviço (`staffService`) — o encaixe já faz isso, leia como.

- [ ] **Step 3: O aviso ao cliente**

Não existe envio de WhatsApp ainda: os templates da Meta estão presos em burocracia. O que existe é `notificationLog`, com `type` em `CONFIRMATION | REMINDER | CANCELLATION` e único por `(appointmentId, type)`.

**Acrescente `RESCHEDULE` ao enum**, com migration. Quando `avisarCliente` for verdadeiro, grave a linha com `status: 'FAILED'` e `error: 'Envio pendente: template não aprovado'` — assim a intenção fica registrada e o dia em que o envio existir, ele encontra a fila pronta.

O único por `(appointmentId, type)` é problema aqui: remarcar duas vezes tentaria gravar dois `RESCHEDULE`. **Troque para único por `(appointmentId, type, createdAt)`** ou remova o único só para este tipo — decida e escreva o porquê na migration. Rode `npm run db:migrate` depois.

- [ ] **Step 4: O gesto na tela**

**Select-and-place, não arrastar** — é o do Boulevard, e é o que faz isto funcionar sem colunas e sem gesto contínuo, no celular do balcão:

1. `Remarcar` no menu da linha entra no modo remarcação.
2. A linha do atendimento fica hachurada e um aviso fixo diz "Escolhendo novo horário para Marcos — Esc para desistir".
3. **Todas as faixas de vão livre acendem** e viram destino. O `buildVaosLivres` já existe e já calcula isso — o piso passa a ser a duração *daquele* atendimento, não o serviço mais curto da loja.
4. Clicar numa faixa abre a confirmação com o **interruptor "avisar o cliente"** (ligado por padrão).
5. `Esc` e o botão de desistir cancelam o modo.

O modo é estado de cliente. O canal de módulo de `vao-livre.tsx` (`pedirEncaixe` / `assinarPedidoDeEncaixe`) já resolve mensagem entre irmãos — **estenda aquele canal em vez de criar um segundo**.

Navegar para outro dia dentro do modo mantém o modo: é o caso mais comum ("semana que vem, mesma hora").

- [ ] **Step 5: Verificar e commitar**

```bash
npm run db:migrate
DATABASE_URL_TEST=postgres://barbearia:barbearia@localhost:5433/barbearia_a4 npx tsx src/db/migrate.ts
DATABASE_URL_TEST=postgres://barbearia:barbearia@localhost:5433/barbearia_a4 npx vitest run
```

```bash
git add src tests
git commit -m "feat(agenda): remarcar sem cancelar, escolhendo o novo horário na lista"
```

---

## Task 5: O dia vazio e as duas repetições

**Files:**
- Modify: `src/app/app/agenda/day-grid.tsx`, `vao-livre.tsx`

- [ ] **Step 1: O estado vazio**

Hoje o dia sem nada mostra "Marcão livre · Tiago livre" mais "Nenhum agendamento neste dia". A primeira linha é ruído: se não há nada marcado, todo mundo está livre — não é notícia.

O Carbon classifica isto como "user action empty state" (resultado de a pessoa ter escolhido a data) e manda equilíbrio: *"More content doesn't necessarily mean it's a better solution as there is a cognitive cost for having more content on the page."* Título curto, corpo com a próxima ação, **ilustração opcional — e aqui não**.

Fica: uma frase e o botão que povoa o espaço. `Bloco` ou `Empty` do shadcn, no lugar da lista, não acima dela.

- [ ] **Step 2: A linha dos livres só quando informa**

`LinhaDeProximosLivres` aparece quando `staffList.length > 1` e é hoje. Passa a exigir também que **haja diferença entre os barbeiros** — um ocupado e outro livre. Todo mundo livre não é informação; todo mundo ocupado também não.

- [ ] **Step 3: As faixas de vão que repetem a hora**

A captura mostrou "11:45 · 1 h 15 min livre com Tiago" e "11:45 · 2 h 45 min livre com Dono E2E", uma embaixo da outra. Dois barbeiros livres no mesmo instante viram **uma faixa** que nomeia os dois.

Quando as durações diferem, a faixa mostra a maior e nomeia quem a tem. É informação para decidir, não relatório.

- [ ] **Step 4: Verificar e commitar**

```bash
git add src/app/app/agenda
git commit -m "fix(agenda): o dia vazio para de dizer o óbvio"
```

---

## Task 6: Fechamento

**Files:**
- Modify: `tests/e2e/painel-acabamento.spec.ts`, `docs/superpowers/design/2026-08-07-direcao-de-ui.md`

- [ ] **Step 1: O e2e**

Acrescente ao spec que existe:

- em 1280px, a linha tem as sete colunas e 48px de altura
- em 1280px, `Tab` até a linha revela "Compareceu" — o caso que já existe, adaptado à linha nova
- **"Compareceu" existe dentro do menu do `⋯`** — o caminho de quem não tem ponteiro
- remarcar: abre o menu, escolhe Remarcar, clica numa faixa, confirma, e o atendimento aparece no horário novo
- o dia vazio não mostra "livre · livre"

**Não execute o Playwright.** Escreva e pare.

- [ ] **Step 2: A direção de UI**

A §5.7 registra a linha de colunas, a barra de uma linha e o fundo que saiu. A §5.11 ganha a nota de que **reagendar não dependia das colunas** — foi o argumento que sustentava adiá-lo, e a pesquisa o derrubou.

E registre o método, porque é o que evita a próxima rodada perdida: **três análises de código não acharam o que uma captura de tela mostrou em cinco segundos.** Tela que o dono vai olhar, o assistente olha antes — renderizada, com dados que pareçam um dia real.

- [ ] **Step 3: Verificação final**

```bash
npm run db:migrate
DATABASE_URL_TEST=postgres://barbearia:barbearia@localhost:5433/barbearia_a6 npx tsx src/db/migrate.ts
DATABASE_URL_TEST=postgres://barbearia:barbearia@localhost:5433/barbearia_a6 npx vitest run
npx tsc --noEmit && npx eslint src tests && npm run build
```

---

## Ordem

1 e 2 são independentes (barra e lista). 3 depende de 2 (o menu mora na linha). 4 depende de 3 (o "Remarcar" nasce desabilitado no menu). 5 é independente de todas. 6 fecha.

Paralelizável: **1, 2 e 5** juntas; depois **3**; depois **4**; depois **6**.

## O risco

**A duplicação de layout da Task 2.** Cartão e linha renderizando o mesmo atendimento é duas verdades para manter — a próxima mudança de conteúdo tem que ser feita duas vezes, e a que esquecerem vira divergência entre celular e desktop. É o preço de ter dois layouts de verdade em vez de um esticado, e é o que Outlook e Todoist pagam. **Mitigação:** o que é lógica (formatar hora, decidir se "Não veio" pode aparecer, montar o link do WhatsApp) sai dos dois e vira função pura compartilhada; o que fica em cada um é só a arrumação visual.

**A segunda é o modo de remarcação.** É o primeiro estado modal da tela — enquanto ele está ligado, clicar em qualquer outra coisa significa algo diferente. Se ele puder ficar ligado sem o usuário perceber, a próxima ação surpreende. Por isso o aviso é fixo, `Esc` sempre desliga, e o teste do e2e cobre entrar e sair sem remarcar.
