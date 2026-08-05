# Agenda para Barbearias — Fase 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Colocar no ar um SaaS multi-barbearia onde o cliente final agenda sozinho por uma página pública, respeitando a grade e a duração real de cada serviço.

**Architecture:** Monolito Next.js (App Router) com três superfícies no mesmo repo — página pública `/b/[slug]`, painel `/app` e rotas de API. Toda regra de horário vive em `src/domain/availability`, um módulo de funções puras sem I/O. Todo acesso ao banco passa por `src/db/repositories`, que exige `barbershopId` em toda função. O Postgres garante a não-sobreposição de agendamentos por constraint `EXCLUDE`, não a aplicação.

**Tech Stack:** Next.js 15 (App Router) · React 19 · TypeScript strict · Tailwind CSS v4 · Drizzle ORM + drizzle-kit · PostgreSQL 16 · Better-Auth · Zod · Luxon (fusos e DST) · Vitest (unit + integração) · Playwright (E2E) · npm · Node 22

**Spec:** `docs/superpowers/specs/2026-08-05-agenda-barbearia-fase1-design.md`

## Global Constraints

- Diretório do projeto: `/home/franklin/dev/barbearia`. Branch base: `main`.
- Package manager: **npm**. Node 22.
- TypeScript em modo `strict`. Nada de `any` implícito.
- Limite orientativo de **400 linhas** por arquivo de código.
- Textos visíveis ao usuário em **pt-BR com acentuação correta**, UTF-8 sem BOM.
- Todos os timestamps no banco são `timestamptz`. Conversão de fuso só na borda, usando o `timeZone` da barbearia.
- Toda tabela de negócio tem `barbershopId`. Toda função de repositório recebe `barbershopId` como primeiro parâmetro.
- Migrations versionadas em `drizzle/`. Uma migration por alteração de schema. Nunca editar migration já commitada.
- Commits em pt-BR, formato `tipo(area): resultado para o usuário`. Tipos: `feat`, `fix`, `improve`, `perf`, `chore`, `docs`, `test`.
- Cobertura alvo: 90% em `src/domain/`, 80% no restante.
- Nenhum segredo em código. Tudo em `.env`, validado no boot por `src/lib/env.ts`.

---

## Task 1: Scaffold do projeto

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `eslint.config.mjs`, `.gitignore`, `.env.example`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`
- Test: `src/lib/smoke.test.ts`

**Interfaces:**
- Consumes: nada (primeira task)
- Produces: projeto Next.js rodando, `npm test` e `npm run lint` funcionando. Todas as tasks seguintes dependem disso.

- [ ] **Step 1: Criar o projeto Next.js**

Rodar dentro de `/home/franklin/dev/barbearia` (a pasta já existe e já tem `docs/` e git iniciado):

```bash
cd /home/franklin/dev/barbearia
npx create-next-app@latest . \
  --typescript --tailwind --eslint --app --src-dir \
  --import-alias "@/*" --no-turbopack --use-npm
```

Quando perguntar sobre sobrescrever arquivos existentes, aceitar — `docs/` não é tocado.

- [ ] **Step 2: Instalar as dependências do projeto**

```bash
npm install drizzle-orm postgres luxon zod better-auth
npm install -D drizzle-kit vitest @vitest/coverage-v8 tsx @types/luxon dotenv
```

- [ ] **Step 3: Configurar o Vitest**

Criar `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/app/**'],
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
```

- [ ] **Step 4: Adicionar os scripts ao `package.json`**

Substituir o bloco `"scripts"` por:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:cov": "vitest run --coverage",
  "db:generate": "drizzle-kit generate",
  "db:migrate": "tsx src/db/migrate.ts"
}
```

- [ ] **Step 5: Escrever o teste de fumaça**

Criar `src/lib/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

describe('ambiente de testes', () => {
  it('roda TypeScript e resolve o alias @', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 6: Rodar o teste**

Run: `npm test`
Expected: PASS, 1 teste.

- [ ] **Step 7: Rodar o lint e o build**

Run: `npm run lint && npm run build`
Expected: ambos passam sem erro.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore(setup): scaffold do projeto Next.js com Vitest e Tailwind"
```

---

## Task 2: Ambiente de banco e validação de env

**Files:**
- Create: `docker-compose.yml`, `drizzle.config.ts`, `src/lib/env.ts`, `src/db/client.ts`, `src/db/migrate.ts`
- Modify: `.env.example`, `.gitignore`
- Test: `src/lib/env.test.ts`

**Interfaces:**
- Consumes: scaffold da Task 1
- Produces:
  - `env` — objeto validado exportado de `src/lib/env.ts`, com `DATABASE_URL: string`, `AUTH_SECRET: string`, `APP_URL: string`, `MANAGE_TOKEN_SECRET: string`
  - `db` — instância Drizzle exportada de `src/db/client.ts`
  - `createDb(connectionString: string)` — fábrica exportada de `src/db/client.ts`, usada pelos testes de integração

- [ ] **Step 1: Escrever o teste de validação de env**

Criar `src/lib/env.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseEnv } from './env';

describe('parseEnv', () => {
  const valido = {
    DATABASE_URL: 'postgres://user:pass@localhost:5432/barbearia',
    AUTH_SECRET: 'x'.repeat(32),
    MANAGE_TOKEN_SECRET: 'y'.repeat(32),
    APP_URL: 'http://localhost:3000',
  };

  it('aceita um ambiente completo', () => {
    expect(parseEnv(valido).DATABASE_URL).toBe(valido.DATABASE_URL);
  });

  it('recusa quando falta variável obrigatória', () => {
    const { AUTH_SECRET, ...incompleto } = valido;
    expect(() => parseEnv(incompleto)).toThrow(/AUTH_SECRET/);
  });

  it('recusa segredo curto demais', () => {
    expect(() => parseEnv({ ...valido, AUTH_SECRET: 'curto' })).toThrow(/AUTH_SECRET/);
  });

  it('recusa DATABASE_URL que não é postgres', () => {
    expect(() => parseEnv({ ...valido, DATABASE_URL: 'mysql://a/b' })).toThrow(/DATABASE_URL/);
  });
});
```

- [ ] **Step 2: Rodar o teste para vê-lo falhar**

Run: `npx vitest run src/lib/env.test.ts`
Expected: FAIL — `Cannot find module './env'`.

- [ ] **Step 3: Implementar a validação de env**

Criar `src/lib/env.ts`:

```ts
import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().startsWith('postgres', 'DATABASE_URL deve ser uma URL Postgres'),
  AUTH_SECRET: z.string().min(32, 'AUTH_SECRET precisa de pelo menos 32 caracteres'),
  MANAGE_TOKEN_SECRET: z.string().min(32, 'MANAGE_TOKEN_SECRET precisa de pelo menos 32 caracteres'),
  APP_URL: z.string().url('APP_URL deve ser uma URL válida'),
});

export type Env = z.infer<typeof schema>;

export function parseEnv(source: Record<string, unknown>): Env {
  const result = schema.safeParse(source);
  if (!result.success) {
    const detalhes = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Variáveis de ambiente inválidas — ${detalhes}`);
  }
  return result.data;
}

export const env = parseEnv(process.env);
```

- [ ] **Step 4: Rodar o teste para vê-lo passar**

Run: `npx vitest run src/lib/env.test.ts`
Expected: PASS, 4 testes.

- [ ] **Step 5: Subir o Postgres local**

Criar `docker-compose.yml`:

```yaml
services:
  postgres:
    image: postgres:16
    container_name: barbearia-postgres
    environment:
      POSTGRES_USER: barbearia
      POSTGRES_PASSWORD: barbearia
      POSTGRES_DB: barbearia
    ports:
      - "5433:5432"
    volumes:
      - barbearia-pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U barbearia"]
      interval: 5s
      retries: 10

volumes:
  barbearia-pgdata:
```

A porta é **5433** de propósito: a 5432 já é do Tempra nesta máquina.

Run: `docker compose up -d && docker compose ps`
Expected: container `barbearia-postgres` com status `healthy`.

- [ ] **Step 6: Criar o `.env` local e o `.env.example`**

`.env.example`:

```
DATABASE_URL=postgres://barbearia:barbearia@localhost:5433/barbearia
AUTH_SECRET=troque-por-32-caracteres-aleatorios-ok
MANAGE_TOKEN_SECRET=outro-segredo-de-32-caracteres-aqui
APP_URL=http://localhost:3000
```

Criar `.env` a partir dele, com segredos gerados por `openssl rand -base64 32`.
Conferir que `.env` está no `.gitignore` (o create-next-app já põe `.env*`).

- [ ] **Step 7: Configurar o Drizzle**

Criar `drizzle.config.ts`:

```ts
import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```

Criar `src/db/client.ts`:

```ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '@/lib/env';
import * as schema from './schema';

export function createDb(connectionString: string) {
  const client = postgres(connectionString, { max: 5 });
  return drizzle(client, { schema });
}

export const db = createDb(env.DATABASE_URL);
```

Criar `src/db/migrate.ts`:

```ts
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL não definida');

const client = postgres(url, { max: 1 });
await migrate(drizzle(client), { migrationsFolder: './drizzle' });
await client.end();
console.log('Migrations aplicadas.');
```

`src/db/schema/index.ts` ainda não existe — ele nasce na Task 3. Criar por ora um arquivo vazio com `export {};` para o build não quebrar.

- [ ] **Step 8: Rodar a suíte inteira**

Run: `npm test`
Expected: PASS (smoke + env).

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore(db): postgres local, cliente Drizzle e validação de variáveis de ambiente"
```

---

## Task 3: Schema do banco e constraint de sobreposição

**Files:**
- Create: `src/db/schema/barbershop.ts`, `src/db/schema/staff.ts`, `src/db/schema/service.ts`, `src/db/schema/customer.ts`, `src/db/schema/appointment.ts`, `src/db/schema/notification.ts`, `src/db/schema/index.ts`
- Create: `drizzle/0001_exclusion_constraint.sql` (manual, depois da migration gerada)
- Create: `tests/helpers/db.ts`
- Test: `tests/integration/overlap.test.ts`

**Interfaces:**
- Consumes: `createDb` da Task 2
- Produces: todas as tabelas Drizzle exportadas de `@/db/schema` — `barbershop`, `staff`, `service`, `staffService`, `workingHours`, `timeOff`, `customer`, `appointment`, `notificationLog`. Todas as tasks seguintes importam daqui.
- Produces: `withTestDb(fn)` de `tests/helpers/db.ts` — abre conexão, roda a função, limpa as tabelas e fecha.

- [ ] **Step 1: Escrever o schema — barbearia e equipe**

Criar `src/db/schema/barbershop.ts`:

```ts
import { pgTable, uuid, text, integer, timestamp, index } from 'drizzle-orm/pg-core';

export const barbershop = pgTable(
  'barbershop',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    timeZone: text('time_zone').notNull().default('America/Sao_Paulo'),
    slotMinutes: integer('slot_minutes').notNull().default(30),
    minLeadMinutes: integer('min_lead_minutes').notNull().default(60),
    maxAdvanceDays: integer('max_advance_days').notNull().default(30),
    phone: text('phone'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('barbershop_slug_idx').on(t.slug)],
);
```

Criar `src/db/schema/staff.ts`:

```ts
import { pgTable, uuid, text, boolean, time, smallint, timestamp, index } from 'drizzle-orm/pg-core';
import { barbershop } from './barbershop';

export const staff = pgTable(
  'staff',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    barbershopId: uuid('barbershop_id').notNull().references(() => barbershop.id, { onDelete: 'cascade' }),
    userId: text('user_id'),
    name: text('name').notNull(),
    photoUrl: text('photo_url'),
    role: text('role', { enum: ['OWNER', 'BARBER'] }).notNull().default('BARBER'),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('staff_barbershop_idx').on(t.barbershopId)],
);

export const workingHours = pgTable(
  'working_hours',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    barbershopId: uuid('barbershop_id').notNull().references(() => barbershop.id, { onDelete: 'cascade' }),
    staffId: uuid('staff_id').notNull().references(() => staff.id, { onDelete: 'cascade' }),
    weekday: smallint('weekday').notNull(),
    startTime: time('start_time').notNull(),
    endTime: time('end_time').notNull(),
  },
  (t) => [index('working_hours_staff_weekday_idx').on(t.staffId, t.weekday)],
);

export const timeOff = pgTable(
  'time_off',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    barbershopId: uuid('barbershop_id').notNull().references(() => barbershop.id, { onDelete: 'cascade' }),
    staffId: uuid('staff_id').notNull().references(() => staff.id, { onDelete: 'cascade' }),
    startAt: timestamp('start_at', { withTimezone: true }).notNull(),
    endAt: timestamp('end_at', { withTimezone: true }).notNull(),
    reason: text('reason'),
  },
  (t) => [index('time_off_staff_start_idx').on(t.staffId, t.startAt)],
);
```

`weekday` segue Luxon: 1 = segunda … 7 = domingo.

- [ ] **Step 2: Escrever o schema — serviços**

Criar `src/db/schema/service.ts`:

```ts
import { pgTable, uuid, text, integer, boolean, timestamp, unique, index } from 'drizzle-orm/pg-core';
import { barbershop } from './barbershop';
import { staff } from './staff';

export const service = pgTable(
  'service',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    barbershopId: uuid('barbershop_id').notNull().references(() => barbershop.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    durationMinutes: integer('duration_minutes').notNull(),
    priceCents: integer('price_cents').notNull().default(0),
    active: boolean('active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('service_barbershop_idx').on(t.barbershopId)],
);

export const staffService = pgTable(
  'staff_service',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    barbershopId: uuid('barbershop_id').notNull().references(() => barbershop.id, { onDelete: 'cascade' }),
    staffId: uuid('staff_id').notNull().references(() => staff.id, { onDelete: 'cascade' }),
    serviceId: uuid('service_id').notNull().references(() => service.id, { onDelete: 'cascade' }),
    durationMinutesOverride: integer('duration_minutes_override'),
  },
  (t) => [unique('staff_service_unique').on(t.staffId, t.serviceId)],
);
```

- [ ] **Step 3: Escrever o schema — cliente, agendamento e notificação**

Criar `src/db/schema/customer.ts`:

```ts
import { pgTable, uuid, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { barbershop } from './barbershop';

export const customer = pgTable(
  'customer',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    barbershopId: uuid('barbershop_id').notNull().references(() => barbershop.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    phone: text('phone').notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('customer_phone_unique').on(t.barbershopId, t.phone)],
);
```

Criar `src/db/schema/appointment.ts`:

```ts
import { pgTable, uuid, text, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { barbershop } from './barbershop';
import { staff } from './staff';
import { service } from './service';
import { customer } from './customer';

export const appointment = pgTable(
  'appointment',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    barbershopId: uuid('barbershop_id').notNull().references(() => barbershop.id, { onDelete: 'cascade' }),
    staffId: uuid('staff_id').notNull().references(() => staff.id, { onDelete: 'restrict' }),
    customerId: uuid('customer_id').notNull().references(() => customer.id, { onDelete: 'restrict' }),
    serviceId: uuid('service_id').references(() => service.id, { onDelete: 'set null' }),
    serviceNameSnapshot: text('service_name_snapshot').notNull(),
    servicePriceCentsSnapshot: integer('service_price_cents_snapshot').notNull(),
    serviceDurationMinutesSnapshot: integer('service_duration_minutes_snapshot').notNull(),
    startAt: timestamp('start_at', { withTimezone: true }).notNull(),
    endAt: timestamp('end_at', { withTimezone: true }).notNull(),
    status: text('status', { enum: ['BOOKED', 'DONE', 'CANCELED', 'NO_SHOW'] }).notNull().default('BOOKED'),
    origin: text('origin', { enum: ['PUBLIC', 'PANEL', 'BOT'] }).notNull().default('PUBLIC'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    canceledAt: timestamp('canceled_at', { withTimezone: true }),
  },
  (t) => [
    index('appointment_staff_start_idx').on(t.staffId, t.startAt),
    index('appointment_barbershop_start_idx').on(t.barbershopId, t.startAt),
  ],
);
```

Não há coluna `manageToken`: o token é derivado do `id` por HMAC (Task 13), então não precisa ser guardado.

Criar `src/db/schema/notification.ts`:

```ts
import { pgTable, uuid, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { barbershop } from './barbershop';
import { appointment } from './appointment';

export const notificationLog = pgTable(
  'notification_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    barbershopId: uuid('barbershop_id').notNull().references(() => barbershop.id, { onDelete: 'cascade' }),
    appointmentId: uuid('appointment_id').notNull().references(() => appointment.id, { onDelete: 'cascade' }),
    type: text('type', { enum: ['CONFIRMATION', 'REMINDER', 'CANCELLATION'] }).notNull(),
    status: text('status', { enum: ['SENT', 'FAILED'] }).notNull(),
    providerMessageId: text('provider_message_id'),
    error: text('error'),
    sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('notification_log_unique').on(t.appointmentId, t.type)],
);
```

Criar `src/db/schema/index.ts`:

```ts
export * from './barbershop';
export * from './staff';
export * from './service';
export * from './customer';
export * from './appointment';
export * from './notification';
```

- [ ] **Step 4: Gerar e aplicar a migration**

Run: `npm run db:generate && npm run db:migrate`
Expected: arquivo criado em `drizzle/0000_*.sql`, e "Migrations aplicadas." no console.

- [ ] **Step 5: Escrever o teste da constraint de sobreposição**

Criar `tests/helpers/db.ts`:

```ts
import 'dotenv/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '@/db/schema';

export type TestDb = ReturnType<typeof drizzle<typeof schema>>;

export async function withTestDb<T>(fn: (db: TestDb, sql: postgres.Sql) => Promise<T>): Promise<T> {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  const db = drizzle(sql, { schema });
  try {
    return await fn(db, sql);
  } finally {
    await sql`TRUNCATE notification_log, appointment, customer, staff_service, time_off, working_hours, service, staff, barbershop RESTART IDENTITY CASCADE`;
    await sql.end();
  }
}
```

Criar `tests/integration/overlap.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { withTestDb } from '../helpers/db';
import { barbershop, staff, customer, appointment } from '@/db/schema';

async function semear(db: Awaited<ReturnType<typeof withTestDb>> extends never ? never : any) {
  const [loja] = await db.insert(barbershop).values({ slug: 'teste', name: 'Barbearia Teste' }).returning();
  const [barbeiro] = await db.insert(staff).values({ barbershopId: loja.id, name: 'João', role: 'OWNER' }).returning();
  const [cliente] = await db.insert(customer).values({ barbershopId: loja.id, name: 'Cliente', phone: '11999999999' }).returning();
  return { loja, barbeiro, cliente };
}

function agendamento(ids: { loja: any; barbeiro: any; cliente: any }, startISO: string, endISO: string) {
  return {
    barbershopId: ids.loja.id,
    staffId: ids.barbeiro.id,
    customerId: ids.cliente.id,
    serviceNameSnapshot: 'Corte',
    servicePriceCentsSnapshot: 4000,
    serviceDurationMinutesSnapshot: 30,
    startAt: new Date(startISO),
    endAt: new Date(endISO),
  };
}

describe('constraint de sobreposição de agendamentos', () => {
  it('recusa dois agendamentos sobrepostos no mesmo barbeiro', async () => {
    await withTestDb(async (db) => {
      const ids = await semear(db);
      await db.insert(appointment).values(agendamento(ids, '2026-09-01T12:00:00Z', '2026-09-01T12:30:00Z'));
      await expect(
        db.insert(appointment).values(agendamento(ids, '2026-09-01T12:15:00Z', '2026-09-01T12:45:00Z')),
      ).rejects.toThrow(/exclus/i);
    });
  });

  it('aceita agendamentos encostados sem sobreposição', async () => {
    await withTestDb(async (db) => {
      const ids = await semear(db);
      await db.insert(appointment).values(agendamento(ids, '2026-09-01T12:00:00Z', '2026-09-01T12:30:00Z'));
      await db.insert(appointment).values(agendamento(ids, '2026-09-01T12:30:00Z', '2026-09-01T13:00:00Z'));
      const linhas = await db.select().from(appointment);
      expect(linhas).toHaveLength(2);
    });
  });

  it('libera o horário quando o agendamento é cancelado', async () => {
    await withTestDb(async (db, sql) => {
      const ids = await semear(db);
      const [primeiro] = await db
        .insert(appointment)
        .values(agendamento(ids, '2026-09-01T12:00:00Z', '2026-09-01T12:30:00Z'))
        .returning();
      await sql`UPDATE appointment SET status = 'CANCELED' WHERE id = ${primeiro.id}`;
      await db.insert(appointment).values(agendamento(ids, '2026-09-01T12:00:00Z', '2026-09-01T12:30:00Z'));
      const ativos = await sql`SELECT count(*) FROM appointment WHERE status = 'BOOKED'`;
      expect(Number(ativos[0].count)).toBe(1);
    });
  });
});
```

- [ ] **Step 6: Rodar o teste para vê-lo falhar**

Run: `npx vitest run tests/integration/overlap.test.ts`
Expected: FAIL no primeiro caso — o insert sobreposto passa, porque a constraint ainda não existe.

- [ ] **Step 7: Criar a migration da constraint**

O drizzle-kit não gera constraint `EXCLUDE`. Criar à mão `drizzle/0001_exclusion_constraint.sql`:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE appointment ADD CONSTRAINT appointment_no_overlap
  EXCLUDE USING gist (
    staff_id WITH =,
    tstzrange(start_at, end_at, '[)') WITH &&
  ) WHERE (status <> 'CANCELED');
```

Registrar a migration no journal do Drizzle: abrir `drizzle/meta/_journal.json` e acrescentar uma entrada ao array `entries`, copiando o formato da entrada existente e incrementando `idx` e `tag` (`tag` deve ser `0001_exclusion_constraint`, sem a extensão `.sql`). Usar o mesmo `when` da entrada anterior somado de 1000.

- [ ] **Step 8: Aplicar e rodar o teste para vê-lo passar**

Run: `npm run db:migrate && npx vitest run tests/integration/overlap.test.ts`
Expected: PASS, 3 testes.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(db): schema completo da agenda com constraint de não sobreposição"
```

---

## Task 4: Motor de disponibilidade — geração da grade

**Files:**
- Create: `src/domain/availability/types.ts`, `src/domain/availability/compute.ts`, `src/domain/availability/index.ts`
- Test: `src/domain/availability/compute.test.ts`

**Interfaces:**
- Consumes: nada (módulo puro, sem I/O e sem banco)
- Produces:
  - `type WorkingBlock = { startMinute: number; endMinute: number }` — minutos desde 00:00 no fuso local
  - `type Busy = { start: Date; end: Date }`
  - `type Slot = { start: Date; end: Date }`
  - `type AvailabilityInput = { date: string; timeZone: string; slotMinutes: number; minLeadMinutes: number; serviceDurationMinutes: number; workingBlocks: WorkingBlock[]; busy: Busy[]; now: Date }`
  - `computeAvailability(input: AvailabilityInput): Slot[]`
  - `parseTimeToMinutes(time: string): number` — converte `'09:00'` ou `'09:00:00'` em `540`

- [ ] **Step 1: Escrever os testes da grade**

Criar `src/domain/availability/compute.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { computeAvailability, parseTimeToMinutes } from './compute';
import type { AvailabilityInput } from './types';

const BASE: AvailabilityInput = {
  date: '2026-09-01',
  timeZone: 'America/Sao_Paulo',
  slotMinutes: 30,
  minLeadMinutes: 0,
  serviceDurationMinutes: 30,
  workingBlocks: [{ startMinute: 9 * 60, endMinute: 12 * 60 }],
  busy: [],
  now: new Date('2026-08-01T00:00:00Z'),
};

function horarios(slots: { start: Date }[], timeZone = 'America/Sao_Paulo') {
  return slots.map((s) =>
    s.start.toLocaleTimeString('pt-BR', { timeZone, hour: '2-digit', minute: '2-digit' }),
  );
}

describe('parseTimeToMinutes', () => {
  it('converte hora com segundos', () => {
    expect(parseTimeToMinutes('09:30:00')).toBe(570);
  });

  it('converte hora sem segundos', () => {
    expect(parseTimeToMinutes('14:00')).toBe(840);
  });
});

describe('computeAvailability — grade', () => {
  it('gera um slot por intervalo quando serviço e grade têm a mesma duração', () => {
    const slots = computeAvailability(BASE);
    expect(horarios(slots)).toEqual(['09:00', '09:30', '10:00', '10:30', '11:00', '11:30']);
  });

  it('ocupa dois slots quando o serviço é maior que a grade', () => {
    const slots = computeAvailability({ ...BASE, serviceDurationMinutes: 45 });
    expect(horarios(slots)).toEqual(['09:00', '09:30', '10:00', '10:30', '11:00']);
    expect(slots[0].end.getTime() - slots[0].start.getTime()).toBe(60 * 60 * 1000);
  });

  it('descarta o candidato que não cabe no fim do bloco', () => {
    const slots = computeAvailability({
      ...BASE,
      serviceDurationMinutes: 60,
      workingBlocks: [{ startMinute: 9 * 60, endMinute: 10 * 60 + 30 }],
    });
    expect(horarios(slots)).toEqual(['09:00']);
  });

  it('não emenda dois blocos por cima do intervalo de almoço', () => {
    const slots = computeAvailability({
      ...BASE,
      serviceDurationMinutes: 60,
      workingBlocks: [
        { startMinute: 11 * 60, endMinute: 12 * 60 },
        { startMinute: 13 * 60, endMinute: 14 * 60 },
      ],
    });
    expect(horarios(slots)).toEqual(['11:00', '13:00']);
  });

  it('devolve lista vazia quando o barbeiro não trabalha no dia', () => {
    expect(computeAvailability({ ...BASE, workingBlocks: [] })).toEqual([]);
  });

  it('recusa slotMinutes inválido', () => {
    expect(() => computeAvailability({ ...BASE, slotMinutes: 0 })).toThrow(/slotMinutes/);
  });

  it('recusa duração de serviço inválida', () => {
    expect(() => computeAvailability({ ...BASE, serviceDurationMinutes: 0 })).toThrow(/duração/i);
  });
});
```

- [ ] **Step 2: Rodar os testes para vê-los falhar**

Run: `npx vitest run src/domain/availability/compute.test.ts`
Expected: FAIL — `Cannot find module './compute'`.

- [ ] **Step 3: Escrever os tipos**

Criar `src/domain/availability/types.ts`:

```ts
/** Bloco de expediente, em minutos desde 00:00 no fuso da barbearia. */
export type WorkingBlock = { startMinute: number; endMinute: number };

