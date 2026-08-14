'use client';

import { useActionState, useState } from 'react';
import { ErroDeAcao } from '@/components/erro-de-acao';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Largura } from '@/components/ui/largura';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
 * As duas listas no formato que o `<Select.Root items>` da lib pede — é ele que
 * faz o `<SelectValue>` mostrar o **rótulo** do item escolhido em vez do valor
 * cru. Sem isso o disparador da grade escreveria "30" onde a lista escreve
 * "30 min".
 */
const OPCOES_DE_FUSO = FUSOS_BRASIL.map((tz) => ({ label: tz, value: tz }));
const OPCOES_DE_GRADE = GRADES_PERMITIDAS.map((g) => ({ label: `${g} min`, value: String(g) }));

/**
 * O disparador da lib nasce `w-fit` e `h-8`; aqui ele é um campo de formulário
 * em coluna, ao lado de `<input>`s que o `.campo` mede em `--altura-controle`.
 * Largura e altura são as duas únicas coisas ajustadas — o resto (borda, raio,
 * tipografia, anel de foco, seta) é o do base-nova, sem uma linha desfeita.
 *
 * **A largura volta a ser a do conteúdo a partir de `sm`.** Em 1440px estes dois
 * campos mediam 520px — a coluna inteira do card — para mostrar
 * "America/Sao_Paulo" e "30 min". Campo de escolher não é campo de digitar: o
 * teto de `formulario` existe para linha de texto que o olho percorre, e num
 * disparador ele só afasta a seta do rótulo escolhido. Abaixo de `sm` continua
 * largura total, onde a coluna é uma só e controle estreito no meio do vazio
 * fica pior do que largo.
 *
 * É `max-w-fit`, e não `w-fit`, por causa do `*:w-full` que o `Field` do
 * base-nova põe em todo filho direto: contra ele, `w-fit` empata em
 * especificidade e o resultado passa a depender da ordem em que o Tailwind
 * gerar as duas regras. `max-width` é outra propriedade, não disputa com
 * ninguém, e deixa o `width: 100%` valendo inteiro no celular.
 *
 * Elas vêm por aqui, e não do `<Campo>`: o `Campo` clona o filho com `id` e
 * `className`, e o `Select.Root` só aceita o `id` (que ele repassa ao
 * disparador, o que mantém o `htmlFor` do rótulo funcionando). O resto do que o
 * `Campo` injeta cai no chão — **quem puser `dica` ou `erro` num destes dois
 * campos precisa levar o `aria-describedby` até o `<SelectTrigger>` na mão.**
 */
const DISPARADOR = 'min-h-[var(--altura-controle)] w-full sm:max-w-fit';

/**
 * O rótulo dos blocos que não são campo. O endereço público e a cor da loja são
 * os dois pedaços da Identidade que não têm `<label>` para carregar o nome, e
 * eles precisam pesar **menos** que o `CardTitle` da seção — senão a tela passa
 * a ter dois níveis de título competindo dentro do mesmo card.
 */
const MICRO_ROTULO = 'text-sm leading-5 font-bold text-tinta-2';

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

/**
 * As configurações da loja em duas seções com título, e não em sete campos
 * soltos numa fila só: *Identidade* é o que o cliente vê da barbearia, *Regras
 * da agenda* é o que decide quando dá para marcar. O corte é o que o próprio
 * subtítulo da tela anuncia.
 *
 * `linkPublico` é opcional porque só o servidor sabe montá-lo (`env.APP_URL` +
 * slug) — quem monta este formulário em teste passa apenas a loja, e sem
 * endereço o bloco simplesmente não aparece. A única tela que o usa passa o
 * valor.
 */
