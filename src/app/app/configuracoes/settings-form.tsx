'use client';

import { useActionState, useState } from 'react';
import { ErroDeAcao } from '@/components/erro-de-acao';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { saveSettingsAction, type SettingsState } from './actions';
import { GRADES_PERMITIDAS, MATIZES_PERMITIDOS } from '@/domain/catalog/shop-settings';

const ESTADO_INICIAL: SettingsState = {};

const FUSOS_BRASIL = [
  'America/Noronha',
  'America/Sao_Paulo',
  'America/Manaus',
  'America/Cuiaba',
  'America/Boa_Vista',
  'America/Porto_Velho',
  'America/Rio_Branco',
];

/**
 * Nome de cada matiz da paleta (§3.4). O dono não escolhe um número: escolhe
 * "Azul". Os graus ficam no `value` e no campo oculto.
 */
const NOME_DO_MATIZ: Record<number, string> = {
  0: 'Vermelho',
  30: 'Laranja',
  60: 'Amarelo',
  90: 'Verde-limão',
  120: 'Verde',
  150: 'Esmeralda',
  180: 'Turquesa',
  210: 'Azul',
  240: 'Anil',
  270: 'Roxo',
  300: 'Magenta',
  330: 'Rosa',
};

/** O mesmo L e o mesmo croma travados que a marca usa na tela pública. */
function corDoMatiz(matiz: number): string {
  return `oklch(0.45 0.09 ${matiz})`;
}

type Loja = {
  name: string;
  slotMinutes: number;
  minLeadMinutes: number;
  maxAdvanceDays: number;
  timeZone: string;
  accentHue: number | null;
};

export function SettingsForm({ loja }: { loja: Loja }) {
  const [state, formAction, pending] = useActionState(saveSettingsAction, ESTADO_INICIAL);
  const [matiz, setMatiz] = useState<number | null>(loja.accentHue);

  return (
    <form action={formAction} className="flex max-w-[520px] flex-col gap-3">
      <Campo rotulo="Nome da barbearia">
        <input name="name" defaultValue={loja.name} required minLength={2} />
      </Campo>

      <Campo rotulo="Fuso horário">
        <select name="timeZone" defaultValue={loja.timeZone} required>
          {FUSOS_BRASIL.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
      </Campo>

      <Campo rotulo="Grade de horários (minutos)">
        <select name="slotMinutes" defaultValue={loja.slotMinutes} required>
          {GRADES_PERMITIDAS.map((g) => (
            <option key={g} value={g}>
              {g} min
            </option>
          ))}
        </select>
      </Campo>

      <Campo rotulo="Antecedência mínima (minutos)">
        <input
          name="minLeadMinutes"
          type="number"
          inputMode="numeric"
          min={0}
          defaultValue={loja.minLeadMinutes}
          required
        />
      </Campo>

      <Campo rotulo="Janela máxima de agendamento (dias)">
        <input
          name="maxAdvanceDays"
          type="number"
          inputMode="numeric"
          min={1}
          max={365}
          defaultValue={loja.maxAdvanceDays}
          required
        />
      </Campo>

      {/* Doze fichas em vez de `input type="color"`: menos escolha e zero cor
          feia. O dono controla só o matiz — L e croma são travados, então
          nenhuma escolha produz botão ilegível na página pública. */}
      <fieldset className="flex flex-col gap-2">
        <legend className="pb-1 text-sm leading-5 font-bold text-tinta-2">Cor da loja</legend>
        <p className="text-sm leading-5 text-tinta-3">
          Aparece só na página que o cliente vê. Sem cor, a página fica preto e branco.
        </p>

        {/* O grupo acessível é o próprio `<fieldset>`, nomeado pela `<legend>`
            — um `role="group"` aqui dentro criaria um segundo grupo de mesmo
            nome dentro do primeiro. */}
        <div className="flex flex-wrap gap-2">
          <Botao
            type="button"
            variante="secundario"
            aria-pressed={matiz === null}
            onClick={() => setMatiz(null)}
            className={`min-h-12 ${matiz === null ? 'border-2 border-tinta font-bold' : ''}`}
          >
            Sem cor
          </Botao>

          {MATIZES_PERMITIDOS.map((h) => {
            const escolhido = matiz === h;
            return (
              <Botao
                key={h}
                type="button"
                variante="secundario"
                aria-pressed={escolhido}
                aria-label={NOME_DO_MATIZ[h]}
                title={NOME_DO_MATIZ[h]}
                onClick={() => setMatiz(h)}
                className={`min-h-12 w-12 px-0 ${escolhido ? 'border-2 border-tinta' : ''}`}
              >
                <span
                  aria-hidden="true"
                  className="h-7 w-7 rounded-cx border border-linha"
                  style={{ background: corDoMatiz(h) }}
                />
              </Botao>
            );
          })}
        </div>

        {/* Campo oculto: a server action continua lendo um FormData comum. */}
        <input type="hidden" name="accentHue" value={matiz === null ? '' : String(matiz)} />

        <p className="text-sm leading-5 text-tinta-2">
          Escolhida: <strong>{matiz === null ? 'Sem cor' : NOME_DO_MATIZ[matiz]}</strong>
        </p>
      </fieldset>

      <ErroDeAcao mensagem={state.erro} />
      {state.ok ? (
        <p role="status" className="text-sm leading-5 text-ok">
          Configurações salvas.
        </p>
      ) : null}

      <Botao type="submit" largura="total" pendente={pending} rotuloPendente="Salvando…">
        Salvar configurações
      </Botao>
    </form>
  );
}
