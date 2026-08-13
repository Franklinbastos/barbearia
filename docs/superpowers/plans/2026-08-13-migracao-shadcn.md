# Migração para shadcn — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Alinhar a UI da barbearia ao padrão shadcn que já roda no bdsolutions, sem perder a densidade de balcão e os tokens que a direção de UI travou.

**Architecture:** O shadcn entra como **estrutura** — anatomia de componente, `cva` para variantes, `cn()` para classes, `data-slot` para estilização externa, e o CLI para trazer componente novo. A **aparência continua nossa**: alvo de toque de 52px, contraste alto para sol na tela e a cor da loja com L e croma travados. Os tokens ganham os nomes canônicos do shadcn (`--background`, `--primary`, `--destructive`) mantendo os valores decididos pelo júri, e os nomes em português viram alias durante a migração.

**Tech Stack:** shadcn CLI (estilo `base-nova`, o mesmo do bdsolutions) · `@base-ui/react` (só o drawer) · `cmdk` (só o command) · `class-variance-authority` · `clsx` · `tailwind-merge` · `lucide-react` · Tailwind v4 · Vitest · Playwright

**Fontes:** `docs/superpowers/design/2026-08-07-direcao-de-ui.md` (tokens e telas) e o `components.json` do bdsolutions, que é o padrão da casa.

## Global Constraints

- Diretório: `/home/franklin/dev/barbearia`. Branch base: `main`. npm.
- Estilo do shadcn: **`base-nova`**, `baseColor: neutral`, `cssVariables: true`, `iconLibrary: lucide`, `rsc: true` — idêntico ao `components.json` do bdsolutions. Não divergir.
- **A aparência não muda.** Alvo de toque mínimo 44px, controle de balcão 52px, e as cores da §3.1 do design doc. Se um componente do shadcn vier com 36px de altura, a variante nossa sobrescreve.
- Componente vem pelo **CLI** (`npx shadcn@latest add <nome>`), não copiado à mão do site: assim o `components.json` fica sendo a fonte e a próxima atualização é um comando.
- Texto visível em pt-BR com acentuação correta. **Texto entre aspas no design doc é literal** — há e2e casando por nome acessível.
- Nomes de componente e prop **em português** continuam em português (`<Botao variante="perigo">`), mesmo quando o corpo vier do shadcn. O produto inteiro é em português e trocar isso agora é ruído sem ganho.
- Toda task termina com a suíte verde: `DATABASE_URL_TEST=postgres://barbearia:barbearia@localhost:5433/barbearia_test npx vitest run`, mais `npx tsc --noEmit` e `npx eslint src tests`.
- Commits em pt-BR: `tipo(area): resultado para o usuário`.

## O mapa da migração

| Nosso componente | Vem do shadcn | Dependência nova |
|---|---|---|
| `botao` | `button` | nenhuma |
| `campo` | `field` + `input` + `label` | nenhuma |
| `bloco` | `alert` | nenhuma |
| `monograma` | `avatar` | nenhuma |
| `esqueleto-de-linha` | `skeleton` | nenhuma |
| `folha-inferior` | `drawer` | `@base-ui/react` |
| `segmentado` | `toggle-group` + `toggle` | nenhuma |
| `fichas-de-escolha` | `radio-group` | nenhuma |
| `busca-de-cliente` | `command` | `cmdk` |
| `cabecalho-de-pagina` | — (adaptar ao padrão) | nenhuma |
| `tira-de-dias` | — (adaptar ao padrão) | nenhuma |
| `grade-de-horarios` | — (adaptar ao padrão) | nenhuma |
| `botao-de-confirmacao` | — (adaptar ao padrão) | nenhuma |

"Adaptar ao padrão" quer dizer: `cva` para as variantes, `cn()` para compor classe, `data-slot` nas partes, props de className repassáveis, e `React.ComponentProps` em vez de tipo próprio. O componente continua nosso; só passa a se parecer com os outros por dentro.

---

## Task 1: Fundação — CLI, utilitários e tokens canônicos

O passo que decide o resto. Nenhum componente muda de aparência aqui.

**Files:**
- Create: `components.json`, `src/lib/utils.ts`
- Modify: `src/app/globals.css`, `package.json`
- Test: `tests/unit/shadcn-fundacao.test.ts`

**Interfaces:**
- Produces:
  - `cn(...inputs: ClassValue[]): string` em `src/lib/utils.ts` — `clsx` + `tailwind-merge`, exatamente como o bdsolutions
  - Tokens canônicos do shadcn no `globals.css`, apontando para os valores que a §3.1 já decidiu
  - `components.json` que faz o CLI instalar em `src/components/ui` com alias `@/`

- [ ] **Step 1: Escrever o teste da fundação**

