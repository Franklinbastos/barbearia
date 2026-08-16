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

  it('configurações agrupa os campos em duas seções', () => {
    // sete campos soltos em sequência não dizem o que é identidade e o que é
    // regra de agenda — o subtítulo da tela já anuncia os dois grupos.
    //
    // O casamento era por `CardTitle|<h2`, e desde 16/08 nenhum dos dois mora
    // mais neste arquivo: quem escreve o título é a `<SecaoDeAjustes>`, e ele
    // fica FORA do card (§2.2). O `<h2` só continuava batendo por causa de um
    // comentário que **explica** isso — teste que passa por comentário é falso
    // verde. Agora o alvo é a seção mesmo, e são duas: identidade e regras. O
    // link de agendamento traz a terceira, e ela nasce no arquivo dele.
    const form = readFileSync(
      resolve(process.cwd(), 'src/app/app/configuracoes/settings-form.tsx'),
      'utf8',
    );
    expect(form.match(/<SecaoDeAjustes\b/g)).toHaveLength(2);
  });
});
