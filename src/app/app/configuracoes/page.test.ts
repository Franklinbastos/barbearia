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

  it('configurações cabe numa seção só', () => {
    // Eram três blocos com título — o padrão de settings do Polaris —, e o dono
    // pediu um só em 16/08: com sete campos os três títulos gastavam mais altura
    // do que organizavam. O que separa identidade de regra agora é a divisória,
    // que não custa faixa de texto.
    const form = readFileSync(
      resolve(process.cwd(), 'src/app/app/configuracoes/settings-form.tsx'),
      'utf8',
    );
    expect(form.match(/<SecaoDeAjustes\b/g)).toHaveLength(1);
    expect(form).toMatch(/border-t border-linha/);
  });
});
