import { after } from 'next/server';

/**
 * Agenda trabalho para depois que a resposta sai.
 *
 * `void promessa` não serve em serverless: a Vercel congela a execução assim
 * que a resposta é entregue, e a notificação morre no meio. `after()` do
 * `next/server` é o que estende a vida da invocação até a tarefa terminar.
 *
 * Fora de um request scope do Next — teste de integração chamando a rota
 * direto, script de linha de comando — o `after()` lança; nesse caso a tarefa
 * roda solta, que é exatamente o que acontecia antes e serve bem para quem não
 * está atrás de um servidor congelando função.
 */
export function afterResponse(tarefa: () => Promise<unknown>, aviso: string): void {
  const executar = () => tarefa().catch((erro) => console.error(aviso, erro));
  try {
    after(executar);
  } catch {
    void executar();
  }
}
