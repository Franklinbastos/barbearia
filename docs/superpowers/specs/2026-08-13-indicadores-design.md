# Tela de indicadores do dono

**Data:** 2026-08-13
**Status:** aprovado (design)
**Base:** `docs/superpowers/research/2026-08-13-indicadores-de-barbearia.md`

---

## 1. Por que esta tela existe

O produto registra tudo o que acontece na barbearia e não devolve nada ao dono. Ele sabe quanto entrou, quem faltou, quem sumiu e qual cadeira ficou vazia — e não mostra nenhum desses números em lugar nenhum.

A pesquisa de mercado (19 produtos investigados) trouxe uma conclusão que muda o desenho: **o mercado brasileiro resolveu dinheiro e não resolveu tempo nem cliente.** Faturamento, caixa, comissão e ticket todo mundo tem. Já taxa de ocupação como número, tempo médio entre visitas, rebooking e retail attachment: **zero produtos brasileiros**. Cliente em risco: só dois.

E essas ausências são exatamente o que uma agenda calcula de graça. Ocupação precisa do denominador — horas disponíveis —, e a agenda é o único sistema que tem isso. Cliente sumido precisa do intervalo típico de cada pessoa, que só existe no histórico de agendamento.

Ou seja: o que falta no mercado é o que sobra no nosso banco.

**A referência declarada do produto não ajuda aqui.** O agendeonline é o SalonSoft, que não nomeia um único relatório em canal público nenhum. Onde este documento cita fórmula de concorrente, a fonte é Square, Boulevard, Phorest ou Trinks, que publicam o cálculo.

## 2. Princípios

1. **Número, não gráfico.** O dono decide com "68% de ocupação na terça" e não com uma barra bonita. Gráfico entra onde a forma da curva é a informação (ocupação por hora do dia), não para enfeitar total.
2. **Cadência semanal.** As fontes do setor são unânimes: mensal só dá tempo de lamentar. A tela abre na semana corrente, com mês e dia a um toque.
3. **Todo indicador diz de onde veio.** Cada card explica o cálculo em uma linha ao ser tocado. Foi o que o Phorest acertou e é o que separa métrica confiável de número mágico — sobretudo em comissão, onde o barbeiro vai conferir.
4. **Nada que exija dado que o dono não tem.** A Fase 1 não pede cadastro nenhum. Custo e margem entram na Fase 3, quando pedirmos três números.
5. **Onde houver ação, ela está na tela.** "12 clientes sumidos" sem botão de WhatsApp é uma acusação, não uma ferramenta.
6. **Zero é resposta.** Barbearia nova, semana vazia e barbeiro sem atendimento têm estado próprio, e ele explica em vez de mostrar `0,0%`.

## 3. O que entra, e de onde sai

Tudo abaixo sai de `appointment`, `working_hours`, `time_off`, `staff` e `customer` — sem tabela nova e sem pedir nada ao dono.

### 3.1 Dinheiro

| Indicador | Cálculo | Consenso |
|---|---|---|
| **Faturamento** | soma de `servicePriceCentsSnapshot` dos `DONE` no período | 19/19 |
| **Ticket médio** | faturamento ÷ nº de `DONE` | 13/19 |
| **Faturamento por barbeiro** | mesmo corte, agrupado por `staffId` | consenso |
| **Receita perdida com falta** | soma do preço dos `NO_SHOW` | Phorest ("Cost of No-Shows") |

Faturamento conta `DONE`, não `BOOKED`: agendado não é dinheiro. O agendado do futuro aparece separado, como **previsto**, seguindo o "Sales Breakdown" do Vagaro — e nunca somado ao realizado.

### 3.2 Tempo — onde está o diferencial

| Indicador | Cálculo |
|---|---|
| **Taxa de ocupação** | minutos ocupados ÷ minutos disponíveis, por barbeiro e no total |
| **Horas vagas** | o complemento, em horas — o número que o Fresha expõe e mais ninguém |
| **Ocupação por dia da semana** | mesma conta, agrupada por `weekday` |
| **Ocupação por hora** | mesma conta, agrupada por hora local |

**Denominador**, que é onde a métrica mente: minutos de `working_hours` do dia, menos `time_off` que intersecta, menos o que já passou (num dia em curso, contar a tarde inteira como disponível derruba o número sem motivo).

