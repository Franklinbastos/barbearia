# Configurações — o que fica na tela, e como ela se arruma

**Data:** 16/08/2026
**Motivo:** o dono pediu revisão da tela com as mesmas perguntas de sempre — precisa mesmo escolher
fuso horário? onde vai o salvar? "endereço público" é o nome certo? a cor tinha que ser assim?
**Antecede:** um plano de implementação.

---

## O que a foto mostrou

A tela foi capturada em 1440px e os controles medidos antes de qualquer pesquisa. Cinco defeitos, e
o primeiro é o que explica a sensação de tela inacabada:

**O card "Identidade" tem duas colunas de alinhamento diferentes.** "Nome da barbearia" começa em
x=588; "Endereço público", no mesmo card, começa em x=424. É uma seção anotada — rótulo à esquerda,
campo à direita — que ficou pela metade: metade do conteúdo respeita a coluna da direita, metade não.

**O botão de copiar o link não existe.** O endereço público é um `<code>` solto. Copiar exige
selecionar o texto com o mouse.

**As fichas de cor gastam o espaço errado.** Cada uma é um retângulo de 80×36 com um círculo de cor
dentro; a cor, que é a única informação da ficha, ocupa uns 16px. E "Sem cor" fica numa linha
sozinha, em x=588, fora do alinhamento das doze que vêm abaixo.

**"Regras da agenda" tem três larguras na mesma grade de duas colunas**: o select de fuso com 169px,
o de grade com 85px, e os dois campos de número com 416px. Nada alinha com nada.

**"Salvar configurações" flutua fora dos dois cards**, em x=588 — a coluna dos campos do primeiro
card, que não é a coluna de nada no segundo.

---

## Parte 1 — O que fica, o que sai, como se chama

Duas pesquisas independentes, uma de conteúdo e uma de layout, sobre dez produtos: Fresha, Booksy,
Square, Vagaro, Mangomint, Boulevard, Calendly, Cal.com, Acuity, mais os design systems.

### 1.1 O fuso horário sai da tela

**Nenhum produto de salão trata fuso como preferência.** É atributo da localização, junto com
endereço e telefone:

- **Booksy** não deixa o dono mexer: *"If you are changing time zones, please contact the Support
  Team via Help Chat"*.
- **Vagaro** não tem o campo — 803 artigos de ajuda varridos, zero sobre configurar fuso.
- **Square** e **Mangomint** guardam em `Locations`, ao lado de endereço, telefone e horário.
- **Boulevard** não documenta.
- Só a **Fresha** deixa editar, e a três cliques, em `Settings > Scheduling > Time and calendar`.

As ferramentas genéricas (Calendly, Cal.com, Acuity) detectam sozinhas — e têm justamente o recurso
oposto ao nosso, para o nosso caso: **travar o fuso na página pública** quando o evento é presencial.
Cal.com chama de `lock_timezone_toggle_on_booking_page`, e a Calendly recomenda em letra: *"For
in-person events, we recommend locking the time zone to the event location."*

Uma barbearia tem um endereço e nunca muda de fuso. Um select de 400 opções na segunda dobra da tela
de configurações é convite a errar sem nenhum ganho.

**Decisão:** o campo sai do formulário. O valor continua no banco (`barbershop.timeZone`, com o
padrão que já existe) e passa a aparecer como **texto, no rodapé da seção de regras**, com um
"alterar" discreto que revela o select. Quem precisar, acha; quem não precisar, não tromba.

**Não** dá para derivar do endereço ainda, que é o que Square e Mangomint fazem — não temos endereço
cadastrado. Quando ele existir (§3), a derivação vira o padrão e o "alterar" some.

### 1.2 "Endereço público" vira "Link de agendamento"

