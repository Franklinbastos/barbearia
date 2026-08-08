'use client';

import { Bloco } from '@/components/ui/bloco';
import { Botao } from '@/components/ui/botao';

/**
 * Rede de segurança da página pública.
 *
 * Sem este arquivo, qualquer exceção não tratada — inclusive a de uma server
 * action disparada por botão — derruba a tela inteira e o cliente fica sem
 * saber se o horário foi marcado.
 *
 * A mensagem é genérica de propósito: em produção o Next só entrega o `digest`
 * ao navegador, e mostrar `error.message` vazaria detalhe interno em
 * desenvolvimento.
 */
export default function ErroGlobal({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main className="mx-auto w-full max-w-[480px] px-4 py-8">
      <h1 className="mb-4 text-[22px] leading-7 font-bold">Alguma coisa deu errado</h1>

      <Bloco tom="perigo" papel="alert">
        <p>Não conseguimos carregar esta página agora. Tente de novo em instantes.</p>
        <p className="mt-2">Se continuar assim, fale com a barbearia pelo WhatsApp.</p>
      </Bloco>

      <div className="mt-4">
        <Botao type="button" onClick={() => retry()}>
          Tentar de novo
        </Botao>
      </div>

      {error.digest ? (
        <p className="mt-4 text-sm leading-5 text-tinta-3">Código do erro: {error.digest}</p>
      ) : null}
    </main>
  );
}
