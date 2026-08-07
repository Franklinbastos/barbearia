# Agenda para Barbearias

SaaS multi-barbearia de agendamento online. Cliente final marca sozinho numa
página pública (`/b/{slug}`), sem conta nem senha; o dono e os barbeiros
administram pelo painel (`/app`). Notificação por WhatsApp é canal de saída,
não substitui a página pública.

Fase 1: agendamento, painel, notificação por WhatsApp. Sem cobrança, sem bot
conversacional — ver `docs/superpowers/specs/` para o design completo.

## Rodando localmente

Pré-requisitos: Node 22, Docker, npm.

```bash
docker compose up -d               # Postgres local, porta 5433
cp .env.example .env               # gerar AUTH_SECRET, MANAGE_TOKEN_SECRET,
                                    # CRON_SECRET com openssl rand -base64 32
npm install
npm run db:migrate
npm run dev
```

Abrir `http://localhost:3000/signup` para criar a primeira barbearia.

## Testes

A suíte roda contra um **banco dedicado**, nunca contra o banco de
desenvolvimento: cada `withTestDb` faz `TRUNCATE` de todas as tabelas —
inclusive `user`, `session`, `account` e `verification` — e apagaria seus dados.
Criar uma vez:

```bash
docker exec barbearia-postgres psql -U barbearia -d postgres \
  -c "CREATE DATABASE barbearia_test"
DATABASE_URL=postgres://barbearia:barbearia@localhost:5433/barbearia_test \
  npm run db:migrate
```

Depois disso:

```bash
npm test              # unit + integração (Vitest, Postgres real)
npm run test:cov       # com cobertura
npm run test:e2e       # fluxo público de ponta a ponta (Playwright)
npm run lint
npm run build
```

`vitest.setup.ts` sobrescreve `DATABASE_URL` com o valor de `DATABASE_URL_TEST`
antes de qualquer import de banco; sem essa variável ele usa
`postgres://barbearia:barbearia@localhost:5433/barbearia_test`. Se a URL final
apontar para o banco `barbearia`, a suíte aborta com mensagem explicando o que
fazer. Para rodar contra outro banco (agentes em paralelo, CI):

```bash
DATABASE_URL_TEST=postgres://barbearia:barbearia@localhost:5433/barbearia_test_ci npm test
```

O `npm run test:e2e` é a exceção: o Playwright sobe `npm run dev`, que usa o
`DATABASE_URL` do `.env` — ou seja, o banco de desenvolvimento.

## Estrutura

```
src/domain/         regras de negócio puras, sem I/O
  availability/      motor de disponibilidade (grade, colisão, fuso)
  booking/            criação/cancelamento de agendamento
  catalog/            validação de serviço, expediente, configurações
  onboarding/          cadastro da barbearia
  privacy/             anonimização de cliente (LGPD)
  reminders/            seleção de lembretes devidos

src/db/
  schema/              tabelas Drizzle
  repositories/        acesso ao banco, sempre escopado por barbershopId
  client.ts, migrate.ts

src/app/
  (public) b/[slug]/       página pública de agendamento
  agendamento/[token]/     link assinado do cliente (ver/cancelar)
  app/                     painel (agenda, serviços, equipe, clientes, configurações)
  api/public/[slug]/       API pública consumida pela página do cliente
  api/cron/reminders/       rota de cron dos lembretes

src/notifications/    envio de WhatsApp, templates, log idempotente
src/lib/               env, tokens, rate limit, formatação
```

## Deploy

Ver `docs/deploy.md`.
