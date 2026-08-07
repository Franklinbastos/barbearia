'use client';

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
    <main style={{ padding: '2rem', maxWidth: '32rem', margin: '0 auto' }}>
      <h1>Alguma coisa deu errado</h1>
      <p>Não conseguimos carregar esta página agora. Tente de novo em instantes.</p>
      <p>Se continuar assim, fale com a barbearia pelo WhatsApp.</p>
      <button type="button" onClick={() => retry()}>
        Tentar de novo
      </button>
      {error.digest ? (
        <p>
          <small>Código do erro: {error.digest}</small>
        </p>
      ) : null}
    </main>
  );
}
