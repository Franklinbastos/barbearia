# Agenda para Barbearias — Fase 1

**Data:** 2026-08-05
**Status:** aprovado (design)
**Escopo:** Fase 1 — agendamento online multi-barbearia com página pública e notificação por WhatsApp

---

## 1. Problema

Barbearias marcam horário por WhatsApp, no papel ou na cabeça do barbeiro. Três coisas quebram:
o cliente não enxerga o que está livre e fica esperando resposta; o barbeiro perde tempo respondendo
mensagem no meio do corte; e o horário marcado some quando ninguém anota.

O sistema resolve o primeiro e o terceiro de forma direta: o cliente vê a grade real e marca sozinho,
e o horário fica registrado no lugar certo. O segundo cai por consequência — quem marca sozinho não
manda mensagem.

Referência de mercado: agendeonline / salonsoft.

## 2. Decisões que fecham o escopo

| Decisão | Escolha |
|---|---|
| Relação com o Tempra | Repo novo, reaproveitando peças e padrões (não é vertical do Tempra) |
| Tenancy | SaaS multi-barbearia desde o dia 1 |
| Canal do cliente | Página pública por barbearia; WhatsApp entra só como notificação de saída |
| Motor de horários | Grade fixa; serviço ocupa N slots inteiros |
| Dinheiro | Fora da Fase 1 — nem cobrança do cliente, nem assinatura da barbearia |
| Stack | Next.js (App Router) + Postgres + Drizzle, TypeScript ponta a ponta |
| Bot conversacional | Fase 2, com spec próprio |

**Fora do escopo da Fase 1**, explicitamente: bot de WhatsApp conversacional, pagamento/sinal,
assinatura do SaaS, comissão de barbeiro, controle de estoque/produtos, fidelidade, relatórios
financeiros, app nativo.

## 3. Arquitetura

Um app Next.js com três superfícies no mesmo repositório:

```
[ Cliente final ]                    [ Dono / Barbeiro ]
       |                                     |
   /b/[slug]  (público, sem login)       /app  (Better-Auth)
       \                                     /
        \___________  Next.js  ____________/
                         |
              [ camada de repositório ]   <- exige tenantId
                         |
                  [ Postgres (Neon) ]
                         |
              [ cron Vercel: lembretes ]
                         |
              [ NotificationSender ] -> Meta WhatsApp Cloud API
```

**Por que monolito TypeScript:** uma linguagem e um repo reduzem o contexto necessário por tarefa de
implementação e encurtam o ciclo de build. Como a implementação é 100% guiada por IA, isso é critério
de arquitetura, não conforto.

**Deploy:** Vercel (app + cron). Banco: Neon (Postgres gerenciado, branch por ambiente).
**Auth:** Better-Auth, sessão em banco. Só dono e barbeiro logam. Cliente final nunca cria conta.
**Notificação:** interface `NotificationSender` com implementação `MetaWhatsAppSender`. Trocar de
provider — ou plugar o bot da Fase 2 — é trocar a implementação, não o chamador.

### Módulos

| Módulo | Responsabilidade | Depende de |
|---|---|---|
| `domain/availability` | Cálculo de horários livres. Funções puras, sem I/O. | nada |
| `domain/booking` | Regras de criar/cancelar/remarcar agendamento. | `availability` |
| `db/schema` | Tabelas Drizzle e migrations. | nada |
| `db/repositories` | Acesso ao banco, sempre escopado por tenant. | `db/schema` |
| `app/(public)` | Página pública de agendamento. | `booking`, repos |
| `app/(panel)` | Painel da barbearia. | `booking`, repos |
| `notifications` | Envio, template e log idempotente. | repos |
| `jobs/reminders` | Rota de cron que varre a janela e dispara lembretes. | `notifications` |

`domain/availability` não importa nada de banco nem de framework. É a garantia de que a regra mais
crítica do produto é testável em milissegundos.

## 4. Modelo de dados

Todas as tabelas de negócio carregam `barbershopId`. Timestamps em `timestamptz` (UTC no banco,
conversão na borda usando o fuso da barbearia).

**`barbershop`** — tenant. `slug` (único, é a URL pública), `name`, `timezone` (ex.: `America/Sao_Paulo`),
`slotMinutes` (padrão 30), `minLeadMinutes` (antecedência mínima), `maxAdvanceDays` (janela máxima),
`phone`.

**`staff`** — barbeiro. `barbershopId`, `name`, `photoUrl`, `role` (`OWNER` | `BARBER`), `active`,
`userId` (opcional — barbeiro que não loga também existe na agenda).

**`service`** — `barbershopId`, `name`, `durationMinutes`, `priceCents`, `active`, `sortOrder`.

**`staff_service`** — junção. `staffId`, `serviceId`, `durationMinutesOverride` (nulo = usa o do
serviço). Barbeiro rápido corta em 20 onde o padrão da casa é 30.

