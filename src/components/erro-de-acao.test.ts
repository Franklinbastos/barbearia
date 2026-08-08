import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isValidElement, type ReactNode } from 'react';
import { ErroDeAcao } from './erro-de-acao';

function textoDe(no: ReactNode): string {
  if (no === null || no === undefined || typeof no === 'boolean') return '';
  if (typeof no === 'string' || typeof no === 'number') return String(no);
  if (Array.isArray(no)) return no.map(textoDe).join('');
  if (isValidElement(no)) {
    const props = no.props as { children?: ReactNode };
    return textoDe(props.children);
  }
  return '';
}

describe('ErroDeAcao', () => {
  it('não ocupa espaço quando não há erro', () => {
    expect(ErroDeAcao({ mensagem: null })).toBeNull();
    expect(ErroDeAcao({ mensagem: '' })).toBeNull();
  });

  it('anuncia a falha para leitor de tela', () => {
    const elemento = ErroDeAcao({ mensagem: 'Não foi possível concluir.' });
    expect(elemento).not.toBeNull();
    // A pele é o <Bloco>, que transforma `papel` em `role="alert"`.
    const props = elemento!.props as { papel?: string; tom?: string };
    expect(props.papel).toBe('alert');
    expect(props.tom).toBe('perigo');
    expect(textoDe(elemento)).toBe('Não foi possível concluir.');
  });
});

/**
 * Guarda de regressão do achado 16: cada botão que dispara server action tem
 * que passar por `executarAcao` e ter onde mostrar a falha. Sem isso o clique
 * que falha vira silêncio — ou derruba a tela.
 */
const RAIZ = fileURLToPath(new URL('../', import.meta.url));

const BOTOES_DE_ACAO = [
  // Os botões de "Compareceu"/"Não veio"/"Desfazer" saíram de day-grid.tsx na
  // reforma de UI e moraram no cartão. A guarda segue o código.
  'app/app/agenda/cartao-da-agenda.tsx',
  'app/app/servicos/toggle-button.tsx',
  'app/app/equipe/toggle-staff-button.tsx',
  'app/app/equipe/[staffId]/time-off-section.tsx',
];

describe.each(BOTOES_DE_ACAO)('%s', (caminho) => {
  const fonte = readFileSync(`${RAIZ}${caminho}`, 'utf8');

  it('roteia toda server action por executarAcao', () => {
    // `startTransition(() => algumaAction(...))` engole a exceção sem boundary:
    // é exatamente o padrão que some com a tela quando a action lança.
    const chamadasSemGuarda = fonte.match(/start\w*\(\s*\(\)\s*=>\s*\w+Action\(/g) ?? [];
    expect(chamadasSemGuarda).toEqual([]);
    expect(fonte).toContain('executarAcao(');
    expect(fonte).toContain("from '@/components/action-error'");
  });

  it('tem onde mostrar a falha perto do botão', () => {
    expect(fonte).toContain('ErroDeAcao');
    expect(fonte).toContain("from '@/components/erro-de-acao'");
  });
});
