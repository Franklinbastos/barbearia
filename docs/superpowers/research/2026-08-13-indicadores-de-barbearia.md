# O que uma barbearia mede — pesquisa de mercado

**Data:** 2026-08-13
**Motivo:** decidir o conteúdo de uma tela de indicadores para o dono. A primeira lista que eu havia proposto (faturamento, no-show, ranking de barbeiro, horário vazio) foi considerada superficial, com razão: era o que é fácil de calcular, não o que o dono precisa saber.

**Método:** duas frentes de busca — os produtos consolidados do setor (19 investigados) e a gestão real do negócio (planilhas, comissão, custo, sazonalidade). Cada afirmação abaixo tem fonte; onde a fonte é fornecedor de software vendendo a própria solução, está marcado.

---

## 1. A conclusão que mudou o plano

**O mercado brasileiro resolveu dinheiro e não resolveu tempo nem cliente.**

Faturamento, caixa, comissão e ticket médio: todo mundo tem. Agora:

| Métrica | Produtos que têm (de 19) | Brasileiros |
|---|---|---|
| Taxa de ocupação **como número** | 13 | **zero** |
| Tempo médio entre visitas | 4 | **zero** |
| Rebooking / pré-agendamento | 9 | **zero** |
| Retail attachment | 5 | **zero** |
| Clientes sumidos / em risco | 5 | Gendo, Trinks |
| Taxa de no-show medida | 5 | só Trinks, e escondida no módulo de pagamento antecipado |
| Coorte de retenção | poucos | só Trinks |
| **Buraco na agenda como métrica** | **1** (Fresha, parcial) | **zero** |

Trinks e Avec têm **mapa de calor** da agenda — grade dia × hora colorida. É um traço brasileiro (lá fora vira "peak hours"), é bonito, e não é métrica: não dá um número com o qual decidir.

**E o mais relevante para este produto:** essas métricas ausentes são justamente as que saem do dado que uma agenda já tem. Ocupação precisa do denominador — horas disponíveis —, e a agenda é o único sistema que sabe isso. Tempo entre visitas, cliente sumido e buraco na agenda estão inteiros em `appointment` + `working_hours`.

## 2. A referência declarada não serve

O `agendeonline` é o portal de agendamento do **SalonSoft**, e o SalonSoft **não nomeia um único relatório** em nenhum canal público: site, página de funções, App Store, Google Play, Capterra. O Capterra lista seis recursos e nenhuma menção a relatório ou analytics. Planos de R$ 29,90 a R$ 79,90/mês.

Não há o que copiar dele em indicador. Quem publica catálogo de verdade: Trinks (130+ relatórios, por menu), Avec (numerados 0001–0344), Gendo (~35 numerados), Vagaro (~30), Boulevard (~40 + summaries), Mangomint (~30), Fresha (44 + 8 premium), Phorest (por seção + 6 dashboards).

Quem **não** nomeia nada: Belasis, Booksy (só abas), AppBarber, BestBarbers, EiBarber, Squire, SalonSoft.

## 3. O que fica na primeira tela dos concorrentes

- **Trinks** — 8 cards: Resultado (receita − despesa), Receita, Despesa, Agendamentos, Agendamentos online, Atendimentos, Ticket Médio, Distribuição por Categoria.
- **Booksy** — receita, Time Booked, **Occupancy Percentage**, confirmados, finalizados, no-shows, cancelamentos.
- **Vagaro** — widgets rearranjáveis: Appointment Distribution, **Booking Percentage**, **New vs Returning**, Sales Breakdown (receita projetada do que está agendado e ainda não fechado), Top 10, Trends.
- **BestBarbers** — faturamento, ocupação, ticket médio, taxa de retorno, assinantes ativos, inadimplentes. É o brasileiro mais próximo do conjunto certo.
- **Phorest** — **Health Check Dashboard** com tooltip explicando o cálculo de cada tile, mais um e-mail semanal **Week in Review**: visitas, conta média, ciclo de agendamento, **custo dos no-shows em dinheiro**, **clientes em risco**, taxa de rebooking, utilização.
- **Fresha** — não tem KPI na home; fica numa gaveta lateral.
- **Square** — home mostra vendas brutas e ticket; o app de agendamento abre no **calendário**, não em indicador.
- **Mangomint e Boulevard** — não têm tela-KPI de dono. Só relatórios.