/** Intervalo ocupado (agendamento ou bloqueio), em instantes absolutos. */
export type Busy = { start: Date; end: Date };

/** Horário oferecido ao cliente. `end` já inclui o arredondamento para slots inteiros. */
export type Slot = { start: Date; end: Date };

export type AvailabilityInput = {
  /** Dia no formato YYYY-MM-DD, no calendário local da barbearia. */
  date: string;
  timeZone: string;
  slotMinutes: number;
  minLeadMinutes: number;
  /** Duração real do serviço; a ocupação é arredondada para cima em slots inteiros. */
  serviceDurationMinutes: number;
  workingBlocks: WorkingBlock[];
  busy: Busy[];
  now: Date;
};
```

- [ ] **Step 4: Implementar o cálculo**

Criar `src/domain/availability/compute.ts`:

```ts
import { DateTime } from 'luxon';
import type { AvailabilityInput, Slot } from './types';

export function parseTimeToMinutes(time: string): number {
  const [hora, minuto] = time.split(':');
  return Number(hora) * 60 + Number(minuto);
}

function localMinuteToDate(date: string, timeZone: string, minute: number): Date | null {
  const hora = String(Math.floor(minute / 60)).padStart(2, '0');
  const min = String(minute % 60).padStart(2, '0');
  const dt = DateTime.fromISO(`${date}T${hora}:${min}`, { zone: timeZone });
  return dt.isValid ? dt.toJSDate() : null;
}

export function computeAvailability(input: AvailabilityInput): Slot[] {
  const {
    date, timeZone, slotMinutes, minLeadMinutes,
    serviceDurationMinutes, workingBlocks, busy, now,
  } = input;

  if (!Number.isInteger(slotMinutes) || slotMinutes <= 0) {
    throw new Error('slotMinutes deve ser um inteiro maior que zero');
  }
  if (!Number.isInteger(serviceDurationMinutes) || serviceDurationMinutes <= 0) {
    throw new Error('A duração do serviço deve ser um inteiro maior que zero');
  }

  const slotsNecessarios = Math.ceil(serviceDurationMinutes / slotMinutes);
  const ocupacaoMinutos = slotsNecessarios * slotMinutes;
  const maisCedo = new Date(now.getTime() + minLeadMinutes * 60_000);
  const slots: Slot[] = [];

  for (const bloco of workingBlocks) {
    for (
      let offset = bloco.startMinute;
      offset + ocupacaoMinutos <= bloco.endMinute;
      offset += slotMinutes
    ) {
      const start = localMinuteToDate(date, timeZone, offset);
      if (!start) continue;

      const end = new Date(start.getTime() + ocupacaoMinutos * 60_000);
      if (start < maisCedo) continue;
      if (busy.some((b) => start < b.end && b.start < end)) continue;

      slots.push({ start, end });
    }
  }

  return slots.sort((a, b) => a.start.getTime() - b.start.getTime());
}
```

- [ ] **Step 5: Rodar os testes para vê-los passar**

Run: `npx vitest run src/domain/availability/compute.test.ts`
Expected: PASS, 9 testes.

- [ ] **Step 6: Criar o barrel do módulo**

Criar `src/domain/availability/index.ts`:

```ts
export { computeAvailability, parseTimeToMinutes } from './compute';
export type { AvailabilityInput, Busy, Slot, WorkingBlock } from './types';
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(agenda): motor de disponibilidade com grade fixa e ocupação por slots inteiros"
```

---

## Task 5: Motor de disponibilidade — colisões, antecedência e fuso

**Files:**
- Modify: `src/domain/availability/compute.test.ts` (acrescentar blocos de teste)

**Interfaces:**
- Consumes: `computeAvailability` da Task 4
- Produces: nenhuma API nova — esta task prova que a implementação da Task 4 aguenta os casos que quebram agenda na vida real. Se algum teste falhar, o defeito está em `compute.ts` e é lá que se corrige.

- [ ] **Step 1: Escrever os testes de colisão e antecedência**

Acrescentar ao fim de `src/domain/availability/compute.test.ts`:

```ts
describe('computeAvailability — colisões', () => {
  it('remove os horários cobertos por um agendamento existente', () => {
    const slots = computeAvailability({
      ...BASE,
      busy: [{ start: new Date('2026-09-01T13:00:00Z'), end: new Date('2026-09-01T13:30:00Z') }],
    });
    expect(horarios(slots)).toEqual(['09:00', '09:30', '11:00', '11:30']);
  });

  it('remove os horários cobertos por um bloqueio parcial no meio do dia', () => {
    const slots = computeAvailability({
      ...BASE,
      busy: [{ start: new Date('2026-09-01T13:15:00Z'), end: new Date('2026-09-01T14:15:00Z') }],
    });
    expect(horarios(slots)).toEqual(['09:00', '11:30']);
  });

  it('remove os horários que um serviço longo atravessaria', () => {
    const slots = computeAvailability({
      ...BASE,
      serviceDurationMinutes: 60,
      busy: [{ start: new Date('2026-09-01T14:00:00Z'), end: new Date('2026-09-01T14:30:00Z') }],
    });
    expect(horarios(slots)).toEqual(['09:00', '11:00']);
  });

  it('devolve lista vazia quando o dia está inteiramente ocupado', () => {
    const slots = computeAvailability({
      ...BASE,
      busy: [{ start: new Date('2026-09-01T12:00:00Z'), end: new Date('2026-09-01T15:00:00Z') }],
    });
    expect(slots).toEqual([]);
  });
});

describe('computeAvailability — antecedência mínima', () => {
  it('corta os horários que estão dentro da antecedência mínima', () => {
    const slots = computeAvailability({
      ...BASE,
      now: new Date('2026-09-01T12:40:00Z'),
      minLeadMinutes: 60,
    });
    expect(horarios(slots)).toEqual(['11:00', '11:30']);
  });

  it('não oferece horário no passado mesmo com antecedência zero', () => {
    const slots = computeAvailability({ ...BASE, now: new Date('2026-09-01T14:00:00Z') });
    expect(horarios(slots)).toEqual(['11:00', '11:30']);
  });
});
```

Nota sobre os números: `America/Sao_Paulo` é UTC-3 e não tem horário de verão. 09:00 local = 12:00Z.

- [ ] **Step 2: Rodar os testes**

Run: `npx vitest run src/domain/availability/compute.test.ts`
Expected: PASS, 15 testes. Se algum falhar, corrigir `compute.ts` — não o teste.

- [ ] **Step 3: Escrever os testes de fuso e horário de verão**

Acrescentar ao fim de `src/domain/availability/compute.test.ts`:

```ts
describe('computeAvailability — fuso e horário de verão', () => {
  it('respeita o horário local, não o do servidor', () => {
    const slots = computeAvailability({
      ...BASE,
      timeZone: 'America/Manaus',
      workingBlocks: [{ startMinute: 9 * 60, endMinute: 10 * 60 }],
    });
    expect(slots[0].start.toISOString()).toBe('2026-09-01T13:00:00.000Z');
  });

  it('não oferece horário que não existe no dia em que o relógio adianta', () => {
    const slots = computeAvailability({
      ...BASE,
      date: '2026-03-08',
      timeZone: 'America/New_York',
      workingBlocks: [{ startMinute: 1 * 60, endMinute: 5 * 60 }],
      now: new Date('2026-01-01T00:00:00Z'),
    });
    const locais = horarios(slots, 'America/New_York');
    expect(locais).not.toContain('02:00');
    expect(locais).not.toContain('02:30');
    expect(locais).toContain('01:00');
    expect(locais).toContain('03:00');
  });

  it('mantém a grade coerente no dia em que o relógio atrasa', () => {
    const slots = computeAvailability({
      ...BASE,
      date: '2026-11-01',
      timeZone: 'America/New_York',
      workingBlocks: [{ startMinute: 1 * 60, endMinute: 3 * 60 }],
      now: new Date('2026-01-01T00:00:00Z'),
    });
    const instantes = slots.map((s) => s.start.getTime());
    expect(new Set(instantes).size).toBe(instantes.length);
    expect(instantes).toEqual([...instantes].sort((a, b) => a - b));
  });
});
```

- [ ] **Step 4: Rodar os testes**

Run: `npx vitest run src/domain/availability/compute.test.ts`
Expected: PASS, 18 testes.

No dia em que o relógio adianta, `DateTime.fromISO('2026-03-08T02:00', { zone: 'America/New_York' })` cai no gap; o Luxon devolve o instante seguinte válido, que coincide com 03:00 local. A checagem de duplicata no terceiro teste é o que garante que isso não vira dois slots iguais na lista.

Se o segundo teste falhar por conter `'02:00'`, ajustar `localMinuteToDate` para descartar horários deslocados:

```ts
const dt = DateTime.fromISO(`${date}T${hora}:${min}`, { zone: timeZone });
if (!dt.isValid) return null;
if (dt.hour !== Number(hora) || dt.minute !== Number(min)) return null; // horário inexistente no gap de DST
return dt.toJSDate();
```

- [ ] **Step 5: Conferir a cobertura do módulo**

Run: `npx vitest run --coverage src/domain/availability`
Expected: cobertura de `src/domain/availability` acima de 90%.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "test(agenda): cobre colisão, antecedência e virada de horário de verão"
```

---

## Task 6: Repositórios escopados por tenant

**Files:**
- Create: `src/db/repositories/types.ts`, `src/db/repositories/barbershop.repo.ts`, `src/db/repositories/staff.repo.ts`, `src/db/repositories/service.repo.ts`, `src/db/repositories/customer.repo.ts`, `src/db/repositories/appointment.repo.ts`, `src/db/repositories/index.ts`
- Test: `tests/integration/tenant-isolation.test.ts`

**Interfaces:**
- Consumes: schema da Task 3, `withTestDb` da Task 3
- Produces (todas recebem `db` como primeiro parâmetro e `barbershopId` como segundo):
  - `findBarbershopBySlug(db, slug): Promise<Barbershop | null>`
  - `findBarbershopById(db, id): Promise<Barbershop | null>`
  - `listActiveStaff(db, barbershopId): Promise<Staff[]>`
  - `listStaffForService(db, barbershopId, serviceId): Promise<Array<{ id: string; name: string; photoUrl: string | null; effectiveDurationMinutes: number }>>`
  - `listWorkingHours(db, barbershopId, staffId, weekday): Promise<WorkingHours[]>`
  - `listActiveServices(db, barbershopId): Promise<Service[]>`
  - `findServiceById(db, barbershopId, serviceId): Promise<Service | null>`
  - `upsertCustomer(db, barbershopId, { name, phone }): Promise<Customer>`
  - `listBusyRanges(db, barbershopId, staffId, from, to): Promise<Array<{ start: Date; end: Date }>>`
  - `listAppointmentsBetween(db, barbershopId, from, to): Promise<AppointmentRow[]>`
  - `findAppointmentById(db, barbershopId, id): Promise<AppointmentRow | null>`

- [ ] **Step 1: Escrever o teste de isolamento entre tenants**

Criar `tests/integration/tenant-isolation.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { withTestDb } from '../helpers/db';
import { barbershop, staff, service, customer } from '@/db/schema';
import {
  findBarbershopBySlug,
  listActiveStaff,
  listActiveServices,
  findServiceById,
  upsertCustomer,
} from '@/db/repositories';

async function semearDuasLojas(db: any) {
  const [a] = await db.insert(barbershop).values({ slug: 'loja-a', name: 'Loja A' }).returning();
  const [b] = await db.insert(barbershop).values({ slug: 'loja-b', name: 'Loja B' }).returning();
  await db.insert(staff).values([
    { barbershopId: a.id, name: 'Barbeiro A', role: 'OWNER' },
    { barbershopId: b.id, name: 'Barbeiro B', role: 'OWNER' },
  ]);
  const [servicoB] = await db
    .insert(service)
    .values({ barbershopId: b.id, name: 'Corte B', durationMinutes: 30, priceCents: 5000 })
    .returning();
  return { a, b, servicoB };
}

describe('isolamento entre barbearias', () => {
  it('lista só a equipe da própria barbearia', async () => {
    await withTestDb(async (db) => {
      const { a } = await semearDuasLojas(db);
      const equipe = await listActiveStaff(db, a.id);
      expect(equipe.map((s) => s.name)).toEqual(['Barbeiro A']);
    });
  });

  it('lista só os serviços da própria barbearia', async () => {
    await withTestDb(async (db) => {
      const { a } = await semearDuasLojas(db);
      expect(await listActiveServices(db, a.id)).toEqual([]);
    });
  });

  it('não devolve serviço de outra barbearia mesmo com o id correto', async () => {
    await withTestDb(async (db) => {
      const { a, servicoB } = await semearDuasLojas(db);
      expect(await findServiceById(db, a.id, servicoB.id)).toBeNull();
    });
  });

  it('trata o mesmo telefone em barbearias diferentes como clientes distintos', async () => {
    await withTestDb(async (db) => {
      const { a, b } = await semearDuasLojas(db);
      const clienteA = await upsertCustomer(db, a.id, { name: 'Zé', phone: '11988887777' });
      const clienteB = await upsertCustomer(db, b.id, { name: 'Zé', phone: '11988887777' });
      expect(clienteA.id).not.toBe(clienteB.id);
    });
  });

  it('atualiza o nome do cliente existente sem criar duplicata', async () => {
    await withTestDb(async (db) => {
      const { a } = await semearDuasLojas(db);
      const primeiro = await upsertCustomer(db, a.id, { name: 'Zé', phone: '11988887777' });
      const segundo = await upsertCustomer(db, a.id, { name: 'José', phone: '11988887777' });
      expect(segundo.id).toBe(primeiro.id);
      expect(segundo.name).toBe('José');
      const todos = await db.select().from(customer);
      expect(todos).toHaveLength(1);
    });
  });

  it('resolve barbearia por slug', async () => {
    await withTestDb(async (db) => {
      await semearDuasLojas(db);
      const encontrada = await findBarbershopBySlug(db, 'loja-b');
      expect(encontrada?.name).toBe('Loja B');
      expect(await findBarbershopBySlug(db, 'nao-existe')).toBeNull();
    });
  });
});
```

- [ ] **Step 2: Rodar o teste para vê-lo falhar**

Run: `npx vitest run tests/integration/tenant-isolation.test.ts`
Expected: FAIL — `Cannot find module '@/db/repositories'`.

- [ ] **Step 3: Implementar o tipo compartilhado dos repositórios**

Criar `src/db/repositories/types.ts`:

```ts
import type { drizzle } from 'drizzle-orm/postgres-js';
import type * as schema from '@/db/schema';

export type Db = ReturnType<typeof drizzle<typeof schema>>;
```

- [ ] **Step 4: Implementar os repositórios de barbearia, equipe e serviço**

Criar `src/db/repositories/barbershop.repo.ts`:

```ts
import { eq } from 'drizzle-orm';
import { barbershop } from '@/db/schema';
import type { Db } from './types';

export async function findBarbershopBySlug(db: Db, slug: string) {
  const [linha] = await db.select().from(barbershop).where(eq(barbershop.slug, slug)).limit(1);
  return linha ?? null;
}

export async function findBarbershopById(db: Db, id: string) {
  const [linha] = await db.select().from(barbershop).where(eq(barbershop.id, id)).limit(1);
  return linha ?? null;
}
```

Criar `src/db/repositories/staff.repo.ts`:

```ts
import { and, eq, asc, sql } from 'drizzle-orm';
import { staff, staffService, service, workingHours } from '@/db/schema';
import type { Db } from './types';

export async function listActiveStaff(db: Db, barbershopId: string) {
  return db
    .select()
    .from(staff)
    .where(and(eq(staff.barbershopId, barbershopId), eq(staff.active, true)))
    .orderBy(asc(staff.name));
}

export async function listStaffForService(db: Db, barbershopId: string, serviceId: string) {
  return db
    .select({
      id: staff.id,
      name: staff.name,
      photoUrl: staff.photoUrl,
      effectiveDurationMinutes: sql<number>`coalesce(${staffService.durationMinutesOverride}, ${service.durationMinutes})`,
    })
    .from(staffService)
    .innerJoin(staff, eq(staff.id, staffService.staffId))
    .innerJoin(service, eq(service.id, staffService.serviceId))
    .where(
      and(
        eq(staffService.barbershopId, barbershopId),
        eq(staffService.serviceId, serviceId),
        eq(staff.active, true),
        eq(service.active, true),
      ),
    )
    .orderBy(asc(staff.name));
}

export async function listWorkingHours(db: Db, barbershopId: string, staffId: string, weekday: number) {
  return db
    .select()
    .from(workingHours)
    .where(
      and(
        eq(workingHours.barbershopId, barbershopId),
        eq(workingHours.staffId, staffId),
        eq(workingHours.weekday, weekday),
      ),
    )
    .orderBy(asc(workingHours.startTime));
}
```

Criar `src/db/repositories/service.repo.ts`:

```ts
import { and, eq, asc } from 'drizzle-orm';
import { service } from '@/db/schema';
import type { Db } from './types';

export async function listActiveServices(db: Db, barbershopId: string) {
  return db
    .select()
    .from(service)
    .where(and(eq(service.barbershopId, barbershopId), eq(service.active, true)))
    .orderBy(asc(service.sortOrder), asc(service.name));
}

export async function findServiceById(db: Db, barbershopId: string, serviceId: string) {
  const [linha] = await db
    .select()
    .from(service)
    .where(and(eq(service.barbershopId, barbershopId), eq(service.id, serviceId)))
    .limit(1);
  return linha ?? null;
}
```

- [ ] **Step 5: Implementar os repositórios de cliente e agendamento**

Criar `src/db/repositories/customer.repo.ts`:

```ts
import { customer } from '@/db/schema';
import type { Db } from './types';

export async function upsertCustomer(
  db: Db,
  barbershopId: string,
  dados: { name: string; phone: string },
) {
  const [linha] = await db
    .insert(customer)
    .values({ barbershopId, name: dados.name, phone: dados.phone })
    .onConflictDoUpdate({
      target: [customer.barbershopId, customer.phone],
      set: { name: dados.name },
    })
    .returning();
  return linha;
}
```

Criar `src/db/repositories/appointment.repo.ts`:

