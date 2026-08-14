'use client';

import {
  CalendarDays,
  ChartColumn,
  ChevronsUpDown,
  Contact,
  LogOut,
  Scissors,
  Settings,
  Store,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  useSidebar,
} from '@/components/ui/sidebar';

/**
 * Casca do painel — desde 13/08/2026 é a **sidebar do shadcn**, não mais a
 * barra preta de 56px com a nav de 52px rolando por dentro.
 *
 * O que a barra antiga resolvia e esta continua resolvendo:
 *
 * - As seções — cinco na reforma, seis desde que o Resumo entrou —, com
 *   `aria-current="page"` na ativa (o realce de cor sozinho nunca foi o
 *   contrato — ver `tests/unit/casca.test.tsx`).
 * - O **logout**, que não existia no produto antes da reforma. Continua no
 *   rodapé — desde 13/08/2026 dentro do menu de conta, não mais como botão
 *   solto (ver `ContaDoRodape` abaixo).
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
  // Resumo vem antes da Agenda desde 14/08/2026: a agenda continua sendo o que
  // o balcão abre o dia inteiro, mas quem entra no painel para *decidir* entra
  // pelos números. A identidade no topo da sidebar continua atalhando para a
  // agenda, então o balcão não perdeu o caminho de um toque.
  { href: '/app/resumo', label: 'Resumo', Icone: ChartColumn },
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
  /**
   * Nome de quem está logado — vira o rótulo e as iniciais do avatar do menu de
   * conta. Sem ele o item fica em "Conta", com o ícone no lugar das letras.
   */
  nomeDoUsuario?: string;
};

/**
 * Duas letras para o `AvatarFallback` — "Marcos Silva" vira `MS`, "Marcão" vira
 * `M`. Sem nome não há iniciais, e o avatar cai no ícone de conta.
 */
function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '';
  const primeira = partes[0]?.[0] ?? '';
  const ultima = partes.length > 1 ? (partes[partes.length - 1]?.[0] ?? '') : '';
  return `${primeira}${ultima}`.toUpperCase();
}

/**
 * O `nav-user` do `dashboard-01`: um item de menu no `SidebarFooter` com
 * `Avatar` + nome + `ChevronsUpDown`, e as ações de conta dentro de um
 * `DropdownMenu`.
 *
 * **O logout mora aqui.** Até 13/08/2026 ele era o próprio botão do rodapé —
 * clicar na conta *era* sair, o que resolvia o problema de o produto não ter
 * saída nenhuma, mas não sobrava lugar para uma segunda ação de conta e
 * "clicar no meu nome me desloga" é uma armadilha. Agora o botão abre o menu e
 * "Sair" é um item de lá. Quem for reescrever esta casca de novo: **o item de
 * sair é obrigatório**, e `tests/unit/casca.test.tsx` abre o menu justamente
 * para conferir que ele continua existindo.
 *
 * O item usa `closeOnClick={false}` de propósito: `signOut()` é uma ida ao
 * servidor e o menu fechando na hora deixaria a tela parada sem nada acontecer.
 * Fechado o menu, o "Saindo…" não teria onde aparecer.
 */
function ContaDoRodape({ nomeDoUsuario }: { nomeDoUsuario?: string }) {
  const { isMobile } = useSidebar();
  const [saindo, setSaindo] = useState(false);
  const nome = nomeDoUsuario?.trim() || 'Conta';
  const letras = nomeDoUsuario ? iniciais(nomeDoUsuario) : '';

  async function sair() {
    if (saindo) return;
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
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="data-popup-open:bg-muted data-popup-open:text-foreground"
              >
                <Avatar className="size-8 rounded-lg">
                  <AvatarFallback className="rounded-lg">
                    {letras ? letras : <Contact aria-hidden="true" />}
                  </AvatarFallback>
                </Avatar>
                <span className="grid flex-1 text-left leading-tight">
                  <span className="truncate font-medium">{nome}</span>
                  {/* Sem nome, a linha de cima já é "Conta" e a de baixo diria
                      "Minha conta" — duas vezes a mesma palavra em duas linhas. */}
                  {saindo || nomeDoUsuario ? (
                    <span className="truncate text-xs text-muted-foreground">
                      {saindo ? 'Saindo…' : 'Minha conta'}
                    </span>
                  ) : null}
                </span>
                <ChevronsUpDown aria-hidden="true" className="ml-auto size-4" />
              </SidebarMenuButton>
            }
          />

          {/* No desktop a sidebar é coluna e o menu abre ao lado; no celular ela
              é gaveta colada na borda esquerda e não há "ao lado" — abre por
              baixo, como o `dashboard-01` faz. */}
          <DropdownMenuContent
            className="min-w-56 rounded-lg"
            side={isMobile ? 'bottom' : 'right'}
            align="end"
            sideOffset={4}
          >
            {/* O `DropdownMenuLabel` é o `Menu.GroupLabel` do base-ui, e ele
                **explode** fora de um `Menu.Group` — não é enfeite de
                agrupamento, é requisito do primitivo. O grupo é um só porque a
                legenda rotula a mesma coisa que o item: a conta.

                E o item é um só, que é o que o produto tem de ação de conta
                hoje. "Configurações" e "Equipe" já são seções da nav e não se
                repetem aqui: menu de conta com atalho para o que está dois
                centímetros acima é ruído, não conveniência. */}
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-sm">
                  <Avatar className="size-8 rounded-lg">
                    <AvatarFallback className="rounded-lg">
                      {letras ? letras : <Contact aria-hidden="true" />}
                    </AvatarFallback>
                  </Avatar>
                  <span className="grid flex-1 text-left leading-tight">
                    <span className="truncate font-medium text-foreground">{nome}</span>
                  </span>
                </div>
              </DropdownMenuLabel>

              <DropdownMenuSeparator />

              <DropdownMenuItem closeOnClick={false} disabled={saindo} onClick={sair}>
                <LogOut aria-hidden="true" />
                {saindo ? 'Saindo…' : 'Sair'}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

export function PanelNav({ nomeDaLoja, ativo, nomeDoUsuario }: PanelNavProps) {
  const pathname = usePathname();
  const atual = ativo ?? pathname ?? '';

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
          <ContaDoRodape nomeDoUsuario={nomeDoUsuario} />
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>
    </TooltipProvider>
  );
}
