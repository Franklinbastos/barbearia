# Reforma de UI da Fase 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar ao produto uma interface de verdade — hoje o Tailwind está instalado e não é usado em nenhuma tela, e o preflight deixou todo botão com 24px de altura clicável.

**Architecture:** Uma camada base de tokens em `globals.css` conserta o app inteiro sem tocar em tela nenhuma. Sobre ela, um punhado de componentes próprios (sem shadcn, sem radix, sem nova dependência) que carregam altura, semântica e estado. As telas são então reescritas uma superfície por vez — pública primeiro, painel depois —, cada passo deixando o produto funcionando.

**Tech Stack:** Next.js 15 App Router · React 19 · TypeScript strict · Tailwind CSS v4 (sem plugin) · Vitest · Playwright · npm

**Fonte da verdade:** `docs/superpowers/design/2026-08-07-direcao-de-ui.md`. Onde este plano cita uma seção (§3.1, §5.4…), o conteúdo daquela seção é normativo e deve ser copiado de lá, não reinventado. Onde os dois divergirem, o design doc vence — e corrija o plano.

## Global Constraints

- Diretório: `/home/franklin/dev/barbearia`. Branch base: `main`. Package manager **npm**.
- **Nenhuma dependência nova de UI.** Sem shadcn, radix, lucide, cva, framer-motion. HTML + classes da §3.1 + SVG embutido. Se sentir falta de uma, o componente está errado.
- Tailwind v4 **sem arquivo de config** — tudo por `@theme` no `globals.css`.
- Server Component por padrão. `'use client'` só onde houver estado, evento ou efeito, e a marcação disso está na §4.3 componente por componente.
- Alvo de toque mínimo **44px**; controles primários de balcão têm **52px**. Nunca confie em classe utilitária solta para garantir altura — altura é propriedade de componente.
- Tudo em pt-BR com acentuação correta, UTF-8 sem BOM.
- Texto entre aspas no design doc é **literal**: há e2e casando por nome acessível. Não "melhore" a redação de "Confirmar horário", "Seu nome", "Telefone", "Qualquer barbeiro", "Horário confirmado", "Ver ou cancelar meu horário".
- Preservar a camada de acessibilidade que já existe: label em todo campo, `role="alert"`/`role="status"` em toda mensagem, estado pendente em todo botão.
- Testes: `DATABASE_URL_TEST=postgres://barbearia:barbearia@localhost:5433/barbearia_test npx vitest run`. O banco de teste é dedicado; nunca rodar contra `barbearia`.
- Commits em pt-BR: `tipo(area): resultado para o usuário`.

## Mapa de arquivos

**Nascem:**

| Arquivo | Responsabilidade |
|---|---|
| `src/components/ui/botao.tsx` | altura, variante e estado pendente de todo botão |
| `src/components/ui/campo.tsx` | `<label>` como contêiner, altura 52px, erro e prefixo |
| `src/components/ui/bloco.tsx` | toda caixa de mensagem (info, ok, perigo, alerta, agora) |
| `src/components/ui/cabecalho-de-pagina.tsx` | anatomia título/descrição/ação das telas do painel |
| `src/components/ui/monograma.tsx` | iniciais no lugar da foto que não existe |
| `src/components/ui/esqueleto-de-linha.tsx` | carregando, no lugar de "Carregando…" |
| `src/components/ui/folha-inferior.tsx` | única superfície flutuante do produto |
| `src/components/ui/botao-de-confirmacao.tsx` | substitui todo `confirm()` |
| `src/components/ui/segmentado.tsx` | "Agora \| Marcar hora" |
| `src/components/ui/fichas-de-escolha.tsx` | substitui `<select>` onde a troca é frequente |
| `src/components/ui/tira-de-dias.tsx` | grade 7×2 de dias, sem rolagem lateral |
| `src/components/ui/grade-de-horarios.tsx` | blocos manhã/tarde/noite + deduplicação |
| `src/lib/telefone.ts` | `aplicarMascaraTelefone`, hoje presa em `contact-step.tsx` |
| `src/lib/cores-de-barbeiro.ts` | cor estável por barbeiro, por índice na equipe |
| `src/app/app/agenda/proximos-livres.ts` | `calcularProximosLivres`, função pura |
| `src/app/not-found.tsx` | slug errado hoje mostra o 404 do Next em inglês |
| `src/app/api/public/[slug]/availability/days/route.ts` | ponto na tira e "próximo dia com vaga" |
| `src/app/api/panel/clientes/route.ts` | busca por nome e telefone |

**Mudam de pele, API idêntica:** `erro-de-acao.tsx`, `panel-nav.tsx`, `error.tsx` (os dois), `toggle-button.tsx`, `toggle-staff-button.tsx`, `anonymize-button.tsx`, `cancel-form.tsx`, `login/page.tsx`, `signup/page.tsx`.

**Mudam de estrutura:** `booking-wizard.tsx` (perde o `useEffect`, ganha dia e contato), `slot-step.tsx`, `day-grid.tsx`, `manual-booking-form.tsx`, `panel-nav.tsx`.

---

## Task 1: Camada base

O passo com maior retorno por hora do plano inteiro. Nenhuma tela é tocada e o app inteiro muda: botão vira botão, campo vira campo, link vira link, foco aparece, e os seletores nativos de data e hora — que são o coração do painel — ficam legíveis no escuro.

**Files:**
- Modify: `src/app/globals.css` (substituição integral), `src/app/layout.tsx`
- Test: `tests/unit/camada-base.test.ts`

**Interfaces:**
- Consumes: nada
- Produces: as classes e os custom properties da §3.1 do design doc, disponíveis para todas as tasks seguintes. Nomes de classe usados adiante: `.bloco`, `.bloco--perigo`, `.bloco--ok`, `.bloco--alerta`, `.bloco--agora`, `.bloco--compacto`, `.lista`, `.campo`, `.campo--erro`.

- [ ] **Step 1: Escrever o teste da camada base**

O risco real aqui é silencioso: alguém "limpa" o `globals.css` meses depois e volta a quebrar tudo. O teste trava as quatro regras que o inventário provou estarem faltando.

Criar `tests/unit/camada-base.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const css = readFileSync(resolve(process.cwd(), 'src/app/globals.css'), 'utf8');

describe('globals.css — camada base', () => {
  it('declara color-scheme, senão os seletores nativos de data e hora quebram no escuro', () => {
    expect(css).toMatch(/color-scheme:\s*light dark/);
  });

  it('não força mais Arial por cima do token de fonte', () => {
    expect(css).not.toMatch(/font-family:\s*Arial/i);
  });

  it('repõe o cursor e a fonte que o preflight tira dos controles', () => {
    expect(css).toMatch(/button[^{]*\{[^}]*cursor:\s*pointer/s);
    expect(css).toMatch(/font:\s*inherit/);
  });

  it('define o alvo de toque mínimo como custom property', () => {
    expect(css).toMatch(/--toque-min:\s*44px/);
    expect(css).toMatch(/--toque-balcao:\s*52px/);
  });

  it('define foco visível para navegação por teclado', () => {
    expect(css).toMatch(/:focus-visible/);
  });

  it('define os tons de bloco que os componentes consomem', () => {
    for (const tom of ['perigo', 'ok', 'alerta', 'agora']) {
      expect(css).toContain(`.bloco--${tom}`);
    }
  });
});
```

- [ ] **Step 2: Rodar o teste para vê-lo falhar**

Run: `npx vitest run tests/unit/camada-base.test.ts`
Expected: FAIL em todos os casos — o `globals.css` atual tem 26 linhas e não tem nada disso.

- [ ] **Step 3: Substituir o globals.css**

Copiar integralmente o bloco da **§3.1 do design doc** para `src/app/globals.css`, substituindo o arquivo inteiro. Não adaptar, não resumir, não "melhorar" valor de cor: os valores foram escolhidos com contraste verificado.

Conferir ao colar que sobreviveram: `@import "tailwindcss"`, o bloco `@theme`, `color-scheme: light dark`, os custom properties de toque, `:focus-visible`, e que **não existe mais** `body { font-family: Arial }`.

- [ ] **Step 4: Trocar a fonte no layout**

Modificar `src/app/layout.tsx` para carregar Inter por `next/font/google` com `variable: '--font-sans'`, `subsets: ['latin']`, `display: 'swap'`, e aplicar a variável na `<html>`. Uma família só — a §3 corta a segunda de propósito.

- [ ] **Step 5: Rodar o teste para vê-lo passar**

Run: `npx vitest run tests/unit/camada-base.test.ts`
Expected: PASS, 6 testes.

- [ ] **Step 6: Provar que nada quebrou**