É o termo de **Booksy** ("booking link"), **Fresha** ("booking link"), **Mangomint** ("Direct booking
links") e **Boulevard** ("booking link"). Square diz "online booking site URL"; Calendly, "scheduling
link"; Cal.com, "public page link".

Ninguém chama de "endereço". E há um motivo prático além do costume: **"endereço" vai colidir com o
endereço físico da loja**, que a §3 diz que precisa entrar.

### 1.3 Copiar, e o que vale mais que copiar

O copiar é padrão em todos: ícone grudado no link. A regra de forma é do Polaris, e é específica:

> "Use the link icon with a tertiary icon button for copying deep links and URLs."
> "Provide feedback inline using a confirmation check icon post-click or tap."

Ou seja **ícone de link — não de prancheta — em botão terciário, com um ✓ inline por ~2s**. Não um
botão secundário largo escrito "Copiar"; isso é o que o cartão da agenda faz, e lá está certo porque
é folha de celular operada com o polegar.

**Mas o achado maior é o QR code.** É padrão nos produtos de salão e o uso documentado é exatamente o
de uma barbearia:

- **Booksy**: `Share Profile` com download do QR e compartilhamento nativo no celular, com a dica de
  imprimir em cartão de visita e adesivo — e o aviso de que o QR muda se o nome do negócio mudar.
- **Fresha**: *"generate a unique QR code to print on business cards or display in your salon
  window"*.
- **Acuity**: `QR code > Download PNG`.

Para o Marcão, um QR na vitrine vale mais que um botão de copiar. **Entra.**

Sobre WhatsApp e Instagram: ninguém tem botão nativo, mas a Booksy escreveu um artigo inteiro
ensinando a pôr o link na mensagem automática do WhatsApp Business, com modelo pronto para barbearia.
Fica anotado como conteúdo de ajuda, não como recurso.

### 1.4 A cor fica como está — e as duas pesquisas discordaram nisto

A pesquisa de conteúdo disse para tirar: *"ou vira hex livre ou some; paleta fixa de fichas não
existe em nenhum deles para cor de marca"*. Está certa sobre o mercado — Mangomint, Square, Cal.com e
Acuity dão hex livre.

A pesquisa de layout disse para manter, e ganha, porque olhou a nossa arquitetura:

**Eles dão hex livre e por isso precisam avisar sobre contraste.** O Cal.com roda
`checkWCAGContrastColor` a cada mudança e mostra *"Dark theme color doesn't pass contrast check"* — e
deixa salvar assim mesmo. A Acuity tem um artigo de ajuda inteiro sobre o botão sumir no e-mail
porque a cor ficou igual à do texto.

**Nós guardamos um número**, `accentHue` de 0 a 360, com L e croma travados em `oklch(0.45 0.09 H)`.
Nenhuma escolha produz botão ilegível — resolvemos por construção o que eles resolvem por aviso. Hex
livre obrigaria a mudar o schema, converter para OKLCH e reimplementar o aviso de contraste em
runtime. É regressão vestida de modernização.

**O que muda é só a forma da ficha**, que hoje é um retângulo de 80×36 com a cor num círculo de 16px:
a ficha passa a ser a cor, e "Sem cor" entra na mesma grade das outras doze em vez de flutuar acima.

Se um dia doze não bastarem, a saída que **não** quebra a trava é um slider de matiz com o `Slider`
do Base UI, que já está instalado. Não é color picker: é o mesmo número, escolhido de forma contínua.

Registrado para não se pesquisar de novo: **nem o shadcn nem o Base UI têm color picker**. A issue
no Base UI está aberta desde novembro de 2025, sem resposta. Dos quatro que existem em registries de
terceiros, o único adotável seria o `@neon-ui`; o do Kibo arrasta Radix.

### 1.5 Os rótulos das regras ganham exemplo

Quatro dos seis produtos explicam com um caso concreto, e é o que falta nos nossos:

- **Mangomint**: *"If the minimum prior time required is 15 minutes, clients must book a 4 PM
  appointment by 3:45 PM."*
- **Vagaro**: *"if you set a 60-minute lead time, the customer must book at least 60 minutes
  before."*
- **Calendly**: *"setting a 4-hour notice prevents invitees from booking a meeting that begins in
  less than 4 hours."*

E ninguém usa "janela" sozinho como rótulo — Fresha e Booksy usam como nome do grupo, e o campo é
nomeado pelo efeito ("Maximum advance booking days", "Appointments can't be scheduled farther out
than", "Future Booking Window").

| Hoje | Vira |
|---|---|
| Antecedência mínima (minutos) | **Antecedência mínima**, com "60 min — para marcar às 16h, o cliente precisa fechar até 15h" |
| Janela máxima de agendamento (dias) | **Até quando o cliente pode marcar**, com "30 dias à frente" |
| Grade de horários (minutos) | mantém, com "de quanto em quanto tempo os horários aparecem" |

---

## Parte 2 — Como a tela se arruma

### 2.1 Uma página, seções empilhadas

Sete campos não pagam abas. O limiar escrito é do Android: *"For 15 or more settings, group related
settings under a subscreen."* E o NN/g sobre abas: quando não é preciso ver os grupos ao mesmo tempo,
*"a single-page layout with subheadings would be more appropriate"*.

### 2.2 Seção anotada, empilhada — não ao lado

O padrão que o Polaris escreveu **especificamente para settings** é a seção anotada: título e
descrição numa coluna estreita, campos numa larga (`2fr 5fr`), *"stack all setting groups vertically
on the page"*.

Ele resolve exatamente o nosso problema de tela larga: a largura sobrando vira **explicação**, não
campo mais largo.

**Mas nós vamos empilhar em vez de pôr ao lado**, e a razão é a §3.7: o `2fr 5fr` só respira a partir
de 1120px, e subir esta tela de `tabela` (880) para `leitura` (1120) a tira da coluna das outras
cinco do painel — o defeito que a rodada de 15/08 corrigiu na agenda e nas configurações. Sete campos
não pagam essa quebra.

Então: **título e descrição acima do card**, campos dentro dele, seções empilhadas, tudo em 880px. O
que se perde é a varredura lateral; o que se ganha é o painel inteiro começando na mesma coluna.

**E o alinhamento interno fica um só.** O defeito medido — x=588 e x=424 no mesmo card — desaparece
quando o rótulo da seção sai de dentro dele.

### 2.3 A ordem: identidade → link → regras

O princípio escrito é ordenar por importância (Primer, Polaris, Android), e o exemplo real bate: a
página General do Shopify vai *contato → endereço → defaults (fuso, moeda) → formato de ID*, com
identidade antes de regra operacional.

Aqui isso quer dizer: o nome e a cor são o que o dono confere quando entra; as regras da agenda ele
mexe uma vez e esquece. E o link vem **depois** da identidade porque ele deriva dela — o slug nasce
do nome.

### 2.4 O link sai do formulário

Três regras convergem para tirá-lo de dentro do `<form>`:

- **Não** vira input desabilitado nem `readOnly`. Carbon: *"If the component does not have an enabled
  state, do not use a read-only state to display static information"*, e campo desabilitado *"não é
  lido por leitor de tela e não passa no contraste"*. O que temos hoje — micro-rótulo mais `<code>` —
  já acerta nisso e fica.
- **Sai do `<form>`**. Primer: não misturar controle que age na hora com formulário que age no
  submit. Copiar age na hora; quem clica em "copiar" e sai da tela pode achar que salvou.
- **Ganha o ícone-botão de link e o ✓ inline**, mais o QR (§1.3).

### 2.5 Salvar: um só, no fim, à esquerda, sempre habilitado

Três decisões, cada uma com fonte, e cada uma contradizendo algum produto grande:

**Um só, e no fim.** Primer: *"There should only be one save button on a page"* e *"Don't have one
save button per section of a form"* — o que reprova o Cal.com, que tem sete rodapés de card na mesma
tela. Carbon reprova o topo em letra: *"There is a trend among product teams to pin buttons at the top
of a dedicated-page form. We want to discourage this arrangement"* — o que reprova a Fresha.

**À esquerda.** Carbon: *"The primary button will be left-aligned"* em formulário de página. Primer:
*"bottom left of the form"*, porque rótulo e campo são alinhados à esquerda e o olho desce por ali.

**Sempre habilitado.** Primer: *"Do not disable or hide a form's save button even if the form is
invalid or has not been changed. Disabled buttons cannot be focused using the Tab key."*

**Nada de auto-save**, e não por gosto. O Primer separa por tipo de controle: campo de texto, grupo
de rádio e select nativo são *declarative controls* e exigem submit explícito — *"Users expect to set
a value and then submit"* e, no rádio, *"Screenreader users can't read the options without selecting
them"*. Os nossos sete são todos declarativos. Linear e Notion podem auto-salvar porque as settings
deles são quase só interruptor.

**No celular, cola no rodapé.** É a "pinned footer or tray" que o próprio Carbon aponta como a saída
boa, e a razão do Button Dock do Base Web: *"without having to scroll to the very end of a page"*.
Isso já existe na casa — `src/app/b/[slug]/steps/contact-step.tsx` faz `sticky bottom-0 … md:static`
com o `--sombra-barra`, que a §3.6 reserva para barra fixa de ação. É reuso, não invenção.

Barra contextual à la Shopify (aparece só quando há mudança) é o padrão mais sofisticado e fica
anotada para quando a tela crescer: custa rastrear `dirty` de sete campos num `useActionState` que
hoje não tem esse estado.

---

## Parte 3 — O que falta na tela, e não é pouco

O inventário dos dez produtos escancarou buracos. Em ordem de quanto o dono sente:

**1. Horário de funcionamento da loja.** É a configuração nº1 de todos os seis produtos de salão, e
não temos nenhuma. Hoje o horário vive só no expediente de cada barbeiro — o que funciona para a
agenda e não responde "que horas a barbearia abre" para a página pública.

**2. Endereço, telefone e redes sociais.** O `phone` **já existe no banco** (`barbershop.phone`) e não
aparece em tela nenhuma. Endereço alimenta a página pública, o mapa e — depois — a derivação do fuso.

**3. Prazo de cancelamento e remarcação pelo cliente**, com o interruptor "o cliente pode cancelar
sozinho". Square, Fresha e Vagaro têm os três; a Square deixa escolher de 1 hora a 2 semanas.

**4. Confirmação automática ou manual.** Booksy tem interruptor, Vagaro chama de "Require Acceptance
for Online Booking".

**Bom de ter, depois:** otimização de buracos na agenda — todos os seis têm, e para barbearia é
dinheiro direto (Fresha "Reduce calendar gaps", Mangomint "Avoid gaps between appointments", Acuity
"Minimize Gaps", Square "Fake-it Filter"). Bloquear cliente. Limite diário de agendamentos online.

**Penduricalho de rede grande, não fazer:** depósito e sinal com cartão retido, impostos, moeda,
estoque, pacotes, gift cards, campanhas, multi-unidade. Detalhe útil: os maduros **travam idioma,
país e moeda no cadastro** — Fresha: *"The country and currency cannot be changed through the
workspace settings"*.

---

## Escopo

**Esta rodada arruma a tela que existe:** o alinhamento, a ordem, o nome do link, o copiar com ícone,
o QR, a forma das fichas de cor, os rótulos com exemplo, o fuso saindo do caminho, e o salvar.

**Os quatro buracos da §3 são a rodada seguinte** — cada um mexe em schema, em página pública e em
motor de disponibilidade, e um deles (horário de funcionamento) tem interação delicada com o
expediente por barbeiro que já existe. Misturar as duas coisas faria uma rodada que não fecha.

## O risco

O único de verdade é o **fuso**. Tirá-lo do formulário e deixá-lo atrás de um "alterar" está certo
pelo mercado, mas nós ainda não temos endereço para derivar — então a barbearia que **de fato** não
está em São Paulo depende de achar aquele link. É aceitável porque o padrão do banco já é
`America/Sao_Paulo`, o produto é para barbearia de bairro brasileira, e o campo continua alcançável.
Se um dia houver cliente fora do fuso de Brasília reclamando, a resposta certa não é devolver o
select para a primeira dobra — é cadastrar o endereço e derivar dali.
