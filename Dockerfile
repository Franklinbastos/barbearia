# Imagem do app para rodar igual em qualquer máquina (docker compose --profile app).
# A produção planejada é serverless (docs/deploy.md); esta imagem serve para o
# ambiente local completo e para um eventual deploy em VPS.

FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM deps AS build
COPY . .
# O build importa src/lib/env.ts, que valida os segredos na carga do módulo.
# Estes valores existem só para o build passar e NÃO vão para a imagem final:
# o estágio runtime parte de uma imagem limpa e recebe os valores reais em
# tempo de execução (docker compose / hospedagem).
RUN DATABASE_URL=postgres://build:build@localhost:5432/build \
    AUTH_SECRET=build-only-not-a-secret-0000000000000000 \
    MANAGE_TOKEN_SECRET=build-only-not-a-secret-1111111111111111 \
    CRON_SECRET=build-only-not-a-secret-2222 \
    APP_URL=http://localhost:3000 \
    npm run build

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
# node_modules completo (inclui tsx) porque as migrations rodam no start.
COPY --from=build /app ./
EXPOSE 3000
CMD ["sh", "-c", "npm run db:migrate && npm run start"]