**Numerador**: minutos de `appointment` com status `BOOKED` ou `DONE`. `CANCELED` não ocupa. `NO_SHOW` **ocupa** — a cadeira ficou reservada e ninguém pôde usar, e é isso que o dono precisa enxergar.

A ocupação por dia da semana é o que responde "a terça está vazia?" com número em vez de palpite — e é a entrada natural para a promoção de terça que o setor recomenda.

**Ocupação por hora é o único gráfico da tela.** A forma da curva é a informação: onde afunda é onde promover.

### 3.3 Cliente

| Indicador | Cálculo | Consenso |
|---|---|---|
| **Clientes atendidos** | `customerId` distintos com `DONE` no período | consenso |
| **Novos vs recorrentes** | novo = primeiro `DONE` da vida dele no período | 12/19 |
| **Tempo médio entre visitas** | média da diferença entre `DONE` consecutivos do mesmo cliente | 4/19, **zero BR** |
| **Clientes sumidos** | ver abaixo | 5/19 |
| **Taxa de retorno** | clientes com 2ª visita em até 90 dias após a primeira | 11/19 |

**Cliente sumido — a definição importa mais que a fórmula.** Nada de "não vem há 30 dias", que é o que quase todo mundo faz e produz lista inútil. Seguimos Phorest e Gendo: **o corte é o ritmo daquele cliente**.

Com 3 ou mais atendimentos, calcula-se o intervalo típico dele (mediana, que resiste melhor a um retorno atrasado do que a média). Está sumido quem passou de **1,5× o próprio intervalo**. Quem corta a cada 15 dias e sumiu há 40 é urgente; quem corta a cada 60 e sumiu há 40 está no ritmo.

Com menos de 3 atendimentos não há ritmo para medir, e o cliente cai numa lista separada de **"veio uma vez e não voltou"** — que é outro problema e pede outra conversa.

Cada linha tem botão de WhatsApp com o texto pronto, como o Trinks faz.

### 3.4 Comportamento

| Indicador | Cálculo |
|---|---|
| **Taxa de falta** | `NO_SHOW` ÷ (`DONE` + `NO_SHOW`) |
| **Taxa de cancelamento** | `CANCELED` ÷ total do período |
| **Cancelamento em cima da hora** | `CANCELED` com `canceledAt` a menos de 24h do `startAt` |
| **Origem do agendamento** | `origin`: público, balcão, bot |

A taxa de falta é diferencial (5/19), e a de cancelamento em cima da hora só existe porque guardamos `canceledAt` — dado que a maioria dos sistemas descarta.

**Origem do agendamento** responde a pergunta que o produto precisa responder para se justificar: quantos por cento dos agendamentos o cliente fez sozinho? Se esse número não subir com o tempo, o produto não está funcionando.

### 3.5 Por barbeiro

Uma tabela, uma linha por barbeiro: atendimentos, faturamento, ticket médio, **ocupação**, taxa de falta, clientes novos, taxa de retorno.

Retenção por barbeiro é a métrica que separa "tem clientela própria" de "pega o que cai" — 8 de 19 produtos têm, nenhum brasileiro com esse recorte.

## 4. Comissão

Merece seção própria porque é o número central da operação — **a maior despesa da barbearia, maior que o aluguel** — e porque é o único da Fase 1 que precisa de configuração.

**Configuração mínima:** um percentual por barbeiro, em `staff.commissionPercent` (inteiro, nullable). Nulo = barbeiro sem comissão, e a linha some do relatório.

**Cálculo:** `faturamento DONE do barbeiro no período × percentual`. Base é o bruto do que ele produziu — que é o padrão descrito no setor.

**O relatório mostra atendimento por atendimento**, não só o total. É isso que resolve o problema real: as quatro brigas típicas do fechamento são divergência de valor, atendimento não registrado, cliente que faltou e o que compõe a base. A frase que resume o setor é *"sem registro, não tem argumento"* — e o registro é o que temos.

**Fora da Fase 1, e registrado para não virar surpresa:** comissão progressiva por faixa, comissão diferente por serviço, comissão de produto, e o **Salão Parceiro (Lei 13.352/2016)**. Este último não é detalhe fiscal: exige separar a cota-parte do salão e a do profissional **por atendimento**, porque isso vai para a nota fiscal e a cota do profissional não integra a receita bruta do salão. É requisito de software, e quando entrar muda o modelo de dados.

