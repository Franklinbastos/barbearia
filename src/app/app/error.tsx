'use client';

/**
 * Rede de segurança do painel.
 *
 * O caso concreto: o cliente cancela pelo link do WhatsApp e o barbeiro, numa
 * aba aberta antes disso, clica em "Cancelar" na agenda. A action lança, e sem
 * boundary o painel inteiro some. Aqui o barbeiro recarrega o segmento e volta
 * a enxergar o dia.
 */
export default function ErroDoPainel({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div style={{ padding: '1rem' }}>
      <h2>Não foi possível carregar esta parte do painel</h2>
      <p>
        A tela pode estar desatualizada — outro dispositivo talvez tenha mudado esse agendamento.
        Tente de novo para recarregar.
      </p>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button type="button" onClick={() => retry()}>
          Tentar de novo
        </button>
        <a href="/app/agenda">Voltar para a agenda</a>
      </div>
      {error.digest ? (
        <p>
          <small>Código do erro: {error.digest}</small>
        </p>
      ) : null}
    </div>
  );
}