```ts
import { and, eq, gte, lt, gt, ne, asc } from 'drizzle-orm';
import { appointment, timeOff, customer } from '@/db/schema';
import type { Db } from './types';

/** Agendamentos ativos e bloqueios do barbeiro que tocam a janela [from, to). */
export async function listBusyRanges(
  db: Db,
  barbershopId: string,
  staffId: string,
  from: Date,
  to: Date,
) {
  const agendamentos = await db
    .select({ start: appointment.startAt, end: appointment.endAt })
    .from(appointment)
    .where(
      and(
        eq(appointment.barbershopId, barbershopId),
        eq(appointment.staffId, staffId),
        ne(appointment.status, 'CANCELED'),
        lt(appointment.startAt, to),
        gt(appointment.endAt, from),
      ),
    );

  const bloqueios = await db
    .select({ start: timeOff.startAt, end: timeOff.endAt })
    .from(timeOff)
    .where(
      and(
        eq(timeOff.barbershopId, barbershopId),
        eq(timeOff.staffId, staffId),
        lt(timeOff.startAt, to),
        gt(timeOff.endAt, from),
      ),
    );

  return [...agendamentos, ...bloqueios];
}

export async function listAppointmentsBetween(db: Db, barbershopId: string, from: Date, to: Date) {
  return db
    .select({
      id: appointment.id,
      staffId: appointment.staffId,
      startAt: appointment.startAt,
      endAt: appointment.endAt,
      status: appointment.status,
      origin: appointment.origin,
      serviceName: appointment.serviceNameSnapshot,
      servicePriceCents: appointment.servicePriceCentsSnapshot,
      customerName: customer.name,
      customerPhone: customer.phone,
    })
    .from(appointment)
    .innerJoin(customer, eq(customer.id, appointment.customerId))
    .where(
      and(
        eq(appointment.barbershopId, barbershopId),
        gte(appointment.startAt, from),
        lt(appointment.startAt, to),
      ),
    )
    .orderBy(asc(appointment.startAt));
}

export async function findAppointmentById(db: Db, barbershopId: string, id: string) {
  const [linha] = await db
    .select()
    .from(appointment)
    .where(and(eq(appointment.barbershopId, barbershopId), eq(appointment.id, id)))
    .limit(1);
  return linha ?? null;
}
```

Criar `src/db/repositories/index.ts`:

```ts
export * from './barbershop.repo';
export * from './staff.repo';
export * from './service.repo';
export * from './customer.repo';
export * from './appointment.repo';
export type { Db } from './types';
```

- [ ] **Step 6: Rodar o teste para vê-lo passar**

Run: `npx vitest run tests/integration/tenant-isolation.test.ts`
Expected: PASS, 6 testes.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(db): repositórios com escopo obrigatório por barbearia"
```

---

## Task 7: Autenticação e cadastro da barbearia

**Files:**
- Create: `src/db/schema/auth.ts`, `src/lib/auth.ts`, `src/lib/session.ts`, `src/app/api/auth/[...all]/route.ts`
- Create: `src/domain/onboarding/create-barbershop.ts`
- Create: `src/app/signup/page.tsx`, `src/app/login/page.tsx`, `src/app/signup/actions.ts`
- Modify: `src/db/schema/index.ts`, `.env.example`, `src/lib/env.ts`
- Test: `src/domain/onboarding/slug.test.ts`, `tests/integration/onboarding.test.ts`

**Interfaces:**
- Consumes: repositórios da Task 6, `db` da Task 2
- Produces:
  - `auth` — instância Better-Auth exportada de `src/lib/auth.ts`
  - `normalizeSlug(input: string): string` de `src/domain/onboarding/create-barbershop.ts`
  - `createBarbershopForUser(db, { userId, name, slug, timeZone }): Promise<{ barbershopId: string; staffId: string }>`
  - `requireSession(): Promise<{ userId: string; barbershopId: string; staffId: string; role: 'OWNER' | 'BARBER' }>` de `src/lib/session.ts` — redireciona para `/login` se não houver sessão

- [ ] **Step 1: Escrever o teste de normalização de slug**

Criar `src/domain/onboarding/slug.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { normalizeSlug } from './create-barbershop';

describe('normalizeSlug', () => {
  it('minúsculas e hífens', () => {
    expect(normalizeSlug('Barbearia do João')).toBe('barbearia-do-joao');
  });

  it('remove acentos e cedilha', () => {
    expect(normalizeSlug('Ação & Estilo')).toBe('acao-estilo');
  });

  it('colapsa separadores repetidos e apara as pontas', () => {
    expect(normalizeSlug('  --Corte   Rápido--  ')).toBe('corte-rapido');
  });

  it('recusa entrada que não sobra nada', () => {
    expect(() => normalizeSlug('###')).toThrow(/slug/i);
  });

  it('recusa slug reservado', () => {
    expect(() => normalizeSlug('app')).toThrow(/reservado/i);
  });
});
```

- [ ] **Step 2: Rodar o teste para vê-lo falhar**

Run: `npx vitest run src/domain/onboarding/slug.test.ts`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar o onboarding**

Criar `src/domain/onboarding/create-barbershop.ts`:

```ts
import { barbershop, staff, workingHours } from '@/db/schema';
import type { Db } from '@/db/repositories';

const SLUGS_RESERVADOS = new Set(['app', 'api', 'login', 'signup', 'admin', 'b', '_next']);

export function normalizeSlug(input: string): string {
  const slug = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!slug) throw new Error('Não foi possível gerar um slug a partir desse nome');
  if (SLUGS_RESERVADOS.has(slug)) throw new Error(`O endereço "${slug}" é reservado, escolha outro`);
  return slug;
}

/** Expediente padrão: segunda a sábado, 9h às 18h, com parada das 12h às 13h. */
const EXPEDIENTE_PADRAO = [1, 2, 3, 4, 5, 6].flatMap((weekday) => [
  { weekday, startTime: '09:00:00', endTime: '12:00:00' },
  { weekday, startTime: '13:00:00', endTime: '18:00:00' },
]);

export async function createBarbershopForUser(
  db: Db,
  dados: { userId: string; name: string; slug: string; timeZone: string; ownerName: string },
) {
  const slug = normalizeSlug(dados.slug);

  return db.transaction(async (tx) => {
    const [loja] = await tx
      .insert(barbershop)
      .values({ slug, name: dados.name, timeZone: dados.timeZone })
      .returning();

    const [dono] = await tx
      .insert(staff)
      .values({ barbershopId: loja.id, userId: dados.userId, name: dados.ownerName, role: 'OWNER' })
      .returning();

    await tx.insert(workingHours).values(
      EXPEDIENTE_PADRAO.map((bloco) => ({ ...bloco, barbershopId: loja.id, staffId: dono.id })),
    );

    return { barbershopId: loja.id, staffId: dono.id };
  });
}
```

- [ ] **Step 4: Rodar o teste para vê-lo passar**

Run: `npx vitest run src/domain/onboarding/slug.test.ts`
Expected: PASS, 5 testes.

- [ ] **Step 5: Escrever o teste de integração do onboarding**

Criar `tests/integration/onboarding.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { withTestDb } from '../helpers/db';
import { barbershop, staff, workingHours } from '@/db/schema';
import { createBarbershopForUser } from '@/domain/onboarding/create-barbershop';
import { eq } from 'drizzle-orm';

const DADOS = {
  userId: 'user_1',
  name: 'Barbearia do João',
  slug: 'Barbearia do João',
  timeZone: 'America/Sao_Paulo',
  ownerName: 'João',
};

describe('createBarbershopForUser', () => {
  it('cria barbearia, dono e expediente padrão', async () => {
    await withTestDb(async (db) => {
      const { barbershopId, staffId } = await createBarbershopForUser(db as any, DADOS);

      const [loja] = await db.select().from(barbershop).where(eq(barbershop.id, barbershopId));
      expect(loja.slug).toBe('barbearia-do-joao');
      expect(loja.slotMinutes).toBe(30);

      const [dono] = await db.select().from(staff).where(eq(staff.id, staffId));
      expect(dono.role).toBe('OWNER');
      expect(dono.userId).toBe('user_1');

      const expediente = await db.select().from(workingHours).where(eq(workingHours.staffId, staffId));
      expect(expediente).toHaveLength(12);
      expect(expediente.every((b) => b.weekday >= 1 && b.weekday <= 6)).toBe(true);
    });
  });

  it('recusa slug já usado', async () => {
    await withTestDb(async (db) => {
      await createBarbershopForUser(db as any, DADOS);
      await expect(createBarbershopForUser(db as any, { ...DADOS, userId: 'user_2' })).rejects.toThrow();
    });
  });

  it('não deixa barbearia órfã quando a transação falha', async () => {
    await withTestDb(async (db) => {
      await createBarbershopForUser(db as any, DADOS);
      await createBarbershopForUser(db as any, { ...DADOS, userId: 'user_2' }).catch(() => {});
      const todas = await db.select().from(barbershop);
      expect(todas).toHaveLength(1);
    });
  });
});
```

- [ ] **Step 6: Rodar o teste**

Run: `npx vitest run tests/integration/onboarding.test.ts`
Expected: PASS, 3 testes.

- [ ] **Step 7: Configurar o Better-Auth**

Criar `src/lib/auth.ts`:

```ts
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '@/db/client';
import { env } from '@/lib/env';

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg' }),
  secret: env.AUTH_SECRET,
  baseURL: env.APP_URL,
  emailAndPassword: { enabled: true, minPasswordLength: 8 },
  session: { expiresIn: 60 * 60 * 24 * 30 },
});
```

Gerar o schema de auth e aplicá-lo:

```bash
npx @better-auth/cli generate --output src/db/schema/auth.ts
```

Acrescentar `export * from './auth';` a `src/db/schema/index.ts`, depois:

```bash
npm run db:generate && npm run db:migrate
```

Criar `src/app/api/auth/[...all]/route.ts`:

```ts
import { auth } from '@/lib/auth';
import { toNextJsHandler } from 'better-auth/next-js';

export const { GET, POST } = toNextJsHandler(auth);
```

- [ ] **Step 8: Implementar a resolução de sessão**

Criar `src/lib/session.ts`:

```ts
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/db/client';
import { staff } from '@/db/schema';

export type PanelSession = {
  userId: string;
  barbershopId: string;
  staffId: string;
  role: 'OWNER' | 'BARBER';
};

export async function requireSession(): Promise<PanelSession> {
  const sessao = await auth.api.getSession({ headers: await headers() });
  if (!sessao?.user) redirect('/login');

  const [vinculo] = await db
    .select()
    .from(staff)
    .where(and(eq(staff.userId, sessao.user.id), eq(staff.active, true)))
    .limit(1);

  if (!vinculo) redirect('/signup');

  return {
    userId: sessao.user.id,
    barbershopId: vinculo.barbershopId,
    staffId: vinculo.id,
    role: vinculo.role,
  };
}
```

O `barbershopId` **nunca** vem de parâmetro de rota no painel — sempre desta função.

- [ ] **Step 9: Construir as telas de cadastro e login**

Criar `src/app/signup/actions.ts`:

```ts
'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/db/client';
import { createBarbershopForUser } from '@/domain/onboarding/create-barbershop';

const schema = z.object({
  ownerName: z.string().min(2, 'Informe seu nome'),
  email: z.string().email('E-mail inválido'),
  password: z.string().min(8, 'A senha precisa de pelo menos 8 caracteres'),
  shopName: z.string().min(2, 'Informe o nome da barbearia'),
  slug: z.string().min(2, 'Informe o endereço da sua página'),
  timeZone: z.string().min(3),
});

export type SignupState = { erro?: string };

export async function signupAction(_prev: SignupState, formData: FormData): Promise<SignupState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { erro: parsed.error.issues[0].message };

  const dados = parsed.data;

  try {
    const criado = await auth.api.signUpEmail({
      body: { name: dados.ownerName, email: dados.email, password: dados.password },
    });
    await createBarbershopForUser(db, {
      userId: criado.user.id,
      name: dados.shopName,
      slug: dados.slug,
      timeZone: dados.timeZone,
      ownerName: dados.ownerName,
    });
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : 'Erro desconhecido';
    if (/unique|duplicate/i.test(mensagem)) return { erro: 'Esse e-mail ou endereço de página já está em uso' };
    return { erro: mensagem };
  }

  redirect('/app');
}
```

Criar `src/app/signup/page.tsx` — formulário com os campos `ownerName`, `email`, `password`, `shopName`, `slug`, e um `<input type="hidden" name="timeZone">` preenchido por `Intl.DateTimeFormat().resolvedOptions().timeZone` num pequeno componente cliente. Usar `useActionState` para exibir `erro`. Rótulos em pt-BR: "Seu nome", "E-mail", "Senha", "Nome da barbearia", "Endereço da sua página".

Criar `src/app/login/page.tsx` — formulário de e-mail e senha chamando `authClient.signIn.email` do `better-auth/react`, redirecionando para `/app`.

- [ ] **Step 10: Verificar o fluxo manualmente**

Run: `npm run dev`
Abrir `http://localhost:3000/signup`, cadastrar uma barbearia, conferir que cai em `/app` (por ora um 404 ou página vazia — o painel nasce na Task 8) e que as linhas apareceram no banco.

- [ ] **Step 11: Rodar a suíte e commitar**

Run: `npm test && npm run lint`
Expected: tudo passa.

```bash
git add -A
git commit -m "feat(auth): cadastro da barbearia com dono, expediente padrão e login"
```

---

## Task 8: Painel — layout e cadastro de serviços

**Files:**
- Create: `src/app/app/layout.tsx`, `src/app/app/page.tsx`, `src/app/app/servicos/page.tsx`, `src/app/app/servicos/actions.ts`
- Create: `src/domain/catalog/service-rules.ts`
- Create: `src/components/panel-nav.tsx`, `src/components/form-field.tsx`
- Test: `src/domain/catalog/service-rules.test.ts`

**Interfaces:**
- Consumes: `requireSession` da Task 7, repositórios da Task 6
- Produces:
  - `validateServiceInput(input: unknown, slotMinutes: number): { name: string; durationMinutes: number; priceCents: number }` de `src/domain/catalog/service-rules.ts` — lança `Error` com mensagem em pt-BR
  - `parsePriceToCents(texto: string): number` — aceita `'40'`, `'40,50'`, `'R$ 40,50'`

- [ ] **Step 1: Escrever os testes das regras de serviço**

Criar `src/domain/catalog/service-rules.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { validateServiceInput, parsePriceToCents } from './service-rules';

describe('parsePriceToCents', () => {
  it('aceita inteiro', () => expect(parsePriceToCents('40')).toBe(4000));
  it('aceita centavos com vírgula', () => expect(parsePriceToCents('40,50')).toBe(4050));
  it('aceita com prefixo e espaço', () => expect(parsePriceToCents('R$ 40,50')).toBe(4050));
  it('aceita zero', () => expect(parsePriceToCents('0')).toBe(0));
  it('recusa texto sem número', () => expect(() => parsePriceToCents('abc')).toThrow(/preço/i));
  it('recusa negativo', () => expect(() => parsePriceToCents('-10')).toThrow(/preço/i));
});

describe('validateServiceInput', () => {
  const valido = { name: 'Corte', durationMinutes: '30', priceCents: '40' };

  it('aceita entrada válida', () => {
    expect(validateServiceInput(valido, 30)).toEqual({ name: 'Corte', durationMinutes: 30, priceCents: 4000 });
  });

  it('aceita duração que não é múltiplo da grade', () => {
    expect(validateServiceInput({ ...valido, durationMinutes: '45' }, 30).durationMinutes).toBe(45);
  });

  it('recusa nome vazio', () => {
    expect(() => validateServiceInput({ ...valido, name: ' ' }, 30)).toThrow(/nome/i);
  });

  it('recusa duração zero', () => {
    expect(() => validateServiceInput({ ...valido, durationMinutes: '0' }, 30)).toThrow(/duração/i);
  });

  it('recusa duração acima de 8 horas', () => {
    expect(() => validateServiceInput({ ...valido, durationMinutes: '600' }, 30)).toThrow(/duração/i);
  });
});
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `npx vitest run src/domain/catalog/service-rules.test.ts`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar as regras**

Criar `src/domain/catalog/service-rules.ts`:

```ts
import { z } from 'zod';

const MAX_DURACAO_MINUTOS = 8 * 60;

export function parsePriceToCents(texto: string): number {
  const limpo = String(texto).replace(/[^\d,.-]/g, '').replace(',', '.');
  const valor = Number(limpo);
  if (!Number.isFinite(valor) || valor < 0) {
    throw new Error('Informe um preço válido, como 40 ou 40,50');
  }
  return Math.round(valor * 100);
}

const schema = z.object({
  name: z.string().trim().min(2, 'Informe o nome do serviço'),
  durationMinutes: z.coerce
    .number()
    .int('A duração deve ser em minutos inteiros')
    .positive('A duração deve ser maior que zero')
    .max(MAX_DURACAO_MINUTOS, 'A duração não pode passar de 8 horas'),
  priceCents: z.string(),
});

export function validateServiceInput(input: unknown, _slotMinutes: number) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);
  return {
    name: parsed.data.name,
    durationMinutes: parsed.data.durationMinutes,
    priceCents: parsePriceToCents(parsed.data.priceCents),
  };
}
```

`slotMinutes` entra na assinatura mas não restringe: serviço de 45 numa grade de 30 é caso legítimo — quem resolve isso é o motor de disponibilidade.

- [ ] **Step 4: Rodar para ver passar**

Run: `npx vitest run src/domain/catalog/service-rules.test.ts`
Expected: PASS, 11 testes.

- [ ] **Step 5: Construir o layout do painel**

Criar `src/app/app/layout.tsx`: chama `requireSession()`, renderiza `<PanelNav>` com os links "Agenda", "Serviços" e "Equipe" e o nome da barbearia ("Clientes" e "Configurações" entram na Task 18), e `{children}`.

Criar `src/components/panel-nav.tsx`: nav simples com `next/link`, marcando o item ativo por `usePathname()`.

Criar `src/app/app/page.tsx`: por ora, redireciona para `/app/agenda` (que nasce na Task 14). Enquanto isso, apontar para `/app/servicos`.

- [ ] **Step 6: Construir o CRUD de serviços**

Criar `src/app/app/servicos/actions.ts`:

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { service } from '@/db/schema';
import { requireSession } from '@/lib/session';
import { findBarbershopById } from '@/db/repositories';
import { validateServiceInput } from '@/domain/catalog/service-rules';

export type ServiceFormState = { erro?: string; ok?: boolean };

export async function saveServiceAction(
  _prev: ServiceFormState,
  formData: FormData,
): Promise<ServiceFormState> {
  const sessao = await requireSession();
  const loja = await findBarbershopById(db, sessao.barbershopId);
  if (!loja) return { erro: 'Barbearia não encontrada' };

  let dados;
  try {
    dados = validateServiceInput(Object.fromEntries(formData), loja.slotMinutes);
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : 'Dados inválidos' };
  }

  const id = formData.get('id');
  if (typeof id === 'string' && id) {
    await db
      .update(service)
      .set(dados)
      .where(and(eq(service.barbershopId, sessao.barbershopId), eq(service.id, id)));
  } else {
    await db.insert(service).values({ ...dados, barbershopId: sessao.barbershopId });
  }

  revalidatePath('/app/servicos');
  return { ok: true };
}

export async function toggleServiceAction(id: string, active: boolean) {
  const sessao = await requireSession();
  await db
    .update(service)
    .set({ active })
    .where(and(eq(service.barbershopId, sessao.barbershopId), eq(service.id, id)));
  revalidatePath('/app/servicos');
}
```

Criar `src/app/app/servicos/page.tsx`: server component que chama `requireSession()`, lista os serviços com `listActiveServices` (e os inativos, numa segunda consulta), e renderiza a tabela com nome, duração, preço e o botão de ativar/desativar, mais o formulário de criação usando `saveServiceAction` com `useActionState`.

Desativar em vez de excluir: serviço apagado quebraria o histórico. O `serviceId` no agendamento é referência frouxa justamente por isso, mas o snapshot é a fonte de verdade.

- [ ] **Step 7: Verificar manualmente**

Run: `npm run dev`
Cadastrar dois serviços ("Corte" 30min R$ 40 e "Corte + Barba" 45min R$ 65) e conferir que aparecem na lista.

- [ ] **Step 8: Rodar a suíte e commitar**

Run: `npm test && npm run lint`

```bash
git add -A
git commit -m "feat(painel): cadastro de serviços com duração e preço"
```

---

## Task 9: Painel — equipe, expediente e bloqueios

**Files:**
- Create: `src/app/app/equipe/page.tsx`, `src/app/app/equipe/actions.ts`
- Create: `src/app/app/equipe/[staffId]/page.tsx`, `src/app/app/equipe/[staffId]/actions.ts`
- Create: `src/domain/catalog/schedule-rules.ts`
- Test: `src/domain/catalog/schedule-rules.test.ts`

**Interfaces:**
- Consumes: `requireSession` da Task 7, schema da Task 3
- Produces:
  - `validateWorkingBlocks(blocos: Array<{ startTime: string; endTime: string }>): void` — lança se algum bloco for invertido ou se dois se sobrepuserem
  - `validateTimeOff(startAt: Date, endAt: Date): void`

- [ ] **Step 1: Escrever os testes das regras de expediente**

Criar `src/domain/catalog/schedule-rules.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { validateWorkingBlocks, validateTimeOff } from './schedule-rules';

describe('validateWorkingBlocks', () => {
  it('aceita blocos separados em ordem', () => {
    expect(() =>
      validateWorkingBlocks([
        { startTime: '09:00', endTime: '12:00' },
        { startTime: '13:00', endTime: '18:00' },
      ]),
    ).not.toThrow();
  });

  it('aceita blocos fora de ordem', () => {
    expect(() =>
      validateWorkingBlocks([
        { startTime: '13:00', endTime: '18:00' },
        { startTime: '09:00', endTime: '12:00' },
      ]),
    ).not.toThrow();
  });

  it('recusa bloco que termina antes de começar', () => {
    expect(() => validateWorkingBlocks([{ startTime: '18:00', endTime: '09:00' }])).toThrow(/antes/i);
  });

  it('recusa bloco de duração zero', () => {
    expect(() => validateWorkingBlocks([{ startTime: '09:00', endTime: '09:00' }])).toThrow(/antes/i);
  });

  it('recusa blocos sobrepostos', () => {
    expect(() =>
      validateWorkingBlocks([
        { startTime: '09:00', endTime: '13:00' },
        { startTime: '12:00', endTime: '18:00' },
      ]),
    ).toThrow(/sobrep/i);
  });

  it('aceita blocos encostados', () => {
    expect(() =>
      validateWorkingBlocks([
        { startTime: '09:00', endTime: '12:00' },
        { startTime: '12:00', endTime: '18:00' },
      ]),
    ).not.toThrow();
  });
});

describe('validateTimeOff', () => {
  it('aceita intervalo válido', () => {
    expect(() =>
      validateTimeOff(new Date('2026-09-01T12:00:00Z'), new Date('2026-09-01T14:00:00Z')),
    ).not.toThrow();
  });

  it('recusa intervalo invertido', () => {
    expect(() =>
      validateTimeOff(new Date('2026-09-01T14:00:00Z'), new Date('2026-09-01T12:00:00Z')),
    ).toThrow(/antes/i);
  });
});
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `npx vitest run src/domain/catalog/schedule-rules.test.ts`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar as regras**

Criar `src/domain/catalog/schedule-rules.ts`:

```ts
import { parseTimeToMinutes } from '@/domain/availability';

