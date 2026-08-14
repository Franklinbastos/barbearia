import { test, expect, type Page } from '@playwright/test';
import { DateTime } from 'luxon';

import { db } from '@/db/client';
import { appointment, customer, service, staff, staffService } from '@/db/schema';
import { entrarNoPainel, TZ, type LojaDeTeste } from './fixtures/painel';

/**
 * As medidas de acabamento que nenhum teste de fonte enxerga.
 *
 * As duas primeiras são de layout: **rolagem lateral em 360px** e **controle
 * estourando a borda do card em 1280px**.
 * `tests/unit/regua-de-largura.test.ts` garante que nenhuma tela do painel
 * inventa largura própria — mas ele lê texto, e largura é coisa que só existe
 * depois do layout. Rolar de lado em 360px foi o defeito nº 1 do inventário
 * original e já voltou duas vezes; botão saindo do card foi o que a captura de
 * 1280px mostrou em serviços e em equipe.
 *
 * **As três de 14/08/2026 são da mesma família**, e por isso moram aqui em vez
 * de num spec novo: são as que só existem com o navegador de pé.
 *
 * 1. **A ficha do cliente** — os quatro números saem de uma função pura já
 *    testada, mas o caminho inteiro (query com o barbeiro, soma em memória,
 *    formatação no fuso da loja) só se mede com Postgres e tela.
 * 2. **O vão livre** — a faixa depende do relógio: `recortarNoAgora` derruba
 *    buraco que já passou. Por isso a semente dela cai **amanhã**, e não hoje,
 *    onde a hora em que a suíte roda decidiria se o teste passa.
 * 3. **A ação recolhida do cartão** — a regressão mais provável da rodada. Se
 *    `display:none` entrar no lugar de `opacity`, ou se o `focus-within` sumir,
 *    "Compareceu" deixa de existir para quem navega por Tab, e **nenhum teste de
 *    aparência pega isso**: o unitário lê a classe, não o que o navegador
 *    calcula com a cascata inteira montada.
 *
 * **Um cadastro por medida, não um por tela.** As seis telas cabem no mesmo
 * navegador e na mesma loja, e cadastrar doze vezes só faria a suíte demorar. De
 * quebra o relatório fica melhor: o teste junta **todas** as telas infratoras
 * numa lista antes de reprovar, em vez de parar na primeira — quem conserta quer
 * saber se é uma tela ou se são as seis.
 *
 * **A loja é semeada com nome comprido de propósito.** Serviço, barbeiro e
 * cliente de uma letra cabem em qualquer largura: o texto que empurra a coluna é
 * que revela a que não cabe.
 */

test.use({ timezoneId: TZ });

const LOJA: LojaDeTeste = { slug: 'e2e-acabamento', email: 'dono.acabamento@e2e.test' };

const TELAS = [
  '/app/resumo',
  '/app/agenda',
  '/app/servicos',
  '/app/equipe',
  '/app/clientes',
  '/app/configuracoes',
];

type Ids = { barbershopId: string; staffId: string };

/** O que a semente devolve para quem quiser marcar mais atendimentos do mesmo cliente. */
type Semente = { serviceId: string; customerId: string };

const SERVICO = { nome: 'Corte + barba + sobrancelha', duracao: 60, precoCents: 8500 };
const CLIENTE = { nome: 'Maria Aparecida do Nascimento Silva', telefone: '11988887777' };

/** Os campos que todo atendimento desta loja repete — o preço congela no snapshot. */
function baseDoAtendimento(ids: Ids, semente: Semente) {
  return {
    barbershopId: ids.barbershopId,
    staffId: ids.staffId,
    customerId: semente.customerId,
    serviceId: semente.serviceId,
    serviceNameSnapshot: SERVICO.nome,
    servicePriceCentsSnapshot: SERVICO.precoCents,
    serviceDurationMinutesSnapshot: SERVICO.duracao,
    origin: 'PUBLIC' as const,
  };
}

/**
 * Meia-noite de um dia no fuso da loja, nunca `new Date('...')`: data literal é
 * lida como meia-noite UTC e, em São Paulo, cai no dia anterior.
 */
