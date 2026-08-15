// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CartaoDaAgenda } from './cartao-da-agenda';
import type { AgendaItem } from './day-grid';

const ITEM: AgendaItem = {
  id: 'a1',
  staffId: 's1',
  customerId: 'c1',
  staffName: 'Marcão',
  customerName: 'Marcos',
  customerPhone: '11999999999',
  serviceName: 'Corte',
  servicePriceCents: 5000,
  status: 'BOOKED',
  origin: 'PUBLIC',
  startAt: new Date('2026-08-14T13:00:00Z'),
  endAt: new Date('2026-08-14T13:30:00Z'),
};

/**
 * O relógio fica DENTRO do atendimento de propósito: "Não veio" só nasce 10 min
 * depois da hora marcada (§5.7), então com um `agora` anterior ao início o caso
 * das ações recolhidas testaria um botão só e passaria por acidente.
 */
const props = {
  timeZone: 'America/Sao_Paulo',
  corDoBarbeiro: 'var(--linha)',
  agora: new Date('2026-08-14T13:20:00Z'),
};

/** Monta o cartão dentro do `<ol>` em que ele vive de verdade e devolve a raiz. */
function montar(item: Partial<AgendaItem> = {}) {
  const { container } = render(
    <ol className="lista">
      <CartaoDaAgenda item={{ ...ITEM, ...item }} {...props} />
    </ol>,
  );
  return container.querySelector('[data-slot="cartao-da-agenda"]') as HTMLElement;
}

function acoesDe(cartao: HTMLElement) {
  return cartao.querySelector('[data-slot="acoes-do-cartao"]') as HTMLElement | null;
}