Criar `tests/unit/shadcn-fundacao.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cn } from '@/lib/utils';

const css = readFileSync(resolve(process.cwd(), 'src/app/globals.css'), 'utf8');
const componentsJson = JSON.parse(
  readFileSync(resolve(process.cwd(), 'components.json'), 'utf8'),
);

describe('cn', () => {
  it('junta classes', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('a última classe conflitante vence — é para isso que serve o tailwind-merge', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });

  it('ignora falsy', () => {
    expect(cn('a', false && 'b', undefined, 'c')).toBe('a c');
  });
});

describe('components.json', () => {
  it('usa o mesmo estilo do bdsolutions', () => {
    expect(componentsJson.style).toBe('base-nova');
    expect(componentsJson.tailwind.baseColor).toBe('neutral');
    expect(componentsJson.tailwind.cssVariables).toBe(true);
    expect(componentsJson.iconLibrary).toBe('lucide');
    expect(componentsJson.rsc).toBe(true);
  });

  it('instala em src/components/ui', () => {
    expect(componentsJson.aliases.ui).toBe('@/components/ui');
    expect(componentsJson.aliases.utils).toBe('@/lib/utils');
  });
});

describe('tokens canônicos', () => {
  // O shadcn gera classes como bg-background e text-destructive. Sem estes
  // nomes, todo componente que vier do CLI sai sem cor.
  const CANONICOS = [
    'background', 'foreground', 'primary', 'primary-foreground',
    'secondary', 'muted', 'muted-foreground', 'accent',
    'destructive', 'border', 'input', 'ring', 'card', 'popover', 'radius',
  ];

  it.each(CANONICOS)('declara --%s', (nome) => {
    expect(css).toMatch(new RegExp(`--${nome}\\s*:`));
  });

  it('preserva a densidade de balcão', () => {
    expect(css).toMatch(/--tap-min:\s*44px/);
    expect(css).toMatch(/--tap-md:\s*52px/);
  });

  it('preserva a cor de estado, que não gira com a marca', () => {
    for (const tom of ['ok', 'perigo', 'alerta', 'agora']) {
      expect(css).toContain(`--${tom}`);
    }
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/unit/shadcn-fundacao.test.ts`
Expected: FAIL — não existem `components.json`, `src/lib/utils.ts` nem os tokens canônicos.

- [ ] **Step 3: Instalar as dependências de base**

```bash
npm install class-variance-authority clsx tailwind-merge lucide-react
```

Não instalar `@base-ui/react` nem `cmdk` agora: eles entram nas tasks que precisam deles (6 e 8), trazidos pelo próprio CLI.

- [ ] **Step 4: Criar o `components.json`**

Copiar a estrutura do `/home/franklin/dev/bdsolutions/components.json`, ajustando só o que for caminho local. O conteúdo esperado:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "base-nova",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "iconLibrary": "lucide",
  "rtl": false,
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "menuColor": "default",
  "menuAccent": "subtle",
  "registries": {}
}
```

- [ ] **Step 5: Criar o `cn()`**

Criar `src/lib/utils.ts`:

```ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Junta classes resolvendo conflito do Tailwind — a última vence.
 * É o que permite um componente aceitar `className` de fora sem que a classe
 * de dentro ganhe por ordem de declaração.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 6: Acrescentar os tokens canônicos ao `globals.css`**

**Não apagar nada.** Os tokens em português continuam e seguem sendo a fonte do valor; os canônicos apontam para eles. Assim os componentes do shadcn funcionam e os nossos 60 arquivos existentes não quebram.

Dentro do `:root` (e o espelho no bloco de tema escuro), acrescentar:

```css
  /* Nomes canônicos do shadcn. O valor continua sendo o que o júri decidiu na
     §3.1 — isto é tradução, não redecoração. Os nomes em português seguem
     valendo e são removidos na Task 10, quando ninguém mais os usar. */
  --background: var(--bg);
  --foreground: var(--tinta);
  --card: var(--superficie);
  --card-foreground: var(--tinta);
  --popover: var(--superficie);
  --popover-foreground: var(--tinta);
  --primary: var(--tinta);              /* botão primário é tinta, não marca */
  --primary-foreground: var(--bg);
  --secondary: var(--superficie-2);
  --secondary-foreground: var(--tinta);
  --muted: var(--superficie-2);
  --muted-foreground: var(--tinta-2);
  --accent: var(--marca);
  --accent-foreground: var(--sobre-marca);
  --destructive: var(--perigo);
  --destructive-foreground: var(--bg);
  --border: var(--linha);
  --input: var(--linha);
  --ring: var(--anel);
  --radius: var(--r);
```

Atenção ao `--primary`: no design doc o botão primário é `--tinta`, **não** a cor da loja. A §3.4 é explícita — a marca aparece em cinco lugares fechados e o botão não é um deles. Mapear `--primary` para `--marca` mudaria a aparência do produto inteiro e é justamente o que esta migração não pode fazer.

E expor no `@theme inline` para o Tailwind gerar as utilities (`bg-background`, `text-muted-foreground`, …), no mesmo formato dos `--color-*` que já existem.

- [ ] **Step 7: Rodar e ver passar**

Run: `npx vitest run tests/unit/shadcn-fundacao.test.ts`
Expected: PASS.

- [ ] **Step 8: Provar que a aparência não mudou**

Run: `DATABASE_URL_TEST=postgres://barbearia:barbearia@localhost:5433/barbearia_test npx vitest run && npx tsc --noEmit && npx eslint src tests && npm run build`
Expected: tudo verde. Nenhum componente foi tocado, então nenhum teste de UI pode mudar de resultado.

- [ ] **Step 9: Confirmar que o CLI funciona**

Run: `npx shadcn@latest add button --yes --overwrite`
Expected: cria `src/components/ui/button.tsx`. **Depois, apagar o arquivo** — ele entra de verdade na Task 2. Este passo existe só para provar que o `components.json` está correto antes de dez tasks dependerem dele.

```bash
rm src/components/ui/button.tsx
```

- [ ] **Step 10: Commit**

