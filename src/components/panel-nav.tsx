'use client';

import { CalendarDays, Contact, LogOut, Scissors, Settings, Store, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from '@/components/ui/sidebar';

/**
 * Casca do painel — desde 13/08/2026 é a **sidebar do shadcn**, não mais a
 * barra preta de 56px com a nav de 52px rolando por dentro.
 *
 * O que a barra antiga resolvia e esta continua resolvendo:
 *
 * - As cinco seções, com `aria-current="page"` na ativa (o realce de cor
 *   sozinho nunca foi o contrato — ver `tests/unit/casca.test.tsx`).
 * - O **logout**, que não existia no produto antes da reforma. Continua no
 *   rodapé, junto do monograma de quem está logado.
 * - O nome da loja, agora no topo da sidebar e também na barra da `SidebarInset`
 *   (ver `src/app/app/layout.tsx`), porque no celular a sidebar nasce fechada.
 *
 * O que mudou: a nav não rola mais de lado. Em ≥768px ela é uma coluna fixa de
 * 16rem que encolhe para um rail de 3rem; abaixo disso vira gaveta, aberta pelo
 * `SidebarTrigger` da barra de cima.
 *
 * **Sobre o arrasto.** A gaveta do celular é o `Sheet` do base-nova, que embrulha
 * o `Dialog` do `@base-ui/react` — e `Dialog` não tem gesto de arrasto nenhum:
 * abre por clique no gatilho e fecha por véu, `Escape` ou botão. Quem tem
 * arrasto é a `FolhaInferior`, que usa o `Drawer` (outro pacote do base-ui) com
 * `swipe-direction=down`, ou seja, no eixo Y. Não há gesto lateral registrado em
 * lugar nenhum do painel, então arrastar a folha para o lado não abre a sidebar
 * por baixo. Se um dia a gaveta ganhar arrasto de borda, este é o parágrafo que
 * precisa ser revisto.
 */
const ITENS = [
  { href: '/app/agenda', label: 'Agenda', Icone: CalendarDays },
  { href: '/app/servicos', label: 'Serviços', Icone: Scissors },
  { href: '/app/equipe', label: 'Equipe', Icone: Users },
  { href: '/app/clientes', label: 'Clientes', Icone: Contact },
  { href: '/app/configuracoes', label: 'Configurações', Icone: Settings },
];

export type PanelNavProps = {
  nomeDaLoja: string;
  /**
   * Caminho ativo. Sem ele vale o `usePathname()` — a prop existe porque o
   * caminho é a única entrada do componente que o teste precisa controlar.
   */
  ativo?: string;
  /** Iniciais do rodapé. Sem nome, a conta fica só com o verbo. */
  nomeDoUsuario?: string;
};

export function PanelNav({ nomeDaLoja, ativo, nomeDoUsuario }: PanelNavProps) {
  const pathname = usePathname();
  const atual = ativo ?? pathname ?? '';
  const [saindo, setSaindo] = useState(false);

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
    // O provider fica aqui, e não na raiz do app: a única dica de ferramenta do
    // produto é a do rail encolhido, e ela nasce e morre dentro da sidebar.
    <TooltipProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              {/* A identidade também é o atalho para a agenda: no celular a
                  gaveta custa um toque a mais que a nav antiga, e este link
                  devolve o caminho de um toque para a tela que o balcão abre o
                  dia inteiro. */}
              <SidebarMenuButton
                size="lg"
                tooltip={nomeDaLoja}
                render={<Link href="/app/agenda" className="no-underline" />}
              >
                <Store aria-hidden="true" />
                <span className="truncate font-medium">{nomeDaLoja}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Painel</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {ITENS.map(({ href, label, Icone }) => {
                  // `startsWith` porque /app/equipe/[staffId] tem de manter
                  // "Equipe" ativa.
                  const eAtivo = atual === href || atual.startsWith(`${href}/`);
                  return (
                    <SidebarMenuItem key={href}>
                      <SidebarMenuButton
                        isActive={eAtivo}
                        tooltip={label}
                        aria-current={eAtivo ? 'page' : undefined}
                        render={<Link href={href} className="no-underline" />}
                      >
                        <Icone aria-hidden="true" />
                        <span>{label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarSeparator />

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              {/* O nome de quem está logado e o verbo no mesmo controle, como
                  era na barra preta: clicar na conta É sair. Encolhido, sobra o
                  ícone com a dica "Sair da conta". */}
              <SidebarMenuButton size="lg" tooltip="Sair da conta" disabled={saindo} onClick={sair}>
                <LogOut aria-hidden="true" />
                <span className="grid flex-1 text-left leading-tight">
                  {nomeDoUsuario ? (
                    <span className="truncate font-medium">{nomeDoUsuario}</span>
                  ) : null}
                  <span className="truncate text-xs text-muted-foreground">
                    {saindo ? 'Saindo…' : 'Sair'}
                  </span>
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>
    </TooltipProvider>
  );
}