Run: `DATABASE_URL_TEST=postgres://barbearia:barbearia@localhost:5433/barbearia_test npx vitest run && npx tsc --noEmit && npm run lint && npm run build`
Expected: 348 testes passando (347 + o novo), tipos limpos, lint sem saída, build compilando.

- [ ] **Step 7: Olhar com os próprios olhos**

Run: `npx next dev --port 3333`
Abrir `/b/barbearia-do-marcao` e `/app/agenda`. Os botões agora têm fundo, borda e altura. Os campos têm borda. Os links parecem links. Alternar o tema do sistema para escuro e abrir um `input type="date"` no painel — o seletor tem que estar legível.

- [ ] **Step 8: Commit**

```bash
git add src/app/globals.css src/app/layout.tsx tests/unit/camada-base.test.ts
git commit -m "feat(ui): camada base de tokens, foco visível e controles nativos legíveis"
```

---

## Task 2: Componentes de base e funções compartilhadas

**Files:**
- Create: `src/components/ui/botao.tsx`, `campo.tsx`, `bloco.tsx`, `cabecalho-de-pagina.tsx`, `monograma.tsx`, `esqueleto-de-linha.tsx`
- Create: `src/lib/telefone.ts`, `src/lib/cores-de-barbeiro.ts`
- Modify: `src/lib/format.ts`
- Test: `src/lib/telefone.test.ts`, `src/lib/cores-de-barbeiro.test.ts`, `src/lib/format.test.ts`, `src/components/ui/botao.test.tsx`

**Interfaces:**
- Consumes: as classes da Task 1
- Produces: exatamente as APIs da **§4.3** (`BotaoProps`, `CampoProps`, `BlocoProps`, `CabecalhoDePaginaProps`, `MonogramaProps`, `EsqueletoDeLinhaProps`) e as funções da **§4.4**:
  - `aplicarMascaraTelefone(valor: string): string`
  - `coresDeBarbeiro(staff: { id: string; name: string }[]): Map<string, string>`
  - `formatDayParts(isoDate: string, timeZone: string): { diaSemana: string; dia: string; mes: string }`
  - `formatDayLabelLong(isoDate: string, timeZone: string): string`

- [ ] **Step 1: Escrever os testes das funções puras**

Criar `src/lib/telefone.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { aplicarMascaraTelefone } from './telefone';

describe('aplicarMascaraTelefone', () => {
  it('formata celular com 11 dígitos', () => {
    expect(aplicarMascaraTelefone('11999998888')).toBe('(11) 99999-8888');
  });
  it('formata fixo com 10 dígitos', () => {
    expect(aplicarMascaraTelefone('1133334444')).toBe('(11) 3333-4444');
  });
  it('formata parcial enquanto digita', () => {
    expect(aplicarMascaraTelefone('11')).toBe('(11');
    expect(aplicarMascaraTelefone('119')).toBe('(11) 9');
  });
  it('ignora o que não é dígito', () => {
    expect(aplicarMascaraTelefone('(11) 99999-8888')).toBe('(11) 99999-8888');
  });
  it('não passa de 11 dígitos', () => {
    expect(aplicarMascaraTelefone('119999988889999')).toBe('(11) 99999-8888');
  });
  it('devolve vazio para vazio', () => {
    expect(aplicarMascaraTelefone('')).toBe('');
  });
});
```

Criar `src/lib/cores-de-barbeiro.test.ts`. A regra da §3.5 é **cor por índice na equipe, não por hash** — o hash colide em 72% dos casos com 4 barbeiros, e dois barbeiros com a mesma cor destroem justamente a informação que a aresta colorida existe para dar:

```ts
import { describe, it, expect } from 'vitest';
import { coresDeBarbeiro } from './cores-de-barbeiro';

const equipe = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `s${i}`, name: `Barbeiro ${i}` }));

describe('coresDeBarbeiro', () => {
  it('dá uma cor para cada barbeiro', () => {
    const m = coresDeBarbeiro(equipe(4));
    expect(m.size).toBe(4);
  });

  it('nunca repete cor até acabar a paleta', () => {
    const m = coresDeBarbeiro(equipe(6));
    expect(new Set(m.values()).size).toBe(6);
  });

  it('é estável: a mesma equipe devolve as mesmas cores', () => {
    expect([...coresDeBarbeiro(equipe(4)).values()]).toEqual([...coresDeBarbeiro(equipe(4)).values()]);
  });

  it('não depende da ordem de chegada, só do id', () => {
    const a = coresDeBarbeiro(equipe(3));
    const invertida = [...equipe(3)].reverse();
    const b = coresDeBarbeiro(invertida);
    expect(b.get('s0')).toBe(a.get('s0'));
  });

  it('aguenta equipe maior que a paleta sem quebrar', () => {
    const m = coresDeBarbeiro(equipe(20));
    expect(m.size).toBe(20);
    expect([...m.values()].every((c) => typeof c === 'string' && c.length > 0)).toBe(true);
  });

  it('devolve mapa vazio para equipe vazia', () => {
    expect(coresDeBarbeiro([]).size).toBe(0);
  });
});
```

Acrescentar a `src/lib/format.test.ts`:

```ts
describe('formatDayParts', () => {
  it('quebra a data nas partes que a tira de dias precisa', () => {
    expect(formatDayParts('2026-08-10', 'America/Sao_Paulo')).toEqual({
      diaSemana: 'SEG', dia: '10', mes: 'ago',
    });
  });
  it('usa o fuso da barbearia, não o do servidor', () => {
    expect(formatDayParts('2026-08-10', 'America/Sao_Paulo').dia).toBe('10');
  });
});

describe('formatDayLabelLong', () => {
  it('escreve o dia por extenso em pt-BR', () => {
    expect(formatDayLabelLong('2026-08-14', 'America/Sao_Paulo')).toBe('sexta, 14 de agosto');
  });
});
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `npx vitest run src/lib/telefone.test.ts src/lib/cores-de-barbeiro.test.ts src/lib/format.test.ts`
Expected: FAIL — os dois módulos não existem e as duas funções de format não existem.

- [ ] **Step 3: Implementar as funções puras**

`src/lib/telefone.ts`: mover a implementação de `contact-step.tsx:6-11` para cá e ajustar até os seis casos passarem. Deixar `contact-step.tsx` importando daqui.

`src/lib/cores-de-barbeiro.ts`: implementar conforme a **§3.5** — ordenar a equipe por `id`, atribuir a paleta por índice, e voltar ao começo da paleta quando a equipe for maior que ela.

`src/lib/format.ts`: acrescentar `formatDayParts` e `formatDayLabelLong` usando `Intl.DateTimeFormat` com o `timeZone` recebido. Não tocar em `formatDayLabel`, `formatPrice`, `formatDuration` e `formatTime`, que já têm teste.

- [ ] **Step 4: Rodar para ver passar**

Run: `npx vitest run src/lib/`
Expected: PASS.

- [ ] **Step 5: Escrever o teste do componente Botao**

O contrato que importa é altura e estado pendente — é o que o inventário mostrou faltando em ~60 botões. Instalar o mínimo para testar componente:

```bash
npm install -D @testing-library/react @testing-library/dom jsdom
```

Acrescentar a `vitest.config.ts` um segundo projeto com `environment: 'jsdom'` para `src/components/**/*.test.tsx`, mantendo `node` para o resto. (Alternativa aceitável: `// @vitest-environment jsdom` no topo do arquivo de teste — mais simples, escolha essa se o config resistir.)

Criar `src/components/ui/botao.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Botao } from './botao';

describe('Botao', () => {
  it('é um button de verdade com o texto acessível', () => {
    render(<Botao>Agendar</Botao>);
    expect(screen.getByRole('button', { name: 'Agendar' })).toBeDefined();
  });

  it('quando pendente, desabilita e troca o rótulo', () => {
    render(<Botao pendente rotuloPendente="Agendando…">Agendar</Botao>);
    const b = screen.getByRole('button');
    expect(b.hasAttribute('disabled')).toBe(true);
    expect(b.textContent).toBe('Agendando…');
  });

  it('sem rotuloPendente mantém o texto original e ainda desabilita', () => {
    render(<Botao pendente>Salvar</Botao>);
    const b = screen.getByRole('button');
    expect(b.hasAttribute('disabled')).toBe(true);
    expect(b.textContent).toBe('Salvar');
  });

  it('repassa type e onClick sem engolir', () => {
    render(<Botao type="submit">Enviar</Botao>);
    expect(screen.getByRole('button').getAttribute('type')).toBe('submit');
  });
});
```

- [ ] **Step 6: Rodar para ver falhar**

Run: `npx vitest run src/components/ui/botao.test.tsx`
Expected: FAIL — `Cannot find module './botao'`.

