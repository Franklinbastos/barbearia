import { MessageCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { ClienteSumido } from '@/domain/indicadores/cliente';
import { formatDayLabelFromInstant } from '@/lib/format';

/**
 * A lista de clientes sumidos, com o botão de WhatsApp em cada linha (§2.5 e
 * §3.3 do spec).
 *
 * **O botão é a razão de a lista existir.** "12 clientes sumidos" sem ação é
 * uma acusação, não uma ferramenta: o dono lê, se sente mal e fecha a tela. Com
 * o texto pronto no `wa.me`, a mesma informação vira um minuto de trabalho — é
 * o que o Trinks faz e é o princípio nº 5 do spec.
 *
 * **A frase de cada linha é o que torna a lista confiável.** "Corta a cada 15
 * dias, sumiu há 40" mostra o critério na cara do dono. Sem isso ele não tem
 * como saber por que o cliente bimestral não está ali — e é justamente esse
 * caso que a regra dos 30 dias erra e que a nossa definição acerta.
 *
 * **Sem `'use client'`.** Só há links: nenhum estado, nenhum manipulador. O
 * `wa.me` é montado no servidor e vai no `href`.
 */
export type ClientesSumidosProps = {
  clientes: ClienteSumido[];
  /** Entra na mensagem: o cliente precisa saber quem está chamando. */
  nomeDaLoja: string;
  /** Fuso da barbearia, para a data da última visita não deslocar um dia. */
  timeZone: string;
  /** Quantos mostrar. O resto vira "e mais N". */
  limite?: number;
};

/**
 * Telefone brasileiro no formato que o `wa.me` exige: só dígitos, com o código
 * do país na frente.
 *
 * O banco guarda o que o balcão digitou — `(11) 99999-8888`, `11999998888`, às
 * vezes já com o 55. A regra: 10 ou 11 dígitos é número nacional e ganha o 55;
 * qualquer coisa maior já vem com país e passa direto. Exportada porque é a
 * única parte deste arquivo que erra calado — link torto abre o WhatsApp em
 * conversa vazia.
 */
export function telefoneParaWaMe(telefone: string): string {
  const digitos = telefone.replace(/\D/g, '');
  if (digitos.length === 10 || digitos.length === 11) return `55${digitos}`;
  return digitos;
}

/** "Maria da Silva" → "Maria". O primeiro nome é como o barbeiro chama. */
function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? nome;
}

/**
 * A mensagem sugerida. Convite, nunca cobrança: quem recebe "você sumiu há 40
 * dias" não volta, e o número de dias é informação do dono, não do cliente.
 */
export function mensagemDeRetorno(nome: string, nomeDaLoja: string): string {
  return `Olá, ${primeiroNome(nome)}! Aqui é da ${nomeDaLoja}. Faz um tempo que você não aparece — quer marcar um horário?`;
}

export function linkDeWhatsApp(cliente: ClienteSumido, nomeDaLoja: string): string {
  const texto = encodeURIComponent(mensagemDeRetorno(cliente.nome, nomeDaLoja));
  return `https://wa.me/${telefoneParaWaMe(cliente.telefone)}?text=${texto}`;
}

export function ClientesSumidos({
  clientes,
  nomeDaLoja,
  timeZone,
  limite = 8,
}: ClientesSumidosProps) {
  if (clientes.length === 0) {
    return (
      <p data-slot="clientes-sumidos-vazio" className="text-sm leading-5 text-muted-foreground">
        Ninguém está atrasado em relação ao próprio ritmo. A lista aparece quando alguém passa de
        uma vez e meia o intervalo em que costuma cortar.
      </p>
    );
  }

  const mostrados = clientes.slice(0, limite);
  const restantes = clientes.length - mostrados.length;

  return (
    <div data-slot="clientes-sumidos" className="flex flex-col">
      <ul className="flex flex-col divide-y divide-border">
        {mostrados.map((cliente) => (
          <li
            key={cliente.customerId}
            data-slot="cliente-sumido"
            // Empilha no celular e vira duas colunas a partir de 640px: em
            // 360px o nome e o botão lado a lado forçariam rolagem lateral.
            className="flex flex-col gap-2 py-3 first:pt-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
          >
            <div className="min-w-0">
              <p className="truncate text-base leading-6 font-medium">{cliente.nome}</p>
              <p className="text-sm leading-5 text-muted-foreground">
                Corta a cada {cliente.intervaloTipico}{' '}
                {cliente.intervaloTipico === 1 ? 'dia' : 'dias'}, sumiu há {cliente.diasAtraso}{' '}
                {cliente.diasAtraso === 1 ? 'dia' : 'dias'} · última visita em{' '}
                {formatDayLabelFromInstant(cliente.ultimaVisita, timeZone)}
              </p>
            </div>

            <Button
              size="lg"
              variant="outline"
              className="shrink-0 sm:w-auto"
              render={
                <a
                  href={linkDeWhatsApp(cliente, nomeDaLoja)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="no-underline"
                />
              }
            >
              <MessageCircle aria-hidden="true" />
              Chamar no WhatsApp
              <span className="sr-only"> {cliente.nome}</span>
            </Button>
          </li>
        ))}
      </ul>

      {restantes > 0 ? (
        <p className="pt-3 text-sm leading-5 text-muted-foreground">
          e mais {restantes} {restantes === 1 ? 'cliente' : 'clientes'} na mesma situação.
        </p>
      ) : null}
    </div>
  );
}
