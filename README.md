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

```bash
npm test              # unit + integração (Vitest, Postgres real)
npm run test:cov       # com cobertura
npm run test:e2e       # fluxo público de ponta a ponta (Playwright)
npm run lint
npm run build
```

Os testes de integração truncam as tabelas de negócio a cada `withTestDb` —
rodam contra o mesmo Postgres do `docker compose`, não um banco separado.

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
