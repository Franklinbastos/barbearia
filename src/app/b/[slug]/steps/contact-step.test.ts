import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ContactStep } from './contact-step';

const html = renderToStaticMarkup(
  createElement(ContactStep, {
    slug: 'barbearia-x',
    serviceId: 'srv-1',
    serviceName: 'Corte',
    startAt: '2026-09-09T12:00:00.000Z',
    durationMinutes: 30,
    priceCents: 4500,
    timeZone: 'America/Sao_Paulo',
    whatsappConfigurado: false,
    nome: '',
    telefone: '',
    contatoDoAparelho: false,
    aoTrocarNome: vi.fn(),
    aoTrocarTelefone: vi.fn(),
    onDone: vi.fn(),
    onSlotTaken: vi.fn(),
    onVoltar: vi.fn(),
  }),
);

// Atributo HTML não diferencia maiúscula de minúscula, e o React 19 emite
// `inputMode`/`autoComplete` como vieram do JSX.
const CAMPOS = (html.match(/<input[^>]*>/g) ?? []).map((tag) => tag.toLowerCase());

/** Trecho do `<input>` que casa com a busca, já em minúsculas. */
function campo(marcador: string): string {
  const achado = CAMPOS.find((tag) => tag.includes(marcador));
  expect(achado, `campo com ${marcador} não encontrado`).toBeDefined();
  return achado!;
}

describe('ContactStep — telefone', () => {
  const telefone = () => campo('00000-0000');

  it('abre o teclado numérico do celular, que é onde a página pública roda', () => {
    expect(telefone()).toContain('type="tel"');
    expect(telefone()).toContain('inputmode="tel"');
  });

  it('deixa o navegador preencher sozinho', () => {
    expect(telefone()).toContain('autocomplete="tel"');
  });
});

describe('ContactStep — nome', () => {
  it('também aceita preenchimento automático', () => {
    expect(CAMPOS.some((tag) => tag.includes('autocomplete="name"'))).toBe(true);
  });
});