## 5. A tela

Rota nova: **`/app/resumo`**, primeira posição na sidebar, antes da Agenda. A agenda continua sendo o que o balcão abre o dia inteiro; o resumo é onde o dono vai quando senta.

**Seletor de período** no topo: Semana (padrão), Mês, Hoje, e um intervalo livre. A semana é a cadência que o setor recomenda.

**Primeira dobra — quatro cards**, seguindo o que Phorest, Booksy, Vagaro e BestBarbers puseram na deles:

1. **Faturamento** do período, com comparação com o período anterior
2. **Ocupação** em %, com as horas vagas embaixo
3. **Ticket médio**
4. **Taxa de falta**, com a receita perdida embaixo

**Depois, em cards:**

- **Ocupação por hora** — o gráfico, com os dias da semana como legenda
- **Por barbeiro** — a tabela
- **Clientes sumidos** — lista com WhatsApp, ordenada por quão atrasado está em relação ao próprio ritmo
- **Clientes** — atendidos, novos vs recorrentes, tempo médio entre visitas, taxa de retorno
- **Comissão** — total por barbeiro, com link para o detalhe atendimento a atendimento

**Estados vazios**, que aqui não são detalhe: barbearia sem histórico, semana sem atendimento e barbeiro sem comissão configurada precisam explicar o que fazer, não mostrar zero.

**No celular** os cards empilham e a tabela por barbeiro vira lista — o mesmo tratamento que a agenda recebeu.

## 6. O que fica de fora, e por quê

**Custo, margem e lucro real.** É o maior ganho por esforço que a pesquisa apontou: com três números do dono — custo de insumo por serviço, taxa da maquininha e custo fixo mensal — o sistema salta de "quanto entrou" para "quanto sobrou", que é a distância entre o que ele olha hoje e o que deveria. Fica para a Fase 3 porque exige cadastro, e a Fase 1 se sustenta sem pedir nada.

**Caixa.** Faturamento não é caixa: cartão em D+30 não entrou hoje. Separar os dois exige saber meio de pagamento e prazo de recebimento, que o produto não registra.

**Estoque, produto e retail attachment.** Zero produtos brasileiros têm — é oportunidade —, mas o produto não vende produto. Exige módulo.

**Rebooking rate.** Zero produtos brasileiros têm e nós teríamos o dado, mas o fluxo não incentiva remarcar na saída, então o número nasceria em zero e não ensinaria nada. Volta quando existir remarcação.

**Coorte de retenção.** Só o Trinks tem no Brasil. Precisa de 6 a 12 meses de histórico para dizer qualquer coisa.

**Clube de assinatura.** Peça central do mercado (uma plataforma reporta 48% da base com clube), mas exige cobrança recorrente, que é outro produto.

**Alerta proativo** quando um indicador cai — só o Gendo tem, com IA. Depende de ter série histórica para saber o que é queda.

## 7. Ordem

1. **Dinheiro e comportamento** — faturamento, ticket, falta, cancelamento, origem. Sai direto de `appointment`, sem configuração.
2. **Tempo** — ocupação, horas vagas, por dia e por hora. É o diferencial competitivo e exige cruzar com `working_hours` e `time_off`.
3. **Cliente** — sumidos, novos vs recorrentes, tempo entre visitas, retorno.
4. **Comissão** — a migration do percentual e o relatório detalhado.

Os quatro entregam sozinhos. O 2 é o que nenhum concorrente brasileiro tem, e o 4 é o que o dono mais vai usar.

## 8. Ressalva de método

A pesquisa que embasa este documento tem viés conhecido: a maior parte do conteúdo de gestão de barbearia no Brasil é produzida por fornecedores de software. Os números de mercado citados (15–20% de no-show, 48% com clube de assinatura) são referências comerciais, não estatística setorial, e estão marcados como tal na pesquisa.

O que **não** tem viés são as fórmulas — Square, Boulevard, Phorest e Zenoti publicam o cálculo exato de ocupação e retenção, incluindo o que entra no denominador. É de lá que este documento tira as definições.
