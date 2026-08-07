# Review da Fase 1 — 2026-08-06

Escopo: 19 commits, de `0252b40` a `100cc41`. Comparado contra
`docs/superpowers/specs/2026-08-05-agenda-barbearia-fase1-design.md`.

Método: leitura direta dos módulos críticos, quatro revisores paralelos
(segurança, domínio, frontend, infra) e execução da suíte.

**Estado da suíte:** 125/125 passam (`npx vitest run`, com o Postgres da
`docker-compose.yml` no ar). Cobertura global de 76,87% — abaixo dos 80% que a
seção 8 do spec pede, e sem `thresholds` configurado, então `npm run test:cov`
nunca falha por isso. `src/domain/availability` está em 97% e cumpre a meta de
90%.

Cada achado abaixo diz como foi apurado: **[executado]** quando rodei código que
prova o comportamento, **[lido]** quando confirmei no fonte, **[revisor]** quando
vem de um dos revisores com arquivo e linha citados e eu não reexecutei.

---

## Bloqueadores

### 1. A corrida por horário devolve 500, não 409 — [executado]

`src/domain/booking/errors.ts:27`

`isExclusionViolation` procura `erro.code`, mas o Drizzle embrulha o erro do
driver num `DrizzleQueryError` e o código do Postgres fica em `erro.cause.code`.
Escrevi um teste com duas chamadas simultâneas de `createAppointment` no mesmo
horário e rodei:

```
CONSTRUCTOR: DrizzleQueryError
code: undefined | cause.code: 23P01
AssertionError: expected Error: Failed query: insert into "appoint…
  to be an instance of SlotTakenError
```

Ou seja: `create-appointment.ts:60` nunca converte, o erro cru sobe,
`api-error.ts` cai no ramo genérico e a resposta é **500 INTERNAL**. O
`contact-step.tsx:47` só trata 409, então o cliente vê "Não foi possível
concluir. Tente de novo." e a grade não recarrega.

É exatamente o caso que a seção 4 do spec chama de "o caso normal, não a
exceção" — e é a única razão pela qual a constraint `EXCLUDE` existe.

Por que passou batido: `tests/integration/public-api.test.ts:119` assere
`toMatch(/SLOT_/)`, que casa com `SLOT_UNAVAILABLE` também. As duas chamadas são
sequenciais, então param no recálculo da grade e nunca chegam à constraint. O
teste chamado "devolve 409 quando o horário já foi tomado" nunca tocou o caminho
que diz testar.

Correção — percorrer a cadeia de `cause`:

```ts
export function isExclusionViolation(erro: unknown): boolean {
  for (let e: unknown = erro; e != null; e = (e as { cause?: unknown }).cause) {
    if (typeof e === 'object' && 'code' in e && (e as { code: unknown }).code === '23P01') {
      return true;
    }
  }
  return false;
}
```

E trocar o `/SLOT_/` por asserções distintas, mais um teste de corrida real com
`Promise.allSettled`.

### 2. Endpoint público vira canal de mensagem arbitrária — [lido]

`src/db/repositories/customer.repo.ts:13` + `src/notifications/templates.ts:28`

`upsertCustomer` faz `onConflictDoUpdate` em `(barbershopId, phone)` e
**sobrescreve o `name`** com texto vindo de requisição anônima. Esse mesmo nome
entra como primeiro parâmetro do template aprovado na Meta e é enviado para o
telefone informado.

Quem souber o telefone de um cliente da barbearia manda
`POST /api/public/{slug}/appointments` com `name` sendo qualquer texto: o
cadastro daquele cliente é renomeado no painel, o agendamento falso entra no
histórico dele, e o WhatsApp verificado da barbearia dispara a mensagem. O limite
é 5/hora por telefone — sobra para spam dirigido e para a Meta banir o número da
barbearia por violação de template.

Agrava: `name` é `min(2)` **sem `max()`** (`appointments/route.ts:17`).

