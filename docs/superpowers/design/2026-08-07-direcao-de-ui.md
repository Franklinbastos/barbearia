# Direção de UI — reforma de layout da Fase 1

Data: 2026-08-07 · revisado em 2026-08-08 após o júri completo · **§4.1 revertida em 2026-08-13**
(adoção do shadcn, decisão do dono — o resto do documento continua valendo palavra por palavra)
Autor: direção de design
Status: **decidido**. Esta é a fonte da verdade para o plano de implementação. Onde o documento
der um número, o número é para ser usado. Onde der um texto entre aspas, o texto é literal — há
teste e2e casando por nome acessível.

> **Esta versão substitui a de 07/08.** Aquela foi escrita quando o júri tinha lido só uma das
> três direções por inteiro. O julgamento que vale é o da rodada completa: três jurados leram as
> três propostas e conferiram o código. Placar somado: **Ferramenta de Balcão 24 · Clareza Calma
> 21 · Vitrine 14,5**. A vencedora é a mesma; o que mudou foi o peso da segunda colocada (subiu
> de 16 para 21) e cinco furos novos que ninguém tinha visto — o catálogo buscado no cliente à
> toa, o estado do dia que se perde no 409, a ausência de `not-found.tsx`, a ausência de logout e
> a inexistência de busca por cliente. Tudo isso está incorporado abaixo.

---

## 1. A decisão

**Vence a "Ferramenta de Balcão".** Não por gosto, e não por larga margem: a "Clareza Calma"
chegou a três pontos de distância e é tecnicamente a proposta mais cuidadosa das três. A decisão
se resolve num cenário só, o que o próprio produto declara como principal — 18h de sexta, fila de
três, cliente esperando em pé, barbeiro fechando quatro atendimentos com o celular numa mão. Na
vencedora isso são quatro toques e nenhuma animação. Na Clareza Calma são oito toques e quatro
folhas subindo e descendo por cima da lista que o barbeiro quer ler. A própria Clareza Calma
admite o defeito no risco 1 e oferece o remendo ("um botão de check de 44px direto na linha"), que
é adotar a vencedora no ponto que importa. Os três jurados, independentemente, pediram o check na
linha.

A "Vitrine" perde por um motivo verificável, não estético: **sete campos e uma tabela que não
existem** (`coverUrl`, `logoUrl`, `tagline`, `address`, galeria, `service.description`,
`accentHue`), sem nenhum caminho de escrita, sem `images.remotePatterns` em `next.config.ts` (que
está vazio) e sem um único provedor de storage no `package.json`. O precedente está no próprio
repo: `staff.photoUrl` existe no schema desde sempre, já é servido pela rota de catálogo, e
`staff-form.tsx` nunca teve campo de imagem — é `null` em 100% das linhas. No dia 1 toda loja
cairia no modo textura CSS, que é a Direção 1 pintada de marrom, com menos contraste, LCP pior e
três vezes o custo. Some a isso escuro fixo na pública para um cliente que abre o link na calçada
ao sol, e a página deixando de ser cacheável na borda por causa do matiz injetado no `<html>`.

**A vencedora entra emendada em oito pontos**, todos apontados por jurado com cenário concreto:

1. **Catálogo por prop, não por `fetch`** (jurado-cliente). `page.tsx` já roda `listActiveServices`
   no servidor e mesmo assim `booking-wizard.tsx` busca `/api/public/[slug]/catalog` dentro de um
   `useEffect`. São dois a três segundos de tela cinza em 4G ruim antes do primeiro pixel útil.
   Apagar essa requisição vale mais que qualquer token de cor deste documento.
2. **O 409 não perde nada** (Clareza Calma). O dia é estado local do `SlotStep`
   (`slot-step.tsx:32`, `useState(dias[0])`) e o passo é desmontado enquanto o cliente digita.
   Quem escolheu sexta volta do conflito olhando a grade de hoje, com o horário citado no aviso em
   lugar nenhum da tela e o nome que digitou apagado. Dia, nome e telefone sobem para o
   `BookingWizard`.
3. **Aresta de cor por barbeiro** (Vitrine). Numa lista única por horário, faixa colorida se **vê**
   e nome se **lê**. É o que devolve, sem coluna nenhuma, a resposta de "quem está livre às 10h".
4. **Linha "próximo livre"** no topo da agenda (jurado-implementador): `João 10:30 · Pedro 11:00 ·
   Ana 14:00`, calculada dos mesmos `appointments` que a página já carrega. Responde a pergunta do
   balcão sem quadro de colunas.
5. **Encaixe em dois modos, "Agora | Marcar hora"** — a melhor ideia isolada de toda a rodada,
   citada por dois jurados. Resolve o walk-in em quatro toques e não muda uma linha da server
   action.
6. **`GET /api/public/[slug]/availability/days`** (Clareza Calma). A única adição de backend da
   reforma que muda o **número de toques**. Sem ela, "sexta não tem" custa tocar dia por dia
   esperando um fetch a cada um, e é exatamente o minuto em que o cliente liga para a loja.
7. **WhatsApp em todo beco sem saída da pública** (Vitrine + jurado-cliente). O cliente veio do
   WhatsApp; quando a tela não resolve, mandar mensagem é um toque e ele continua cliente. Ligar é
   o fracasso que o produto existe para evitar.
8. **Busca por nome e telefone no painel** (jurado-balcão). É o furo que as **três** direções
   deixaram: toca o telefone, "aqui é o Marcos, que horas eu marquei?", e hoje só dá para chutar
   data por data com o cliente na cadeira.

**E corto quatro coisas da vencedora**, porque os jurados mostraram que são caras ou erradas: o
quadro de colunas do desktop (vai para a Fase 2 com as regras já escritas, §5.11), a faixa de
quatro blocos de resumo (64px da primeira dobra para um filtro de fim de mês), a segunda família
de fonte (JetBrains Mono na página que precisa abrir em 3G na porta da loja) e as classes CSS soltas
como contrato de altura — altura e semântica passam a ser propriedade de **componente**.

**O que esta direção sacrifica conscientemente:**

- **Sofisticação visual.** Preto sobre branco, quatro cores de estado e uma faixa de matiz do dono.
  A barbearia não vai reconhecer a fachada dela aqui. Vai reconhecer a velocidade.
- **Foto.** Nenhuma. Nem capa, nem logo, nem retrato de barbeiro. Monograma e tipografia. Foto volta
  a ser discutida quando existir upload, e aí é feature, não layout.
- **O quadro de colunas por barbeiro** que o spec pede na §6. Fase 2, com as quatro regras já
  fechadas em §5.11 para não travar depois.
- **Densidade máxima.** Alvo de 48–64px custa altura: cabem ~5 atendimentos na dobra de 360×640.
  Compenso cortando a faixa de resumo, agrupando por hora e ancorando a rolagem no agora. Se ainda
  faltar, a próxima coisa a cair é a terceira linha do cartão (o telefone), nunca o alvo.
- **Movimento.** Uma animação no produto inteiro: a barra indeterminada de 2px. Nada de shimmer,
  nada de pulso, nada de folha subindo 240ms para registrar presença.

---

## 2. Princípios

Seis regras. Servem para encerrar discussão sem reunião.

**P1 — Um toque, uma decisão.** Nenhuma etapa do fluxo público tem botão "Continuar": tocar no
serviço, no barbeiro, no dia ou no horário já avança. Botão de confirmar só existe onde há dado
digitado (contato, encaixe) ou escrita destrutiva. Se alguém propuser um "Continuar", a resposta é
não.

**P2 — Contraste antes de beleza, e estado nunca é opacidade.** Nenhum texto abaixo de 4,5:1,
nenhuma divisória abaixo de 3:1. Estado se comunica por **tinta de fundo + aresta de 4px +
palavra**, nunca por `opacity`. A `opacity: 0.5` de `day-grid.tsx:69` come exatamente o contraste
que a direção não gasta em outro lugar. Corolário duro, do jurado-cliente: **duração e preço nunca
saem em `--tinta-3`** — quem não lê a duração descobre na confirmação, e o produto exige que ele
entenda preço **e** duração antes de escolher.

**P3 — O dedo manda na medida, e a medida mora no componente.** 48px é o piso de qualquer alvo que
carregue decisão; 52px para campo de formulário e verbo da agenda; 56px para a ação principal da
tela; 64px para ficha de horário. 44px é permitido **só** para afordância inline dentro de um bloco
maior (link `tel:`, "Trocar", "⋯"). 8px de folga mínima entre alvos vizinhos. E, correção da
Clareza Calma sobre a vencedora: essas alturas e o rótulo implícito são propriedade de `<Botao>` e
`<Campo>`, **não** string de classe copiada. Com 30 campos reescritos, na quinta tela alguém emite
um `<label for>` irmão, o `getByLabel` quebra só onde não há e2e, e ninguém percebe. `<input>` cru
fora de `<Campo>` é erro de revisão.

**P4 — Ação destrutiva não mora na superfície principal.** "Cancelar", "Anonimizar" e "Cancelar meu
horário" saem da linha e vão para a folha de "Mais ações", com confirmação em dois toques no
próprio botão (o rótulo vira "Confirmar cancelamento" por 4s). `confirm()` nativo está **proibido**
no projeto — trava a tela, tem cara de navegador e não é estilizável. Toda ação de status tem
caminho de volta (§5.7, "Desfazer"). **"Não veio" é exceção deliberada e fica na linha** (§5.7):
os três jurados reclamaram de enterrá-lo, e a sexta-feira de limpeza da lista tem 4 no-shows.

**P5 — Feedback no lugar do dedo, nunca toast, e erro nunca apaga trabalho.** No painel, marcar
"Compareceu" muda a cor da linha debaixo do polegar. Falha de ação é `ErroDeAcao` dentro da própria
linha. Sucesso de encaixe é a linha aparecendo na agenda. Toast é para quem está olhando a tela
inteira; aqui ninguém está. E o inverso: **nenhuma falha fecha uma folha nem limpa um campo** — 409
no encaixe mantém a folha aberta com nome e telefone intactos; 409 na pública devolve o cliente ao
dia que ele escolheu, não ao primeiro da lista.

**P6 — Uma família de fonte, uma superfície de sobreposição, um anel de foco.** Inter em tudo, com
`tabular-nums` em todo número (a proposta original pedia JetBrains Mono; **cortado** — é um arquivo
a mais na página que precisa abrir em 3G na porta da barbearia, e `tabular-nums` do Inter entrega
99% do ganho). A única superfície flutuante do produto é a folha inferior; menu suspenso, popover e
modal centralizado de desktop não existem. `:focus-visible` sempre com `--anel`; `outline: none`
sem substituto é erro de revisão.

### 2.1 Conflitos entre jurados — como decidi

Cada linha diz **qual usuário ganhou naquele ponto** e por quê.

| Ponto | Conflito | Decisão | Por quê |
|---|---|---|---|
| "Compareceu" na linha × na folha | Clareza Calma quer menu de três pontos; os três jurados dizem 2 toques × 22 por dia | **Na linha, 52px, sem folha** | O balcão ganhou: 22 animações por dia tapando a lista bem na hora de ver quem é o próximo |
| "Não veio" na linha × na folha | A versão anterior deste doc mandou para a folha; o jurado-balcão reclamou dos 4 no-shows de fim de tarde | **Na linha, mas só depois de `agora ≥ startAt + 10min`** | O balcão ganhou no requisito; o toque errado sumiu porque antes da hora um no-show é impossível |
| Colunas × lista | Spec §6 manda colunas; `day-grid.tsx:29-36` argumenta lista; jurado-balcão quer **modo**, não breakpoint | **Lista em toda largura na Fase 1. Colunas na Fase 2, como MODO persistido** | O balcão ganhou: 90% do uso é celular e tablet de 768px em retrato, e colunas por breakpoint significa nunca ver coluna. §5.11 |
| Pública clara × escura | Vitrine manda dark-only; dois jurados descrevem a calçada ao sol | **Bitema pelo sistema, claro como referência de design** | O cliente ganhou: quem decide o brilho é o aparelho dele na rua, não nós |
| `tel:` × WhatsApp na pública | Balcão pensa em ligação; cliente diz que na rua se manda mensagem | **WhatsApp (`wa.me`) na pública, `tel:` no painel** | O cliente ganhou na tela dele: o barbeiro liga, o cliente escreve |
| Stepper nomeado × contador "2 de 4" | Cliente quer saber quanto falta e voltar num toque; 4 rótulos em 11px não cabem em 328px | **Contador "2 de 4 · Barbeiro" + trilho de 4px + faixa de resumo com fragmentos clicáveis** | O cliente ganhou no requisito (tamanho conhecido + volta em um toque), a implementação ganhou no mecanismo |
| Cor de barbeiro por hash × por índice | Vitrine e dois jurados pedem hash de `staff.id` em 6 matizes | **Índice na lista ordenada por nome, 8 matizes** | A matemática ganhou: 4 barbeiros em 6 baldes colidem em 72% dos casos, e cor repetida é pior que cor nenhuma |
| Faixa de 4 blocos de resumo | Direção 1 quer filtros; balcão diz que come 64px da dobra | **Cortada.** Contadores viram legenda de 20px na barra de data | O balcão ganhou: enfeite que custa rolagem é defeito, e o filtro por estado é de fim de mês |
| Mono para números | Direção 1 exige; cliente e implementador reclamam do peso na pública | **Cortado. Inter com `tabular-nums`** | O cliente ganhou: em 3G o swap de fonte acontece com o polegar já descendo na ficha de horário |
| `<select>` × fichas no encaixe | Clareza Calma mantém `<select>` nativo para serviço e barbeiro | **Fichas de 48px com `<input type="hidden">`** | O balcão ganhou: roleta nativa com o dedo com talco são dois toques precisos, ficha é um |
| Ordem dos campos do encaixe | Clareza Calma pede nome e telefone antes de serviço e barbeiro | **Barbeiro → serviço → horário → nome → telefone** | O balcão ganhou: trava-se a cadeira primeiro; o nome o cliente soletra enquanto o atendente digita |

