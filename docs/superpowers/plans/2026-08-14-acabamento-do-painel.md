# Acabamento das telas do painel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer as cinco telas restantes do painel parecerem tão terminadas quanto o resumo: uma régua de largura só, e cada tela ocupando a largura que o conteúdo dela pede.

**Architecture:** O resumo — a tela que o dono aprovou — não tem uma única largura mágica: usa a largura toda do container em grade responsiva. As cinco telas antigas fazem o contrário: cada bloco escolheu a própria largura (`1400`, `720`, `520`, `420`), e o resultado é conteúdo espremido no terço esquerdo de uma tela de 1400px, com formulário e lista empilhados em larguras diferentes. Este plano cria a régua que faltava na direção de UI, aplica tela por tela, e trava com teste.

**Tech Stack:** Next.js 15 App Router · React 19 · TypeScript strict · Tailwind v4 · shadcn (`base-nova`) · Vitest · Playwright

**Spec:** `docs/superpowers/design/2026-08-07-direcao-de-ui.md` — a §3 (tokens) e a §5 (telas) mandam. Este plano acrescenta a régua de largura, que faltava lá e é a causa do problema.

## Global Constraints

- Diretório: `/home/franklin/dev/barbearia`. Branch `main`. npm.
- **A aparência muda de propósito** — é o objetivo. Mas o que muda é largura, alinhamento e agrupamento; cor, tipografia e densidade continuam as da direção de UI.
- **Texto literal não muda**: `Compareceu`, `Não veio`, `Encaixe`, `Voltar para hoje`, `Adicionar serviço`, `Adicionar barbeiro`, `Buscar`, `Desativar`, `Ativar`. Há e2e casando por nome acessível.
- **Acessibilidade não regride**: label associado, `aria-label` de cada campo de hora, `role="alert"`/`status`, `aria-current`, `data-hora`, `data-testid="slot"`, foco visível.
- **Nada pode rolar de lado em 360px.** Foi o defeito nº 1 do inventário original e já voltou duas vezes.
- UI vem do shadcn (`base-nova`) pelo CLI; componente de domínio segue `cva` + `cn()` + `data-slot`, sem `forwardRef`.
- **Não subir dev server, navegador ou Playwright dentro de subagente** — derruba a VM do WSL; cinco agentes já morreram assim. Verificação visual é do orquestrador.
- Teste: `DATABASE_URL_TEST=postgres://barbearia:barbearia@localhost:5433/<banco próprio> npx vitest run`. Nunca o banco `barbearia`.
- Commits em pt-BR: `tipo(area): resultado para o usuário`.

## O diagnóstico, conferido no código

O que as capturas mostraram, com a linha que causa cada coisa:

| Tela | Defeito | Onde |
|---|---|---|
| **Agenda** | o botão de data recebe `1fr` numa faixa sem teto: ~1300px para escrever "sexta, 14 de agosto" | `barra-de-data.tsx:89` |
| **Agenda** | "Voltar para hoje" é `w-full` sem `md:w-auto` — um botão de 1400px | `barra-de-data.tsx:150` |
| **Agenda** | "Encaixe" flutua sozinho à direita, numa linha só dele, desalinhado de tudo | `manual-booking-form.tsx:210` |
| **Serviços** | formulário de 520px empilhado sobre lista de 720px — duas caixas de larguras diferentes, uma em cima da outra | `servico-form.tsx:61` + `page.tsx:42` |
| **Equipe** | idem, mesmo par | `staff-form.tsx:38` + `page.tsx:55` |
| **Clientes** | busca de 520px sobre lista de 720px — mesmo degrau | `page.tsx:28` e `:46` |
| **Configurações** | card de 520 + formulário de 520 numa tela de 1400: dois terços vazios, e sete campos sem agrupamento | `page.tsx:25`, `settings-form.tsx:90` |
| **Detalhe do barbeiro** | três blocos de 720px e o de comissão em **420px** | `comissao-form.tsx:40` |

