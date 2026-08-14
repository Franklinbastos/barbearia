import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ler = (arquivo: string) =>
  readFileSync(fileURLToPath(new URL(`./${arquivo}`, import.meta.url)), 'utf8');

const pagina = ler('page.tsx');
const comissao = ler('comissao-form.tsx');
const servicos = ler('services-form.tsx');
const bloqueios = ler('time-off-section.tsx');
const expediente = ler('working-hours-form.tsx');
const esqueleto = ler('loading.tsx');

describe('acabamento do detalhe do barbeiro', () => {
  it('nenhum bloco da tela inventa a própria largura', () => {
    // Eram quatro caixas empilhadas com três larguras diferentes: 720px em
    // serviços, expediente e bloqueios, 420px na comissão e 520px no formulário
    // de bloquear horário. O degrau entre elas é o defeito visível.
    //
    // `working-hours-form.tsx` entra na lista mesmo sem nunca ter tido teto: são
    // sete dos cards desta tela, e é o arquivo mais provável de alguém apertar
    // "só um pouquinho" quando os campos de hora ficarem justos.
    for (const fonte of [pagina, comissao, servicos, bloqueios, expediente, esqueleto]) {
      expect(fonte).not.toMatch(/max-w-\[\d+px\]/);
    }
  });

  it('a régua da tela é declarada uma vez só, em page.tsx', () => {
    // Repetida em cada filho, o próximo bloco que alguém acrescentar nasce
    // desalinhado — que é exatamente como os 420px da comissão apareceram.
    expect(pagina.match(/tipo="tabela"/g)).toHaveLength(1);
    for (const filho of [comissao, servicos, bloqueios, expediente]) {
      expect(filho).not.toMatch(/tipo="tabela"|tipo: 'tabela'/);
    }
  });

  it('o esqueleto tem a largura da tela que ele antecede', () => {
    // `loading.tsx` é outra árvore de render: sem declarar a mesma régua, o
    // conteúdo salta de largura no instante em que chega.
    expect(esqueleto).toMatch(/tipo="tabela"/);
  });

  it('os dois formulários põem o teto no <form>, e não no card', () => {
    // Comissão e bloqueio são as duas caixas de digitar da tela. O teto de campo
    // vai no `<form>`; o card fica na largura da tela, como em `servico-form` e
    // `staff-form`. Se o teto subir para o `<Card>`, volta o degrau de caixa
    // estreita embaixo de lista larga — o mesmo 520-sobre-720 que este plano
    // veio desfazer, só que na parte de baixo da tela.
    for (const fonte of [comissao, bloqueios]) {
      expect(fonte).toMatch(/larguraVariants\(\{\s*tipo: 'formulario'\s*\}\)/);
      expect(fonte).not.toMatch(/<Card className=\{larguraVariants/);
    }
  });

  it('o expediente continua em uma coluna no celular', () => {
    // Sete cards de dia, seis campos de hora em cada um: duas colunas em 360px
    // espremem os campos e a tela rola de lado.
    const grade = pagina.match(/className="grid[^"]*"/)?.[0] ?? '';
    expect(grade).toMatch(/md:grid-cols-2/);
    expect(grade.replace(/md:grid-cols-\d+/g, '')).not.toMatch(/grid-cols-/);
  });
});