```bash
git add components.json src/lib/utils.ts src/app/globals.css package.json package-lock.json tests/unit/shadcn-fundacao.test.ts
git commit -m "chore(ui): fundação do shadcn com os tokens da direção traduzidos"
```

---

## Task 2: Botão

**Files:**
- Create: `src/components/ui/button.tsx` (via CLI)
- Modify: `src/components/ui/botao.tsx`, `src/components/ui/botao.test.tsx`

**Interfaces:**
- Consumes: `cn` da Task 1
- Produces: `Botao` com a **mesma API de hoje** — `variante`, `tamanho`, `largura`, `pendente`, `rotuloPendente`. Nenhum chamador muda. Por dentro passa a compor o `Button` do shadcn.

- [ ] **Step 1: Trazer o button do shadcn**

```bash
npx shadcn@latest add button --yes
```

Ler `src/components/ui/button.tsx`: ele traz um `buttonVariants` em `cva` com variantes `default | destructive | outline | secondary | ghost | link` e tamanhos `default | sm | lg | icon`.

- [ ] **Step 2: Escrever o teste do que não pode mudar**

Acrescentar a `src/components/ui/botao.test.tsx`:

```tsx
describe('Botao — contrato preservado na migração', () => {
  it('mantém a altura de balcão, não a do shadcn', () => {
    render(<Botao>Agendar</Botao>);
    const b = screen.getByRole('button', { name: 'Agendar' });
    // 52px vem de --tap-md; o default do shadcn é 36px e não serve para o balcão
    expect(b.className).toMatch(/tap-md|h-\[52px\]|min-h-\[var\(--tap-md\)\]/);
  });

  it('aceita className de fora sem perder o que vem de dentro', () => {
    render(<Botao className="w-40">Agendar</Botao>);
    expect(screen.getByRole('button').className).toMatch(/w-40/);
  });

  it('as seis variantes continuam existindo', () => {
    for (const v of ['primario', 'secundario', 'ok', 'perigo', 'perigo-vazado', 'texto'] as const) {
      const { unmount } = render(<Botao variante={v}>X</Botao>);
      expect(screen.getByRole('button')).toBeDefined();
      unmount();
    }
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run src/components/ui/botao.test.tsx`
Expected: FAIL no primeiro caso se o `Botao` ainda não usa o token de toque via classe, ou PASS se já usava — nesse caso, o teste passa a ser a guarda contra a regressão que a Task 2 poderia causar. Se passar, siga: o valor dele é impedir que a reescrita quebre a altura.

- [ ] **Step 4: Reescrever o Botao sobre o Button**

`botao.tsx` passa a mapear as nossas variantes para as do shadcn e a sobrescrever tamanho e altura:

```tsx
import { Button, buttonVariants } from './button';
import { cn } from '@/lib/utils';

const VARIANTE: Record<NonNullable<BotaoProps['variante']>, Parameters<typeof buttonVariants>[0]['variant']> = {
  primario: 'default',
  secundario: 'outline',
  ok: 'default',
  perigo: 'destructive',
  'perigo-vazado': 'outline',
  texto: 'ghost',
};
```

As classes de altura, largura e as cores de `ok` e `perigo-vazado` — que o shadcn não tem — vêm por `cn()` em cima. O `pendente` continua desabilitando e trocando o rótulo, exatamente como hoje.

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/components/ui/botao.test.tsx`
Expected: PASS.

- [ ] **Step 6: Provar que as telas não mudaram**

Run: `DATABASE_URL_TEST=... npx vitest run && npx tsc --noEmit && npx eslint src tests`
Expected: verde. `Botao` é usado em dezenas de lugares; se algum teste de tela quebrar, a API mudou sem querer.

- [ ] **Step 7: Olhar**

Run: `npx next dev --port 3333`, abrir `/b/barbearia-do-marcao` e `/app/agenda`. Os botões têm que estar **iguais** aos de antes — mesma altura, mesma cor, mesmo estado pendente.

- [ ] **Step 8: Commit**

```bash
git add src/components/ui/button.tsx src/components/ui/botao.tsx src/components/ui/botao.test.tsx
git commit -m "refactor(ui): Botao passa a compor o button do shadcn, sem mudar de aparência"
```

---

## Task 3: Campo

**Files:**
- Create: `src/components/ui/field.tsx`, `input.tsx`, `label.tsx` (via CLI)
- Modify: `src/components/ui/campo.tsx`
- Test: `src/components/ui/campo.test.tsx`

**Interfaces:**
- Consumes: `cn` da Task 1
- Produces: `Campo` com a API de hoje — `rotulo`, `dica`, `erro`, `prefixo`, `sufixo`, `children`

- [ ] **Step 1: Trazer os três do shadcn**

```bash
npx shadcn@latest add field input label --yes
```

- [ ] **Step 2: Escrever o teste do rótulo implícito**

Este é o ponto de maior risco da migração inteira: há e2e casando por `getByLabel('Seu nome')`, e o `field` do shadcn associa por `htmlFor`/`id`, enquanto o nosso usa `<label>` como contêiner. Os dois funcionam para `getByLabel`, mas só se o id for gerado e ligado corretamente.

Criar `src/components/ui/campo.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Campo } from './campo';

