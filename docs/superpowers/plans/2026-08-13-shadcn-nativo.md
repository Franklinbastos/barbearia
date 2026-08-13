# Cara de shadcn nativo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar o produto com a aparência da própria biblioteca shadcn — raio, densidade, tipografia, cards e sidebar — mantendo a paleta de cores da direção de UI.

**Architecture:** A migração anterior preservou a aparência antiga por camadas de desfazimento (`DESFAZ_O_BASE_NOVA`, `variant={null}`, altura sobrescrita). Este plano **remove essas camadas** e deixa o `base-nova` mandar. Onde o shadcn não tem componente, o nosso passa a imitar a forma dele. A cor continua vindo dos tokens da §3.1.

**Tech Stack:** shadcn CLI (`base-nova`) · `@base-ui/react` · Tailwind v4 · Next.js 15 · React 19 · Vitest · Playwright

## Global Constraints

- **Fidelidade ao shadcn é o critério.** Onde houver conflito entre a direção de UI antiga e o padrão da lib, **a lib vence** — decisão do dono em 13/08/2026. Ajustes finos vêm depois, em cima do resultado.
- **A paleta fica.** Os valores de cor da §3.1 continuam sendo a fonte; muda forma, densidade e tipografia, não matiz.
- A cor de estado (`--ok`, `--perigo`, `--alerta`, `--agora`) e a cor da loja (`--marca`) continuam nossas e continuam fora do botão primário.
- Componente vem pelo CLI: `npx shadcn@latest add <nome>`.
- Props e nomes de componente **continuam em português**.
- **Texto entre aspas no design doc é literal** — há e2e casando por nome acessível. `Seu nome`, `Telefone`, `Confirmar horário`, `Qualquer barbeiro`, `Horário confirmado`, `Ver ou cancelar meu horário`, `Compareceu`, `Não veio`.
- Acessibilidade não regride: label associado, `role="alert"`/`status`, foco visível, `data-hora` e `data-testid="slot"` preservados.
- Toda task termina com `DATABASE_URL_TEST=postgres://barbearia:barbearia@localhost:5433/barbearia_test npx vitest run`, `npx tsc --noEmit`, `npx eslint src tests`, `npm run build`.
- Dev server sobe sob demanda e cai depois. Porta do `APP_URL` (hoje 3333).
- Commits em pt-BR: `tipo(area): resultado para o usuário`.

---

## Task 1: Tokens de forma e densidade

Bloqueante. Sozinha já muda a percepção do produto inteiro.

**Files:**
- Modify: `src/app/globals.css`
- Test: `tests/unit/shadcn-nativo.test.ts`

**Interfaces:**
- Produces: `--radius` em 0.625rem (10px), altura de controle em 36px, tipografia de controle em 14px. Os tokens de cor **não mudam**.

- [ ] **Step 1: Escrever o teste**

Criar `tests/unit/shadcn-nativo.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const css = readFileSync(resolve(process.cwd(), 'src/app/globals.css'), 'utf8');

describe('forma nativa do shadcn', () => {
  it('o raio é o do shadcn, não os 4px de instrumento', () => {
    expect(css).toMatch(/--radius:\s*0\.625rem/);
  });

  it('a altura de controle é a da lib', () => {
    expect(css).toMatch(/--altura-controle:\s*36px/);
  });

  it('a paleta continua sendo a nossa', () => {
    for (const token of ['--ok', '--perigo', '--alerta', '--agora', '--marca']) {
      expect(css).toContain(`${token}:`);
    }
  });

  it('o botão primário continua fora da cor da loja', () => {
    expect(css).toMatch(/--primary:\s*var\(--tinta\)/);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/unit/shadcn-nativo.test.ts`
Expected: FAIL nos dois primeiros casos.

- [ ] **Step 3: Trocar os tokens de forma**

Em `src/app/globals.css`:

- `--radius: 0.625rem` (era derivado de `--r: 4px`). Manter `--r` como alias apontando para o novo valor enquanto houver uso.
- `--r-folha`: passa a `var(--radius)`.
- Acrescentar `--altura-controle: 36px`, e manter `--tap-min: 44px` **só** onde acessibilidade exigir alvo maior que o controle (a folha e a barra fixa).
- Tipografia de controle: 14px, `font-medium`.

**Não tocar** em nenhum token de cor.

- [ ] **Step 4: Rodar, ver passar, e olhar**

Run: `npx vitest run tests/unit/shadcn-nativo.test.ts && DATABASE_URL_TEST=... npx vitest run`