---

## 3. Tokens

Copiável direto para `src/app/globals.css`. Substitui o arquivo inteiro — o atual tem 26 linhas,
duas delas erradas (declara `--font-sans` na linha 11 e o anula na 25 forçando Arial).

### 3.1 `globals.css` completo

```css
@import "tailwindcss";

/* ============================================================
   1. TOKENS CRUS — o tema claro é a referência de design
   ============================================================ */
:root {
  /* color-scheme é OBRIGATÓRIO e hoje não existe: sem ele o seletor nativo de
     input[type=date] e input[type=time] — o coração da barra de data do painel
     e do encaixe — fica branco sobre fundo preto no tema escuro. */
  color-scheme: light dark;

  /* superfícies */
  --bg:           #FFFFFF; /* chão da página, fundo de campo, linha BOOKED */
  --superficie:   #F4F5F7; /* bloco informativo, cabeçalho de hora, linha cancelada */
  --superficie-2: #E7E9ED; /* ficha em repouso, prefixo "R$", esqueleto, :active */
  --linha:        #8A9099; /* divisória e borda de campo — 3,2:1 sobre branco */
  --linha-suave:  #D3D7DD; /* só separação decorativa interna (meia hora tracejada) */

  /* tinta */
  --tinta:   #0B0D10; /* texto principal (19:1) e preenchimento do botão primário */
  --tinta-2: #454B54; /* texto secundário (8,8:1) — duração, preço, linha 2 do cartão */
  --tinta-3: #646A74; /* micro-rótulo e hora de fim (5,4:1 no branco, 4,9:1 no cinza).
                         PROIBIDO em duração e preço — ver P2. */
  --acao:       var(--tinta);
  --acao-tinta: #FFFFFF;

  /* estados — cada par funciona como texto sobre a página E como preenchimento
     sob texto branco. Substituem os três vermelhos de hoje (crimson, #b00020,
     darkorange), que aparecem em 11 arquivos. */
  --ok:     #14663B;  --ok-bg:     #DCF5E7; /* compareceu, confirmado */
  --perigo: #A4132A;  --perigo-bg: #FDE4E7; /* não veio, cancelado, erro */
  --alerta: #8A4B00;  --alerta-bg: #FFEFD2; /* encaixe, fora da grade, conflito 409 */
  --agora:  #0B4FD1;  --agora-bg:  #E1EBFF; /* acontecendo agora, régua do relógio */

  /* marca da loja — sobrescrita inline pelo Server Component quando a loja tem
     matiz. O padrão É o preto: loja sem configuração fica exatamente como a
     direção desenhou, sem cor nenhuma. Ver §3.4. */
  --marca:       var(--tinta);
  --marca-suave: var(--superficie-2);
  --sobre-marca: #FFFFFF;

  /* espaçamento — base 4px. A escala do Tailwind já é a nossa; estes tokens
     existem para o CSS das classes de componente. Nada fora da escala. */
  --e0: 2px;  --e1: 4px;  --e2: 8px;  --e3: 12px;
  --e4: 16px; --e5: 20px; --e6: 24px; --e7: 32px; --e8: 48px;

  /* alvo de toque */
  --tap-min: 44px; /* SÓ afordância inline dentro de um bloco maior */
  --tap:     48px; /* piso de qualquer alvo que carregue decisão */
  --tap-md:  52px; /* campo de formulário, verbo da agenda */
  --tap-lg:  56px; /* ação principal da tela */
  --tap-xl:  64px; /* ficha de horário */

  /* forma */
  --r:       4px;  /* absolutamente tudo */
  --r-folha: 6px;  /* só os dois cantos de cima da folha inferior */

  /* elevação — só duas no produto inteiro */
  --sombra-barra: 0 -8px 24px rgb(0 0 0 / .10);
  --sombra-folha: 0 -8px 24px rgb(0 0 0 / .18);

  /* foco — inegociável; funciona sobre branco, sobre cinza e sobre o botão preto,
     e nunca se confunde com cor de estado */
  --anel: 0 0 0 2px var(--bg), 0 0 0 5px var(--tinta);
}

@media (prefers-color-scheme: dark) {
  :root {
    color-scheme: dark;
    --bg:           #0A0C0F;
    --superficie:   #14181D;
    --superficie-2: #1E242B;
    --linha:        #5A6673; /* 3,3:1 sobre o fundo */
    --linha-suave:  #2A313A;
    --tinta:        #F2F5F8;
    --tinta-2:      #B7C0CA;
    --tinta-3:      #8B96A3;
    --acao:         #F2F5F8;
    --acao-tinta:   #0A0C0F;
    --ok:     #58D89B; --ok-bg:     #0E2E1E;
    --perigo: #FF8A99; --perigo-bg: #38121A;
    --alerta: #FFC163; --alerta-bg: #3A2708;
    --agora:  #7FB0FF; --agora-bg:  #10233F;
    --marca:       var(--tinta);
    --marca-suave: var(--superficie-2);
    --sobre-marca: #0A0C0F;
    --sombra-barra: 0 -8px 24px rgb(0 0 0 / .45);
    --sombra-folha: 0 -8px 24px rgb(0 0 0 / .55);
  }
}

/* ============================================================
   2. PONTE PARA O TAILWIND v4
   ============================================================ */
@theme inline {
  --color-bg:           var(--bg);
  --color-superficie:   var(--superficie);
  --color-superficie-2: var(--superficie-2);
  --color-linha:        var(--linha);
  --color-linha-suave:  var(--linha-suave);
  --color-tinta:        var(--tinta);
  --color-tinta-2:      var(--tinta-2);
  --color-tinta-3:      var(--tinta-3);
  --color-ok:           var(--ok);
  --color-ok-bg:        var(--ok-bg);
  --color-perigo:       var(--perigo);
  --color-perigo-bg:    var(--perigo-bg);
  --color-alerta:       var(--alerta);
  --color-alerta-bg:    var(--alerta-bg);
  --color-agora:        var(--agora);
  --color-agora-bg:     var(--agora-bg);
  --color-marca:        var(--marca);
  --color-marca-suave:  var(--marca-suave);

  --font-sans: var(--fonte-inter), ui-sans-serif, system-ui, sans-serif;

  --radius-cx:    var(--r);
  --radius-folha: var(--r-folha);
}

/* ============================================================
   3. CAMADA BASE — repõe o que o preflight do Tailwind v4 apagou.
   Sem isto, nada nas seções seguintes funciona: o preflight zera fundo, borda
   e padding de button/input (preflight.css:11-16, :92-96) e a cor de a[href]
   (:243-257), e os ~60 botões do app viram texto solto de 24px de altura.
   Referência do padrão: /home/franklin/dev/bdsolutions/src/app/globals.css:22-38
   ============================================================ */
@layer base {
  body {
    background: var(--bg);
    color: var(--tinta);
    font-family: var(--font-sans);
    font-variant-numeric: tabular-nums;
    -webkit-tap-highlight-color: transparent;
  }

  button, input, select, textarea { font: inherit; color: inherit; }

  button, [type="button"], [type="submit"], [type="reset"],
  a[href], select, summary, [role="button"] { cursor: pointer; }

  a { color: var(--tinta); text-decoration: underline; text-underline-offset: 3px; }

  :focus-visible { outline: none; box-shadow: var(--anel); border-radius: var(--r); }

  h1, h2, h3 { text-wrap: balance; }

  /* o seletor nativo de data/hora precisa herdar a tinta no escuro */
  input[type="date"], input[type="time"] { color-scheme: inherit; }
}

/* ============================================================
   4. CLASSES DE IMPLEMENTAÇÃO
   Elas existem para os componentes da §4 usarem por dentro. Tela de produto
   escreve <Botao>/<Campo>/<Bloco>, nunca .btn/.campo/.bloco na mão (P3).
   ============================================================ */
@layer components {
  /* ---- botão ---- */
  .btn {
    display: inline-flex; align-items: center; justify-content: center;
    gap: var(--e2);
    min-height: var(--tap-md);
    padding: 0 var(--e4);
    border: 1px solid transparent;
    border-radius: var(--r);
    background: var(--acao);
    color: var(--acao-tinta);
    font-size: 16px; line-height: 24px; font-weight: 700;
    text-decoration: none;
    transition: background-color 120ms linear;
  }
  .btn--lg  { min-height: var(--tap-lg); font-size: 18px; }
  .btn--tot { width: 100%; }
  .btn--sec { background: transparent; color: var(--tinta); border-color: var(--linha); }
  .btn--ok  { background: var(--ok); color: #FFFFFF; border-color: var(--ok); }
  .btn--perigo-vazado { background: transparent; color: var(--perigo);
                        border: 2px solid var(--perigo); }
  .btn--perigo { background: var(--perigo); color: #FFFFFF; border-color: var(--perigo); }
  .btn--texto  { background: transparent; color: var(--tinta); text-decoration: underline;
                 padding: 0 var(--e2); font-weight: 400; }
  .btn:disabled { background: var(--superficie-2); color: var(--tinta-3);
                  border-color: transparent; cursor: default; }
  .btn:active:not(:disabled) { filter: brightness(1.25); }
  @media (hover: hover) { .btn--sec:hover { background: var(--superficie); } }

  /* ---- campo: o <label> É o contêiner. O rótulo continua IMPLÍCITO por
     aninhamento, que é do que getByLabel() dos e2e depende. ---- */
  .campo { display: flex; flex-direction: column; gap: 6px; }
  .campo > span { font-size: 14px; line-height: 20px; font-weight: 700; color: var(--tinta-2); }
  .campo > input, .campo > select, .campo > textarea {
    min-height: var(--tap-md);
    padding: 0 var(--e3);
    background: var(--bg);
    border: 1px solid var(--linha);
    border-radius: var(--r);
    font-size: 16px; /* 16px impede o iOS de dar zoom ao focar. Nunca baixar. */
    line-height: 24px;
  }
  .campo--erro > input, .campo--erro > select { border: 2px solid var(--perigo); }
  .campo > small { font-size: 14px; line-height: 20px; color: var(--tinta-3); }

  /* select nativo padronizado — o painel continua cheio deles fora do encaixe */
  .campo > select {
    appearance: none;
    padding-right: 40px;
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8'><path d='M1 1l5 5 5-5' fill='none' stroke='%23646A74' stroke-width='2'/></svg>");
    background-repeat: no-repeat;
    background-position: right 14px center;
    background-size: 12px 8px;
  }

  /* ---- bloco informativo ---- */
  .bloco {
    padding: var(--e4);
    border: 1px solid var(--linha);
    border-left-width: 4px;
    border-left-color: var(--linha);
    border-radius: var(--r);
    background: var(--superficie);
    font-size: 16px; line-height: 24px;
  }
  .bloco--ok     { background: var(--ok-bg);     border-color: var(--ok);     color: var(--tinta); }
  .bloco--perigo { background: var(--perigo-bg); border-color: var(--perigo); color: var(--tinta); }
  .bloco--alerta { background: var(--alerta-bg); border-color: var(--alerta); color: var(--tinta); }
  .bloco--agora  { background: var(--agora-bg);  border-color: var(--agora);  color: var(--tinta); }
  .bloco--compacto { padding: 8px 10px; font-size: 14px; line-height: 20px; }

  /* ---- lista de divisórias: o padrão de lista do produto inteiro ---- */
  .lista { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--linha); }
  .lista > li { border-bottom: 1px solid var(--linha); }
  .lista-btn {
    display: grid; align-items: center;
    width: 100%; min-height: 72px;
    padding: 14px 12px;
    text-align: left;
    background: transparent; border: 0;
  }
  .lista-btn:active { background: var(--superficie-2); }
  @media (hover: hover) { .lista-btn:hover { background: var(--superficie); } }

  /* ---- barra indeterminada: a ÚNICA animação do produto ---- */
  .barra-busca { height: 2px; background: var(--superficie-2); overflow: hidden; }
  .barra-busca::after {
    content: ""; display: block; height: 2px; width: 40%;
    background: var(--tinta); animation: desliza 1.1s linear infinite;
  }
  @keyframes desliza { from { transform: translateX(-100%) } to { transform: translateX(350%) } }
  @media (prefers-reduced-motion: reduce) {
    .barra-busca::after { animation: none; width: 100%; opacity: .4; }
  }

  /* ---- esqueleto: sem pulso, sem shimmer, sempre na altura final ---- */
  .esqueleto { background: var(--superficie-2); border-radius: var(--r); }
}
```

### 3.2 Tipografia

Uma família: **Inter**, via `next/font/google` (`node_modules/next/font/google` existe; verificado).
Self-hosted pelo próprio Next, sem requisição externa.

```ts
// src/app/layout.tsx
import { Inter } from 'next/font/google';
const inter = Inter({
  subsets: ['latin'],      // cobre ã ç õ é â
  display: 'swap',
  variable: '--fonte-inter',
});
// <html lang="pt-BR" className={`${inter.variable} h-full antialiased`}>
```

Escala fixa. Nada entre os degraus, nada acima de 34px em lugar nenhum.

| Token | px/entrelinha/peso | Uso exclusivo |
|---|---|---|
| `micro` | 12/16/700, `uppercase`, tracking .06em | cabeçalho de bloco de período, micro-rótulo de coluna, etiqueta de estado |
| `sm` | 14/20/400 | linha secundária do cartão, dica de campo, hora de fim |
| `base` | 16/24/400 | corpo e **todos** os campos de formulário |
| `lg` | 18/24/600 | nome de serviço, nome de cliente, rótulo de botão primário |
| `xl` | 22/28/700 | título de tela, número na ficha de dia |
| `2xl` | 28/32/800 | "Horário confirmado", hora no bloco de compromisso |
| `3xl` | 34/38/800 | só a hora na tela de confirmação |

