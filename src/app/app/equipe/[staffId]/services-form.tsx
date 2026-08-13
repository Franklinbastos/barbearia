'use client';

import { useActionState } from 'react';
import { ErroDeAcao } from '@/components/erro-de-acao';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { formatDuration } from '@/lib/format';
import { saveStaffServicesAction, type FormState } from './actions';

const ESTADO_INICIAL: FormState = {};

type Servico = { id: string; name: string; durationMinutes: number };

/**
 * "Duração própria (min)" se repete uma vez por serviço: com dez serviços, o
 * leitor de tela anuncia dez campos idênticos. O nome acessível carrega o
 * serviço **e** continua contendo o rótulo visível inteiro — nome acessível que
 * não contém o texto escrito quebra o comando de voz de quem lê a tela.
 */
export function rotuloDaDuracaoPropria(nomeDoServico: string): string {
  return `Duração própria (min) — ${nomeDoServico}`;
}

export function ServicesForm({
  staffId,
  servicos,
  selecionados,
}: {
  staffId: string;
  servicos: Servico[];
  selecionados: Map<string, number | null>;
}) {
  const action = saveStaffServicesAction.bind(null, staffId);
  const [state, formAction, pending] = useActionState(action, ESTADO_INICIAL);

  return (
    <form action={formAction} className="flex max-w-[720px] flex-col gap-3">
      {/* `gap-0 py-0`: cada linha já traz o próprio recheio, e o do card
          empurraria as divisórias para dentro. */}
      <Card className="gap-0 py-0">
        <ul className="lista border-t-0 [&>li:last-child]:border-b-0">
          {servicos.map((s) => {
            const marcado = selecionados.has(s.id);
            const override = selecionados.get(s.id);
            return (
              <li key={s.id}>
                <div className="flex flex-col gap-3 p-3">
                  {/* O `<label>` por fora é a anatomia da própria lib (é assim
                      que a documentação do checkbox do base-ui monta o exemplo),
                      e é o que mantém a linha inteira clicável com 44px de alvo
                      — o quadradinho da lib tem 16px, mas o `after:-inset` dele
                      já estica a área de toque para fora do desenho. */}
                  <label className="flex min-h-11 cursor-pointer items-center gap-3">
                    {/* `name`/`value` vão no componente, não num campo oculto ao
                        lado: o `Checkbox` do base-ui **já** emite o
                        `<input type="checkbox" name value>` de verdade, e a
                        server action continua lendo `getAll('serviceIds')` sem
                        mudar uma linha. Um oculto aqui mandaria o id duas vezes,
                        que é exatamente o defeito que `fichas-de-escolha.tsx`
                        documenta no RadioGroup. */}
                    <Checkbox name="serviceIds" value={s.id} defaultChecked={marcado} />
                    <span className="flex flex-col gap-1">
                      <span className="text-[17px] leading-[22px] font-bold">{s.name}</span>
                      <span className="text-sm leading-5 text-tinta-2">
                        padrão {formatDuration(s.durationMinutes)}
                      </span>
                    </span>
                  </label>

                  <Campo rotulo="Duração própria (min)" dica="Vazio usa o padrão do serviço.">
                    <input
                      type="number"
                      name={`duration_${s.id}`}
                      aria-label={rotuloDaDuracaoPropria(s.name)}
                      inputMode="numeric"
                      min={1}
                      defaultValue={override ?? ''}
                      placeholder="usa o padrão"
                    />
                  </Campo>
                </div>
              </li>
            );
          })}
          {servicos.length === 0 ? (
            <li className="p-3 text-base leading-6 text-tinta-2">
              Nenhum serviço ativo para vincular.
            </li>
          ) : null}
        </ul>
      </Card>

      <ErroDeAcao mensagem={state.erro} />

      <Botao
        type="submit"
        variante="secundario"
        pendente={pending}
        rotuloPendente="Salvando…"
        className="self-end"
      >
        Salvar serviços
      </Botao>
    </form>
  );
}
