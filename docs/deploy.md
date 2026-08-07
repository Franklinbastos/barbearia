# Deploy

## 1. Banco (Neon)

1. Criar um projeto no [Neon](https://neon.tech), um branch por ambiente
   (produção, preview).
2. O Neon dá **duas** connection strings para o mesmo banco, e elas não são
   intercambiáveis:

   | Endpoint | Host | Onde usar |
   |---|---|---|
   | Com pooler | `ep-xxxx-**pooler**.região.aws.neon.tech` | `DATABASE_URL` da aplicação na Vercel |
   | Direto | `ep-xxxx.região.aws.neon.tech` | migrations e `drizzle-kit` |

   **Aplicação → sempre o `-pooler`.** Cada instância de função serverless
   carrega o próprio pool; o app abre no máximo 1 conexão por instância
   (`src/db/client.ts`), mas o número de instâncias mornas é a Vercel quem
   decide. O PgBouncer do Neon multiplexa essas conexões num punhado de
   conexões reais — sem ele, um pico de tráfego estoura o limite (~112 conexões
   num Neon de 0.25 CU) e a página pública passa a responder 500 em massa.

   **Migrations → sempre o endpoint direto.** O pooler roda em transaction mode
   e não suporta `CREATE EXTENSION`, sessão longa nem DDL com advisory lock,
   que é exatamente o que o `drizzle-kit` precisa.

3. Rodar as migrations apontando para o endpoint **direto**:

   ```bash
   DATABASE_URL="postgres://usuario:senha@ep-xxxx.sa-east-1.aws.neon.tech/barbearia?sslmode=require" \
     npm run db:migrate
   ```

   A migration `0001_exclusion_constraint.sql` roda `CREATE EXTENSION
   IF NOT EXISTS btree_gist`, que o Neon permite sem privilégio extra.

4. Configurar na Vercel o endpoint **com pooler**:

   ```
   DATABASE_URL=postgres://usuario:senha@ep-xxxx-pooler.sa-east-1.aws.neon.tech/barbearia?sslmode=require
   ```

## 2. Vercel

1. Importar o repositório.
2. Configurar as variáveis de ambiente (Settings → Environment Variables):

   | Variável | Obrigatória | Observação |
   |---|---|---|
   | `DATABASE_URL` | sim | connection string do Neon **com `-pooler`** |
   | `AUTH_SECRET` | sim | 32+ caracteres aleatórios |
   | `MANAGE_TOKEN_SECRET` | sim | 32+ caracteres aleatórios, diferente do `AUTH_SECRET` |
   | `APP_URL` | sim | URL de produção, sem barra no fim |
   | `CRON_SECRET` | sim | 16+ caracteres aleatórios |
   | `REMINDER_WINDOW_MINUTES` | não | padrão 180 |
   | `WHATSAPP_ENABLED` | não | `false` até os templates estarem aprovados |
   | `WHATSAPP_PHONE_NUMBER_ID` | sim quando `WHATSAPP_ENABLED=true` | o boot recusa subir sem ela |
   | `WHATSAPP_ACCESS_TOKEN` | sim quando `WHATSAPP_ENABLED=true` | o boot recusa subir sem ela |
   | `WHATSAPP_LANGUAGE` | não | padrão `pt_BR` |

   Os três segredos precisam ser **gerados**, não copiados do `.env.example`:
   ele vem com `CHANGE_ME` e a validação de ambiente derruba o boot se esse
   valor chegar em produção. Gere cada um com:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

3. Deploy.

## 3. Cron

A Vercel lê `vercel.json` e injeta `authorization: Bearer ${CRON_SECRET}`
automaticamente na chamada — não precisa configurar nada além da variável.
Depois do primeiro deploy, conferir em **Settings → Cron Jobs** que
`/api/cron/reminders` aparece agendado de hora em hora.

## 4. WhatsApp (Meta Cloud API)

1. Criar o app na [Meta for Developers](https://developers.facebook.com),
   produto WhatsApp Business.
2. Registrar os três templates com o **mesmo número de parâmetros
   posicionais** que `src/notifications/templates.ts` envia:
   - `agendamento_confirmado` — 5 parâmetros
   - `agendamento_lembrete` — 4 parâmetros
   - `agendamento_cancelado` — 4 parâmetros
3. Esperar a aprovação dos templates.
4. Só então virar `WHATSAPP_ENABLED=true` e preencher
   `WHATSAPP_PHONE_NUMBER_ID` / `WHATSAPP_ACCESS_TOKEN`.

Enquanto `WHATSAPP_ENABLED=false`, o `ConsoleSender` registra a mensagem no
log da função (telefone mascarado) em vez de enviar — o produto funciona
inteiro sem WhatsApp configurado.

## 5. Checklist do primeiro deploy

- [ ] Subir com `WHATSAPP_ENABLED=false`.
- [ ] Criar uma barbearia de verdade em `/signup`.
- [ ] Agendar de ponta a ponta pela página pública.
- [ ] Conferir no log da Vercel que o `ConsoleSender` registrou a
      confirmação.
- [ ] Chamar `/api/cron/reminders` manualmente uma vez (com o header
      `authorization`) e conferir a resposta.
- [ ] Só depois disso, aprovar os templates e ligar o WhatsApp.
