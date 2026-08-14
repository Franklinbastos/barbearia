# Agenda e ficha do cliente — o desenho, com as referências que o sustentam

**Data:** 14/08/2026
**Motivo:** o dono olhou as duas telas e disse que estão feias. Pesquisa de referência antes de
redesenhar, como foi feito para os indicadores.
**Antecede:** um plano de implementação.

---

## O que a pesquisa procurou

Duas frentes, em paralelo, com a instrução de abrir as páginas e citar URL — não listar resultado de
busca. A pergunta não era "o que é bonito", era **"quem já resolveu isto, e como"**.

1. **Agenda de um dia** — componentes de calendário do ecossistema shadcn, e como sete produtos de
   agendamento desenham o dia: Fresha, Booksy, Square Appointments, Vagaro, Acuity, Zenoti, Cal.com.
2. **Ficha de uma pessoa** — blocos shadcn de página de detalhe, e como treze produtos organizam o
   registro: Stripe, Shopify, HubSpot, Salesforce, Attio, Intercom, Pipedrive, mais os do nosso ramo
   (Fresha, Booksy, Vagaro, Phorest, Square, Zenoti).

O resultado das duas foi o mesmo em forma: **o formato que usamos hoje está certo, e o que falta não
é enfeite — é informação numa tela e ação na outra.**

---

## Parte 1 — Agenda

### 1.1 A pergunta que a pesquisa respondeu

Todo produto de salão do mercado desenha o dia como **linha do tempo com uma coluna por
profissional**: bloco dimensionado pela duração, buraco vazio clicável. Fresha, Booksy, Square,
Vagaro, Zenoti, Phorest, todos. Nós fazemos lista cronológica. A §5.11 já tinha decidido isso — mas
por argumento interno. A pesquisa foi ver se o mercado nos desmente.

**Não desmente.** Três achados:

- **Todo produto dobra no celular, e a lista é o escape de todos eles.** A Booksy trava em duas
  colunas e a orientação oficial é *girar o aparelho*. O app da Square reduz o menu a day/week/**list**.
  A Vagaro corta para 7 colunas no celular e **remove a linha do agora** — o ajuste é marcado
  "Computer only". A Acuity imprime em "Agenda list". A lista não é plano B de ninguém: é feature de
  primeira classe em todos eles. Com 90% do uso em celular e tablet, construir colunas por padrão é
  construir a versão que os outros escondem.
- **Acessibilidade tem fonte primária e aponta para a lista.** O Google, na página oficial de
  acessibilidade: *"We recommend the use of schedule view, also called agenda view, with a screen
  reader"*. O W3C APG registra que grid com navegação bidimensional acrescenta complexidade para
  autor e usuário. Nossa lista é `<ol>` com cabeçalho de hora: navegação por lista e por heading, de
  graça.
- **Já foi rejeitado em campo.** Em fevereiro de 2025 o Google Calendar trocou o toque no dia de
  Schedule para grade no celular e levou reclamação suficiente para virar notícia.

**Onde a timeline ganha, e é honesto dizer:** duração vira comprimento, e comprimento se lê sem ler
— o buraco na agenda só existe se for desenhado, e é por isso que a Booksy vende o modo "Fit to
page… easily spot any empty slots". A §5.11 comprou isso por dois centavos com a linha "próximo
livre", que já está implementada.

**Decisão: a lista fica.** O quadro de colunas continua na Fase 2, como modo persistido — a Square
faz exatamente isso, oferece `combined` e `side-by-side` como escolha do usuário, o que valida o
desenho que a §5.11 escolheu.

### 1.2 O que está feio de verdade

Não é o formato. São três coisas, e a mais grave aparece só no desktop:

**a) Quarenta botões.** Cada cartão `BOOKED` carrega "Compareceu" e "Não veio" sempre visíveis, mais
o `⋯`. Num dia de vinte atendimentos, a tela tem quarenta botões grandes empilhados — e no bloco de
880px cada um tem ~400px de largura. No celular isso é certo: alvo grande, uma mão, cliente na
cadeira. No desktop é ruído que abafa a informação.

**b) O cartão não tem hierarquia de duração.** Um corte de 20 minutos e uma barba de 1h ocupam a
mesma altura, com o mesmo conteúdo. O tempo — que é o assunto da tela — não aparece em lugar nenhum
a não ser como texto.

**c) O vazio não é clicável.** Em Fresha, Square, Vagaro, Acuity e Cal.com, **clicar no buraco é o
jeito primário de agendar**. Aqui o encaixe é um botão separado no topo, que abre uma folha onde a
pessoa escolhe a hora de novo — a hora que ela já tinha apontado com o dedo.

### 1.3 O desenho

**1. A ação sai do cartão e vira gesto do item.**

No desktop, "Compareceu" e "Não veio" aparecem quando o ponteiro entra na linha ou quando ela recebe
foco pelo teclado — e o cartão em repouso mostra só informação. No celular nada muda: os botões
continuam sempre visíveis, porque não há ponteiro e porque lá eles são o motivo de a tela existir.

O foco por teclado é a metade que não pode ser esquecida: ação que só existe no `:hover` é ação que
não existe para quem navega por Tab. `focus-within` no item resolve os dois casos com uma regra.

**2. O cartão muda de forma conforme a duração** — o `displayType` do Cal.com, que decide pelo
conteúdo e não pela altura renderizada: abaixo de 40 minutos, uma linha; abaixo de 45, duas; acima,
completo. É mais robusto que altura mínima quando a densidade muda.

Isso resolve (b) sem trazer eixo de tempo: um corte rápido ocupa menos tela que uma barba, e a
diferença se lê de longe.

**3. O buraco vira o jeito de agendar.** Entre dois atendimentos com folga suficiente para o menor
serviço da loja, entra uma faixa discreta — não um cartão — dizendo o intervalo livre. Clicar abre a
folha de encaixe **com a hora já preenchida**.

O `EmptyCell` do Cal.com é o padrão a copiar: no hover, um bloco fantasma mostra a hora de início e a
duração padrão. Aqui a faixa é mais simples porque a lista não tem eixo — mas o gesto é o mesmo, e é
o ganho maior desta tela.

**4. Status por forma, cor livre para o barbeiro.** A Fresha deixa escolher entre colorir por membro,
por categoria ou por status, e o mapa de status dela é bom (No-show vermelho, Complete cinza). Nós já
gastamos a cor com o barbeiro (aresta de 4px, §3.5). O Cal.com resolve sem gastar cor nenhuma:
`cva` por status, com `PENDING` em borda tracejada e `CANCELLED` tracejado com `line-through`.

É a saída barata — status vira forma, cor continua sendo identidade de quem atende.

### 1.4 O que fica de fora

- **Colunas por barbeiro** — Fase 2, como modo, com as cinco regras já escritas na §5.11.
- **Arrastar para remarcar** — depende de colunas para fazer sentido.
- **ReUI Event Calendar** (`reui.io/components/event-calendar`) — é o único componente do ecossistema
  que entrega resource view em `@base-ui/react` + `date-fns`, exatamente a nossa stack, em MIT,
  enquanto FullCalendar cobra US$480/dev/ano pelo equivalente. **Vale ler, não instalar**: o registry
  puxa dez submódulos, store própria e engine de ponteiro, e a documentação não trata de celular.
  Fica registrado como prova de que o desenho é viável no nosso stack, e como fonte de detalhe para a
  Fase 2 (indicador de agora, faixa de dia inteiro, sincronia de scrollbar entre cabeçalho e trilho).

---

## Parte 2 — Ficha do cliente

### 2.1 O diagnóstico

A ficha mostra nome, telefone, histórico, notas e o botão de anonimizar. **Nenhum número.**

O sistema calcula, em `src/domain/indicadores/`, tudo que o mercado mostra nessa tela — e mais um
que quase ninguém tem. A tela não lê nada disso.

### 2.2 O que o mercado põe na ficha

A pesquisa achou o padrão e achou também onde ele se divide.

**O que repete em todo lugar:**

- **Identidade e fatos numa coluna estreita; atividade na coluna larga.** O Polaris da Shopify
  prescreve 2/3 + 1/3; o Material 3 usa ~66/34; o `atomic-crm` da Marmelab (MIT, shadcn) implementa
  isso literalmente — `flex-1` para o corpo, `w-92` para o aside.
- **Número na ficha é minoria, e quando existe é bloco de contagem bruta.** Stripe, Intercom e
  Pipedrive não têm nenhum. Quem tem — Vagaro, Phorest, Zenoti, Booksy — usa o mesmo trio: **total
  gasto, total de atendimentos, última visita**.
- **Histórico é lista ou tabela, nunca linha do tempo.** Nenhum produto de salão desenhou timeline. O
  que todos têm é **filtro por status** (Concluídos / Faltas / Cancelados).
- **"Sumido" é lista à parte, não etiqueta na ficha** — `Slipping Away` na Booksy, `Lapsed` na
  Square, `Client Reconnect` na Phorest.
- **Ação destrutiva mora em menu de overflow**, não em "danger zone": `...`, `⋮`, "More actions",
  "Actions". A danger zone existe como padrão documentado, mas nenhum sistema corporativo grande usa.

**Os dois do nosso ramo que mais ensinam:**

- **Phorest** — o Client Card tem uma seção `Spend` com gasto total, gasto em serviços e **número de
  faltas**, e a seção é permissionada (dá para esconder do barbeiro). E o mais importante: o
  "sumido" deles é calculado **por cliente, depois de três visitas** — não é corte fixo. É exatamente
  a regra que o nosso `cliente.ts` implementa com mediana.
- **Booksy** — o Client Card abre direto do bloco do agendamento e mostra três coisas: quantas vezes
  visitou, **taxa de cancelamento** e quanto gastou. É o único que mostra taxa em vez de contagem.

**Onde discordam:** onde ancora o olho (topo, como o highlights panel do Salesforce; ou coluna
direita, como manda o Polaris), e abas versus rolagem única. A SAP dá o limiar mais útil: âncora e
rolagem é o padrão, aba é exceção acima de quatro tabelas grandes.

### 2.3 O desenho

**Coluna única, com rolagem. Sem abas.** A ficha tem quatro assuntos e nenhum deles é uma tabela de
duzentas linhas. Aba custaria um clique justamente para o que o dono mais quer — o histórico — e
quebraria o "vejo tudo numa rolada" que a tela já tem.

**Também não são duas colunas.** O 2/3 + 1/3 do Polaris existe para guardar quinze atributos de CRM;
o nosso cliente tem dois, nome e telefone. Os cartões de indicador já ocupam a faixa larga no
desktop e empilham no celular sem uma linha de layout novo.

De cima para baixo:

**1. Identidade.** `← Clientes`, monograma, nome, telefone. Ao lado do nome, **no máximo um** selo, e
só quando for verdade: `Sumido há 40 dias`, ou `Cliente novo`. Um, nunca dois — destacar às vezes é
remover, não acrescentar.

**2. Quatro cartões de indicador**, na mesma grade da §5.12 que o resumo já usa (1 coluna até 640px,
2 até 1280, 4 acima). O `<CartaoIndicador>` já existe, com `Popover` de explicação:

| Cartão | Apoio | Por que este |
|---|---|---|
| **Total gasto** | "em N atendimentos" | o rótulo universal do setor — Fresha, Phorest, Vagaro, Booksy, todos |
| **Corta a cada X dias** | "última visita em 12 de julho" | **nenhum concorrente brasileiro tem**, e é o que dá sentido ao "sumido" |
| **Taxa de falta** | "N faltas de M" | a Booksy é o único a mostrar taxa; traço, não `0%`, quando não houver base |
| **Serviço e barbeiro preferidos** | — | não é número; cabe num cartão como duas linhas de texto |

A explicação no `Popover` é obrigatória, e aqui mais que no resumo: "corta a cada 15 dias" precisa
dizer que é a **mediana** dos intervalos dele, senão o dono não confia no número.

**3. Histórico** — a lista de 72px que já existe, mais o **filtro de status** (Todos / Concluídos /
Faltas) com o `<Segmentado>` que já temos. É o padrão de Fresha e Square.

Não vira timeline: nenhum produto do ramo usa, e o que o dono lê ali é "quando, o quê, quanto, veio
ou não" — isso é linha de lista.

**4. Notas** — como está.

**5. Privacidade** — fica no rodapé, separado por `border-t`, só para o dono. Sei que os grandes usam
menu de overflow, mas aqui a seção ganha por três motivos: é ação rara, e enterrá-la num `⋮` de 44px
no celular é pior que deixá-la visível no fim de uma rolagem; o texto "o histórico de atendimentos
continua na agenda" **precisa** de espaço, e é a lição do `Erase personal data` da Shopify e do
`Forget` da Phorest — anonimizar sem furar o relatório; e é o que o `atomic-crm` faz, com o delete
isolado no fim do aside por `border-t`.

O que muda é o nome do botão: o NN/g manda nomear o objeto na confirmação, então "Confirmar remoção"
vira **"Remover os dados de Marcos"**.

### 2.4 O que a ficha não vai ter

- **Abas** — quatro assuntos não pagam a troca.
- **Duas colunas** — não temos atributos para encher a lateral.
- **A nota aparecendo na tela do agendamento** — é o padrão mais consolidado do setor (Staff alert na
  Fresha, Popup note na Vagaro, pop-up da Phorest, três gatilhos no Zenoti), e é a melhor ideia que a
  pesquisa trouxe. Mas é outra tela. Fica registrado como próximo passo.

---

## O que a pesquisa não achou

Vale registrar, porque poupa a próxima busca:

- **Não existe bloco oficial do shadcn** nem para calendário de dia nem para ficha de pessoa. O
  pedido de calendário está aberto desde março de 2024, com 268 votos, sem entrega.
- **Não existe estudo controlado** comparando lista contra grade de horas em tela pequena. Quem
  disser que está provado, está inventando.
- **Não existe post de engenharia** de quem construiu essas telas. Fresha e Booksy não têm blog
  técnico; o do Cal.com só tem incidente e CI.
- O **`open-salon`** (github.com/clawnify/open-salon) é um clone de Fresha em shadcn + Tailwind 4,
  com colunas de barbeiro e ficha de cliente — mas é **AGPL-3.0**. Serve para olhar, nunca para
  copiar código para dentro de um SaaS proprietário.

## Dados que faltam

Um só: `listCustomerHistory` não traz o barbeiro. Um campo a mais no `select` resolve — o resto dos
quatro cartões sai do que a query já devolve, somado em memória, sem consulta nova.