`font-variant-numeric: tabular-nums` está no `body` e vale para todo número. Coluna de horário que
dança quando o dígito muda é erro de instrumento.

### 3.3 Densidade por superfície

| | Celular (≤767px) | Desktop (≥768px) |
|---|---|---|
| `<main>` público | `padding: 0 16px 96px`, coluna máx. 480px | coluna máx. 560px, centrada sobre `--superficie`, cartão em `--bg` com 1px `--linha` |
| `<main>` painel | `padding: 12px` (sobram 336px úteis contra os 312px de hoje) | `padding: 20px`, `max-width: 1400px` |
| linha de lista pública | mín. 72px | mín. 64px (o mouse precisa de menos) |
| cartão da agenda | mín. 76px | mín. 72px |
| entre título e conteúdo | 12px | 12px |
| entre blocos de assunto | 24px | 24px |
| antes do rodapé | 32px | 32px |

### 3.4 Marca da loja (enxerto da "Vitrine", versão travada)

O jurado-balcão foi direto: "vou colar o link na bio do Instagram, abro pra conferir e é uma tela de
cartório". A válvula mínima existe e é barata.

O dono controla **um número**: `barbershop.accentHue`, inteiro 0–360, **nullable**. L e croma são
nossos e travados, então nenhuma escolha produz botão ilegível.

- claro: `oklch(0.45 0.09 H)` — ~5,1:1 sob texto branco
- escuro: `oklch(0.82 0.09 H)` — ~12:1 sobre `--bg`
- suave claro: `oklch(0.955 0.025 H)` · suave escuro: `oklch(0.27 0.05 H)`

Croma 0.09 foi escolhido por caber no sRGB em todo o círculo nos dois valores de L. O `.115` da
proposta original estoura em 21 dos 36 matizes a L .86 — o jurado de implementação está certo.

**Mecanismo, sem truque de CSS:** o Server Component da rota pública calcula as strings e as injeta
inline no `<div>` raiz do assistente — **não no `<html>`**, justamente para não tornar o documento
dinâmico por loja e perder o cache de borda (risco 8 da Vitrine, que o jurado-cliente pegou).
`accentHue = null` → não injeta nada e a página fica exatamente preto-e-branco.

```tsx
const marca = loja.accentHue == null ? undefined : {
  '--marca':       `oklch(0.45 0.09 ${loja.accentHue})`,
  '--marca-suave': `oklch(0.955 0.025 ${loja.accentHue})`,
  '--sobre-marca': '#FFFFFF',
} as React.CSSProperties;
```

**Onde `--marca` pode aparecer — lista fechada, cinco lugares, só na superfície pública:**
1. o trilho de progresso de 4px do cabeçalho;
2. o traço de 32×3px sob o `<h2>` de cada etapa;
3. o preenchimento da ficha de dia selecionada;
4. a borda e a aresta do bloco "Qualquer barbeiro";
5. a aresta esquerda de 4px do bloco de compromisso e do `.bloco--ok` da confirmação.

**Onde `--marca` está proibida:** botão primário (continua `--tinta`), anel de foco, qualquer cor de
estado, e o painel inteiro. Semântica não gira com a marca — barbearia de matiz vermelho não pode
perder o vermelho de erro.

### 3.5 Cor por barbeiro (enxerto da "Vitrine", com o furo corrigido)

Aresta de 4px na borda esquerda do cartão da agenda, carregando a cor do barbeiro. É a melhor ideia
das outras direções e os três jurados a citaram: numa lista única por horário, faixa colorida se
**vê**, nome se **lê**.

O hash de `staff.id` em 6 baldes, que as três pediram, é inaceitável — com 4 barbeiros a chance de
pelo menos uma colisão é 1 − (6·5·4·3)/6⁴ = **72%**, e dois barbeiros da mesma cor é pior que cor
nenhuma. **Atribuição por índice** na lista de barbeiros ativos ordenada por `name` (pt-BR),
ciclando em 8 matizes; a função vive em `src/lib/cores-de-barbeiro.ts` e recebe a lista inteira,
nunca um id solto.

```
hues = [25, 60, 135, 175, 215, 265, 310, 345]
claro:  oklch(0.52 0.13 H)      escuro: oklch(0.72 0.13 H)
```

A cor **nunca** é o único portador: o nome do barbeiro continua escrito na linha 2 do cartão, em
peso 700 na cor de tinta. Com mais de 8 barbeiros ativos as cores repetem — aceito.

### 3.6 Resumo de borda, raio, sombra, alvo e movimento

- **Borda:** 1px `--linha` é o padrão. 2px `--tinta` marca seleção (`[aria-pressed="true"]`). 4px na
  esquerda carrega estado ou barbeiro. 3px embaixo marca aba ativa. 1px tracejado `--linha` marca
  convite/vazio.
- **Raio:** `--r` 4px em tudo. `--r-folha` 6px só nos dois cantos de cima da folha. **Nenhum
  `rounded-full`, nenhuma pílula.** Canto arredondado lê como aplicativo de loja; canto reto lê como
  instrumento.
- **Sombra:** duas no produto inteiro — `--sombra-barra` na barra fixa de ação, `--sombra-folha` na
  folha. Todo o resto se separa por 1px de `--linha`.
- **Alvo:** 44 (só inline) · 48 · 52 · 56 · 64. Folga mínima de 8px entre alvos vizinhos.
- **Movimento:** 120ms linear em cor; `.barra-busca` é a única animação; folha entra em 160ms com
  `translateY(8px)`; tudo dentro de `prefers-reduced-motion: no-preference`.

---

## 4. Componentes

### 4.1 Procedência

> **Esta seção foi revertida em 13/08/2026.** Até essa data ela dizia, com todas as letras, que
> "nada vem do shadcn", chamava isso de restrição do produto e fechava com "Do shadcn puro: nada.
> Registrado explicitamente para encerrar a discussão". A decisão foi revertida pelo dono e a
> migração aconteceu; o texto antigo virou mentira e mentira em documento é pior que documento
> nenhum. O registro do que valia antes fica preservado abaixo, porque a razão antiga continua
> sendo a razão de metade das exceções de hoje.

#### O que valia até 12/08/2026, e por quê

O `package.json` do barbearia não tinha **uma única** dependência de UI — nem
`class-variance-authority`, nem `lucide-react`, nem `radix`, nem `tw-animate-css`. Tudo era HTML mais
as classes da §3.1 mais SVG embutido para os poucos glifos. O júri manteve assim porque já era o
estado do repositório: não havia dependência para tirar, e qualquer uma que entrasse teria que se
pagar numa página que abre em 3G na porta da loja. Não foi gosto, foi o inventário virando regra —
e é por isso que a regra caiu quando apareceu um motivo que ela não previa.

#### O que vale desde 13/08/2026

**Decisão do dono, e o motivo não é de tela: é de casa.** São três repositórios em manutenção
simultânea. Barbearia e bdsolutions passam a falar shadcn no estilo `base-nova` — o mesmo
`components.json`, `baseColor: neutral`, `cssVariables: true`, `iconLibrary: lucide`, `rsc: true` — e
o de Angular fala Spartan UI, que é a mesma anatomia do outro lado da cerca. Quem abre qualquer um
dos três encontra `cva` para variante, `cn()` para compor classe, `data-slot` para estilizar por
fora e o CLI para trazer componente novo. Uma cabeça só para três bases vale mais que a contagem de
dependências que a decisão anterior protegia.

**O que a reversão não autorizou foi mudar a aparência.** Ver "O que a aparência manteve", abaixo:
a migração é de estrutura, e tela que mudou de visual é defeito, não melhoria.

#### O que passou a vir de fora

Componente entra pelo CLI (`npx shadcn@latest add <nome>`), nunca copiado à mão do site: assim o
`components.json` é a fonte e a próxima atualização é um comando.

| Nosso componente | O que veio do shadcn |
|---|---|
| `Botao` | `button` |
| `Campo` | `field` + `input` + `label` (o `field` importa `separator`, que veio junto) |
| `Bloco` | `alert` |
| `EsqueletoDeLinha` | `skeleton` |
| `Segmentado` | `toggle-group` + `toggle` |
| `FichasDeEscolha` | `radio-group` |
| `FolhaInferior` | `drawer` |

Dependências novas, cinco: `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react` e
`@base-ui/react`. As três primeiras são o `cn()` e o `cva`; o `lucide-react` aposenta os SVG
desenhados à mão que a versão anterior desta seção mandava escrever. O `@base-ui/react` é o único
primitivo de runtime: `button`, `input`, `radio-group`, `separator`, `toggle`, `toggle-group` e
`drawer` do `base-nova` importam dele — e **o CLI gera o import sem instalar o pacote**, então
`npm install @base-ui/react` é passo obrigatório de quem trouxer componente novo, ou o `tsc` acusa
`TS2307`.

A semântica de diálogo da folha inferior vem do `drawer` do base-ui. **Não existe `dialog.tsx` neste
projeto e não deve passar a existir**: o P6 e a §4.3 continuam valendo, a folha inferior é a única
superfície flutuante do produto e em ≥1024px ela continua sendo folha, não modal.

#### O que continuou nosso, e por quê

Esta é a parte que interessa a quem vier depois. Cada recusa aqui foi medida renderizando o
componente, não lida do código, e a medição está repetida no comentário de cabeçalho de cada
arquivo.

**`Monograma` — o `avatar` foi recusado.** Ele é `'use client'`, e os quatro chamadores são Server
Components (`/app/equipe` e `/app/clientes` são listas inteiras de servidor). Trazer uma fronteira de
cliente para desenhar duas letras é JS a mais sem nada em troca. E a aparência não serve: o avatar do
`base-nova` é redondo, tem 32px e desenha um anel de 1px no `::after` — seriam **seis decisões
desfeitas para sobrar um `<span>` com duas letras**. Quando a foto existir, aqui entra um `<img>` com
fallback, não uma dependência.

**`BuscaDeCliente` — o `command` foi trazido, medido e devolvido.** O `cmdk` é uma paleta de
comandos; a §5.10 é um campo de formulário com uma lista de links. Sete conflitos, todos
verificados na tela:

1. **o campo perde o nome acessível** — o `Command.Input` escreve `aria-labelledby` próprio,
   apontando para o rótulo escondido do `cmdk`, e isso vence o `<label for>` do `Campo`;
   `getByLabelText('Buscar cliente')` devolveu `null` nas duas montagens testadas;
2. **`type="search"` vira `type="text"`**, porque o `cmdk` escreve `type` depois do espalhamento;
3. **o papel vira `combobox`**, nunca `searchbox`;
4. **`CommandItem` acrescenta um `<CheckIcon>` depois do `children`**, com `ml-auto size-4`: uma
   coluna de 16px no fim de cada linha de 72px;
5. **`CommandList` mete um `<div cmdk-list-sizer>` entre a lista e os itens**, e o seletor
   `.lista > li` da §3.1 deixa de casar;
6. **o `cmdk` marca o primeiro resultado sozinho** e o `data-selected:bg-muted` do `base-nova` pinta
   de cinza uma linha que hoje não é pintada;
7. **custo de dependência**: o `cmdk` traz 16 pacotes `@radix-ui/*` — outra pilha de diálogo, portal
   e foco ao lado do `@base-ui/react` que já temos — e obriga a suíte inteira a ganhar
   `ResizeObserver` e `scrollIntoView` falsos.

Os itens 1 a 3 são contrato escrito da §5.10; 4 a 6 são mudança de tela.

**Toast — o `sonner` estava no plano e não entrou.** O **P5 desta mesma direção proíbe toast no
painel**, com todas as letras: feedback no lugar do dedo, e toast é para quem está olhando a tela
inteira. Aqui ninguém está. Além disso o retorno visual que o toast traria já existe duas vezes — a
linha troca de cor sob o polegar e o "Desfazer" da §5.7 fica 20s na própria linha. Um toast em cima
disso seria um terceiro "Desfazer" competindo com os outros dois.

**`TiraDeDias`, `GradeDeHorarios`, `BotaoDeConfirmacao` e `CabecalhoDePagina` — sem equivalente.** O
shadcn não tem nada que resolva o problema deles (o `alert-dialog`, o mais próximo do
`BotaoDeConfirmacao`, é um diálogo — e diálogo de confirmação é justamente o que o P4 troca por dois
toques no próprio botão). Continuam nossos, adaptados ao padrão da casa: `cva` para as variantes com
o `xxxVariants` exportado, `cn()` para juntar a classe interna com a `className` recebida,
`React.ComponentProps<…>` na base do tipo em vez de tipo fechado, `data-slot` em cada parte
estilizável, e nada de `forwardRef` — no React 19 `ref` é prop comum.

#### O que a aparência manteve

Nada da §3 foi negociado na migração:

- **os tokens da §3.1** continuam sendo a fonte do valor. Os nomes canônicos do shadcn
  (`--background`, `--primary`, `--destructive`, …) foram acrescentados **apontando para eles** — é
  tradução, não redecoração;
- **`--primary` é `--tinta`, não `--marca`.** A §3.4 é fechada: a marca aparece em cinco lugares e o
  botão primário não é um deles. Mapear `--primary` para `--marca` mudaria o produto inteiro;
- **o alvo de toque de 52px** (`--tap-md`) sobrevive a todo componente que chega com 36px de altura;
- **a cor da loja com L e croma travados** (`oklch(0.45 0.09 H)` / `oklch(0.82 0.09 H)`, croma
  0.09), e a proibição de a semântica girar com a marca.

#### As armadilhas, que custaram caro e vão custar de novo

Três, e todas mordem exatamente quem for mexer nisto depois:

1. **`@layer utilities` vence `@layer components` inteira**, independente de especificidade. As
   classes da §3.1 moram na camada de componente e o `base-nova` escreve utilitário; por isso a cor
   da borda de cada variante do `Botao` aparece repetida como utilitário, e por isso o véu da folha
   inferior é uma regra **fora de qualquer camada** no `globals.css` — CSS sem camada ganha de todas
   elas. O gancho é o `data-slot`, que é para isto: o CLI pode regerar o arquivo à vontade.
2. **O `tailwind-merge` não resolve tudo.** Ele trabalha por grupo de classe conhecido, então
   **propriedade arbitrária** (`[text-align:inherit]`) não entra no grupo `text-align` e as duas
   classes sobrevivem ao `cn()` — a briga vai para a ordem em que o Tailwind emite o CSS, onde as
   arbitrárias saem antes das nomeadas, e a sua perde. E ele **não conhece as chaves que a gente
   inventou no `@theme`**: `rounded-t-folha` contra `rounded-t-xl` passa batido pelo merge e o `xl`
   ganha por ordem. Nos dois casos a saída é valor arbitrário com `!`, ou a variante repetida
   inteira quando o seletor de atributo (`data-[swipe-direction=down]:…`) entra na conta.
3. **As variantes do `base-nova` quase nunca servem.** O `destructive` de lá é vazado
   (`bg-destructive/10`) e o nosso `perigo` é sólido; o `outline` pinta fundo e o nosso `secundario`
   é transparente. **O padrão da casa é `variant={null}` e `size={null}`**, desligando a paleta de
   propósito, com a aparência vindo das nossas classes por `cn()`. O que se aproveita do componente
   do CLI é a anatomia, o primitivo e o `data-slot` — não a pele.

#### Do bdsolutions continua vindo padrão, não código

O alinhamento é de convenção, não de import: aquele projeto tem o stack de server actions dele e
importar arquivo de lá segue impossível. O que se copia de verdade:

| O que | De onde | O que se aproveita |
|---|---|---|
| Camada base | `/home/franklin/dev/bdsolutions/src/app/globals.css:22-38` | `font: inherit` e `cursor: pointer` — literalmente as duas regras que faltam aqui; já reproduzidas na §3.1 |
| Tinta de estado por linha | `/home/franklin/dev/bdsolutions/src/components/domain/cockpit/cockpit-request-row.tsx:11-14` | o padrão `Record<estado, className>` aplicado no contêiner da linha; são 4 linhas, o resto do arquivo não serve |
| Cabeçalho de página | `/home/franklin/dev/bdsolutions/src/components/domain/page-header.tsx` | só a anatomia `eyebrow / título / descrição / ação à direita`, com o `flex-col → lg:flex-row` |
| Abas de navegação | `/home/franklin/dev/bdsolutions/src/components/domain/primary-nav-tabs.tsx` | só a anatomia de aba com borda inferior; a nossa é rolável e a de lá não |
| Busca global | `/home/franklin/dev/bdsolutions/src/components/domain/global-search.tsx` | comportamento de debounce e navegação por resultado, para a busca de cliente (§5.10) |
| `components.json` | `/home/franklin/dev/bdsolutions/components.json` | o estilo `base-nova` e os cinco campos que definem a casa; não divergir |

### 4.2 Já existe e só muda de pele (API idêntica)

- `src/components/erro-de-acao.tsx` — troca `color: crimson` por `.bloco .bloco--perigo
  .bloco--compacto`. É adotado nos 11 arquivos que hoje copiam o markup na mão.
- `src/components/panel-nav.tsx` — vira barra preta de 56px + nav rolável de 52px (§5.1).
- `src/app/app/error.tsx` e `src/app/error.tsx` — passam a usar `<Bloco tom="perigo">` + `<Botao>`.
- `src/app/app/servicos/toggle-button.tsx`, `equipe/toggle-staff-button.tsx` — viram `<Botao
  variante="secundario">` de 44px e 88px de largura mínima. Texto e API idênticos.
- `src/app/app/clientes/[customerId]/anonymize-button.tsx` — perde o `confirm()`, usa
  `<BotaoDeConfirmacao>`.
- `src/app/agendamento/[token]/cancel-form.tsx` — idem (§5.6). **Quebra e2e**, ver §6.4.
- `src/app/b/[slug]/booking-wizard.tsx` — perde o `useEffect` de catálogo e ganha o estado de dia e
  de contato (§5.4, §6.3).

### 4.3 Novos — API em TypeScript

Todos em `src/components/ui/` salvo onde indicado. Sem `'use client'` onde não houver estado.

```ts
// botao.tsx — server-safe
export type BotaoProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: 'primario' | 'secundario' | 'ok' | 'perigo' | 'perigo-vazado' | 'texto';
  tamanho?: 'md' | 'lg';        // 52px | 56px, padrão 'md'
  largura?: 'auto' | 'total';   // padrão 'auto'
  pendente?: boolean;           // desabilita e troca o rótulo pelo `rotuloPendente`
  rotuloPendente?: string;      // "Salvando…", "Confirmando…", "Agendando…"
};

// campo.tsx — server-safe. O <label> É o contêiner: rótulo implícito, sem htmlFor.
// Existe para que a altura de 52px e o aninhamento não dependam de ninguém lembrar.
export type CampoProps = {
  rotulo: string;                 // texto literal; há e2e casando por getByLabel
  dica?: string;
  erro?: string | null;           // renderiza <span role="alert"> abaixo e liga .campo--erro
  prefixo?: string;               // "R$" como elemento real de 48×52, nunca placeholder
  sufixo?: string;                // "min"
  children: React.ReactElement;   // o <input>/<select>/<textarea> cru
};

// bloco.tsx — server-safe
export type BlocoProps = {
  tom?: 'info' | 'ok' | 'perigo' | 'alerta' | 'agora';  // padrão 'info'
  papel?: 'alert' | 'status';                            // vira role=
  compacto?: boolean;
  acao?: React.ReactNode;                                // botão abaixo do texto
  children: React.ReactNode;
};

// cabecalho-de-pagina.tsx — server-safe. Anatomia do bdsolutions/page-header.tsx.
export type CabecalhoDePaginaProps = {
  titulo: string;
  descricao?: string;
  acao?: React.ReactNode;   // ≥768px alinha na mesma linha do <h1>
};

// folha-inferior.tsx — 'use client'. A ÚNICA superfície flutuante do produto.
export type FolhaInferiorProps = {
  aberta: boolean;
  titulo: string;                 // vira aria-labelledby
  aoFechar: () => void;
  rodape?: React.ReactNode;       // grudado dentro da folha, acima do safe-area
  guardaDeDescarte?: boolean;     // true ⇒ Escape com campo preenchido pede confirmação
  children: React.ReactNode;
};
```

`FolhaInferior` é o único componente com contrato de acessibilidade escrito por extenso, porque é o
gesto mais usado do painel:

`role="dialog"` + `aria-modal="true"` + `aria-labelledby` no `<h2>` do cabeçalho; foco vai para o
primeiro elemento focável na abertura e **volta para o disparador** no fechamento; `Escape` fecha
(com a guarda de descarte quando pedida); `Tab`/`Shift+Tab` circulam dentro da folha, com foco preso
por sentinelas focáveis no início e no fim; o resto do documento inerte enquanto aberta;
`overflow: hidden` no `<body>` com compensação de `scrollbar-gutter`; `max-height: 92dvh` com
`overflow-y: auto`; `padding-bottom: env(safe-area-inset-bottom)`. Em ≥1024px **continua sendo folha
inferior**, com `max-width: 560px` centrada — não inventar modal.

Desde 13/08/2026 esse contrato é entregue pelo `drawer` do shadcn sobre o `@base-ui/react` (§4.1), e
não mais por ~80 linhas de efeito escritas na mão. O que a lista acima exige continua valendo item
por item: os sete casos de `folha-inferior.test.tsx` são o teste de aceitação da troca.

```ts
// botao-de-confirmacao.tsx — 'use client'. Substitui todo confirm() do projeto.
export type BotaoDeConfirmacaoProps = {
  rotulo: string;            // "Cancelar meu horário"
  rotuloConfirmar: string;   // "Confirmar cancelamento"
  aoConfirmar: () => void;
  segundos?: number;         // padrão 4 — depois volta sozinho ao rótulo original
  pendente?: boolean;
  variante?: 'perigo' | 'secundario';
};

// segmentado.tsx — 'use client'
export type SegmentadoProps<T extends string> = {
  opcoes: { valor: T; rotulo: string }[];   // 2 ou 3, nunca mais
  valor: T;
  aoTrocar: (valor: T) => void;
  rotuloDoGrupo: string;                    // aria-label do <div role="group">
};

// fichas-de-escolha.tsx — 'use client'. Substitui <select> onde a troca é frequente.
export type FichaDeEscolha = { valor: string; rotulo: string; detalhe?: string; cor?: string };
export type FichasDeEscolhaProps = {
  rotuloDoGrupo: string;
  opcoes: FichaDeEscolha[];
  valor: string;
  aoTrocar: (valor: string) => void;
  nomeDoCampoOculto?: string;  // renderiza <input type="hidden"> — a server action não muda
  alturaMaxima?: number;       // acima de N opções rola por dentro (padrão 160px)
};

// tira-de-dias.tsx — 'use client'
export type DiaDaTira = {
  iso: string;                                    // YYYY-MM-DD
  rotulo: string;                                 // "HOJE" | "AMANHÃ" | "SEG"
  numero: string;                                 // "08"
  situacao: 'livre' | 'cheio' | 'desconhecido';   // pinta o ponto de 4px; vem de /days
};
export type TiraDeDiasProps = {
  dias: DiaDaTira[];          // 14 + a ficha "Outro dia"
  selecionado: string;
  aoSelecionar: (iso: string) => void;
  maxIso: string;             // limite do <input type="date"> de "Outro dia"
};

// grade-de-horarios.tsx — 'use client'
export type GradeDeHorariosProps = {
  slots: AvailabilitySlot[];  // como vêm da API: um por barbeiro por horário
  timeZone: string;
  barbeiroEscolhido: boolean; // false ⇒ deduplica por startAt e manda staffId undefined
  aoEscolher: (e: { startAt: string; staffId?: string; staffName?: string }) => void;
};

// cartao-da-agenda.tsx — 'use client'
export type CartaoDaAgendaProps = {
  item: AgendaItem;           // já existe em src/app/app/agenda/day-grid.tsx
  timeZone: string;
  corDoBarbeiro: string;      // string CSS pronta, de cores-de-barbeiro.ts
  agora: Date;                // injetado pelo pai; UM setInterval de 60s na lista inteira
};

// barra-de-data.tsx — 'use client'
export type BarraDeDataProps = {
  dataISO: string;
  hojeISO: string;
  contagens: { total: number; aAtender: number };
};

// proximos-livres.tsx — server-safe (§5.7, item 3)
export type ProximosLivresProps = {
  livres: { staffId: string; staffName: string; cor: string; horaISO: string | null }[];
  timeZone: string;
};

// monograma.tsx — server-safe
export type MonogramaProps = { nome: string; tamanho?: 40 | 56 };

// esqueleto-de-linha.tsx — server-safe
export type EsqueletoDeLinhaProps = { altura: number; quantidade: number };

// busca-de-cliente.tsx — 'use client' (§5.10)
export type BuscaDeClienteProps = { valorInicial?: string };
```

### 4.4 Funções novas fora de componente

```ts
// src/lib/format.ts — irmãs de formatDayLabel; a original tem teste e não muda
export function formatDayParts(isoDate: string, timeZone: string):
  { diaSemana: string; dia: string; mes: string };
export function formatDayLabelLong(isoDate: string, timeZone: string): string; // "sexta, 15 de agosto"

// src/lib/telefone.ts — sai de contact-step.tsx:6-11 e passa a ser compartilhada;
// hoje o campo do painel tem os atributos (type/inputMode/autoComplete) e nenhuma máscara
export function aplicarMascaraTelefone(valor: string): string;

// src/lib/cores-de-barbeiro.ts — recebe a lista inteira, nunca um id solto (§3.5)
export function coresDeBarbeiro(staff: { id: string; name: string }[]): Map<string, string>;

// src/app/app/agenda/day-grid.tsx — já existe, fica exatamente como está
export function buildDayList(...): AgendaItem[];

// src/app/app/agenda/proximos-livres.ts — puro e testável, dos mesmos appointments
export function calcularProximosLivres(
  appointments: AgendaAppointment[], staffList: AgendaStaff[], agora: Date,
): { staffId: string; horaISO: string | null }[];
```

---

## 5. As telas

Todas as medidas assumem 360px de largura: 328px úteis no público (padding 16), 336px no painel
(padding 12). **"Texto exato"** significa que há e2e casando por ele.

### 5.1 Base — casca pública e casca do painel

**Casca pública (`/b/[slug]`).** O `<header>` precisa do número da etapa, e a etapa vive no
`useState` do `BookingWizard`. **Decisão de arquitetura:** o `<h1>` e o cabeçalho mudam de dono e
passam a ser renderizados **dentro** do `BookingWizard`, que recebe `catalogo`, `nome`, `telefone`,
`whatsappConfigurado` e o objeto de estilo da marca como props do Server Component. Não há perda de
SEO — Client Component é renderizado no servidor e o `<h1>` sai no HTML inicial. `page.tsx` fica
sendo só busca de dados, `notFound()` e o caminho de "agenda ainda não disponível".

- `<header>` fixo, 56px, `--bg`, `border-bottom: 1px solid var(--linha)`.
  - esquerda: `<h1>` com o nome da loja, 18/24/700, `text-overflow: ellipsis` em uma linha;
  - direita: `2 de 4 · Barbeiro`, 14/20, `--tinta-2`. O jurado-cliente foi explícito: "formulário de
    tamanho desconhecido é o que me faz fechar a aba";
  - colado embaixo: trilho de 4px, fundo `--superficie-2`, preenchimento `--marca` a 25/50/75/100%,
    com `role="progressbar"` e `aria-valuenow`.
