# Deploy

## 1. Banco (Neon)

1. Criar um projeto no [Neon](https://neon.tech), um branch por ambiente
   (produção, preview).
2. Copiar a connection string para `DATABASE_URL`.
3. Rodar as migrations apontando para lá:

   ```bash
   DATABASE_URL="postgres://..." npm run db:migrate
   ```

   A migration `0001_exclusion_constraint.sql` roda `CREATE EXTENSION
   IF NOT EXISTS btree_gist`, que o Neon permite sem privilégio extra.

## 2. Vercel

1. Importar o repositório.
2. Configurar as variáveis de ambiente (Settings → Environment Variables):

   | Variável | Obrigatória | Observação |
   |---|---|---|
   | `DATABASE_URL` | sim | connection string do Neon |
   | `AUTH_SECRET` | sim | 32+ caracteres aleatórios |
   | `MANAGE_TOKEN_SECRET` | sim | 32+ caracteres aleatórios, diferente do `AUTH_SECRET` |
   | `APP_URL` | sim | URL de produção, sem barra no fim |
   | `CRON_SECRET` | sim | 16+ caracteres aleatórios |
   | `REMINDER_WINDOW_MINUTES` | não | padrão 180 |
   | `WHATSAPP_ENABLED` | não | `false` até os templates estarem aprovados |
   | `WHATSAPP_PHONE_NUMBER_ID` | não | obrigatória quando `WHATSAPP_ENABLED=true` |
   | `WHATSAPP_ACCESS_TOKEN` | não | obrigatória quando `WHATSAPP_ENABLED=true` |
   | `WHATSAPP_LANGUAGE` | não | padrão `pt_BR` |

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