function diaDaLoja(deslocamentoEmDias = 0) {
  return DateTime.now().setZone(TZ).startOf('day').plus({ days: deslocamentoEmDias });
}

/** Uma linha em cada lista do painel, para as telas não serem medidas vazias. */
async function semear(ids: Ids): Promise<Semente> {
  const { barbershopId, staffId } = ids;

  const [combo] = await db
    .insert(service)
    .values({
      barbershopId,
      name: SERVICO.nome,
      durationMinutes: SERVICO.duracao,
      priceCents: SERVICO.precoCents,
    })
    .returning();

  await db.insert(staffService).values({ barbershopId, staffId, serviceId: combo.id });

  await db
    .insert(staff)
    .values({ barbershopId, name: 'Sebastião do Nascimento Vale', role: 'BARBER' });

  const [cliente] = await db
    .insert(customer)
    .values({ barbershopId, name: CLIENTE.nome, phone: CLIENTE.telefone })
    .returning();

  const semente: Semente = { serviceId: combo.id, customerId: cliente.id };

  const hoje = diaDaLoja();
  const em = (hora: number) => hoje.set({ hour: hora }).toJSDate();
  const base = baseDoAtendimento(ids, semente);

  // Um agendado e um concluído: o primeiro traz os botões de presença para o
  // cartão da agenda, o segundo dá número ao resumo em vez do estado vazio.
  await db.insert(appointment).values([
    { ...base, startAt: em(9), endAt: em(10), status: 'BOOKED' },
    { ...base, startAt: em(10), endAt: em(11), status: 'DONE' },
  ]);

  return semente;
}

/**
 * Passado do mesmo cliente, para a ficha ter os quatro números de verdade.
 *
 * Com o concluído de hoje que a semente já marcou, dá três visitas em 30, 15 e 0
 * dias atrás — intervalos de 15 dias, que é o "corta a cada" — e uma falta.
 * Daí saem R$ 255,00 em 3 atendimentos e 25% de falta (1 em 4 marcados). Números
 * exatos de propósito: "tem algum dígito" passaria com a tela somando errado.
 *
 * As horas ficam às 9h, longe da virada do dia, e a distância entre as visitas é
 * medida em dias corridos — o Brasil não tem mais horário de verão, e a mediana
 * ainda arredondaria para os mesmos 15.
 */
async function semearHistorico(ids: Ids, semente: Semente) {
  const base = baseDoAtendimento(ids, semente);
  const em = (diasAtras: number, hora: number) =>
    diaDaLoja(-diasAtras).set({ hour: hora }).toJSDate();

  await db.insert(appointment).values([
    { ...base, startAt: em(30, 9), endAt: em(30, 10), status: 'DONE' },
    { ...base, startAt: em(15, 9), endAt: em(15, 10), status: 'DONE' },
    { ...base, startAt: em(5, 9), endAt: em(5, 10), status: 'NO_SHOW' },
  ]);
}

/**
 * Dois atendimentos de **amanhã** com um buraco de 1h30 entre eles, e devolve o
 * dia para a URL da agenda.
 *
 * Amanhã, e não hoje, porque a faixa é recortada pelo relógio: buraco que já
 * passou não vira convite para marcar cliente no passado. Semeado hoje, o teste
 * passaria de manhã e reprovaria à tarde.
 */
async function semearVaoLivre(ids: Ids, semente: Semente): Promise<string> {
  const amanha = diaDaLoja(1);
  const em = (hora: number, minuto = 0) => amanha.set({ hour: hora, minute: minuto }).toJSDate();
  const base = baseDoAtendimento(ids, semente);

  await db.insert(appointment).values([
    { ...base, startAt: em(9), endAt: em(9, 30), status: 'BOOKED' },
    { ...base, startAt: em(11), endAt: em(11, 30), status: 'BOOKED' },
  ]);

  return amanha.toISODate()!;
}

/**
 * Abre a tela e espera o conteúdo de verdade.
 *
 * O `loading.tsx` desenha a largura da tela que antecede, mas não o conteúdo
 * dela — medir durante o esqueleto é medir o desenho errado, e é justamente o
 * conteúdo que estoura.
 *
 * O `<h1>` sozinho não bastaria como âncora: três `loading.tsx` do painel já
 * desenham o cabeçalho de verdade e só deixam a lista em esqueleto. Ele é
 * `attached` e não `visible` porque o da agenda é `sr-only`.
 */
