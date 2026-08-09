# Encaixe nas pontas e fila de espera

**Data:** 2026-08-09
**Status:** aprovado (design)
**Escopo:** duas mudanças que atacam o mesmo problema — horário que existe e não é vendido

---

## 1. O problema

A Fase 1 usa grade fixa: serviço de 45 minutos numa grade de 30 ocupa 60, e a folga de 15
minutos não volta para a grade. Foi escolha consciente — agenda legível vale mais que ocupação
máxima —, e continua valendo.

O que a conversa com o dono revelou é outra coisa, e é mais séria: **o produto está matando o
canal que compensava essa escolha.**

Numa barbearia de papel o barbeiro também tem buraco na agenda. A diferença é que ele *enxerga*
o buraco e o preenche quando alguém liga. O sistema esconde o buraco do cliente e mantém a
válvula de escape — o encaixe pelo balcão — dependendo justamente do telefonema que o produto
existe para eliminar. Quanto melhor o sistema funcionar, menos gente liga, e mais buraco fica
vazio. **O defeito cresce junto com a adesão.**

Duas perdas distintas, com tamanhos muito diferentes:

| Perda | Tamanho | Recuperável? |
|---|---|---|
| Arredondamento da grade | 15 min por atendimento | Quase nunca — nenhum serviço do catálogo cabe em 15 min |
| Horário cancelado | 30 a 90 min | Sim, e é aqui que está o dinheiro |
| Cliente que não achou horário compatível | o atendimento inteiro | Sim |

A primeira linha é a que parece mais óbvia e é a que menos importa. As outras duas são o alvo
deste documento.

## 2. As duas mudanças

**Encaixe nas pontas** (§3) — o motor passa a oferecer, além da grade, o horário encostado no
início e no fim de cada espaço livre. Resolve o cliente que só pode chegar 15:05 e resolve o
tempo que sobra depois de um encaixe desalinhar a grade.

**Fila de espera** (§4) — quando o dia está cheio, o cliente entra na fila em vez de ir embora.
Quando alguém cancela, os primeiros da fila recebem WhatsApp com link direto para o horário que
abriu.

São independentes: uma pode ir sem a outra. Mas se apoiam no mesmo motor de disponibilidade, e
a fila só é útil porque o encaixe já garante que a vaga liberada será oferecida por inteiro.

**Fora de escopo:** solicitação de encaixe que o barbeiro aprova (cria trabalho para ele e
espera para o cliente, sendo que o sistema já sabe se cabe); folga entre atendimentos
(§6); prioridade paga na fila.

## 3. Encaixe nas pontas

### 3.1 A regra

Hoje `computeAvailability` caminha de `slotMinutes` em `slotMinutes` a partir do início de cada
bloco de expediente. Passa a fazer **duas passagens**:

1. **Grade** — exatamente o que faz hoje. Nada muda.
2. **Pontas** — para cada espaço livre dentro do expediente, dois candidatos:
   - encostado no **início** do espaço;
   - encostado no **fim** do espaço, isto é, `fimDoEspaço − duraçãoOcupada`.

Candidato que cair fora do espaço, colidir com ocupado, furar a antecedência mínima ou
coincidir com um da primeira passagem é descartado.

### 3.2 Por que só as duas pontas

Porque as duas pontas **cobrem toda a faixa de chegada do cliente**. Espaço livre das 15:00 às
16:00, serviço de 45 minutos:

- encostado no início: **15:00** (termina 15:45)
- encostado no fim: **15:15** (termina 16:00)

Quem consegue chegar 14:55 pega o primeiro. Quem só consegue 15:05 pega o segundo. Ninguém
precisa de 15:07 — entre as duas pontas não existe cliente que uma delas não atenda.

Oferecer todo minuto transformaria uma lista de 8 horários em 30, e a tela da Fase 1 ficou boa
justamente por ser curta. Duas pontas por espaço adicionam meia dúzia de horários num dia
cheio, e boa parte coincide com a grade e desaparece.

### 3.3 O que isso recupera, e o que não recupera

**Não recupera** ocupação no caso simples. Se o cliente pega 15:00, sobram 15 minutos mortos no
fim; se pega 15:15, sobram 15 no começo. O desperdício é o mesmo, só muda de lugar.

**Recupera** em dois casos, e os dois são frequentes:

- **O cliente que não marcaria.** Quem só pode 15:15 e não vê 15:15 não marca. Não são 15
  minutos perdidos: são 45 minutos vazios e um cliente que ligou ou sumiu.
- **A grade desalinhada.** Encaixe começa em hora quebrada. Um walk-in das 14:35 às 14:55
  deixa o resto do dia desalinhado, e sem a segunda passagem o próximo horário oferecido é
  15:30 quando poderia ser 14:55. Isso fica mais comum à medida que o balcão usa o encaixe.

### 3.4 Antecedência mínima

O encaixe do balcão ignora `minLeadMinutes` de propósito — quem manda é o barbeiro, com o
cliente na frente dele. **A segunda passagem da superfície pública não pode ignorar.** Vale a
mesma antecedência mínima da grade: sem isso alguém marca para daqui a dois minutos e chega
atrasado, e o barbeiro é quem paga.

### 3.5 Como aparece na tela

Não aparece diferente. É um horário livre como qualquer outro, na mesma grade de manhã, tarde e
noite. Marcar o horário como "encaixe" pediria explicação ao cliente e não muda nada para ele.

O barbeiro é quem precisa saber: no painel, agendamento cujo início não cai na grade continua
recebendo a marca de fora-da-grade que já existe.

### 3.6 Onde mexe