- [ ] **Step 7: Implementar os seis componentes**

Implementar `botao.tsx`, `campo.tsx`, `bloco.tsx`, `cabecalho-de-pagina.tsx`, `monograma.tsx`, `esqueleto-de-linha.tsx` com **exatamente** as props da §4.3. Nenhum deles leva `'use client'` — todos são server-safe.

Dois pontos que a §4.3 marca e são fáceis de errar:
- Em `campo.tsx`, o `<label>` **é** o contêiner e o rótulo é implícito. Nada de `htmlFor` com id gerado: há e2e casando por `getByLabel('Seu nome')` e rótulo implícito é o que mantém isso funcionando sem id.
- Em `bloco.tsx`, `papel` vira `role` — `'alert'` para erro que o usuário precisa ouvir agora, `'status'` para confirmação.

- [ ] **Step 8: Rodar para ver passar**

Run: `npx vitest run src/components/`
Expected: PASS, 4 testes.

- [ ] **Step 9: Adotar o ErroDeAcao nos 11 arquivos que copiam o markup na mão**

`src/components/erro-de-acao.tsx` troca `color: crimson` por `<Bloco tom="perigo" papel="alert" compacto>`. Depois, `grep -rn "crimson\|#b00020\|darkorange" src/` e substituir cada ocorrência por `<ErroDeAcao>`. A API do `ErroDeAcao` não muda, então nenhum chamador precisa de ajuste além do import.

- [ ] **Step 10: Apagar as três cópias locais de formatação de preço**

O inventário achou quatro implementações de preço no projeto. `src/lib/format.ts` já tem
`formatPrice` com teste. Rodar `grep -rn "formatarPreco\|toFixed(2)\|priceCents / 100" src/`,
apagar cada cópia local e importar `formatPrice`. É dívida que a reforma resolve de graça (§6.3).

- [ ] **Step 11: Verificar e commitar**

Run: `DATABASE_URL_TEST=postgres://barbearia:barbearia@localhost:5433/barbearia_test npx vitest run && npx tsc --noEmit && npm run lint`
Expected: tudo verde. Nem `grep -rn "crimson\|#b00020\|darkorange" src/` nem
`grep -rn "formatarPreco" src/` devolvem alguma coisa.

```bash
git add src/components src/lib vitest.config.ts package.json package-lock.json
git commit -m "feat(ui): componentes de base com altura e estado, e cor estável por barbeiro"
```

---

## Task 3: As duas cascas

**Files:**
- Modify: `src/components/panel-nav.tsx`, `src/app/app/layout.tsx`, `src/app/error.tsx`, `src/app/app/error.tsx`
- Create: `src/app/not-found.tsx`
- Test: `tests/unit/casca.test.ts`

**Interfaces:**
- Consumes: `Botao`, `Bloco`, `CabecalhoDePagina` da Task 2
- Produces: casca do painel com nav rolável de 52px e botão de conta com **logout** (que hoje não existe em lugar nenhum); `not-found.tsx` em pt-BR

- [ ] **Step 1: Escrever o teste da nav**

A nav do painel é a causa da rolagem horizontal em **todas** as telas do painel em 360px: flex row sem wrap, nome da loja mais 5 links, passa de 550px. Criar `tests/unit/casca.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PanelNav } from '@/components/panel-nav';

describe('PanelNav', () => {
  const props = { nomeDaLoja: 'Barbearia do Marcão', ativo: '/app/agenda' };

  it('lista as cinco seções do painel', () => {
    render(<PanelNav {...props} />);
    for (const secao of ['Agenda', 'Serviços', 'Equipe', 'Clientes', 'Configurações']) {
      expect(screen.getByRole('link', { name: secao })).toBeDefined();
    }
  });

  it('marca a seção ativa por aria-current, não só por peso da fonte', () => {
    render(<PanelNav {...props} />);
    expect(screen.getByRole('link', { name: 'Agenda' }).getAttribute('aria-current')).toBe('page');
  });

  it('oferece sair da conta — hoje não existe logout em lugar nenhum', () => {
    render(<PanelNav {...props} />);
    expect(screen.getByRole('button', { name: /sair/i })).toBeDefined();
  });

  it('a nav é rolável por dentro, não empurra a página', () => {
    const { container } = render(<PanelNav {...props} />);
    const nav = container.querySelector('nav');
    expect(nav?.className).toMatch(/overflow-x-auto|nav-rolavel/);
  });
});
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `npx vitest run tests/unit/casca.test.ts`
Expected: FAIL — o `PanelNav` de hoje não exporta essas props, não tem `aria-current` e não tem logout.

- [ ] **Step 3: Reescrever a casca do painel**

`panel-nav.tsx` conforme a **§5.1**: barra preta de 56px com o nome da loja e o botão de conta à direita, e abaixo a nav rolável de 52px com as cinco seções. `aria-current="page"` na ativa. O logout chama `authClient.signOut()` do `better-auth/react` e manda para `/login`.

`src/app/app/layout.tsx`: padding lateral de 12px (336px úteis em 360), não 24px.

- [ ] **Step 4: Criar o not-found e retocar os error**

`src/app/not-found.tsx`: slug de barbearia errado hoje entrega o 404 padrão do Next, **em inglês**, para o cliente da loja. Texto em pt-BR, `<Bloco tom="alerta">` e um `<Botao>` de voltar.

`src/app/error.tsx` e `src/app/app/error.tsx`: passam a usar `<Bloco tom="perigo">` + `<Botao>` de tentar de novo.

- [ ] **Step 5: Vestir login e cadastro**

São as duas telas por onde o dono entra no produto pela primeira vez, e hoje são campos sem
borda numa página branca. Conforme a **§5.6**: `src/app/login/page.tsx` e
`src/app/signup/page.tsx` passam a usar `<Campo>` e `<Botao largura="total" tamanho="lg">`,
com o erro em `<Bloco tom="perigo" papel="alert">`.

Preservar os rótulos existentes — há teste casando por eles — e manter o
`<input type="hidden" name="timeZone">` do cadastro, que é preenchido no cliente por
`Intl.DateTimeFormat().resolvedOptions().timeZone`.

- [ ] **Step 6: Rodar para ver passar e conferir em 360px**

Run: `npx vitest run tests/unit/casca.test.ts`
Expected: PASS, 4 testes.

Run: `npx next dev --port 3333`, abrir `/app/agenda` no DevTools em 360px de largura. **Não pode haver rolagem horizontal na página** em nenhuma tela do painel. Abrir `/b/slug-que-nao-existe` e ver a página em português.

- [ ] **Step 7: Commit**

```bash
git add src/components/panel-nav.tsx src/app/app/layout.tsx src/app/error.tsx src/app/app/error.tsx src/app/not-found.tsx src/app/login src/app/signup tests/unit/casca.test.ts
git commit -m "feat(painel): casca com nav rolável, logout, login e páginas de erro em português"
```

---

## Task 4: Catálogo por prop

Sozinha, é a maior melhora de velocidade da reforma. Hoje `page.tsx` já roda `listActiveServices` no servidor e o `booking-wizard.tsx` **mesmo assim** busca `/api/public/[slug]/catalog` dentro de um `useEffect` — dois a três segundos de tela cinza em 4G antes do primeiro pixel útil.

**Files:**
- Modify: `src/app/b/[slug]/page.tsx`, `src/app/b/[slug]/booking-wizard.tsx`, `src/app/b/[slug]/types.ts`
- Test: `tests/integration/catalogo-por-prop.test.ts`

**Interfaces:**
- Consumes: `listActiveServices`, `listActiveStaff` e a consulta de `staff_service` — as três já existem juntas em `src/app/api/public/[slug]/catalog/route.ts:18-24`
- Produces: `BookingWizard` passa a receber `catalogo: Catalog` como prop. A rota `/catalog` **continua existindo** (o encaixe do painel e um eventual bot dependem dela); o que morre é o `useEffect`.

- [ ] **Step 1: Escrever o teste de que a página entrega o catálogo pronta**

Criar `tests/integration/catalogo-por-prop.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { withTestDb } from '../helpers/db';
import { barbershop, staff, service, staffService } from '@/db/schema';
import { carregarCatalogo } from '@/app/b/[slug]/catalogo';

