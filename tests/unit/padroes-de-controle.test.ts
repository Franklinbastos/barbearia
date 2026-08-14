import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * A régua de tamanho, espaçamento e navegação de data, travada por fonte.
 *
 * Ela existe porque medida escrita à mão não deixa rastro: `h-[48px]` numa ficha
 * de cor, esqueleto de 44 onde chega um botão de 36, `gap-[13px]` num cartão —
 * cada um foi uma decisão tomada no olho, todas passaram na revisão, e juntas
 * são o que faz duas telas do mesmo produto parecerem de produtos diferentes.
 *
 * **O teste é broad de propósito.** Ele não tenta adivinhar por regex o que é
 * controle e o que é caixa: qualquer altura em px escrita à mão tem que ser um
 * dos valores com nome (36, 44, 72) ou entrar na lista de exceções aqui embaixo,
 * com o motivo escrito. Distinguir controle de caixa por texto de arquivo dá
 * falso negativo — e teste que passa porque não testa nada é pior que teste
 * nenhum. Aqui, o que não estiver na régua reprova até alguém escrever por quê.
 */

const RAIZES = ['src/app/app', 'src/components/ui'];

type Fonte = { arquivo: string; texto: string };

function fontes(): Fonte[] {
  return RAIZES.flatMap((dir) =>
    readdirSync(resolve(process.cwd(), dir), { recursive: true })
      .filter((f): f is string => typeof f === 'string' && f.endsWith('.tsx') && !f.includes('.test.'))
      .map((f) => ({
        arquivo: `${dir}/${f}`,
        texto: readFileSync(resolve(process.cwd(), dir, f), 'utf8'),
      })),
  );
}

const ler = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');

/**
 * Os três números com nome. Controle é 36 (`--altura-controle`, o `h-9` da lib)
 * ou 44 (`--tap-min`) quando o alvo é de dedo em barra fixa; 72 é a **linha de
 * lista** da §3.3, e por ser piso de linha só vale como `min-h-` — `h-[72px]`
 * cravado é caixa de altura fixa, que é outra coisa.
 */
const CONTROLE = new Set([36, 44]);
const LINHA_DE_LISTA = 72;

/**
 * O que sobra é nominal, com motivo. Nenhuma destas é controle; todas são caixa
 * de desenho, e é por isso que a régua não as alcança.
 */
const EXCECOES_DE_ALTURA = [
  {
    arquivo: 'src/app/app/resumo/loading.tsx',
    classe: 'h-[140px]',
    motivo:
      'esqueleto do <CartaoIndicador>: espelha a altura do cartão que vai chegar, e cartão não é controle',
  },
  {
    arquivo: 'src/app/app/resumo/grafico-de-ocupacao.tsx',
    classe: 'h-[220px]',
    motivo: 'caixa do gráfico de ocupação — altura de desenho, e nada dentro dela é alvo de clique',
  },
  {
    arquivo: 'src/components/ui/tira-de-dias.tsx',
    classe: 'min-h-[60px]',
    motivo: 'ficha de dia da tela pública: a §5.4 manda 44×60, e é alvo de dedo, não controle',
  },
];

/**
 * Os tokens do `globals.css` que medem altura. Os outros três (`--tap` 48,
 * `--tap-lg` 56 na ficha de horário do encaixe, `--tap-xl` 64 na da página
 * pública) são alvo de tela cheia e não têm o que fazer num controle do painel —
 * se um aparecer aqui é decisão nova, e decisão nova quer estar escrita.
 */
const TOKENS_DE_ALTURA = new Set(['--altura-controle', '--tap-min', '--tap-md']);

/**
 * Só valem os tokens **globais**: os que o `globals.css` declara. Propriedade
 * que o próprio componente inventa (`--cell-size` do calendário,
 * `--available-height` do `select`) é variável local, não token de design, e a
 * régua não tem o que dizer sobre ela.
 */
const TOKENS_GLOBAIS = new Set(
  [...ler('src/app/globals.css').matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]!),
);

const ALTURA_EM_PX = /(?:min-|max-)?(?:h|size)-\[(\d+)px\]/g;
/** As duas grafias: `h-[var(--x)]` e o atalho do Tailwind v4, `h-(--x)`. Só a
 *  primeira estava coberta, e é a **segunda** que o código novo escreve. */
