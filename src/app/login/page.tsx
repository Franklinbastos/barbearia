'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { ErroDeAcao } from '@/components/erro-de-acao';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';

export default function LoginPage() {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);
    setPending(true);

    const formData = new FormData(event.currentTarget);
    const { error } = await authClient.signIn.email({
      email: String(formData.get('email')),
      password: String(formData.get('password')),
    });

    setPending(false);
    if (error) {
      setErro(error.message ?? 'Não foi possível entrar');
      return;
    }
    router.push('/app');
  }

  return (
    <main className="mx-auto w-full max-w-[360px] px-4 py-8">
      <h1 className="mb-6 text-[22px] leading-7 font-bold">Entrar</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Campo rotulo="E-mail">
          <input name="email" type="email" required autoComplete="email" />
        </Campo>
        <Campo rotulo="Senha">
          <input name="password" type="password" required autoComplete="current-password" />
        </Campo>

        <ErroDeAcao mensagem={erro} />

        <Botao
          type="submit"
          tamanho="lg"
          largura="total"
          pendente={pending}
          rotuloPendente="Entrando…"
        >
          Entrar
        </Botao>
      </form>

      <p className="mt-6 text-center text-base leading-6 text-tinta-2">
        Ainda não tem conta? <Link href="/signup">Cadastre sua barbearia</Link>
      </p>
    </main>
  );
}