export function validateWorkingBlocks(blocos: Array<{ startTime: string; endTime: string }>): void {
  const intervalos = blocos
    .map((b) => ({ inicio: parseTimeToMinutes(b.startTime), fim: parseTimeToMinutes(b.endTime) }))
    .sort((a, b) => a.inicio - b.inicio);

  for (const intervalo of intervalos) {
    if (intervalo.fim <= intervalo.inicio) {
      throw new Error('O fim do expediente precisa vir depois do início');
    }
  }

  for (let i = 1; i < intervalos.length; i++) {
    if (intervalos[i].inicio < intervalos[i - 1].fim) {
      throw new Error('Os blocos de expediente não podem se sobrepor');
    }
  }
}

export function validateTimeOff(startAt: Date, endAt: Date): void {
  if (endAt.getTime() <= startAt.getTime()) {
    throw new Error('O fim do bloqueio precisa vir depois do início');
  }
}
```

- [ ] **Step 4: Rodar para ver passar**

Run: `npx vitest run src/domain/catalog/schedule-rules.test.ts`
Expected: PASS, 8 testes.

- [ ] **Step 5: Construir a lista da equipe**

Criar `src/app/app/equipe/page.tsx` — lista os barbeiros com `listActiveStaff`, mostra nome e papel, e um formulário para adicionar barbeiro (só nome; login é opcional e fica de fora da Fase 1).

Criar `src/app/app/equipe/actions.ts` com `createStaffAction` (insere `staff` com `role: 'BARBER'` e o expediente padrão de segunda a sábado, igual ao do onboarding) e `toggleStaffAction`. Ambas resolvem `barbershopId` por `requireSession()`.

Regra: barbeiro inativo some da página pública mas continua nos agendamentos passados. Por isso `active`, não `delete` — e a FK do `appointment` para `staff` é `onDelete: 'restrict'`.

- [ ] **Step 6: Construir a página do barbeiro**

Criar `src/app/app/equipe/[staffId]/page.tsx` com três blocos:

1. **Serviços que ele faz** — checkbox por serviço da barbearia, com campo opcional de duração própria. Grava em `staff_service`.
2. **Expediente** — sete linhas (segunda a domingo), cada uma com blocos de início e fim, botão de acrescentar bloco. Grava em `working_hours`.
3. **Bloqueios** — lista de `time_off` futuros com botão de remover, mais formulário de novo bloqueio (data, hora de início, hora de fim, motivo).

Criar `src/app/app/equipe/[staffId]/actions.ts`. Toda ação começa com:

```ts
const sessao = await requireSession();
const [barbeiro] = await db
  .select()
  .from(staff)
  .where(and(eq(staff.barbershopId, sessao.barbershopId), eq(staff.id, staffId)))
  .limit(1);
if (!barbeiro) return { erro: 'Barbeiro não encontrado' };
```

Esse par de linhas é o que impede que um `staffId` de outra barbearia, colado na URL, seja editado. Repetir em **todas** as actions deste arquivo.

`saveWorkingHoursAction` chama `validateWorkingBlocks` antes de gravar e substitui os blocos daquele dia em transação (delete + insert). `saveTimeOffAction` converte data e hora locais para UTC com Luxon usando o `timeZone` da barbearia, e chama `validateTimeOff`.

- [ ] **Step 7: Verificar manualmente**

Run: `npm run dev`
Adicionar um segundo barbeiro, marcar quais serviços cada um faz, ajustar o expediente de sábado e criar um bloqueio. Conferir no banco.

- [ ] **Step 8: Rodar a suíte e commitar**

Run: `npm test && npm run lint`

```bash
git add -A
git commit -m "feat(painel): equipe, expediente por dia e bloqueios pontuais"
```

---

## Task 10: Serviço de agendamento

**Files:**
- Create: `src/domain/booking/errors.ts`, `src/domain/booking/availability-service.ts`, `src/domain/booking/create-appointment.ts`, `src/domain/booking/cancel-appointment.ts`, `src/domain/booking/index.ts`
- Test: `tests/integration/booking.test.ts`

**Interfaces:**
- Consumes: `computeAvailability` da Task 4, repositórios da Task 6
- Produces:
  - `class SlotTakenError extends Error` — `code = 'SLOT_TAKEN'`
  - `class SlotUnavailableError extends Error` — `code = 'SLOT_UNAVAILABLE'`
  - `getAvailability(db, { barbershopId, serviceId, staffId?, date, now? }): Promise<Array<{ staffId: string; staffName: string; start: Date; end: Date }>>` — `staffId` opcional; se omitido, agrega todos os barbeiros que fazem o serviço
  - `createAppointment(db, { barbershopId, serviceId, staffId, startAt, customer, origin }): Promise<{ appointmentId: string; staffId: string; startAt: Date; endAt: Date }>` — `staffId` opcional (modo "qualquer barbeiro")
  - `cancelAppointment(db, barbershopId, appointmentId): Promise<void>`

- [ ] **Step 1: Escrever o teste de integração do agendamento**

Criar `tests/integration/booking.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { withTestDb } from '../helpers/db';
import { barbershop, staff, service, staffService, workingHours, appointment } from '@/db/schema';
import { getAvailability, createAppointment, cancelAppointment, SlotTakenError, SlotUnavailableError } from '@/domain/booking';

const SEGUNDA = '2026-09-07'; // segunda-feira

async function semear(db: any, opts: { duracao?: number; slot?: number } = {}) {
  const [loja] = await db
    .insert(barbershop)
    .values({ slug: 'teste', name: 'Teste', slotMinutes: opts.slot ?? 30, minLeadMinutes: 0 })
    .returning();
  const [joao] = await db.insert(staff).values({ barbershopId: loja.id, name: 'João', role: 'OWNER' }).returning();
  const [maria] = await db.insert(staff).values({ barbershopId: loja.id, name: 'Maria' }).returning();
  const [corte] = await db
    .insert(service)
    .values({ barbershopId: loja.id, name: 'Corte', durationMinutes: opts.duracao ?? 30, priceCents: 4000 })
    .returning();
  await db.insert(staffService).values([
    { barbershopId: loja.id, staffId: joao.id, serviceId: corte.id },
    { barbershopId: loja.id, staffId: maria.id, serviceId: corte.id },
  ]);
  await db.insert(workingHours).values([
    { barbershopId: loja.id, staffId: joao.id, weekday: 1, startTime: '09:00:00', endTime: '11:00:00' },
    { barbershopId: loja.id, staffId: maria.id, weekday: 1, startTime: '09:00:00', endTime: '10:00:00' },
  ]);
  return { loja, joao, maria, corte };
}

const CLIENTE = { name: 'Cliente', phone: '11999998888' };

describe('getAvailability', () => {
  it('lista os horários de um barbeiro específico', async () => {
    await withTestDb(async (db) => {
      const { loja, joao, corte } = await semear(db);
      const slots = await getAvailability(db, {
        barbershopId: loja.id, serviceId: corte.id, staffId: joao.id, date: SEGUNDA,
      });
      expect(slots).toHaveLength(4);
      expect(slots[0].start.toISOString()).toBe('2026-09-07T12:00:00.000Z');
    });
  });

  it('agrega os horários de todos os barbeiros quando nenhum é escolhido', async () => {
    await withTestDb(async (db) => {
      const { loja, corte } = await semear(db);
      const slots = await getAvailability(db, { barbershopId: loja.id, serviceId: corte.id, date: SEGUNDA });
      const inicios = [...new Set(slots.map((s) => s.start.toISOString()))];
      expect(inicios).toHaveLength(4);
    });
  });

  it('usa a duração própria do barbeiro quando existe', async () => {
    await withTestDb(async (db) => {
      const { loja, joao, corte } = await semear(db);
      await db
        .update(staffService)
        .set({ durationMinutesOverride: 60 })
        .where(eq(staffService.staffId, joao.id));
      const slots = await getAvailability(db, {
        barbershopId: loja.id, serviceId: corte.id, staffId: joao.id, date: SEGUNDA,
      });
      expect(slots).toHaveLength(2);
    });
  });
});

describe('createAppointment', () => {
  it('cria o agendamento com snapshot do serviço', async () => {
    await withTestDb(async (db) => {
      const { loja, joao, corte } = await semear(db);
      const criado = await createAppointment(db, {
        barbershopId: loja.id, serviceId: corte.id, staffId: joao.id,
        startAt: new Date('2026-09-07T12:00:00Z'), customer: CLIENTE, origin: 'PUBLIC',
      });
      const [linha] = await db.select().from(appointment).where(eq(appointment.id, criado.appointmentId));
      expect(linha.serviceNameSnapshot).toBe('Corte');
      expect(linha.servicePriceCentsSnapshot).toBe(4000);
      expect(linha.serviceDurationMinutesSnapshot).toBe(30);
      expect(linha.endAt.toISOString()).toBe('2026-09-07T12:30:00.000Z');
    });
  });

  it('arredonda o fim para slots inteiros quando o serviço não fecha na grade', async () => {
    await withTestDb(async (db) => {
      const { loja, joao, corte } = await semear(db, { duracao: 45 });
      const criado = await createAppointment(db, {
        barbershopId: loja.id, serviceId: corte.id, staffId: joao.id,
        startAt: new Date('2026-09-07T12:00:00Z'), customer: CLIENTE, origin: 'PUBLIC',
      });
      const [linha] = await db.select().from(appointment).where(eq(appointment.id, criado.appointmentId));
      expect(linha.serviceDurationMinutesSnapshot).toBe(45);
      expect(linha.endAt.toISOString()).toBe('2026-09-07T13:00:00.000Z');
    });
  });

  it('recusa horário que não está na grade oferecida', async () => {
    await withTestDb(async (db) => {
      const { loja, joao, corte } = await semear(db);
      await expect(
        createAppointment(db, {
          barbershopId: loja.id, serviceId: corte.id, staffId: joao.id,
          startAt: new Date('2026-09-07T12:10:00Z'), customer: CLIENTE, origin: 'PUBLIC',
        }),
      ).rejects.toBeInstanceOf(SlotUnavailableError);
    });
  });

  it('recusa horário fora do expediente', async () => {
    await withTestDb(async (db) => {
      const { loja, joao, corte } = await semear(db);
      await expect(
        createAppointment(db, {
          barbershopId: loja.id, serviceId: corte.id, staffId: joao.id,
          startAt: new Date('2026-09-07T20:00:00Z'), customer: CLIENTE, origin: 'PUBLIC',
        }),
      ).rejects.toBeInstanceOf(SlotUnavailableError);
    });
  });

  it('recusa o segundo agendamento no mesmo horário do mesmo barbeiro', async () => {
    await withTestDb(async (db) => {
      const { loja, joao, corte } = await semear(db);
      const args = {
        barbershopId: loja.id, serviceId: corte.id, staffId: joao.id,
        startAt: new Date('2026-09-07T12:00:00Z'), customer: CLIENTE, origin: 'PUBLIC' as const,
      };
      await createAppointment(db, args);
      await expect(createAppointment(db, args)).rejects.toBeInstanceOf(SlotUnavailableError);
    });
  });

  it('escolhe um barbeiro livre no modo "qualquer"', async () => {
    await withTestDb(async (db) => {
      const { loja, corte, joao, maria } = await semear(db);
      const primeiro = await createAppointment(db, {
        barbershopId: loja.id, serviceId: corte.id,
        startAt: new Date('2026-09-07T12:00:00Z'), customer: CLIENTE, origin: 'PUBLIC',
      });
      const segundo = await createAppointment(db, {
        barbershopId: loja.id, serviceId: corte.id,
        startAt: new Date('2026-09-07T12:00:00Z'),
        customer: { name: 'Outro', phone: '11977776666' }, origin: 'PUBLIC',
      });
      expect(new Set([primeiro.staffId, segundo.staffId])).toEqual(new Set([joao.id, maria.id]));
    });
  });

  it('reaproveita o cliente pelo telefone', async () => {
    await withTestDb(async (db) => {
      const { loja, joao, maria, corte } = await semear(db);
      const a = await createAppointment(db, {
        barbershopId: loja.id, serviceId: corte.id, staffId: joao.id,
        startAt: new Date('2026-09-07T12:00:00Z'), customer: CLIENTE, origin: 'PUBLIC',
      });
      const b = await createAppointment(db, {
        barbershopId: loja.id, serviceId: corte.id, staffId: maria.id,
        startAt: new Date('2026-09-07T12:00:00Z'), customer: CLIENTE, origin: 'PUBLIC',
      });
      const [linhaA] = await db.select().from(appointment).where(eq(appointment.id, a.appointmentId));
      const [linhaB] = await db.select().from(appointment).where(eq(appointment.id, b.appointmentId));
      expect(linhaA.customerId).toBe(linhaB.customerId);
    });
  });
});

describe('cancelAppointment', () => {
  it('libera o horário para um novo agendamento', async () => {
    await withTestDb(async (db) => {
      const { loja, joao, corte } = await semear(db);
      const args = {
        barbershopId: loja.id, serviceId: corte.id, staffId: joao.id,
        startAt: new Date('2026-09-07T12:00:00Z'), customer: CLIENTE, origin: 'PUBLIC' as const,
      };
      const criado = await createAppointment(db, args);
      await cancelAppointment(db, loja.id, criado.appointmentId);
      const novo = await createAppointment(db, args);
      expect(novo.appointmentId).not.toBe(criado.appointmentId);
    });
  });

  it('não cancela agendamento de outra barbearia', async () => {
    await withTestDb(async (db) => {
      const { loja, joao, corte } = await semear(db);
      const criado = await createAppointment(db, {
        barbershopId: loja.id, serviceId: corte.id, staffId: joao.id,
        startAt: new Date('2026-09-07T12:00:00Z'), customer: CLIENTE, origin: 'PUBLIC',
      });
      const [outra] = await db.insert(barbershop).values({ slug: 'outra', name: 'Outra' }).returning();
      await expect(cancelAppointment(db, outra.id, criado.appointmentId)).rejects.toThrow();
      const [linha] = await db.select().from(appointment).where(eq(appointment.id, criado.appointmentId));
      expect(linha.status).toBe('BOOKED');
    });
  });
});
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `npx vitest run tests/integration/booking.test.ts`
Expected: FAIL — `Cannot find module '@/domain/booking'`.

- [ ] **Step 3: Implementar os erros de domínio**

Criar `src/domain/booking/errors.ts`:

```ts
export class SlotUnavailableError extends Error {
  readonly code = 'SLOT_UNAVAILABLE';
  constructor(message = 'Esse horário não está mais disponível') {
    super(message);
    this.name = 'SlotUnavailableError';
  }
}

export class SlotTakenError extends Error {
  readonly code = 'SLOT_TAKEN';
  constructor(message = 'Esse horário acabou de ser preenchido') {
    super(message);
    this.name = 'SlotTakenError';
  }
}

export class NotFoundError extends Error {
  readonly code = 'NOT_FOUND';
  constructor(message = 'Registro não encontrado') {
    super(message);
    this.name = 'NotFoundError';
  }
}

/** O Postgres devolve 23P01 quando a constraint EXCLUDE recusa a inserção. */
export function isExclusionViolation(erro: unknown): boolean {
  return typeof erro === 'object' && erro !== null && 'code' in erro && (erro as { code: unknown }).code === '23P01';
}
```

- [ ] **Step 4: Implementar o serviço de disponibilidade**

Criar `src/domain/booking/availability-service.ts`:

```ts
import { DateTime } from 'luxon';
import { computeAvailability, parseTimeToMinutes, type Slot } from '@/domain/availability';
import {
  findBarbershopById, findServiceById, listStaffForService, listWorkingHours, listBusyRanges,
  type Db,
} from '@/db/repositories';
import { NotFoundError } from './errors';

export type AvailabilitySlot = { staffId: string; staffName: string; start: Date; end: Date };

export async function getAvailability(
  db: Db,
  params: { barbershopId: string; serviceId: string; staffId?: string; date: string; now?: Date },
): Promise<AvailabilitySlot[]> {
  const loja = await findBarbershopById(db, params.barbershopId);
  if (!loja) throw new NotFoundError('Barbearia não encontrada');

  const servico = await findServiceById(db, params.barbershopId, params.serviceId);
  if (!servico || !servico.active) throw new NotFoundError('Serviço não encontrado');

  const candidatos = await listStaffForService(db, params.barbershopId, params.serviceId);
  const equipe = params.staffId ? candidatos.filter((c) => c.id === params.staffId) : candidatos;
  if (equipe.length === 0) return [];

  const dia = DateTime.fromISO(params.date, { zone: loja.timeZone });
  if (!dia.isValid) throw new NotFoundError('Data inválida');
  const inicioDia = dia.startOf('day').toJSDate();
  const fimDia = dia.plus({ days: 1 }).startOf('day').toJSDate();
  const agora = params.now ?? new Date();

  const resultado: AvailabilitySlot[] = [];

  for (const barbeiro of equipe) {
    const expediente = await listWorkingHours(db, params.barbershopId, barbeiro.id, dia.weekday);
    if (expediente.length === 0) continue;

    const ocupados = await listBusyRanges(db, params.barbershopId, barbeiro.id, inicioDia, fimDia);

    const slots: Slot[] = computeAvailability({
      date: params.date,
      timeZone: loja.timeZone,
      slotMinutes: loja.slotMinutes,
      minLeadMinutes: loja.minLeadMinutes,
      serviceDurationMinutes: Number(barbeiro.effectiveDurationMinutes),
      workingBlocks: expediente.map((b) => ({
        startMinute: parseTimeToMinutes(b.startTime),
        endMinute: parseTimeToMinutes(b.endTime),
      })),
      busy: ocupados,
      now: agora,
    });

    for (const slot of slots) {
      resultado.push({ staffId: barbeiro.id, staffName: barbeiro.name, start: slot.start, end: slot.end });
    }
  }

  return resultado.sort((a, b) => a.start.getTime() - b.start.getTime());
}
```

- [ ] **Step 5: Implementar a criação do agendamento**

Criar `src/domain/booking/create-appointment.ts`:

```ts
import { DateTime } from 'luxon';
import { appointment } from '@/db/schema';
import { findBarbershopById, findServiceById, upsertCustomer, type Db } from '@/db/repositories';
import { getAvailability } from './availability-service';
import { NotFoundError, SlotTakenError, SlotUnavailableError, isExclusionViolation } from './errors';

export type CreateAppointmentInput = {
  barbershopId: string;
  serviceId: string;
  staffId?: string;
  startAt: Date;
  customer: { name: string; phone: string };
  origin: 'PUBLIC' | 'PANEL' | 'BOT';
  now?: Date;
};

export async function createAppointment(db: Db, input: CreateAppointmentInput) {
  const loja = await findBarbershopById(db, input.barbershopId);
  if (!loja) throw new NotFoundError('Barbearia não encontrada');

  const servico = await findServiceById(db, input.barbershopId, input.serviceId);
  if (!servico || !servico.active) throw new NotFoundError('Serviço não encontrado');

  const date = DateTime.fromJSDate(input.startAt).setZone(loja.timeZone).toISODate()!;

  // Recalcula sempre: o horário que o navegador mostrou é sugestão, não reserva.
  const disponiveis = await getAvailability(db, {
    barbershopId: input.barbershopId,
    serviceId: input.serviceId,
    staffId: input.staffId,
    date,
    now: input.now,
  });

  const candidatos = disponiveis.filter((s) => s.start.getTime() === input.startAt.getTime());
  if (candidatos.length === 0) throw new SlotUnavailableError();

  const escolhido = candidatos[0];
  const cliente = await upsertCustomer(db, input.barbershopId, input.customer);

  try {
    const [linha] = await db
      .insert(appointment)
      .values({
        barbershopId: input.barbershopId,
        staffId: escolhido.staffId,
        customerId: cliente.id,
        serviceId: servico.id,
        serviceNameSnapshot: servico.name,
        servicePriceCentsSnapshot: servico.priceCents,
        serviceDurationMinutesSnapshot: servico.durationMinutes,
        startAt: escolhido.start,
        endAt: escolhido.end,
        origin: input.origin,
      })
      .returning();

    return { appointmentId: linha.id, staffId: linha.staffId, startAt: linha.startAt, endAt: linha.endAt };
  } catch (erro) {
    if (isExclusionViolation(erro)) throw new SlotTakenError();
    throw erro;
  }
}
```

O snapshot de duração guarda a duração **do serviço** (45), enquanto `endAt` vem do slot (60) — os dois números divergem de propósito, conforme a seção 4 do spec.

- [ ] **Step 6: Implementar o cancelamento**

Criar `src/domain/booking/cancel-appointment.ts`:

```ts
import { and, eq, ne } from 'drizzle-orm';
import { appointment } from '@/db/schema';
import type { Db } from '@/db/repositories';
import { NotFoundError } from './errors';

export async function cancelAppointment(db: Db, barbershopId: string, appointmentId: string) {
  const linhas = await db
    .update(appointment)
    .set({ status: 'CANCELED', canceledAt: new Date() })
    .where(
      and(
        eq(appointment.barbershopId, barbershopId),
        eq(appointment.id, appointmentId),
        ne(appointment.status, 'CANCELED'),
      ),
    )
    .returning({ id: appointment.id });

  if (linhas.length === 0) throw new NotFoundError('Agendamento não encontrado');
}
```

Criar `src/domain/booking/index.ts`:

```ts
export { getAvailability, type AvailabilitySlot } from './availability-service';
export { createAppointment, type CreateAppointmentInput } from './create-appointment';
export { cancelAppointment } from './cancel-appointment';
export { SlotTakenError, SlotUnavailableError, NotFoundError } from './errors';
```

- [ ] **Step 7: Rodar para ver passar**

