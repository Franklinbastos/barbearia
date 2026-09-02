'use client';

import { CreditCard } from 'lucide-react';
import { useActionState } from 'react';

import { ErroDeAcao } from '@/components/erro-de-acao';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { Card, CardContent } from '@/components/ui/card';
import { SecaoDeAjustes } from '@/components/ui/secao-de-ajustes';
import type { PacoteBilling, PlanoBilling } from '@/lib/tempra-billing';
import { iniciarAssinaturaAction, type CheckoutState } from './actions';

const ESTADO_INICIAL: CheckoutState = {};

function dinheiro(centavos: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(centavos / 100);
}

function creditoDoPlano(plano: PlanoBilling): [string, number] | null {
  const entrada = Object.entries(plano.includedCredits)[0];
  return entrada ? [entrada[0], entrada[1]] : null;
}

function rotuloDaUnidade(unidade: string): string {
  if (unidade === 'whatsapp_message') return 'mensagens automáticas';
  if (unidade === 'agent_action') return 'ações do agente';
  return unidade.replaceAll('_', ' ');
}

function detalhesDaPolitica(plano: PlanoBilling): string[] {
  const politica = plano.usagePolicy;
  if (!politica) return [];
  return [
    politica.messagesPerCredit == null
      ? null
      : `${politica.messagesPerCredit.toLocaleString('pt-BR')} mensagem(ns) por crédito`,
    politica.inputTokensPerCredit == null
      ? null
      : `${politica.inputTokensPerCredit.toLocaleString('pt-BR')} tokens de entrada por crédito`,
    politica.outputTokensPerCredit == null
      ? null
      : `${politica.outputTokensPerCredit.toLocaleString('pt-BR')} tokens de saída por crédito`,
  ].filter((item): item is string => item !== null);
}

export function CheckoutForm({
  planos,
  pacotes = [],
  nonce,
  nome,
  telefone,
}: {
  planos: PlanoBilling[];
  pacotes?: PacoteBilling[];
  nonce: string;
  nome: string;
  telefone: string;
}) {
  const [estado, formAction, pendente] = useActionState(iniciarAssinaturaAction, ESTADO_INICIAL);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="checkoutNonce" value={nonce} />

      <SecaoDeAjustes
        titulo="Dados de cobrança"
        descricao="O pagamento recorrente é processado no ambiente seguro do Asaas."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Nome ou razão social">
            <input name="payerName" defaultValue={nome} autoComplete="name" required minLength={2} />
          </Campo>
          <Campo rotulo="CPF ou CNPJ">
            <input
              name="taxId"
              inputMode="numeric"
              autoComplete="off"
              required
              minLength={11}
              maxLength={18}
            />
          </Campo>
          <Campo rotulo="Telefone">
            <input
              name="phone"
              defaultValue={telefone}
              inputMode="tel"
              autoComplete="tel"
              required
              minLength={10}
              maxLength={16}
            />
          </Campo>
          <Campo rotulo="CEP">
            <input
              name="postalCode"
              inputMode="numeric"
              autoComplete="postal-code"
              required
              minLength={8}
              maxLength={9}
            />
          </Campo>
          <Campo rotulo="Endereço">
            <input name="address" autoComplete="street-address" />
          </Campo>
          <Campo rotulo="Número">
            <input name="addressNumber" autoComplete="address-line2" required maxLength={20} />
          </Campo>
          <Campo rotulo="Complemento">
            <input name="complement" autoComplete="off" maxLength={255} />
          </Campo>
          <Campo rotulo="Bairro">
            <input name="province" autoComplete="address-level3" maxLength={120} />
          </Campo>
        </div>
      </SecaoDeAjustes>

      {planos.length > 0 ? <section className="flex flex-col gap-3" aria-labelledby="planos-disponiveis">
        <div className="flex flex-col gap-1">
          <h2 id="planos-disponiveis" className="text-base leading-6 font-bold">
            Plano
          </h2>
          <p className="text-sm leading-5 text-muted-foreground">
            Cobrança mensal no cartão, com renovação automática da franquia.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {planos.map((plano) => {
            const credito = creditoDoPlano(plano);
            const detalhes = detalhesDaPolitica(plano);
            return (
              <Card key={plano.code} className="rounded-lg">
                <CardContent className="flex h-full flex-col gap-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-base leading-6 font-bold">{plano.name}</h3>
                      <p className="text-sm leading-5 text-muted-foreground">
                        {credito
                          ? `${credito[1].toLocaleString('pt-BR')} ${rotuloDaUnidade(credito[0])} por mês`
                          : 'Franquia definida pelo produto'}
                      </p>
                      {detalhes.length > 0 ? (
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {detalhes.join(' · ')}
                        </p>
                      ) : null}
                    </div>
                    <p className="shrink-0 text-base leading-6 font-bold">
                      {dinheiro(plano.monthlyPriceCents)}
                      <span className="font-normal text-muted-foreground">/mês</span>
                    </p>
                  </div>

                  <Botao
                    name="planCode"
                    value={plano.code}
                    largura="total"
                    pendente={pendente}
                    rotuloPendente="Abrindo pagamento…"
                  >
                    <CreditCard aria-hidden="true" />
                    Assinar {plano.name}
                  </Botao>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <ErroDeAcao mensagem={estado.erro} />
      </section> : null}

      {pacotes.length > 0 ? (
        <section className="flex flex-col gap-3" aria-labelledby="pacotes-disponiveis">
          <div className="flex flex-col gap-1">
            <h2 id="pacotes-disponiveis" className="text-base leading-6 font-bold">
              Créditos adicionais
            </h2>
            <p className="text-sm leading-5 text-muted-foreground">
              Compra única para continuar usando o atendimento automático.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {pacotes.map((pacote) => (
              <Card key={pacote.code} className="rounded-lg">
                <CardContent className="flex h-full flex-col gap-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-base leading-6 font-bold">{pacote.name}</h3>
                      <p className="text-sm leading-5 text-muted-foreground">
                        {pacote.quantity.toLocaleString('pt-BR')} {rotuloDaUnidade(pacote.unit)}
                      </p>
                    </div>
                    <p className="shrink-0 text-base leading-6 font-bold">{dinheiro(pacote.priceCents)}</p>
                  </div>
                  <Botao
                    name="creditPackCode"
                    value={pacote.code}
                    largura="total"
                    pendente={pendente}
                    rotuloPendente="Abrindo pagamento…"
                    formNoValidate
                  >
                    <CreditCard aria-hidden="true" />
                    Comprar {pacote.name}
                  </Botao>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : null}
    </form>
  );
}
