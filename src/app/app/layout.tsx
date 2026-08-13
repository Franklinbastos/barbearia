import Link from 'next/link';
import { cookies } from 'next/headers';
import { requireSession } from '@/lib/session';
import { db } from '@/db/client';
import { findBarbershopById, findStaffById } from '@/db/repositories';
import { PanelNav } from '@/components/panel-nav';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';

/**
 * Casca do painel. Desde 13/08/2026 é `SidebarProvider` + `Sidebar` (o
 * `PanelNav`) + `SidebarInset`, no lugar da barra preta com a nav rolando de
 * lado.
 *
 * **A barra de cima é só do celular** (`md:hidden`). Acima de 768px a coluna da
 * sidebar está sempre na tela, com o nome da loja no topo dela, o `SidebarRail`
 * na borda e o atalho `Ctrl/Cmd+B` para encolher — uma barra repetindo o nome e
 * o gatilho ali seria mobília a mais. Abaixo de 768px a sidebar vira gaveta e
 * nasce fechada, então esta barra é a única porta: o gatilho abre a gaveta e o
 * nome da loja leva direto para a agenda.
 *
 * **Por que o nome da loja é link.** Na barra antiga a agenda era um toque, e a
 * gaveta custaria dois (abrir, escolher). O link devolve o toque único para a
 * tela que o balcão abre o dia inteiro. É a mesma razão pela qual o cabeçalho da
 * sidebar também aponta para `/app/agenda`.
 *
 * **44px no gatilho**, contra os 28px do `icon-sm` da lib: a §3.6 mantém o
 * `--tap-min` onde o alvo é de barra fixa, e este é o único caminho para a
 * navegação no celular.
 */
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const sessao = await requireSession();
  const [loja, eu, biscoitos] = await Promise.all([
    findBarbershopById(db, sessao.barbershopId),
    findStaffById(db, sessao.barbershopId, sessao.staffId),
    cookies(),
  ]);

  const nomeDaLoja = loja?.name ?? 'Barbearia';

  // O `SidebarProvider` grava `sidebar_state` quando o usuário encolhe a coluna,
  // mas não lê de volta — sem isto a preferência morre a cada recarga de página
  // inteira. O nome do cookie está cravado aqui de propósito: `sidebar.tsx` é
  // `'use client'`, e constante importada de módulo de cliente chega no servidor
  // como referência, não como texto.
  const sidebarAberta = biscoitos.get('sidebar_state')?.value !== 'false';

  return (
    <SidebarProvider defaultOpen={sidebarAberta}>
      <PanelNav nomeDaLoja={nomeDaLoja} nomeDoUsuario={eu?.name} />

      {/* `SidebarInset` já é o `<main>` da página — é onde o shadcn põe a barra
          de cima, e por isso o `<header>` mora dentro dele. */}
      <SidebarInset>
        <header
          data-slot="barra-do-painel"
          className="sticky top-0 z-20 flex h-12 shrink-0 items-center gap-1 border-b border-border bg-background px-2 md:hidden"
        >
          <SidebarTrigger className="size-11" />
          <Link
            href="/app/agenda"
            className="flex h-11 min-w-0 flex-1 items-center truncate text-base font-bold text-foreground no-underline"
          >
            {nomeDaLoja}
          </Link>
        </header>

        {/* 12px, não 24: em 360px são 336px úteis, e é o que faz a agenda caber
            sem rolagem lateral. O respiro de desktop entra a partir de 768px. */}
        <div className="mx-auto w-full max-w-[1400px] flex-1 p-3 md:p-5">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