const ALTURA_POR_TOKEN = /(?:min-|max-)?(?:h|size)-(?:\[var\((--[a-z0-9-]+)\)\]|\((--[a-z0-9-]+)\))/g;

describe('régua de altura', () => {
  it('altura em px é 36, 44 ou linha de lista — o resto entra nominalmente', () => {
    const excecao = new Set(EXCECOES_DE_ALTURA.map((e) => `${e.arquivo}: ${e.classe}`));
    const infratores: string[] = [];

    for (const { arquivo, texto } of fontes()) {
      for (const achado of texto.matchAll(ALTURA_EM_PX)) {
        const px = Number(achado[1]);
        const chave = `${arquivo}: ${achado[0]}`;
        if (excecao.has(chave)) continue;
        if (CONTROLE.has(px)) continue;
        if (px === LINHA_DE_LISTA && achado[0].startsWith('min-h-')) continue;
        infratores.push(chave);
      }
    }

    // Caiu aqui? São dois caminhos, e nenhum é apagar o caso: ou a medida vira
    // 36/44 (controle) e `min-h-[72px]` (linha de lista), ou ela entra em
    // EXCECOES_DE_ALTURA com o motivo por extenso.
    expect(infratores).toEqual([]);
  });

  it('altura por token cita um token de altura', () => {
    // `min-h-[var(--linha)]` compila e mede 1px. O token errado não dá erro em
    // lugar nenhum — só uma tela torta.
    const infratores: string[] = [];
    for (const { arquivo, texto } of fontes()) {
      for (const achado of texto.matchAll(ALTURA_POR_TOKEN)) {
        const token = achado[1] ?? achado[2]!;
        if (!TOKENS_GLOBAIS.has(token)) continue;
        if (!TOKENS_DE_ALTURA.has(token)) infratores.push(`${arquivo}: ${achado[0]}`);
      }
    }
    expect(infratores).toEqual([]);
  });
});

/**
 * Espaçamento é a escala de 4px do Tailwind. Valor arbitrário em px que não seja
 * múltiplo de 4 é decisão tomada no olho; valor por token (`--spacing(…)`,
 * `var(…)`, `calc(…)`) continua valendo, porque aí o número mora num lugar só.
 */
const ESPACO_ARBITRARIO =
  /(?:^|[^a-z-])-?(gap|gap-x|gap-y|p|px|py|pt|pb|pl|pr|ps|pe|m|mx|my|mt|mb|ml|mr|ms|me|space-x|space-y)-\[([^\]]+)\]/g;

const EXCECOES_DE_ESPACO = [
  {
    arquivo: 'src/components/ui/tabs.tsx',
    classe: 'p-[3px]',
    motivo: 'trilho do TabsList, do CLI e intocado — 3px é a folga do indicador do base-nova',
  },
  {
    arquivo: 'src/components/ui/folha-inferior.tsx',
    classe: 'm-[0_auto]',
    motivo:
      'não é medida: é `margin: 0 auto` centralizando os 560px da folha, no mesmo grupo do tailwind-merge que a margem do base-nova',
  },
];