describe('carregarCatalogo', () => {
  it('devolve serviços, equipe e vínculos numa consulta do servidor', async () => {
    await withTestDb(async (db: any) => {
      const [loja] = await db.insert(barbershop).values({ slug: 'cat', name: 'Cat' }).returning();
      const [joao] = await db.insert(staff).values({ barbershopId: loja.id, name: 'João', role: 'OWNER' }).returning();
      const [corte] = await db.insert(service)
        .values({ barbershopId: loja.id, name: 'Corte', durationMinutes: 30, priceCents: 4500 }).returning();
      await db.insert(staffService).values({ barbershopId: loja.id, staffId: joao.id, serviceId: corte.id });

      const cat = await carregarCatalogo(db, loja);

      expect(cat.shop.name).toBe('Cat');
      expect(cat.services.map((s: any) => s.name)).toEqual(['Corte']);
      expect(cat.staff[0].serviceIds).toEqual([corte.id]);
    });
  });

  it('não vaza telefone de cliente nem coluna interna', async () => {
    await withTestDb(async (db: any) => {
      const [loja] = await db.insert(barbershop).values({ slug: 'cat', name: 'Cat' }).returning();
      const cat = await carregarCatalogo(db, loja);
      expect(JSON.stringify(cat)).not.toMatch(/phone|createdAt/i);
    });
  });

  it('barbeiro inativo não entra no catálogo', async () => {
    await withTestDb(async (db: any) => {
      const [loja] = await db.insert(barbershop).values({ slug: 'cat', name: 'Cat' }).returning();
      await db.insert(staff).values({ barbershopId: loja.id, name: 'Fora', active: false });
      const cat = await carregarCatalogo(db, loja);
      expect(cat.staff).toHaveLength(0);
    });
  });
});
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `DATABASE_URL_TEST=postgres://barbearia:barbearia@localhost:5433/barbearia_test npx vitest run tests/integration/catalogo-por-prop.test.ts`
Expected: FAIL — `@/app/b/[slug]/catalogo` não existe.

- [ ] **Step 3: Extrair a montagem do catálogo**

Criar `src/app/b/[slug]/catalogo.ts` com `carregarCatalogo(db, loja)`, movendo para lá a lógica que hoje está em `catalog/route.ts:18-40`. A rota passa a chamar essa função — assim rota e página não podem divergir.

- [ ] **Step 4: Rodar para ver passar**

Run: `DATABASE_URL_TEST=... npx vitest run tests/integration/catalogo-por-prop.test.ts`
Expected: PASS, 3 testes.

- [ ] **Step 5: Entregar por prop e matar o useEffect**

`page.tsx` chama `carregarCatalogo` e passa `catalogo` para o `BookingWizard`, junto de `barbershop.phone` e da flag de WhatsApp.
`booking-wizard.tsx`: apagar o `useEffect` de busca, o estado de carregando e o estado de erro do catálogo. A etapa 1 passa a vir pronta no HTML.

- [ ] **Step 6: Provar o ganho e que o e2e continua passando**

Run: `npx next dev --port 3333` e, no DevTools, aba Network com throttling "Slow 4G", abrir `/b/barbearia-do-marcao`. A lista de serviços tem que aparecer no primeiro paint, sem tela cinza e **sem uma requisição a `/catalog`**.

Run: `npx playwright test`
Expected: 3 testes passando, sem alteração no arquivo de e2e.

- [ ] **Step 7: Commit**

```bash
git add "src/app/b/[slug]" "src/app/api/public/[slug]/catalog" tests/integration/catalogo-por-prop.test.ts
git commit -m "perf(publico): catálogo entregue pelo servidor, sem busca no cliente"
```

---

## Task 5: Pública — serviço e barbeiro

**Files:**
- Modify: `src/app/b/[slug]/steps/service-step.tsx`, `steps/staff-step.tsx`, `booking-wizard.tsx`
- Test: `src/app/b/[slug]/steps/service-step.test.tsx`

**Interfaces:**
- Consumes: `Bloco`, `Monograma`, `Botao` da Task 2; `catalogo` da Task 4
- Produces: faixa de resumo com fragmentos clicáveis (tocar em "Corte" volta para a etapa 1), consumida pelas Tasks 6 e 7

- [ ] **Step 1: Escrever o teste dos nomes acessíveis**

O que não pode quebrar é o nome acessível, porque o e2e casa por ele. Criar `src/app/b/[slug]/steps/service-step.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ServiceStep } from './service-step';

const servicos = [
  { id: 's1', name: 'Corte', durationMinutes: 30, priceCents: 4500 },
  { id: 's2', name: 'Luzes', durationMinutes: 90, priceCents: 15000 },
];

describe('ServiceStep', () => {
  it('cada serviço é um botão cujo nome acessível traz duração e preço', () => {
    render(<ServiceStep servicos={servicos} aoEscolher={vi.fn()} />);
    const b = screen.getByRole('button', { name: /corte/i });
    expect(b.textContent).toMatch(/30 min/);
    expect(b.textContent).toMatch(/R\$\s?45,00/);
  });

  it('mostra hora e minuto para serviço longo', () => {
    render(<ServiceStep servicos={servicos} aoEscolher={vi.fn()} />);
    expect(screen.getByRole('button', { name: /luzes/i }).textContent).toMatch(/1 h 30 min/);
  });

  it('sem serviço cadastrado, explica em vez de mostrar lista vazia', () => {
    render(<ServiceStep servicos={[]} aoEscolher={vi.fn()} />);
    expect(screen.getByText(/ainda não está disponível/i)).toBeDefined();
  });
});
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `npx vitest run src/app/b/[slug]/steps/service-step.test.tsx`
Expected: FAIL — o componente atual não recebe `servicos` como prop (vinha do `useEffect`) e não tem estado vazio.

- [ ] **Step 3: Reescrever as duas etapas**

`service-step.tsx` conforme a **§5.2**: `.lista`, cada serviço como bloco de 72px com nome, duração e preço, alvo de toque inteiro.
`staff-step.tsx` conforme a **§5.3**: bloco "Qualquer barbeiro" de 88px no topo — texto literal, há e2e casando —, depois cada barbeiro com `<Monograma>` (a foto não existe: `staff.photoUrl` é `null` em 100% das linhas).

No `booking-wizard.tsx`, a faixa de resumo da §5.1 com contador "2 de 4" e os fragmentos clicáveis.

- [ ] **Step 4: Rodar para ver passar**

Run: `npx vitest run src/app/b/[slug]/`
Expected: PASS.

- [ ] **Step 5: Verificar o e2e**

Run: `npx playwright test`
Expected: 3 passando, arquivo de e2e intocado — `getByRole('button', { name: /corte/i })` e `/qualquer barbeiro/i` continuam casando.

- [ ] **Step 6: Commit**

```bash
git add "src/app/b/[slug]"
git commit -m "feat(publico): escolha de serviço e barbeiro com alvo de toque e preço legível"
```

---

## Task 6: Pública — dia e horário

O passo mais arriscado do plano e onde o produto mais melhora. Três coisas acontecem juntas: o dia sobe de estado, a tira vira grade 7×2 que não rola de lado, e a grade deduplica por horário quando o cliente escolheu "qualquer barbeiro".

**Files:**
- Create: `src/components/ui/tira-de-dias.tsx`, `src/components/ui/grade-de-horarios.tsx`, `src/app/b/[slug]/agrupar-horarios.ts`
- Modify: `src/app/b/[slug]/steps/slot-step.tsx`, `booking-wizard.tsx`
- Test: `src/app/b/[slug]/agrupar-horarios.test.ts`

**Interfaces:**
- Consumes: `AvailabilitySlot` de `@/domain/booking`, `formatDayParts` da Task 2
- Produces:
  - `agruparHorarios(slots, timeZone, barbeiroEscolhido): { manha: Horario[]; tarde: Horario[]; noite: Horario[] }`
  - `type Horario = { startAt: string; hora: string; staffId?: string; staffName?: string; quantidade: number }`
  - `TiraDeDias` e `GradeDeHorarios` com as props da §4.3
  - Atributo `data-hora="HH:mm"` em cada botão de horário — gancho do e2e (§6.2 item 8)

- [ ] **Step 1: Escrever o teste da função de agrupamento**

Escrever o teste da função pura **antes** da tela — é aqui que mora o risco de regressão. A API empilha um slot por barbeiro por horário (`availability-service.ts`, o loop `for (const barbeiro of equipe)`), então três barbeiros livres às 09:00 chegam como três slots.

Criar `src/app/b/[slug]/agrupar-horarios.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { agruparHorarios } from './agrupar-horarios';

const TZ = 'America/Sao_Paulo';
const slot = (iso: string, staffId: string, staffName: string) => ({
  startAt: iso, staffId, staffName,
});

