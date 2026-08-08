'use client';

import { useState, useTransition } from 'react';
import { executarAcao } from '@/components/action-error';
import { ErroDeAcao } from '@/components/erro-de-acao';
import { Botao } from '@/components/ui/botao';
import { toggleServiceAction } from './actions';

export function ToggleButton({ id, active }: { id: string; active: boolean }) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      {/* 44px e 88px de largura mínima (§5.9): é afordância dentro de uma linha
          de 72px, não o verbo da tela, e o texto troca entre duas palavras de
          tamanhos diferentes — sem largura mínima a linha dança a cada clique. */}
      <Botao
        type="button"
        variante="secundario"
        pendente={pending}
        onClick={() => {
          setErro(null);
          startTransition(() => executarAcao(() => toggleServiceAction(id, !active), setErro));
        }}
        className="min-h-11 w-full min-w-22"
      >
        {active ? 'Desativar' : 'Ativar'}
      </Botao>
      <ErroDeAcao mensagem={erro} />
    </div>
  );
}
