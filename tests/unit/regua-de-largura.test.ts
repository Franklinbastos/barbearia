import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Antes desta régua havia quatro larguras mágicas espalhadas por vinte arquivos
 * (1400, 720, 520, 420), sem regra dizendo qual usar quando — e era por isso que
 * um formulário de 520px ficava empilhado sobre uma lista de 720px, com o degrau
 * visível na primeira dobra.
 */
const TELAS = readdirSync(resolve(process.cwd(), 'src/app/app'), { recursive: true })
  .filter((f): f is string => typeof f === 'string' && f.endsWith('.tsx'))
  .map((f) => `src/app/app/${f}`)
  // o container do painel é o teto de tudo e é o único que pode ter número
  .filter((f) => !f.endsWith('layout.tsx'));

describe('régua de largura', () => {
  // Nasceu `it.fails` na Task 1, como mapa do trabalho das tasks 2 a 5. Virou
  // `it` em 14/08/2026, quando a última tela passou para a régua: daqui em
  // diante ele é trava, não mapa — `max-w-[…px]` novo numa tela do painel
  // reprova aqui antes de chegar à captura de tela.
  it('nenhuma tela do painel inventa largura própria', () => {
    const infratores = TELAS.filter((f) =>
      /max-w-\[\d+px\]/.test(readFileSync(resolve(process.cwd(), f), 'utf8')),
    );
    expect(infratores).toEqual([]);
  });
});