async function abrir(page: Page, tela: string) {
  await page.goto(tela);
  await page.locator('h1').first().waitFor({ state: 'attached' });
  await page.waitForFunction(
    () => document.querySelector('[data-slot="skeleton"], .esqueleto') === null,
  );
}

test('nenhuma tela do painel rola de lado em 360px', async ({ page }) => {
  const ids = await entrarNoPainel(page, LOJA);
  await semear(ids);

  // 360px é o Android popular; o layout do painel reserva 12px de cada lado, e
  // sobram 336px úteis.
  await page.setViewportSize({ width: 360, height: 740 });

  const rolando: string[] = [];
  for (const tela of TELAS) {
    await abrir(page, tela);
    const medida = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      cliente: document.documentElement.clientWidth,
    }));
    if (medida.scroll > medida.cliente) {
      rolando.push(`${tela}: ${medida.scroll}px de conteúdo em ${medida.cliente}px de tela`);
    }
  }

  expect(rolando).toEqual([]);
});

test('nenhum controle escapa do card em 1280px', async ({ page }) => {
  const ids = await entrarNoPainel(page, LOJA);
  await semear(ids);

  // Com a sidebar aberta, que é o padrão de quem nunca a encolheu: é a largura
  // menor das duas, e a que aperta as colunas de ação.
  await page.setViewportSize({ width: 1280, height: 900 });

  const escapando: string[] = [];
  for (const tela of TELAS) {
    await abrir(page, tela);
    const fora = await page.evaluate(() => {
      const achados: string[] = [];
      document.querySelectorAll('[data-slot="card"]').forEach((card) => {
        const limite = card.getBoundingClientRect().right;
        card.querySelectorAll('button, a, input').forEach((filho) => {
          // 1px de folga: arredondamento de subpixel não é defeito de layout.
          if (filho.getBoundingClientRect().right > limite + 1) {
            achados.push(`${filho.tagName}: ${filho.textContent?.slice(0, 24)}`);
          }
        });
      });
      return achados;
    });
    escapando.push(...fora.map((achado) => `${tela} — ${achado}`));
  }

  expect(escapando).toEqual([]);
});

/** O card de número com aquele título — o mesmo tijolo do resumo (§5.12). */
function cartao(page: Page, titulo: string) {
  return page.locator('[data-slot="cartao-indicador"]').filter({ hasText: titulo });
}

function valorDo(page: Page, titulo: string) {
  return cartao(page, titulo).locator('[data-slot="cartao-indicador-valor"]');
}

test('a ficha do cliente mostra os quatro números e o filtro do histórico funciona', async ({
  page,
}) => {
  const ids = await entrarNoPainel(page, LOJA);
  const semente = await semear(ids);
  await semearHistorico(ids, semente);

  // Pela lista, não pela URL: é assim que o dono chega na ficha.
  await abrir(page, '/app/clientes');
  await page.getByRole('link', { name: CLIENTE.nome }).click();
  await page.waitForURL(/\/app\/clientes\/[^/]+$/);

  await expect(page.locator('[data-slot="cartao-indicador"]')).toHaveCount(4);

  // Três concluídos de R$ 85 — o agendado de hoje não entra, porque ainda não
  // aconteceu, e a falta não rendeu nada.
  await expect(valorDo(page, 'Total gasto')).toHaveText('R$ 255,00');
  await expect(cartao(page, 'Total gasto')).toContainText('em 3 atendimentos');
  // Visitas há 30, 15 e 0 dias: a mediana dos intervalos dá 15.
  await expect(valorDo(page, 'Corta a cada')).toHaveText('15 dias');
  // 1 falta em 3 atendidos + 1 falta. Cancelado não entraria no divisor.
  await expect(valorDo(page, 'Faltas')).toHaveText('25%');
  await expect(valorDo(page, 'Preferidos')).toHaveText(SERVICO.nome);

  // Os quatro cards têm `data-slot` próprio, então o único `card` da ficha é o
  // do histórico — e as linhas dele são o que o filtro mexe.
  const linhas = page.locator('[data-slot="card"] li');
  await expect(linhas).toHaveCount(5);

  await page.getByRole('button', { name: 'Faltas', exact: true }).click();
  await expect(linhas).toHaveCount(1);
  await expect(linhas.first()).toContainText('Não veio');

  await page.getByRole('button', { name: 'Concluídos', exact: true }).click();
  await expect(linhas).toHaveCount(3);
  await expect(linhas.first()).toContainText('Compareceu');
});