Correção: não sobrescrever `name` de cliente existente pela superfície pública
(`onConflictDoNothing`, ou só atualizar quando o registro não tem nome), pôr
`max(80)`, e recusar caracteres de controle e URL no nome.

### 3. Dono pode se trancar fora da barbearia — [lido]

`src/app/app/equipe/actions.ts:39` + `src/app/app/equipe/page.tsx:37` +
`src/lib/session.ts:22`

`toggleStaffAction` não verifica papel, e `<ToggleStaffButton>` é renderizado em
**toda** linha da equipe, inclusive a do dono. Um clique desativa o próprio
OWNER. `requireSession` exige `staff.active = true`, então o dono passa a cair em
`redirect('/signup')` — e o signup falha com "e-mail já em uso". Não há rota de
recuperação.

Alcançável hoje, por acidente, com um clique.

Correção: esconder o toggle da própria linha e recusar no servidor a desativação
do último OWNER ativo.

### 4. Encaixe do balcão está bloqueado — [revisor, confirmado por leitura]

`src/app/app/agenda/actions.ts:39` → `src/domain/booking/create-appointment.ts:27`

A seção 6 do spec diz que o painel — e só ele — pode forçar horário fora da
grade. `createManualAppointmentAction` chama o mesmo `createAppointment` do
público, que recalcula a disponibilidade e recusa. Não existe flag de bypass em
lugar nenhum, e o `<select>` de horário é populado pelo endpoint público.

Com o `minLeadMinutes` padrão de 60: são 14:05, o barbeiro está livre, entra um
cliente para uma barba de 20 minutos — o painel só oferece 15:30. O caso de uso
mais comum da barbearia não funciona.

O plano registrou isso como "primeira melhoria pós-lançamento", mas o spec põe no
escopo da Fase 1. Decidir explicitamente: ou implementa, ou sai do spec.

---

## Graves

### 5. `maxAdvanceDays` só existe no navegador — [lido]

`src/domain/booking/availability-service.ts`, `create-appointment.ts`

Nenhum dos dois consulta o campo. `grep maxAdvanceDays src/` só acha o schema, a
tela de configurações, a resposta do catálogo e o componente que monta a fileira
de dias. Um POST direto agenda para daqui a três anos.

### 6. Notificação pode nunca sair na Vercel — [lido]

`src/app/api/public/[slug]/appointments/route.ts:66`,
`src/app/agendamento/[token]/actions.ts:33`

`void notifyOnce(...)` é fire-and-forget e não há `waitUntil` nem `after` no
projeto inteiro (`grep` não retorna nada). Em serverless a execução é congelada
quando a resposta sai; a confirmação e o aviso de cancelamento morrem no meio.

Correção: `after()` do `next/server` (App Router) nas duas chamadas.

### 7. Override de duração aceita zero e derruba a grade com 500 — [lido]

`src/app/app/equipe/[staffId]/actions.ts:47`

`override ? Number(override) : null` — a string `'0'` é truthy, então grava `0`.
O `coalesce` de `staff.repo.ts:36` não troca zero (só troca NULL), e
`computeAvailability` lança. Resultado: 500 em toda consulta de horário daquele
serviço, pública e no painel. O `min={1}` do formulário é só no cliente.

Aceita negativo e valores acima do teto de 8h que `service-rules.ts` impõe aos
serviços.

### 8. `.env.example` traz segredos que passam na validação — [revisor]

`.env.example:2,3,9`

`AUTH_SECRET` (38 caracteres), `MANAGE_TOKEN_SECRET` (35) e `CRON_SECRET` (32)
satisfazem os `min()` de `src/lib/env.ts`. O `README.md:17` manda
`cp .env.example .env`. Se um desses chega em produção: `AUTH_SECRET` público
permite forjar sessão de qualquer barbearia; `MANAGE_TOKEN_SECRET` público
permite cancelar agendamento alheio.

A promessa da seção 7 do spec ("o app não sobe com env faltando") dá falsa
segurança — a validação é só de comprimento.

Correção: valores `CHANGE_ME` no exemplo e um `.refine` recusando os literais.