Subir o dev e olhar `/b/barbearia-do-marcao`: os cantos ficam visivelmente mais redondos. Nada mais muda ainda.

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css tests/unit/shadcn-nativo.test.ts
git commit -m "feat(ui): raio e densidade do shadcn nos tokens"
```

---

## Task 2: Desfazer os desfazimentos

O coração do plano, e é sobretudo remoção.

**Files:**
- Modify: `src/components/ui/botao.tsx`, `bloco.tsx`, `campo.tsx`, `folha-inferior.tsx`, `segmentado.tsx`, `fichas-de-escolha.tsx`, `esqueleto-de-linha.tsx`
- Modify: os testes que travavam os desfazimentos

**Interfaces:**
- Consumes: tokens da Task 1
- Produces: os mesmos componentes, com as APIs em português intactas, agora com aparência nativa

- [ ] **Step 1: Mapear o que está desfeito**

Run: `grep -rn "desfaz\|DESFAZ_O_BASE_NOVA\|variant={null}\|size={null}" src/components/ui/`

São ~38 desfazimentos em 7 arquivos, cada um com comentário dizendo o que anula. **Cada comentário é a documentação da decisão que está sendo revertida** — leia antes de apagar.

- [ ] **Step 2: Ativar as variantes nativas no Botao**

Mapear as nossas para as da lib, aceitando a aparência de lá:

| Nossa | shadcn |
|---|---|
| `primario` | `default` |
| `secundario` | `outline` |
| `perigo` | `destructive` |
| `perigo-vazado` | `outline` + cor de destructive |
| `texto` | `ghost` |
| `ok` | `default` + cor de `--ok` |

`ok` e `perigo-vazado` não existem na lib e continuam por `cn()` em cima, usando os nossos tokens de cor.

Remover o `DESFAZ_O_BASE_NOVA`: voltam `text-sm`, `font-medium`, `transition-all`, `active:translate-y-px`, `disabled:opacity-50` e o anel de foco da lib. Os tamanhos passam a ser os da lib.

- [ ] **Step 3: Ajustar os testes que travavam a altura**

`botao.test.tsx` tem um caso exigindo `tap-md`/52px. Ele existia para guardar a densidade de balcão, que acabou de ser revertida por decisão do dono. Trocar a asserção para a altura nova, com comentário explicando a reversão — **não apagar o teste**, ele continua sendo a guarda de que a altura é intencional.

Mesma coisa em `day-grid.test.ts` (o caso de opacidade, que existia porque o `disabled:opacity-50` estava desligado) e em qualquer teste que afirme o formato antigo.

- [ ] **Step 4: Repetir para os outros seis**

`bloco.tsx` volta às variantes `default`/`destructive` do alert, com os tons `ok`/`alerta`/`agora` por cima; `folha-inferior.tsx` volta ao raio, à duração e ao fundo da lib; `segmentado.tsx`, `fichas-de-escolha.tsx`, `campo.tsx` e `esqueleto-de-linha.tsx` idem.

Em `campo.tsx`, o `input` passa a usar o `Input` do shadcn, que a migração anterior trouxe e não usou — com uma ressalva: **manter 16px no campo da página pública**, porque abaixo disso o Safari do iOS dá zoom ao focar. É o único lugar onde a densidade da lib perde para um defeito real de plataforma.

- [ ] **Step 5: Verificar e commitar**

Run: `DATABASE_URL_TEST=... npx vitest run && npx tsc --noEmit && npx eslint src tests && npx playwright test`

```bash
git add src/components/ui src/app/app/agenda
git commit -m "feat(ui): componentes com a aparência nativa do shadcn"
```

---

## Task 3: Cards

**Files:**
- Create: `src/components/ui/card.tsx` (via CLI)
- Modify: as telas que hoje usam `.bloco` e `.lista` como caixa

**Interfaces:**
- Consumes: tokens da Task 1
- Produces: `Card` do shadcn disponível; as listas e blocos de conteúdo passam a ser cards

- [ ] **Step 1: Trazer o card**

```bash
npx shadcn@latest add card
```

- [ ] **Step 2: Mapear onde entra**

Run: `grep -rln "className=\"lista\"" src/app --include=*.tsx`

São 9 arquivos com `.lista` e 19 com `<Bloco>`. **Nem todo `<Bloco>` vira card**: `Bloco` é caixa de *mensagem* (erro, aviso, confirmação) e continua sendo `alert`. O que vira card é caixa de *conteúdo* — a lista de serviços, a de equipe, a de clientes, o histórico do cliente, os grupos de horário.

- [ ] **Step 3: Aplicar**

Cada lista ganha `Card` + `CardHeader` + `CardContent`, com a lista dentro. A `.lista` continua existindo para o `<ul>`, sem a borda externa, que passa a ser do card.

- [ ] **Step 4: Verificar em 360px**

Card tem respiro interno maior; em 360px isso come largura útil. Conferir que nenhuma tela passa a rolar de lado — foi o defeito nº 1 do inventário original.

Run: `DATABASE_URL_TEST=... npx vitest run && npm run build`

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "feat(ui): listas e conteúdo em card"
```