export function SettingsForm({ loja, linkPublico }: { loja: Loja; linkPublico?: string }) {
  const [state, formAction, pending] = useActionState(saveSettingsAction, ESTADO_INICIAL);
  const [matiz, setMatiz] = useState<number | null>(loja.accentHue);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Identidade</CardTitle>
        </CardHeader>
        {/* O card ocupa a largura de leitura da tela, mas cada campo para nos
            520px da régua: linha de input larga demais faz o olho perder o
            começo ao voltar. */}
        <CardContent className="flex flex-col gap-4">
          <Largura tipo="formulario">
            <Campo rotulo="Nome da barbearia">
              <input name="name" defaultValue={loja.name} required minLength={2} />
            </Campo>
          </Largura>

          {/* O endereço não é campo de preencher: é para ler e copiar, e por
              isso é o único bloco daqui que usa a largura inteira do card —
              apertado em 520px o slug longo quebra sem precisar. */}
          {linkPublico ? (
            <div className="flex flex-col gap-1">
              <p className={MICRO_ROTULO}>Endereço público</p>
              {/* `break-all` porque o slug pode ser longo e em 360px o endereço
                  é a única coisa da tela que não tem onde quebrar. */}
              <code className="block break-all text-base leading-6">{linkPublico}</code>
            </div>
          ) : null}

          {/* Doze fichas em vez de `input type="color"`: menos escolha e zero
              cor feia. O dono controla só o matiz — L e croma são travados,
              então nenhuma escolha produz botão ilegível na página pública.

              O teto de `formulario` passou a envolver o `<fieldset>` inteiro, e
              não só a grade de fichas: desde que a régua ganhou `mx-auto`, um
              bloco de 520px dentro do card de 1120 fica centrado, e com a
              `<legend>` e o "Escolhida:" de fora sobrava um bloco de fichas
              deslocado do próprio rótulo. Com todo mundo dentro do mesmo teto,
              o pedaço anda inteiro — não importa se centrado ou à esquerda. */}
          <Largura tipo="formulario">
            {/* O grupo acessível é o próprio `<fieldset>`, nomeado pela
                `<legend>` — um `role="group"` aqui dentro criaria um segundo
                grupo de mesmo nome dentro do primeiro. */}
            <fieldset className="flex flex-col gap-2">
              <legend className={`pb-1 ${MICRO_ROTULO}`}>Cor da loja</legend>
              <p className="text-sm leading-5 text-tinta-3">
                Aparece só na página que o cliente vê. Sem cor, a página fica preto e branco.
              </p>

              {/* Nenhuma das treze fichas carrega altura própria: ficha é
                  controle, e controle mede `--altura-controle` (36px) desde
                  13/08/2026 — a mesma régua do botão, do campo e da
                  `fichas-de-escolha`. O `min-h-12` que estava aqui era a
                  "altura de balcão" de 48px da direção velha, e deixava aqui a
                  única fileira de 48px de uma tela inteira de 36. */}
              <Botao
                type="button"
                variante="secundario"
                aria-pressed={matiz === null}
                onClick={() => setMatiz(null)}
                className={`self-start ${matiz === null ? 'border-2 border-tinta font-bold' : ''}`}
              >
                Sem cor
              </Botao>

              {/* Grade de colunas fixas, e não `flex-wrap`: com as fichas
                  quebrando por conta própria a segunda linha começava fora do
                  alinhamento da primeira. Doze cabem exatas em 4 colunas no
                  celular e em 6 no resto — nenhuma linha sobra torta. */}
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
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
                      className={`w-full px-0 ${escolhido ? 'border-2 border-tinta' : ''}`}
                    >
                      {/* 24px, e não os 28px de antes: a ficha desceu de 48 para
                          36, e a borda de 2px da escolhida come mais 4 — com o
                          quadrado velho sobrava 1px de cada lado e a cor
                          encostava na moldura. */}
                      <span
                        aria-hidden="true"
                        className="h-6 w-6 rounded-cx border border-linha"
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
          </Largura>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Regras da agenda</CardTitle>
        </CardHeader>
        {/* Quatro campos curtos em duas colunas: em coluna única eles deixavam
            o card com três quartos vazios à direita.

            **A quebra é em `lg`, não em `md`.** Entre 768 e ~900px a coluna
            mede 212–278px, e aí "Janela máxima de agendamento (dias)" quebra em
            duas linhas enquanto o vizinho de linha fica em uma — as duas caixas
            da mesma linha param em alturas diferentes. Em `lg` a coluna mais
            estreita já é de 340px, onde o rótulo mais longo cabe inteiro.

            Cada campo continua com o teto de `formulario`, como no card de
            cima: na largura de leitura a coluna dá 536px, acima dos 520 da
            régua, e sem o teto o campo passaria a depender de o degrau
            `leitura` nunca mudar de número. */}
        <CardContent className="grid gap-4 lg:grid-cols-2">
          {/* Os dois `<select>` nativos viraram o `Select` do shadcn. O `name`
              fica no `<Select>`, e **não** há campo oculto ao lado: o
              `Select.Root` do base-ui já emite sozinho um `<input>` de verdade
              com esse `name` e o valor serializado, então
              `Object.fromEntries(formData)` na server action continua vendo
              `timeZone` e `slotMinutes` como antes. Repetir o nome num
              `<input type="hidden">` mandaria o campo duas vezes — é o mesmo
              defeito que `fichas-de-escolha.tsx` documenta no RadioGroup, e a
              regra é a de lá: quem já emite o campo não ganha oculto. */}
          <Largura tipo="formulario">
            <Campo rotulo="Fuso horário">
              <Select name="timeZone" items={OPCOES_DE_FUSO} defaultValue={loja.timeZone} required>
                <SelectTrigger className={DISPARADOR}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OPCOES_DE_FUSO.map((opcao) => (
                    <SelectItem key={opcao.value} value={opcao.value}>
                      {opcao.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>
          </Largura>

          <Largura tipo="formulario">
            <Campo rotulo="Grade de horários (minutos)">
              <Select
                name="slotMinutes"
                items={OPCOES_DE_GRADE}
                defaultValue={String(loja.slotMinutes)}
                required
              >
                <SelectTrigger className={DISPARADOR}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OPCOES_DE_GRADE.map((opcao) => (
                    <SelectItem key={opcao.value} value={opcao.value}>
                      {opcao.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>
          </Largura>

          <Largura tipo="formulario">
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
          </Largura>

          <Largura tipo="formulario">
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
          </Largura>
        </CardContent>
      </Card>

      {/* Recado e envio acompanham a largura de campo: botão de 1120px não é
          botão, é faixa. */}
      <Largura tipo="formulario" className="flex flex-col gap-3">
        <ErroDeAcao mensagem={state.erro} />
        {state.ok ? (
          <p role="status" className="text-sm leading-5 text-ok">
            Configurações salvas.
          </p>
        ) : null}

        {/* No desktop ele nem chega nos 520: formulário de coluna única tem um
            envio só, e botão que atravessa a coluna inteira vira faixa de novo,
            só que menor. `sm:w-auto` desfaz o `w-full` do `largura="total"` e
            `sm:self-start` é o par obrigatório dele — sem isso o `align-items:
            stretch` desta coluna estica o botão de volta, porque `width: auto`
            em item de flex é justamente o caso em que o stretch manda. Abaixo de
            `sm` continua largura total, que é o alvo que o polegar quer. */}
        <Botao
          type="submit"
          largura="total"
          pendente={pending}
          rotuloPendente="Salvando…"
          className="sm:w-auto sm:self-start"
        >
          Salvar configurações
        </Botao>
      </Largura>
    </form>
  );
}