Run: `npx vitest run tests/integration/booking.test.ts`
Expected: PASS, 12 testes.

- [ ] **Step 8: Rodar a suíte inteira e commitar**

Run: `npm test`

```bash
git add -A
git commit -m "feat(agenda): criação e cancelamento de agendamento com revalidação no servidor"
```

---

## Task 11: API pública de disponibilidade e agendamento

**Files:**
- Create: `src/app/api/public/[slug]/catalog/route.ts`, `src/app/api/public/[slug]/availability/route.ts`, `src/app/api/public/[slug]/appointments/route.ts`
- Create: `src/lib/api-error.ts`
- Test: `tests/integration/public-api.test.ts`

**Interfaces:**
- Consumes: `getAvailability` e `createAppointment` da Task 10, `findBarbershopBySlug` da Task 6
- Produces (contratos HTTP consumidos pela Task 12):
  - `GET /api/public/{slug}/catalog` → `{ shop: { name, timeZone, maxAdvanceDays }, services: [{ id, name, durationMinutes, priceCents }], staff: [{ id, name, photoUrl, serviceIds: string[] }] }`
  - `GET /api/public/{slug}/availability?serviceId=&date=&staffId=` → `{ slots: [{ startAt: string, staffId, staffName }] }`
  - `POST /api/public/{slug}/appointments` body `{ serviceId, staffId?, startAt, name, phone }` → `201 { appointmentId, manageUrl, startAt, staffName }` · `409 { error: 'SLOT_TAKEN' | 'SLOT_UNAVAILABLE', message }` · `400 { error: 'INVALID_INPUT', message }`
  - `toApiError(erro: unknown): Response` de `src/lib/api-error.ts`

- [ ] **Step 1: Escrever o teste da API pública**

Criar `tests/integration/public-api.test.ts`. O teste chama os handlers das rotas diretamente (sem servidor HTTP), passando `new Request(...)` e o `params` que o Next.js entregaria:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { withTestDb } from '../helpers/db';
import { barbershop, staff, service, staffService, workingHours } from '@/db/schema';
import { GET as getAvailabilityRoute } from '@/app/api/public/[slug]/availability/route';
import { POST as postAppointmentRoute } from '@/app/api/public/[slug]/appointments/route';
import { GET as getCatalogRoute } from '@/app/api/public/[slug]/catalog/route';

const SEGUNDA = '2026-09-07';

async function semear(db: any) {
  const [loja] = await db
    .insert(barbershop)
    .values({ slug: 'barbearia-teste', name: 'Barbearia Teste', minLeadMinutes: 0 })
    .returning();
  const [joao] = await db.insert(staff).values({ barbershopId: loja.id, name: 'João', role: 'OWNER' }).returning();
  const [corte] = await db
    .insert(service)
    .values({ barbershopId: loja.id, name: 'Corte', durationMinutes: 30, priceCents: 4000 })
    .returning();
  await db.insert(staffService).values({ barbershopId: loja.id, staffId: joao.id, serviceId: corte.id });
  await db.insert(workingHours).values({
    barbershopId: loja.id, staffId: joao.id, weekday: 1, startTime: '09:00:00', endTime: '11:00:00',
  });
  return { loja, joao, corte };
}

const params = (slug: string) => ({ params: Promise.resolve({ slug }) });

describe('API pública', () => {
  it('devolve o catálogo da barbearia', async () => {
    await withTestDb(async (db) => {
      const { corte } = await semear(db);
      const res = await getCatalogRoute(new Request('http://x/api/public/barbearia-teste/catalog'), params('barbearia-teste'));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.shop.name).toBe('Barbearia Teste');
      expect(body.services.map((s: any) => s.id)).toEqual([corte.id]);
      expect(body.staff[0].serviceIds).toEqual([corte.id]);
    });
  });

  it('devolve 404 para slug inexistente', async () => {
    await withTestDb(async () => {
      const res = await getCatalogRoute(new Request('http://x/api/public/nao-existe/catalog'), params('nao-existe'));
      expect(res.status).toBe(404);
    });
  });

  it('não expõe telefone de cliente no catálogo', async () => {
    await withTestDb(async (db) => {
      await semear(db);
      const res = await getCatalogRoute(new Request('http://x/api/public/barbearia-teste/catalog'), params('barbearia-teste'));
      expect(JSON.stringify(await res.json())).not.toMatch(/phone|telefone/i);
    });
  });

  it('lista horários livres do dia', async () => {
    await withTestDb(async (db) => {
      const { corte } = await semear(db);
      const url = `http://x/api/public/barbearia-teste/availability?serviceId=${corte.id}&date=${SEGUNDA}`;
      const res = await getAvailabilityRoute(new Request(url), params('barbearia-teste'));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.slots).toHaveLength(4);
      expect(body.slots[0].startAt).toBe('2026-09-07T12:00:00.000Z');
    });
  });

  it('recusa consulta sem serviceId', async () => {
    await withTestDb(async (db) => {
      await semear(db);
      const res = await getAvailabilityRoute(
        new Request(`http://x/api/public/barbearia-teste/availability?date=${SEGUNDA}`),
        params('barbearia-teste'),
      );
      expect(res.status).toBe(400);
    });
  });

  it('cria o agendamento e devolve o link de gerenciamento', async () => {
    await withTestDb(async (db) => {
      const { corte } = await semear(db);
      const res = await postAppointmentRoute(
        new Request('http://x/api/public/barbearia-teste/appointments', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            serviceId: corte.id, startAt: '2026-09-07T12:00:00.000Z',
            name: 'Cliente', phone: '11999998888',
          }),
        }),
        params('barbearia-teste'),
      );
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.manageUrl).toMatch(/\/agendamento\//);
      expect(body.staffName).toBe('João');
    });
  });

  it('devolve 409 quando o horário já foi tomado', async () => {
    await withTestDb(async (db) => {
      const { corte } = await semear(db);
      const pedido = () =>
        postAppointmentRoute(
          new Request('http://x/api/public/barbearia-teste/appointments', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              serviceId: corte.id, startAt: '2026-09-07T12:00:00.000Z',
              name: 'Cliente', phone: '11999998888',
            }),
          }),
          params('barbearia-teste'),
        );
      expect((await pedido()).status).toBe(201);
      const segunda = await pedido();
      expect(segunda.status).toBe(409);
      expect((await segunda.json()).error).toMatch(/SLOT_/);
    });
  });

  it('recusa telefone inválido', async () => {
    await withTestDb(async (db) => {
      const { corte } = await semear(db);
      const res = await postAppointmentRoute(
        new Request('http://x/api/public/barbearia-teste/appointments', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            serviceId: corte.id, startAt: '2026-09-07T12:00:00.000Z', name: 'Cliente', phone: '123',
          }),
        }),
        params('barbearia-teste'),
      );
      expect(res.status).toBe(400);
    });
  });
});
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `npx vitest run tests/integration/public-api.test.ts`
Expected: FAIL — rotas não existem.

- [ ] **Step 3: Implementar o tradutor de erros**

Criar `src/lib/api-error.ts`:

```ts
import { NextResponse } from 'next/server';
import { NotFoundError, SlotTakenError, SlotUnavailableError } from '@/domain/booking';

export function toApiError(erro: unknown): NextResponse {
  if (erro instanceof SlotTakenError || erro instanceof SlotUnavailableError) {
    return NextResponse.json({ error: erro.code, message: erro.message }, { status: 409 });
  }
  if (erro instanceof NotFoundError) {
    return NextResponse.json({ error: 'NOT_FOUND', message: erro.message }, { status: 404 });
  }
  console.error('Erro não tratado na API pública', erro);
  return NextResponse.json(
    { error: 'INTERNAL', message: 'Não foi possível concluir. Tente de novo.' },
    { status: 500 },
  );
}

export function invalidInput(message: string): NextResponse {
  return NextResponse.json({ error: 'INVALID_INPUT', message }, { status: 400 });
}
```

- [ ] **Step 4: Implementar a rota de catálogo**

Criar `src/app/api/public/[slug]/catalog/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { db } from '@/db/client';
import { staffService, staff } from '@/db/schema';
import { findBarbershopBySlug, listActiveServices, listActiveStaff } from '@/db/repositories';

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const loja = await findBarbershopBySlug(db, slug);
  if (!loja) {
    return NextResponse.json({ error: 'NOT_FOUND', message: 'Barbearia não encontrada' }, { status: 404 });
  }

  const [servicos, equipe, vinculos] = await Promise.all([
    listActiveServices(db, loja.id),
    listActiveStaff(db, loja.id),
    db
      .select({ staffId: staffService.staffId, serviceId: staffService.serviceId })
      .from(staffService)
      .innerJoin(staff, eq(staff.id, staffService.staffId))
      .where(and(eq(staffService.barbershopId, loja.id), eq(staff.active, true))),
  ]);

  return NextResponse.json({
    shop: { name: loja.name, timeZone: loja.timeZone, maxAdvanceDays: loja.maxAdvanceDays },
    services: servicos.map((s) => ({
      id: s.id, name: s.name, durationMinutes: s.durationMinutes, priceCents: s.priceCents,
    })),
    staff: equipe.map((b) => ({
      id: b.id,
      name: b.name,
      photoUrl: b.photoUrl,
      serviceIds: vinculos.filter((v) => v.staffId === b.id).map((v) => v.serviceId),
    })),
  });
}
```

Repare no `.map()` explícito: devolver a linha do banco inteira vazaria colunas internas. A superfície pública só mostra o que precisa.

- [ ] **Step 5: Implementar a rota de disponibilidade**

Criar `src/app/api/public/[slug]/availability/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db/client';
import { findBarbershopBySlug } from '@/db/repositories';
import { getAvailability } from '@/domain/booking';
import { toApiError, invalidInput } from '@/lib/api-error';

const query = z.object({
  serviceId: z.string().uuid('serviceId inválido'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date deve estar no formato YYYY-MM-DD'),
  staffId: z.string().uuid().optional(),
});

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const url = new URL(req.url);
  const parsed = query.safeParse({
    serviceId: url.searchParams.get('serviceId') ?? undefined,
    date: url.searchParams.get('date') ?? undefined,
    staffId: url.searchParams.get('staffId') ?? undefined,
  });
  if (!parsed.success) return invalidInput(parsed.error.issues[0].message);

  const loja = await findBarbershopBySlug(db, slug);
  if (!loja) {
    return NextResponse.json({ error: 'NOT_FOUND', message: 'Barbearia não encontrada' }, { status: 404 });
  }

  try {
    const slots = await getAvailability(db, {
      barbershopId: loja.id,
      serviceId: parsed.data.serviceId,
      staffId: parsed.data.staffId,
      date: parsed.data.date,
    });
    return NextResponse.json({
      slots: slots.map((s) => ({
        startAt: s.start.toISOString(), staffId: s.staffId, staffName: s.staffName,
      })),
    });
  } catch (erro) {
    return toApiError(erro);
  }
}
```

- [ ] **Step 6: Implementar a rota de criação**

Criar `src/app/api/public/[slug]/appointments/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db/client';
import { findBarbershopBySlug, listActiveStaff } from '@/db/repositories';
import { createAppointment } from '@/domain/booking';
import { toApiError, invalidInput } from '@/lib/api-error';
import { buildManageUrl } from '@/lib/tokens';

const body = z.object({
  serviceId: z.string().uuid('Serviço inválido'),
  staffId: z.string().uuid().optional(),
  startAt: z.string().datetime('Horário inválido'),
  name: z.string().trim().min(2, 'Informe seu nome'),
  phone: z
    .string()
    .transform((v) => v.replace(/\D/g, ''))
    .refine((v) => v.length >= 10 && v.length <= 13, 'Informe um telefone com DDD'),
});

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  let dados;
  try {
    dados = body.parse(await req.json());
  } catch (erro) {
    if (erro instanceof z.ZodError) return invalidInput(erro.issues[0].message);
    return invalidInput('Não foi possível ler o pedido');
  }

  const loja = await findBarbershopBySlug(db, slug);
  if (!loja) {
    return NextResponse.json({ error: 'NOT_FOUND', message: 'Barbearia não encontrada' }, { status: 404 });
  }

  try {
    const criado = await createAppointment(db, {
      barbershopId: loja.id,
      serviceId: dados.serviceId,
      staffId: dados.staffId,
      startAt: new Date(dados.startAt),
      customer: { name: dados.name, phone: dados.phone },
      origin: 'PUBLIC',
    });

    const equipe = await listActiveStaff(db, loja.id);
    const barbeiro = equipe.find((b) => b.id === criado.staffId);

    return NextResponse.json(
      {
        appointmentId: criado.appointmentId,
        manageUrl: buildManageUrl(criado.appointmentId),
        startAt: criado.startAt.toISOString(),
        staffName: barbeiro?.name ?? '',
      },
      { status: 201 },
    );
  } catch (erro) {
    return toApiError(erro);
  }
}
```

`buildManageUrl` vem da Task 12. Executar a Task 12 antes desta, ou criar `src/lib/tokens.ts` já com a implementação de lá — sem ele, os testes desta task não compilam.

- [ ] **Step 7: Rodar para ver passar**

Run: `npx vitest run tests/integration/public-api.test.ts`
Expected: PASS, 8 testes.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(api): rotas públicas de catálogo, disponibilidade e agendamento"
```

---

## Task 12: Link de gerenciamento do cliente

**Files:**
- Create: `src/lib/tokens.ts`
- Create: `src/app/agendamento/[token]/page.tsx`, `src/app/agendamento/[token]/actions.ts`
- Test: `src/lib/tokens.test.ts`

**Interfaces:**
- Consumes: `env` da Task 2, `cancelAppointment` da Task 10
- Produces:
  - `signManageToken(appointmentId: string, expiresAtMs: number): string`
  - `verifyManageToken(token: string, now?: Date): { appointmentId: string } | null` — devolve `null` para token adulterado, malformado ou vencido
  - `buildManageUrl(appointmentId: string): string` — `${APP_URL}/agendamento/${token}`, validade de 90 dias

- [ ] **Step 1: Escrever os testes do token**

Criar `src/lib/tokens.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/env', () => ({
  env: {
    MANAGE_TOKEN_SECRET: 'segredo-de-teste-com-32-caracteres!',
    APP_URL: 'https://agenda.exemplo.com',
    DATABASE_URL: 'postgres://x',
    AUTH_SECRET: 'a'.repeat(32),
  },
}));

const { signManageToken, verifyManageToken, buildManageUrl } = await import('./tokens');

const ID = '11111111-1111-4111-8111-111111111111';
const DAQUI_UMA_HORA = Date.now() + 3_600_000;

describe('manage token', () => {
  it('assina e verifica o mesmo agendamento', () => {
    const token = signManageToken(ID, DAQUI_UMA_HORA);
    expect(verifyManageToken(token)).toEqual({ appointmentId: ID });
  });

  it('recusa token com assinatura adulterada', () => {
    const token = signManageToken(ID, DAQUI_UMA_HORA);
    const adulterado = token.slice(0, -3) + 'aaa';
    expect(verifyManageToken(adulterado)).toBeNull();
  });

  it('recusa token com id trocado', () => {
    const token = signManageToken(ID, DAQUI_UMA_HORA);
    const partes = token.split('.');
    const outro = ['22222222-2222-4222-8222-222222222222', partes[1], partes[2]].join('.');
    expect(verifyManageToken(outro)).toBeNull();
  });

  it('recusa token vencido', () => {
    const token = signManageToken(ID, Date.now() - 1000);
    expect(verifyManageToken(token)).toBeNull();
  });

  it('recusa token malformado', () => {
    expect(verifyManageToken('nada-a-ver')).toBeNull();
    expect(verifyManageToken('')).toBeNull();
    expect(verifyManageToken('a.b')).toBeNull();
  });

  it('monta a URL de gerenciamento com o host configurado', () => {
    expect(buildManageUrl(ID)).toMatch(/^https:\/\/agenda\.exemplo\.com\/agendamento\/.+/);
  });
});
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `npx vitest run src/lib/tokens.test.ts`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar o token**

Criar `src/lib/tokens.ts`:

```ts
import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '@/lib/env';

const VALIDADE_MS = 90 * 24 * 60 * 60 * 1000;

function assinar(payload: string): string {
  return createHmac('sha256', env.MANAGE_TOKEN_SECRET).update(payload).digest('base64url');
}

export function signManageToken(appointmentId: string, expiresAtMs: number): string {
  const payload = `${appointmentId}.${expiresAtMs}`;
  return `${payload}.${assinar(payload)}`;
}

export function verifyManageToken(token: string, now: Date = new Date()): { appointmentId: string } | null {
  const partes = token.split('.');
  if (partes.length !== 3) return null;

  const [appointmentId, expiraTexto, assinatura] = partes;
  const esperada = assinar(`${appointmentId}.${expiraTexto}`);

  const recebidaBuf = Buffer.from(assinatura, 'base64url');
  const esperadaBuf = Buffer.from(esperada, 'base64url');
  if (recebidaBuf.length !== esperadaBuf.length) return null;
  if (!timingSafeEqual(recebidaBuf, esperadaBuf)) return null;

  const expira = Number(expiraTexto);
  if (!Number.isFinite(expira) || expira < now.getTime()) return null;

  return { appointmentId };
}

export function buildManageUrl(appointmentId: string): string {
  const token = signManageToken(appointmentId, Date.now() + VALIDADE_MS);
  return `${env.APP_URL}/agendamento/${token}`;
}
```

`timingSafeEqual` em vez de `===`: comparação de assinatura que sai mais cedo no primeiro byte diferente vaza informação por tempo.

- [ ] **Step 4: Rodar para ver passar**

Run: `npx vitest run src/lib/tokens.test.ts`
Expected: PASS, 6 testes.

- [ ] **Step 5: Construir a página de gerenciamento**

Criar `src/app/agendamento/[token]/page.tsx` — server component:

```tsx
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { appointment, barbershop, staff } from '@/db/schema';
import { verifyManageToken } from '@/lib/tokens';
import { CancelForm } from './cancel-form';

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const verificado = verifyManageToken(token);
  if (!verificado) notFound();

  const [linha] = await db
    .select({
      id: appointment.id,
      startAt: appointment.startAt,
      status: appointment.status,
      serviceName: appointment.serviceNameSnapshot,
      staffName: staff.name,
      shopName: barbershop.name,
      shopSlug: barbershop.slug,
      timeZone: barbershop.timeZone,
    })
    .from(appointment)
    .innerJoin(staff, eq(staff.id, appointment.staffId))
    .innerJoin(barbershop, eq(barbershop.id, appointment.barbershopId))
    .where(eq(appointment.id, verificado.appointmentId))
    .limit(1);

  if (!linha) notFound();

  const quando = linha.startAt.toLocaleString('pt-BR', {
    timeZone: linha.timeZone,
    dateStyle: 'full',
    timeStyle: 'short',
  });

  return (
    <main>
      <h1>Seu horário na {linha.shopName}</h1>
      <p>{linha.serviceName} com {linha.staffName}</p>
      <p>{quando}</p>
      {linha.status === 'CANCELED' ? (
        <p>Este agendamento foi cancelado.</p>
      ) : (
        <>
          <CancelForm token={token} />
          <a href={`/b/${linha.shopSlug}`}>Marcar outro horário</a>
        </>
      )}
    </main>
  );
}
```

Criar `src/app/agendamento/[token]/actions.ts`:

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { appointment } from '@/db/schema';
import { verifyManageToken } from '@/lib/tokens';
import { cancelAppointment } from '@/domain/booking';

export type CancelState = { erro?: string; cancelado?: boolean };

export async function cancelByTokenAction(_prev: CancelState, formData: FormData): Promise<CancelState> {
  const token = String(formData.get('token') ?? '');
  const verificado = verifyManageToken(token);
  if (!verificado) return { erro: 'Este link não é mais válido' };

  const [linha] = await db
    .select({ barbershopId: appointment.barbershopId })
    .from(appointment)
    .where(eq(appointment.id, verificado.appointmentId))
    .limit(1);
  if (!linha) return { erro: 'Agendamento não encontrado' };

  try {
    await cancelAppointment(db, linha.barbershopId, verificado.appointmentId);
  } catch {
    return { erro: 'Não foi possível cancelar. Fale com a barbearia.' };
  }

  revalidatePath(`/agendamento/${token}`);
  return { cancelado: true };
}
```

Criar `src/app/agendamento/[token]/cancel-form.tsx` — componente cliente com `useActionState`, botão "Cancelar meu horário" e confirmação antes de enviar.

Remarcar na Fase 1 é cancelar e marcar de novo — o link "Marcar outro horário" leva de volta à página pública. Fluxo de remarcação em uma tela só fica para depois.

- [ ] **Step 6: Rodar a suíte e commitar**

Run: `npm test && npm run lint`

```bash
git add -A
git commit -m "feat(cliente): link assinado para o cliente ver e cancelar o horário"
```

---

## Task 13: Página pública de agendamento

**Files:**
- Create: `src/app/b/[slug]/page.tsx`, `src/app/b/[slug]/booking-wizard.tsx`, `src/app/b/[slug]/steps/service-step.tsx`, `src/app/b/[slug]/steps/staff-step.tsx`, `src/app/b/[slug]/steps/slot-step.tsx`, `src/app/b/[slug]/steps/contact-step.tsx`, `src/app/b/[slug]/steps/done-step.tsx`
- Create: `src/lib/format.ts`
- Test: `src/lib/format.test.ts`

**Interfaces:**
- Consumes: contratos HTTP da Task 11
- Produces:
  - `formatPrice(cents: number): string` — `'R$ 40,00'`
  - `formatDuration(minutes: number): string` — `'45 min'`, `'1 h'`, `'1 h 30 min'`
  - `formatDayLabel(isoDate: string, timeZone: string): string` — `'seg, 7 de set'`
  - `formatTime(iso: string, timeZone: string): string` — `'09:00'`

- [ ] **Step 1: Escrever os testes de formatação**

Criar `src/lib/format.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { formatPrice, formatDuration, formatTime, formatDayLabel } from './format';

describe('formatPrice', () => {
  it('formata reais e centavos', () => expect(formatPrice(4050)).toBe('R$ 40,50'));
  it('formata valor redondo', () => expect(formatPrice(4000)).toBe('R$ 40,00'));
  it('formata gratuito', () => expect(formatPrice(0)).toBe('Grátis'));
});

describe('formatDuration', () => {
  it('minutos', () => expect(formatDuration(45)).toBe('45 min'));
  it('hora exata', () => expect(formatDuration(60)).toBe('1 h'));
  it('hora e minutos', () => expect(formatDuration(90)).toBe('1 h 30 min'));
});

