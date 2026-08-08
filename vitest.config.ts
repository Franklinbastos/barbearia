import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    // `.tsx` entra por causa dos testes de componente. Eles não ganham um
    // projeto próprio: cada um declara `// @vitest-environment jsdom` no topo,
    // que é uma linha contra um segundo projeto inteiro no config.
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    // Testes de integração compartilham um Postgres real e o helper de teste
    // faz TRUNCATE ao final de cada teste — arquivos rodando em paralelo se pisam.
    fileParallelism: false,
    // Cada teste de integração abre conexão, semeia e trunca num Postgres de
    // verdade: com a máquina ocupada, os 5s padrão estouram e viram falha falsa.
    testTimeout: 30_000,
    hookTimeout: 30_000,
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
