import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';

import { CabecalhoDePagina } from '@/components/ui/cabecalho-de-pagina';
import { Bloco } from '@/components/ui/bloco';
import { Card, CardContent } from '@/components/ui/card';
import { Largura } from '@/components/ui/largura';
import { db } from '@/db/client';
import { barbershop, user } from '@/db/schema';
import {
  billingEstaAtivo,
  clienteTempraBilling,
  TempraBillingError,
  type AssinaturaBilling,
  type EntradaLedgerBilling,
  type PacoteBilling,
  type PlanoBilling,
} from '@/lib/tempra-billing';
import { MENSAGEM_SO_DONO, requireSession } from '@/lib/session';
import { CheckoutForm } from './checkout-form';

function dinheiro(centavos: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    centavos / 100,
  );
}

function data(valor: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(new Date(valor));
}

function rotuloDoStatus(status: AssinaturaBilling['status']): string {
  return {
    trialing: 'Período de teste',
    active: 'Ativa',
    past_due: 'Pagamento pendente',
    canceled: 'Cancelada',
    expired: 'Expirada',
  }[status];
}

export default async function AssinaturaPage() {
  const sessao = await requireSession();

  return (
    <div className="flex flex-col gap-4">
      <CabecalhoDePagina
        titulo="Assinatura"
        descricao="Plano, franquia mensal e cobrança da barbearia."
      />
      <Largura tipo="tabela" className="flex flex-col gap-6">
        {sessao.role !== 'OWNER' ? (
          <Bloco tom="alerta">{MENSAGEM_SO_DONO}</Bloco>
        ) : (
          <ConteudoDaAssinatura
            tenantId={sessao.barbershopId}
            userId={sessao.userId}
          />
        )}
      </Largura>
    </div>
  );
}

async function ConteudoDaAssinatura({ tenantId, userId }: { tenantId: string; userId: string }) {
  if (!billingEstaAtivo()) {
    return <Bloco tom="alerta">Assinaturas ainda não estão disponíveis neste ambiente.</Bloco>;
  }

  const cliente = clienteTempraBilling();
  let catalogo: { product: string; plans: PlanoBilling[]; creditPackages: PacoteBilling[] };
  let assinatura: AssinaturaBilling | null;
  let saldo: number;
  let ledger: EntradaLedgerBilling[];
  try {
    [catalogo, assinatura] = await Promise.all([
      cliente.buscarCatalogo(), cliente.buscarAssinatura(tenantId),
    ]);
    const assinaturaAtual = assinatura;
    const plano = assinaturaAtual
      ? catalogo.plans.find((item) => item.code === assinaturaAtual.planCode)
      : undefined;
    const unidade = Object.keys(plano?.includedCredits ?? {})[0]
      ?? catalogo.creditPackages[0]?.unit
      ?? 'whatsapp_message';
    [saldo, ledger] = await Promise.all([
      cliente.buscarSaldo(tenantId, unidade),
      cliente.buscarLedger(tenantId, 20, unidade),
    ]);
  } catch (erro) {
    const indisponivel = erro instanceof TempraBillingError && erro.status >= 500;
    return (
      <Bloco tom="perigo" papel="alert">
        {indisponivel
          ? 'Não foi possível consultar a cobrança agora. Tente novamente em instantes.'
          : 'A configuração de cobrança desta barbearia precisa ser revisada.'}
      </Bloco>
    );
  }

  const [loja, dono] = await Promise.all([
    db
      .select({ name: barbershop.name, phone: barbershop.phone })
      .from(barbershop)
      .where(eq(barbershop.id, tenantId))
      .limit(1)
      .then((linhas) => linhas[0]),
    db
      .select({ name: user.name })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1)
      .then((linhas) => linhas[0]),
  ]);
  if (!loja || !dono) return null;

  const planoAtual = assinatura
    ? catalogo.plans.find((plano) => plano.code === assinatura.planCode)
    : undefined;
  const vigente = assinatura && ['active', 'trialing', 'past_due'].includes(assinatura.status);

  return (
    <>
      {assinatura ? (
        <ResumoDaAssinatura assinatura={assinatura} plano={planoAtual} saldo={saldo} ledger={ledger} pacotes={catalogo.creditPackages} nome={dono.name || loja.name} telefone={loja.phone ?? ''} />
      ) : null}

      {!vigente && catalogo.plans.length === 0 && catalogo.creditPackages.length === 0 ? (
        <Bloco tom="alerta">Nenhum plano está disponível para contratação.</Bloco>
      ) : !vigente ? (
        <CheckoutForm
          planos={catalogo.plans}
          pacotes={catalogo.creditPackages}
          nonce={randomUUID()}
          nome={dono.name || loja.name}
          telefone={loja.phone ?? ''}
        />
      ) : null}
    </>
  );
}

