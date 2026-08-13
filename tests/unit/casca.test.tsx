// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PanelNav } from '@/components/panel-nav';
import { SidebarProvider } from '@/components/ui/sidebar';

/**
 * Em 13/08/2026 a casca do painel virou a sidebar do shadcn: o `PanelNav` deixou
 * de ser uma barra de 52px e passou a ser o conteúdo de uma `Sidebar`, que só
 * funciona dentro de um `SidebarProvider` — montado por `src/app/app/layout.tsx`
 * e reproduzido aqui pelo `montaCasca`.
 *
 * **O que saiu.** A asserção de que a nav rolava por dentro (`overflow-x-auto`).
 * Ela existia porque cinco seções não cabiam lado a lado em 360px e a barra
 * tinha de rolar em vez de empurrar a página; numa coluna vertical não há eixo
 * horizontal para rolar, e a asserção passou a guardar uma estrutura que não
 * existe mais.
 *
 * **O que continua valendo**, e é o que os casos abaixo guardam: as cinco
 * seções, o `aria-current` na ativa, o logout (que não existia no produto antes
 * da reforma e é o mais fácil de perder numa troca de casca) e o nome da loja,
 * que também é o atalho de um toque para a agenda.
 *
 * **O logout mudou de forma, não de existência.** Até 13/08/2026 ele era um
 * botão solto no rodapé e bastava `getByRole('button', { name: /sair/i })`.
 * Agora o rodapé é o `nav-user` do `dashboard-01`: um `DropdownMenu` com o
 * avatar e o nome, e "Sair" é item de menu — que só existe no documento depois
 * de o menu abrir. O caso passou a abrir o menu. Ele é o mais importante deste
 * arquivo: quem reescrever a casca de novo tem de continuar entregando uma
 * saída, esteja ela onde estiver.
 */
const props = {
  nomeDaLoja: 'Barbearia do Marcão',
  ativo: '/app/agenda',
  nomeDoUsuario: 'Marcos Silva',
};

beforeAll(() => {
  // O jsdom 29 não implementa `matchMedia`, e o `useIsMobile` do
  // `SidebarProvider` chama no efeito de montagem — sem isto o render explode
  // antes de qualquer asserção. A largura fica em desktop de propósito: é o
  // ramo em que a sidebar existe no documento; no celular ela é uma gaveta em
  // portal, fechada, e não haveria nada para inspecionar.
  if (typeof window.matchMedia !== 'function') {
    window.matchMedia = (query: string) =>
      ({
        media: query,
        matches: false,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList;
  }

  // O menu de conta é um popup posicionado pelo floating-ui, que observa o
  // gatilho para reposicionar. O jsdom não tem `ResizeObserver`, e sem este
  // remendo abrir o menu estoura antes de qualquer asserção.
  if (typeof globalThis.ResizeObserver !== 'function') {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }

  // O mesmo popup rola o item destacado para a vista ao abrir por teclado.
  if (typeof Element.prototype.scrollIntoView !== 'function') {
    Element.prototype.scrollIntoView = () => {};
  }
});

function montaCasca() {
  return render(
    <SidebarProvider>
      <PanelNav {...props} />
    </SidebarProvider>,
  );
}

describe('PanelNav', () => {
  it('lista as cinco seções do painel', () => {
    montaCasca();
    for (const secao of ['Agenda', 'Serviços', 'Equipe', 'Clientes', 'Configurações']) {
      expect(screen.getByRole('link', { name: secao })).toBeDefined();
    }
  });

  it('marca a seção ativa por aria-current, não só por peso da fonte', () => {
    montaCasca();
    expect(screen.getByRole('link', { name: 'Agenda' }).getAttribute('aria-current')).toBe('page');
  });

  it('mostra quem está logado no rodapé, e o rodapé abre um menu', () => {
    montaCasca();
    const conta = screen.getByRole('button', { name: /marcos silva/i });
    expect(conta.getAttribute('aria-haspopup')).toBe('menu');
  });

  it('oferece sair da conta — dentro do menu de conta do rodapé', async () => {
    montaCasca();
    await userEvent.click(screen.getByRole('button', { name: /marcos silva/i }));
    expect(await screen.findByRole('menuitem', { name: /sair/i })).toBeDefined();
  });

  it('mostra o nome da barbearia, e ele leva para a agenda', () => {
    montaCasca();
    const loja = screen.getByRole('link', { name: 'Barbearia do Marcão' });
    expect(loja.getAttribute('href')).toBe('/app/agenda');
  });

  it('a sidebar encolhe e volta por um controle com nome acessível', () => {
    // Substitui a asserção de rolagem: o que pode sumir numa reescrita agora não
    // é o eixo de rolagem, é a maneira de recuperar a nav depois de encolhida.
    montaCasca();
    expect(screen.getByRole('button', { name: 'Abrir ou fechar o menu' })).toBeDefined();
  });
});