- `src/domain/availability/compute.ts` — a segunda passagem. Continua função pura, sem I/O.
- `src/domain/availability/types.ts` — nada muda na entrada: `busy` e `workingBlocks` já
  trazem tudo o que é preciso.
- Nada muda em `getAvailability`, nas rotas ou na tela. A grade simplesmente vem mais completa.

## 4. Fila de espera

### 4.1 O fluxo

O cliente escolhe serviço e barbeiro, chega na tela de horários e o dia que ele quer está cheio.
Em vez de um beco, aparece **"Me avise se abrir vaga"**. Ele deixa nome e telefone — os mesmos
dois campos do agendamento — e entra na fila daquele dia.

Quando um agendamento é cancelado, o sistema procura quem na fila daquele dia **cabe naquela
vaga** e manda WhatsApp com link direto.

### 4.2 A vaga precisa caber

Este é o detalhe que faz a diferença entre uma funcionalidade útil e um gerador de frustração.

Vaga de 30 minutos que abriu não serve para quem quer luzes de 90. A fila casa **duração**, não
só dia:

- a inscrição guarda `serviceId` (e portanto a duração efetiva do barbeiro, se houver override);
- ao abrir vaga, o sistema roda o motor de disponibilidade para aquele dia e verifica se existe
  slot compatível com o serviço da inscrição.

Reusar o motor em vez de comparar minutos na mão é o que garante que expediente, bloqueios e
antecedência mínima continuem valendo.

### 4.3 Para quantos avisar

O ponto onde uma implementação ingênua estraga tudo.

- **Avisar só o primeiro** e esperar resposta: se ele estiver ocupado, a vaga fica parada e o
  buraco continua.
- **Avisar todo mundo**: cinco correm, uma pessoa pega, quatro recebem "já foi" e ficam com
  raiva do produto.

**Decisão: avisar os 3 primeiros da fila, sem reserva.** Quem chegar primeiro leva — é o mesmo
409 que o produto já trata bem. Quem perder recebe uma mensagem honesta de que a vaga foi e que
ele **continua na fila**. Nada de promessa que o sistema não pode cumprir.

Ordem da fila: por hora de inscrição. Sem prioridade, sem sorteio.

### 4.4 Quando a fila expira

- Inscrição vale para **um dia específico**, e morre quando aquele dia acaba.
- Cliente que consegue marcar naquele dia sai da fila automaticamente.
- Limite de 3 inscrições ativas por telefone por barbearia, para não virar entulho.

### 4.5 Dados

Uma tabela: **`waitlist`** — `barbershopId`, `customerId`, `serviceId`, `staffId` (nulo =
qualquer barbeiro), `date` (o dia desejado, no calendário da barbearia), `createdAt`,
`notifiedAt`, `status` (`WAITING` | `NOTIFIED` | `BOOKED` | `EXPIRED`).

Único por `(barbershopId, customerId, date, serviceId)`: entrar duas vezes na mesma fila é
sempre engano.

O cliente reusa `customer`, que já existe e já é chaveado por telefone dentro do tenant.

### 4.6 Notificação

`notificationLog.type` ganha um quarto valor: **`WAITLIST_SLOT`**. A idempotência que já existe
por `(appointmentId, type)` não serve aqui — o aviso é por inscrição, não por agendamento —,
então o log ganha `waitlistId` nullable e a unicidade passa a considerá-lo.

Template novo, `agendamento_vaga_abriu`, com o mesmo formato dos três que já existem, mais o
link que leva direto ao horário. Precisa ser aprovado na Meta antes de ligar.

O disparo segue o padrão da Fase 1: `after()` do Next, nunca `void`, e log antes do envio para
não duplicar sob concorrência.

### 4.7 Onde mexe

- `src/db/schema/waitlist.ts` — tabela nova; migration.
- `src/db/schema/notification.ts` — quarto tipo e `waitlistId`.
- `src/domain/waitlist/` — entrar na fila, casar vaga com inscrição, expirar.
- `src/domain/booking/cancel-appointment.ts` — **não** dispara direto. Quem dispara são os dois
  chamadores (`agendamento/[token]/actions.ts:27` e `app/agenda/actions.ts:23`), pelo mesmo
  padrão que já usam para o aviso de cancelamento. O domínio continua sem I/O de rede.
- `src/notifications/templates.ts` — o template novo.
- `src/app/b/[slug]/steps/slot-step.tsx` — o "Me avise se abrir vaga" no estado vazio.
- Painel: a fila do dia visível na agenda, para o barbeiro saber que há gente esperando.

## 5. Ordem

1. **Encaixe nas pontas.** É uma função pura, sem banco, sem tela, sem migration. Entrega
   sozinho e melhora a grade de todo mundo no mesmo dia.
2. **Fila de espera.** Depende de migration, template aprovado na Meta e tela nova.

A fila vale mais em dinheiro, mas o encaixe é tão barato que sai primeiro.

## 6. O que ficou de fora, e por quê

**Folga entre atendimentos.** Hoje o sistema encosta um atendimento no outro, e o barbeiro
provavelmente quer alguns minutos para varrer e tomar água. Se essa folga existir, ela muda o
cálculo do encaixe nas pontas — o "fim do espaço" passa a ser o fim menos a folga. É um campo
por barbearia e uma linha no motor, mas é decisão do dono, não nossa. Perguntar antes.

**Prioridade na fila.** Cliente fiel primeiro, ou quem paga mais. Complica a explicação e não
foi pedido.

**Aviso de vaga por outros canais.** Só WhatsApp, que é onde o cliente já está.
