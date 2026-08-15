# A agenda, redesenhada — o que ela mostra e o que ela faz

**Data:** 15/08/2026
**Motivo:** o dono olhou a tela pronta e disse que continua horrível. Estava certo, e a razão só
apareceu quando a tela foi finalmente **fotografada** em vez de lida no código.
**Antecede:** um plano de implementação.

---

## O erro que produziu esta spec

As duas rodadas anteriores analisaram `cartao-da-agenda.tsx` e `day-grid.tsx`, discutiram lista
contra timeline, mediram larguras no navegador — e nunca olharam a tela renderizada com dados de
verdade. A captura em 1440px, com seis atendimentos e dois barbeiros, mostrou em cinco segundos o
que três análises de código não acharam:

**No celular a tela está boa. No desktop não existe layout de desktop — existe o layout de celular
esticado.**

Cada atendimento é um cartão de 880×100px. O conteúdo ocupa cerca de 500px de largura e duas linhas
de altura; o resto é ar. O botão de mais ações boia sozinho no canto inferior direito, a 380px do
texto mais próximo. O fundo do cartão inteiro é verde quando o cliente compareceu e vermelho quando
faltou. A etiqueta de estado aparece ora colada no nome, ora no canto oposto da mesma tela.

Isso não se vê lendo JSX. **A regra que sai daqui: tela que o dono vai olhar, o assistente olha
antes — renderizada, com dados que pareçam um dia real.**

---

## Parte 1 — A forma

### 1.1 Os três defeitos, com a fonte de cada correção

**a) A altura.** 100px carregando duas linhas de texto. O Carbon, que é o design system mais
explícito sobre isso, define a escala em 24/32/40/48/64px e escreve que *"extra large row heights are
only recommended if your data is expected to have 2 lines of content in a single row"* — os 64px do
extra-large. A análise de tabelas do Pencil & Paper mede o mercado em 40 (condensada), 48 (regular) e
56 (relaxada). Estamos 36px acima do teto da régua mais folgada que existe, e o excedente é ar.

**b) O botão solto.** O `⋯` está no canto inferior direito porque a ação mora numa *segunda linha*
dentro do cartão (`mt-2` no `cartao-da-agenda.tsx`). Carbon: *"By default, the overflow menu icons are
persistent on each row"* — célula fixa no fim da linha, centrada na vertical, sempre visível. É a
afordância mínima da linha, não um enfeite que aparece no hover.

**c) O fundo pintado.** Sai. Cinco razões, todas com fonte:

1. **O fundo é o canal da interação, não do negócio.** Carbon manda o hover de linha estar sempre
   ligado *"as it can help the user visually scan the columns of data in a row"*; o Material 3 reserva
   o fundo para state layers (hover 0.08, focus e pressed 0.12). Com a linha já verde, o hover não tem
   para onde ir — perde-se o "estou nesta linha" justamente numa lista de vinte itens.
2. **Área grande não é ênfase, é alarme.** Carbon: *"having more than five or six indicators can
   overwhelm users"*. Vinte linhas pintadas num dia normal é vinte alarmes.
3. **A cor já tem dono.** A §3.5 deu a cor ao barbeiro (aresta de 4px). O fundo pegou um segundo
   significado sem ninguém decidir. A Square separa de propósito: cor é quem atende, ícone é estado.
4. **Cor sozinha não é status.** WCAG 1.4.1. O Carbon é mais duro: dos quatro portadores — símbolo,
   forma, cor e tipo — *"at least three of these elements must be present"*. Um fundo verde entrega um.
5. **A Fresha pinta, mas o caso é outro.** Lá o bloco vive numa timeline e é pequeno; a cor é o único
   portador possível. Numa linha de 880×100 a mesma cor cobre 88.000px². Quem resolve bem em lista usa
   borda esquerda (Preline) ou tinta translúcida a 25-50% (Origin UI).

**No lugar:** o badge de estado numa coluna própria — sempre no mesmo x, que é o que a etiqueta
errante de hoje não faz —, a forma da borda que já existe (cheia contra tracejada) e o nome riscado
no cancelado. Fundo pintado sobra para `--agora-bg`, que não é status: é "onde estamos no dia", é uma
linha só, e some sozinho.

### 1.2 A linha do desktop

Os 880px do degrau `tabela` continuam certos — o problema nunca foi o teto, foi o vazio dentro dele.
O Polaris diz o que fazer com ele: *"On wide screens, a resource list often looks like a table,
especially if some content is aligned in columns."*

880 − 4 de aresta − 24 de recheio = 852 úteis, com sete vãos de 12px:

| Faixa | Largura | Conteúdo | Alinhamento |
|---|---|---|---|
| aresta | 4px | cor do barbeiro; cheia ou tracejada conforme o desfecho | — |
| Hora | 72px | `09:00` em 16/700 tabular, e `40 min` em 12px apagado | esquerda |
| Cliente | ~172px | 15/600, corta com reticências | esquerda |
| Serviço | ~132px | 14px secundário | esquerda |
| Barbeiro | 116px | ponto de 8px na cor + nome | esquerda |
| Preço | 76px | 14px tabular | **direita** |
| Estado | 92px | o badge; vazio quando ainda está agendado | esquerda, x fixo |
| Ações | 108px | três alvos de 32px | direita |

**A duração vira número.** Hoje ela é altura de cartão — sinal implícito que ninguém mede a olho. Na
coluna 1 ela é `40 min`, escrito. Isso **mata a altura-por-duração** que a rodada anterior
implementou, e é honesto dizer que é um recuo: aquilo veio do Cal.com e faz sentido numa timeline.
Em colunas alinhadas, altura variável quebra o ritmo de varredura sem entregar precisão — o Carbon
manda *"use the same row height … don't mix row heights"*.