function ResumoDaAssinatura({
  assinatura,
  plano,
  saldo,
  ledger,
  pacotes,
  nome,
  telefone,
}: {
  assinatura: AssinaturaBilling;
  plano?: PlanoBilling;
  saldo: number;
  ledger: EntradaLedgerBilling[];
  pacotes: PacoteBilling[];
  nome: string;
  telefone: string;
}) {
  const emAtraso = assinatura.status === 'past_due';
  return (
    <section className="flex flex-col gap-3" aria-labelledby="assinatura-atual">
      <div className="flex flex-col gap-1">
        <h2 id="assinatura-atual" className="text-base leading-6 font-bold">
          Assinatura atual
        </h2>
        <p className="text-sm leading-5 text-muted-foreground">
          {rotuloDoStatus(assinatura.status)}
        </p>
      </div>
      <Card className="rounded-lg">
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs leading-5 text-muted-foreground">Plano</p>
            <p className="text-base leading-6 font-bold">{plano?.name ?? assinatura.planCode}</p>
            {plano ? (
              <p className="text-sm leading-5 text-muted-foreground">
                {dinheiro(plano.monthlyPriceCents)}/mês
              </p>
            ) : null}
          </div>
          <div>
            <p className="text-xs leading-5 text-muted-foreground">Créditos disponíveis</p>
            <p className="text-base leading-6 font-bold">{saldo.toLocaleString('pt-BR')}</p>
            <p className="text-sm leading-5 text-muted-foreground">na franquia atual</p>
          </div>
          <div>
            <p className="text-xs leading-5 text-muted-foreground">Próxima renovação</p>
            <p className="text-base leading-6 font-bold">{data(assinatura.currentPeriodEnd)}</p>
          </div>
        </CardContent>
      </Card>
      {emAtraso ? (
        <Bloco tom="alerta">O pagamento está pendente e os recursos do plano podem ficar indisponíveis.</Bloco>
      ) : null}
      <HistoricoDeCreditos entradas={ledger} />
      <CheckoutForm planos={[]} pacotes={pacotes} nonce={randomUUID()} nome={nome} telefone={telefone} />
    </section>
  );
}

function HistoricoDeCreditos({ entradas }: { entradas: EntradaLedgerBilling[] }) {
  return (
    <section className="flex flex-col gap-3" aria-labelledby="historico-creditos">
      <div className="flex flex-col gap-1">
        <h2 id="historico-creditos" className="text-base leading-6 font-bold">
          Histórico de créditos
        </h2>
        <p className="text-sm leading-5 text-muted-foreground">
          Franquia, consumo e ajustes da conta.
        </p>
      </div>
      {entradas.length === 0 ? (
        <Bloco tom="info">Nenhuma movimentação registrada ainda.</Bloco>
      ) : (
        <Card className="rounded-lg">
          <CardContent className="divide-y divide-border p-0">
            {entradas.slice(0, 20).map((entrada) => (
              <div key={entrada.id} className="grid gap-1 px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
                <div>
                  <p className="text-sm font-semibold">{rotuloDaEntrada(entrada)}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(entrada.occurredAt))}
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <p className={`text-sm font-bold ${entrada.amount < 0 ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {entrada.amount > 0 ? '+' : ''}{entrada.amount.toLocaleString('pt-BR')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    saldo: {entrada.balanceAfter.toLocaleString('pt-BR')}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </section>
  );
}

function rotuloDaEntrada(entrada: EntradaLedgerBilling): string {
  if (entrada.kind === 'debit') return 'Consumo de créditos';
  if (entrada.kind === 'refund') return 'Crédito devolvido';
  if (entrada.kind === 'expiration') return 'Crédito expirado';
  if (entrada.grantSource === 'subscription') return 'Franquia mensal renovada';
  if (entrada.grantSource === 'purchase') return 'Pacote de créditos comprado';
  return entrada.reason ?? 'Ajuste de créditos';
}