- Conteúdo: coluna de 480px máx., `padding: 0 16px 96px`.
- Desktop (≥768px): coluna de 560px centrada sobre `--superficie`, cartão em `--bg` com 1px
  `--linha` e raio 4. **Nenhum painel lateral, nenhuma arte de fundo** — a página pública é uma
  página de celular exibida num monitor, e assumir isso é mais honesto que inventar duas colunas.
- **Rodapé de identidade, novo e barato** (furo do jurado-cliente: "não consigo confirmar que é a
  barbearia certa antes de entregar meu telefone"): em todas as etapas, `padding-top: 32px`,
  hairline em cima, nome da loja em 14/20 `--tinta-2` e, se `barbershop.phone` existir, o botão de
  48px **"Falar no WhatsApp"**. O campo existe e nunca foi renderizado.

**Casca do painel (`/app`).** Hoje `panel-nav.tsx:18-29` é um flex row sem wrap com nome da loja + 5
links, passando de 550px: o painel inteiro rola de lado em 360px, em toda tela.

- barra superior de 56px **preenchida em `--tinta`**, nome da loja em `--acao-tinta` 16/24/700 à
  esquerda; à direita, dois botões de 44×44: busca (`aria-label="Buscar cliente"`, §5.10) e um com
  as iniciais do usuário, que abre a folha de conta com **"Sair"**. Hoje não existe logout nenhum no
  painel — nenhum `signOut` em `src/` (§6.1). O painel é visivelmente outra máquina que a pública.
- nav de 52px, `overflow-x: auto; white-space: nowrap; scrollbar-width: none`, com máscara de
  degradê de 24px na borda direita, cada item com `padding: 0 16px` e `border-bottom: 3px solid
  transparent`; ativo em `--tinta` com `aria-current="page"`, rolado para a vista na montagem
  (`startsWith`, que é o que `/app/equipe/[staffId]` exige).
- `<main>`: `padding: 12px`, `max-width: 1400px`. Desktop: `padding: 20px`, nav vira linha normal.

### 5.2 Pública — escolha de serviço

1. cabeçalho + trilho a 25%.
2. `<h2>` "Escolha o serviço", 22/28/700, margem 16px acima e 12px abaixo, com um traço de 32×3px em
   `--marca` 8px acima do texto. O `<h1>` continua sendo o nome da loja: a ordem de cabeçalho não
   quebra.
3. `.lista` sem gap e sem cartão. Cada `<li>` contém um `.lista-btn` de largura total, mín. 72px,
   `grid-template-columns: 1fr auto`, `column-gap: 12px`.
   - esquerda linha 1: nome do serviço, 18/24/600, `--tinta`;
   - esquerda linha 2: `formatDuration(durationMinutes)`, 14/20, **`--tinta-2`** → "30 min";
   - direita: `formatPrice(priceCents)`, 18/24/700, alinhado à direita. Quando o retorno é "Grátis",
     sai em 16/700 na cor `--ok`. `formatPrice` (`src/lib/format.ts:1`) é a implementação boa; **as
     três cópias locais de `formatarPreco`** (`day-grid.tsx:53`, `servicos/page.tsx:7`,
     `clientes/[customerId]/page.tsx:9`) são apagadas.
   - **Sem chevron.** A linha inteira ser botão, com `:active` em `--superficie-2`, é afordância
     suficiente; chevron cinza é enfeite.
   - Nome acessível resultante: "Corte 30 min R$ 40,00" — continua casando com `/corte/i` do e2e.
4. Rodapé de identidade (§5.1).

**Carregando: não existe mais.** O catálogo vem como prop do Server Component; a etapa 1 renderiza
já preenchida no HTML inicial. Este é o ganho de desempenho mais alto do documento e apaga o
esqueleto que as três direções desenharam para uma requisição que não devia existir.
**Vazio:** o servidor já devolve "A agenda desta barbearia ainda não está disponível. Volte em
breve." — vira `<Bloco>` com o botão de WhatsApp abaixo.
**Erro:** deixa de ser um estado desta tela (não há mais fetch). O erro de dados vira `error.tsx`.
**Conflito:** não se aplica.

**Desktop:** coluna de 560px, linha de 64px, coluna de preço fixa em 120px para os valores alinharem
verticalmente. Nada de grade de cartões: cartão lado a lado obriga a comparar em duas dimensões,
lista obriga a comparar em uma.

### 5.3 Pública — escolha de barbeiro

1. cabeçalho + trilho a 50%.
2. **Faixa de resumo** grudada sob o cabeçalho (`position: sticky; top: 60px`), 48px,
   `--superficie`, `border-bottom: 1px solid var(--linha)`: `Corte · 30 min · R$ 40,00`, 14/20 em
   `--tinta-2`. **Cada fragmento é um botão** com área de toque de 44px e `aria-label="Trocar
   serviço"` que volta àquela etapa. É isto que substitui o stepper clicável de 48px: mesma
   capacidade de voltar em um toque, custo zero de altura, porque a faixa já precisava existir. A
   migalha não-clicável da Clareza Calma perde aqui — trocar o serviço na etapa 3 custaria dois
   "Voltar" e o cliente perderia o dia que já tinha escolhido.
3. `<Botao variante="texto">` de 48px "Voltar", com "←" antes. Texto visível preservado.
4. `<h2>` "Escolha o barbeiro" + traço.
5. **Primeira opção, deliberadamente maior:** `<button>` de largura total, mín. 88px, fundo
   `--marca-suave`, borda 2px `--tinta`, aresta esquerda de 6px `--marca`, padding 16.
   - linha 1: **"Qualquer barbeiro"** 18/24/700 (texto exato — o e2e clica por esse nome);
   - linha 2: "Mais horários livres" 14/20 `--tinta-2`.
   É a opção mais rápida para o cliente e a melhor para a loja: `escolherBarbeiro`
   (`create-appointment.ts:22-41`) só faz balanceamento por carga quando ela é usada.
6. micro-rótulo 12/16/700 caixa-alta `--tinta-3`, 20px acima: "OU ESCOLHA QUEM VAI TE ATENDER".
7. `.lista` de barbeiros, mín. 72px, `grid-template-columns: 40px 1fr`, gap 12.
   - `<Monograma>`: quadrado 40×40, raio 4, `--superficie-2`, 1px `--linha`, iniciais do primeiro e
     do último nome em 16/700 `--tinta-2`;
   - nome 18/24/600.
   - **Sem foto.** `staff.photoUrl` existe (`staff.ts:11`) e é servido pelo catálogo, mas
     `staff-form.tsx` só tem "Nome do barbeiro": é `null` em 100% das linhas. Monograma é a resposta
     desta direção, não paliativo. O campo "Foto (URL)" no painel está em §6.1 como item opcional.

**Vazio:** quando nenhum barbeiro atende o serviço, o texto atual "Nenhum barbeiro disponível para
esse serviço no momento." vira `<Bloco>` logo abaixo do bloco "Qualquer barbeiro" — que **permanece
na tela**, porque o e2e depende dele — mais `<Botao variante="secundario">` "Escolher outro serviço"
e o WhatsApp do rodapé. **Carregando / erro / conflito:** não se aplicam.
**Desktop:** 560px, pilha idêntica, bloco "Qualquer" mantém 88px.

### 5.4 Pública — dia e horário (a difícil)

**Antes do layout, três correções de estado, todas obrigatórias:**

- **O dia sobe para o `BookingWizard`.** Hoje é `useState(dias[0])` em `slot-step.tsx:32` e o passo
  é desmontado quando o cliente vai para o contato. Sem isso, o retorno do 409 mostra a grade de
  hoje com o aviso falando de sexta.
- **Nome e telefone sobem para o `BookingWizard`.** Mesmo motivo: refazer os quatro campos porque o
  horário foi tomado é o momento em que o cliente fecha a aba.
- **`selecionarHorario` não grava `slot.staffId`** quando o cliente escolheu "Qualquer barbeiro"
  (`booking-wizard.tsx:71`). Hoje isso desliga sem querer o desempate por carga.

Layout:

1. cabeçalho + trilho a 75%.
2. faixa de resumo: `Corte · 30 min · R$ 40,00 · Qualquer barbeiro`, fragmentos clicáveis.
3. "Voltar" 48px. 4. `<h2>` "Escolha o horário" + traço.
5. **Tira de dias — grade, não rolagem.** Enxerto da "Vitrine": dois jurados apontaram que rolagem
   lateral com uma mão em pé é o gesto que mais se erra, e a faixa de hoje são 30 botões marcados só
   por negrito. `display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px`, duas linhas de 14
   dias, ficha de 44×60, raio 4, 1px `--linha`, grudada em `top: 60px` com fundo `--bg`.
   - linha 1: 12/16/700 caixa-alta `--tinta-3` — abreviação do dia da semana, ou "HOJE"/"AMANHÃ" nos
     dois primeiros;
   - linha 2: número do dia, 22/26/800 `--tinta`;
   - **ponto de 4px no rodapé da ficha**, alimentado por `GET …/availability/days` (§6.2):
     `--linha-suave` = ainda não sabemos, `--tinta-3` = tem vaga, vazio + número em `--tinta-3` =
     dia cheio (com `aria-disabled` **não** aplicado — o cliente ainda pode abrir e ver por quê).
     Enquanto o endpoint não existir, todos ficam em "desconhecido" e o ponto não aparece: **o chip
     não finge saber**;
   - selecionado (`aria-pressed="true"`, que já existe em `slot-step.tsx:64`): fundo `--marca`, texto
     `--sobre-marca`, borda 2px `--tinta`;
   - a 15ª ficha ocupa as 7 colunas na terceira linha, 48px, 1px tracejado, e diz **"Outro dia (até 7
     de set)"** — a data-limite calculada de `maxAdvanceDays`, não um retângulo tracejado mudo. Abre
     `<input type="date">` nativo com `min` = hoje e `max` = hoje+`maxAdvanceDays`, agora legível no
     escuro por causa do `color-scheme`.
6. linha de contexto de 20px, 12/16/700 caixa-alta `--tinta-3`: "12 HORÁRIOS LIVRES".
7. **Grade de horários.** `grid-template-columns: repeat(3, 1fr); gap: 8px` → ficha de 104×64 em
   360px. Cada ficha é o `<button data-testid="slot">` — **o atributo tem de continuar**, é o único
   acoplamento estrutural dos e2e — e ganha `data-hora="14:30"` (§6.4).
   - hora em 22/26/800 `--tinta`;
   - **Deduplicação, a correção mais importante do fluxo público.** `getAvailability` empilha um slot
     **por barbeiro por horário** (o loop `for (const barbeiro of equipe)` em
     `availability-service.ts`); com três barbeiros livres às 09:00 a tela de hoje desenha "09:00 —
     João", "09:00 — Pedro", "09:00 — Ana". Com `barbeiroEscolhido === false`, a grade agrupa por
     `startAt`, mostra a hora uma vez, escreve "3 livres" na segunda linha em 12/16 `--tinta-3` e
     envia `staffId: undefined`. Com barbeiro escolhido, a ficha é só a hora.
   - As fichas vão em três blocos com cabeçalho de 32px, 12/16/700 caixa-alta `--tinta-3`,
     `border-bottom: 1px solid var(--linha)`: **MANHÃ** (<12:00), **TARDE** (12:00–17:59), **NOITE**
     (≥18:00). Bloco sem horário some inteiro. É o que responde "quando este dia está cheio".
8. Não há barra fixa: tocar a ficha avança.

**Carregando:** a tira continua 100% interativa; a área da grade mostra `.barra-busca` sob a linha de
contexto + seis `.esqueleto` de 64px na medida final, para nada saltar; "Carregando horários…"
continua em 14/20 com `role="status"`.
**Vazio:** `<Bloco>` com "Nenhum horário livre neste dia." e três ações empilhadas com 8px:
`<Botao>` de 48px **"Ver o próximo dia com vaga"** (calculado da resposta de `/days`, sem ida nova
ao servidor), `<Botao variante="secundario">` "Ir para amanhã" e, por último, o link de 48px **"Falar
no WhatsApp"**. O jurado-cliente: "não quero amanhã, quero sexta, e não tenho como perguntar se
sobra alguma coisa". Enquanto `/days` não existir, só os dois últimos.
**Erro:** `<Bloco tom="perigo">` substituindo a grade, com o "Tentar de novo" existente em
secundário de 48px; a tira continua usável.
**Conflito (409):** `<Bloco tom="alerta" papel="alert">` de largura total, preso imediatamente acima
da grade, com a mensagem do servidor em 16/24 e `scrollIntoView({ block: 'start' })` para não nascer
fora da tela. A tira reabre **no mesmo dia que o cliente tinha escolhido** e a grade se refaz. A
ficha antes escolhida **não** recebe marcação de "tomada": não temos como garantir esse estado, e
mentir sobre a grade é pior que omitir. O aviso só sai quando ele tocar outra ficha.

**Desktop:** coluna de 560px, tira em 7×2 do mesmo jeito (já não rola), grade em 4 colunas com ficha
de 56px. Blocos MANHÃ/TARDE/NOITE continuam.

### 5.5 Pública — contato e confirmação

**Contato.** 1. cabeçalho + trilho a 100%. 2. "Voltar" 48px. 3. `<h2>` "Seus dados".