**`working_hours`** — `staffId`, `weekday` (0-6), `startTime`, `endTime`. Vários registros por dia
formam blocos, o que dá a parada do almoço de graça.

**`time_off`** — bloqueio pontual. `staffId`, `startAt`, `endAt`, `reason`. Férias, médico, ou o
barbeiro fechando um pedaço da tarde.

**`customer`** — `barbershopId`, `name`, `phone`, `notes`. Chave natural: `(barbershopId, phone)` única.
O mesmo telefone em duas barbearias são dois clientes.

**`appointment`** — `barbershopId`, `staffId`, `customerId`, `startAt`, `endAt`, `status`
(`BOOKED` | `DONE` | `CANCELED` | `NO_SHOW`), `origin` (`PUBLIC` | `PANEL` | `BOT`), `manageToken`,
e o **snapshot** do serviço: `serviceNameSnapshot`, `servicePriceCentsSnapshot`,
`serviceDurationMinutesSnapshot`, mais `serviceId` como referência frouxa.

O snapshot segue a decisão já validada no Tempra: mudar o preço amanhã não pode reescrever o que
aconteceu ontem. Apagar um serviço não apaga o histórico.

Note a distinção: `serviceDurationMinutesSnapshot` guarda a duração **real** do serviço (45 min),
enquanto `endAt` guarda o fim do bloco **ocupado** na grade (60 min). Os dois números são diferentes
de propósito — ver seção 5.

**`notification_log`** — `appointmentId`, `type` (`CONFIRMATION` | `REMINDER` | `CANCELLATION`),
`sentAt`, `providerMessageId`, `status`. Único por `(appointmentId, type)`: essa unicidade é o que
torna o cron idempotente.

### Constraint de sobreposição

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE appointment ADD CONSTRAINT appointment_no_overlap
  EXCLUDE USING gist (
    staff_id WITH =,
    tstzrange(start_at, end_at, '[)') WITH &&
  ) WHERE (status <> 'CANCELED');
