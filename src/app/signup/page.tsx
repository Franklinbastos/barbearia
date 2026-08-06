'use client';

import { useActionState } from 'react';
import { signupAction, type SignupState } from './actions';

const ESTADO_INICIAL: SignupState = {};

async function actionComFuso(prevState: SignupState, formData: FormData): Promise<SignupState> {
  formData.set('timeZone', Intl.DateTimeFormat().resolvedOptions().timeZone);
  return signupAction(prevState, formData);
}

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(actionComFuso, ESTADO_INICIAL);

  return (
    <main style={{ maxWidth: 420, margin: '0 auto', padding: '2rem 1rem' }}>
      <h1>Cadastre sua barbearia</h1>
      <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <label>
          Seu nome
          <input name="ownerName" required minLength={2} />
        </label>
        <label>
          E-mail
          <input name="email" type="email" required />
        </label>
        <label>
          Senha
          <input name="password" type="password" required minLength={8} />
        </label>
        <label>
          Nome da barbearia
          <input name="shopName" required minLength={2} />
        </label>
        <label>
          Endereço da sua página
          <input name="slug" required minLength={2} placeholder="minha-barbearia" />
        </label>
        {state.erro ? <p role="alert" style={{ color: 'crimson' }}>{state.erro}</p> : null}
        <button type="submit" disabled={pending}>
          {pending ? 'Cadastrando…' : 'Cadastrar'}
        </button>
      </form>
    </main>
  );
}