4. **Bloco do que vai ser marcado** — aqui vira bloco, não faixa, porque é o ponto de compromisso.
   `<Bloco>` em `--superficie` com aresta esquerda de 4px `--marca`, padding 12px 14px, e no canto
   superior direito um `<Botao variante="texto">` "Trocar" com área de 44×44 que volta à etapa de
   horário.
   - linha 1: "Sex, 8 de ago · **14:30**" com a hora em 28/32/800 — é a única dúvida real desta tela
     ("é isso mesmo que eu marquei?") e ela se responde sem uma tela extra de confirmação;
   - linha 2: "Corte · 30 min", 16/24 `--tinta-2`;
   - linha 3: "com João" ou, quando o cliente escolheu qualquer um, **"com o primeiro barbeiro
     livre"** — mitigação honesta da deduplicação: quem viu "3 livres" sabe que o nome sai no fim;
   - linha 4: preço 18/24/700 alinhado à direita.
   **Exige** passar `serviceName`, `staffName`, `priceCents`, `durationMinutes` como props do
   `ContactStep` (hoje ele só recebe `serviceId`/`staffId`/`startAt`; todos os valores já existem no
   catálogo e em `escolha`) e o helper `formatDayLabelLong`.
5. Formulário com `gap: 16px`, dois `<Campo>`: **"Seu nome"** (`autoComplete="name"`, `minLength=2`,
   `maxLength=80`) e **"Telefone"** (`type="tel"`, `inputMode="tel"`, `autoComplete="tel"`,
   `aplicarMascaraTelefone`, placeholder "(00) 00000-0000"). Rótulos com o texto exato de hoje e
   **label implícito por aninhamento** — é disso que `getByLabel('Seu nome')` e
   `getByLabel('Telefone')` dependem, e é a única coisa que o app acerta hoje em ~30 campos. Campo de
   52px, 16px de tipo. Erro de campo: borda 2px `--perigo` + mensagem 14/20/700 `--perigo` com
   `role="alert"`.
6. **Pré-preenchimento do recorrente.** Nome e telefone confirmados com sucesso ficam em
   `localStorage` sob `barbearia:contato`. Ao voltar, os campos vêm preenchidos e aparece um botão de
   texto de 44px "Não é você? Limpar". `autoComplete` do navegador falha na WebView do WhatsApp e do
   Instagram, que é justamente de onde o cliente vem.
7. Nota 14/20 `--tinta-2` acima da barra: **"Confirmação e lembrete no WhatsApp"** quando o remetente
   estiver configurado (`src/notifications/meta-whatsapp.sender.ts` existe; a flag vem do servidor
   como prop booleana), senão "Só usamos seu telefone para confirmar e avisar do horário.". Dizer o
   que acontece depois de confirmar é o argumento mais barato contra o abandono no último toque.
8. **Barra fixa inferior:** `position: sticky; bottom: 0`, largura sangrada, `--bg`, `border-top: 1px
   solid var(--linha)`, `--sombra-barra`, `padding: 12px 16px + env(safe-area-inset-bottom)`; dentro,
   `<Botao tamanho="lg" largura="total">` com o texto exato **"Confirmar horário"**; pendente vira
   `disabled` com rótulo "Confirmando…".
9. Erro de envio (`role="alert"`) como `<Bloco tom="perigo">` no fluxo do documento, imediatamente
   acima da barra, **sem limpar campo nenhum**.

**Confirmação.** 1. cabeçalho sem contador, trilho 100% em `--ok`.
2. `<Bloco tom="ok">` com aresta de 4px e padding 16: `<h2>` **"Horário confirmado"** 28/32/800 na
   cor `--ok` (texto exato — o e2e casa `/horário confirmado/i`).
3. Bloco de detalhe em `--bg` com 1px `--linha`: data 16/24 `--tinta-2`, hora 34/38/800 `--tinta`,
   "com João" 18/24/600, serviço e preço 16/24 `--tinta-2`.
4. Ações empilhadas, gap 12, em ordem de utilidade real:
   - `<Botao tamanho="lg">` **"Ver ou cancelar meu horário"** — é um `<a href={manageUrl}>`
     estilizado como botão, com `text-decoration: none`; o texto é exato porque o e2e o pega por
     papel de link;
   - secundário de 48px "Adicionar à agenda do celular" (§6.2 — **não é grátis**: `.ics` por `data:`
     URI não abre confiável no Safari do iOS, precisa de rota);
   - secundário de 48px **"Falar no WhatsApp"**, só se houver telefone.
5. Nota 14/20 `--tinta-2`: com WhatsApp configurado, "Você vai receber a confirmação no WhatsApp.";
   sem ele, "Guarde este link. Ele é a sua única forma de cancelar sozinho." — a frase pessimista só
   aparece quando é verdade.

**Desktop:** coluna de 560px. A barra deixa de ser fixa e vira bloco no fim do formulário, botão com
`width: auto; min-width: 240px` alinhado à direita. Campos continuam de largura total: formulário de
dois campos em duas colunas é teatro de layout. Na confirmação as três ações continuam empilhadas.

**Conflito nesta tela: não acontece.** O 409 devolve o cliente à etapa de horário e é lá que aparece.
Repetir nas duas telas confunde sobre onde a decisão precisa ser refeita.

### 5.6 Pública — gerenciar/cancelar, não encontrado, login e cadastro

**`/agendamento/[token]`** — mesma casca, sem trilho. `<h1>` "Seu horário na {loja}". Bloco de
detalhe idêntico ao da confirmação. Abaixo, secundário de 48px "Marcar outro horário" e, separado por
um fio de 1px e 16px de folga, o `<BotaoDeConfirmacao>` variante perigo com rótulo **"Cancelar meu
horário"** (texto exato) e `rotuloConfirmar` "Confirmar cancelamento". Some o `confirm()` de
`cancel-form.tsx:19`. Estado cancelado: `<Bloco>` em `--superficie` com "Agendamento cancelado."
(texto exato) e `line-through` no bloco de detalhe. **A hora tem de continuar visível como texto** —
o e2e casa `getByText(horarioEscolhido)`.

**`src/app/not-found.tsx` — não existe e precisa existir.** Há 5 chamadas de `notFound()` e nenhum
arquivo: slug errado ou token expirado hoje mostra o 404 embutido do Next, **em inglês**, para o
cliente da barbearia — que clicou num link do WhatsApp e vai achar que é golpe. Mesma casca, `<h1>`
"Página não encontrada", uma linha explicando que o link pode ter expirado, e um secundário de 48px
"Ir para a página inicial".

**`/login` e `/signup`** — casca mínima, sem cabeçalho de assistente: coluna de 360px centrada,
`<h1>` 22/28/700, dois ou três `<Campo>` de 52px, `<Botao tamanho="lg" largura="total">`, erro em
`<Bloco tom="perigo">` acima do botão, e um link de texto para a outra tela. São as duas telas mais
simples do produto e não merecem decisão nova; existem aqui só para ninguém inventar uma terceira
casca.

### 5.7 Painel — agenda do dia (a tela principal)

**Formato: lista única por horário, em toda largura, na Fase 1.** Ver §5.11 para o porquê e para o
que vem depois.

De cima para baixo em 360px:

1. barra superior 56px + nav 52px (§5.1).
2. **Barra de data**, grudada em `top: 0`, **64px**, `--bg`, `border-bottom: 1px solid var(--linha)`.
   - linha A, 44px, `grid-template-columns: 44px 1fr 44px 44px; gap: 8px`: "‹" com
     `aria-label="Ontem"`, `<input type="date" name="data">` dentro do `<form method="get">` que já
     existe, "Ir" de 44×44 e "›" com `aria-label="Amanhã"`. Os nomes acessíveis são os mesmos de
     hoje. As setas viram `<Link>` do Next em vez dos `<a href>` crus de `agenda/page.tsx:40-42`:
     recarregar a página inteira na tela mais usada muda a sensação de velocidade.
   - linha B, 20px, 12/16/700 caixa-alta `--tinta-3`: **"8 NO DIA · 3 A ATENDER"**. Nunca "HOJE" — a
     barra navega para qualquer dia e o rótulo mentiria. **Esta legenda substitui a faixa de quatro
     blocos de resumo**: 64px da primeira dobra para um filtro que ninguém usa com cliente esperando
     é enfeite que custa rolagem. Filtro por estado fica para a Fase 2.
3. **Linha "próximo livre"**, 32px, 14/20, só quando o dia mostrado é hoje e há mais de um barbeiro
   ativo: `João 10:30 · Pedro 11:00 · Ana livre` — cada nome precedido de um quadrado de 8px na cor
   do barbeiro (§3.5). Calculada por `calcularProximosLivres` dos mesmos `appointments` que a página
   já carrega, zero consulta nova. **É a resposta de balcão para "dá pra encaixar às 10h?" sem quadro
   de colunas nenhum**, e é o que compra o direito de adiar as colunas.
4. quando o dia mostrado não é hoje, uma linha de 40px com secundário de largura total "Voltar para
   hoje".
5. **Lista.** `<ol class="lista">`, agrupada por hora; cada grupo precedido de um sub-cabeçalho de
   28px grudado em `top: 64px`, fundo `--superficie`, hora em 14/700 `--tinta-3`.
6. **Rolagem inicial até agora.** Quando o dia mostrado é hoje, a lista rola sozinha
   (`scrollIntoView({ block: 'center' })`) até a linha do agora, na montagem. O jurado-balcão: "às
   15h eu abro o app e caio nas 8h; tenho que rolar sete telas". Custa uma linha.
7. **O cartão**, o objeto mais importante do produto. `<li>` com `border-bottom: 1px solid
   var(--linha)`, `padding: 10px 12px`, mín. 76px, `grid-template-columns: 64px 1fr; column-gap:
   12px`, e **`border-left: 4px solid <cor do barbeiro>`** (§3.5).
   - coluna esquerda: hora de início 20/24/800 `--tinta`; abaixo, hora de fim 13/16 `--tinta-3`;
   - direita linha 1: nome do cliente 17/22/700, truncado em uma linha; empurrada à direita, a
     etiqueta **"ENCAIXE"** 11/14/700 caixa-alta em `--alerta-bg` com 1px `--alerta` quando `origin
     === 'PANEL'`. (A hachura diagonal da "Vitrine" é bonita e ilegível de braço esticado com a tela
     suja, e ela carregava três significados diferentes; a palavra fica.)
   - direita linha 2: "Corte · R$ 40,00 · **João**" em 14/20 `--tinta-2`, com o nome do barbeiro em
     `--tinta` peso 700. A cor da aresta é reforço, nunca substituto;
   - direita linha 3: telefone como `<a href="tel:">` 14/20 sublinhado, com 44px de área de toque. No
     painel é `tel:` mesmo — o barbeiro liga.
   - **Tinta de estado na linha inteira, nunca opacidade:** `BOOKED` = `--bg`; `DONE` = `--ok-bg`;
     `NO_SHOW` = `--perigo-bg`; `CANCELED` = `--superficie`, nome em `line-through`, texto
     `--tinta-3`. Nos três estados finais a aresta de 4px troca a cor do barbeiro pela cor do estado
     — estado ganha do barbeiro, porque é o que muda.
   - **Agora:** a linha cujo intervalo contém o instante atual ganha fundo `--agora-bg` e hora em
     `--agora`; entre as linhas, na posição do relógio, um fio de 2px `--agora` com um ponto de 8px na
     ponta esquerda. Um único `setInterval` de 60s na lista alimenta todos os cartões pela prop
     `agora`.
8. **Ações**, só quando `status === 'BOOKED'`. `margin-top: 8px`, gap 8px.
   - **"Compareceu"**, 52px, preenchido em `--ok`, texto branco, 16/700 — o caso de 90%, um toque, e
     a linha muda de cor debaixo do polegar;
   - **"Não veio"**, 52px, vazado com 2px `--perigo` e texto `--perigo`, **só renderizado quando
     `agora ≥ startAt + 10 min`**. Antes disso o botão não existe: um no-show antes da hora é
     impossível, e o alvo que some é o alvo que ninguém erra. Depois da hora, `grid-template-columns:
     1fr 1fr 44px`; antes, `1fr 44px`;
   - "⋯" de 44×52 com `aria-label="Mais ações"`, abrindo a folha com "Ligar para o cliente", "Copiar
     telefone" e, separado por um fio de 1px e 16px de folga, **"Cancelar"** em
     `<BotaoDeConfirmacao>`.
9. **Desfazer.** Depois de qualquer mudança de status, a linha mostra por 20s, no lugar das ações, um
   secundário de 44px **"Desfazer"**. Passado o prazo, `DONE` e `NO_SHOW` continuam com o "⋯", que
   agora oferece **"Reabrir (voltar para agendado)"**. `CANCELED` **não** oferece reabrir — o horário
   pode ter sido revendido; oferece "Reagendar", que abre a folha de encaixe já preenchida com
   cliente, serviço e barbeiro. Precisa de `reopenAppointmentAction` (§6.2).
10. **Barra fixa inferior**, 64px, `--sombra-barra`: `<Botao largura="total">` de 52px, **"Encaixe"**.

**Carregando:** criar `src/app/app/agenda/loading.tsx` (o projeto **não tem nenhum** `loading.tsx`)
desenhando a barra de data e seis `.esqueleto` de 76px. Sem spinner.
**Vazio:** "Nenhum agendamento neste dia." (texto exato) num `<Bloco>` de padding 20px, centralizado,
com "Use o encaixe para marcar quem chegou no balcão." em 14/20 `--tinta-2` e `<Botao>` de 52px
"Encaixe" abaixo — estado vazio existe para oferecer a próxima ação.
**Erro:** `src/app/app/error.tsx` já existe e passa a usar `<Bloco tom="perigo">` + `<Botao>` de 52px
"Tentar de novo" chamando `reset()`.
**Conflito:** a lista não dá 409, mas a ação de status pode falhar (dois atendentes na mesma linha) —
`ErroDeAcao` dentro da própria linha, compacto. Sucesso não gera aviso nenhum.

**Desktop (≥768px):** mesma lista, `max-width: 900px`, cartão de 72px, ações alinhadas à direita na
mesma linha do nome. Barra de data em uma linha só com a legenda de contagem e a linha "próximo
livre" à direita. **Sem quadro de colunas na Fase 1.**