```

Duas pessoas clicando no mesmo horário no mesmo segundo é o caso normal, não a exceção. A aplicação
não tem como impedir isso sozinha sem lock; o banco tem. O `WHERE` deixa o horário voltar a ficar
livre quando o agendamento é cancelado.

## 5. Motor de disponibilidade

O coração do sistema, e o módulo mais testado.

```
computeAvailability({
  date, timezone, slotMinutes, minLeadMinutes,
  workingBlocks,      // blocos de expediente do barbeiro naquele dia
  timeOff,            // bloqueios pontuais que tocam o dia
  appointments,       // agendamentos ativos do barbeiro naquele dia
  serviceDuration,    // duração efetiva (override do barbeiro, ou a do serviço)
  now,
}) -> Array<{ startAt, endAt }>
```

Algoritmo:

1. Para cada bloco de expediente, gerar candidatos de início a cada `slotMinutes` a partir do início
   do bloco.
2. `slotsNecessarios = ceil(serviceDuration / slotMinutes)`.
   Ocupação = `slotsNecessarios * slotMinutes`.
3. Descartar o candidato se:
   - a ocupação passa do fim do bloco de expediente (não emenda com o bloco seguinte — o intervalo
     existe por um motivo);
   - a ocupação intersecta qualquer `appointment` ativo ou `time_off`;
   - `startAt < now + minLeadMinutes`.
4. Devolver os candidatos que sobraram.

**A regra da folga:** grade de 30, serviço de 45 → 2 slots → 60 min ocupados. Os 15 minutos de sobra
ficam com o barbeiro e não voltam pra grade. Isso é escolha de produto, não limitação: agenda que o
barbeiro consegue ler de relance vale mais que ocupação máxima.

**"Qualquer barbeiro":** roda o cálculo para cada barbeiro habilitado no serviço e devolve a união dos
horários. Na confirmação, escolhe entre os que ainda estão livres — desempate pelo que tem menos
agendamentos no dia, para distribuir.

**Fuso:** o cálculo trabalha em horário local da barbearia e converte para UTC só na saída. Um dia de
virada de horário de verão tem 23 ou 25 horas, e a grade precisa refletir isso.

## 6. Fluxos

### Público — `/b/[slug]`

Serviço → barbeiro (ou "qualquer") → dia e horário → nome e telefone → confirmado.

Sem conta, sem senha, sem e-mail. O cliente recebe um link com `manageToken` (HMAC assinado, escopado
a um agendamento, com validade) por onde cancela ou remarca sozinho. O mesmo link vai na mensagem de
WhatsApp.

Na gravação, a disponibilidade é **recalculada no servidor**. O horário que o navegador mostrou é uma
sugestão, nunca uma reserva. Se a constraint recusar, a resposta é 409 e a tela recarrega a grade
dizendo que o horário acabou de sair.

### Cadastro da barbearia — `/signup`

O dono se cadastra (nome, e-mail, senha), escolhe o slug e o fuso. Isso cria, numa transação:
o `barbershop`, o `staff` com `role = OWNER` ligado ao usuário, e um expediente padrão de segunda a
sábado que ele ajusta depois. Barbearia recém-criada sem serviço cadastrado mostra página pública com
aviso de "agenda ainda não disponível", nunca uma grade vazia sem explicação.

Barbeiros são criados pelo dono dentro do painel. Barbeiro com login recebe convite por e-mail;
barbeiro sem login existe só como coluna na agenda.

### Painel — `/app`

A tela principal é a **agenda do dia em colunas por barbeiro**. É onde o barbeiro passa o expediente e
de onde saem o encaixe e o walk-in (agendamento manual, com `origin = PANEL`, e — só aqui — permissão
de forçar horário fora da grade, porque o barbeiro sabe o que está fazendo).

O resto é cadastro: serviços, barbeiros, expediente, bloqueios, configuração da barbearia e lista de
clientes com histórico.

### Notificações

- **Confirmação** — na hora do agendamento.
- **Lembrete** — algumas horas antes. Uma rota de cron da Vercel varre a janela, pega agendamentos
  `BOOKED` sem `REMINDER` no log e dispara.
- **Cancelamento** — quando cliente ou barbearia cancela.

Templates da Meta Cloud API (mensagem iniciada pelo negócio exige template aprovado). Idempotência
pela unicidade `(appointmentId, type)`: cron que roda duas vezes não manda dois lembretes.

## 7. Segurança

**Isolamento entre tenants** é o risco número 1 de um SaaS multi-empresa. Mitigação em camadas:

- Nenhuma query solta em componente ou rota. Todo acesso passa por `db/repositories`, e cada função
  de repositório recebe `barbershopId` como primeiro parâmetro obrigatório.
- O `barbershopId` vem da sessão no painel e do slug na página pública — nunca de parâmetro que o
  cliente controla.
- Teste de integração dedicado que tenta ler dado de outro tenant por cada rota e espera falha.

**Superfície pública:** resolve o tenant pelo slug e devolve apenas serviços, barbeiros e horários
livres. Nome, telefone ou histórico de cliente jamais trafegam por ali.

**Rate limit** por IP e por telefone na consulta de grade e na criação de agendamento. Sem isso, a
página pública é um formulário aberto para floodar a agenda de uma barbearia.

**`manageToken`:** HMAC com segredo do servidor, escopado a um `appointmentId`, com expiração. Não é
sequencial e não é adivinhável.

**LGPD:** telefone é dado pessoal. Não vai para log em claro; a barbearia só enxerga os próprios
clientes; e existe rota de exclusão de cliente que anonimiza mantendo o histórico agregado.

**Segredos** em variáveis de ambiente, validadas no boot — o app não sobe com env faltando.

## 8. Testes

| Camada | Alvo | Ferramenta |
|---|---|---|
| Unit | `computeAvailability` e regras de `booking` | Vitest |
| Integração | Constraint de sobreposição, isolamento de tenant, repositórios | Vitest + Postgres real |
| E2E | Fluxo público: agendar e cancelar | Playwright |

Casos que **precisam** existir no unit de disponibilidade, porque são os que quebram agenda na vida
real:

- serviço maior que o slot (45 em grade de 30) ocupando 2 slots;
- serviço que não cabe no fim do bloco de expediente;
- serviço que tentaria emendar dois blocos por cima do intervalo de almoço;
- bloqueio (`time_off`) parcial no meio do dia;
- dia inteiro ocupado → lista vazia, não erro;
- `minLeadMinutes` cortando os horários de hoje;
- dia de virada de horário de verão;
- barbeiro sem expediente naquele dia da semana.

Meta de cobertura: 90% em `domain/`, 80% no restante.

## 9. Convenções

- Limite orientativo de **400 linhas** por arquivo. Arquivo que cresce demais é sinal de módulo
  fazendo coisa demais.
- Textos visíveis em pt-BR com acentuação correta, UTF-8 sem BOM.
- Migrations pelo Drizzle Kit, versionadas, uma por alteração de schema.
- Commits: `tipo(area): resultado para o usuário`.

## 10. O que vem depois

**Fase 2 — bot conversacional de WhatsApp.** Agendamento por conversa, aproveitando o que já foi
aprendido no `agent-orchestrator` do Tempra. Spec próprio. A interface `NotificationSender` e o campo
`origin = BOT` já deixam o lugar reservado.

**Fase 3 — monetização.** Assinatura da barbearia e, se o mercado pedir, sinal antecipado do cliente
contra no-show.