O padrão de quem acertou (Phorest, Booksy, Vagaro, BestBarbers): **ocupação na primeira dobra**, ao lado do dinheiro.

## 4. Fórmulas publicadas, copiáveis

### Ocupação

Todos usam horas reservadas ÷ horas disponíveis. A diferença está no denominador, e é aí que a métrica mente ou não:

- **Boulevard** — `Hours Booked ÷ (Hours Scheduled − Business Blocked Hours)`
- **Phorest** — `Utilization Hours ÷ Available Hours`, onde disponível = escala menos intervalo não pago. Pode passar de 100% com atendimento sobreposto.
- **Zenoti** — `(Service hours + Paid block-out + Recovery time) ÷ Scheduled hours`
- **Vagaro** — `Time Booked ÷ Time Available`, e o reservado **inclui o tempo de limpeza**
- **Square** — `booked ÷ total working hours`
- **Squire** — capacidade = disponibilidade no **percentil 90** de cada barbeiro. Média da base 62%, topo 75%, mediana 56%.
- **Fresha** — é o único que expõe **horas não reservadas** como linha própria

### Retenção

- **Square** — `retornantes ÷ total`, onde retornante = visitou nos 12 meses anteriores à janela. Exclui cancelado e no-show.
- **Boulevard** — `revisitas ÷ clientes`, janelas de 30/60/90/120/150/180 dias. Separa "novo para o profissional" de "já era do profissional".
- **Mangomint** — retido = ao menos 1 atendimento em 90 ou 180 dias após o inicial.
- **Zenoti** — retido = outro atendimento fechado nos 60 dias seguintes.
- **Phorest** — separa **retenção de cliente novo** de **retenção de cliente existente**, janela configurável.
- **Meevo** — publica metas: retenção de cliente novo (2ª visita em 90 dias), retenção de recorrente (média de mercado 75%, meta 85%), frequência de visita (média 4,88/ano, meta 7–8), produtividade (meta 75–80%).
- **Trinks** — coorte real: mês base = 100%, % dos mesmos clientes que voltaram nos meses seguintes.

### Rebooking

- **Phorest** — % de visitas em que o cliente já tinha agendamento futuro **ou marcou no mesmo dia**. Não precisa ser com o mesmo profissional. Se cancelar depois, deixa de contar.
- **Square** — "pre-booking" = agendou futuro **até 24h após o fim** do atendimento.

### Cliente em risco

- **Phorest Client Reconnect** — cliente com 3+ visitas, ausente há 2+ semanas, com o corte calculado a partir do **intervalo típico daquele cliente** depois de 3 atendimentos.
- **Gendo (1602 Clientes de Abandono)** — mesmo princípio: corte relativo ao histórico individual.

Essa é a definição certa, e é o que separa a métrica útil da inútil: quem corta a cada 15 dias e sumiu há 40 é urgente; quem corta a cada 60 e sumiu há 40 está no ritmo.

## 5. A gestão real do negócio

### Comissão é o número central

35% a 50% é a faixa mais citada; 40% a 60% a amplitude total. **É a maior despesa da operação — maior que o aluguel.**

Seis modelos praticados: percentual fixo; variável por serviço (corte 50%, química 25%); aluguel de cadeira (~R$ 800–900/mês, barbeiro fica com 100%); progressiva por meta (até 6k = 40%, 6–10k = 50%, acima = 60%); fixo + variável; e comissão de produto separada (10–20%).

**A briga não é o percentual, é a base de cálculo** — o que entra, o que desconta, quem faltou. As quatro discussões típicas: divergência no fechamento, atendimento não registrado, cliente que faltou, e o que compõe a base. A frase que resume o setor: *"sem registro, não tem argumento"*.