### 5.8 Painel — encaixe / walk-in

Deixa de ser um formulário de oito controles em `flexWrap` pendurado no fim da agenda
(`manual-booking-form.tsx:88`) e vira `<FolhaInferior>` aberta pelo botão fixo "Encaixe", com
`guardaDeDescarte`.

Cabeçalho de 48px com "Encaixe" 18/700 e "Fechar" de 48×48. Corpo com padding 16.

1. **Segmentado de dois modos**, 52px, `1fr 1fr`, ativo em `--tinta`: **"Agora" | "Marcar hora"**.
   Padrão: **"Agora"**. É a melhor ideia da rodada inteira: o balcão tem dois trabalhos diferentes —
   o cara já está na cadeira, ou alguém ligou — e forçar os dois pelo mesmo formulário é o que faz o
   formulário atual ter oito campos. **Não** viola o comentário de `manual-booking-form.tsx:33` ("o
   encaixe é escolha consciente do atendente"): a escolha virou um botão rotulado em vez de um
   checkbox perdido no meio da linha, e o aviso de fora-da-grade continua aparecendo.
2. **Barbeiro em fichas**, não `<select>`: 48px de altura, `flex: 1 1 auto; min-width: 96px` (três
   barbeiros cabem numa linha a 360px, ~104px cada), quadrado de 8px na cor do barbeiro antes do
   nome, ativa com 2px `--tinta` e fundo `--superficie-2`; um `<input type="hidden" name="staffId">`
   carrega o valor, então a server action não muda uma linha.
   - **Primeira ficha: "Primeiro que vagar"**, que envia `staffId=""`. O servidor já sabe desempatar
     por carga (`escolherBarbeiro` + `staff-load.ts`) e o painel joga isso fora hoje. Exige mudar
     `createManualAppointmentAction:56`, que rejeita `staffId` não-UUID (§6.2).
3. **Serviço nas mesmas fichas**, com nome e duração; passando de seis, `max-height: 160px;
   overflow-y: auto`.
4. **Data:** oculta no modo "Agora" (`<input type="hidden" name="date">` com o dia da agenda, que a
   action já exige); `<Campo>` de 52px no modo "Marcar hora".
5. **Horário.**
   - modo "Agora": mostrador de 52px com a hora atual arredondada **para baixo** em 5 min, 22/700,
     ladeado por dois botões de 48×48 "−5" e "+5"; escreve em `horaLivre`. Logo abaixo, o aviso
     existente com `role="status"` em `<Bloco tom="alerta">` 14/20, com o texto exato de
     `avisoDeHorarioLivre` ("14:35 está fora da grade normal — vai entrar como encaixe.");
   - modo "Marcar hora": grade de horários livres em fichas de 56px em três colunas, alimentada pelo
     mesmo `carregarHorarios(..., origem: 'PANEL')` de hoje, mais um botão `aria-pressed` de 52px
     "Fora da grade" que troca a grade por `<input type="time" step={300}>`;
   - a semântica atual — `startAt` do select contra `horaLivre` digitado, resolvida por
     `resolverInicioDoEncaixe` — fica **idêntica**; só muda a pele.
6. **Cliente, por último:** "Nome" e "Telefone" em `<Campo>` de 52px, e o telefone passa a usar a
   **mesma máscara da página pública** (hoje o campo do painel tem os atributos e nenhuma máscara).
   A ordem é deliberada: trava-se a cadeira primeiro, o nome o cliente soletra enquanto o atendente
   digita.
7. **Rodapé grudado da folha:** `<Botao tamanho="lg" largura="total">` **"Agendar"** (texto exato;
   pendente "Agendando…"), com `state.erro` em `<Bloco tom="perigo">` logo acima.

**Carregando a grade:** `.barra-busca` sob o rótulo "Horário" + seis `.esqueleto` de 56px.
**Vazio:** `<Bloco>` com 'Nenhum horário livre neste dia.' e um botão que troca o segmentado para
"Agora" ali mesmo — é para isso que o modo existe.
**Erro da grade:** `<Bloco tom="perigo">`, mantendo `role="alert"` e o "Tentar de novo" ligado ao
`recarga` que já existe.
**Conflito de horário tomado:** `state.erro` em `<Bloco tom="perigo">` acima do rodapé, a grade
recarrega sozinha e a ficha tomada some — **e a folha NÃO fecha**: nome, telefone, serviço e barbeiro
continuam preenchidos. É a diferença entre reencaixar em 3 segundos e refazer tudo com o cliente
olhando para a cara do atendente. (Idem para o Escape com campo preenchido: `guardaDeDescarte`.)
**Sucesso:** a folha **fecha**, a nova linha aparece na agenda com fundo `--agora-bg` por 2s e recebe
`scrollIntoView`. "Encaixe agendado." vira uma região `role="status"` visualmente oculta e permanente
na casca do painel, para o leitor de tela ouvir mesmo com a folha fechada.

**Desktop:** mesmo conteúdo, mesma folha inferior, `max-width: 560px` centrada. Não inventar painel
lateral enquanto não existir quadro de colunas para empurrar.

### 5.9 Painel — cadastros (o padrão que serve cinco telas)

Vale para Serviços, Equipe, detalhe do barbeiro, Expediente/Bloqueios e Configurações. Descrito sobre
Serviços.

1. `<CabecalhoDePagina titulo="Serviços" descricao="O que a barbearia faz, quanto dura e quanto
   custa." />`, com `border-bottom: 1px solid var(--linha)` e 12px de respiro. Resolve de uma vez as
   cinco telas que hoje são um `<h1>` solto e as três convenções de casca divergentes.
2. **Formulário recolhido** num secundário de 52px e largura total "Adicionar serviço". Expandido,
   vira bloco `--superficie` com 1px `--linha`, padding 12, coluna com `gap: 12px`. Bloco inline e
   **não** folha: esta tela é visitada uma vez por mês e não merece a cerimônia da folha, que fica
   reservada ao encaixe e às ações da agenda.
   - "Nome" (`<Campo>`, 52px);
   - "Duração (min)" com `type="number"` e `inputMode="numeric"`, precedido de três fichas de 48px
     "15" / "30" / "45" que escrevem no campo;
   - "Preço" com `inputMode="decimal"`, placeholder "40,00", com o `prefixo="R$"` do `<Campo>` — 48×52
     em `--superficie-2` com 1px `--linha`. Prefixo é elemento, não placeholder;
   - `state.erro` em `<Bloco tom="perigo">` acima do envio; submit de 52px com o texto exato
     "Adicionar serviço" e "Salvando…" no pendente; abaixo, botão de texto de 48px **"Fechar"** —
     nunca "Cancelar", a palavra já significa outra coisa neste produto.
3. **A `<table>` de cinco colunas morre** (`servicos/page.tsx:19`, `equipe/page.tsx:50`,
   `clientes/page.tsx:23`). No lugar, `.lista` com `<li>` de mín. 72px, padding 12,
   `grid-template-columns: 1fr auto`.
   - linha 1: nome 17/22/700; se inativo, nome em `--tinta-3` + etiqueta "INATIVO" 11/14/700 em
     `--superficie-2` com 1px `--linha`, e fundo da linha em `--superficie`. Nunca opacidade;
   - linha 2: "30 min · R$ 40,00" em 14/20 `--tinta-2`, via `formatPrice`;
   - direita: o `ToggleButton` existente com o texto que já tem, agora secundário de 44px e 88px de
     largura mínima; `ErroDeAcao` logo abaixo dele.
4. **Vazio:** "Nenhum serviço cadastrado ainda." (texto exato) num `<Bloco>` + "Comece pelo corte
   simples: nome, duração e preço." + o botão de expandir.
5. **Carregando:** é Server Component; o `loading.tsx` da rota desenha o cabeçalho e quatro
   `.esqueleto` de 72px. **Erro:** `<Bloco tom="perigo">` inline vindo do `state.erro`.
   **Conflito:** dois donos editando o mesmo registro devolvem o erro da action no bloco, com o
   formulário intacto e nada apagado.

**Desktop (≥768px):** o cabeçalho põe "Adicionar serviço" alinhado à direita na mesma linha do
`<h1>`. A lista, com máx. 720px, vira `grid-template-columns: 1fr 120px 120px 120px` com duração,
preço e ação em colunas próprias alinhadas à direita, precedida de uma linha de 32px com os
micro-rótulos NOME / DURAÇÃO / PREÇO em 12/16/700 caixa-alta `--tinta-3`. Parece tabela sem ser
tabela — e por isso nunca cai na armadilha de `min-width` com rolagem horizontal.

**Nota para o expediente:** são 6 inputs de hora por linha em 360px. Empilhar em duas linhas de 3 com
`grid-template-columns: repeat(3, 1fr)` e manter `rotuloDoCampoDeHora` (`working-hours-form.tsx:20-34`),
que já resolve nome acessível único — a mesma solução precisa ser replicada em
`equipe/[staffId]/services-form.tsx`, onde "Duração própria (min)" se repete uma vez por serviço.

### 5.10 Painel — busca de cliente (tela nova)

Furo apontado pelo jurado-balcão e sem resposta em nenhuma das três direções: toca o telefone, "aqui
é o Marcos, que horas eu marquei?", e hoje só dá para varrer a agenda um dia por vez com o cliente
esperando. Acontece várias vezes por dia. O dado já está em `appointment` + `customer`; é uma
consulta.

- Botão de busca de 44×44 na barra superior do painel, sempre visível, abre `<FolhaInferior>` com um
  `<Campo>` de 52px, `type="search"`, `inputMode="search"`, rótulo "Buscar cliente", foco automático.
- Debounce de 250ms, mínimo 2 caracteres, casa por nome (sem acento, sem caixa) **ou** por dígitos do
  telefone. Chama `GET /api/panel/clientes?q=` (§6.2).
- Resultado: `.lista` de linhas de 72px — nome 17/22/700, telefone 14/20 `--tinta-2`, e à direita o
  **próximo agendamento** em 14/20 (`"sáb, 9 de ago · 14:30"`) ou "sem horário marcado" em
  `--tinta-3`. Tocar a linha navega para `/app/clientes/[id]`; tocar o próximo agendamento navega para
  `/app/agenda?data=…` com a linha realçada por 2s em `--agora-bg`.
- **Vazio:** "Nenhum cliente com esse nome ou telefone." **Carregando:** `.barra-busca` + três
  esqueletos de 72px. **Erro:** `<Bloco tom="perigo">` com "Tentar de novo".

### 5.11 Colunas por barbeiro — a divergência, resolvida

**Decisão: lista única por horário é a agenda do dia, em toda largura, na Fase 1. O quadro de colunas
entra na Fase 2 como MODO escolhido pelo usuário, nunca como breakpoint.**

Os três jurados convergiram no diagnóstico e divergiram no prazo. O jurado-balcão quer o modo já, com
uma janela de 3 horas no celular; os outros dois querem colunas só no desktop, e o
jurado-implementador diz "lista, ponto — colunas na segunda leva". Ganhou a leitura de custo, por
três motivos somados:

1. **O usuário real quase nunca está no desktop.** O cenário declarado é celular e tablet no balcão,
   e tablet em retrato tem 768–820px. Cortar colunas em 900px (Vitrine) joga o tablet do balcão na
   lista e o dono jura que "sumiram as colunas"; cortar em 1024px significa que a peça mais cara do
   redesenho quase nunca aparece.
2. **O quadro não é CSS, é código novo com armadilha.** Posicionamento absoluto por minuto; a
   constraint de exclusão ignora `CANCELED`, então um cancelado sobrepõe o substituto; o encaixe com
   `horaLivre` começa em minuto arbitrário, fora da malha; fora-de-expediente exige carregar
   `working_hours`, que a página hoje não busca; e a linha do agora depende do fuso da loja com
   horário de verão. É a única parte capaz de ficar sutilmente errada sem quebrar teste nenhum.
3. **O que as colunas entregam de verdade dá para entregar por dois centavos.** "Quem está livre às
   10h" vira a linha "próximo livre" (§5.7, item 3) mais a aresta de cor por barbeiro (§3.5). Isso
   responde a pergunta do balcão hoje, na lista, sem quadro nenhum.

O comentário de `day-grid.tsx:29-36` **fica** — está certo do jeito que foi escrito — mas ganha um
parágrafo dizendo que a lista é a agenda em toda largura e que o quadro é uma segunda vista opcional,
com as regras abaixo já fechadas.

**Quando o quadro for feito, estas cinco decisões já estão tomadas:**

1. **Formato é escolha do usuário, não do viewport:** segmentado "Lista | Colunas" na barra de data,
   com `aria-pressed`, persistido em `localStorage` sob `barbearia:agenda-formato`. A largura só
   decide o **padrão inicial** (≥1024px → Colunas; abaixo → Lista).
2. **No celular, o modo Colunas mostra uma janela de 3 horas a partir de agora**, não o dia inteiro —
   uma coluna por barbeiro ativo (3 barbeiros cabem a ~104px em 328px), com "‹ ›" andando de hora em
   hora. Três horas cabem na vertical sem rolar e é literalmente a resposta de "onde cabe esse cara
   hoje". É o recorte que nenhuma das três propostas considerou, e é o que torna o modo útil no
   aparelho em que o dono realmente está.
3. **Sobreposição divide a largura:** blocos que se cruzam na mesma coluna dividem em partes iguais
   (2 → 50%, 3+ → 33%), o de início mais cedo à esquerda, empate desempatado por `id`. Nada de bloco
   por cima de bloco — senão o encaixe fora da grade, que é a feature que este redesenho facilita,
   faz os agendamentos criados pela própria barbearia parecerem quebrados.
4. **Cancelados não entram no quadro.** Vão para uma tira recolhida "2 cancelados" no pé da coluna.
5. **Geometria e dados:** `grid-template-columns: 64px repeat(N, minmax(220px, 1fr))`, `--slot-px:
   28px` por slot (30 min → 56px/hora, dez horas → 560px), `top = (minutoDeInicio − minutoDeAbertura)
   / slotMinutes × 28px`, `height = duracao / slotMinutes × 28 − 2`; abaixo de 40px o bloco colapsa
   para uma linha ("14:15 Marcos"). Fonte: `buildDayColumns(appointments, staffList, janela)`, pura e
   testável ao lado de `buildDayList`, **mais** `listWorkingHours` do dia carregado na página — sem
   ele, folga do Rui e agenda vazia ficam idênticas, que é fonte real de erro no balcão.

---

## 6. O que o sistema ainda não tem

### 6.1 Campos e dados que não existem — e o que fazer sem eles

| Falta | Verificado em | Fallback nesta direção |
|---|---|---|
| Logo, capa, tagline, endereço, galeria, Instagram | `src/db/schema/barbershop.ts` — só `slug, name, timeZone, slotMinutes, minLeadMinutes, maxAdvanceDays, phone` | **Não usar.** A casca pública é tipografia + `--marca` + nome e WhatsApp no rodapé. Não é paliativo, é a direção. |
| Foto de barbeiro | `staff.photoUrl` **existe** (`staff.ts:11`) e já é servido pelo catálogo, mas nenhuma tela escreve nele: `staff-form.tsx` tem só "Nome do barbeiro" | `<Monograma>` com as iniciais. Opcional de meia hora, se alguém pedir: um `<Campo rotulo="Foto (URL)">` no formulário de equipe — upload fica para depois. |
| `service.description` | `src/db/schema/service.ts` | Linha 2 do serviço é a duração. Nada a criar. |
| Especialidade do barbeiro | não existe | Nada. O nome basta. |
| `barbershop.accentHue` | não existe | **Criar** (§6.2, item 1). Sem ele, `--marca` = `--tinta` e a pública fica preto-e-branco, que é um estado final legítimo, não degradado. |
| `barbershop.phone` no cliente | o campo **existe** e é `nullable`, mas nem `/api/public/[slug]/catalog` nem o tipo `Resultado` (`b/[slug]/types.ts:19`) o devolvem | **Incluir no payload do servidor e no tipo.** Sem isso não há WhatsApp em lugar nenhum da pública. |
| Flag "WhatsApp configurado" | `src/notifications/meta-whatsapp.sender.ts` existe, mas a configuração é de ambiente | Prop booleana calculada no servidor. Quando `false`, a confirmação usa o texto do link guardado. |
| Logout | não existe `signOut` em `src/` | **Criar** a ação chamando o better-auth e a linha "Sair" na folha de conta (§5.1). Hoje não há como sair do painel. |
| `src/app/not-found.tsx` | 5 chamadas de `notFound()`, nenhum arquivo | **Criar** (§5.6). Hoje o cliente da barbearia vê o 404 do Next em inglês. |
| Nenhum `loading.tsx` no projeto | `find src/app -name loading.tsx` → vazio | Criar por rota conforme §7. |
| `working_hours` na página da agenda | a página busca agendamentos, equipe e serviços | Só é necessário para o quadro de colunas (Fase 2). Na lista, folga não precisa ser desenhada. |
| Storage / upload / `images.remotePatterns` | `next.config.ts` vazio, nenhum provedor no `package.json` | Fora de escopo por decisão. Nada nesta direção depende disso. |

### 6.2 Trabalho de servidor que a reforma exige (pequeno, mas não é zero)

1. **Migração `barbershop.accent_hue integer NULL`** + seletor de 12 matizes fixos em
   `configuracoes/settings-form.tsx` (preferido a `<input type="color">`: menos escolha, zero cor
   feia). ~2h. Sem upload, sem storage, sem tabela nova.
2. **`GET /api/public/[slug]/availability/days?serviceId&staffId&from&to`** → `{date, hasSlots}[]`.
   **A adição de backend mais valiosa do documento** e a única que muda o número de toques: alimenta
   o ponto na tira de dias **e** o botão "Ver o próximo dia com vaga", sem uma ida nova ao servidor.
   Reusa `getAvailability` por dia, com teto em `maxAdvanceDays`. Meia tarde.
3. **Catálogo por prop.** `page.tsx` já roda `listActiveServices`; passa a rodar também
   `listActiveStaff` e a consulta de `staff_service` (as três já existem juntas em
   `catalog/route.ts:18-24`) e a entregar o objeto `Catalog` como prop do `BookingWizard`. A rota
   `/catalog` **continua existindo** — o encaixe do painel e um eventual bot dependem dela —, o que
   sai é o `useEffect` do assistente.
4. **`reopenAppointmentAction(appointmentId)`** — `DONE`/`NO_SHOW` → `BOOKED`, mesmo isolamento por
   `barbershopId` de `setAppointmentStatusAction`. Nunca aceita `CANCELED`.
5. **Encaixe com "Primeiro que vagar"** — `createManualAppointmentAction:56` hoje rejeita `staffId`
   que não seja UUID. Passa a aceitar vazio e, nesse caso, resolve pelo mesmo caminho de
   `escolherBarbeiro`/`staff-load.ts`.
6. **`GET /api/panel/clientes?q=`** — busca por nome normalizado ou dígitos de telefone, com o próximo
   agendamento de cada um; `barbershopId` **da sessão**, nunca de parâmetro (regra da §7 do spec).
7. **`GET /agendamento/[token]/ics`** — `text/calendar` com escape de texto. `.ics` por `data:` URI
   não abre confiável no Safari do iOS; é ~1h de rota, não zero. Menor prioridade do documento.
8. **`data-hora="HH:mm"`** no botão de horário — gancho estável para o e2e (§6.4).

### 6.3 Dívida de código que a reforma resolve de graça

- apagar `body { font-family: Arial }` (`globals.css:25`), que anula o token declarado três linhas
  acima;
- apagar as três cópias locais de `formatarPreco` e usar `formatPrice`;
- extrair `aplicarMascaraTelefone` de `contact-step.tsx:6-11` para `src/lib/telefone.ts` e aplicá-la
  também no painel, onde o campo tem os atributos e nenhuma máscara;
- trocar `color: crimson`, `#b00020` e `darkorange` (11 ocorrências) pelos tokens, adotando
  `ErroDeAcao` nos 11 arquivos que copiam o markup;
- trocar os `<a href>` crus de navegação de dia por `<Link>` (`agenda/page.tsx:40-42`);
- subir para o `BookingWizard` o dia (`slot-step.tsx:32`) e os campos de contato;
- deixar de fixar `slot.staffId` em `booking-wizard.tsx:71` quando o cliente escolheu "qualquer".

### 6.4 Testes e2e que a reforma quebra — e o conserto

Só há uma suíte de e2e: `tests/e2e/agendamento.spec.ts`, com três testes. Os 347 testes de unidade
não tocam em layout.

1. **`agendamento.spec.ts:42`** — `page.once('dialog', d => d.accept())` antes de clicar em "cancelar
   meu horário". Sem `confirm()`, o diálogo nunca dispara, o clique só arma o segundo passo e
   `expect(getByText(/cancelado/i))` falha. **Conserto:** remover o handler de diálogo e clicar duas
   vezes no mesmo botão (`Cancelar meu horário` → `Confirmar cancelamento`). Tem de ir no **mesmo
   commit** que troca o `confirm()`, senão a suíte acusa um erro que não parece de layout. É o único
   ponto em que a promessa "a reforma não toca nos testes" não se sustenta.
2. **`agendamento.spec.ts:16`** — `textContent().split(' — ')[0]` depende de a ficha ser `"09:00 —
   João"`. Com a grade nova o nome desce para a segunda linha e o texto vira `"09:003 livres"`.
   **Conserto:** ler `getAttribute('data-hora')` (§6.2, item 8). Mais estável que qualquer formato de
   texto, e o `expect(page.getByText(horarioEscolhido))` da página de gerenciamento continua valendo
   porque a hora sai como texto lá (§5.6).
3. **`agendamento.spec.ts:64`** — `toHaveCount(antes - 1)` **continua valendo**: o seed cria a
   barbearia com **um** barbeiro, então deduplicar por `startAt` é a identidade. **Não muda.** Vale
   acrescentar um teste novo com dois barbeiros confirmando que três slots de 09:00 viram uma ficha
   só, e um teste do 409 confirmando que o dia escolhido sobrevive à volta.

Nada mais quebra: `getByRole('button', { name: /corte/i })` continua casando com o nome acessível
"Corte 30 min R$ 40,00"; `/qualquer barbeiro/i`, `getByLabel('Seu nome')`, `getByLabel('Telefone')`,
`/confirmar horário/i`, `/horário confirmado/i` e `/ver ou cancelar/i` têm texto preservado por
decisão explícita.

---

## 7. Ordem de execução

Dez passos. Cada um termina com o produto funcionando e com algo visível a mais. Nenhum passo depende
de um passo posterior. As estimativas são de um implementador com o plano na mão.

**1 — Camada base (meio dia).** `globals.css` da §3.1 inteiro, `Inter` no `layout.tsx`, e **nenhuma
tela tocada**. Efeito imediato em todo o app: botões viram botões, campos viram campos, links viram
links, o foco aparece, o modo escuro deixa de ser aleatório e os seletores nativos de data e hora
ficam legíveis. É o passo com maior retorno por hora do documento inteiro.
*Verificação: rodar os 347 testes e os 3 e2e — nada pode quebrar aqui.*

**2 — Componentes e as duas cascas (um dia).** `Botao`, `Campo`, `Bloco`, `CabecalhoDePagina`,
`Monograma`, `EsqueletoDeLinha`. `panel-nav.tsx` vira barra preta + nav rolável de 52px (fim da
rolagem horizontal em 360px, em todas as telas do painel) com o botão de conta e o **logout**. O
cabeçalho público passa para dentro do `BookingWizard`, com contador "2 de 4" e trilho. `not-found.tsx`
e o retoque de `error.tsx`. Nenhuma lógica de domínio muda.

**3 — Catálogo por prop (meio dia).** `page.tsx` carrega serviços, equipe e vínculos e entrega o
`Catalog` como prop; o `useEffect` do assistente morre; `barbershop.phone` e a flag de WhatsApp entram
no payload. A etapa 1 passa a vir pronta no HTML. **Sozinho, é o maior ganho de velocidade da reforma**
e apaga um estado de carregamento e um de erro.
*Verificação: e2e passa sem alteração.*

**4 — Fluxo público, etapas 1 e 2 (um dia).** Serviço e barbeiro: `.lista`, `<Monograma>`, bloco
"Qualquer barbeiro" de 88px, faixa de resumo com fragmentos clicáveis, rodapé de identidade com
WhatsApp. *Verificação: e2e passa sem alteração.*

**5 — Fluxo público, etapa 3 (um dia e meio, o passo mais arriscado).** Subida do estado de dia para o
`BookingWizard`, tira de dias em grade 7×2, blocos MANHÃ/TARDE/NOITE e a **deduplicação por `startAt`**
com `staffId: undefined`. Aqui entra o `data-hora` e a correção do e2e nº 2. É onde o produto melhora
mais e onde o risco de regressão é maior: escrever o teste de unidade da função de agrupamento **antes**
da tela.

**6 — Fluxo público, etapas 4 e 5 (um dia).** Bloco de compromisso com "Trocar", subida do estado de
contato, barra fixa, pré-preenchimento por `localStorage`, tela de confirmação e `/agendamento/[token]`
com `<BotaoDeConfirmacao>`. Aqui morre o `confirm()` e vai junto a correção do e2e nº 1. **Fim da
superfície pública** — dá para mostrar para um dono de barbearia.

**7 — Agenda do painel (um dia e meio).** Barra de data de 64px com legenda de contagem, linha
"próximo livre", lista agrupada por hora, cartão novo com aresta de cor por barbeiro, tinta de estado
no lugar da opacidade, linha do agora, rolagem automática até agora, "Compareceu" e "Não veio" na
linha, "Cancelar" na folha, "Desfazer" de 20s. Exige `FolhaInferior` com o contrato de acessibilidade
completo, `cores-de-barbeiro.ts`, `calcularProximosLivres` e `reopenAppointmentAction`. Mais
`agenda/loading.tsx`.

**8 — Folha de encaixe (um dia).** Segmentado "Agora | Marcar hora", fichas de barbeiro e serviço,
mostrador de hora com −5/+5, máscara de telefone compartilhada, "Primeiro que vagar" (com a mudança na
action), folha que não fecha no conflito. A semântica de `resolverInicioDoEncaixe` não muda. **Fim do
balcão** — o walk-in passa de oito controles a quatro toques.

**9 — Cadastros (um dia).** O padrão da §5.9 aplicado a Serviços, Equipe, detalhe do barbeiro,
Clientes, Expediente e Configurações; as três `<table>` morrem; expediente empilha os 6 inputs de hora
em 3+3; `loading.tsx` por rota; o seletor de matiz entra nas Configurações junto com a migração de
`accent_hue`. Passo mecânico e paralelizável.

**10 — As três pontas que doem no uso real (um dia).** `GET /api/public/[slug]/availability/days` com
o ponto na tira e o botão "Ver o próximo dia com vaga"; `GET /api/panel/clientes?q=` com a folha de
busca; e a rota `.ics`. Não são layout, mas são o que os jurados mostraram custar telefonema.

**Fora de escopo, com decisão registrada:** quadro de colunas por barbeiro (§5.11, com as cinco regras
já escritas), filtro por estado na agenda, foto de barbeiro e upload, capa e logo da loja, alternador
manual de tema. Nenhuma delas bloqueia nada acima; todas têm o caminho descrito neste documento para
quando a hora chegar.