### 9. Pool de conexão errado para serverless — [revisor]

`src/db/client.ts:7`

`postgres(url, { max: 5 })` com o `idle_timeout: null` padrão do postgres.js —
conexão ociosa nunca fecha. Cada instância de função segura até 5. Um Neon em
0.25 CU tem ~112 conexões: ~22 instâncias mornas estouram e a página pública
passa a dar 500 em massa. O `docs/deploy.md:7` também não distingue o endpoint
com pooler.

Correção: `{ max: 1, idle_timeout: 20, connect_timeout: 10 }`, `DATABASE_URL` de
produção apontando para o host `-pooler`, mantendo o endpoint direto para as
migrations.

### 10. `notifyOnce` não é idempotente sob concorrência — [revisor]

`src/notifications/notify.ts:20`

O padrão é SELECT-depois-envia, e o INSERT usa `onConflictDoUpdate`, que engole a
violação da unique em vez de usá-la como trava. Duas execuções sobrepostas do
cron passam as duas pelo SELECT e mandam dois lembretes. A seção 6 do spec
promete o contrário.

O teste de idempotência chama as duas vezes em sequência, então passa sem provar
nada sobre concorrência.

Correção: reservar a linha com `onConflictDoNothing().returning()` **antes** de
enviar; se não voltou nada, `SKIPPED`. Depois do envio, `update` com o
`providerMessageId`.

### 11. Confirmação mostra o dia errado à noite — [lido]

`src/app/b/[slug]/steps/done-step.tsx:5`

`resultado.startAt.slice(0, 10)` corta a data do ISO **em UTC**, enquanto a hora
ao lado é convertida para o fuso da barbearia. Em `America/Sao_Paulo`, qualquer
agendamento a partir das 21:00 exibe o dia seguinte com a hora certa.

Mesma classe de erro em `src/app/app/clientes/[customerId]/page.tsx:34`, onde
`toLocaleString('pt-BR')` roda sem `timeZone` — no servidor da Vercel (UTC) todo
atendimento aparece 3 horas adiantado.

---

## Médios

### 12. Race de fetch na escolha do dia — [lido]

`src/app/b/[slug]/steps/slot-step.tsx:40`

`carregar()` no `useEffect` sem `AbortController` nem guarda de sequência;
`setSlots` é incondicional. Em rede lenta, trocar de dia rápido faz a resposta
antiga pintar sob o rótulo do dia novo. O cliente marca achando que é quinta e
confirma quarta — o `startAt` é instante absoluto, então sai no dia errado sem
aviso.

Mesmo problema em `src/app/app/agenda/manual-booking-form.tsx:32`, que ainda por
cima não checa `res.ok`: qualquer 400/429/500 vira lista vazia muda. E o painel
consome o endpoint público rate-limitado — dois atendentes atrás do mesmo IP
levam 429 e veem "sem horário".

### 13. Rate limit contornável e sem teto de crescimento — [revisor]

`src/app/api/public/[slug]/availability/route.ts:20`

A checagem roda **antes** de resolver o slug, e a chave inclui o slug cru. Um
laço com slugs aleatórios cria uma chave nova por requisição, o contador nunca
atinge o limite e a tabela cresce sem freio. A limpeza só acontece no fim do cron
horário — que, pelo achado 15, pode nem chegar lá.

`clientKey` também confia no primeiro valor de `x-forwarded-for`, o que é seguro
atrás da Vercel mas não em self-host com o `docker-compose.yml` do repo.

### 14. `manageToken` cancela atendimento já concluído — [revisor]

`src/domain/booking/cancel-appointment.ts:13`

A única guarda é `status <> 'CANCELED'`. O token vale 90 dias e sobrevive em
histórico de navegador e preview de link. Semanas depois do corte, quem tiver o
link transforma um `DONE` em `CANCELED` — o atendimento some do dia e o horário
volta a ficar livre no passado.

Correção: recusar cancelamento de agendamento que já começou, e não aceitar
status `DONE`/`NO_SHOW`.

