import { test, expect, type Page } from '@playwright/test';
import { DateTime } from 'luxon';
import { eq } from 'drizzle-orm';

import { db } from '@/db/client';
import { appointment, barbershop, customer, service, staff, staffService } from '@/db/schema';
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
 * **As cinco de 15/08/2026 são da mesma família, e nascem de um erro de
 * método.** Duas rodadas de redesenho da agenda leram `cartao-da-agenda.tsx` e
 * `day-grid.tsx`, discutiram lista contra timeline e mediram largura no
 * navegador — e nunca olharam a tela renderizada com dados de um dia real. A
 * captura em 1440px mostrou em cinco segundos o que três análises de código não
 * acharam: cartão de 880×100 com 380px de vazio, o `⋯` boiando no canto, o fundo
 * inteiro verde ou vermelho por status. Nada disso se vê lendo JSX, e nada disso
 * um teste de fonte pega. O que dá para automatizar do olhar do dono mora aqui:
 *
 * 4. **As sete colunas e os 48px** — geometria só existe depois do layout, e
 *    `grid-template-columns` computado é a única prova de que a linha não voltou
 *    a ser o cartão esticado.
 * 5. **O fundo que não diz estado** — a decisão com cinco fontes da spec, e a
 *    que já passou uma vez por um teste que olhava só `className` enquanto o
 *    verde vinha por `style` inline. Aqui quem responde é a cor calculada.
 * 6. **"Compareceu" dentro do menu do `⋯`, acionado por `Enter`** — o Polaris
 *    exige um segundo caminho para ação revelada no hover, e a primeira versão
 *    do menu punha um `<button>` dentro do `<div role="menuitem">`: o item
 *    aparecia, as setas andavam por ele e o `Enter` não marcava ninguém.
 * 7. **Remarcar de ponta a ponta** — é o primeiro estado modal da tela. O
 *    caminho inteiro (menu → modo → faixa → confirmação → horário novo) cruza
 *    quatro arquivos e uma server action, e o teste cobre também **entrar e sair
 *    sem remarcar**, que é o jeito de o modo ficar ligado sem ninguém perceber.
 * 8. **O dia vazio sem "livre · livre"** — se não há nada marcado, todo mundo
 *    está livre; a linha não é notícia.
 *
 * **As quatro de 16/08/2026 são da tela de configurações**, e as duas últimas
 * são as mais importantes do arquivo inteiro: são as que provam que **salvar não
 * apaga o fuso**.
 *
 * 9. **As três seções na ordem, com o título fora do card e o link fora do
 *    `<form>`.** A ordem (identidade → link → regras) e o alinhamento único são
 *    a reforma inteira de 16/08, e nenhuma das duas se vê lendo um componente
 *    isolado: quem monta a tela é a página.
 * 10. **Copiar o link.** A área de transferência é do navegador; em jsdom o que
 *    se testa é um dublê.
 * 11. **Alterar o fuso e salvar.** O `Select` do fuso sai da árvore quando o
 *    bloco recolhe, então quem carrega o valor é um campo oculto — e campo
 *    oculto é justamente o tipo de coisa que passa despercebida quando quebra.
 * 12. **Salvar SEM tocar no fuso.** É o risco escrito no plano de 16/08: o
 *    campo sumindo do `<form>` faria a action gravar o padrão por cima e
 *    **apagar a configuração** da barbearia que não é de São Paulo. Desde a
 *    mesma rodada os campos moram fora do `<form>` e se amarram nele pelo
 *    atributo `form`; se essa amarração cair, este é o caso que grita.
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

/**
 * O cadastro da loja **sem nenhum atendimento**: serviço, vínculo, um segundo
 * barbeiro e um cliente.
 *
 * Separado do `semear` por causa do dia vazio: a linha "Fulano livre · Beltrano
 * livre" só aparece com mais de um barbeiro ativo, então provar que ela some
 * exige exatamente isto — dois barbeiros cadastrados e a agenda de hoje limpa.
 */
async function semearCadastro(ids: Ids): Promise<Semente> {
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

  return { serviceId: combo.id, customerId: cliente.id };
}