describe('Campo', () => {
  it('o rótulo encontra o controle — é assim que o e2e acha o campo', () => {
    render(<Campo rotulo="Seu nome"><input name="nome" /></Campo>);
    expect(screen.getByLabelText('Seu nome')).toBeDefined();
  });

  it('erro vira mensagem anunciada', () => {
    render(<Campo rotulo="Telefone" erro="Informe um telefone com DDD"><input /></Campo>);
    const alerta = screen.getByRole('alert');
    expect(alerta.textContent).toBe('Informe um telefone com DDD');
  });

  it('sem erro não renderiza alerta vazio', () => {
    render(<Campo rotulo="Telefone"><input /></Campo>);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('prefixo é elemento real, não placeholder', () => {
    render(<Campo rotulo="Preço" prefixo="R$"><input /></Campo>);
    expect(screen.getByText('R$')).toBeDefined();
  });

  it('mantém a altura de balcão', () => {
    const { container } = render(<Campo rotulo="Seu nome"><input /></Campo>);
    const input = container.querySelector('input');
    expect(input?.className ?? '').toMatch(/tap-md|h-\[52px\]/);
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run src/components/ui/campo.test.tsx`
Expected: FAIL nos casos que o `Campo` atual não cobre com essas asserções.

- [ ] **Step 4: Reescrever o Campo sobre Field/Input/Label**

Usar a anatomia do `field` do shadcn (`FieldLabel`, `FieldDescription`, `FieldError`), gerando o id com `React.useId()` e ligando `htmlFor`. O `children` continua sendo o controle cru, e o `Campo` clona o elemento para injetar `id` e `aria-describedby`.

Manter a altura de 52px por `cn()` sobre o `input`.

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/components/ui/campo.test.tsx`
Expected: PASS, 5 testes.

- [ ] **Step 6: Rodar o e2e, que é quem prova de verdade**

Run: `npx playwright test`
Expected: 5 passando. `getByLabel('Seu nome')` e `getByLabel('Telefone')` continuam achando os campos.

- [ ] **Step 7: Commit**

```bash
git add src/components/ui
git commit -m "refactor(ui): Campo passa a usar field, input e label do shadcn"
```

---

## Task 4: Bloco, Monograma e Esqueleto

Três componentes pequenos com equivalente direto. Vão juntos porque nenhum deles sozinho justifica um ciclo de revisão.

**Files:**
- Create: `src/components/ui/alert.tsx`, `avatar.tsx`, `skeleton.tsx` (via CLI)
- Modify: `src/components/ui/bloco.tsx`, `monograma.tsx`, `esqueleto-de-linha.tsx`
- Test: `src/components/ui/bloco.test.tsx`

**Interfaces:**
- Consumes: `cn` da Task 1
- Produces: `Bloco` (`tom`, `papel`, `compacto`, `acao`), `Monograma` (`nome`, `tamanho`), `EsqueletoDeLinha` (`altura`, `quantidade`) — todas as APIs idênticas às de hoje

- [ ] **Step 1: Trazer os três**

```bash
npx shadcn@latest add alert avatar skeleton --yes
```

- [ ] **Step 2: Escrever o teste do Bloco**

O `Bloco` é o mais delicado dos três: ele carrega `role="alert"` e `role="status"`, e é usado em 13 lugares depois que o `ErroDeAcao` foi adotado.

Criar `src/components/ui/bloco.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Bloco } from './bloco';

describe('Bloco', () => {
  it('papel alert vira role=alert — é o que o leitor de tela anuncia na hora', () => {
    render(<Bloco tom="perigo" papel="alert">Não deu</Bloco>);
    expect(screen.getByRole('alert').textContent).toBe('Não deu');
  });

  it('papel status vira role=status', () => {
    render(<Bloco tom="ok" papel="status">Salvo</Bloco>);
    expect(screen.getByRole('status').textContent).toBe('Salvo');
  });

  it('sem papel não vira região anunciada', () => {
    render(<Bloco>Informação comum</Bloco>);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('os cinco tons existem', () => {
    for (const tom of ['info', 'ok', 'perigo', 'alerta', 'agora'] as const) {
      const { unmount } = render(<Bloco tom={tom}>X</Bloco>);
      expect(screen.getByText('X')).toBeDefined();
      unmount();
    }
  });

  it('a ação aparece dentro do bloco', () => {
    render(<Bloco acao={<button>Tentar de novo</button>}>Falhou</Bloco>);
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeDefined();
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run src/components/ui/bloco.test.tsx`
Expected: FAIL — o arquivo de teste é novo; se algum caso já passar, ele vira guarda contra a reescrita.

- [ ] **Step 4: Reescrever os três**

`bloco.tsx` compõe o `Alert` do shadcn. O `alert` do base-nova traz variantes `default` e `destructive`; os tons `ok`, `alerta` e `agora` são nossos e entram por `cva` próprio em cima, usando `--ok`, `--alerta` e `--agora`, que já existem.

`monograma.tsx` compõe `Avatar` + `AvatarFallback` — o fallback é exatamente o caso de uso, já que `staff.photoUrl` é `null` em todas as linhas. Quando a foto existir um dia, `AvatarImage` entra sem mudar o chamador.

`esqueleto-de-linha.tsx` vira um laço sobre `Skeleton`, mantendo `altura` e `quantidade`.

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/components/ui/`
Expected: PASS.

- [ ] **Step 6: Suíte inteira e olhada**

Run: `DATABASE_URL_TEST=... npx vitest run && npx tsc --noEmit && npx eslint src tests`

`npx next dev --port 3333` e conferir: um erro de formulário (Bloco perigo), a lista de equipe (Monograma) e uma tela carregando (Esqueleto).

- [ ] **Step 7: Commit**

```bash
git add src/components/ui
git commit -m "refactor(ui): Bloco, Monograma e Esqueleto sobre alert, avatar e skeleton"
```

---

## Task 5: Folha inferior sobre o drawer

A troca de maior ganho técnico do plano. Nossa `FolhaInferior` implementa foco preso, retorno ao disparador e `inert` no `<main>` na mão; o `drawer` faz isso com uma biblioteca testada por muito mais gente.

**Files:**
- Create: `src/components/ui/drawer.tsx` (via CLI, traz `@base-ui/react`)
- Modify: `src/components/ui/folha-inferior.tsx`, `src/components/ui/folha-inferior.test.tsx`

**Interfaces:**
- Consumes: `cn` da Task 1
- Produces: `FolhaInferior` com a API de hoje — `aberta`, `titulo`, `aoFechar`, `rodape`, `guardaDeDescarte`, `children`. Os dois chamadores (agenda e encaixe) não mudam.

- [ ] **Step 1: Trazer o drawer**

```bash
npx shadcn@latest add drawer --yes
```

Isso instala `@base-ui/react`. É a única dependência de runtime nova do plano, fora o `cmdk` da Task 8.

- [ ] **Step 2: Os testes que já existem são o contrato**

`src/components/ui/folha-inferior.test.tsx` já tem 5 casos cobrindo diálogo modal rotulado, foco no primeiro elemento, `Escape` fechando, guarda de descarte e não renderizar quando fechada. **Não reescrever.** Eles passam a valer como teste de aceitação da troca.

Acrescentar dois que o drawer deve resolver melhor que a nossa implementação:

```tsx
it('devolve o foco ao disparador quando fecha', async () => {
  function Cena() {
    const [aberta, setAberta] = React.useState(false);
    return (
      <>
        <button onClick={() => setAberta(true)}>Encaixe</button>
        <FolhaInferior aberta={aberta} titulo="Encaixe" aoFechar={() => setAberta(false)}>
          <button>Dentro</button>
        </FolhaInferior>
      </>
    );
  }
  render(<Cena />);
  const disparador = screen.getByRole('button', { name: 'Encaixe' });
  await userEvent.click(disparador);
  await userEvent.keyboard('{Escape}');
  expect(document.activeElement).toBe(disparador);
});

it('o conteúdo de fora fica inerte enquanto aberta', () => {
  render(
    <>
      <main><button>Fora</button></main>
      <FolhaInferior aberta titulo="Encaixe" aoFechar={() => {}}>
        <button>Dentro</button>
      </FolhaInferior>
    </>,
  );
  // com a folha aberta, o botão de fora não pode ser alcançável
  expect(screen.getByRole('button', { name: 'Dentro' })).toBeDefined();
  const fora = screen.queryByRole('button', { name: 'Fora' });
  expect(fora === null || fora.closest('[inert]') !== null).toBe(true);
});
```

- [ ] **Step 3: Rodar e ver o estado atual**

Run: `npx vitest run src/components/ui/folha-inferior.test.tsx`
Expected: os 5 antigos passam; os 2 novos podem passar ou falhar conforme a implementação atual. Anotar qual foi — é a linha de base da comparação.

- [ ] **Step 4: Reescrever sobre o drawer**

`FolhaInferior` passa a ser um invólucro fino do `Drawer` do shadcn, com `direction="bottom"`. O que continua nosso:

- `max-width: 560px` centrada em telas grandes — **não vira modal**, segue folha inferior, conforme a §4.3 do design doc;
- `padding-bottom: env(safe-area-inset-bottom)`;
- `max-height: 92dvh`;
- a `guardaDeDescarte`, que intercepta o fechamento quando há campo preenchido.

O `aoFechar` mapeia para `onOpenChange(false)`.

- [ ] **Step 5: Rodar e comparar**

Run: `npx vitest run src/components/ui/folha-inferior.test.tsx`
Expected: os 7 passando. Se algum dos 5 antigos quebrar, a troca perdeu comportamento e precisa ser resolvida — não afrouxe o teste.

- [ ] **Step 6: Testar no aparelho, que é onde folha inferior se prova**

Run: `npx next dev --port 3333`, abrir `/app/agenda` em 360px e tocar "Encaixe". Conferir: a folha sobe de baixo, arrasta para fechar, o fundo não rola, o teclado do celular não cobre o campo, e fechar devolve o foco para o botão "Encaixe".

- [ ] **Step 7: Suíte e commit**

Run: `DATABASE_URL_TEST=... npx vitest run && npx tsc --noEmit && npx eslint src tests && npx playwright test`

```bash
git add src/components/ui package.json package-lock.json
git commit -m "refactor(ui): folha inferior sobre o drawer, com foco e inert de biblioteca"
```

---

## Task 6: Segmentado e Fichas de escolha

**Files:**
- Create: `src/components/ui/toggle-group.tsx`, `toggle.tsx`, `radio-group.tsx` (via CLI)
- Modify: `src/components/ui/segmentado.tsx`, `fichas-de-escolha.tsx`
- Test: `src/components/ui/segmentado.test.tsx`

**Interfaces:**
- Consumes: `cn` da Task 1
- Produces: `Segmentado<T>` (`opcoes`, `valor`, `aoTrocar`, `rotuloDoGrupo`) e `FichasDeEscolha` (`rotuloDoGrupo`, `opcoes`, `valor`, `aoTrocar`, `nomeDoCampoOculto`, `alturaMaxima`) — APIs idênticas

- [ ] **Step 1: Trazer os três**

```bash
npx shadcn@latest add toggle-group radio-group --yes
```

O `toggle-group` puxa `toggle` junto, por dependência de registry.

- [ ] **Step 2: Escrever o teste do que não pode sumir**

O `nomeDoCampoOculto` é o detalhe que faz a server action não mudar: as fichas renderizam um `<input type="hidden">` com o valor escolhido. Se sumir na migração, o encaixe para de funcionar e nenhum teste de componente pega.

Acrescentar a `src/components/ui/segmentado.test.tsx`:

```tsx
describe('FichasDeEscolha — contrato com a server action', () => {
  it('renderiza o campo oculto com o valor escolhido', () => {
    const { container } = render(
      <FichasDeEscolha
        rotuloDoGrupo="Barbeiro"
        opcoes={[{ valor: 'a', rotulo: 'João' }, { valor: 'b', rotulo: 'Pedro' }]}
        valor="b"
        aoTrocar={() => {}}
        nomeDoCampoOculto="staffId"
      />,
    );
    const oculto = container.querySelector('input[type="hidden"][name="staffId"]');
    expect(oculto).not.toBeNull();
    expect((oculto as HTMLInputElement).value).toBe('b');
  });

  it('sem nomeDoCampoOculto não renderiza campo oculto', () => {
    const { container } = render(
      <FichasDeEscolha
        rotuloDoGrupo="Barbeiro"
        opcoes={[{ valor: 'a', rotulo: 'João' }]}
        valor="a"
        aoTrocar={() => {}}
      />,
    );
    expect(container.querySelector('input[type="hidden"]')).toBeNull();
  });

  it('o grupo é anunciado pelo rótulo', () => {
    render(
      <FichasDeEscolha
        rotuloDoGrupo="Serviço"
        opcoes={[{ valor: 'a', rotulo: 'Corte' }]}
        valor="a"
        aoTrocar={() => {}}
      />,
    );
    expect(screen.getByRole('radiogroup', { name: 'Serviço' })).toBeDefined();
  });
});

describe('Segmentado', () => {
  it('marca a opção ativa com aria-pressed ou aria-checked', () => {
    render(
      <Segmentado
        rotuloDoGrupo="Modo"
        opcoes={[{ valor: 'agora', rotulo: 'Agora' }, { valor: 'marcar', rotulo: 'Marcar hora' }]}
        valor="agora"
        aoTrocar={() => {}}
      />,
    );
    const ativo = screen.getByRole('button', { name: 'Agora' })
      ?? screen.getByRole('radio', { name: 'Agora' });
    const marcado = ativo.getAttribute('aria-pressed') ?? ativo.getAttribute('aria-checked');
    expect(marcado).toBe('true');
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run src/components/ui/segmentado.test.tsx`
Expected: FAIL nos casos novos.

- [ ] **Step 4: Reescrever os dois**

`segmentado.tsx` sobre `ToggleGroup type="single"`, com altura de 48px e as duas ou três opções lado a lado.

`fichas-de-escolha.tsx` sobre `RadioGroup`, com cada ficha estilizada como cartão tocável de 52px em vez de bolinha — o `radio-group` do shadcn aceita isso porque o indicador é substituível. Manter o `<input type="hidden">` e o `alturaMaxima` com rolagem interna.

- [ ] **Step 5: Rodar, ver passar e provar no encaixe**

Run: `npx vitest run src/components/ui/segmentado.test.tsx && DATABASE_URL_TEST=... npx vitest run tests/integration/walk-in.test.ts`
Expected: PASS nos dois. O segundo é o que prova que a server action continua recebendo `staffId` e `serviceId`.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui
git commit -m "refactor(ui): Segmentado e Fichas sobre toggle-group e radio-group"
```

---

## Task 7: Busca de cliente sobre o command

**Files:**
- Create: `src/components/ui/command.tsx`, `dialog.tsx`, `input-group.tsx` (via CLI, traz `cmdk`)
- Modify: `src/components/ui/busca-de-cliente.tsx`
- Test: `src/components/ui/busca-de-cliente.test.tsx`

**Interfaces:**
- Consumes: `cn` da Task 1
- Produces: `BuscaDeCliente` (`valorInicial`) — API idêntica

- [ ] **Step 1: Trazer o command**

```bash
npx shadcn@latest add command --yes
```

Traz `cmdk` como dependência e `dialog` + `input-group` por registry.

- [ ] **Step 2: Escrever o teste**

Criar `src/components/ui/busca-de-cliente.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BuscaDeCliente } from './busca-de-cliente';

describe('BuscaDeCliente', () => {
  it('tem campo de busca rotulado', () => {
    render(<BuscaDeCliente />);
    expect(screen.getByRole('searchbox') ?? screen.getByLabelText(/nome ou telefone/i)).toBeDefined();
  });

  it('não busca com menos de dois caracteres — evita varrer a base a cada tecla', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ clientes: [] }), { status: 200 }),
    );
    render(<BuscaDeCliente />);
    await userEvent.type(screen.getByRole('searchbox'), 'a');
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('mostra estado vazio quando não acha ninguém', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ clientes: [] }), { status: 200 }),
    );
    render(<BuscaDeCliente />);
    await userEvent.type(screen.getByRole('searchbox'), 'zzz');
    expect(await screen.findByText(/nenhum cliente/i)).toBeDefined();
  });
});
```

- [ ] **Step 3: Rodar, ver falhar, reescrever, ver passar**

Run: `npx vitest run src/components/ui/busca-de-cliente.test.tsx`

Reescrever sobre `Command` + `CommandInput` + `CommandList` + `CommandEmpty` + `CommandItem`, mantendo o debounce e a chamada a `GET /api/panel/clientes?q=`.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui package.json package-lock.json
git commit -m "refactor(ui): busca de cliente sobre o command"
```

---

## Task 8: Os quatro sem equivalente, adaptados ao padrão

`tira-de-dias`, `grade-de-horarios`, `botao-de-confirmacao` e `cabecalho-de-pagina` continuam nossos — o shadcn não tem nada que resolva o problema deles. O que muda é a **forma**: por dentro passam a se parecer com os outros.

**Files:**
- Modify: `src/components/ui/tira-de-dias.tsx`, `grade-de-horarios.tsx`, `botao-de-confirmacao.tsx`, `cabecalho-de-pagina.tsx`
- Test: os arquivos de teste que já existem para tira, grade e botão de confirmação

**Interfaces:**
- Consumes: `cn`, `cva`
- Produces: as mesmas APIs de hoje, sem exceção

- [ ] **Step 1: Definir o padrão, por escrito, antes de aplicar**

Um componente "no padrão shadcn" tem cinco coisas, e é isso que vai ser aplicado aos quatro:

1. variantes por `cva`, exportando o `xxxVariants` para quem quiser compor;
2. `cn()` para juntar classe interna com a `className` recebida;
3. `React.ComponentProps<'div'>` (ou o elemento certo) na base do tipo, em vez de tipo fechado — o componente aceita os atributos nativos;
4. `data-slot="nome-da-parte"` em cada parte estilizável;
5. sem `forwardRef` — no React 19 `ref` é prop comum, e é assim que o shadcn gera hoje.

- [ ] **Step 2: Escrever o teste do padrão**

Criar `tests/unit/padrao-de-componente.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const NOSSOS = [
  'tira-de-dias', 'grade-de-horarios', 'botao-de-confirmacao', 'cabecalho-de-pagina',
];

describe.each(NOSSOS)('src/components/ui/%s.tsx', (nome) => {
  const fonte = readFileSync(
    resolve(process.cwd(), `src/components/ui/${nome}.tsx`), 'utf8',
  );

  it('usa cn() para aceitar className de fora', () => {
    expect(fonte).toContain("from '@/lib/utils'");
    expect(fonte).toMatch(/\bcn\(/);
  });

  it('marca as partes com data-slot', () => {
    expect(fonte).toMatch(/data-slot="/);
  });

  it('não usa forwardRef — no React 19 ref é prop comum', () => {
    expect(fonte).not.toMatch(/forwardRef/);
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run tests/unit/padrao-de-componente.test.ts`
Expected: FAIL — os quatro ainda não seguem o padrão.

- [ ] **Step 4: Adaptar os quatro**

Sem mudar comportamento nem aparência. Em particular:

- `tira-de-dias` mantém a grade 7×2 que **não rola de lado** e o ponto de 4px de situação;
- `grade-de-horarios` mantém os blocos MANHÃ/TARDE/NOITE, o `data-hora="HH:mm"` (há e2e lendo esse atributo) e a deduplicação quando o cliente escolheu "qualquer barbeiro";
- `botao-de-confirmacao` mantém os dois tempos e o retorno automático ao rótulo original;
- `cabecalho-de-pagina` mantém a anatomia título/descrição/ação.

- [ ] **Step 5: Rodar tudo**

Run: `npx vitest run tests/unit/padrao-de-componente.test.ts && DATABASE_URL_TEST=... npx vitest run && npx playwright test`
Expected: verde. O e2e é o que garante que o `data-hora` sobreviveu.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui tests/unit/padrao-de-componente.test.ts
git commit -m "refactor(ui): componentes de domínio adaptados ao padrão do shadcn"
```

---

## Task 9: Ícones e toast

**Files:**
- Create: `src/components/ui/sonner.tsx` (via CLI)
- Modify: os arquivos com SVG embutido, `src/app/layout.tsx`
- Test: `tests/unit/icones.test.ts`

**Interfaces:**
- Produces: ícones vindos de `lucide-react`; `toast` disponível via `sonner`

- [ ] **Step 1: Achar os SVG embutidos**

Run: `grep -rln "<svg" src/ --include=*.tsx`

O design doc mandava SVG embutido justamente porque não havia biblioteca de ícone. Com o `lucide-react` instalado na Task 1, isso deixa de valer.

- [ ] **Step 2: Escrever o teste**

Criar `tests/unit/icones.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { globSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Cada SVG escrito à mão é um ícone que ninguém mais vai manter, com tamanho e
// traço diferentes dos outros. Com lucide instalado, não há motivo para existir.
const arquivos = globSync('src/**/*.tsx', { cwd: process.cwd() });

describe('ícones', () => {
  it('nenhum SVG desenhado à mão sobrou', () => {
    const comSvg = arquivos.filter((f) =>
      readFileSync(resolve(process.cwd(), f), 'utf8').includes('<svg'),
    );
    expect(comSvg).toEqual([]);
  });
});
```

- [ ] **Step 3: Rodar, ver falhar, trocar, ver passar**

Trocar cada SVG pelo equivalente do lucide (`ChevronRight`, `Search`, `Check`, `X`, `Calendar`, `Clock`, conforme o caso), com `aria-hidden="true"` e tamanho vindo de prop, não de atributo fixo.

- [ ] **Step 4: Instalar o sonner**

```bash
npx shadcn@latest add sonner --yes
```

Acrescentar `<Toaster />` ao `src/app/layout.tsx`. **Não sair trocando** as mensagens que já existem: `role="alert"` perto do botão continua sendo o certo para erro de formulário. O toast serve para confirmação de ação no painel — "Compareceu" marcado, "Desfazer" disponível — onde hoje não há retorno visual nenhum.

- [ ] **Step 5: Rodar tudo e commitar**

Run: `DATABASE_URL_TEST=... npx vitest run && npx tsc --noEmit && npx eslint src tests && npm run build`

```bash
git add src package.json package-lock.json tests
git commit -m "refactor(ui): ícones do lucide e toast do sonner"
```

---

## Task 10: Limpeza e atualização da direção

**Files:**
- Modify: `src/app/globals.css`, `docs/superpowers/design/2026-08-07-direcao-de-ui.md`, `AGENTS.md`
- Test: `tests/unit/shadcn-fundacao.test.ts`

- [ ] **Step 1: Remover os alias em português que ninguém mais usa**

Run: `grep -rn "var(--tinta)\|var(--bg)\|bg-tinta\|text-tinta" src/ | wc -l`

Para cada token em português ainda referenciado, decidir: se só os componentes usam, trocar pelo canônico e remover o alias; se aparece em muitos lugares de tela, manter e anotar. **Não force**: alias que sobrevive não faz mal, token duplicado sem dono faz.

Os tokens que **não têm canônico** e continuam como estão: `--ok`, `--alerta`, `--agora`, `--marca`, `--marca-suave`, `--sobre-marca`, `--tap-*`, `--sombra-*`. Eles são do nosso domínio e o shadcn não tem equivalente.

- [ ] **Step 2: Atualizar o design doc**

A **§4.1 do design doc diz hoje "Nada vem do shadcn"** e chama isso de restrição do produto. Essa decisão foi revertida pelo dono em 13/08/2026. Reescrever a seção registrando: o que mudou, por quê (alinhamento com bdsolutions e Angular/Spartan), o que foi mantido (tokens, densidade de balcão, cor da loja) e o que passou a vir de fora.

Documento que contradiz o código é pior que documento nenhum — quem ler daqui a três meses vai acreditar nele.

- [ ] **Step 3: Registrar o padrão no AGENTS.md**

Uma linha dizendo que componente novo vem pelo CLI do shadcn com estilo `base-nova`, e que componente de domínio segue o padrão da Task 8.

- [ ] **Step 4: Verificação final**

```bash
docker exec barbearia-postgres psql -U barbearia -d postgres -c "DROP DATABASE IF EXISTS barbearia_shadcn"
docker exec barbearia-postgres psql -U barbearia -d postgres -c "CREATE DATABASE barbearia_shadcn"
DATABASE_URL_TEST=postgres://barbearia:barbearia@localhost:5433/barbearia_shadcn npx tsx src/db/migrate.ts
DATABASE_URL_TEST=postgres://barbearia:barbearia@localhost:5433/barbearia_shadcn npx vitest run
DATABASE_URL_TEST=postgres://barbearia:barbearia@localhost:5433/barbearia_shadcn npx vitest run
npx tsc --noEmit && npx eslint src tests && npm run build && npx playwright test
```

Expected: suíte verde duas vezes no mesmo banco, tipos limpos, lint sem saída, build compilando, 5 e2e passando.

- [ ] **Step 5: Comparar as telas com o antes**

`npx next dev --port 3333`, e passar pelo fluxo público inteiro e pela agenda em 360px. **A aparência tem que estar igual à de antes da migração.** Se mudou, ou a variante está errada ou um token não foi mapeado — nos dois casos é defeito, não melhoria.

- [ ] **Step 6: Commit**

```bash
git add src docs AGENTS.md tests
git commit -m "docs(ui): direção atualizada com a adoção do shadcn"
```

---

## Ordem e dependências

Sequencial de 1 a 10. A Task 1 é bloqueante para todas — sem os tokens canônicos, todo componente do CLI sai sem cor.

Da 2 à 8 as tasks são independentes entre si e podem ir em paralelo por frentes, desde que cada uma toque só os seus arquivos:

- frente A: Tasks 2 e 3 (botão e campo — os mais usados, vão primeiro)
- frente B: Tasks 4 e 6 (bloco/monograma/esqueleto e segmentado/fichas)
- frente C: Tasks 5 e 7 (folha e busca — as duas com dependência nova)

A Task 8 depende do padrão estar assentado nas anteriores. A 9 e a 10 fecham.

## O risco desta migração

É uma refatoração de aparência zero: **se alguma tela mudar de visual, é defeito.** Isso torna a verificação mais difícil que o normal, porque teste automatizado não vê layout. Os três anteparos são: as APIs dos componentes não mudam (nenhum chamador é tocado), os testes de componente que já existem viram teste de aceitação, e o e2e casa por nome acessível — que também não muda.

O que nenhum deles pega é espaçamento e alinhamento. Por isso o Step 5 da Task 10 é olhar as telas, e não é opcional.