E a referência do que é "terminado": `resumo/page.tsx:274` — `grid-cols-1 sm:grid-cols-2 xl:grid-cols-4`, largura toda do container, **zero `max-w` mágico**.

## Mapa de arquivos

**Nasce:**

| Arquivo | Responsabilidade |
|---|---|
| `src/components/ui/largura.tsx` | a régua: `<Largura tipo="leitura\|formulario\|tabela\|cheia">` |

**Mudam:** `agenda/{page,barra-de-data,manual-booking-form,loading}.tsx`, `servicos/{page,servico-form,loading}.tsx`, `equipe/{page,staff-form,loading}.tsx`, `equipe/[staffId]/*.tsx`, `clientes/{page,loading}.tsx` e `clientes/[customerId]/*.tsx`, `configuracoes/{page,settings-form,loading}.tsx`.

---

## Task 1: A régua de largura

Bloqueante. Sem ela cada task reinventa um número, que é exatamente como chegamos aqui.

**Files:**
- Create: `src/components/ui/largura.tsx`, `src/components/ui/largura.test.tsx`
- Create: `tests/unit/regua-de-largura.test.ts`
- Modify: `docs/superpowers/design/2026-08-07-direcao-de-ui.md`

**Interfaces:**
- Produces:
  - `type TipoDeLargura = 'leitura' | 'formulario' | 'tabela' | 'cheia'`
  - `Largura` — `React.ComponentProps<'div'> & { tipo?: TipoDeLargura }`, `data-slot="largura"`, padrão `leitura`
  - `larguraVariants` — o `cva`, exportado para quem precisa da classe sem o elemento

- [ ] **Step 1: Escrever o teste**

Criar `src/components/ui/largura.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Largura, larguraVariants } from './largura';

const px = (tipo: 'formulario' | 'tabela' | 'leitura') =>
  Number(larguraVariants({ tipo }).match(/max-w-\[(\d+)px\]/)?.[1] ?? 0);

describe('Largura', () => {
  it('os degraus são ordenados: formulário < tabela < leitura', () => {
    // uma régua com dois degraus iguais não é régua: quem escrever a próxima
    // tela vai escolher no olho de novo
    expect(px('formulario')).toBeLessThan(px('tabela'));
    expect(px('tabela')).toBeLessThan(px('leitura'));
  });

  it('cheia não limita nada', () => {
    expect(larguraVariants({ tipo: 'cheia' })).not.toMatch(/max-w-\[/);
  });

  it('repassa className de fora sem perder a largura', () => {
    render(<Largura tipo="tabela" className="mt-4" data-testid="x">oi</Largura>);
    const el = screen.getByTestId('x');
    expect(el.className).toMatch(/mt-4/);
    expect(el.className).toMatch(/max-w-\[/);
  });

  it('marca a parte com data-slot', () => {
    render(<Largura tipo="leitura" data-testid="x">oi</Largura>);
    expect(screen.getByTestId('x').getAttribute('data-slot')).toBe('largura');
  });

  it('o padrão é leitura', () => {
    render(<Largura data-testid="x">oi</Largura>);
    expect(screen.getByTestId('x').className).toContain(larguraVariants({ tipo: 'leitura' }));
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/components/ui/largura.test.tsx`
Expected: FAIL — `Cannot find module './largura'`.

- [ ] **Step 3: Implementar**

Criar `src/components/ui/largura.tsx`. Quatro degraus, cada um com o motivo escrito no comentário do arquivo — quem ler daqui a seis meses precisa saber por que não pode inventar o quinto:

- **`formulario` — 520px.** Campo de formulário não passa disso: linha de input muito larga faz o olho perder o começo ao voltar, e alvo de clique não melhora depois de certa largura. É o número que os formulários já usam; ganha nome.
- **`tabela` — 880px.** Lista com colunas de ação. Os 720px de hoje deixam a coluna de ação apertada e, mais visível que isso, criam o degrau contra o formulário de 520 logo acima.
- **`leitura` — 1120px.** Conteúdo corrido e grade de cards. Abaixo dos 1400px do container de propósito: texto que atravessa a tela inteira cansa.
- **`cheia`** — sem teto, para grade que se vira sozinha (é o que o resumo faz hoje, sem precisar declarar).