Calibragem de meta progressiva que apareceu como regra prática: a primeira faixa deve ser batível em ~70% dos meses, a segunda em ~30%, a terceira só excepcionalmente.

### Salão Parceiro (Lei 13.352/2016) é requisito de software, não detalhe fiscal

O salão centraliza o recebimento, retém a cota-parte e os tributos do profissional, e emite **nota fiscal unificada discriminando as duas cotas-parte**. A cota do profissional **não integra a receita bruta do salão** para tributação.

Isso significa que o sistema precisa saber separar, **por atendimento**, quanto é do salão e quanto é do profissional — porque esse número vai para a nota e para a base de cálculo do imposto. Não é "calcular comissão no fim do mês".

Salão-parceiro não pode ser MEI. O profissional pode, e aí toda a cota-parte conta contra o teto dele. Contrato escrito com homologação sindical; homologar em sindicato sem representação local anula tudo e gera vínculo CLT retroativo.

### Custo por atendimento

Fórmula direta encontrada: `preço − comissão − custo de produto − taxa da maquininha`. Exemplo trabalhado num corte de R$ 45: comissão 40% = R$ 18, produto R$ 5, maquininha ~3% = R$ 1,35 → **sobram R$ 20,65 antes do custo fixo** (~46%).

Rateio do fixo: `custo fixo mensal ÷ atendimentos no mês`. Ex.: R$ 8.000 ÷ 400 = R$ 20 por atendimento.

Diagnóstico recorrente do setor: *"a comissão é a variável mais pesada do caixa e é tratada com o menor rigor — o dono define no olho e nunca revisa"*.

### O que dá prejuízo escondido

- **No-show**: 15–20% é o número mais citado no Brasil (fonte: fornecedores de software, sem metodologia publicada). Conta que o dono faz de cabeça: `faltas/semana × ticket × 4,3`. Três faltas semanais a R$ 45 = R$ 580/mês.
- **Cadeira ociosa**: barbeiro presente sem cliente é aluguel e energia pagos a zero de receita. Não aparece em conta nenhuma.
- **Cliente que some**: some por falta de contato, não por insatisfação. O corte tem ritmo de 2 a 4 semanas; 30 dias sem retorno é o gatilho clássico. A barbearia raramente sabe quem passou do prazo.
- **Produto vencido e ruptura**: 5% a 15% do faturamento em desperdício, segundo fontes do setor.
- **Atendimento não registrado**: problema de processo, não de má-fé. Sem número publicado.

### Sazonalidade

**Anual:** dezembro é o pico; janeiro fraco; fevereiro e março os piores; Dia dos Pais é a data de apelo mais forte para barbearia.

**Semanal — importa mais no dia a dia:** manhã fraca a semana toda, pico no fim da tarde, sábado é o pico. **Terça é o dia mais vazio**, e o conselho corrente é promoção de ~20% na terça.

### O que o dono olha primeiro

**Quanto entrou hoje** — e as fontes dizem em coro que é o número errado para olhar sozinho. A tríade que o setor manda separar: **faturamento** (o que foi vendido), **caixa** (o que entrou de fato — cartão em D+30 não é caixa hoje) e **lucro real**.

Cadência recomendada: **semanal, não mensal**. Semanal dá tempo de reagir com promoção ou escala; mensal só dá tempo de lamentar.

### Clube de assinatura

Uma plataforma reporta 48% da base com clube ativo, 47.793 assinantes, ticket de R$ 128,14 por cobrança e permanência média de 12,1 meses; planos de R$ 69,90 a R$ 179,90. Números autodeclarados — direção confiável, magnitude não auditada.

## 6. O que fica atrás de plano pago (e o que isso revela)

O padrão é claro: **relatório operacional vem no básico; retenção, ocupação e BI viram tier de cima.** Ou seja, o mercado considera as métricas de *tempo e cliente* as de maior valor — exatamente as que ninguém no Brasil entrega.