### 15. Cron manda 500 lembretes em série dentro de 60s — [revisor]

`src/app/api/cron/reminders/route.ts:9,30`

Loop sequencial, cada iteração uma chamada HTTP à Meta. Uns 100 lembretes já
estouram o `maxDuration`. Como a limpeza do `rate_limit_bucket` está **depois** do
loop, quando o cron estoura ela nunca roda.

Correção: limpeza antes do loop, teto compatível com o orçamento de tempo, envio
em lotes.

### 16. Falha de server action não chega ao usuário — [revisor]

`day-grid.tsx:42`, `servicos/toggle-button.tsx:13`,
`equipe/toggle-staff-button.tsx:13`, `equipe/[staffId]/time-off-section.tsx:42`

Todos fazem `startTransition(() => action())` sem `catch` e sem estado de erro, e
não existe `error.tsx` em `src/app`. Cancelar na agenda um agendamento que já foi
cancelado pelo cliente em outra aba faz `cancelAppointment` lançar
`NotFoundError` sem boundary. `setAppointmentStatusAction` com `DONE`/`NO_SHOW`
também não checa linhas afetadas — clique vira no-op silencioso.

### 17. Fuso não é validado no cadastro — [revisor]

`src/app/signup/actions.ts:15` aceita `z.string().min(3)`, enquanto
`shop-settings.ts` valida com `Intl.DateTimeFormat`. Um fuso inválido gravado no
signup faz a grade pública devolver 404 para sempre e a agenda do painel montar
`Invalid Date`. Barbearia criada e inutilizável, sem mensagem que explique.

Relacionado: `signupAction` cria o usuário **antes** da barbearia, fora de
transação. Slug reservado (`admin`) deixa uma conta órfã que não consegue nem
entrar nem se cadastrar de novo.

### 18. Salvar serviços de um barbeiro apaga vínculos inativos — [lido]

`src/app/app/equipe/[staffId]/actions.ts:32`

O `delete` remove todos os `staff_service` do barbeiro, e o reinsert só considera
`listActiveServices`. Desativar "Barba" no inverno e depois editar a duração do
"Corte" destrói o vínculo barbeiro↔barba em silêncio. Quando "Barba" volta, a
página pública mostra "nenhum barbeiro disponível".

### 19. Prefixo `55` duplicado — [revisor]

`src/notifications/meta-whatsapp.sender.ts:20` monta `55${to}`, mas a rota aceita
de 10 a 13 dígitos. Quem digita com DDI vira `555511999998888`, o envio falha e
vira uma linha `FAILED` que ninguém olha. O sender da Meta tem 10% de cobertura
de branch — nenhum teste o executa.

---

## Menores

- **"Qualquer barbeiro" não distribui** — `create-appointment.ts:38` pega sempre
  `candidatos[0]`, primeiro em ordem alfabética. O spec pede desempate por quem
  tem menos agendamentos no dia. Na prática um barbeiro lota e o outro fica
  parado. [lido]
- **Snapshot ignora o override do barbeiro** — `create-appointment.ts:51` grava
  `servico.durationMinutes` mesmo quando o slot foi calculado com
  `effectiveDurationMinutes`. Histórico registra duração diferente da real. [lido]
- **Remarcar não existe** — o spec cita nas seções 3 e 6; só cancelar foi
  implementado. [revisor]
- **Agenda não vira lista no celular** — `day-grid.tsx:77` empilha colunas
  inteiras por barbeiro em vez da lista única por horário que o plano descreve, e
  o cartão nunca mostra o nome do barbeiro. [revisor]
- **Enums do banco na tela** — `Status: BOOKED`, `— CANCELED` aparecem crus no
  painel, contra a convenção de pt-BR. [revisor]
- **42 campos de hora sem nome acessível** — `working-hours-form.tsx:41`, sete
  formulários iguais, todos anunciam só "hora". [revisor]
- **Segredo do cron comparado com `!==`** — `cron/reminders/route.ts:12`, sendo
  que `tokens.ts` já usa `timingSafeEqual`. [revisor]