describe('formatTime', () => {
  it('mostra a hora no fuso da barbearia', () => {
    expect(formatTime('2026-09-07T12:00:00.000Z', 'America/Sao_Paulo')).toBe('09:00');
  });
});

describe('formatDayLabel', () => {
  it('rotula o dia em pt-BR', () => {
    expect(formatDayLabel('2026-09-07', 'America/Sao_Paulo')).toMatch(/seg/i);
    expect(formatDayLabel('2026-09-07', 'America/Sao_Paulo')).toMatch(/7/);
  });
});
```

Nota: `formatPrice` usa espaço não separável entre `R$` e o número quando gerado por `Intl`. Para os testes baterem, normalizar com `.replace(/ /g, ' ')` dentro da função.

- [ ] **Step 2: Rodar para ver falhar**

Run: `npx vitest run src/lib/format.test.ts`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar a formatação**

Criar `src/lib/format.ts`:

```ts
export function formatPrice(cents: number): string {
  if (cents === 0) return 'Grátis';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
    .format(cents / 100)
    .replace(/ /g, ' ');
}

export function formatDuration(minutes: number): string {
  const horas = Math.floor(minutes / 60);
  const resto = minutes % 60;
  if (horas === 0) return `${resto} min`;
  if (resto === 0) return `${horas} h`;
  return `${horas} h ${resto} min`;
}

export function formatTime(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    timeZone, hour: '2-digit', minute: '2-digit',
  });
}

export function formatDayLabel(isoDate: string, timeZone: string): string {
  const data = new Date(`${isoDate}T12:00:00Z`);
  return data
    .toLocaleDateString('pt-BR', { timeZone, weekday: 'short', day: 'numeric', month: 'short' })
    .replace(/\.$/, '');
}
```

- [ ] **Step 4: Rodar para ver passar**

Run: `npx vitest run src/lib/format.test.ts`
Expected: PASS, 8 testes.

- [ ] **Step 5: Construir o shell da página pública**

Criar `src/app/b/[slug]/page.tsx` — server component:

```tsx
import { notFound } from 'next/navigation';
import { db } from '@/db/client';
import { findBarbershopBySlug, listActiveServices } from '@/db/repositories';
import { BookingWizard } from './booking-wizard';

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const loja = await findBarbershopBySlug(db, slug);
  if (!loja) notFound();

  const servicos = await listActiveServices(db, loja.id);

  if (servicos.length === 0) {
    return (
      <main>
        <h1>{loja.name}</h1>
        <p>A agenda desta barbearia ainda não está disponível. Volte em breve.</p>
      </main>
    );
  }

  return (
    <main>
      <h1>{loja.name}</h1>
      <BookingWizard slug={slug} timeZone={loja.timeZone} maxAdvanceDays={loja.maxAdvanceDays} />
    </main>
  );
}
```

O aviso de agenda indisponível é requisito do spec: barbearia recém-criada nunca mostra grade vazia sem explicação.

- [ ] **Step 6: Construir o wizard**

Criar `src/app/b/[slug]/booking-wizard.tsx` — componente cliente que segura o estado do fluxo:

```tsx
'use client';

import { useState } from 'react';

type Etapa = 'servico' | 'barbeiro' | 'horario' | 'contato' | 'pronto';

export type Escolha = {
  serviceId?: string;
  serviceName?: string;
  staffId?: string;
  staffName?: string;
  startAt?: string;
};
```

O componente busca `GET /api/public/{slug}/catalog` no primeiro render e guarda serviços e equipe. Cada etapa é um componente separado em `steps/`, recebendo o que precisa por props e devolvendo a escolha por callback. Nenhuma etapa faz fetch de outra etapa — quem orquestra é o wizard.

- `ServiceStep` — cartões com nome, duração (`formatDuration`) e preço (`formatPrice`).
- `StaffStep` — barbeiros que fazem o serviço escolhido, mais a opção "Qualquer barbeiro" no topo (envia `staffId: undefined`).
- `SlotStep` — fileira horizontal de dias (hoje até `maxAdvanceDays`), e a grade de horários do dia selecionado vinda de `GET /api/public/{slug}/availability`. Dia sem horário mostra "Nenhum horário livre neste dia".
- `ContactStep` — nome e telefone, com máscara `(00) 00000-0000`, e o botão "Confirmar horário".
- `DoneStep` — resumo do agendamento e o `manageUrl` como link "Ver ou cancelar meu horário".

Estados obrigatórios em cada etapa que faz rede: carregando, erro com botão "Tentar de novo", e vazio. Uma página pública que fica em branco quando a rede falha é a que mais gera ligação para a barbearia.

- [ ] **Step 7: Tratar a colisão de horário na confirmação**

No `ContactStep`, ao receber `409` do `POST`:

```ts
if (res.status === 409) {
  const { message } = await res.json();
  setErro(message);
  voltarPara('horario');
  recarregarHorarios();
  return;
}
```

Voltar para a etapa de horário e recarregar a grade — não basta mostrar o erro, o cliente precisa do próximo passo pronto.

- [ ] **Step 8: Verificar manualmente**

Run: `npm run dev`
Abrir `http://localhost:3000/b/<slug-da-sua-barbearia>` e agendar de ponta a ponta. Conferir no painel que o agendamento apareceu.

Testar a colisão: abrir duas abas no mesmo horário, confirmar nas duas. A segunda deve voltar para a grade com a mensagem de horário tomado.

- [ ] **Step 9: Rodar a suíte e commitar**

Run: `npm test && npm run lint && npm run build`

```bash
git add -A
git commit -m "feat(publico): página de agendamento do cliente com serviço, barbeiro e horário"
```

---

## Task 14: Painel — agenda do dia

**Files:**
- Create: `src/app/app/agenda/page.tsx`, `src/app/app/agenda/actions.ts`, `src/app/app/agenda/day-grid.tsx`, `src/app/app/agenda/manual-booking-form.tsx`
- Modify: `src/app/app/page.tsx` (redirecionar para `/app/agenda`)
- Test: `tests/integration/panel-agenda.test.ts`

**Interfaces:**
- Consumes: `listAppointmentsBetween` da Task 6, `createAppointment` e `cancelAppointment` da Task 10, `requireSession` da Task 7
- Produces:
  - `buildDayColumns(appointments, staff, timeZone, date)` de `src/app/app/agenda/day-grid.tsx` — agrupa agendamentos por barbeiro para renderização
  - `setAppointmentStatusAction(appointmentId: string, status: 'DONE' | 'NO_SHOW' | 'CANCELED')`
  - `createManualAppointmentAction(prev, formData)` — agenda pelo painel, com `origin: 'PANEL'`

- [ ] **Step 1: Escrever o teste da agenda do dia**

Criar `tests/integration/panel-agenda.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { DateTime } from 'luxon';
import { withTestDb } from '../helpers/db';
import { barbershop, staff, service, staffService, workingHours } from '@/db/schema';
import { createAppointment } from '@/domain/booking';
import { listAppointmentsBetween } from '@/db/repositories';

const SEGUNDA = '2026-09-07';

async function semear(db: any) {
  const [loja] = await db
    .insert(barbershop)
    .values({ slug: 'teste', name: 'Teste', minLeadMinutes: 0 })
    .returning();
  const [joao] = await db.insert(staff).values({ barbershopId: loja.id, name: 'João', role: 'OWNER' }).returning();
  const [corte] = await db
    .insert(service)
    .values({ barbershopId: loja.id, name: 'Corte', durationMinutes: 30, priceCents: 4000 })
    .returning();
  await db.insert(staffService).values({ barbershopId: loja.id, staffId: joao.id, serviceId: corte.id });
  await db.insert(workingHours).values({
    barbershopId: loja.id, staffId: joao.id, weekday: 1, startTime: '09:00:00', endTime: '11:00:00',
  });
  return { loja, joao, corte };
}

describe('agenda do painel', () => {
  it('lista os agendamentos do dia com o nome do cliente', async () => {
    await withTestDb(async (db) => {
      const { loja, joao, corte } = await semear(db);
      await createAppointment(db, {
        barbershopId: loja.id, serviceId: corte.id, staffId: joao.id,
        startAt: new Date('2026-09-07T12:00:00Z'),
        customer: { name: 'Cliente Um', phone: '11999998888' }, origin: 'PANEL',
      });

      const inicio = DateTime.fromISO(SEGUNDA, { zone: loja.timeZone }).startOf('day').toJSDate();
      const fim = DateTime.fromISO(SEGUNDA, { zone: loja.timeZone }).plus({ days: 1 }).startOf('day').toJSDate();
      const linhas = await listAppointmentsBetween(db, loja.id, inicio, fim);

      expect(linhas).toHaveLength(1);
      expect(linhas[0].customerName).toBe('Cliente Um');
      expect(linhas[0].serviceName).toBe('Corte');
      expect(linhas[0].origin).toBe('PANEL');
    });
  });

  it('não lista agendamentos de outro dia', async () => {
    await withTestDb(async (db) => {
      const { loja, joao, corte } = await semear(db);
      await createAppointment(db, {
        barbershopId: loja.id, serviceId: corte.id, staffId: joao.id,
        startAt: new Date('2026-09-07T12:00:00Z'),
        customer: { name: 'Cliente Um', phone: '11999998888' }, origin: 'PANEL',
      });

      const outroDia = DateTime.fromISO('2026-09-08', { zone: loja.timeZone });
      const linhas = await listAppointmentsBetween(
        db, loja.id, outroDia.startOf('day').toJSDate(), outroDia.plus({ days: 1 }).startOf('day').toJSDate(),
      );
      expect(linhas).toHaveLength(0);
    });
  });

  it('não lista agendamentos de outra barbearia', async () => {
    await withTestDb(async (db) => {
      const { loja, joao, corte } = await semear(db);
      await createAppointment(db, {
        barbershopId: loja.id, serviceId: corte.id, staffId: joao.id,
        startAt: new Date('2026-09-07T12:00:00Z'),
        customer: { name: 'Cliente Um', phone: '11999998888' }, origin: 'PANEL',
      });
      const [outra] = await db.insert(barbershop).values({ slug: 'outra', name: 'Outra' }).returning();

      const inicio = DateTime.fromISO(SEGUNDA, { zone: loja.timeZone }).startOf('day').toJSDate();
      const fim = DateTime.fromISO(SEGUNDA, { zone: loja.timeZone }).plus({ days: 1 }).startOf('day').toJSDate();
      expect(await listAppointmentsBetween(db, outra.id, inicio, fim)).toHaveLength(0);
    });
  });
});
```

- [ ] **Step 2: Rodar o teste**

Run: `npx vitest run tests/integration/panel-agenda.test.ts`
Expected: PASS, 3 testes — `listAppointmentsBetween` já existe desde a Task 6. Se falhar, o defeito está no repositório.

- [ ] **Step 3: Construir a agenda do dia**

Criar `src/app/app/agenda/page.tsx` — server component que:

1. chama `requireSession()`;
2. lê `?data=YYYY-MM-DD` da query (padrão: hoje no fuso da barbearia);
3. carrega `listActiveStaff` e `listAppointmentsBetween` para o dia;
4. renderiza um seletor de dia (ontem / hoje / amanhã + campo de data) e o `<DayGrid>`.

Criar `src/app/app/agenda/day-grid.tsx`: uma coluna por barbeiro, com os agendamentos do dia em ordem de horário. Cada cartão mostra hora de início e fim, nome do cliente, telefone, serviço e preço, mais os botões "Compareceu", "Não veio" e "Cancelar".

Exportar a função de agrupamento para poder testá-la depois se precisar:

```ts
export function buildDayColumns(
  appointments: Array<{ staffId: string; startAt: Date }>,
  staffList: Array<{ id: string; name: string }>,
) {
  return staffList.map((barbeiro) => ({
    staff: barbeiro,
    items: appointments
      .filter((a) => a.staffId === barbeiro.id)
      .sort((a, b) => a.startAt.getTime() - b.startAt.getTime()),
  }));
}
```

No celular, as colunas viram uma lista única ordenada por horário, com o nome do barbeiro em cada cartão. Barbearia se opera do balcão, e o balcão tem celular.

- [ ] **Step 4: Construir as ações da agenda**

Criar `src/app/app/agenda/actions.ts`:

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { appointment } from '@/db/schema';
import { requireSession } from '@/lib/session';
import { cancelAppointment, createAppointment } from '@/domain/booking';

export async function setAppointmentStatusAction(
  appointmentId: string,
  status: 'DONE' | 'NO_SHOW' | 'CANCELED',
) {
  const sessao = await requireSession();

  if (status === 'CANCELED') {
    await cancelAppointment(db, sessao.barbershopId, appointmentId);
  } else {
    await db
      .update(appointment)
      .set({ status })
      .where(
        and(eq(appointment.barbershopId, sessao.barbershopId), eq(appointment.id, appointmentId)),
      );
  }

  revalidatePath('/app/agenda');
}

export type ManualBookingState = { erro?: string; ok?: boolean };

export async function createManualAppointmentAction(
  _prev: ManualBookingState,
  formData: FormData,
): Promise<ManualBookingState> {
  const sessao = await requireSession();

  try {
    await createAppointment(db, {
      barbershopId: sessao.barbershopId,
      serviceId: String(formData.get('serviceId')),
      staffId: String(formData.get('staffId')),
      startAt: new Date(String(formData.get('startAt'))),
      customer: {
        name: String(formData.get('name')),
        phone: String(formData.get('phone')).replace(/\D/g, ''),
      },
      origin: 'PANEL',
    });
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : 'Não foi possível agendar' };
  }

  revalidatePath('/app/agenda');
  return { ok: true };
}
```

Criar `src/app/app/agenda/manual-booking-form.tsx` — formulário com serviço, barbeiro, data, horário (carregado da mesma API de disponibilidade), nome e telefone.

O encaixe fora da grade **não** entra nesta task: `createAppointment` revalida a disponibilidade e recusaria. Fica registrado como a primeira melhoria pós-lançamento — precisa de um caminho próprio no domínio, com validação só de sobreposição.

- [ ] **Step 5: Apontar a raiz do painel para a agenda**

Modificar `src/app/app/page.tsx`:

```tsx
import { redirect } from 'next/navigation';

export default function Page() {
  redirect('/app/agenda');
}
```

- [ ] **Step 6: Verificar manualmente**

Run: `npm run dev`
Agendar pela página pública, ver o agendamento aparecer na agenda do dia, marcar "Compareceu", cancelar outro e conferir que o horário volta a aparecer na página pública.

- [ ] **Step 7: Rodar a suíte e commitar**

Run: `npm test && npm run lint`

```bash
git add -A
git commit -m "feat(painel): agenda do dia em colunas por barbeiro com encaixe manual"
```

---

## Task 15: Notificações por WhatsApp

**Files:**
- Create: `src/notifications/sender.ts`, `src/notifications/meta-whatsapp.sender.ts`, `src/notifications/templates.ts`, `src/notifications/notify.ts`, `src/notifications/index.ts`
- Modify: `src/lib/env.ts`, `.env.example`
- Modify: `src/app/api/public/[slug]/appointments/route.ts`, `src/app/agendamento/[token]/actions.ts`
- Test: `src/notifications/templates.test.ts`, `tests/integration/notify.test.ts`

**Interfaces:**
- Consumes: `notificationLog` da Task 3, `findAppointmentById` da Task 6
- Produces:
  - `interface NotificationSender { send(to: string, message: RenderedMessage): Promise<{ providerMessageId: string }> }`
  - `type RenderedMessage = { templateName: string; params: string[]; fallbackText: string }`
  - `renderConfirmation(dados): RenderedMessage`, `renderReminder(dados)`, `renderCancellation(dados)` de `templates.ts`
  - `notifyOnce(db, { barbershopId, appointmentId, type, sender }): Promise<'SENT' | 'SKIPPED' | 'FAILED'>` de `notify.ts`
  - `getSender(): NotificationSender` — devolve `MetaWhatsAppSender` ou, se `WHATSAPP_ENABLED` for falso, um sender que só registra no console

- [ ] **Step 1: Escrever os testes dos templates**

Criar `src/notifications/templates.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { renderConfirmation, renderReminder, renderCancellation } from './templates';

const DADOS = {
  customerName: 'João',
  shopName: 'Barbearia Teste',
  staffName: 'Maria',
  serviceName: 'Corte',
  startAt: new Date('2026-09-07T12:00:00Z'),
  timeZone: 'America/Sao_Paulo',
  manageUrl: 'https://exemplo.com/agendamento/abc',
};

describe('templates de mensagem', () => {
  it('confirmação traz data, hora e barbeiro no fuso da barbearia', () => {
    const msg = renderConfirmation(DADOS);
    expect(msg.fallbackText).toContain('09:00');
    expect(msg.fallbackText).toContain('Maria');
    expect(msg.fallbackText).toContain('Barbearia Teste');
    expect(msg.fallbackText).toContain(DADOS.manageUrl);
  });

  it('confirmação usa o template registrado na Meta', () => {
    const msg = renderConfirmation(DADOS);
    expect(msg.templateName).toBe('agendamento_confirmado');
    expect(msg.params).toHaveLength(5);
  });

  it('lembrete não repete o link de gerenciamento no corpo', () => {
    const msg = renderReminder(DADOS);
    expect(msg.templateName).toBe('agendamento_lembrete');
    expect(msg.fallbackText).toContain('09:00');
  });

  it('cancelamento avisa que o horário foi liberado', () => {
    const msg = renderCancellation(DADOS);
    expect(msg.templateName).toBe('agendamento_cancelado');
    expect(msg.fallbackText).toMatch(/cancelad/i);
  });

  it('escreve acentuação correta', () => {
    expect(renderConfirmation(DADOS).fallbackText).toMatch(/horário|serviço|confirmação/);
  });
});
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `npx vitest run src/notifications/templates.test.ts`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar a interface e os templates**

Criar `src/notifications/sender.ts`:

```ts
export type RenderedMessage = {
  /** Nome do template aprovado na Meta. */
  templateName: string;
  /** Parâmetros posicionais do template, na ordem em que foram registrados. */
  params: string[];
  /** Texto legível, usado em log e em senders que não usam template. */
  fallbackText: string;
};

export interface NotificationSender {
  send(to: string, message: RenderedMessage): Promise<{ providerMessageId: string }>;
}
```

Criar `src/notifications/templates.ts`:

```ts
import type { RenderedMessage } from './sender';

export type MessageData = {
  customerName: string;
  shopName: string;
  staffName: string;
  serviceName: string;
  startAt: Date;
  timeZone: string;
  manageUrl: string;
};

function data(d: MessageData) {
  return d.startAt.toLocaleDateString('pt-BR', {
    timeZone: d.timeZone, day: '2-digit', month: '2-digit',
  });
}

function hora(d: MessageData) {
  return d.startAt.toLocaleTimeString('pt-BR', {
    timeZone: d.timeZone, hour: '2-digit', minute: '2-digit',
  });
}

export function renderConfirmation(d: MessageData): RenderedMessage {
  return {
    templateName: 'agendamento_confirmado',
    params: [d.customerName, d.shopName, data(d), hora(d), d.staffName],
    fallbackText:
      `Olá, ${d.customerName}! Seu horário na ${d.shopName} está confirmado: ` +
      `${d.serviceName} com ${d.staffName} em ${data(d)} às ${hora(d)}. ` +
      `Precisa cancelar? ${d.manageUrl}`,
  };
}

export function renderReminder(d: MessageData): RenderedMessage {
  return {
    templateName: 'agendamento_lembrete',
    params: [d.customerName, d.shopName, hora(d), d.staffName],
    fallbackText:
      `Oi, ${d.customerName}! Lembrete do seu horário hoje na ${d.shopName} ` +
      `às ${hora(d)} com ${d.staffName}. Até já!`,
  };
}

export function renderCancellation(d: MessageData): RenderedMessage {
  return {
    templateName: 'agendamento_cancelado',
    params: [d.customerName, d.shopName, data(d), hora(d)],
    fallbackText:
      `${d.customerName}, seu horário na ${d.shopName} em ${data(d)} às ${hora(d)} ` +
      `foi cancelado. Quando quiser, é só marcar outro.`,
  };
}
```

- [ ] **Step 4: Rodar para ver passar**

Run: `npx vitest run src/notifications/templates.test.ts`
Expected: PASS, 5 testes.

- [ ] **Step 5: Escrever o teste de idempotência do envio**

