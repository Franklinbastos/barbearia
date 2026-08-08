import Link from 'next/link';
import { Botao } from '@/components/ui/botao';

/**
 * Raiz do site. Não é vitrine de produto — quem chega aqui é dono de barbearia
 * procurando o painel. O cliente final nunca passa por esta página: ele vem
 * direto para `/b/[slug]` por um link do WhatsApp ou da bio.
 *
 * Substituiu o template do create-next-app, que ficou em inglês e com o logo do
 * Next até a reforma de UI.
 */
export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col justify-center gap-8 px-4 py-12">
      <div className="flex flex-col gap-3">
        <h1 className="text-3xl leading-9 font-bold tracking-tight">Agenda de barbearia</h1>
        <p className="text-[15px] leading-6 text-tinta-2">
          Sua agenda online, com link próprio para o cliente marcar sozinho.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <Link href="/signup" className="no-underline">
          <Botao largura="total" tamanho="lg">
            Cadastrar minha barbearia
          </Botao>
        </Link>
        <Link href="/login" className="no-underline">
          <Botao largura="total" tamanho="lg" variante="secundario">
            Entrar
          </Botao>
        </Link>
      </div>
    </main>
  );
}