/** Uma linha em cada lista do painel, para as telas não serem medidas vazias. */
async function semear(ids: Ids): Promise<Semente> {
  const semente = await semearCadastro(ids);

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
 * Os mesmos dois atendimentos, mas **amanhã**, e devolve o dia para a URL.
 *
 * Amanhã porque a linha do desktop é medida aqui: hoje, o atendimento cujo
 * intervalo contém o instante atual ganha `--agora-bg`, e aí "o fundo não diz
 * estado" viraria um caso que passa de manhã e reprova às nove e meia. Fora do
 * dia de hoje nenhuma das duas linhas está acontecendo, e as duas têm que ter
 * exatamente o mesmo fundo.
 */
async function semearAmanha(ids: Ids, semente: Semente): Promise<string> {
  const amanha = diaDaLoja(1);
  const em = (hora: number) => amanha.set({ hour: hora }).toJSDate();
  const base = baseDoAtendimento(ids, semente);

  await db.insert(appointment).values([
    { ...base, startAt: em(9), endAt: em(10), status: 'BOOKED' },
    { ...base, startAt: em(10), endAt: em(11), status: 'DONE' },
  ]);

  return amanha.toISODate()!;
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
 * Dois atendimentos de **amanhã** com duas horas de buraco entre eles, para a
 * remarcação ter para onde ir. Devolve o dia para a URL da agenda.
 *
 * **A duração casa com o snapshot de propósito.** Quem remarca é
 * `rescheduleAppointment`, e ele recalcula o fim a partir de
 * `serviceDurationMinutesSnapshot` — 60 min aqui. Semear uma hora de relógio com
 * snapshot de 60 é o que a loja de verdade produz; semear meia hora faria o teste
 * medir uma inconsistência que só existe na semente.
 */
async function semearParaRemarcar(ids: Ids, semente: Semente): Promise<string> {
  const amanha = diaDaLoja(1);
  const em = (hora: number) => amanha.set({ hour: hora }).toJSDate();
  const base = baseDoAtendimento(ids, semente);

  await db.insert(appointment).values([
    { ...base, startAt: em(9), endAt: em(10), status: 'BOOKED' },
    { ...base, startAt: em(12), endAt: em(13), status: 'BOOKED' },
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

test('em 1280px, a ação da linha aparece ao chegar nela pelo teclado', async ({ page }) => {
  const ids = await entrarNoPainel(page, LOJA);
  await semear(ids);

  await page.setViewportSize({ width: 1280, height: 900 });
  await abrir(page, '/app/agenda');

  // O ponteiro sai da frente: o `entrarNoPainel` clicou em "Cadastrar" e o
  // mouse ficou parado onde o botão estava. Se aquele ponto cair em cima de uma
  // linha, o `hover` revela a ação e o teste mede o caminho errado.
  await page.mouse.move(0, 0);

  // Acima de 768px quem desenha o atendimento é a linha de colunas, e o cartão
  // do celular está em `display:none` — por isso o alvo aqui é
  // `verbos-da-linha`, e não o `acoes-do-cartao` que este caso media até
  // 15/08/2026. A semente tem um único agendado, então é dele o bloco.
  const verbos = page.locator('[data-slot="verbos-da-linha"]').first();
  const compareceu = page.getByRole('button', { name: /^Compareceu · / }).first();

  // Em repouso os verbos recolhem para 60% — **não** para zero, como no cartão:
  // são dois ícones de 32px numa linha de 48, não dois botões de 400px. E não
  // saem do DOM: recolher é decisão visual, e sumir do documento tiraria a ação
  // de quem usa Tab e de quem usa leitor de tela.
  await expect(compareceu).toBeAttached();
  await expect(verbos).toHaveCSS('opacity', '0.6');

  // Tab até o botão. Com `display:none` no lugar do `opacity`, ou sem o
  // `focus-within`, este laço nunca chega nele — e é exatamente a regressão que
  // nenhum teste de aparência pega.
  let focado = false;
  for (let i = 0; i < LIMITE_DE_TABS && !focado; i += 1) {
    await page.keyboard.press('Tab');
    focado = await compareceu.evaluate((botao) => botao === document.activeElement);
  }
  expect(focado).toBe(true);

  await expect(verbos).toHaveCSS('opacity', '1');
  // E continua recebendo clique: verbo que sobe e não funciona seria pior do
  // que verbo escondido.
  await expect(verbos).toHaveCSS('pointer-events', 'auto');
});

test('em 1280px, a linha do desktop tem as sete colunas, 48px e nenhum fundo de estado', async ({
  page,
}) => {
  const ids = await entrarNoPainel(page, LOJA);
  const semente = await semearCadastro(ids);
  const amanha = await semearAmanha(ids, semente);

  await page.setViewportSize({ width: 1280, height: 900 });
  await abrir(page, `/app/agenda?data=${amanha}`);
  await page.mouse.move(0, 0);

  const linhas = page.locator('[data-slot="linha-da-agenda"]');
  await expect(linhas).toHaveCount(2);

  // Sete faixas — aresta, hora, cliente, serviço, barbeiro, preço, estado e
  // ações são oito, e a aresta é `border-left`, não coluna. O valor calculado
  // vem em px, então contar os pedaços é a medida; comparar a string travaria o
  // teste na largura da janela.
  const colunas = page.locator('[data-slot="colunas-da-linha"]').first();
  const faixas = await colunas.evaluate(
    (grade) => getComputedStyle(grade).gridTemplateColumns.split(/\s+/).length,
  );
  expect(faixas).toBe(7);

  // 48px, o "default" do Carbon, e o mesmo nas duas durações — a régua que a
  // altura-por-duração do cartão quebrava.
  await expect(colunas).toHaveCSS('height', '48px');
  await expect(page.locator('[data-slot="colunas-da-linha"]').nth(1)).toHaveCSS('height', '48px');

  // **O fundo não diz estado** — a decisão com cinco fontes da spec. O agendado
  // e o concluído têm que ter exatamente o mesmo fundo: o canal do fundo é o
  // hover, a cor já é do barbeiro, e cor sozinha entrega 1 dos 3 portadores que
  // o Carbon exige. Um teste de fonte já deixou isto passar uma vez, porque o
  // verde vinha por `style` inline e o caso olhava só `className`. Aqui quem
  // responde é a cor que o navegador calcula.
  const fundos = await linhas.evaluateAll((itens) =>
    itens.map((item) => getComputedStyle(item).backgroundColor),
  );
  expect(fundos[1]).toBe(fundos[0]);
});

test('"Compareceu" existe dentro do menu do ⋯ e responde ao Enter', async ({ page }) => {
  const ids = await entrarNoPainel(page, LOJA);
  await semear(ids);

  await page.setViewportSize({ width: 1280, height: 900 });
  await abrir(page, '/app/agenda');
  await page.mouse.move(0, 0);

  // O caminho de quem não tem ponteiro. Na linha os dois verbos recolhem e só
  // sobem no hover ou no foco; o Polaris exige que ação revelada no hover seja
  // alcançável de outro jeito, e o outro jeito é este menu. Tudo aqui é
  // teclado: `press` foca o alvo e digita, sem mouse nenhum.
  const linha = page.locator('[data-slot="linha-da-agenda"]').first();
  await linha.getByRole('button', { name: /^Mais ações para / }).press('Enter');

  const compareceu = page.getByRole('menuitem', { name: 'Compareceu', exact: true });
  await expect(compareceu).toBeVisible();

  // O `Enter` no item, e não um clique: a primeira versão do menu punha um
  // `<button>` dentro do `<div role="menuitem">` do base-ui — o item aparecia,
  // as setas andavam por ele e o Enter não marcava ninguém. O clique passava.
  await compareceu.press('Enter');

  await expect(linha.locator('[data-slot="estado-da-linha"]')).toHaveText('Compareceu');
});

test('remarcar leva o atendimento para o horário novo, sem cancelar', async ({ page }) => {
  const ids = await entrarNoPainel(page, LOJA);
  const semente = await semearCadastro(ids);
  const amanha = await semearParaRemarcar(ids, semente);

  await page.setViewportSize({ width: 1280, height: 900 });
  await abrir(page, `/app/agenda?data=${amanha}`);
  await page.mouse.move(0, 0);

  const linhas = page.locator('[data-slot="linha-da-agenda"]');
  const aviso = page.locator('[data-slot="aviso-de-remarcacao"]');

  const entrarNoModo = async () => {
    await linhas.first().getByRole('button', { name: /^Mais ações para / }).click();
    await page.getByRole('menuitem', { name: 'Remarcar', exact: true }).click();
  };

  // **Entrar e sair sem remarcar.** É o primeiro estado modal da tela: enquanto
  // ele está ligado, clicar numa faixa significa outra coisa. Modo que fica
  // ligado sem a pessoa perceber é o risco registrado no plano, e por isso o
  // aviso é fixo e `Esc` sempre desliga.
  await entrarNoModo();
  await expect(aviso).toBeVisible();
  await expect(aviso).toContainText(CLIENTE.nome);
  await page.keyboard.press('Escape');
  await expect(aviso).toHaveCount(0);

  await entrarNoModo();

  // A faixa do vão troca de verbo junto com o modo — quem ouve o rótulo precisa
  // saber que aquele botão move alguém que já estava marcado em vez de encaixar
  // um cliente novo. Duas horas de buraco entre as 10h e o meio-dia.
  const destino = page.getByRole('button', {
    name: new RegExp(`^Remarcar ${CLIENTE.nome} para 10:00 · 2 h livre`),
  });
  await expect(destino).toBeVisible();
  await destino.click();

  const folha = page.getByRole('dialog', { name: `Remarcar ${CLIENTE.nome}` });
  await expect(folha).toBeVisible();
  await expect(folha.getByText('10:00')).toBeVisible();
  await folha.getByRole('button', { name: 'Confirmar remarcação' }).click();

  // O atendimento das 9h passa a ser o das 10h, continua sendo um só e continua
  // agendado: remarcar não é cancelar e refazer, que era o único caminho antes
  // de 15/08/2026.
  await expect(linhas.first()).toContainText('10:00');
  await expect(linhas).toHaveCount(2);
  await expect(page.getByText('09:00', { exact: true })).toHaveCount(0);
  // E o modo se desliga sozinho no sucesso: deixá-lo ligado faria o próximo
  // clique numa faixa remarcar de novo sem ninguém ter pedido.
  await expect(aviso).toHaveCount(0);
});

test('o dia vazio não repete "livre · livre"', async ({ page }) => {
  const ids = await entrarNoPainel(page, LOJA);
  await semearCadastro(ids);

  await page.setViewportSize({ width: 1280, height: 900 });
  // Hoje, e com dois barbeiros ativos: é a única combinação em que a linha de
  // próximos livres chega a ser considerada. Num dia futuro ela nem é avaliada,
  // e o caso não provaria nada.
  await abrir(page, '/app/agenda');

  const vazio = page.locator('[data-slot="agenda-vazia"]');
  await expect(vazio).toContainText('Nenhum agendamento neste dia.');
  await expect(page.locator('[data-slot="proximos-livres"]')).toHaveCount(0);

  // A varredura é da tela inteira de propósito: "livre" em qualquer canto de um
  // dia sem nada marcado é o ruído que esta correção tirou — se não há ninguém
  // marcado, todo mundo está livre, e isso não é notícia.
  await expect(page.getByText(/livre/i)).toHaveCount(0);

  // O estado vazio existe para oferecer a próxima ação, e num dia vazio a
  // próxima ação é a única que há. O "Encaixe" da barra também está na tela, e
  // é por isso que a busca é dentro do bloco.
  await expect(vazio.getByRole('button', { name: 'Encaixe' })).toBeVisible();
});

/** O que a loja tem gravado agora — a resposta que a tela não dá. */
async function lojaNoBanco(barbershopId: string) {
  const [linha] = await db.select().from(barbershop).where(eq(barbershop.id, barbershopId));
  return linha;
}

test('as configurações cabem numa seção só, com o título fora do card e o link fora do form', async ({
  page,
}) => {
  await entrarNoPainel(page, LOJA);
  await abrir(page, '/app/configuracoes');

  // Uma seção só, a pedido do dono: com sete campos, três títulos gastavam mais
  // altura do que organizavam. A ordem — nome, link, regras — se lê pela posição
  // dos campos, e o link continua no meio porque **deriva** da identidade: o
  // slug nasce do nome (§2.3).
  const titulos = page.locator('[data-slot="secao-de-ajustes"] [data-slot="secao-titulo"]');
  await expect(titulos).toHaveText(['Configurações']);

  const ordem = await page.evaluate(() => {
    const alvos = [...document.querySelectorAll('[name="name"], [data-slot="link-endereco"], [name="slotMinutes"]')];
    return alvos.map((el) => el.getAttribute('name') ?? el.getAttribute('data-slot'));
  });
  expect(ordem).toEqual(['name', 'link-endereco', 'slotMinutes']);

  // **O título fora do card** é a correção do defeito medido: "Nome da
  // barbearia" em x=588 e "Endereço público" em x=424, no mesmo card, porque
  // metade do conteúdo respeitava uma coluna de rótulo que a outra metade
  // ignorava. Isso é geometria de DOM montado — o unitário prova o componente,
  // este prova a tela.
  const dentroDoCard = await titulos.evaluateAll((h2s) =>
    h2s.filter((h2) => h2.closest('[data-slot="card"]') !== null).map((h2) => h2.textContent ?? ''),
  );
  expect(dentroDoCard).toEqual([]);

  // **O link fora do `<form>`** (§2.4): copiar age na hora, o formulário age no
  // submit, e quem clica em copiar e sai da tela acha que salvou. Na tela
  // montada o link fica no meio das duas seções de campo, então só o DOM de
  // verdade responde se ele ficou de fora — os campos se amarram ao formulário
  // pelo atributo `form`, e não por aninhamento.
  const blocoDoLink = page.locator('[data-slot="link-endereco"]');
  expect(await blocoDoLink.evaluate((el) => el.closest('form') === null)).toBe(true);

  // E o formulário continua sendo um só, com um botão de salvar só (Primer:
  // "There should only be one save button on a page"). A busca é dentro do
  // `<main>` porque o `page.locator` atravessa shadow DOM e alcançaria o
  // sobreposto de desenvolvimento do Next.
  await expect(page.locator('main form')).toHaveCount(1);
  await expect(page.locator('main').getByRole('button', { name: /salvar/i })).toHaveCount(1);
});

test('copiar o link de agendamento põe a URL na área de transferência e avisa', async ({
  page,
  context,
}) => {
  await entrarNoPainel(page, LOJA);
  // A permissão é do contexto, e fica aqui em vez de no `playwright.config.ts`:
  // é o único caso do projeto que lê a área de transferência, e concedê-la para
  // a suíte inteira esconderia o dia em que outra tela passar a depender dela.
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await abrir(page, '/app/configuracoes');

  const endereco = page.locator('[data-slot="link-endereco"]');
  const url = ((await endereco.textContent()) ?? '').trim();
  expect(url).toContain(`/b/${LOJA.slug}`);

  // O nome acessível carrega a própria URL desde 16/08 ("Copiar o link
  // https://…"): o endereço virou o botão, e um rótulo genérico deixaria de
  // dizer o que vai para a área de transferência.
  await page.getByRole('button', { name: /^Copiar o link/ }).click();

  // O aviso primeiro, porque ele some em 2s — Polaris: "Provide feedback inline
  // using a confirmation check icon post-click". Sem retorno, a pessoa clica de
  // novo achando que falhou.
  await expect(page.locator('[data-slot="link-aviso"]')).toHaveText('Link copiado.');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(url);
});


test('salvar sem tocar no fuso não apaga o fuso que já estava lá', async ({ page }) => {
  const ids = await entrarNoPainel(page, LOJA);

  // A barbearia que **de fato** não é de São Paulo: é ela quem perderia a
  // configuração. Com o fuso no padrão, o defeito passaria despercebido — o
  // valor gravado por engano seria igual ao que já estava.
  await db
    .update(barbershop)
    .set({ timeZone: 'America/Manaus' })
    .where(eq(barbershop.id, ids.barbershopId));

  await abrir(page, '/app/configuracoes');

  // O fuso não aparece mais em lugar nenhum da tela: ele é capturado do
  // navegador no cadastro (§1.1). O que precisa continuar existindo é o campo
  // oculto — sem ele a action receberia `timeZone` ausente e gravaria o padrão
  // por cima.
  await expect(page.getByText('America/Manaus')).toHaveCount(0);

  // Mexe em outra coisa e salva. É o caminho de 100 de cada 100 salvamentos, e
  // o que apagaria o fuso se o oculto saísse do `<form>`.
  await page.getByLabel('Nome da barbearia').fill('Barbearia do Marcão');
  await page.getByRole('button', { name: 'Salvar configurações' }).click();
  await expect(page.getByText('Configurações salvas.')).toBeVisible();

  const depois = await lojaNoBanco(ids.barbershopId);
  expect(depois.timeZone).toBe('America/Manaus');
  // E o campo que a pessoa mexeu chegou mesmo na action: sem isto, um "salvou"
  // que não salva nada passaria neste caso.
  expect(depois.name).toBe('Barbearia do Marcão');
});