Criar `tests/integration/notify.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { withTestDb } from '../helpers/db';
import { barbershop, staff, service, staffService, workingHours, notificationLog } from '@/db/schema';
import { createAppointment } from '@/domain/booking';
import { notifyOnce } from '@/notifications/notify';
import type { NotificationSender } from '@/notifications/sender';

async function semearComAgendamento(db: any) {
  const [loja] = await db
    .insert(barbershop)
    .values({ slug: 'teste', name: 'Teste', minLeadMinutes: 0 })
    .returning();
  const [joao] = await db.insert(staff).values({ barbershopId: loja.id, name: 'João', role: 'OWNER' }).returning();
  const [corte] = await db
    .insert(service)
    .values({ barbershopId: loja.id, name: 'Corte', durationMinutes: 30, priceCents: 4000 })
    .returning();
  await db.insert(staffService).values({ barbershopId: loja.id, staffId: joao.id, serviceId: corte.id });
  await db.insert(workingHours).values({
    barbershopId: loja.id, staffId: joao.id, weekday: 1, startTime: '09:00:00', endTime: '11:00:00',
  });
  const criado = await createAppointment(db, {
    barbershopId: loja.id, serviceId: corte.id, staffId: joao.id,
    startAt: new Date('2026-09-07T12:00:00Z'),
    customer: { name: 'Cliente', phone: '11999998888' }, origin: 'PUBLIC',
  });
  return { loja, appointmentId: criado.appointmentId };
}

function senderFake(): NotificationSender & { chamadas: number } {
  const fake = {
    chamadas: 0,
    async send() {
      fake.chamadas += 1;
      return { providerMessageId: `msg_${fake.chamadas}` };
    },
  };
  return fake;
}

describe('notifyOnce', () => {
  it('envia e registra no log', async () => {
    await withTestDb(async (db) => {
      const { loja, appointmentId } = await semearComAgendamento(db);
      const sender = senderFake();

      const r = await notifyOnce(db, { barbershopId: loja.id, appointmentId, type: 'CONFIRMATION', sender });

      expect(r).toBe('SENT');
      expect(sender.chamadas).toBe(1);
      const linhas = await db.select().from(notificationLog);
      expect(linhas).toHaveLength(1);
      expect(linhas[0].status).toBe('SENT');
      expect(linhas[0].providerMessageId).toBe('msg_1');
    });
  });

  it('não envia duas vezes o mesmo tipo para o mesmo agendamento', async () => {
    await withTestDb(async (db) => {
      const { loja, appointmentId } = await semearComAgendamento(db);
      const sender = senderFake();
      const args = { barbershopId: loja.id, appointmentId, type: 'REMINDER' as const, sender };

      expect(await notifyOnce(db, args)).toBe('SENT');
      expect(await notifyOnce(db, args)).toBe('SKIPPED');
      expect(sender.chamadas).toBe(1);
    });
  });

  it('permite tipos diferentes para o mesmo agendamento', async () => {
    await withTestDb(async (db) => {
      const { loja, appointmentId } = await semearComAgendamento(db);
      const sender = senderFake();

      await notifyOnce(db, { barbershopId: loja.id, appointmentId, type: 'CONFIRMATION', sender });
      await notifyOnce(db, { barbershopId: loja.id, appointmentId, type: 'REMINDER', sender });

      expect(sender.chamadas).toBe(2);
      expect(await db.select().from(notificationLog)).toHaveLength(2);
    });
  });

  it('registra a falha sem derrubar o chamador', async () => {
    await withTestDb(async (db) => {
      const { loja, appointmentId } = await semearComAgendamento(db);
      const senderQuebrado: NotificationSender = {
        async send() { throw new Error('provider fora do ar'); },
      };

      const r = await notifyOnce(db, {
        barbershopId: loja.id, appointmentId, type: 'CONFIRMATION', sender: senderQuebrado,
      });

      expect(r).toBe('FAILED');
      const [linha] = await db.select().from(notificationLog);
      expect(linha.status).toBe('FAILED');
      expect(linha.error).toContain('provider fora do ar');
    });
  });

  it('deixa reenviar depois de uma falha', async () => {
    await withTestDb(async (db) => {
      const { loja, appointmentId } = await semearComAgendamento(db);
      const senderQuebrado: NotificationSender = {
        async send() { throw new Error('falhou'); },
      };
      await notifyOnce(db, { barbershopId: loja.id, appointmentId, type: 'REMINDER', sender: senderQuebrado });

      const sender = senderFake();
      expect(await notifyOnce(db, { barbershopId: loja.id, appointmentId, type: 'REMINDER', sender })).toBe('SENT');
      expect(sender.chamadas).toBe(1);
    });
  });
});
```

- [ ] **Step 6: Implementar o envio idempotente**

Criar `src/notifications/notify.ts`:

```ts
import { and, eq } from 'drizzle-orm';
import { appointment, barbershop, customer, notificationLog, staff } from '@/db/schema';
import type { Db } from '@/db/repositories';
import { buildManageUrl } from '@/lib/tokens';
import { renderCancellation, renderConfirmation, renderReminder } from './templates';
import type { NotificationSender } from './sender';

export type NotificationType = 'CONFIRMATION' | 'REMINDER' | 'CANCELLATION';

const renderizadores = {
  CONFIRMATION: renderConfirmation,
  REMINDER: renderReminder,
  CANCELLATION: renderCancellation,
} as const;

export async function notifyOnce(
  db: Db,
  args: { barbershopId: string; appointmentId: string; type: NotificationType; sender: NotificationSender },
): Promise<'SENT' | 'SKIPPED' | 'FAILED'> {
  const [jaEnviado] = await db
    .select({ id: notificationLog.id })
    .from(notificationLog)
    .where(
      and(
        eq(notificationLog.appointmentId, args.appointmentId),
        eq(notificationLog.type, args.type),
        eq(notificationLog.status, 'SENT'),
      ),
    )
    .limit(1);
  if (jaEnviado) return 'SKIPPED';

  const [dados] = await db
    .select({
      startAt: appointment.startAt,
      serviceName: appointment.serviceNameSnapshot,
      customerName: customer.name,
      customerPhone: customer.phone,
      staffName: staff.name,
      shopName: barbershop.name,
      timeZone: barbershop.timeZone,
    })
    .from(appointment)
    .innerJoin(customer, eq(customer.id, appointment.customerId))
    .innerJoin(staff, eq(staff.id, appointment.staffId))
    .innerJoin(barbershop, eq(barbershop.id, appointment.barbershopId))
    .where(
      and(eq(appointment.barbershopId, args.barbershopId), eq(appointment.id, args.appointmentId)),
    )
    .limit(1);

  if (!dados) return 'FAILED';

  const mensagem = renderizadores[args.type]({
    ...dados,
    manageUrl: buildManageUrl(args.appointmentId),
  });

  async function registrar(valores: {
    status: 'SENT' | 'FAILED';
    providerMessageId?: string;
    error?: string;
  }) {
    await db
      .insert(notificationLog)
      .values({
        barbershopId: args.barbershopId,
        appointmentId: args.appointmentId,
        type: args.type,
        ...valores,
      })
      .onConflictDoUpdate({
        target: [notificationLog.appointmentId, notificationLog.type],
        set: { ...valores, sentAt: new Date() },
      });
  }

  try {
    const { providerMessageId } = await args.sender.send(dados.customerPhone, mensagem);
    await registrar({ status: 'SENT', providerMessageId });
    return 'SENT';
  } catch (erro) {
    await registrar({ status: 'FAILED', error: erro instanceof Error ? erro.message : String(erro) });
    return 'FAILED';
  }
}
```

A checagem de "já enviado" filtra por `status = 'SENT'`: falha não bloqueia nova tentativa, mas sucesso bloqueia. O `onConflictDoUpdate` cobre a corrida entre duas execuções simultâneas do cron.

- [ ] **Step 7: Rodar para ver passar**

Run: `npx vitest run tests/integration/notify.test.ts`
Expected: PASS, 5 testes.

- [ ] **Step 8: Implementar o sender da Meta**

Acrescentar a `src/lib/env.ts`, dentro do `z.object`:

```ts
WHATSAPP_ENABLED: z.enum(['true', 'false']).default('false'),
WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
WHATSAPP_ACCESS_TOKEN: z.string().optional(),
WHATSAPP_LANGUAGE: z.string().default('pt_BR'),
```

Criar `src/notifications/meta-whatsapp.sender.ts`:

```ts
import { env } from '@/lib/env';
import type { NotificationSender, RenderedMessage } from './sender';

const API = 'https://graph.facebook.com/v21.0';

export class MetaWhatsAppSender implements NotificationSender {
  async send(to: string, message: RenderedMessage) {
    if (!env.WHATSAPP_PHONE_NUMBER_ID || !env.WHATSAPP_ACCESS_TOKEN) {
      throw new Error('WhatsApp não configurado');
    }

    const resposta = await fetch(`${API}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: `55${to}`,
        type: 'template',
        template: {
          name: message.templateName,
          language: { code: env.WHATSAPP_LANGUAGE },
          components: [
            {
              type: 'body',
              parameters: message.params.map((text) => ({ type: 'text', text })),
            },
          ],
        },
      }),
    });

    if (!resposta.ok) {
      throw new Error(`Meta respondeu ${resposta.status}: ${await resposta.text()}`);
    }

    const corpo = await resposta.json();
    return { providerMessageId: corpo.messages?.[0]?.id ?? 'sem-id' };
  }
}

class ConsoleSender implements NotificationSender {
  async send(to: string, message: RenderedMessage) {
    console.info(`[whatsapp desligado] para ${to.slice(0, 4)}****: ${message.fallbackText}`);
    return { providerMessageId: 'console' };
  }
}

export function getSender(): NotificationSender {
  return env.WHATSAPP_ENABLED === 'true' ? new MetaWhatsAppSender() : new ConsoleSender();
}
```

O `ConsoleSender` mascara o telefone no log: número de cliente em log de servidor é dado pessoal exposto.

Criar `src/notifications/index.ts`:

```ts
export { notifyOnce, type NotificationType } from './notify';
export { getSender, MetaWhatsAppSender } from './meta-whatsapp.sender';
export type { NotificationSender, RenderedMessage } from './sender';
```

- [ ] **Step 9: Disparar a confirmação e o cancelamento**

Em `src/app/api/public/[slug]/appointments/route.ts`, depois do `createAppointment` bem-sucedido e **antes** do `NextResponse.json`:

```ts
void notifyOnce(db, {
  barbershopId: loja.id,
  appointmentId: criado.appointmentId,
  type: 'CONFIRMATION',
  sender: getSender(),
}).catch((erro) => console.error('Falha ao notificar confirmação', erro));
```

O `void` é proposital: a resposta ao cliente não espera o WhatsApp. Provider lento não pode segurar o agendamento.

Em `src/app/agendamento/[token]/actions.ts`, depois do `cancelAppointment`, disparar o mesmo padrão com `type: 'CANCELLATION'`.

- [ ] **Step 10: Rodar a suíte e commitar**

Run: `npm test && npm run lint`

```bash
git add -A
git commit -m "feat(notificacoes): confirmação e cancelamento por WhatsApp com log idempotente"
```

---

## Task 16: Cron de lembretes

**Files:**
- Create: `src/app/api/cron/reminders/route.ts`, `src/domain/reminders/select-due.ts`, `vercel.json`
- Modify: `src/lib/env.ts`, `.env.example`
- Test: `tests/integration/reminders.test.ts`

**Interfaces:**
- Consumes: `notifyOnce` da Task 15
- Produces:
  - `selectDueReminders(db, { now, windowMinutes }): Promise<Array<{ barbershopId: string; appointmentId: string }>>` — agendamentos `BOOKED` que começam dentro da janela e ainda não receberam lembrete
  - `GET /api/cron/reminders` protegido por header `authorization: Bearer ${CRON_SECRET}` → `{ enviados, pulados, falhas }`

- [ ] **Step 1: Escrever o teste da seleção de lembretes**

Criar `tests/integration/reminders.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { withTestDb } from '../helpers/db';
import { barbershop, staff, service, staffService, workingHours, notificationLog, appointment } from '@/db/schema';
import { createAppointment, cancelAppointment } from '@/domain/booking';
import { selectDueReminders } from '@/domain/reminders/select-due';
import { eq } from 'drizzle-orm';

async function semear(db: any) {
  const [loja] = await db
    .insert(barbershop)
    .values({ slug: 'teste', name: 'Teste', minLeadMinutes: 0 })
    .returning();
  const [joao] = await db.insert(staff).values({ barbershopId: loja.id, name: 'João', role: 'OWNER' }).returning();
  const [corte] = await db
    .insert(service)
    .values({ barbershopId: loja.id, name: 'Corte', durationMinutes: 30, priceCents: 4000 })
    .returning();
  await db.insert(staffService).values({ barbershopId: loja.id, staffId: joao.id, serviceId: corte.id });
  await db.insert(workingHours).values([
    { barbershopId: loja.id, staffId: joao.id, weekday: 1, startTime: '09:00:00', endTime: '18:00:00' },
  ]);
  return { loja, joao, corte };
}

async function agendar(db: any, ctx: any, startAt: string, phone = '11999998888') {
  return createAppointment(db, {
    barbershopId: ctx.loja.id, serviceId: ctx.corte.id, staffId: ctx.joao.id,
    startAt: new Date(startAt), customer: { name: 'Cliente', phone }, origin: 'PUBLIC',
  });
}

const AGORA = new Date('2026-09-07T12:00:00Z'); // 09:00 em São Paulo

describe('selectDueReminders', () => {
  it('pega agendamento dentro da janela', async () => {
    await withTestDb(async (db) => {
      const ctx = await semear(db);
      const criado = await agendar(db, ctx, '2026-09-07T15:00:00Z');
      const devidos = await selectDueReminders(db, { now: AGORA, windowMinutes: 240 });
      expect(devidos.map((d) => d.appointmentId)).toEqual([criado.appointmentId]);
    });
  });

  it('ignora agendamento fora da janela', async () => {
    await withTestDb(async (db) => {
      const ctx = await semear(db);
      await agendar(db, ctx, '2026-09-07T20:00:00Z');
      expect(await selectDueReminders(db, { now: AGORA, windowMinutes: 240 })).toHaveLength(0);
    });
  });

  it('ignora agendamento que já passou', async () => {
    await withTestDb(async (db) => {
      const ctx = await semear(db);
      const criado = await agendar(db, ctx, '2026-09-07T13:00:00Z');
      await db.update(appointment).set({ startAt: new Date('2026-09-07T11:00:00Z'), endAt: new Date('2026-09-07T11:30:00Z') }).where(eq(appointment.id, criado.appointmentId));
      expect(await selectDueReminders(db, { now: AGORA, windowMinutes: 240 })).toHaveLength(0);
    });
  });

  it('ignora agendamento cancelado', async () => {
    await withTestDb(async (db) => {
      const ctx = await semear(db);
      const criado = await agendar(db, ctx, '2026-09-07T15:00:00Z');
      await cancelAppointment(db, ctx.loja.id, criado.appointmentId);
      expect(await selectDueReminders(db, { now: AGORA, windowMinutes: 240 })).toHaveLength(0);
    });
  });

  it('ignora agendamento que já recebeu lembrete', async () => {
    await withTestDb(async (db) => {
      const ctx = await semear(db);
      const criado = await agendar(db, ctx, '2026-09-07T15:00:00Z');
      await db.insert(notificationLog).values({
        barbershopId: ctx.loja.id, appointmentId: criado.appointmentId,
        type: 'REMINDER', status: 'SENT', providerMessageId: 'x',
      });
      expect(await selectDueReminders(db, { now: AGORA, windowMinutes: 240 })).toHaveLength(0);
    });
  });

  it('reinclui agendamento cujo lembrete falhou', async () => {
    await withTestDb(async (db) => {
      const ctx = await semear(db);
      const criado = await agendar(db, ctx, '2026-09-07T15:00:00Z');
      await db.insert(notificationLog).values({
        barbershopId: ctx.loja.id, appointmentId: criado.appointmentId,
        type: 'REMINDER', status: 'FAILED', error: 'timeout',
      });
      expect(await selectDueReminders(db, { now: AGORA, windowMinutes: 240 })).toHaveLength(1);
    });
  });
});
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `npx vitest run tests/integration/reminders.test.ts`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar a seleção**

Criar `src/domain/reminders/select-due.ts`:

```ts
import { and, eq, gt, lte, sql } from 'drizzle-orm';
import { appointment, notificationLog } from '@/db/schema';
import type { Db } from '@/db/repositories';

export async function selectDueReminders(
  db: Db,
  args: { now: Date; windowMinutes: number },
): Promise<Array<{ barbershopId: string; appointmentId: string }>> {
  const limite = new Date(args.now.getTime() + args.windowMinutes * 60_000);

  const linhas = await db
    .select({ barbershopId: appointment.barbershopId, appointmentId: appointment.id })
    .from(appointment)
    .where(
      and(
        eq(appointment.status, 'BOOKED'),
        gt(appointment.startAt, args.now),
        lte(appointment.startAt, limite),
        sql`not exists (
          select 1 from ${notificationLog}
          where ${notificationLog.appointmentId} = ${appointment.id}
            and ${notificationLog.type} = 'REMINDER'
            and ${notificationLog.status} = 'SENT'
        )`,
      ),
    )
    .limit(500);

  return linhas;
}
```

O `limit(500)` é um teto de segurança por execução. Se ele for atingido, o log da rota avisa — silenciar truncamento aqui esconderia lembrete não enviado.

- [ ] **Step 4: Rodar para ver passar**

Run: `npx vitest run tests/integration/reminders.test.ts`
Expected: PASS, 6 testes.

- [ ] **Step 5: Implementar a rota de cron**

Acrescentar a `src/lib/env.ts`:

```ts
CRON_SECRET: z.string().min(16, 'CRON_SECRET precisa de pelo menos 16 caracteres'),
REMINDER_WINDOW_MINUTES: z.coerce.number().int().positive().default(180),
```

Criar `src/app/api/cron/reminders/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { env } from '@/lib/env';
import { selectDueReminders } from '@/domain/reminders/select-due';
import { getSender, notifyOnce } from '@/notifications';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const devidos = await selectDueReminders(db, {
    now: new Date(),
    windowMinutes: env.REMINDER_WINDOW_MINUTES,
  });

  if (devidos.length === 500) {
    console.warn('Teto de 500 lembretes atingido nesta execução — pode haver fila pendente');
  }

  const sender = getSender();
  let enviados = 0;
  let pulados = 0;
  let falhas = 0;

  for (const item of devidos) {
    const r = await notifyOnce(db, { ...item, type: 'REMINDER', sender });
    if (r === 'SENT') enviados += 1;
    else if (r === 'SKIPPED') pulados += 1;
    else falhas += 1;
  }

  console.info(`Lembretes: ${enviados} enviados, ${pulados} pulados, ${falhas} falharam`);
  return NextResponse.json({ enviados, pulados, falhas });
}
```

Criar `vercel.json`:

```json
{
  "crons": [
    { "path": "/api/cron/reminders", "schedule": "0 * * * *" }
  ]
}
```

De hora em hora, com janela de 180 minutos: cada agendamento é visto em três execuções, e a idempotência do `notificationLog` garante uma única mensagem. Se uma execução falhar, a seguinte cobre.

- [ ] **Step 6: Verificar manualmente**

```bash
curl -H "authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/reminders
```

Expected: `{"enviados":N,"pulados":0,"falhas":0}`. Rodar de novo: `enviados` cai para 0 e `pulados` sobe.

Sem o header: `401`.

- [ ] **Step 7: Rodar a suíte e commitar**

Run: `npm test && npm run lint`

```bash
git add -A
git commit -m "feat(notificacoes): cron de lembretes com janela e proteção contra reenvio"
```

---

## Task 17: Rate limit na superfície pública

**Files:**
- Create: `src/db/schema/rate-limit.ts`, `src/lib/rate-limit.ts`
- Modify: `src/db/schema/index.ts`, `src/app/api/public/[slug]/availability/route.ts`, `src/app/api/public/[slug]/appointments/route.ts`
- Test: `tests/integration/rate-limit.test.ts`

**Interfaces:**
- Consumes: `db` da Task 2
- Produces:
  - `checkRateLimit(db, { key, limit, windowSeconds, now? }): Promise<{ allowed: boolean; remaining: number }>`
  - `clientKey(req: Request, sufixo: string): string` — monta a chave a partir de `x-forwarded-for` e do sufixo (slug, telefone)

- [ ] **Step 1: Criar a tabela de contagem**

Criar `src/db/schema/rate-limit.ts`:

```ts
import { pgTable, text, integer, timestamp, primaryKey } from 'drizzle-orm/pg-core';

export const rateLimitBucket = pgTable(
  'rate_limit_bucket',
  {
    key: text('key').notNull(),
    windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
    hits: integer('hits').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })],
);
```

Acrescentar `export * from './rate-limit';` a `src/db/schema/index.ts` e rodar:

```bash
npm run db:generate && npm run db:migrate
```

Contagem no Postgres, não em memória: na Vercel cada requisição pode cair numa instância diferente, e contador em memória não vê as outras.

- [ ] **Step 2: Escrever o teste do rate limit**

Criar `tests/integration/rate-limit.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { withTestDb } from '../helpers/db';
import { checkRateLimit } from '@/lib/rate-limit';

const AGORA = new Date('2026-09-07T12:00:00Z');

describe('checkRateLimit', () => {
  it('libera enquanto está dentro do limite', async () => {
    await withTestDb(async (db) => {
      const args = { key: 'ip:1.2.3.4', limit: 3, windowSeconds: 60, now: AGORA };
      expect((await checkRateLimit(db, args)).allowed).toBe(true);
      expect((await checkRateLimit(db, args)).allowed).toBe(true);
      const terceiro = await checkRateLimit(db, args);
      expect(terceiro.allowed).toBe(true);
      expect(terceiro.remaining).toBe(0);
    });
  });

  it('bloqueia ao passar do limite', async () => {
    await withTestDb(async (db) => {
      const args = { key: 'ip:1.2.3.4', limit: 2, windowSeconds: 60, now: AGORA };
      await checkRateLimit(db, args);
      await checkRateLimit(db, args);
      expect((await checkRateLimit(db, args)).allowed).toBe(false);
    });
  });

  it('conta chaves diferentes separadamente', async () => {
    await withTestDb(async (db) => {
      const base = { limit: 1, windowSeconds: 60, now: AGORA };
      expect((await checkRateLimit(db, { ...base, key: 'ip:1.1.1.1' })).allowed).toBe(true);
      expect((await checkRateLimit(db, { ...base, key: 'ip:2.2.2.2' })).allowed).toBe(true);
    });
  });

  it('libera de novo na janela seguinte', async () => {
    await withTestDb(async (db) => {
      const args = { key: 'ip:1.2.3.4', limit: 1, windowSeconds: 60, now: AGORA };
      await checkRateLimit(db, args);
      expect((await checkRateLimit(db, args)).allowed).toBe(false);
      const depois = new Date(AGORA.getTime() + 61_000);
      expect((await checkRateLimit(db, { ...args, now: depois })).allowed).toBe(true);
    });
  });
});
```

- [ ] **Step 3: Rodar para ver falhar**

Run: `npx vitest run tests/integration/rate-limit.test.ts`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 4: Implementar o rate limit**

Criar `src/lib/rate-limit.ts`:

```ts
import { sql } from 'drizzle-orm';
import { rateLimitBucket } from '@/db/schema';
import type { Db } from '@/db/repositories';

export async function checkRateLimit(
  db: Db,
  args: { key: string; limit: number; windowSeconds: number; now?: Date },
): Promise<{ allowed: boolean; remaining: number }> {
  const agora = args.now ?? new Date();
  const janelaMs = args.windowSeconds * 1000;
  const windowStart = new Date(Math.floor(agora.getTime() / janelaMs) * janelaMs);

  const [linha] = await db
    .insert(rateLimitBucket)
    .values({ key: args.key, windowStart, hits: 1 })
    .onConflictDoUpdate({
      target: [rateLimitBucket.key, rateLimitBucket.windowStart],
      set: { hits: sql`${rateLimitBucket.hits} + 1` },
    })
    .returning({ hits: rateLimitBucket.hits });

  return { allowed: linha.hits <= args.limit, remaining: Math.max(0, args.limit - linha.hits) };
}

export function clientKey(req: Request, sufixo: string): string {
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'desconhecido';
  return `${ip}:${sufixo}`;
}
```

