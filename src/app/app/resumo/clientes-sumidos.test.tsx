// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import type { ClienteSumido } from '@/domain/indicadores/cliente';
import { telefoneParaWaMe } from '@/lib/telefone';
import { ClientesSumidos, mensagemDeRetorno } from './clientes-sumidos';

/**
 * A frase de cada linha é o que torna a lista confiável (§2.5 do spec): ela
 * mostra o critério na cara do dono. Uma frase que se contradiz faz o contrário
 * — quem lê "corta a cada 15 dias, sumiu há 25" para de acreditar na lista
 * inteira, e a lista é a única parte da tela que pede uma ação.
 */

const TZ = 'America/Sao_Paulo';

function sumido(over: Partial<ClienteSumido> = {}): ClienteSumido {
  return {
    customerId: 'c1',
    nome: 'Maria da Silva',
    telefone: '11999998888',
    ultimaVisita: new Date('2026-07-05T13:00:00Z'),
    intervaloTipico: 15,
    diasSemVir: 40,
    ...over,
  };
}

describe('ClientesSumidos', () => {
  it('diz há quantos dias o cliente sumiu — a ausência de verdade, não o excedente sobre o ritmo', () => {
    const { container } = render(
      <ClientesSumidos clientes={[sumido()]} nomeDaLoja="Barbearia do João" timeZone={TZ} />,
    );

    expect(screen.getByText(/corta a cada 15 dias, sumiu há 40 dias/i)).toBeTruthy();
    // 25 é `ausência − intervalo típico`, que era o que a linha imprimia. O
    // número tem que ser o mesmo que a frase promete.
    expect(container.textContent).not.toContain('25');
  });

  it('concorda em número quando é um dia só', () => {
    render(
      <ClientesSumidos
        clientes={[sumido({ intervaloTipico: 1, diasSemVir: 1 })]}
        nomeDaLoja="Barbearia"
        timeZone={TZ}
      />,
    );
    expect(screen.getByText(/corta a cada 1 dia, sumiu há 1 dia/i)).toBeTruthy();
  });

  it('cada linha leva o WhatsApp com a mensagem pronta — é a razão de a lista existir', () => {
    render(<ClientesSumidos clientes={[sumido()]} nomeDaLoja="Barbearia do João" timeZone={TZ} />);

    const link = screen.getByRole('link', { name: /chamar no whatsapp/i });
    const href = link.getAttribute('href')!;
    expect(href).toContain(telefoneParaWaMe('11999998888'));
    expect(decodeURIComponent(href)).toContain(
      mensagemDeRetorno('Maria da Silva', 'Barbearia do João'),
    );
  });

  it('sem ninguém atrasado, explica o critério em vez de mostrar lista vazia', () => {
    render(<ClientesSumidos clientes={[]} nomeDaLoja="Barbearia" timeZone={TZ} />);
    expect(screen.getByText(/uma vez e meia o intervalo/i)).toBeTruthy();
  });
});
