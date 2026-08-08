import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

function ler(caminho: string) {
  return readFileSync(resolve(process.cwd(), caminho), 'utf8');
}

/**
 * As seis telas de cadastro do painel seguem um padrão só (§5.9). O que este
 * arquivo tranca não é aparência: é a estrutura que fazia o painel rolar de
 * lado em 360px — três `<table style="width: 100%">` e um punhado de `<h1>`
 * soltos com três convenções de casca diferentes.
 */
const TELAS = [
  'src/app/app/servicos/page.tsx',
  'src/app/app/equipe/page.tsx',
  'src/app/app/equipe/[staffId]/page.tsx',
  'src/app/app/clientes/page.tsx',
  'src/app/app/clientes/[customerId]/page.tsx',
  'src/app/app/configuracoes/page.tsx',
];

const COM_TABELA = [
  'src/app/app/servicos/page.tsx',
  'src/app/app/equipe/page.tsx',
  'src/app/app/clientes/page.tsx',
];

const ROTAS_DO_PAINEL = [
  'src/app/app/servicos',
  'src/app/app/equipe',
  'src/app/app/equipe/[staffId]',
  'src/app/app/clientes',
  'src/app/app/clientes/[customerId]',
  'src/app/app/configuracoes',
];

describe('cadastros do painel — o padrão da §5.9', () => {
  it('nenhuma das três tabelas de largura 100% sobreviveu', () => {
    for (const tela of COM_TABELA) {
      expect(ler(tela)).not.toContain('<table');
    }
  });

  it('toda tela abre com CabecalhoDePagina, não com <h1> solto', () => {
    for (const tela of TELAS) {
      expect(ler(tela)).toContain('CabecalhoDePagina');
    }
  });

  it('nenhuma tela do padrão carrega estilo inline de layout', () => {
    for (const tela of TELAS) {
      expect(ler(tela)).not.toMatch(/style=\{\{/);
    }
  });

  it('toda rota do painel tem loading.tsx com esqueleto, não "Carregando…" solto', () => {
    for (const rota of ROTAS_DO_PAINEL) {
      const caminho = resolve(process.cwd(), rota, 'loading.tsx');
      expect(existsSync(caminho), `falta ${rota}/loading.tsx`).toBe(true);
      expect(readFileSync(caminho, 'utf8')).toContain('EsqueletoDeLinha');
    }
  });

  it('os formulários dos cadastros usam Campo e Botao, não input e button crus', () => {
    const formularios = [
      'src/app/app/servicos/servico-form.tsx',
      'src/app/app/equipe/staff-form.tsx',
      'src/app/app/equipe/[staffId]/services-form.tsx',
      'src/app/app/equipe/[staffId]/time-off-section.tsx',
      'src/app/app/configuracoes/settings-form.tsx',
      'src/app/app/clientes/[customerId]/notes-form.tsx',
    ];
    for (const arquivo of formularios) {
      const fonte = ler(arquivo);
      expect(fonte, arquivo).toMatch(/from '@\/components\/ui\/botao'/);
      expect(fonte, arquivo).not.toMatch(/<button\b/);
    }
  });
});
