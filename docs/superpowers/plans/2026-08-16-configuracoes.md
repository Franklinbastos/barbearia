# Configurações — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A tela de configurações com um alinhamento só, o link de agendamento onde o dono acha e usa, e o fuso horário fora do caminho.

**Architecture:** A tela tem sete campos e três problemas: duas colunas de alinhamento dentro do mesmo card, um link público que não dá para copiar, e um select de fuso com 400 opções na segunda dobra que nenhum produto do setor sequer oferece. A reforma extrai o rótulo de seção para fora do card (o que dá um alinhamento só), tira o link do formulário (ele age na hora, o resto age no submit), e empurra o fuso para o rodapé atrás de um "alterar".

**Tech Stack:** Next.js 15 App Router · React 19 · TypeScript strict · Tailwind v4 · shadcn (`base-nova`, `@base-ui/react`) · Vitest · Playwright

**Spec:** `docs/superpowers/specs/2026-08-16-configuracoes-design.md` — cada decisão com a fonte. Leia antes de tocar em código.

## Global Constraints

- Diretório: `/home/franklin/dev/barbearia`. Branch `main`. npm.
- **A largura da tela não muda**: continua `Largura tipo="tabela"` (880px). A §3.7 é explícita — a tela que escolhe outro teto parece de outro produto quando se navega entre elas. É por isso que a seção anotada aqui **empilha** em vez de ficar lado a lado.
- **A cor continua sendo `accentHue` 0–360.** Nada de `input type="color"`, nada de hex. `settings-form.test.tsx` trava isso e o teste fica.
- **Altura de controle**: 36px (`--altura-controle`) ou 44px (`--tap-min`) em alvo de toque; 32px vale para alvo de ponteiro no desktop.
- **Espaçamento na escala de 4px.** Largura só pela régua (`src/components/ui/largura.tsx`).
- **Acessibilidade não regride**: todo campo com label associado, `aria-describedby` para as dicas, `role="status"` no aviso de cópia, foco visível. O `<fieldset>`/`<legend>` da cor fica.
- **Nada rola de lado em 360px.** Coberto por `tests/e2e/painel-acabamento.spec.ts`.
- Componente de catálogo vem pelo CLI (`npx shadcn@latest add`); componente de domínio segue `cva` + `cn()` + `data-slot` + `React.ComponentProps`, sem `forwardRef`.
- **Não subir dev server, navegador ou Playwright em subagente.**
- Teste: `DATABASE_URL_TEST=postgres://barbearia:barbearia@localhost:5433/<banco próprio> npx vitest run`.
- Commits em pt-BR. Quem commita é o orquestrador.

## Mapa de arquivos

**Nasce:**

| Arquivo | Responsabilidade |
|---|---|
| `src/components/ui/secao-de-ajustes.tsx` | título + descrição acima, card de campos abaixo |
| `src/app/app/configuracoes/link-de-agendamento.tsx` | o link, o copiar e o QR — fora do `<form>` |

**Mudam:** `configuracoes/{page,settings-form,loading}.tsx`, `settings-form.test.tsx`.

---

## Task 1: A seção de ajustes

Bloqueante: as outras tasks põem conteúdo dentro dela.

**Files:**
- Create: `src/components/ui/secao-de-ajustes.tsx`, `.test.tsx`
- Modify: `src/app/app/configuracoes/page.tsx`

**Interfaces:**
- Produces:
  ```ts
  export type SecaoDeAjustesProps = React.ComponentProps<'section'> & {
    titulo: string;
    /** 1–3 frases. Omita quando o título já basta — o Polaris manda não escrever descrição inútil. */
    descricao?: string;
  };
  export const secaoDeAjustesVariants: (props?: unknown) => string;
  ```

- [ ] **Step 1: Escrever o teste**

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SecaoDeAjustes } from './secao-de-ajustes';