Anatomia da casa: `cva` com `larguraVariants` exportado, `cn()` juntando a classe interna com a `className` recebida, `React.ComponentProps<'div'>` na base do tipo, `data-slot="largura"`, sem `forwardRef`. O elemento é um `<div>` com `w-full` — nunca `mx-auto`: o painel alinha à esquerda, e centralizar mudaria a posição de tudo.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/components/ui/largura.test.tsx`
Expected: PASS, 5 testes.

- [ ] **Step 5: A trava contra reincidência**

Criar `tests/unit/regua-de-largura.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Antes desta régua havia quatro larguras mágicas espalhadas por vinte arquivos
 * (1400, 720, 520, 420), sem regra dizendo qual usar quando — e era por isso que
 * um formulário de 520px ficava empilhado sobre uma lista de 720px, com o degrau
 * visível na primeira dobra.
 */
const TELAS = readdirSync(resolve(process.cwd(), 'src/app/app'), { recursive: true })
  .filter((f): f is string => typeof f === 'string' && f.endsWith('.tsx'))
  .map((f) => `src/app/app/${f}`)
  // o container do painel é o teto de tudo e é o único que pode ter número
  .filter((f) => !f.endsWith('layout.tsx'));

describe('régua de largura', () => {
  it('nenhuma tela do painel inventa largura própria', () => {
    const infratores = TELAS.filter((f) =>
      /max-w-\[\d+px\]/.test(readFileSync(resolve(process.cwd(), f), 'utf8')),
    );
    expect(infratores).toEqual([]);
  });
});
```

Esse teste **vai falhar agora** — ele é o mapa do trabalho das tasks 2 a 6. Marque-o com `it.fails`, com um comentário dizendo que a Task 6 o vira para `it`. A suíte não pode ficar vermelha entre as tasks.

- [ ] **Step 6: Registrar na direção de UI**

A §3 não tem régua de largura — é a lacuna que produziu o problema. Acrescentar os quatro degraus com o motivo de cada um e a regra: **largura em px solta numa tela é defeito, não escolha.** Citar o resumo como a forma certa: grade responsiva ocupando o container, sem `max-w`.

- [ ] **Step 7: Verificar e commitar**

Run: `DATABASE_URL_TEST=postgres://barbearia:barbearia@localhost:5433/barbearia_t1 npx vitest run && npx tsc --noEmit && npx eslint src tests && npm run build`

```bash
git add src/components/ui/largura.tsx src/components/ui/largura.test.tsx tests/unit/regua-de-largura.test.ts docs
git commit -m "feat(ui): régua de largura, para a tela parar de escolher no olho"
```

---

## Task 2: Agenda

Três defeitos, todos visíveis na primeira dobra do desktop.

**Files:**
- Modify: `src/app/app/agenda/barra-de-data.tsx`, `agenda/manual-booking-form.tsx`, `agenda/page.tsx`, `agenda/loading.tsx`
- Test: `src/app/app/agenda/barra-de-data.test.ts`

**Interfaces:**
- Consumes: `Largura` da Task 1

- [ ] **Step 1: Escrever o teste**

Criar `src/app/app/agenda/barra-de-data.test.ts` (teste de fonte, no padrão dos outros deste projeto — a barra é `'use client'` com `useRouter`, e montar isso em jsdom custa mais do que mede):

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ler = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');
const barra = ler('src/app/app/agenda/barra-de-data.tsx');
const encaixe = ler('src/app/app/agenda/manual-booking-form.tsx');

