'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { Botao } from '@/components/ui/botao';
import { BuscaDeCliente } from '@/components/ui/busca-de-cliente';
import { Monograma } from '@/components/ui/monograma';

/**
 * Casca do painel (§5.1): barra preta de 56px com o nome da loja e a conta, e
 * abaixo a nav de 52px que **rola por dentro**.
 *
 * A versão anterior era um flex row sem wrap com o nome da loja mais cinco
 * links: passava de 550px e fazia o painel inteiro rolar de lado em 360px, em
 * toda tela. A rolagem agora é da nav e não da página.
 */
const ITENS = [
  { href: '/app/agenda', label: 'Agenda' },
  { href: '/app/servicos', label: 'Serviços' },
  { href: '/app/equipe', label: 'Equipe' },
  { href: '/app/clientes', label: 'Clientes' },
  { href: '/app/configuracoes', label: 'Configurações' },
];

export type PanelNavProps = {
  nomeDaLoja: string;
  /**
   * Caminho ativo. Sem ele vale o `usePathname()` — a prop existe porque o
   * caminho é a única entrada do componente que o teste precisa controlar.
   */
  ativo?: string;
  /** Iniciais da barra superior. Sem nome, a conta fica só com o verbo. */
  nomeDoUsuario?: string;
};

export function PanelNav({ nomeDaLoja, ativo, nomeDoUsuario }: PanelNavProps) {
  const pathname = usePathname();
  const atual = ativo ?? pathname ?? '';
  const [saindo, setSaindo] = useState(false);
  const itemAtivo = useRef<HTMLAnchorElement>(null);

  // A seção ativa pode estar fora da vista quando a nav já nasce rolada —
  // `/app/configuracoes` é o último item e é onde o dono passa a configurar a
  // loja. `scrollIntoView` não existe no jsdom, daí a chamada opcional.
  useEffect(() => {
    itemAtivo.current?.scrollIntoView?.({ inline: 'nearest', block: 'nearest' });
  }, [atual]);

  async function sair() {
    setSaindo(true);
    try {
      await authClient.signOut();
    } finally {
      // Recarga de página inteira de propósito, e não `router.push`: o Router
      // Cache do cliente guarda o HTML do painel já renderizado, e depois de
      // sair ele é de outra conta. O botão de voltar mostraria a agenda de quem
      // acabou de deslogar.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = '/login';
    }
  }

  return (
    <header className="bg-bg">
      <div className="flex h-14 items-center justify-between gap-2 bg-tinta px-3">
        <strong className="truncate text-base leading-6 font-bold text-[var(--acao-tinta)]">
          {nomeDaLoja}
        </strong>

        {/* Sempre visível, em qualquer seção: quem atende o telefone não está
            necessariamente na página de clientes (§5.10). */}
        <div className="flex shrink-0 items-center gap-1">
          <BuscaDeCliente />

          <Botao
            variante="texto"
            onClick={sair}
            pendente={saindo}
            rotuloPendente="Saindo…"
            className="min-w-11 gap-2 px-2 text-[var(--acao-tinta)] no-underline"
          >
            {nomeDoUsuario ? <Monograma nome={nomeDoUsuario} /> : null}
            Sair
          </Botao>
        </div>
      </div>

      <nav
        aria-label="Seções do painel"
        className="flex h-[52px] items-stretch overflow-x-auto border-b border-linha whitespace-nowrap"
        style={{
          scrollbarWidth: 'none',
          maskImage: 'linear-gradient(to right, #000 calc(100% - 24px), transparent)',
          WebkitMaskImage: 'linear-gradient(to right, #000 calc(100% - 24px), transparent)',
        }}
      >
        {ITENS.map((item) => {
          // `startsWith` porque /app/equipe/[staffId] tem de manter "Equipe" ativa.
          const eAtivo = atual === item.href || atual.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              ref={eAtivo ? itemAtivo : undefined}
              aria-current={eAtivo ? 'page' : undefined}
              className={`inline-flex shrink-0 items-center border-b-[3px] px-4 text-base leading-6 no-underline ${
                eAtivo ? 'border-tinta font-bold text-tinta' : 'border-transparent text-tinta-2'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
