import { formatDayLabelLong, formatPrice, formatTime, isoDateInZone } from '@/lib/format';
import type { Resultado } from '../types';

/**
 * Confirmação (§5.5 da direção de UI).
 *
 * "Horário confirmado" e "Ver ou cancelar meu horário" são textos exatos: o e2e
 * casa os dois, um por texto e o outro por papel de link.
 *
 * `servico` é opcional porque o resultado do servidor não traz serviço nem
 * preço — quem sabe disso é o `BookingWizard`, que já tem o catálogo em mãos.
 */
export function DoneStep({
  resultado,
  timeZone,
  servico,
  whatsappConfigurado = false,
}: {
  resultado: Resultado;
  timeZone: string;
  servico?: { nome: string; precoCents: number };
  whatsappConfigurado?: boolean;
}) {
  const dia = formatDayLabelLong(isoDateInZone(resultado.startAt, timeZone), timeZone);
  const diaComMaiuscula = dia.charAt(0).toUpperCase() + dia.slice(1);

  return (
    <section className="mt-4">
      <div className="bloco bloco--ok" role="status">
        <h2 className="text-[28px] leading-8 font-extrabold text-ok">Horário confirmado</h2>

        {/* Bloco de detalhe: é o que o cliente vai reler no dia, e é o mesmo
            desenho da tela de gerenciar o horário. */}
        <div className="mt-3 rounded-cx border border-linha bg-bg p-4">
          <p className="text-base leading-6 text-tinta-2">{diaComMaiuscula}</p>
          <p className="text-[34px] leading-[38px] font-extrabold text-tinta">
            {formatTime(resultado.startAt, timeZone)}
          </p>
          <p className="text-lg leading-6 font-semibold text-tinta">com {resultado.staffName}</p>
          {servico ? (
            <p className="mt-1 text-base leading-6 text-tinta-2">
              {servico.nome} · {formatPrice(servico.precoCents)}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        <a className="btn btn--lg btn--tot" href={resultado.manageUrl}>
          Ver ou cancelar meu horário
        </a>

        {/* Rota de verdade, e não `data:` URI: no Safari do iOS o `.ics` por
            `data:` não abre confiável, e é lá que o cliente está. */}
        <a className="btn btn--sec btn--tot" href={`${resultado.manageUrl}/ics`}>
          Adicionar à agenda do celular
        </a>
      </div>

      <p className="mt-3 text-sm leading-5 text-tinta-2">
        {whatsappConfigurado
          ? 'Você vai receber a confirmação no WhatsApp.'
          : 'Guarde este link. Ele é a sua única forma de cancelar sozinho.'}
      </p>
    </section>
  );
}