---

## Task 4: Sidebar do painel

A maior mudança de layout do plano.

**Files:**
- Create: `src/components/ui/sidebar.tsx` e o que o CLI trouxer junto
- Modify: `src/app/app/layout.tsx`, `src/components/panel-nav.tsx`
- Test: `tests/unit/casca.test.ts`

**Interfaces:**
- Consumes: tokens da Task 1
- Produces: casca do painel com sidebar; `panel-nav.tsx` deixa de existir como barra e vira o conteúdo da sidebar

- [ ] **Step 1: Trazer a sidebar**

```bash
npx shadcn@latest add sidebar
```

Ela puxa vários componentes por registry — confira o que veio e instale as dependências que o CLI não instalar (é o comportamento conhecido do `@base-ui/react`).

- [ ] **Step 2: Ajustar o teste da casca**

`tests/unit/casca.test.ts` afirma hoje que a nav é rolável por dentro (`overflow-x-auto`) e tem cinco links. Com sidebar, a asserção de rolagem deixa de fazer sentido; as cinco seções e o `aria-current` continuam valendo, e o logout também. Reescrever só o que a estrutura invalidou.

- [ ] **Step 3: Montar a casca**

`SidebarProvider` + `Sidebar` com as cinco seções (Agenda, Serviços, Equipe, Clientes, Configurações), `SidebarTrigger` no header, e o nome da barbearia com o botão de conta e o logout no rodapé da sidebar.

No celular a sidebar vira gaveta — é o comportamento padrão do componente. **Conferir que o gesto não conflita com o arrasto da folha inferior**, que também responde a arrasto lateral.

- [ ] **Step 4: Verificar nas duas larguras**

Subir o dev e conferir: em 360px a sidebar é gaveta e a agenda continua legível; em 1280px o rail fica fixo e o conteúdo ganha largura.

Run: `DATABASE_URL_TEST=... npx vitest run && npx tsc --noEmit && npx eslint src tests && npm run build && npx playwright test`

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "feat(painel): sidebar no lugar da barra de navegação"
```

---

## Task 5: Verificação e direção atualizada

**Files:**
- Modify: `docs/superpowers/design/2026-08-07-direcao-de-ui.md`

- [ ] **Step 1: Verificação final**

```bash
docker exec barbearia-postgres psql -U barbearia -d postgres -c "DROP DATABASE IF EXISTS barbearia_nativo"
docker exec barbearia-postgres psql -U barbearia -d postgres -c "CREATE DATABASE barbearia_nativo"
DATABASE_URL_TEST=postgres://barbearia:barbearia@localhost:5433/barbearia_nativo npx tsx src/db/migrate.ts
DATABASE_URL_TEST=postgres://barbearia:barbearia@localhost:5433/barbearia_nativo npx vitest run
DATABASE_URL_TEST=postgres://barbearia:barbearia@localhost:5433/barbearia_nativo npx vitest run
npx tsc --noEmit && npx eslint src tests && npm run build && npx playwright test
```

- [ ] **Step 2: Atualizar a direção**

A §3 (tokens), a §3.6 (forma e alvo de toque) e o P5 passam a estar desatualizados: o raio virou 10px, a altura de controle virou 36px e a densidade de balcão foi trocada por fidelidade à lib.

Registrar, como foi feito na §4.1: o que valia, por que mudou (decisão do dono em 13/08/2026, fidelidade ao shadcn com ajustes posteriores), e **o que ficou pendente de reavaliação** — em especial o alvo de toque no balcão, que era o argumento central da direção vencedora e foi conscientemente trocado.

Registrar também a exceção do campo de 16px na página pública, que existe por causa do zoom do Safari no iOS.

- [ ] **Step 3: Commit**

```bash
git add docs
git commit -m "docs(ui): direção atualizada com a adoção da aparência nativa"
```

---

## Ordem

1 é bloqueante. 2, 3 e 4 podem ir em paralelo depois dela — 2 mexe em `src/components/ui`, 3 nas telas, 4 na casca. 5 fecha.

## O risco

Este plano **muda a aparência de propósito**, então não há comparação de pixel para servir de rede. O que resta como anteparo é a suíte (589 testes), o e2e por nome acessível, e o olho do dono no fim.

O ponto que mais provavelmente vai voltar atrás: **36px no botão de "Compareceu"**, que o barbeiro toca dezenas de vezes por dia em pé. Está registrado aqui para que a reavaliação seja consciente, e não redescoberta.
