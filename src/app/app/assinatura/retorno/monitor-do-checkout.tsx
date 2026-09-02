'use client';

import { LoaderCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export function MonitorDoCheckout({ acompanhar }: { acompanhar: boolean }) {
  const router = useRouter();
  const [esgotado, setEsgotado] = useState(false);

  useEffect(() => {
    if (!acompanhar) return;
    let tentativas = 0;
    router.refresh();
    const intervalo = window.setInterval(() => {
      tentativas += 1;
      router.refresh();
      if (tentativas >= 40) {
        window.clearInterval(intervalo);
        setEsgotado(true);
      }
    }, 3_000);
    return () => window.clearInterval(intervalo);
  }, [acompanhar, router]);

  if (!acompanhar) return null;
  if (esgotado) {
    return (
      <span className="text-sm text-muted-foreground" role="status">
        A confirmação está demorando mais que o esperado. Consulte a assinatura novamente em
        alguns instantes.
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 text-sm text-muted-foreground" role="status">
      <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
      Confirmando com o provedor
    </span>
  );
}