describe('acabamento da agenda', () => {
  it('a faixa de navegação tem teto de largura no desktop', () => {
    // sem teto, o `1fr` do meio dá ~1300px ao botão que escreve "sexta, 14 de agosto"
    expect(barra).toMatch(/<Largura/);
  });

  it('"Voltar para hoje" não é um botão de 1400px no desktop', () => {
    // `w-full` sem contraparte `md:` é o botão que atravessa a tela inteira
    const linha = barra.split('\n').find((l) => l.includes("'w-full no-underline'"));
    expect(linha).toBeUndefined();
  });

  it('o encaixe do desktop não fica numa linha só dele', () => {
    // `md:justify-end` sozinho num `div` é o botão flutuando no canto
    expect(encaixe).not.toMatch(/mb-3 hidden md:flex md:justify-end/);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/app/app/agenda/barra-de-data.test.ts`
Expected: FAIL nos três casos.

- [ ] **Step 3: Consertar**

1. **A faixa de navegação ganha teto.** Envolver a grade `[44px_1fr_44px]` em `<Largura tipo="leitura">`. A barra continua `sticky` de ponta a ponta com o fundo e a borda atravessando a tela — o que fica contido é o conteúdo dela, não a faixa. Não mexer no `-mx-3 md:-mx-5`, que é o que faz a borda encostar nas laterais.
2. **"Voltar para hoje" vira botão de tamanho normal** no desktop: `w-full md:w-auto`. No celular continua largura total, que está certo.
3. **O "Encaixe" sobe para a linha da barra.** Hoje é um `<div className="mb-3 hidden md:flex md:justify-end">` logo abaixo dela, o que dá um botão sozinho ocupando uma faixa inteira de altura. Ele passa a ficar à direita **dentro** da mesma faixa da barra de data, alinhado ao teto de leitura. No celular nada muda: a barra fixa do rodapé (`fixed … md:hidden`) continua igual, e continua sendo o `pb-16` do `page.tsx` que reserva o espaço dela.

   Isso exige passar o botão como conteúdo para a barra ou levantar os dois para uma linha comum em `page.tsx`. Escolha o que deixar `barra-de-data.tsx` sem conhecer o encaixe — a barra é usada só aqui hoje, mas ela é sobre data, não sobre ação.

4. `agenda/loading.tsx` acompanha o teto, senão o esqueleto salta de largura quando o conteúdo chega.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/app/app/agenda/ && DATABASE_URL_TEST=postgres://barbearia:barbearia@localhost:5433/barbearia_t2 npx vitest run`
Expected: PASS. Atenção aos e2e que clicam em "Encaixe" por nome acessível — o texto não muda, mas a posição sim.

- [ ] **Step 5: Commit**

```bash
git add src/app/app/agenda
git commit -m "fix(agenda): barra de data com teto de largura e encaixe na mesma linha"
```

---

## Task 3: Serviços e Equipe

As duas telas com o mesmo defeito: caixa de 520px empilhada sobre caixa de 720px.

**Files:**
- Modify: `src/app/app/servicos/{page,servico-form,loading}.tsx`, `src/app/app/equipe/{page,staff-form,loading}.tsx`
- Test: `src/app/app/servicos/page.test.ts`

**Interfaces:**
- Consumes: `Largura` da Task 1

- [ ] **Step 1: Escrever o teste**

Criar `src/app/app/servicos/page.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ler = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');

describe('acabamento de serviços e equipe', () => {
  for (const tela of ['servicos', 'equipe'] as const) {
    it(`${tela}: usa a régua em vez de largura própria`, () => {
      const pagina = ler(`src/app/app/${tela}/page.tsx`);
      expect(pagina).not.toMatch(/max-w-\[\d+px\]/);
      expect(pagina).toMatch(/<Largura/);
    });

    it(`${tela}: o formulário e a lista têm a mesma largura`, () => {
      // 520 do formulário sobre 720 da lista é o degrau que aparece na captura
      const form = ler(`src/app/app/${tela}/${tela === 'servicos' ? 'servico' : 'staff'}-form.tsx`);
      expect(form).not.toMatch(/max-w-\[\d+px\]/);
    });

    it(`${tela}: o esqueleto tem a largura da tela que ele antecede`, () => {
      expect(ler(`src/app/app/${tela}/loading.tsx`)).not.toMatch(/max-w-\[\d+px\]/);
    });
  }

  it('serviços: cabeçalho e linhas usam a mesma grade', () => {
    // cabeçalho e corpo com definições diferentes desalinham as colunas
    const pagina = ler('src/app/app/servicos/page.tsx');
    const grades = [...pagina.matchAll(/md:grid-cols-\[([^\]]+)\]|grid-cols-\[([^\]]+)\]/g)]
      .map((m) => m[1] ?? m[2])
      .filter((g) => g.includes('fr'));
    expect(new Set(grades).size).toBeLessThanOrEqual(2); // uma de celular, uma de desktop
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/app/app/servicos/page.test.ts`
Expected: FAIL.

- [ ] **Step 3: Consertar as duas telas**

1. A lista vai para `<Largura tipo="tabela">`, sem o `max-w-[720px]` no `Card`.
2. **O formulário de adicionar entra na mesma largura da lista.** Hoje o `Card` do formulário tem 520px e a lista 720px, e como um aparece logo acima do outro, o degrau é o que mais salta na captura. O `Card` perde o `max-w` e passa a herdar de um `<Largura tipo="tabela">` no mesmo nível da lista; os *campos* dentro dele é que ficam em `formulario`, porque campo largo demais é pior de preencher.
3. A coluna de ação passa de `120px` fixo para `auto` com `min-w-[104px]`, e o wrapper interno larga o `md:w-[120px] md:justify-self-stretch`, que é o que hoje força o botão a esticar. **Cabeçalho e linha usam a mesma definição de grade** — se uma mudar sem a outra, as colunas desalinham.
4. Os `loading.tsx` acompanham.

Não mexer no `ToggleButton`/`ToggleStaffButton`: o `min-h-11 min-w-22` deles é a regra de alvo de toque da §5.9 e está certo.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/app/app/servicos src/app/app/equipe && DATABASE_URL_TEST=postgres://barbearia:barbearia@localhost:5433/barbearia_t3 npx vitest run`

- [ ] **Step 5: Commit**

```bash
git add src/app/app/servicos src/app/app/equipe
git commit -m "fix(painel): formulário e lista alinhados em serviços e equipe"
```

---

## Task 4: Clientes e Configurações

**Files:**
- Modify: `src/app/app/clientes/{page,loading}.tsx`, `clientes/[customerId]/{page,loading,notes-form}.tsx`, `src/app/app/configuracoes/{page,settings-form,loading}.tsx`
- Test: `src/app/app/configuracoes/page.test.ts`

**Interfaces:**
- Consumes: `Largura` da Task 1

- [ ] **Step 1: Escrever o teste**

Criar `src/app/app/configuracoes/page.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const arquivos = (dir: string) =>
  readdirSync(resolve(process.cwd(), dir), { recursive: true })
    .filter((f): f is string => typeof f === 'string' && f.endsWith('.tsx'))
    .map((f) => readFileSync(resolve(process.cwd(), `${dir}/${f}`), 'utf8'));

describe('acabamento de clientes e configurações', () => {
  it('nenhum dos dois inventa largura', () => {
    for (const fonte of [...arquivos('src/app/app/clientes'), ...arquivos('src/app/app/configuracoes')]) {
      expect(fonte).not.toMatch(/max-w-\[\d+px\]/);
    }
  });

  it('configurações agrupa os campos em seções', () => {
    // sete campos soltos em sequência não dizem o que é identidade e o que é
    // regra de agenda — o subtítulo da tela já anuncia os dois grupos
    const form = readFileSync(resolve(process.cwd(), 'src/app/app/configuracoes/settings-form.tsx'), 'utf8');
    expect(form).toMatch(/CardTitle|<h2/);
  });
});
```

- [ ] **Step 2: Rodar, ver falhar, consertar — Clientes**

1. **Busca e lista na mesma largura**: as duas em `<Largura tipo="tabela">`. Hoje são 520 e 720, com o degrau na primeira dobra.
2. Manter o `min-w-0 flex-1` do campo de busca — é o que impede a página de rolar de lado em 360px, e está comentado no arquivo por isso.
3. A ficha do cliente (`[customerId]/page.tsx`, hoje 720 + 520) e os dois `loading.tsx` alinham na mesma régua. As anotações (`notes-form.tsx`) ficam em `formulario`.

- [ ] **Step 3: Configurações**

1. **O "Endereço público" sobe para `leitura`.** Não é campo para preencher: é o endereço da loja para ler e copiar, e em 520px o slug longo quebra sem precisar.
2. **Os campos ficam em `formulario`** — 520px é a largura certa para campo, o problema nunca foi esse.
3. **Agrupar os sete campos em duas seções com título**, que é o que falta para a tela parecer terminada: *Identidade* (nome, endereço público, cor da loja) e *Regras da agenda* (fuso, grade, antecedência, janela). É o corte que o próprio subtítulo da tela já anuncia — "O endereço público da loja e as regras da agenda". Cada seção vira `Card` com `CardHeader`/`CardTitle`, como o resto do painel.
4. **As fichas de cor param de quebrar torto.** Hoje são doze fichas em `flex flex-wrap` (`settings-form.tsx:173`), e a segunda linha começa fora do alinhamento da primeira. Vira grade de colunas fixas, que alinha as duas linhas. Preservar o `<fieldset>`/`<legend>` e o texto "Escolhida: …" — é o que dá nome acessível ao grupo.

- [ ] **Step 4: Verificar e commitar**

Run: `DATABASE_URL_TEST=postgres://barbearia:barbearia@localhost:5433/barbearia_t4 npx vitest run && npx tsc --noEmit`

Atenção: `settings-form.test.tsx` já existe e cobre o comportamento do formulário. Ele tem que continuar passando sem alteração — se precisar mudá-lo, o agrupamento mexeu em algo que não devia.

```bash
git add src/app/app/clientes src/app/app/configuracoes
git commit -m "fix(painel): clientes alinhado e configurações em seções"
```

---

## Task 5: Detalhe do barbeiro

A tela que não estava nas capturas e tem o mesmo defeito, na forma mais óbvia: quatro blocos empilhados, três com 720px e um com 420px.

**Files:**
- Modify: `src/app/app/equipe/[staffId]/{page,services-form,time-off-section,comissao-form,loading}.tsx`

**Interfaces:**
- Consumes: `Largura` da Task 1

- [ ] **Step 1: Alinhar os quatro blocos**

Comissão (`comissao-form.tsx:40`, 420px), Serviços (`services-form.tsx:39`, 720px), Expediente (`page.tsx:69`, 720px) e Bloqueios (`time-off-section.tsx:59`, 720px). Todos passam a `<Largura tipo="tabela">`, aplicado uma vez em `page.tsx` em volta das seções em vez de repetido em cada filho — assim o próximo bloco que alguém acrescentar nasce alinhado. O `Card` interno do formulário de bloqueio (`time-off-section.tsx:105`) fica em `formulario`.

- [ ] **Step 2: A grade do expediente**

`page.tsx:69` é `grid max-w-[720px] gap-3 md:grid-cols-2` — sete cards de dia em duas colunas. Com o teto de `tabela` (880px) as duas colunas ganham fôlego; verifique que os campos de hora não ficam apertados e que em 360px continua uma coluna só.

**Preservar os `aria-label`** de cada campo ("Segunda — início do bloco 1"): são 42 campos, é o que os torna navegáveis por leitor de tela, e há teste guardando.

- [ ] **Step 3: Verificar e commitar**

Run: `DATABASE_URL_TEST=postgres://barbearia:barbearia@localhost:5433/barbearia_t5 npx vitest run && npx tsc --noEmit && npx eslint src tests`

```bash
git add "src/app/app/equipe/[staffId]"
git commit -m "fix(painel): blocos do detalhe do barbeiro na mesma largura"
```

---

## Task 6: Varredura e trava

**Files:**
- Modify: `tests/unit/regua-de-largura.test.ts`, `src/app/app/resumo/loading.tsx`, `src/app/app/error.tsx`
- Create: `tests/e2e/painel-acabamento.spec.ts`

- [ ] **Step 1: Virar o teste marcado como falha esperada**

O caso de `tests/unit/regua-de-largura.test.ts` foi criado com `it.fails` na Task 1. Se as tasks 2 a 5 fizeram o trabalho, ele agora passa — troque para `it`.

Se ainda falhar, o arquivo que ele apontar é trabalho pendente. Termine antes de seguir. Os candidatos que sobram são `resumo/loading.tsx:16` (esqueleto de 720px para uma tela que usa a largura toda — este é defeito de verdade: o conteúdo salta quando carrega) e `error.tsx:22` (560px numa tela de erro centrada; se o teste pegar, use a régua ou justifique a exceção em comentário).

- [ ] **Step 2: Varrer o que sobrou**

Run: `grep -rn "max-w-\[" src/app/app src/components --include=*.tsx`

Sobram legitimamente: `layout.tsx:75` (o container do painel, teto de tudo), `folha-inferior.tsx:76` (a folha **é** 560px por decisão da §4.3) e `resumo/estado-vazio.tsx:112` (`52ch`, medida de texto e não de tela). Qualquer outro é reincidência.

- [ ] **Step 3: O e2e de acabamento**

Criar `tests/e2e/painel-acabamento.spec.ts`. Mede as duas coisas que teste de fonte não vê:

```ts
import { test, expect } from '@playwright/test';

const TELAS = ['/app/resumo', '/app/agenda', '/app/servicos', '/app/equipe', '/app/clientes', '/app/configuracoes'];

for (const tela of TELAS) {
  test(`${tela} não rola de lado em 360px`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await entrarNoPainel(page);
    await page.goto(tela);
    const { scroll, cliente } = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      cliente: document.documentElement.clientWidth,
    }));
    expect(scroll).toBeLessThanOrEqual(cliente);
  });

  test(`${tela} não tem controle estourando o card em 1280px`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await entrarNoPainel(page);
    await page.goto(tela);
    const fora = await page.evaluate(() => {
      const achados: string[] = [];
      document.querySelectorAll('[data-slot="card"]').forEach((card) => {
        const limite = card.getBoundingClientRect().right;
        card.querySelectorAll('button, a, input').forEach((filho) => {
          if (filho.getBoundingClientRect().right > limite + 1) {
            achados.push(`${filho.tagName}: ${filho.textContent?.slice(0, 24)}`);
          }
        });
      });
      return achados;
    });
    expect(fora).toEqual([]);
  });
}
```

`entrarNoPainel` não existe ainda. Os specs de painel que já existem em `tests/e2e/` fazem login de alguma forma — **reuse o que estiver lá**; se for código solto dentro de um spec, extraia para a fixture e faça os dois usarem. Não invente um segundo caminho de login.

- [ ] **Step 4: Verificação final**

```bash
npm run db:migrate
DATABASE_URL_TEST=postgres://barbearia:barbearia@localhost:5433/barbearia_t6 npx tsx src/db/migrate.ts
DATABASE_URL_TEST=postgres://barbearia:barbearia@localhost:5433/barbearia_t6 npx vitest run
npx tsc --noEmit && npx eslint src tests && npm run build
```

O `db:migrate` no começo não é decoração: o banco de desenvolvimento ficar para trás já derrubou a suíte inteira e o e2e duas vezes nesta sessão.

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "test(painel): trava a régua de largura e mede estouro de card"
```

---

## Ordem

A Task 1 é bloqueante — sem a régua, as outras reinventam número. Depois dela, **2, 3, 4 e 5 são independentes**: cada uma toca só os arquivos da sua tela, sem interseção. A 6 fecha.

## O risco

Este plano **muda a aparência de propósito**, então não há comparação de pixel servindo de rede — mesmo risco da migração para o shadcn. O anteparo é a suíte (776 testes), o e2e por nome acessível, e o e2e novo da Task 6, que mede duas coisas objetivas: rolagem horizontal em 360px e filho estourando a borda do card.

O que nada disso pega é se ficou **bom de olhar**. Isso continua sendo o olho do dono, e é por isso que o fim do plano é subir o ambiente, não fechar o último commit.