describe('agruparHorarios', () => {
  it('separa em manhã, tarde e noite pelo horário local', () => {
    const r = agruparHorarios(
      [
        slot('2026-08-10T12:00:00.000Z', 'a', 'João'), // 09:00
        slot('2026-08-10T18:00:00.000Z', 'a', 'João'), // 15:00
        slot('2026-08-10T22:00:00.000Z', 'a', 'João'), // 19:00
      ],
      TZ, true,
    );
    expect(r.manha.map((h) => h.hora)).toEqual(['09:00']);
    expect(r.tarde.map((h) => h.hora)).toEqual(['15:00']);
    expect(r.noite.map((h) => h.hora)).toEqual(['19:00']);
  });

  it('com "qualquer barbeiro", três slots do mesmo horário viram uma ficha só', () => {
    const r = agruparHorarios(
      [
        slot('2026-08-10T12:00:00.000Z', 'a', 'João'),
        slot('2026-08-10T12:00:00.000Z', 'b', 'Pedro'),
        slot('2026-08-10T12:00:00.000Z', 'c', 'Ana'),
      ],
      TZ, false,
    );
    expect(r.manha).toHaveLength(1);
    expect(r.manha[0].quantidade).toBe(3);
  });

  it('com "qualquer barbeiro", a ficha NÃO fixa staffId — o servidor é que distribui', () => {
    const r = agruparHorarios(
      [slot('2026-08-10T12:00:00.000Z', 'a', 'João'), slot('2026-08-10T12:00:00.000Z', 'b', 'Pedro')],
      TZ, false,
    );
    expect(r.manha[0].staffId).toBeUndefined();
  });

  it('com barbeiro escolhido, mantém o staffId da ficha', () => {
    const r = agruparHorarios([slot('2026-08-10T12:00:00.000Z', 'a', 'João')], TZ, true);
    expect(r.manha[0].staffId).toBe('a');
  });

  it('ordena por horário dentro de cada bloco', () => {
    const r = agruparHorarios(
      [slot('2026-08-10T14:00:00.000Z', 'a', 'J'), slot('2026-08-10T12:00:00.000Z', 'a', 'J')],
      TZ, true,
    );
    expect(r.manha.map((h) => h.hora)).toEqual(['09:00', '11:00']);
  });

  it('dia sem horário devolve os três blocos vazios, não erro', () => {
    const r = agruparHorarios([], TZ, false);
    expect([r.manha, r.tarde, r.noite].every((b) => b.length === 0)).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `npx vitest run "src/app/b/[slug]/agrupar-horarios.test.ts"`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar o agrupamento**

Criar `src/app/b/[slug]/agrupar-horarios.ts`. Fronteiras da §5.4: manhã < 12:00, tarde 12:00–17:59, noite ≥ 18:00, tudo no fuso da barbearia. Com `barbeiroEscolhido === false`, agrupar por `startAt`, somar `quantidade` e deixar `staffId` **undefined** — hoje `booking-wizard.tsx:71` fixa `slot.staffId` e desliga sem querer o balanceamento por carga que `escolherBarbeiro` implementa no servidor.

- [ ] **Step 4: Rodar para ver passar**

Run: `npx vitest run "src/app/b/[slug]/agrupar-horarios.test.ts"`
Expected: PASS, 6 testes.

- [ ] **Step 5: Subir o estado de dia para o wizard**

Hoje o dia é `useState(dias[0])` dentro do `SlotStep` (`slot-step.tsx:32`), e o passo é desmontado quando o cliente vai digitar o contato. No 409, quem escolheu sexta volta olhando a grade de hoje. Mover `dia` para o `BookingWizard` e passá-lo como prop controlada.

- [ ] **Step 6: Construir a tira e a grade**

`tira-de-dias.tsx` conforme a **§5.4**: grade 7×2 com 14 dias e a ficha "Outro dia" — **nunca rola de lado**. Hoje são 30 botões num `overflowX: auto` marcados só por negrito.
`grade-de-horarios.tsx`: blocos MANHÃ/TARDE/NOITE, fichas de 52px, `data-hora="HH:mm"` em cada botão, e o rótulo de quantidade quando `quantidade > 1`.

- [ ] **Step 7: Corrigir o e2e nº 2 no mesmo commit**

`tests/e2e/agendamento.spec.ts:16` faz `textContent().split(' — ')[0]`, contando com a ficha ser `"09:00 — João"`. Com a grade nova o nome desce de linha. Trocar por:

```ts
const horarioEscolhido = await primeiroHorario.getAttribute('data-hora');
```

- [ ] **Step 8: Acrescentar os dois testes e2e novos**

```ts
test('com dois barbeiros livres, o mesmo horário aparece uma vez só', async ({ page }) => {
  await seedComDoisBarbeiros();
  await page.goto('/b/e2e-barbearia');
  await page.getByRole('button', { name: /corte/i }).click();
  await page.getByRole('button', { name: /qualquer barbeiro/i }).click();
  const noveHoras = page.locator('[data-hora="09:00"]');
  await expect(noveHoras).toHaveCount(1);
});

test('o dia escolhido sobrevive ao horário tomado', async ({ page, context }) => {
  await seed();
  await page.goto('/b/e2e-barbearia');
  await page.getByRole('button', { name: /corte/i }).click();
  await page.getByRole('button', { name: /qualquer barbeiro/i }).click();
  await page.getByRole('button', { name: /amanhã/i }).click();
  const alvo = page.locator('[data-hora]').first();
  const hora = await alvo.getAttribute('data-hora');
  await alvo.click();
  // outra aba toma o mesmo horário
  const outra = await context.newPage();
  await outra.goto('/b/e2e-barbearia');
  await outra.getByRole('button', { name: /corte/i }).click();
  await outra.getByRole('button', { name: /qualquer barbeiro/i }).click();
  await outra.getByRole('button', { name: /amanhã/i }).click();
  await outra.locator(`[data-hora="${hora}"]`).click();
  await outra.getByLabel('Seu nome').fill('Primeiro');
  await outra.getByLabel('Telefone').fill('11999998888');
  await outra.getByRole('button', { name: /confirmar horário/i }).click();
  await expect(outra.getByText(/horário confirmado/i)).toBeVisible();
  // a primeira aba confirma e leva o conflito
  await page.getByLabel('Seu nome').fill('Segundo');
  await page.getByLabel('Telefone').fill('11977776666');
  await page.getByRole('button', { name: /confirmar horário/i }).click();
  await expect(page.getByText(/acabou de sair|não está mais/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /amanhã/i })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('Seu nome')).toHaveValue('Segundo');
});
```

- [ ] **Step 9: Rodar tudo**

Run: `npx playwright test`
Expected: 5 testes passando (3 antigos + 2 novos).

- [ ] **Step 10: Commit**

```bash
git add "src/app/b/[slug]" src/components/ui/tira-de-dias.tsx src/components/ui/grade-de-horarios.tsx tests/e2e
git commit -m "feat(publico): dia em grade sem rolagem lateral e horários agrupados por período"
```

---

## Task 7: Pública — contato, confirmação e fim do `confirm()`

**Files:**
- Create: `src/components/ui/botao-de-confirmacao.tsx`
- Modify: `src/app/b/[slug]/steps/contact-step.tsx`, `steps/done-step.tsx`, `booking-wizard.tsx`, `src/app/agendamento/[token]/cancel-form.tsx`, `src/app/app/clientes/[customerId]/anonymize-button.tsx`
- Test: `src/components/ui/botao-de-confirmacao.test.tsx`

**Interfaces:**
- Consumes: `Botao`, `Campo` da Task 2; `aplicarMascaraTelefone` da Task 2
- Produces: `BotaoDeConfirmacao` com a API da §4.3 — substitui **todo** `confirm()` do projeto

- [ ] **Step 1: Escrever o teste do botão de dois tempos**

Criar `src/components/ui/botao-de-confirmacao.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BotaoDeConfirmacao } from './botao-de-confirmacao';

const props = {
  rotulo: 'Cancelar meu horário',
  rotuloConfirmar: 'Confirmar cancelamento',
  aoConfirmar: vi.fn(),
};

describe('BotaoDeConfirmacao', () => {
  it('o primeiro clique não executa, só arma', async () => {
    const aoConfirmar = vi.fn();
    render(<BotaoDeConfirmacao {...props} aoConfirmar={aoConfirmar} />);
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar meu horário' }));
    expect(aoConfirmar).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Confirmar cancelamento' })).toBeDefined();
  });

  it('o segundo clique executa', async () => {
    const aoConfirmar = vi.fn();
    render(<BotaoDeConfirmacao {...props} aoConfirmar={aoConfirmar} />);
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar meu horário' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar cancelamento' }));
    expect(aoConfirmar).toHaveBeenCalledOnce();
  });

  it('volta sozinho ao rótulo original depois do tempo', async () => {
    vi.useFakeTimers();
    render(<BotaoDeConfirmacao {...props} segundos={4} />);
    const u = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await u.click(screen.getByRole('button', { name: 'Cancelar meu horário' }));
    await vi.advanceTimersByTimeAsync(4100);
    expect(screen.getByRole('button', { name: 'Cancelar meu horário' })).toBeDefined();
    vi.useRealTimers();
  });

  it('quando pendente, não executa de novo', async () => {
    const aoConfirmar = vi.fn();
    render(<BotaoDeConfirmacao {...props} aoConfirmar={aoConfirmar} pendente />);
    await userEvent.click(screen.getByRole('button'));
    expect(aoConfirmar).not.toHaveBeenCalled();
  });
});
```

Instalar o que falta: `npm install -D @testing-library/user-event`

- [ ] **Step 2: Rodar para ver falhar**

Run: `npx vitest run src/components/ui/botao-de-confirmacao.test.tsx`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar o BotaoDeConfirmacao**

Conforme a §4.3. Dois tempos, volta sozinho depois de `segundos` (padrão 4), `aria-live="polite"` na troca de rótulo para o leitor de tela anunciar que o botão mudou de função.

- [ ] **Step 4: Rodar para ver passar**

Run: `npx vitest run src/components/ui/botao-de-confirmacao.test.tsx`
Expected: PASS, 4 testes.

- [ ] **Step 5: Reescrever contato e confirmação**

`contact-step.tsx` conforme a **§5.5**: bloco de compromisso no topo (serviço, barbeiro, dia e hora) com botão "Trocar", os dois campos com `<Campo>`, máscara vinda de `@/lib/telefone`, barra fixa embaixo com o botão "Confirmar horário" — texto literal. Pré-preencher nome e telefone de `localStorage` quando houver.

Subir nome e telefone para o `BookingWizard`: no 409 eles não podem sumir.

`done-step.tsx` conforme a **§5.5**: "Horário confirmado" e o link "Ver ou cancelar meu horário" — os dois literais.

- [ ] **Step 6: Matar os dois `confirm()` e corrigir o e2e nº 1**

`cancel-form.tsx` e `anonymize-button.tsx` passam a usar `<BotaoDeConfirmacao>`.

No **mesmo commit**, corrigir `tests/e2e/agendamento.spec.ts:42` — sem `confirm()`, o `page.once('dialog')` nunca dispara e o teste falha por um motivo que não parece de layout:

```ts
// antes:  page.once('dialog', (d) => d.accept());
//         await page.getByRole('button', { name: /cancelar meu horário/i }).click();
await page.getByRole('button', { name: /cancelar meu horário/i }).click();
await page.getByRole('button', { name: /confirmar cancelamento/i }).click();
```

- [ ] **Step 7: Rodar tudo**

Run: `npx playwright test`
Expected: 5 passando.
Run: `DATABASE_URL_TEST=... npx vitest run && npx tsc --noEmit && npm run lint`

- [ ] **Step 8: Olhar o fluxo inteiro**

`npx next dev --port 3333`, agendar de ponta a ponta em 360px. Depois abrir o link de gerenciamento e cancelar — dois toques, sem diálogo do navegador. **Fim da superfície pública**: dá para mostrar para um dono de barbearia.

- [ ] **Step 9: Commit**

```bash
git add src/components/ui/botao-de-confirmacao.tsx "src/app/b/[slug]" "src/app/agendamento/[token]" "src/app/app/clientes" tests/e2e
git commit -m "feat(publico): contato com máscara, confirmação em dois tempos e fim do diálogo do navegador"
```

---

## Task 8: Painel — agenda do dia

A tela principal do produto, e a que o barbeiro abre cinquenta vezes por dia.

**Files:**
- Create: `src/components/ui/folha-inferior.tsx`, `src/app/app/agenda/proximos-livres.ts`, `src/app/app/agenda/cartao-da-agenda.tsx`, `src/app/app/agenda/barra-de-data.tsx`, `src/app/app/agenda/loading.tsx`
- Modify: `src/app/app/agenda/day-grid.tsx`, `page.tsx`, `actions.ts`
- Test: `src/app/app/agenda/proximos-livres.test.ts`, `src/components/ui/folha-inferior.test.tsx`

**Interfaces:**
- Consumes: `coresDeBarbeiro` da Task 2, `buildDayList` (já existe em `day-grid.tsx` e **fica como está**)
- Produces:
  - `calcularProximosLivres(appointments, staffList, agora): { staffId: string; horaISO: string | null }[]`
  - `reopenAppointmentAction(appointmentId)` — `DONE`/`NO_SHOW` → `BOOKED`, mesmo isolamento por `barbershopId`, **nunca** aceita `CANCELED`
  - `FolhaInferior` com o contrato de acessibilidade da §4.3 por extenso

- [ ] **Step 1: Escrever o teste de "próximos livres"**

É a linha que responde "quem está livre agora?" sem quadro de colunas. Criar `src/app/app/agenda/proximos-livres.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { calcularProximosLivres } from './proximos-livres';

const equipe = [
  { id: 'a', name: 'João' },
  { id: 'b', name: 'Pedro' },
];
const ag = (staffId: string, startAt: string, endAt: string) => ({
  staffId, startAt: new Date(startAt), endAt: new Date(endAt), status: 'BOOKED' as const,
});
const AGORA = new Date('2026-08-10T13:00:00Z'); // 10:00 em SP

describe('calcularProximosLivres', () => {
  it('barbeiro sem atendimento agora está livre agora', () => {
    const r = calcularProximosLivres([], equipe, AGORA);
    expect(r.find((x) => x.staffId === 'a')?.horaISO).toBe(AGORA.toISOString());
  });

  it('barbeiro ocupado fica livre quando o atendimento termina', () => {
    const r = calcularProximosLivres(
      [ag('a', '2026-08-10T12:30:00Z', '2026-08-10T13:30:00Z')], equipe, AGORA,
    );
    expect(r.find((x) => x.staffId === 'a')?.horaISO).toBe('2026-08-10T13:30:00.000Z');
  });

  it('pula atendimentos encostados e devolve o primeiro buraco de verdade', () => {
    const r = calcularProximosLivres(
      [
        ag('a', '2026-08-10T12:30:00Z', '2026-08-10T13:30:00Z'),
        ag('a', '2026-08-10T13:30:00Z', '2026-08-10T14:00:00Z'),
      ],
      equipe, AGORA,
    );
    expect(r.find((x) => x.staffId === 'a')?.horaISO).toBe('2026-08-10T14:00:00.000Z');
  });

  it('agendamento cancelado não ocupa', () => {
    const r = calcularProximosLivres(
      [{ ...ag('a', '2026-08-10T12:30:00Z', '2026-08-10T13:30:00Z'), status: 'CANCELED' as const }],
      equipe, AGORA,
    );
    expect(r.find((x) => x.staffId === 'a')?.horaISO).toBe(AGORA.toISOString());
  });

  it('atendimento que já acabou não conta', () => {
    const r = calcularProximosLivres(
      [ag('a', '2026-08-10T11:00:00Z', '2026-08-10T11:30:00Z')], equipe, AGORA,
    );
    expect(r.find((x) => x.staffId === 'a')?.horaISO).toBe(AGORA.toISOString());
  });

  it('devolve uma entrada por barbeiro, sempre', () => {
    expect(calcularProximosLivres([], equipe, AGORA)).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Rodar para ver falhar e implementar**

Run: `npx vitest run src/app/app/agenda/proximos-livres.test.ts`
Expected: FAIL. Implementar `proximos-livres.ts` e rodar de novo até PASS, 6 testes.

- [ ] **Step 3: Escrever o teste de acessibilidade da folha**

É o gesto mais usado do painel e o único componente com contrato escrito por extenso. Criar `src/components/ui/folha-inferior.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FolhaInferior } from './folha-inferior';

function abrir(extra: Partial<React.ComponentProps<typeof FolhaInferior>> = {}) {
  const aoFechar = vi.fn();
  render(
    <FolhaInferior aberta titulo="Encaixe" aoFechar={aoFechar} {...extra}>
      <button>Primeiro</button>
      <button>Último</button>
    </FolhaInferior>,
  );
  return { aoFechar };
}

describe('FolhaInferior', () => {
  it('é um diálogo modal rotulado pelo título', () => {
    abrir();
    const d = screen.getByRole('dialog');
    expect(d.getAttribute('aria-modal')).toBe('true');
    expect(d.getAttribute('aria-labelledby')).toBeTruthy();
    expect(screen.getByText('Encaixe')).toBeDefined();
  });

  it('põe o foco no primeiro elemento focável ao abrir', () => {
    abrir();
    expect(document.activeElement?.textContent).toBe('Primeiro');
  });

  it('Escape fecha', async () => {
    const { aoFechar } = abrir();
    await userEvent.keyboard('{Escape}');
    expect(aoFechar).toHaveBeenCalled();
  });

  it('com guarda de descarte, Escape não fecha direto', async () => {
    const { aoFechar } = abrir({ guardaDeDescarte: true });
    await userEvent.keyboard('{Escape}');
    expect(aoFechar).not.toHaveBeenCalled();
  });

  it('fechada não renderiza nada', () => {
    render(<FolhaInferior aberta={false} titulo="X" aoFechar={vi.fn()}><button>Y</button></FolhaInferior>);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
```

- [ ] **Step 4: Implementar a folha**

Conforme a §4.3, contrato inteiro: `role="dialog"`, `aria-modal`, `aria-labelledby`, foco que entra e **volta para o disparador** ao fechar, `Escape` com guarda, `Tab` preso por sentinelas focáveis, `inert` no `<main>`, `overflow: hidden` no `<body>` com `scrollbar-gutter`, `max-height: 92dvh`, `padding-bottom: env(safe-area-inset-bottom)`. Em ≥1024px **continua folha inferior** com `max-width: 560px` centrada — não inventar modal.

Run: `npx vitest run src/components/ui/folha-inferior.test.tsx` até PASS, 5 testes.

- [ ] **Step 5: Reconstruir a agenda**

Conforme a **§5.7**. `buildDayList` fica exatamente como está — a decisão de lista única por horário foi confirmada pelos três jurados. O que muda é a pele e o que a cerca:

- `barra-de-data.tsx` de 64px com legenda de contagem e `<Link>` no lugar dos `<a href>` crus de `agenda/page.tsx:40-42`
- linha "próximo livre" no topo, de `calcularProximosLivres`
- lista agrupada por hora, com cabeçalho de hora grudento
- `cartao-da-agenda.tsx` com aresta de cor por barbeiro (4px à esquerda), **tinta de estado** no lugar do `opacity: 0.5` de `day-grid.tsx:69`
- linha do agora, e rolagem automática até ela ao abrir — hoje, às 15h, o barbeiro cai nas 8h e rola sete telas
- "Compareceu" e "Não veio" **na própria linha**, com 52px. "Cancelar" vai para a folha: hoje ele está colado no "Compareceu" em `day-grid.tsx:91-93`
- "Desfazer" de 20 segundos usando `reopenAppointmentAction`
- `agenda/loading.tsx` com `<EsqueletoDeLinha>`

- [ ] **Step 6: Escrever o teste da action de reabrir**

```ts
it('reabre atendimento marcado como não veio', async () => { /* DONE|NO_SHOW → BOOKED */ });
it('recusa reabrir agendamento cancelado', async () => { /* CANCELED → erro */ });
it('não reabre agendamento de outra barbearia', async () => { /* isolamento */ });
```

Escrever em `tests/integration/panel-actions.test.ts`, seguindo o padrão de sessão falsa que já existe no arquivo. Rodar, ver falhar, implementar `reopenAppointmentAction`, ver passar.

- [ ] **Step 7: Verificar no aparelho**

`npx next dev --port 3333`, `/app/agenda` em 360px. Marcar "Compareceu" com um toque. Desfazer. Conferir que abre ancorado no agora e que a aresta de cor distingue os barbeiros de relance.

Run: `DATABASE_URL_TEST=... npx vitest run && npx playwright test`

- [ ] **Step 8: Commit**

```bash
git add src/app/app/agenda src/components/ui/folha-inferior.tsx tests
git commit -m "feat(painel): agenda do dia com estado na linha, próximo livre e desfazer"
```

---

## Task 9: Painel — folha de encaixe

A melhor ideia isolada da rodada, citada por dois jurados: o walk-in passa de oito controles a quatro toques, sem mudar uma linha da server action.

**Files:**
- Create: `src/components/ui/segmentado.tsx`, `src/components/ui/fichas-de-escolha.tsx`
- Modify: `src/app/app/agenda/manual-booking-form.tsx`, `src/app/app/agenda/actions.ts`, `src/app/app/agenda/encaixe.ts`
- Test: `src/components/ui/segmentado.test.tsx`, `tests/integration/walk-in.test.ts`

**Interfaces:**
- Consumes: `FolhaInferior` da Task 8
- Produces: `Segmentado` e `FichasDeEscolha` com as props da §4.3; `createManualAppointmentAction` passa a aceitar `staffId` vazio como "primeiro que vagar"

- [ ] **Step 1: Escrever o teste do "primeiro que vagar"**

Hoje `createManualAppointmentAction:56` rejeita `staffId` que não seja UUID. Acrescentar a `tests/integration/walk-in.test.ts`:

```ts
it('aceita "primeiro que vagar" e escolhe quem tem menos atendimentos no dia', async () => {
  await withTestDb(async (db: any) => {
    const { loja, joao, pedro, barba } = await semear(db);
    // João já tem dois atendimentos hoje; Pedro nenhum
    // ... criar dois agendamentos para João ...
    sessaoFalsa.userId = 'u-dono';
    const fd = new FormData();
    fd.set('serviceId', barba.id);
    fd.set('staffId', '');            // vazio = primeiro que vagar
    fd.set('horaLivre', '14:35');
    fd.set('name', 'Cliente');
    fd.set('phone', '11999998888');
    const r = await createManualAppointmentAction(ESTADO_INICIAL, fd);
    expect(r.erro).toBeUndefined();
    // o escolhido é Pedro, não João
  });
});

it('continua recusando staffId de outra barbearia', async () => { /* … */ });
```

- [ ] **Step 2: Rodar para ver falhar e implementar**

Run: `DATABASE_URL_TEST=... npx vitest run tests/integration/walk-in.test.ts`
Expected: FAIL — a action rejeita string vazia.

Ajustar a action para, com `staffId` vazio, resolver pelo mesmo caminho de `escolherBarbeiro`/`staff-load.ts` que a superfície pública já usa. Rodar até PASS.

- [ ] **Step 3: Construir o segmentado e as fichas**

`segmentado.tsx` e `fichas-de-escolha.tsx` conforme a §4.3. As fichas substituem `<select>` onde a troca é frequente — com o dedo com talco, a roleta nativa do sistema custa dois toques precisos. `nomeDoCampoOculto` renderiza um `<input type="hidden">`, então a server action não muda.

- [ ] **Step 4: Reconstruir a folha de encaixe**

Conforme a **§5.8**. O segmentado "Agora | Marcar hora" com **"Agora" como padrão**: data escondida (é hoje), mostrador com a hora atual arredondada para baixo em 5 minutos e dois botões −5/+5 de 48px. Fichas de barbeiro e de serviço. Máscara de telefone compartilhada. O aviso de fora-da-grade aparece depois de escolher a hora, não antes.

E o ponto que a Clareza Calma pescou: **no 409 a folha não fecha**. Nome e telefone digitados ficam, a grade recarrega sozinha e a pastilha tomada some. Refazer quatro campos porque o horário foi tomado é o momento em que o barbeiro fecha o app e volta para o caderno.

- [ ] **Step 5: Contar os toques**

`npx next dev --port 3333`. Simular o walk-in: abrir a agenda, tocar "Encaixe", tocar a ficha do barbeiro, tocar a ficha do serviço, digitar nome e telefone, "Agendar". Devem ser **quatro toques e dois campos**, sem escolher data e sem caçar horário.

Run: `DATABASE_URL_TEST=... npx vitest run && npx playwright test`

- [ ] **Step 6: Commit**

```bash
git add src/app/app/agenda src/components/ui/segmentado.tsx src/components/ui/fichas-de-escolha.tsx tests
git commit -m "feat(painel): encaixe em dois modos, com Agora como padrão"
```

---

## Task 10: Painel — cadastros

Passo mecânico e paralelizável: um padrão aplicado a seis telas. As três `<table>` de largura 100% morrem.

**Files:**
- Modify: `src/app/app/servicos/page.tsx` e `servico-form.tsx`, `equipe/page.tsx` e `staff-form.tsx`, `equipe/[staffId]/page.tsx`, `working-hours-form.tsx`, `services-form.tsx`, `time-off-section.tsx`, `clientes/page.tsx`, `clientes/[customerId]/page.tsx`, `configuracoes/page.tsx` e `settings-form.tsx`
- Create: `loading.tsx` por rota do painel; migração `barbershop.accent_hue`

**Interfaces:**
- Consumes: `CabecalhoDePagina`, `Campo`, `Botao`, `Bloco`, `EsqueletoDeLinha`
- Produces: `barbershop.accentHue: integer | null` e o seletor de 12 matizes fixos

- [ ] **Step 1: Gerar a migração do matiz**

Acrescentar `accentHue: integer('accent_hue')` a `src/db/schema/barbershop.ts` e rodar:

```bash
npm run db:generate && DATABASE_URL_TEST=postgres://barbearia:barbearia@localhost:5433/barbearia_test npx tsx src/db/migrate.ts
```

Conferir que a migration aplica em banco limpo.

- [ ] **Step 2: Escrever o teste do matiz**

Acrescentar a `src/domain/catalog/shop-settings.test.ts`:

```ts
it('aceita os 12 matizes da paleta', () => {
  expect(validateShopSettings({ ...valido, accentHue: '210' }).accentHue).toBe(210);
});
it('aceita ausência de matiz — o padrão é preto', () => {
  expect(validateShopSettings({ ...valido, accentHue: '' }).accentHue).toBeNull();
});
it('recusa matiz fora da paleta', () => {
  expect(() => validateShopSettings({ ...valido, accentHue: '77' })).toThrow(/cor/i);
});
```

Rodar, ver falhar, estender `validateShopSettings` conforme a **§3.4** (L e C travados, croma 0.09 para caber no sRGB), ver passar.

- [ ] **Step 3: Aplicar o padrão da §5.9 às seis telas**

Cada tela: `<CabecalhoDePagina>`, lista de `.bloco` no lugar da `<table>`, formulários com `<Campo>` e `<Botao>`, `loading.tsx` com `<EsqueletoDeLinha>`.

O expediente (`working-hours-form.tsx`) é o pior caso hoje: 6 `input type="time"` numa linha só, sete formulários empilhados. Empilhar **3+3** conforme a §5.9 e manter os `aria-label` que já existem ("Segunda — início do bloco 1") — eles são bons e há teste.

O seletor de matiz entra em `configuracoes/settings-form.tsx`: 12 fichas de cor, não `<input type="color">` — menos escolha, zero cor feia.

- [ ] **Step 4: Verificar as seis telas em 360px**

`npx next dev --port 3333`. Passar por Serviços, Equipe, detalhe do barbeiro, Clientes, ficha do cliente e Configurações. Nenhuma rolagem horizontal, nenhum campo espremido.

Run: `DATABASE_URL_TEST=... npx vitest run && npx tsc --noEmit && npm run lint`

- [ ] **Step 5: Commit**

```bash
git add src/app/app src/db drizzle src/domain/catalog
git commit -m "feat(painel): cadastros com o padrão de formulário e cor da loja"
```

---

## Task 11: As três pontas que custam telefonema

Não são layout, mas são o que os jurados mostraram custar ligação para a barbearia.

**Files:**
- Create: `src/app/api/public/[slug]/availability/days/route.ts`, `src/app/api/panel/clientes/route.ts`, `src/app/agendamento/[token]/ics/route.ts`, `src/components/ui/busca-de-cliente.tsx`
- Modify: `src/components/ui/tira-de-dias.tsx`, `src/components/panel-nav.tsx`
- Test: `tests/integration/dias-com-vaga.test.ts`, `tests/integration/busca-cliente.test.ts`

**Interfaces:**
- Consumes: `getAvailability` de `@/domain/booking`
- Produces:
  - `GET /api/public/[slug]/availability/days?serviceId&staffId&from&to` → `{ days: { date: string; hasSlots: boolean }[] }`
  - `GET /api/panel/clientes?q=` → `{ clientes: { id, name, phone, proximo: string | null }[] }`, `barbershopId` **da sessão**
  - `GET /agendamento/[token]/ics` → `text/calendar`

- [ ] **Step 1: Escrever o teste dos dias com vaga**

Sem esta rota, descobrir que "sexta não tem" custa tocar dia por dia esperando um fetch a cada um — é o minuto em que o cliente liga para a loja. Criar `tests/integration/dias-com-vaga.test.ts`:

```ts
it('marca quais dias da janela têm vaga', async () => { /* dia com expediente = true, domingo = false */ });
it('respeita maxAdvanceDays como teto', async () => { /* não devolve além da janela */ });
it('dia inteiramente ocupado vem como sem vaga', async () => { /* preencher a agenda e conferir */ });
it('recusa slug inexistente com 404', async () => { /* … */ });
```

Rodar, ver falhar, implementar a rota reusando `getAvailability` por dia, ver passar.

- [ ] **Step 2: Ligar o ponto na tira e o botão de próximo dia**

`tira-de-dias.tsx` passa a receber `situacao` de verdade e pinta o ponto de 4px. Abaixo da grade, o botão "Ver o próximo dia com vaga" — que não precisa de ida nova ao servidor, porque a resposta de `/days` já tem tudo.

- [ ] **Step 3: Escrever o teste da busca de cliente**

O furo que as **três** direções deixaram: toca o telefone, "aqui é o Marcos, que horas eu marquei?", e hoje só dá para chutar data por data. Criar `tests/integration/busca-cliente.test.ts`:

```ts
it('acha por parte do nome, sem acento e sem caixa', async () => { /* "marc" acha "Marcos" */ });
it('acha por dígitos do telefone, ignorando máscara', async () => { /* "99998" acha "(11) 99999-8888" */ });
it('traz o próximo agendamento de cada cliente', async () => { /* … */ });
it('nunca devolve cliente de outra barbearia', async () => { /* tenant da sessão */ });
it('busca vazia devolve lista vazia, não a base inteira', async () => { /* … */ });
```

Rodar, ver falhar, implementar a rota e a `<BuscaDeCliente>` na barra do painel (comportamento de debounce copiado de `bdsolutions/src/components/domain/global-search.tsx`), ver passar.

- [ ] **Step 4: A rota do .ics**

`GET /agendamento/[token]/ics` com `text/calendar` e escape de texto. `.ics` por `data:` URI não abre confiável no Safari do iOS, por isso é rota. Menor prioridade do documento — se o tempo apertar, esta é a que fica para depois.

- [ ] **Step 5: Verificação final da reforma**

```bash
docker exec barbearia-postgres psql -U barbearia -d postgres -c "DROP DATABASE IF EXISTS barbearia_final"
docker exec barbearia-postgres psql -U barbearia -d postgres -c "CREATE DATABASE barbearia_final"
DATABASE_URL_TEST=postgres://barbearia:barbearia@localhost:5433/barbearia_final npx tsx src/db/migrate.ts
DATABASE_URL_TEST=postgres://barbearia:barbearia@localhost:5433/barbearia_final npx vitest run
DATABASE_URL_TEST=postgres://barbearia:barbearia@localhost:5433/barbearia_final npx vitest run
npx tsc --noEmit && npm run lint && npm run build && npx playwright test
```

Expected: suíte verde **duas vezes seguidas no mesmo banco**, tipos limpos, lint sem saída, build compilando, 5 e2e passando.

- [ ] **Step 6: Commit**

```bash
git add src/app/api src/components tests
git commit -m "feat(agenda): dias com vaga na tira, busca de cliente e convite de calendário"
```

---

## Ordem e dependências

Sequencial de 1 a 11. As dependências reais:

- **1 → 2 → 3** é a fundação. A Task 1 sozinha já conserta o app inteiro e não toca em tela nenhuma; se o tempo acabar aí, o produto já melhorou muito.
- **4** é independente das telas e pode ser feita a qualquer momento depois da 1. É o maior ganho de velocidade.
- **5 → 6 → 7** é a superfície pública. Ao fim da 7, dá para mostrar para um dono de barbearia.
- **8 → 9** é o balcão. A Task 9 depende da `FolhaInferior` que nasce na 8.
- **10** é mecânica e pode ser paralelizada com a 8 e a 9 por outra pessoa — não compartilham arquivo.
- **11** fecha, e a rota do `.ics` é a única coisa do plano que pode cair sem dor.

## Onde os testes e2e quebram

Só dois pontos, e os dois têm conserto no mesmo commit que causa a quebra:

| Teste | Quebra em | Conserto | Task |
|---|---|---|---|
| `agendamento.spec.ts:42` | fim do `confirm()` | dois cliques no lugar do handler de diálogo | 7 |
| `agendamento.spec.ts:16` | `split(' — ')` no texto da ficha | ler `data-hora` | 6 |

`agendamento.spec.ts:64` **continua valendo sem mudança**: o seed cria a barbearia com um barbeiro só, então deduplicar por `startAt` é a identidade.

## Fora de escopo, com decisão registrada

Quadro de colunas por barbeiro (§5.11, as cinco regras já escritas), filtro por estado na agenda, foto de barbeiro e upload, capa e logo da loja, alternador manual de tema. Nenhum bloqueia nada acima, e todos têm o caminho descrito no design doc para quando a hora chegar.
