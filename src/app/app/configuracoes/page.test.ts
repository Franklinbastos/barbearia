import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const arquivos = (dir: string) =>
  readdirSync(resolve(process.cwd(), dir), { recursive: true })
    .filter((f): f is string => typeof f === 'string' && f.endsWith('.tsx'))
    .map((f) => readFileSync(resolve(process.cwd(), `${dir}/${f}`), 'utf8'));

describe('acabamento de clientes e configurações', () => {
  it('nenhum dos dois inventa largura', () => {
    for (const fonte of [
      ...arquivos('src/app/app/clientes'),
      ...arquivos('src/app/app/configuracoes'),
    ]) {
      expect(fonte).not.toMatch(/max-w-\[\d+px\]/);
    }
  });

  it('configurações agrupa os campos em seções', () => {
    // sete campos soltos em sequência não dizem o que é identidade e o que é
    // regra de agenda — o subtítulo da tela já anuncia os dois grupos
    const form = readFileSync(
      resolve(process.cwd(), 'src/app/app/configuracoes/settings-form.tsx'),
      'utf8',
    );
    expect(form).toMatch(/CardTitle|<h2/);
  });
});