- **Square** — o time performance report inteiro (retenção + pre-booking + utilização) exige Plus ou Premium.
- **Phorest** — Staff Performance e Client ReConnect só do Grow para cima.
- **Belasis** — comissão automática, fechamento de caixa e painel financeiro só a partir do Pro (R$ 189/mês).
- **Gendo** — relatórios gerenciais, lista de espera e a IA só do Avançado (R$ 124,90).
- **Fresha** — 44 relatórios grátis; o add-on Insights (R$ 25 por profissional/mês) libera 8, incluindo relatórios customizados.
- **Vagaro** — o único que não trava nada: ~30 relatórios no plano base de US$ 23,99.

## 7. Ranking de consenso

**Consenso absoluto (15–19 de 19):** faturamento do período (19/19), comissão por profissional (18/19), vendas por serviço vs produto, fechamento de caixa.

**Consenso forte (11–14):** ticket médio (13), taxa de ocupação com fórmula (13 — mas 11 são de fora do Brasil), clientes novos vs recorrentes (12), taxa de retenção nomeada (11).

**Meio do pelotão (6–10):** rebooking (9, zero BR), retenção por profissional (8), contagem por status (8), ranking de profissional (5–6).

**Diferencial de poucos (3–5):** no-show como número (5), clientes sumidos (5), retail attachment (5, zero BR), tempo médio entre visitas (4, zero BR).

**Praticamente inexistente:** receita por hora disponível (1 — só Phorest), alerta proativo quando um KPI cai (1 — a IA do Gendo), e **buraco na agenda como métrica (0)**.

---

## Fontes

Produtos: [Trinks](https://ajuda.trinks.com/relat%C3%B3rios-trinks-acompanhe-seus-resultados) · [Avec](https://sites.google.com/hyperlocal.com.br/central-de-ajuda-avec/relat%C3%B3rios/todos/onde-visualizo-todos-os-relat%C3%B3rios) · [Gendo](https://www.gendo.com.br/artigo/relatorios) · [Vagaro](https://support.vagaro.com/hc/en-us/categories/115000066113-Reports-and-Dashboard) · [Boulevard](https://support.boulevard.io/en/articles/9438032-report-index) · [Mangomint](https://www.mangomint.com/learn/available-reports/) · [Fresha](https://www.fresha.com/help-center/knowledge-base/reports/614-reporting-and-analytics-overview) · [Phorest](https://support.phorest.com/hc/en-us/sections/360004634979-Reports) · [Meevo KPIs](https://www.meevo.com/blog/kpis-salon-spa/) · [Square](https://squareup.com/help/us/en/article/7904-square-appointments-reporting) · [SalonSoft](https://www.salonsoft.com.br/funcoes.php) · [Belasis preços](https://www.belasis.com.br/precos)

Gestão: [Lei 13.352](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2016/lei/l13352.htm) · [Receita Federal — cota-parte](https://www8.receita.fazenda.gov.br/simplesnacional/Noticias/NoticiaCompleta.aspx?id=4bb88b6e-394f-45ff-ad26-a4661a1ae01d) · [Sebrae — Salão Parceiro](https://agenciasebrae.com.br/economia-e-politica/lei-salao-parceiro-tudo-o-que-donos-e-profissionais-da-beleza-precisam-saber/) · [modelos de comissão](https://barbanahora.com.br/blog/6-modelos-de-comissao-para-barbeiros/) · [precificação](https://hubbarber.com.br/blog/quanto-cobrar-servicos-barbearia-guia-precificacao) · [gestão financeira](https://www.bestbarbers.app/blog/gestao-financeira-barbearia) · [controle de estoque](https://barbanahora.com.br/blog/controle-de-estoque-em-barbearias/)

**Ressalva de método:** a maior parte do conteúdo de gestão de barbearia no Brasil é produzida por fornecedores de software. Os números de mercado (15–20% de no-show, 5–15% de perda em estoque, 48% com clube) são referências com viés comercial, não estatística setorial. O que é oficial está marcado no corpo do texto: Planalto, Receita Federal, prefeituras, Sebrae e convenções coletivas.