**O telefone sai da linha.** É ele que hoje obriga a terceira linha de conteúdo. Vai para a folha e
para a ficha do cliente.

**Altura: 48px.** Uma linha de texto. É o "default" do Carbon e o "regular" do mercado.

### 1.3 As ações, na mesma linha

Última célula, centradas na vertical, 32×32 cada — passa no alvo mínimo de 24px da WCAG 2.2 com
folga.

Os dois verbos viram ícone em opacidade reduzida, subindo a cheio no ponteiro **ou no foco**. Não
somem: ficam quietos. Isso responde aos dois lados do aviso do NN/g de uma vez — nem quarenta botões
gritando, nem ação invisível em repouso. O `⋯` fica sempre em 100%.

**E os verbos entram na folha também.** O Polaris é explícito: ação revelada no hover *"must also be
accessible in another way"*. Hoje a folha do `⋯` não carrega "Compareceu" — quem chega por teclado
num aparelho sem ponteiro fica sem caminho. É a correção mais importante desta seção e a que nenhum
teste de aparência pegaria.

### 1.4 O celular não muda

Fica o cartão empilhado com os botões de 44px. Outlook chama de Compact, Todoist de Mini view — os
dois mantêm **dois layouts distintos**, não um esticado. Era exatamente o diagnóstico.

### 1.5 Duas correções menores que a captura mostrou

- **As duas faixas de vão livre repetem a hora**: "11:45 · 1h15 com Tiago" e "11:45 · 2h45 com Dono".
  Com dois barbeiros livres no mesmo instante, viram uma faixa só que nomeia os dois.
- **A linha "Dono livre · Tiago livre"** no topo não diz nada quando ninguém está ocupado. Só aparece
  quando há diferença entre os barbeiros.

---

## Parte 2 — O que a tela precisa fazer

A segunda pesquisa levantou o que oito produtos permitem fazer na tela de calendário: Fresha, Booksy,
Square, Vagaro, Phorest, Mangomint, Boulevard, Trafft, SimplyBook.

### 2.1 O que falta, em ordem de impacto

**1. Reagendar.** É o buraco maior. Hoje mudar alguém de horário significa cancelar e criar de novo —
e o cancelamento dispara WhatsApp de cancelamento para quem só queria trocar de hora.

O achado que destrava: o **Boulevard faz select-and-place, não arrastar**. Clica no agendamento, clica
no ícone de remarcar, o cartão fica hachurado, rola a agenda, clica no novo horário. **Não depende de
colunas, não depende de gesto contínuo, funciona no celular do balcão** — ou seja, funciona na nossa
lista, e a decisão anterior de adiar isso "até ter colunas" estava mal fundamentada.

E o Mangomint entrega a peça que faltava: ao remarcar, um interruptor **"avisar o cliente"**. É a
diferença entre remarcar e cancelar.

**2. Editar o atendimento** — serviço, barbeiro, duração. Mesmo motivo: hoje é cancelar e refazer.

**3. WhatsApp a partir do cartão.** O telefone já está ali como link de telefonia; falta o caminho que
o dono realmente usa.

**4. Bloquear horário clicando na agenda.** É o item mais universal de toda a pesquisa — **sete dos
oito produtos** têm, e o único que não tem é o mais fraco em calendário. Almoço, dentista, saiu mais
cedo. Vale copiar do Vagaro a distinção entre bloquear a grade e fechar só a venda online.

**5. Ficha e nota do cliente a partir do cartão.** A ficha ganhou os quatro indicadores em 14/08 e a
agenda não leva até ela.

**Candidato logo abaixo:** encaixe em dois tempos, no espírito do **Express Booking** do Mangomint —
salvar com nome e telefone soltos e completar depois. Hoje o encaixe exige nome de 2 a 80 caracteres e
telefone de 10 a 13 dígitos antes de deixar salvar; com o cliente já na cadeira, é atrito na hora
errada.

### 2.2 O que é enfeite, confirmado

Arrastar para remarcar, redimensionar duração, atalhos de teclado, visão de mês, cor por status.

Sobre atalhos: o Boulevard tem três (T, ←, →) e o Mangomint só o comando global. **Ninguém do setor
tem atalho sério** — não construir.

Sobre visão de mês: **Mangomint e Boulevard não têm.** Dia e semana bastam.

### 2.3 A armadilha a não repetir

O **Trafft esconde do calendário o profissional sem agendamento**. Numa barbearia isso apaga
justamente o barbeiro com a agenda vazia — que é quem o dono mais precisa ver. A nossa linha de
"próximos livres" faz o contrário, e está certa.

### 2.4 Uma divergência que precisa de decisão

A spec da fila de espera (09/08) manda WhatsApp automático para os primeiros da fila. A waitlist do
**Mangomint não avisa o cliente sozinha** — avisa a equipe, que escolhe quem chamar.

Não digo que a nossa está errada. Digo que diverge do líder de UX do setor e merece decisão
consciente antes de virar código.

---

## O que fica de fora

- **Colunas por barbeiro** — continua Fase 2. Nada nesta pesquisa mudou isso, e o reagendar, que era
  o argumento mais forte a favor, provou-se independente delas.
- **Status "chegou"** — quatro precedentes agora (Mangomint, Boulevard, Vagaro, SimplyBook), mas numa
  barbearia de duas a cinco cadeiras o barbeiro é a recepção. Abaixo dos cinco.
- **Imprimir o dia** — dois de oito produtos têm.

## Lacunas honestas da pesquisa

Trafft e SimplyBook não tiveram avaliações de usuário consultadas. G2, Boulevard e o fórum do Trafft
recusaram acesso automatizado. Dribbble e Behance também — o que veio de lá é título e URL, nenhuma
imagem foi vista, e portanto nenhuma foi descrita.