- **`requireSession` escolhe vínculo arbitrário** — `.limit(1)` sem `orderBy` e
  `staff.userId` sem unique. Latente até o convite de barbeiro existir; aí vira
  troca de tenant não determinística entre requisições. [revisor]
- **Janela do lembrete desacoplada do cron** — se
  `REMINDER_WINDOW_MINUTES` < 60, abre buraco entre execuções e alguns
  agendamentos nunca recebem lembrete. [revisor]

---

## Sobre a suíte de testes

Rodei `npx vitest run` duas vezes. Na primeira, 53 falhas porque o Postgres não
estava no ar; depois de subir o banco, uma única falha em `notify.test.ts`
(esperava 1 linha em `notification_log`, achou 2). Na segunda rodada, 125/125.

Meu diagnóstico inicial — paralelismo entre arquivos de teste — estava errado:
`vitest.config.ts:11` já traz `fileParallelism: false`, commitado desde
`c87d9b4`. A causa provável é escrita vinda de **fora** do Vitest no mesmo banco:
`vitest.setup.ts` carrega o `.env` de desenvolvimento, o Playwright sobe
`npm run dev` contra ele, e vários testes asseram contagem global sem filtro
(`overlap.test.ts:24`, `notify.test.ts:51`, `tenant-isolation.test.ts`). Um
`next dev` aberto numa aba derruba exatamente um teste.

Evidência de que já aconteceu: sobrou no banco um `user` órfão
(`joao.teste@example.com`) com `barbershop` e `staff` zerados — cadastro manual
truncado por uma rodada de teste. `tests/helpers/db.ts:14` também não trunca
`user`, `account`, `session` e `verification`, então essas tabelas acumulam lixo
entre rodadas.

Correções: `DATABASE_URL_TEST` apontando para um banco dedicado, incluir as
quatro tabelas do Better-Auth no TRUNCATE, e trocar as contagens globais por
queries filtradas por `barbershopId`.

Buracos de cobertura: `src/lib/session.ts` em 0%, `staff.repo.ts` 33%,
`customer.repo.ts` 28%. A seção 7 do spec pede teste de isolamento **por rota**;
o que existe testa só funções de repositório — nenhuma das seis `actions.ts` do
painel tem um único teste, e são elas que recebem o `barbershopId` da sessão e
mutam dados.

---

## O que está sólido

Registrando para não se perder no meio dos problemas:

- O escopo por `barbershopId` está consistente em todos os repositórios e em
  todas as páginas e actions do painel. Não apareceu uma única query de negócio
  sem filtro de tenant.
- `staffId` e `serviceId` de outra barbearia vindos da API pública morrem no
  filtro de `getAvailability`.
- O HMAC do `manageToken` está correto: comparação em tempo constante, sem
  confusão de delimitador.
- `anonymizeCustomer` cobre os três campos pessoais e libera o unique do
  telefone corretamente.
- Nenhuma injeção SQL: interpolação de identificadores do Drizzle em todo
  `sql``, e o `ilike` da busca é parametrizado.
- As migrations aplicam em banco limpo, a constraint `EXCLUDE` fica registrada, e
  o journal está consistente — inclusive a `0001` escrita à mão.
- `computeAvailability` tem os oito casos de fronteira que o spec exige,
  inclusive as duas direções de horário de verão, e está em 97% de cobertura.
- `listBusyRanges` faz overlap de verdade, então férias de vários dias e
  agendamento que cruza a meia-noite entram no cálculo.

---

## Ordem sugerida de correção

1. Achados 1, 2 e 3 — nenhum deploy antes disso.
2. Achados 5, 6, 7, 8, 9 e 10 — quebram em produção no primeiro dia.
3. Decidir o achado 4 (encaixe): implementar ou tirar do spec.
4. O resto, por ordem da lista.
5. Isolar o banco de teste antes de mexer em qualquer coisa — sem isso, a suíte
   não é evidência confiável de nada.
