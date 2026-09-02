import { ArrowLeft, CircleCheck, CircleX, Clock3 } from 'lucide-react';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { z } from 'zod';

import { Bloco } from '@/components/ui/bloco';
import { Button } from '@/components/ui/button';
import { CabecalhoDePagina } from '@/components/ui/cabecalho-de-pagina';
import { Card, CardContent } from '@/components/ui/card';
import { Largura } from '@/components/ui/largura';
import { billingEstaAtivo, clienteTempraBilling, type CheckoutBilling } from '@/lib/tempra-billing';
import { requireSession } from '@/lib/session';
import { COOKIE_DO_CHECKOUT } from '../checkout-cookie';
import { MonitorDoCheckout } from './monitor-do-checkout';

export default async function RetornoDoCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ resultado?: string }>;
}) {
  const sessao = await requireSession();
  const { resultado: bruto } = await searchParams;
  const resultado = z.enum(['sucesso', 'cancelado', 'expirado']).catch('sucesso').parse(bruto);
  const checkoutId = (await cookies()).get(COOKIE_DO_CHECKOUT)?.value;

  let checkout: CheckoutBilling | null = null;
  if (billingEstaAtivo() && checkoutId && z.uuid().safeParse(checkoutId).success) {
    try {
      const encontrado = await clienteTempraBilling().buscarCheckout(checkoutId);
      if (encontrado.tenantId === sessao.barbershopId && encontrado.product === 'barbearia') {
        checkout = encontrado;
      }
    } catch {
      checkout = null;
    }
  }

  const confirmado = Boolean(checkout?.fulfilledAt);
  const encerrado = ['canceled', 'expired', 'failed'].includes(checkout?.status ?? '');
  const cancelado = resultado !== 'sucesso' || encerrado;
  const acompanhar = !confirmado && !cancelado && Boolean(checkout);

  return (
    <div className="flex flex-col gap-4">
      <CabecalhoDePagina titulo="Pagamento" descricao="Retorno da contratação do plano." />
      <Largura tipo="formulario">
        <Card className="rounded-lg">
          <CardContent className="flex flex-col items-start gap-4 py-4">
            <EstadoDoCheckout confirmado={confirmado} cancelado={cancelado} checkout={checkout} />
            <MonitorDoCheckout acompanhar={acompanhar} />
            {!checkout && resultado === 'sucesso' ? (
              <Bloco tom="alerta" compacto>
                Não foi possível localizar esta cobrança. Consulte a assinatura novamente.
              </Bloco>
            ) : null}
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href="/app/assinatura" className="no-underline" />}
            >
              <ArrowLeft aria-hidden="true" />
              Voltar para assinatura
            </Button>
          </CardContent>
        </Card>
      </Largura>
    </div>
  );
}

function EstadoDoCheckout({
  confirmado,
  cancelado,
  checkout,
}: {
  confirmado: boolean;
  cancelado: boolean;
  checkout: CheckoutBilling | null;
}) {
  if (confirmado) {
    return (
      <div className="flex items-start gap-3">
        <CircleCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-ok" />
        <div>
          <h2 className="text-base leading-6 font-bold">Assinatura ativada</h2>
          <p className="text-sm leading-5 text-muted-foreground">
            A franquia mensal já está disponível para a barbearia.
          </p>
        </div>
      </div>
    );
  }
  if (cancelado) {
    return (
      <div className="flex items-start gap-3">
        <CircleX aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-perigo" />
        <div>
          <h2 className="text-base leading-6 font-bold">Pagamento não concluído</h2>
          <p className="text-sm leading-5 text-muted-foreground">
            Nenhuma assinatura foi ativada nesta tentativa.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-3">
      <Clock3 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-alerta" />
      <div>
        <h2 className="text-base leading-6 font-bold">Pagamento em confirmação</h2>
        <p className="text-sm leading-5 text-muted-foreground">
          {checkout?.status === 'paid'
            ? 'O pagamento foi recebido e a franquia está sendo liberada.'
            : 'A confirmação do provedor ainda não chegou.'}
        </p>
      </div>
    </div>
  );
}
