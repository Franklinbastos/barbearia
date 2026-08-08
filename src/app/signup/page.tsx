'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { ErroDeAcao } from '@/components/erro-de-acao';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { signupAction, type SignupState } from './actions';

const ESTADO_INICIAL: SignupState = {};

async function actionComFuso(prevState: SignupState, formData: FormData): Promise<SignupState> {
  formData.set('timeZone', Intl.DateTimeFormat().resolvedOptions().timeZone);
  return signupAction(prevState, formData);
}

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(actionComFuso, ESTADO_INICIAL);

  return (
    <main className="mx-auto w-full max-w-[360px] px-4 py-8">
      <h1 className="mb-6 text-[22px] leading-7 font-bold">Cadastre sua barbearia</h1>

      <form action={formAction} className="flex flex-col gap-4">
        <Campo rotulo="Seu nome">
          <input name="ownerName" required minLength={2} autoComplete="name" />
        </Campo>
        <Campo rotulo="E-mail">
          <input name="email" type="email" required autoComplete="email" />
        </Campo>
        <Campo rotulo="Senha">
          <input name="password" type="password" required minLength={8} autoComplete="new-password" />
        </Campo>
        <Campo rotulo="Nome da barbearia">
          <input name="shopName" required minLength={2} />
        </Campo>
        <Campo rotulo="Endereço da sua página" dica="É o fim do link que você manda no WhatsApp.">
          <input name="slug" required minLength={2} placeholder="minha-barbearia" />
        </Campo>

        <ErroDeAcao mensagem={state.erro} />

        <Botao
          type="submit"
          tamanho="lg"
          largura="total"
          pendente={pending}
          rotuloPendente="Cadastrando…"
        >
          Cadastrar
        </Botao>
      </form>

      <p className="mt-6 text-center text-base leading-6 text-tinta-2">
        Já tem conta? <Link href="/login">Entrar</Link>
      </p>
    </main>
  );
}