test('o vão livre entre dois atendimentos abre o encaixe com a hora pronta', async ({ page }) => {
  const ids = await entrarNoPainel(page, LOJA);
  const semente = await semear(ids);
  const amanha = await semearVaoLivre(ids, semente);

  await abrir(page, `/app/agenda?data=${amanha}`);

  // O nome acessível começa pelo verbo e carrega o texto visível inteiro; o
  // barbeiro fica de fora do casamento porque o nome dele vem do cadastro que o
  // `/signup` monta.
  const faixa = page.getByRole('button', { name: /^Encaixar às 09:30 · 1 h 30 min livre/ });
  await expect(faixa).toBeVisible();
  await faixa.click();

  // A folha abre com a hora que o dedo apontou — é o ponto inteiro do gesto:
  // pedir de novo a hora que a pessoa acabou de escolher é o que os outros
  // produtos não fazem.
  const folha = page.getByRole('dialog', { name: 'Encaixe' });
  await expect(folha).toBeVisible();
  await expect(folha.getByText('09:30', { exact: true })).toBeVisible();

  // E com o barbeiro do vão. O campo é escondido de propósito (a escolha é a
  // ficha), então quem responde é o valor dele, não a aparência.
  const staffEscolhido = await page
    .locator('#formulario-de-encaixe input[name="staffId"]')
    .evaluate((campo) => (campo as HTMLInputElement).value);
  expect(staffEscolhido).toBe(ids.staffId);
});

/**
 * Teto de tabulações até o primeiro botão de presença da lista.
 *
 * Sidebar, barra superior, barra de data e o encaixe cabem folgados nisto; um
 * número apertado transformaria "mudou a ordem de foco" em falha de teclado.
 */
const LIMITE_DE_TABS = 60;

test('em 1280px, a ação do cartão aparece ao chegar nele pelo teclado', async ({ page }) => {
  const ids = await entrarNoPainel(page, LOJA);
  await semear(ids);

  await page.setViewportSize({ width: 1280, height: 900 });
  await abrir(page, '/app/agenda');

  // O ponteiro sai da frente: o `entrarNoPainel` clicou em "Cadastrar" e o
  // mouse ficou parado onde o botão estava. Se aquele ponto cair em cima de um
  // cartão, o `hover` revela a ação e o teste mede o caminho errado.
  await page.mouse.move(0, 0);

  // A semente tem um único agendado, então é dele o bloco de ações.
  const acoes = page.locator('[data-slot="acoes-do-cartao"]').first();
  const compareceu = page.getByRole('button', { name: 'Compareceu' }).first();

  // Em repouso o botão continua no DOM — recolher é decisão visual, e sumir do
  // documento tiraria a ação de quem usa Tab e de quem usa leitor de tela.
  // `toBeVisible()` não serve de prova aqui: para o Playwright, opacidade zero
  // ainda é visível. Quem responde é o que o navegador calcula.
  await expect(compareceu).toBeAttached();
  await expect(acoes).toHaveCSS('opacity', '0');

  // Tab até o botão. Com `display:none` no lugar do `opacity`, ou sem o
  // `focus-within`, este laço nunca chega nele — e é exatamente a regressão que
  // nenhum teste de aparência pega.
  let focado = false;
  for (let i = 0; i < LIMITE_DE_TABS && !focado; i += 1) {
    await page.keyboard.press('Tab');
    focado = await compareceu.evaluate((botao) => botao === document.activeElement);
  }
  expect(focado).toBe(true);

  await expect(acoes).toHaveCSS('opacity', '1');
  // E volta a receber clique: revelar sem devolver o ponteiro seria um botão
  // que aparece e não funciona.
  await expect(acoes).toHaveCSS('pointer-events', 'auto');
});
