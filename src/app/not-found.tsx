import Link from 'next/link';
import { Bloco } from '@/components/ui/bloco';

/**
 * O 404 do produto (§5.6).
 *
 * Há cinco chamadas de `notFound()` no app e nenhum arquivo cobrindo elas: um
 * slug errado ou um token expirado entregava o 404 embutido do Next, **em
 * inglês**, para o cliente que veio de um link do WhatsApp — e quem recebe uma
 * tela em inglês num link de barbearia acha que é golpe.
 */
export default function NaoEncontrado() {
  return (
    <main className="mx-auto w-full max-w-[480px] px-4 py-8">
      <h1 className="mb-4 text-[22px] leading-7 font-bold">Página não encontrada</h1>

      <Bloco tom="alerta">
        Este link pode ter expirado ou o endereço está errado. Confira o link com a barbearia.
      </Bloco>

      {/* Controle de navegação: precisa ser âncora de verdade para funcionar
          sem JavaScript, e `.btn` é a classe que a §3.1 criou justamente para
          dar a um link a altura e a forma de botão. */}
      <div className="mt-4">
        <Link href="/" className="btn btn--sec">
          Ir para a página inicial
        </Link>
      </div>
    </main>
  );
}
