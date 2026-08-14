'use client';

import { Bloco } from '@/components/ui/bloco';
import { Botao } from '@/components/ui/botao';
import { Largura } from '@/components/ui/largura';

/**
 * Rede de segurança do painel.
 *
 * O caso concreto: o cliente cancela pelo link do WhatsApp e o barbeiro, numa
 * aba aberta antes disso, clica em "Cancelar" na agenda. A action lança, e sem
 * boundary o painel inteiro some. Aqui o barbeiro recarrega o segmento e volta
 * a enxergar o dia.
 *
 * Fica no degrau mais estreito da régua: são duas frases para ler e dois botões
 * para apertar, não uma tela para varrer. Os 560px que havia aqui eram mais um
 * número escolhido no olho — a §3.7 lista só três exceções à régua, e esta não é
 * uma delas.
 */
export default function ErroDoPainel({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <Largura tipo="formulario">
      <h2 className="mb-3 text-[22px] leading-7 font-bold">
        Não foi possível carregar esta parte do painel
      </h2>

      <Bloco tom="perigo" papel="alert">
        A tela pode estar desatualizada — outro dispositivo talvez tenha mudado esse agendamento.
        Tente de novo para recarregar.
      </Bloco>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Botao type="button" onClick={() => retry()}>
          Tentar de novo
        </Botao>
        <a href="/app/agenda" className="btn btn--sec">
          Voltar para a agenda
        </a>
      </div>

      {error.digest ? (
        <p className="mt-4 text-sm leading-5 text-tinta-3">Código do erro: {error.digest}</p>
      ) : null}
    </Largura>
  );
}
