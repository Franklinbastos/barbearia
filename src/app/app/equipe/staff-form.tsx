'use client';

import { useActionState, useRef, useEffect, useState } from 'react';
import { ErroDeAcao } from '@/components/erro-de-acao';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { Card, CardContent } from '@/components/ui/card';
import { createStaffAction, type StaffFormState } from './actions';

const ESTADO_INICIAL: StaffFormState = {};

export function StaffForm() {
  const [state, formAction, pending] = useActionState(createStaffAction, ESTADO_INICIAL);
  const formRef = useRef<HTMLFormElement>(null);
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  if (!aberto) {
    return (
      <Botao
        type="button"
        variante="secundario"
        largura="total"
        onClick={() => setAberto(true)}
        className="md:w-auto"
      >
        Adicionar barbeiro
      </Botao>
    );
  }

  return (
    // Mesma troca da lista logo abaixo: a caixa do formulário passa a ser o card
    // da lib em vez da borda desenhada à mão.
    <Card className="max-w-[520px]">
      <CardContent>
        <form ref={formRef} action={formAction} className="flex flex-col gap-3">
          <Campo rotulo="Nome do barbeiro" dica="O expediente padrão da loja já entra pronto.">
            <input name="name" required minLength={2} autoComplete="off" />
          </Campo>

          <ErroDeAcao mensagem={state.erro} />

          <Botao type="submit" largura="total" pendente={pending} rotuloPendente="Salvando…">
            Adicionar barbeiro
          </Botao>

          <Botao
            type="button"
            variante="texto"
            className="min-h-12 self-center"
            onClick={() => setAberto(false)}
          >
            Fechar
          </Botao>
        </form>
      </CardContent>
    </Card>
  );
}