describe('escala de espaçamento', () => {
  it('gap, padding e margin em px são múltiplos de 4', () => {
    const excecao = new Set(EXCECOES_DE_ESPACO.map((e) => `${e.arquivo}: ${e.classe}`));
    const infratores: string[] = [];

    for (const { arquivo, texto } of fontes()) {
      for (const achado of texto.matchAll(ESPACO_ARBITRARIO)) {
        const classe = `${achado[1]}-[${achado[2]}]`;
        const chave = `${arquivo}: ${classe}`;
        if (excecao.has(chave)) continue;
        // `--spacing(2)`, `var(--e3)`, `calc(…)`: o número mora no token
        if (/--|calc\(/.test(achado[2]!)) continue;
        const px = /^-?(\d+)px$/.exec(achado[2]!);
        if (px && Number(px[1]) % 4 === 0) continue;
        infratores.push(chave);
      }
    }

    expect(infratores).toEqual([]);
  });
});

/**
 * A navegação de data da agenda. Três coisas que a pesquisa fechou e que se
 * perdem calado:
 *
 * - **densidade se resolve na vertical, nunca na horizontal** (Acuity: "the
 *   width of the columns remains the same regardless of the zoom setting") — na
 *   barra isso é a coluna do meio com largura fixa no desktop, já travada em
 *   `barra-de-data.test.ts`;
 * - o alvo da barra fixa é 44 (`--tap-min`), e vale para as duas setas, para o
 *   gatilho de data e para o dia dentro do calendário — o dia é o alvo mais
 *   tocado dos quatro, e nenhum deles encolhe por largura de tela.
 *
 * O terceiro achado da pesquisa — **"hoje" é o da barbearia, não o do
 * navegador** — não está aqui de propósito: `tests/unit/seletor-de-data.test.tsx`
 * já o guarda montando a barra e lendo o nome acessível do dia marcado, com
 * `TZ` hostil. Repetir isso como `toMatch(/today=/)` seria a mesma regra escrita
 * duas vezes, e a cópia fraca ainda quebraria num `const hoje = …` inocente.
 */
const barra = ler('src/app/app/agenda/barra-de-data.tsx');
const calendario = ler('src/components/ui/calendar.tsx');
const cabecalho = ler('src/components/ui/cabecalho-de-pagina.tsx');
const listaDoDia = ler('src/app/app/agenda/day-grid.tsx');

describe('navegação de data', () => {
  it('as setas e o gatilho medem os 44px da barra fixa', () => {
    // `size-11` e `h-11` são 44px: o `size-8` que o `buttonVariants` traz da lib
    // é controle de formulário, e esta barra é alvo de dedo em rolagem.
    expect(barra).toMatch(/const ALVO_44 = 'size-11/);
    expect(barra).toMatch(/aria-label="Data"[\s\S]{0,120}h-11/);
  });

  it('o dia do calendário mede 44 em qualquer largura, e não os 28px do CLI', () => {
    // O arquivo vem do `shadcn add` e o CLI o regera inteiro: sem este caso, a
    // próxima regeneração devolve `--spacing(7)` (28px) e ninguém percebe até
    // alguém errar o dia com o polegar.
    const medidas = [...calendario.matchAll(/\[--cell-size:--spacing\((\d+)\)\]/g)].map(
      (m) => Number(m[1]) * 4,
    );
    expect(medidas).toEqual([44]);
    // Uma medida só, e sem `md:`: ponto de quebra é largura, não dedo — tablet
    // em pé cai em `md` e continua sendo polegar. As setas e o gatilho da barra
    // também não encolhem lá.
    expect(calendario).not.toMatch(/md:\[--cell-size:/);
  });

  it('o calendário de 44px continua cabendo em 360px', () => {
    // 7 colunas + o `p-2` da raiz, contra os 336px úteis do painel em 360.
    // Passou disso, o popover encosta nas bordas e a tela do balcão rola de
    // lado — que é a única coisa que não pode acontecer.
    const celula = Number(/\[--cell-size:--spacing\((\d+)\)\]/.exec(calendario)![1]) * 4;
    expect(7 * celula + 16).toBeLessThanOrEqual(336);
  });
});

describe('ritmo vertical do painel', () => {
  it('a barra deixa o mesmo respiro que o cabeçalho das telas irmãs', () => {
    // A barra é o último bloco antes da lista nas duas larguras (no celular o
    // `<CabecalhoDePagina>` da agenda é `sr-only` e nem ocupa fluxo). Respiro
    // diferente do que o cabeçalho dá às irmãs é o degrau que se vê passando de
    // Clientes para Agenda na navegação, e só ali.
    const doCabecalho = /\bmb-(\d+)\b/.exec(cabecalho)![1];
    const embrulho = barra.split('\n').find((l) => l.includes('className="-mx-3'))!;
    const daBarra = /\bmb-(\d+)\b/.exec(embrulho)![1];
    expect(daBarra).toBe(doCabecalho);
  });

  it('o sub-cabeçalho de hora gruda exatamente na altura da barra', () => {
    // Os dois números são o mesmo número: se a barra crescer e o `top-` da hora
    // não, a hora passa a rolar por baixo dela e a lista perde o cabeçalho.
    //
    // `toContain` e não "o primeiro que aparecer": a lista do dia é de outra
    // frente, e ela pode ganhar outro elemento grudado sem que isto aqui tenha
    // opinião. O que se cobra é que **algo** cole na altura da barra.
    const alturaDaBarra = /sticky top-0 [^"]*\bh-(\d+)\b/.exec(barra)![1];
    const colagens = [...listaDoDia.matchAll(/sticky top-(\d+)\b/g)].map((m) => m[1]);
    expect(colagens).toContain(alturaDaBarra);
  });
});