O incremento e a leitura acontecem na mesma instrução: ler e depois gravar deixaria brecha entre as duas.

Limpeza: janelas antigas viram lixo. Acrescentar ao fim da rota de cron da Task 16:

```ts
await db.execute(
  sql`DELETE FROM rate_limit_bucket WHERE window_start < now() - interval '1 day'`,
);
```

- [ ] **Step 5: Rodar para ver passar**

Run: `npx vitest run tests/integration/rate-limit.test.ts`
Expected: PASS, 4 testes.

- [ ] **Step 6: Aplicar nas rotas públicas**

Em `src/app/api/public/[slug]/availability/route.ts`, logo no início do `GET`:

```ts
const limite = await checkRateLimit(db, {
  key: clientKey(req, `avail:${slug}`),
  limit: 120,
  windowSeconds: 60,
});
if (!limite.allowed) {
  return NextResponse.json(
    { error: 'RATE_LIMITED', message: 'Muitas consultas. Espere um instante e tente de novo.' },
    { status: 429 },
  );
}
```

Em `src/app/api/public/[slug]/appointments/route.ts`, **duas** checagens depois de validar o corpo:

```ts
const porIp = await checkRateLimit(db, {
  key: clientKey(req, `book:${slug}`), limit: 10, windowSeconds: 600,
});
const porTelefone = await checkRateLimit(db, {
  key: `phone:${dados.phone}:${slug}`, limit: 5, windowSeconds: 3600,
});
if (!porIp.allowed || !porTelefone.allowed) {
  return NextResponse.json(
    { error: 'RATE_LIMITED', message: 'Você já fez vários agendamentos agora há pouco. Fale com a barbearia.' },
    { status: 429 },
  );
}
```

Por IP **e** por telefone: só por IP, uma rede compartilhada trava clientes legítimos; só por telefone, quem troca o número floda a agenda.

- [ ] **Step 7: Verificar manualmente**

```bash
for i in $(seq 1 12); do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST \
    -H 'content-type: application/json' \
    -d '{"serviceId":"...","startAt":"...","name":"Teste","phone":"11999998888"}' \
    http://localhost:3000/api/public/<slug>/appointments
done
```

Expected: os primeiros respondem 201/409 e, passado o limite, 429.

- [ ] **Step 8: Rodar a suíte e commitar**

Run: `npm test && npm run lint`

```bash
git add -A
git commit -m "feat(seguranca): rate limit por IP e por telefone na página pública"
```

---

## Task 18: Configurações da barbearia e ficha do cliente

**Files:**
- Create: `src/app/app/configuracoes/page.tsx`, `src/app/app/configuracoes/actions.ts`
- Create: `src/app/app/clientes/page.tsx`, `src/app/app/clientes/[customerId]/page.tsx`, `src/app/app/clientes/actions.ts`
- Create: `src/domain/catalog/shop-settings.ts`, `src/domain/privacy/anonymize-customer.ts`
- Modify: `src/db/repositories/customer.repo.ts`, `src/db/repositories/index.ts`, `src/components/panel-nav.tsx`
- Test: `src/domain/catalog/shop-settings.test.ts`, `tests/integration/anonymize.test.ts`

**Interfaces:**
- Consumes: `requireSession` da Task 7, repositórios da Task 6
- Produces:
  - `validateShopSettings(input: unknown): { name: string; slotMinutes: number; minLeadMinutes: number; maxAdvanceDays: number; timeZone: string }` de `shop-settings.ts`
  - `listCustomers(db, barbershopId, busca?): Promise<Customer[]>` e `listCustomerHistory(db, barbershopId, customerId)` em `customer.repo.ts`
  - `anonymizeCustomer(db, barbershopId, customerId): Promise<void>` — apaga nome, telefone e notas mantendo os agendamentos

- [ ] **Step 1: Escrever os testes das configurações**

Criar `src/domain/catalog/shop-settings.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { validateShopSettings } from './shop-settings';

const valido = {
  name: 'Barbearia Teste',
  slotMinutes: '30',
  minLeadMinutes: '60',
  maxAdvanceDays: '30',
  timeZone: 'America/Sao_Paulo',
};

describe('validateShopSettings', () => {
  it('aceita configuração válida', () => {
    expect(validateShopSettings(valido).slotMinutes).toBe(30);
  });

  it('aceita grade de 15 e de 60 minutos', () => {
    expect(validateShopSettings({ ...valido, slotMinutes: '15' }).slotMinutes).toBe(15);
    expect(validateShopSettings({ ...valido, slotMinutes: '60' }).slotMinutes).toBe(60);
  });

  it('recusa grade fora das opções', () => {
    expect(() => validateShopSettings({ ...valido, slotMinutes: '7' })).toThrow(/grade/i);
  });

  it('recusa antecedência negativa', () => {
    expect(() => validateShopSettings({ ...valido, minLeadMinutes: '-5' })).toThrow(/antecedência/i);
  });

  it('recusa janela de agendamento acima de um ano', () => {
    expect(() => validateShopSettings({ ...valido, maxAdvanceDays: '400' })).toThrow(/janela/i);
  });

  it('recusa fuso inexistente', () => {
    expect(() => validateShopSettings({ ...valido, timeZone: 'Marte/Olimpo' })).toThrow(/fuso/i);
  });
});
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `npx vitest run src/domain/catalog/shop-settings.test.ts`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar as regras de configuração**

Criar `src/domain/catalog/shop-settings.ts`:

```ts
import { z } from 'zod';

const GRADES_PERMITIDAS = [10, 15, 20, 30, 45, 60] as const;

function fusoValido(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('pt-BR', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const schema = z.object({
  name: z.string().trim().min(2, 'Informe o nome da barbearia'),
  slotMinutes: z.coerce
    .number()
    .int()
    .refine((v) => (GRADES_PERMITIDAS as readonly number[]).includes(v), {
      message: `A grade precisa ser uma destas: ${GRADES_PERMITIDAS.join(', ')} minutos`,
    }),
  minLeadMinutes: z.coerce.number().int().min(0, 'A antecedência mínima não pode ser negativa').max(10080),
  maxAdvanceDays: z.coerce.number().int().positive().max(365, 'A janela de agendamento não pode passar de 365 dias'),
  timeZone: z.string().refine(fusoValido, 'Fuso horário inválido'),
});

export function validateShopSettings(input: unknown) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);
  return parsed.data;
}
```

O `slug` **não** entra: mudar o endereço público quebraria todo link já enviado por WhatsApp. Trocar slug é operação manual, fora da Fase 1.

- [ ] **Step 4: Rodar para ver passar**

Run: `npx vitest run src/domain/catalog/shop-settings.test.ts`
Expected: PASS, 6 testes.

- [ ] **Step 5: Construir a tela de configurações**

Criar `src/app/app/configuracoes/page.tsx` — formulário com nome, fuso (select com os fusos do Brasil), grade (select com as opções permitidas), antecedência mínima e janela de agendamento. Mostrar o endereço público (`{APP_URL}/b/{slug}`) como texto copiável, não editável.

Criar `src/app/app/configuracoes/actions.ts`:

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { barbershop } from '@/db/schema';
import { requireSession } from '@/lib/session';
import { validateShopSettings } from '@/domain/catalog/shop-settings';

export type SettingsState = { erro?: string; ok?: boolean };

export async function saveSettingsAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const sessao = await requireSession();
  if (sessao.role !== 'OWNER') return { erro: 'Só o dono pode mudar as configurações' };

  let dados;
  try {
    dados = validateShopSettings(Object.fromEntries(formData));
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : 'Dados inválidos' };
  }

  await db.update(barbershop).set(dados).where(eq(barbershop.id, sessao.barbershopId));
  revalidatePath('/app/configuracoes');
  return { ok: true };
}
```

Mudar `slotMinutes` afeta só a grade daqui pra frente: agendamentos já gravados têm `startAt`/`endAt` próprios e continuam válidos.

- [ ] **Step 6: Escrever o teste da anonimização**

Criar `tests/integration/anonymize.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { withTestDb } from '../helpers/db';
import { barbershop, staff, service, staffService, workingHours, appointment, customer } from '@/db/schema';
import { createAppointment } from '@/domain/booking';
import { anonymizeCustomer } from '@/domain/privacy/anonymize-customer';

async function semearComCliente(db: any) {
  const [loja] = await db
    .insert(barbershop)
    .values({ slug: 'teste', name: 'Teste', minLeadMinutes: 0 })
    .returning();
  const [joao] = await db.insert(staff).values({ barbershopId: loja.id, name: 'João', role: 'OWNER' }).returning();
  const [corte] = await db
    .insert(service)
    .values({ barbershopId: loja.id, name: 'Corte', durationMinutes: 30, priceCents: 4000 })
    .returning();
  await db.insert(staffService).values({ barbershopId: loja.id, staffId: joao.id, serviceId: corte.id });
  await db.insert(workingHours).values({
    barbershopId: loja.id, staffId: joao.id, weekday: 1, startTime: '09:00:00', endTime: '11:00:00',
  });
  const criado = await createAppointment(db, {
    barbershopId: loja.id, serviceId: corte.id, staffId: joao.id,
    startAt: new Date('2026-09-07T12:00:00Z'),
    customer: { name: 'Cliente Real', phone: '11999998888' }, origin: 'PUBLIC',
  });
  const [linha] = await db.select().from(appointment).where(eq(appointment.id, criado.appointmentId));
  return { loja, customerId: linha.customerId, appointmentId: criado.appointmentId };
}

describe('anonymizeCustomer', () => {
  it('apaga os dados pessoais e mantém o agendamento', async () => {
    await withTestDb(async (db) => {
      const { loja, customerId, appointmentId } = await semearComCliente(db);

      await anonymizeCustomer(db, loja.id, customerId);

      const [c] = await db.select().from(customer).where(eq(customer.id, customerId));
      expect(c.name).toBe('Cliente removido');
      expect(c.phone).not.toContain('99999');
      expect(c.notes).toBeNull();

      const [a] = await db.select().from(appointment).where(eq(appointment.id, appointmentId));
      expect(a.serviceNameSnapshot).toBe('Corte');
      expect(a.startAt).toBeInstanceOf(Date);
    });
  });

  it('não anonimiza cliente de outra barbearia', async () => {
    await withTestDb(async (db) => {
      const { customerId } = await semearComCliente(db);
      const [outra] = await db.insert(barbershop).values({ slug: 'outra', name: 'Outra' }).returning();

      await expect(anonymizeCustomer(db, outra.id, customerId)).rejects.toThrow();

      const [c] = await db.select().from(customer).where(eq(customer.id, customerId));
      expect(c.name).toBe('Cliente Real');
    });
  });

  it('deixa o telefone livre para um novo cadastro', async () => {
    await withTestDb(async (db) => {
      const { loja, customerId } = await semearComCliente(db);
      await anonymizeCustomer(db, loja.id, customerId);

      const [novo] = await db
        .insert(customer)
        .values({ barbershopId: loja.id, name: 'Outro Cliente', phone: '11999998888' })
        .returning();
      expect(novo.id).not.toBe(customerId);
    });
  });
});
```

- [ ] **Step 7: Rodar para ver falhar**

Run: `npx vitest run tests/integration/anonymize.test.ts`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 8: Implementar a anonimização**

Criar `src/domain/privacy/anonymize-customer.ts`:

```ts
import { and, eq } from 'drizzle-orm';
import { customer } from '@/db/schema';
import type { Db } from '@/db/repositories';
import { NotFoundError } from '@/domain/booking';

export async function anonymizeCustomer(db: Db, barbershopId: string, customerId: string) {
  const linhas = await db
    .update(customer)
    .set({
      name: 'Cliente removido',
      // O telefone vira um marcador único: o campo é UNIQUE por barbearia e
      // precisa liberar o número real para um cadastro novo.
      phone: `removido-${customerId}`,
      notes: null,
    })
    .where(and(eq(customer.barbershopId, barbershopId), eq(customer.id, customerId)))
    .returning({ id: customer.id });

  if (linhas.length === 0) throw new NotFoundError('Cliente não encontrado');
}
```

Anonimizar em vez de apagar: `appointment.customerId` é `onDelete: 'restrict'`, e o histórico de atendimento da barbearia não pode sumir porque um cliente pediu remoção dos dados dele.

- [ ] **Step 9: Rodar para ver passar**

Run: `npx vitest run tests/integration/anonymize.test.ts`
Expected: PASS, 3 testes.

- [ ] **Step 10: Construir a lista de clientes**

Acrescentar a `src/db/repositories/customer.repo.ts`:

```ts
import { and, eq, ilike, or, desc, asc } from 'drizzle-orm';
import { appointment } from '@/db/schema';

export async function listCustomers(db: Db, barbershopId: string, busca?: string) {
  const filtroBusca = busca
    ? or(ilike(customer.name, `%${busca}%`), ilike(customer.phone, `%${busca}%`))
    : undefined;

  return db
    .select()
    .from(customer)
    .where(and(eq(customer.barbershopId, barbershopId), filtroBusca))
    .orderBy(asc(customer.name))
    .limit(200);
}

export async function listCustomerHistory(db: Db, barbershopId: string, customerId: string) {
  return db
    .select({
      id: appointment.id,
      startAt: appointment.startAt,
      status: appointment.status,
      serviceName: appointment.serviceNameSnapshot,
      priceCents: appointment.servicePriceCentsSnapshot,
    })
    .from(appointment)
    .where(
      and(eq(appointment.barbershopId, barbershopId), eq(appointment.customerId, customerId)),
    )
    .orderBy(desc(appointment.startAt))
    .limit(100);
}
```

O `limit(200)` na busca é teto explícito: lista grande sem paginação trava a tela. Quando bater no teto, a página avisa "mostrando os 200 primeiros — refine a busca".

Criar `src/app/app/clientes/page.tsx` — campo de busca e tabela com nome, telefone e data do último atendimento.

Criar `src/app/app/clientes/[customerId]/page.tsx` — dados do cliente, histórico de `listCustomerHistory`, campo de notas e o botão "Remover dados deste cliente", que chama `anonymizeCustomerAction` (em `src/app/app/clientes/actions.ts`) com confirmação e restrito a `role === 'OWNER'`.

Toda action deste arquivo resolve `barbershopId` por `requireSession()` — nunca pela URL.

- [ ] **Step 11: Acrescentar os links à navegação**

Modificar `src/components/panel-nav.tsx` para incluir "Clientes" e "Configurações" ao lado de "Agenda", "Serviços" e "Equipe".

- [ ] **Step 12: Verificar manualmente**

Run: `npm run dev`
Mudar a grade para 15 minutos e conferir que a página pública passa a oferecer horários de 15 em 15. Abrir a ficha de um cliente, ver o histórico, e remover os dados — o agendamento continua na agenda, com o nome trocado.

- [ ] **Step 13: Rodar a suíte e commitar**

Run: `npm test && npm run lint`

```bash
git add -A
git commit -m "feat(painel): configurações da barbearia, ficha do cliente e remoção de dados pessoais"
```

---

## Task 19: E2E e preparação para produção

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/agendamento.spec.ts`, `tests/e2e/fixtures/seed.ts`
- Create: `README.md`, `docs/deploy.md`
- Modify: `package.json` (scripts de E2E)

**Interfaces:**
- Consumes: o app inteiro
- Produces: `npm run test:e2e` verde e o passo a passo de deploy escrito

- [ ] **Step 1: Instalar e configurar o Playwright**

```bash
npm install -D @playwright/test
npx playwright install chromium
```

Criar `playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  use: { baseURL: 'http://localhost:3000', locale: 'pt-BR' },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
```

Acrescentar aos scripts do `package.json`:

```json
"test:e2e": "playwright test",
"test:e2e:ui": "playwright test --ui"
```

Excluir `tests/e2e` do Vitest: em `vitest.config.ts`, trocar o `include` por
`['src/**/*.test.ts', 'tests/**/*.test.ts']` já basta, porque os arquivos do Playwright usam `.spec.ts`.

- [ ] **Step 2: Escrever o seed do E2E**

Criar `tests/e2e/fixtures/seed.ts`: função que limpa as tabelas e cria uma barbearia `e2e-barbearia` com um barbeiro, um serviço "Corte" de 30 min e expediente de segunda a sábado das 9h às 18h, com `minLeadMinutes: 0`. Reaproveitar `createBarbershopForUser` e inserts diretos.

- [ ] **Step 3: Escrever o E2E do fluxo público**

Criar `tests/e2e/agendamento.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import { seed } from './fixtures/seed';

test.beforeEach(async () => {
  await seed();
});

test('cliente agenda um horário e recebe o link de gerenciamento', async ({ page }) => {
  await page.goto('/b/e2e-barbearia');

  await page.getByRole('button', { name: /corte/i }).click();
  await page.getByRole('button', { name: /qualquer barbeiro/i }).click();

  const primeiroHorario = page.getByTestId('slot').first();
  await expect(primeiroHorario).toBeVisible();
  const horarioEscolhido = (await primeiroHorario.textContent())?.trim();
  await primeiroHorario.click();

  await page.getByLabel('Seu nome').fill('Cliente E2E');
  await page.getByLabel('Telefone').fill('11999998888');
  await page.getByRole('button', { name: /confirmar horário/i }).click();

  await expect(page.getByText(/horário confirmado/i)).toBeVisible();
  const link = page.getByRole('link', { name: /ver ou cancelar/i });
  await expect(link).toBeVisible();

  await link.click();
  await expect(page.getByText(String(horarioEscolhido))).toBeVisible();
});

test('cliente cancela o horário pelo link', async ({ page }) => {
  await page.goto('/b/e2e-barbearia');
  await page.getByRole('button', { name: /corte/i }).click();
  await page.getByRole('button', { name: /qualquer barbeiro/i }).click();
  await page.getByTestId('slot').first().click();
  await page.getByLabel('Seu nome').fill('Cliente E2E');
  await page.getByLabel('Telefone').fill('11999998888');
  await page.getByRole('button', { name: /confirmar horário/i }).click();

  await page.getByRole('link', { name: /ver ou cancelar/i }).click();
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: /cancelar meu horário/i }).click();

  await expect(page.getByText(/cancelado/i)).toBeVisible();
});

test('horário tomado some da grade', async ({ page, context }) => {
  await page.goto('/b/e2e-barbearia');
  await page.getByRole('button', { name: /corte/i }).click();
  await page.getByRole('button', { name: /qualquer barbeiro/i }).click();
  const antes = await page.getByTestId('slot').count();
  await page.getByTestId('slot').first().click();
  await page.getByLabel('Seu nome').fill('Cliente E2E');
  await page.getByLabel('Telefone').fill('11999998888');
  await page.getByRole('button', { name: /confirmar horário/i }).click();
  await expect(page.getByText(/horário confirmado/i)).toBeVisible();

  const outra = await context.newPage();
  await outra.goto('/b/e2e-barbearia');
  await outra.getByRole('button', { name: /corte/i }).click();
  await outra.getByRole('button', { name: /qualquer barbeiro/i }).click();
  await expect(outra.getByTestId('slot')).toHaveCount(antes - 1);
});
```

Acrescentar `data-testid="slot"` aos botões de horário no `SlotStep` da Task 13.

- [ ] **Step 4: Rodar o E2E**

Run: `npm run test:e2e`
Expected: 3 testes verdes. Se algum seletor não bater, ajustar os rótulos das telas — não afrouxar o teste para `nth(0)` genérico.

- [ ] **Step 5: Escrever o README**

Criar `README.md` com: o que é o produto, como subir o ambiente (`docker compose up -d`, `.env`, `npm run db:migrate`, `npm run dev`), como rodar os testes (unit, integração, E2E) e o mapa das pastas (`src/domain`, `src/db`, `src/app`, `src/notifications`).

- [ ] **Step 6: Escrever o guia de deploy**

Criar `docs/deploy.md` cobrindo:

1. **Banco** — criar projeto no Neon, pegar a connection string, rodar `npm run db:migrate` apontando para lá. A migration da constraint `EXCLUDE` exige `CREATE EXTENSION btree_gist`, que o Neon permite.
2. **Vercel** — importar o repositório, configurar as variáveis: `DATABASE_URL`, `AUTH_SECRET`, `MANAGE_TOKEN_SECRET`, `APP_URL`, `CRON_SECRET`, `REMINDER_WINDOW_MINUTES`, `WHATSAPP_ENABLED`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_LANGUAGE`.
3. **Cron** — a Vercel lê `vercel.json` e injeta o header `authorization: Bearer ${CRON_SECRET}` se a variável existir. Conferir na aba Cron Jobs depois do primeiro deploy.
4. **WhatsApp** — criar o app na Meta, registrar os três templates (`agendamento_confirmado`, `agendamento_lembrete`, `agendamento_cancelado`) com a mesma quantidade de parâmetros posicionais que `templates.ts` envia, e só então virar `WHATSAPP_ENABLED=true`.
5. **Checklist de primeiro deploy** — subir com `WHATSAPP_ENABLED=false`, criar uma barbearia de verdade, agendar de ponta a ponta, conferir o log do `ConsoleSender`, e só depois ligar o WhatsApp.

- [ ] **Step 7: Rodar tudo e commitar**

Run: `npm test && npm run lint && npm run build && npm run test:e2e`
Expected: tudo verde.

```bash
git add -A
git commit -m "test(e2e): fluxo público de ponta a ponta e guia de deploy"
```

---

## Ordem de execução

Tasks 1 → 19 em sequência. As dependências reais:

- **1 → 2 → 3** é o alicerce; nada roda antes.
- **4 → 5** é o motor puro; pode ser feito em paralelo com 6 e 7 se houver duas frentes.
- **6 → 7** libera o painel (8, 9) e o domínio (10).
- **12 antes de 11**: a rota pública de criação importa `buildManageUrl`.
- **10 → 11 → 13** é o caminho do cliente final.
- **15 → 16** e **17** são hardening; **18** fecha o painel; **19** fecha tudo.

Cada task termina com a suíte verde e um commit. Nenhuma task deixa o repositório num estado que não compila.

## Ficou de fora

Registrado aqui para não virar surpresa depois:

- **Encaixe fora da grade** no painel — precisa de um caminho próprio no domínio que valide só sobreposição, sem passar por `getAvailability`. Primeira melhoria pós-lançamento.
- **Remarcação em uma tela** — na Fase 1, remarcar é cancelar e agendar de novo.
- **Convite de barbeiro por e-mail** — barbeiro existe como coluna na agenda; login próprio fica para depois.
- **Bot conversacional de WhatsApp** — Fase 2, spec próprio.
- **Assinatura e cobrança** — Fase 3.