describe('SecaoDeAjustes', () => {
  it('o título fica FORA do card', () => {
    // é o defeito medido: "Nome da barbearia" em x=588 e "Endereço público" em
    // x=424, no mesmo card, porque metade do conteúdo respeitava uma coluna de
    // rótulo que a outra metade ignorava
    const { container } = render(
      <SecaoDeAjustes titulo="Identidade"><input aria-label="Nome" /></SecaoDeAjustes>,
    );
    const card = container.querySelector('[data-slot="card"]');
    expect(card).not.toBeNull();
    expect(card!.textContent).not.toContain('Identidade');
    expect(screen.getByRole('heading', { name: 'Identidade' })).toBeDefined();
  });

  it('a descrição é opcional', () => {
    const { container } = render(<SecaoDeAjustes titulo="Regras">x</SecaoDeAjustes>);
    expect(container.querySelector('[data-slot="secao-descricao"]')).toBeNull();
  });

  it('o título é h2 — a página já tem o h1', () => {
    render(<SecaoDeAjustes titulo="Identidade">x</SecaoDeAjustes>);
    expect(screen.getByRole('heading', { level: 2, name: 'Identidade' })).toBeDefined();
  });

  it('marca as partes com data-slot', () => {
    const { container } = render(
      <SecaoDeAjustes titulo="Identidade" descricao="O que o cliente vê.">x</SecaoDeAjustes>,
    );
    expect(container.querySelector('[data-slot="secao-de-ajustes"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="secao-descricao"]')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/components/ui/secao-de-ajustes.test.tsx`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

Título (`<h2>`) e descrição **acima**, `<Card>` com os campos abaixo. Empilhado, nunca `2fr 5fr` lado a lado — o motivo está no cabeçalho do arquivo e vale escrever: o lado a lado do Polaris só respira a partir de 1120px, e subir esta tela para `leitura` a tiraria da coluna das outras cinco do painel, que é o defeito que a rodada de 15/08 corrigiu.

- [ ] **Step 4: Aplicar na página**

`page.tsx` monta três seções empilhadas, nesta ordem — identidade, link, regras. O princípio é ordenar por importância (Primer, Polaris, Android) e é o que o Shopify faz na página General: identidade antes de regra operacional. O link vem depois da identidade porque **deriva** dela: o slug nasce do nome.

O `<h1>` e o `<CabecalhoDePagina>` ficam como estão.

- [ ] **Step 5: Verificar e commitar**

Run: `DATABASE_URL_TEST=postgres://barbearia:barbearia@localhost:5433/barbearia_c1 npx vitest run src/components/ui src/app/app/configuracoes && npx tsc --noEmit`

```bash
git add src/components/ui/secao-de-ajustes.tsx src/components/ui/secao-de-ajustes.test.tsx src/app/app/configuracoes/page.tsx
git commit -m "feat(ui): seção de ajustes, com o título fora do card"
```

---

## Task 2: O link de agendamento

**Files:**
- Create: `src/app/app/configuracoes/link-de-agendamento.tsx`, `.test.tsx`
- Modify: `src/app/app/configuracoes/page.tsx`, `settings-form.tsx` (só para **remover** o bloco do endereço)

**Interfaces:**
- Consumes: `SecaoDeAjustes` da Task 1
- Produces: `LinkDeAgendamento` — `{ url: string }`, client component

- [ ] **Step 1: A dependência do QR**

Não há biblioteca de QR no projeto. Instale `qrcode` (a de linha de comando e Node, não a `react-qr-code`) e gere **no servidor**, como SVG: a URL é conhecida no servidor, e assim o QR não custa JS no cliente nem pisca depois da hidratação.

```bash
npm i qrcode && npm i -D @types/qrcode
```

Se o `qrcode` trouxer dependência transitiva pesada ou não gerar SVG string, use `qrcode-generator` (sem dependências) e diga no relato o que mudou.

- [ ] **Step 2: Escrever o teste**

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LinkDeAgendamento } from './link-de-agendamento';

const URL_DA_LOJA = 'https://app.exemplo.com/b/barbearia-do-marcao';

describe('LinkDeAgendamento', () => {
  it('mostra a URL inteira, sem cortar', () => {
    // o slug pode ser longo e em 360px o endereço é a única coisa da tela que
    // não tem onde quebrar — por isso `break-all`, nunca `truncate`
    render(<LinkDeAgendamento url={URL_DA_LOJA} />);
    expect(screen.getByText(URL_DA_LOJA)).toBeDefined();
  });

  it('copiar avisa que copiou', async () => {
    const escrever = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText: escrever } });
    const usuario = userEvent.setup();
    render(<LinkDeAgendamento url={URL_DA_LOJA} />);
    await usuario.click(screen.getByRole('button', { name: /copiar/i }));
    expect(escrever).toHaveBeenCalledWith(URL_DA_LOJA);
    // Polaris: "Provide feedback inline using a confirmation check icon
    // post-click". Sem retorno, a pessoa clica de novo achando que falhou.
    expect(screen.getByRole('status').textContent).toMatch(/copiad/i);
  });

  it('não é um formulário', () => {
    // Primer: não misturar controle que age na hora com formulário que age no
    // submit. Quem clica em copiar e sai da tela pode achar que salvou.
    const { container } = render(<LinkDeAgendamento url={URL_DA_LOJA} />);
    expect(container.querySelector('form')).toBeNull();
    expect(container.querySelector('input')).toBeNull();
  });
});
```

- [ ] **Step 3: Rodar, ver falhar, implementar**

O bloco tem:

1. A URL em `<code>` com `break-all` — **não** vira input desabilitado nem `readOnly`. Carbon: *"If the component does not have an enabled state, do not use a read-only state to display static information"*, e campo desabilitado nem é lido por leitor de tela.
2. **Ícone-botão de copiar**, terciário (`variant="ghost"`), com **ícone de link — não de prancheta**. Polaris: *"Use the link icon with a tertiary icon button for copying deep links and URLs."* O `aria-label` diz "Copiar link de agendamento".
3. **O aviso de cópia em `role="status"`**, sumindo depois de ~2s. É o ✓ inline que o Polaris pede.
4. **O QR code**, gerado no servidor e passado como SVG string. Booksy e Fresha documentam o uso exato: imprimir no cartão de visita e colar na vitrine. Fica recolhido atrás de "Ver QR code" — é uso ocasional e ocuparia a dobra inteira.
5. Um `<a>` para a própria página pública, que abre em aba nova. O dono quer ver o que o cliente vê.

O QR precisa de `<title>` no SVG ou `aria-label` no contêiner: um bloco gráfico mudo não diz nada a quem usa leitor de tela.

- [ ] **Step 4: Tirar o bloco antigo do formulário**

O `settings-form.tsx` tem hoje o micro-rótulo "Endereço público" e o `<code>` dentro do `<form>`. **Some** — o conteúdo mudou de casa e de nome.

**O nome muda para "Link de agendamento"**: é o termo de Booksy, Fresha, Mangomint e Boulevard, e "endereço" vai colidir com o endereço físico que a spec §3 diz que precisa entrar.

- [ ] **Step 5: Verificar e commitar**

Run: `DATABASE_URL_TEST=postgres://barbearia:barbearia@localhost:5433/barbearia_c2 npx vitest run src/app/app/configuracoes && npx tsc --noEmit`

```bash
git add src/app/app/configuracoes package.json package-lock.json
git commit -m "feat(configuracoes): o link de agendamento com copiar e QR code"
```

---

## Task 3: O formulário

Cor, rótulos, fuso e salvar — tudo no mesmo arquivo, por isso numa task só.

**Files:**
- Modify: `src/app/app/configuracoes/settings-form.tsx`, `settings-form.test.tsx`, `loading.tsx`

**Interfaces:**
- Consumes: `SecaoDeAjustes` da Task 1

- [ ] **Step 1: Escrever os testes**

Acrescentar a `settings-form.test.tsx` (**sem apagar** o caso que trava as doze fichas e a ausência de `input type="color"`):

```tsx
describe('o formulário depois da reforma de 16/08', () => {
  it('o fuso não está na primeira dobra', () => {
    // Nenhum produto de salão trata fuso como preferência: a Booksy não deixa
    // o dono mexer, a Vagaro não tem o campo. Fica alcançável, não no caminho.
    const fonte = readFileSync(resolve(process.cwd(), 'src/app/app/configuracoes/settings-form.tsx'), 'utf8');
    const posFuso = fonte.indexOf('timeZone');
    const posGrade = fonte.indexOf('slotMinutes');
    expect(posFuso).toBeGreaterThan(posGrade);
  });

  it('há um botão de salvar, e só um', () => {
    // Primer: "There should only be one save button on a page"
    render(<SettingsForm loja={LOJA} />);
    expect(screen.getAllByRole('button', { name: /salvar/i })).toHaveLength(1);
  });

  it('o salvar nunca nasce desabilitado', () => {
    // Primer: "Disabled buttons cannot be focused using the Tab key"
    render(<SettingsForm loja={LOJA} />);
    expect(screen.getByRole('button', { name: /salvar/i })).not.toBeDisabled();
  });

  it('a antecedência explica com exemplo', () => {
    // Mangomint, Vagaro, Calendly e Fresha explicam todos com um caso concreto
    render(<SettingsForm loja={{ ...LOJA, minLeadMinutes: 60 }} />);
    expect(screen.getByText(/16h.*15h|antes/i)).toBeDefined();
  });

  it('as fichas de cor e o "Sem cor" ficam na mesma grade', () => {
    // "Sem cor" flutuava numa linha só dele, em x=588, fora do alinhamento das
    // doze que vinham abaixo
    const { container } = render(<SettingsForm loja={LOJA} />);
    const grade = container.querySelector('[data-slot="fichas-de-cor"]');
    expect(grade?.querySelectorAll('button')).toHaveLength(13);
  });
});
```

Adapte os nomes ao que o arquivo de teste já usa — **abra-o antes** e siga o padrão dele (ele pode ser teste de fonte, não de DOM).

- [ ] **Step 2: Rodar e ver falhar**

- [ ] **Step 3: A cor**

Hoje cada ficha é um retângulo de 80×36 com a cor num círculo de 16px — o retângulo é a moldura e a cor, que é a informação, é o detalhe. Inverta: **a ficha é a cor**, com a marca de escolhida por anel e ✓, não por um contorno externo.

**"Sem cor" entra na mesma grade das outras doze**, como 13ª ficha (a primeira), em vez de flutuar acima numa linha própria.

Preservar: o `<fieldset>`/`<legend>`, o texto "Escolhida: …", o `<input type="hidden" name="accentHue">` e o alvo de toque. **Nada de `input type="color"`** — a §3.4 guarda um matiz com L e croma travados, e é isso que garante que nenhuma escolha produza botão ilegível.

- [ ] **Step 4: Os rótulos ganham exemplo**

| Hoje | Vira | Dica abaixo |
|---|---|---|
| Antecedência mínima (minutos) | Antecedência mínima | "60 min — para marcar às 16h, o cliente precisa fechar até 15h" |
| Janela máxima de agendamento (dias) | Até quando o cliente pode marcar | "30 dias à frente" |
| Grade de horários (minutos) | Grade de horários | "de quanto em quanto tempo os horários aparecem para o cliente" |

O exemplo **acompanha o valor**: com 30 min no campo, a frase diz 15h30, não 15h. Se isso exigir estado no cliente que o formulário hoje não tem, use o valor salvo e diga no relato.

A dica liga no campo por `aria-describedby` — o `Campo` do projeto já faz isso, **leia antes de escrever**.

- [ ] **Step 5: O fuso sai do caminho**

Vai para o **rodapé da seção de regras**, como texto: "Fuso horário: America/Sao_Paulo" mais um botão de texto "alterar" que revela o `Select`. O `Select` continua com `name="timeZone"` e o mesmo `defaultValue` — o campo continua sendo enviado no submit, esteja revelado ou não.

Escreva no comentário por que ele foi para lá, com a fonte: numa barbearia o fuso é atributo do endereço, não preferência; a Booksy nem deixa o dono mexer; e quando houver endereço cadastrado isto vira derivação e o "alterar" some.

- [ ] **Step 6: O salvar**

**Um só, no fim, alinhado à esquerda, sempre habilitado.** Carbon: *"The primary button will be left-aligned"* em formulário de página, e *"Do not top-align buttons"*. Primer: um por página, no canto inferior esquerdo, e nunca desabilitado — *"Disabled buttons cannot be focused using the Tab key"*.

**No celular, cola no rodapé.** É a "pinned footer or tray" que o Carbon aponta como saída boa. Isso **já existe na casa**: `src/app/b/[slug]/steps/contact-step.tsx` faz `sticky bottom-0 … md:static` com `--sombra-barra`. Copie o padrão de lá; não invente um segundo.

Carbon pede **48px entre o último campo e o botão** — hoje não há esse respiro.

- [ ] **Step 7: O esqueleto acompanha**

`loading.tsx` desenha a tela antiga. Refaça com as três seções e as mesmas medidas, senão o conteúdo salta quando chega.

- [ ] **Step 8: Verificar e commitar**

Run: `DATABASE_URL_TEST=postgres://barbearia:barbearia@localhost:5433/barbearia_c3 npx vitest run src/app/app/configuracoes && npx tsc --noEmit`

```bash
git add src/app/app/configuracoes
git commit -m "fix(configuracoes): a cor cabe na grade, os rótulos explicam, e o fuso sai do caminho"
```

---

## Task 4: Fechamento

**Files:**
- Modify: `tests/e2e/painel-acabamento.spec.ts`, `docs/superpowers/design/2026-08-07-direcao-de-ui.md`

- [ ] **Step 1: O e2e**

Acrescente ao spec que existe (não crie arquivo):

- a tela abre com as três seções na ordem, e o título de cada uma fora do card
- copiar o link põe a URL na área de transferência e mostra o aviso
- o fuso não aparece até clicar em "alterar", e depois de alterar o valor salva
- em 360px nada rola de lado (o caso já existe; confirme que a tela nova passa)

Para o clipboard, o Playwright precisa da permissão `clipboard-read`/`clipboard-write` no contexto — configure no teste, não no `playwright.config.ts` global.

**Não execute o Playwright.** Escreva e pare.

- [ ] **Step 2: A direção de UI**

Nasce uma seção de configurações, que não existia. Registre: a seção anotada empilhada e **por que não lado a lado** (a §3.7 e os 1120px), o salvar único à esquerda sempre habilitado, o link fora do formulário, e a decisão da cor — com a nota de que as duas pesquisas discordaram e de que a arquitetura ganhou porque travamos L e croma enquanto o mercado avisa sobre contraste.

- [ ] **Step 3: Verificação final**

```bash
npm run db:migrate
DATABASE_URL_TEST=postgres://barbearia:barbearia@localhost:5433/barbearia_c4 npx tsx src/db/migrate.ts
DATABASE_URL_TEST=postgres://barbearia:barbearia@localhost:5433/barbearia_c4 npx vitest run
npx tsc --noEmit && npx eslint src tests && npm run build
```

---

## Ordem

1 é bloqueante. Depois, **2 e 3 são independentes** — a 2 vive num arquivo novo e só remove um bloco do `settings-form`; a 3 mexe no resto dele. Combine assim: **a Task 2 remove o bloco do endereço antes de a Task 3 começar**, senão as duas editam o mesmo arquivo ao mesmo tempo. Se for rodar em paralelo, a Task 3 espera a 2 terminar a remoção.

4 fecha.

## O risco

O maior é o **fuso**. Escondê-lo está certo pelo mercado, mas não temos endereço para derivar — então a barbearia que de fato não está em São Paulo depende de achar o "alterar". É aceitável: o padrão do banco já é `America/Sao_Paulo`, o público é barbearia de bairro brasileira, e o campo continua alcançável e continua sendo enviado no submit. O que **não** pode acontecer é o campo sumir do `<form>` e o valor ser sobrescrito pelo padrão no salvamento — isso apagaria a configuração de quem a tinha ajustado. **Há caso de teste para isso e ele é obrigatório.**

O segundo é o `qrcode`: dependência nova numa árvore que hoje é enxuta. Gerar no servidor mantém o cliente sem custo, mas confira o tamanho e diga no relato.