describe('CartaoDaAgenda — a ação recolhida', () => {
  it('as ações continuam na árvore de acessibilidade mesmo recolhidas', () => {
    // esconder no desktop é decisão visual; sumir do DOM tiraria a ação de quem
    // navega por teclado e de quem usa leitor de tela
    montar();
    expect(screen.getByRole('button', { name: 'Compareceu' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Não veio' })).toBeDefined();
  });

  it('o bloco de ações reage a foco, não só a ponteiro', () => {
    // `group-hover` sozinho é ação que não existe para quem usa Tab
    const acoes = acoesDe(montar());
    expect(acoes?.className).toMatch(/focus-within/);
    expect(acoes?.className).toMatch(/group-hover/);
  });

  it('só some onde o hover existe para trazer de volta', () => {
    // `md:` sozinho pega o tablet de 800px, que não tem ponteiro nenhum; a folha
    // do "⋯" não carrega "Compareceu", então ali a ação simplesmente sumiria.
    // Esconder pela mesma consulta que revela (`hover: hover`) fecha o buraco.
    const acoes = acoesDe(montar());
    expect(acoes?.className).toMatch(/\[@media\(hover:hover\)\]:opacity-0/);
  });

  it('recolher é opacidade, nunca display:none', () => {
    // `hidden` (ou remoção condicional) tira o botão da ordem de tabulação e do
    // leitor de tela — é a regressão que nenhum teste de aparência pegaria
    const acoes = acoesDe(montar());
    expect(acoes?.className).toMatch(/opacity-0/);
    expect(acoes?.className).toMatch(/pointer-events-none/);
    expect(acoes?.className.split(/\s+/)).not.toContain('hidden');
    expect(acoes?.className.split(/\s+/)).not.toContain('md:hidden');
  });

  it('o "⋯" nunca recolhe: sem ele a linha em repouso não teria caminho nenhum', () => {
    // é um alvo de 44px, não os ~400px dos verbos — e é por ele que se chega ao
    // telefone e ao "Cancelar"
    const cartao = montar();
    expect(acoesDe(cartao)?.querySelector('[aria-label^="Mais ações"]')).toBeNull();
    expect(screen.getByRole('button', { name: 'Mais ações para Marcos' })).toBeDefined();
  });

  it('a linha já resolvida não tem bloco recolhível', () => {
    // DONE, NO_SHOW e CANCELED não têm verbo na linha: sobra o "⋯", sempre visível
    const cartao = montar({ status: 'DONE' });
    expect(acoesDe(cartao)).toBeNull();
    expect(screen.getByRole('button', { name: 'Mais ações para Marcos' })).toBeDefined();
  });
});

describe('CartaoDaAgenda — a forma sai da duração', () => {
  it('atendimento curto ocupa menos que atendimento longo', () => {
    // a duração é o assunto da tela e hoje não aparece em lugar nenhum
    expect(montar().getAttribute('data-forma')).toBe('compacto');

    const longo = montar({ id: 'a2', endAt: new Date('2026-08-14T14:00:00Z') });
    expect(longo.getAttribute('data-forma')).toBe('completo');
  });

  it('a faixa do meio existe: 45 min não é nem curto nem longo', () => {
    const medio = montar({ id: 'a3', endAt: new Date('2026-08-14T13:45:00Z') });
    expect(medio.getAttribute('data-forma')).toBe('medio');
  });

  it('no cartão curto quem desce em 360px é o serviço, nunca o nome', () => {
    // A quebra do flex usa o tamanho hipotético de cada item, e `flex-1` é base
    // zero: com ele o nome cede a linha inteira ao serviço e sobra "Marc…" em
    // 360px — o contrário do que o cartão curto quer dizer. Medindo o próprio
    // conteúdo (`grow`, base `auto`), o serviço é que não cabe e desce.
    const curto = montar();
    const linha = curto.querySelector('[data-slot="nome-do-cliente"]')!.parentElement!;
    expect(linha.className).toMatch(/flex-wrap/);
    expect(curto.querySelector('[data-slot="nome-do-cliente"]')!.className.split(/\s+/)).not.toContain(
      'flex-1',
    );

    // E o serviço vem depois das etiquetas: antes delas, quem desceria sozinha
    // seria a etiqueta, e o cartão de uma linha viraria de três.
    const comEtiqueta = montar({ id: 'a4', origin: 'PANEL' });
    const ordem = [...comEtiqueta.querySelector('[data-slot="nome-do-cliente"]')!.parentElement!
      .children].map((f) => f.getAttribute('data-slot'));
    expect(ordem[0]).toBe('nome-do-cliente');
    expect(ordem[ordem.length - 1]).toBe('servico-na-linha-do-nome');
    expect(ordem.length).toBe(3);
  });

  it('o telefone sai do cartão curto e continua alcançável pela folha', () => {
    // é o que faz a linha curta caber numa linha; quem precisa do número abre o
    // "⋯", que tem "Ligar para o cliente" e "Copiar telefone"
    const curto = montar();
    expect(curto.querySelector('a[href^="tel:"]')).toBeNull();
    expect(screen.getByRole('button', { name: 'Mais ações para Marcos' })).toBeDefined();

    const longo = montar({ id: 'a2', endAt: new Date('2026-08-14T14:00:00Z') });
    expect(longo.querySelector('a[href^="tel:"]')).not.toBeNull();
  });
});

describe('CartaoDaAgenda — o estado se lê por forma', () => {
  it('cancelado se distingue por forma, não só por cor', () => {
    // quem não distingue cor precisa enxergar o estado; o traço no nome resolve
    const cartao = montar({ status: 'CANCELED' });
    expect(cartao.className).toMatch(/border-dashed/);
    expect(cartao.querySelector('[data-slot="nome-do-cliente"]')?.className).toMatch(
      /line-through/,
    );
  });

  it('a falta também é tracejada: ninguém sentou na cadeira', () => {
    const cartao = montar({ status: 'NO_SHOW' });
    expect(cartao.className).toMatch(/border-dashed/);
    // riscar o nome de quem faltou seria dizer que o horário não existiu
    expect(cartao.querySelector('[data-slot="nome-do-cliente"]')?.className).not.toMatch(
      /line-through/,
    );
  });

  it('o que aconteceu, e o que ainda vai acontecer, ficam com a borda cheia', () => {
    expect(montar().className).toMatch(/border-solid/);
    expect(montar({ status: 'DONE' }).className).toMatch(/border-solid/);
  });
});

describe('CartaoDaAgenda — a folha é o menu do celular', () => {
  /**
   * No celular não há `⋯` suspenso: o que a linha do desktop resolve com o
   * `MenuDaLinha` a folha já resolvia aqui. Estes dois caminhos entraram nela em
   * 15/08/2026 e são a metade celular da mesma decisão.
   */
  it('leva ao WhatsApp com o 55 do país e à ficha do cliente', async () => {
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByRole('button', { name: 'Mais ações para Marcos' }));

    // Sem o 55 o `wa.me` abre conversa vazia e nada na tela avisa — a conta é de
    // `telefoneParaWaMe`, em `src/lib/telefone.ts`, e é uma só no produto.
    expect(screen.getByRole('link', { name: 'Abrir no WhatsApp' }).getAttribute('href')).toBe(
      'https://wa.me/5511999999999',
    );
    expect(screen.getByRole('link', { name: 'Ver ficha do cliente' }).getAttribute('href')).toBe(
      '/app/clientes/c1',
    );
  });
});

describe('CartaoDaAgenda — remarcar existe no celular', () => {
  it('a folha oferece Remarcar', async () => {
    // Até 15/08 o único gatilho do modo era o `⋯` da linha do desktop, que não
    // renderiza abaixo de 768px — não havia caminho nenhum justamente na
    // largura em que o produto é usado no balcão.
    const usuario = userEvent.setup();
    montar();
    await usuario.click(screen.getByRole('button', { name: 'Mais ações para Marcos' }));
    expect(screen.getByRole('button', { name: 'Remarcar' })).toBeDefined();
  });

  it('não oferece Remarcar no que já terminou', async () => {
    const usuario = userEvent.setup();
    montar({ status: 'DONE' });
    await usuario.click(screen.getByRole('button', { name: 'Mais ações para Marcos' }));
    expect(screen.queryByRole('button', { name: 'Remarcar' })).toBeNull();
  });

  it('o item sendo remarcado recua, e os outros não', () => {
    // O aviso fixo do rodapé é quem nomeia o cliente; o recuo é o reforço
    // visual que faltava — sem ele, com a folha fechada, nada na lista diz de
    // onde o atendimento está saindo.
    const cartao = montar();
    expect(cartao.getAttribute('data-remarcando')).toBeNull();
    expect(cartao.className).not.toMatch(/opacity-50/);
  });
});
