'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITENS = [
  { href: '/app/agenda', label: 'Agenda' },
  { href: '/app/servicos', label: 'Serviços' },
  { href: '/app/equipe', label: 'Equipe' },
  { href: '/app/clientes', label: 'Clientes' },
  { href: '/app/configuracoes', label: 'Configurações' },
];

export function PanelNav({ shopName }: { shopName: string }) {
  const pathname = usePathname();

  return (
    <header style={{ borderBottom: '1px solid #333', padding: '0.75rem 1rem', display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
      <strong>{shopName}</strong>
      <nav style={{ display: 'flex', gap: '1rem' }}>
        {ITENS.map((item) => {
          const ativo = pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} style={{ fontWeight: ativo ? 'bold' : 'normal' }}>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
