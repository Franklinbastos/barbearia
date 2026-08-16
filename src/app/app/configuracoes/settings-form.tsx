'use client';

import { useActionState, useId, useState, type ReactNode } from 'react';
import { Check } from 'lucide-react';

import { cn } from '@/lib/utils';
import { ErroDeAcao } from '@/components/erro-de-acao';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';
import { SecaoDeAjustes } from '@/components/ui/secao-de-ajustes';
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
 * O rótulo dos blocos que não são campo. A cor da loja e o fuso recolhido são os
 * dois pedaços do formulário que não têm `<label>` para carregar o nome, e eles
 * precisam pesar **menos** que o `<h2>` da `SecaoDeAjustes` — senão a tela passa
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

/**
 * A mesma pele do `FieldDescription` que o `Campo` usa nas suas dicas. Existe
 * porque uma das dicas precisa ser escrita fora do `Campo` — ver o comentário
 * da grade de horários.
 */
const DICA = 'text-sm leading-5 text-muted-foreground';

/**
 * O `<form>` **não envolve os campos**: ele é só a barra do salvar, e cada campo
 * se amarra nele pelo atributo `form` do HTML.
 *
 * O motivo é a ordem da tela. A §2.3 pede identidade → link → regras, porque o
 * link deriva da identidade (o slug nasce do nome), e o link é justamente o
 * bloco que a §2.4 manda deixar **fora** do formulário — copiar age na hora, o
 * submit age depois, e quem clica em copiar e sai da tela acha que salvou. Com
 * o `<form>` envolvendo tudo, uma das duas regras teria que cair: ou o link
 * entra no formulário, ou vai para o fim da página.
 *
 * O atributo `form` existe exatamente para isso — é o que o próprio React usa
 * quando precisa injetar o valor do botão que enviou (`createFormDataWithSubmitter`
 * escreve `form=` num input temporário), e o `Select` do base-ui documenta a
 * prop com estas palavras: *"Identifies the form that owns the hidden input.
 * Useful when the select is rendered outside the form"*. O `FormData` é montado
 * a partir de `form.elements`, que inclui os campos associados por atributo, e
 * a `saveSettingsAction` continua lendo o mesmo `FormData` de sempre.
 *
 * **Quem puser campo novo aqui precisa levar este `form=` junto.** Sem ele o
 * campo fica na tela, parece salvar e não chega na action — que é o defeito
 * silencioso mais caro desta tela. `settings-form.test.tsx` tem caso amarrando
 * todos os nomes de campo ao formulário por causa disso.
 *
 * É literal, e não `useId()`: o id precisa ser o mesmo do servidor ao cliente e
 * há um só formulário de configurações por página — o mesmo padrão do
 * `#formulario-de-encaixe` da agenda, que o e2e já endereça pelo nome.
 */
const ID_DO_FORMULARIO = 'formulario-de-configuracoes';

const MINUTOS_NO_DIA = 24 * 60;
/** O corte das 16h é o exemplo da spec (§1.5), e o que a Mangomint usa. */
const EXEMPLO_EM_MINUTOS = 16 * 60;

/**
 * "60 min — para marcar às 16h, o cliente precisa fechar até 15h".
 *
 * Quatro dos seis produtos pesquisados explicam antecedência com um caso
 * concreto, e nenhum deles explica com o número sozinho (§1.5).
 *
 * A volta de dia não é preciosismo: o campo aceita até 10080 minutos (sete
 * dias), e a subtração crua escrevia "até -8h00" para qualquer antecedência
 * acima de 16 horas.
 */
function dicaDaAntecedencia(minutos: number): string {
  if (minutos <= 0) return 'Sem antecedência: o cliente marca até a hora do corte.';

  const diasAntes = Math.max(0, Math.ceil((minutos - EXEMPLO_EM_MINUTOS) / MINUTOS_NO_DIA));
  const prazo = EXEMPLO_EM_MINUTOS - minutos + diasAntes * MINUTOS_NO_DIA;
  const hora = Math.floor(prazo / 60);
  const minuto = prazo % 60;
  const relogio = minuto === 0 ? `${hora}h` : `${hora}h${String(minuto).padStart(2, '0')}`;
  const dia =
    diasAntes === 0 ? '' : diasAntes === 1 ? ' do dia anterior' : ` de ${diasAntes} dias antes`;

  return `${minutos} min — para marcar às 16h, o cliente precisa fechar até ${relogio}${dia}`;
}

/**
 * Lê o número que está no campo sem deixar o estado quebrar enquanto se digita:
 * `<input type="number">` vazio devolve `NaN`, e a dica não pode virar "NaN min"
 * no meio de uma troca de valor. Vazio mantém a última leitura boa.
 */
function numeroDigitado(valor: string, anterior: number): number {
  const n = Number(valor);
  return valor === '' || Number.isNaN(n) ? anterior : n;
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
 * O link público, que era renderizado aqui, agora é um componente separado
 * (`LinkDeAgendamento`) para ficar fora do formulário — copiar age na hora, o
 * submit age depois, e misturar faz a pessoa achar que salvou. Ele **entra pelo
 * meio**, entre as duas seções, porque a ordem da tela é identidade → link →
 * regras (§2.3): o slug nasce do nome, então o link vem logo depois de quem o
 * gera. Quem monta o bloco é a página; aqui ele só é posicionado, e continua
 * fora do `<form>` graças ao `ID_DO_FORMULARIO`.
 */
export function SettingsForm({
  loja,
  linkDeAgendamento,
}: {
  loja: Loja;
  /** O bloco do link, renderizado entre "Identidade" e "Regras da agenda". */
  linkDeAgendamento?: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(saveSettingsAction, ESTADO_INICIAL);
  const [matiz, setMatiz] = useState<number | null>(loja.accentHue);

  /**
   * O fuso mora em estado, e **não** no `defaultValue` do `Select`. O
   * disparador sai da árvore quando o "alterar" fecha, e com ele iria embora a
   * escolha recém-feita — a pessoa trocaria o fuso, recolheria o bloco e
   * salvaria o valor antigo sem nada avisando. Quem leva o valor para a action
   * é o campo oculto, que fica montado esteja o bloco aberto ou fechado.
   */
  const [fuso, setFuso] = useState(loja.timeZone);
  const [fusoAberto, setFusoAberto] = useState(false);

  /**
   * As duas dicas com número acompanham o que está digitado, não o que está
   * salvo: quem troca 60 por 30 espera ler 15h30 na frase, não 15h.
   */
  const [antecedencia, setAntecedencia] = useState(loja.minLeadMinutes);
  const [janela, setJanela] = useState(loja.maxAdvanceDays);

  const idDoFuso = useId();
  const idDaDicaDaGrade = useId();

  return (
    // Fragmento, e não um `<div>`: quem dá a coluna e os 16px entre as seções é
    // a `<Largura>` da página. Um invólucro aqui só somaria um nível de flex
    // para repetir o mesmo `gap`.
    <>
      <SecaoDeAjustes titulo="Identidade">
        {/* O card ocupa a largura de leitura da tela, mas cada campo para nos
            520px da régua: linha de input larga demais faz o olho perder o
            começo ao voltar. */}
        <div className="flex flex-col gap-4">
          <Largura tipo="formulario" className="mx-0">
            <Campo rotulo="Nome da barbearia">
              <input
                name="name"
                form={ID_DO_FORMULARIO}
                defaultValue={loja.name}
                required
                minLength={2}
              />
            </Campo>
          </Largura>

          {/* Doze fichas em vez de `input type="color"`: menos escolha e zero
              cor feia. O dono controla só o matiz — L e croma são travados,
              então nenhuma escolha produz botão ilegível na página pública.

              O teto de `formulario` passou a envolver o `<fieldset>` inteiro, e
              não só a grade de fichas: desde que a régua ganhou `mx-auto`, um
              bloco de 520px dentro do card de 1120 fica centrado, e com a
              `<legend>` e o "Escolhida:" de fora sobrava um bloco de fichas
              deslocado do próprio rótulo. Com todo mundo dentro do mesmo teto,
              o pedaço anda inteiro — não importa se centrado ou à esquerda. */}
          <Largura tipo="formulario" className="mx-0">
            {/* O grupo acessível é o próprio `<fieldset>`, nomeado pela
                `<legend>` — um `role="group"` aqui dentro criaria um segundo
                grupo de mesmo nome dentro do primeiro. */}
            <fieldset className="flex flex-col gap-2">
              <legend className={`pb-1 ${MICRO_ROTULO}`}>Cor da loja</legend>
              <p className="text-sm leading-5 text-tinta-3">
                Aparece só na página que o cliente vê. Sem cor, a página fica preto e branco.
              </p>

              {/* Grade de colunas fixas, e não `flex-wrap`: com as fichas
                  quebrando por conta própria a segunda linha começava fora do
                  alinhamento da primeira.

                  **A ficha é a cor**, e não uma moldura de 80×36 com a cor num
                  círculo de 16px lá dentro (§1.4): a informação era o detalhe.

                  **"Sem cor" é a 13ª, e vem primeiro.** Flutuando acima, numa
                  linha só dela, ela começava em x=588 enquanto as doze de baixo
                  começavam em x=424 — é o desalinhamento medido em 16/08.

                  A altura continua sendo a do `Botao` (36px, `--altura-controle`):
                  ficha é controle, e controle mede a mesma coisa que o campo e o
                  botão desde 13/08/2026. */}
              <div data-slot="fichas-de-cor" className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                <Botao
                  type="button"
                  variante="secundario"
                  aria-pressed={matiz === null}
                  onClick={() => setMatiz(null)}
                  className={cn('w-full px-0', matiz === null && 'border-2 border-tinta font-bold')}
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
                      className={cn('w-full px-0 text-white', escolhido && 'border-2 border-tinta')}
                      style={{ backgroundColor: corDoMatiz(h) }}
                    >
                      {/* Quem marca a escolhida é o ✓, não a borda. Em `--tinta`
                          sobre um fundo de L=0.45 a borda quase some no tema
                          claro, e aí a única diferença entre a ficha escolhida e
                          as outras onze seria a cor — que é justamente o que a
                          pessoa está tentando comparar. */}
                      {escolhido ? <Check aria-hidden="true" /> : null}
                    </Botao>
                  );
                })}
              </div>

              {/* Campo oculto: a server action continua lendo um FormData comum. */}
              <input
                type="hidden"
                name="accentHue"
                form={ID_DO_FORMULARIO}
                value={matiz === null ? '' : String(matiz)}
              />

              <p className="text-sm leading-5 text-tinta-2">
                Escolhida: <strong>{matiz === null ? 'Sem cor' : NOME_DO_MATIZ[matiz]}</strong>
              </p>
            </fieldset>
          </Largura>
        </div>
      </SecaoDeAjustes>

      {linkDeAgendamento}

      <SecaoDeAjustes
        titulo="Regras da agenda"
        descricao="Quando o cliente consegue marcar, e com quanta antecedência."
      >
        {/* Três campos curtos em duas colunas, e o fuso ocupando a linha
            inteira embaixo: em coluna única eles deixavam o card com três
            quartos vazios à direita.

            **A quebra é em `lg`, não em `md`.** Entre 768 e ~900px a coluna
            mede 212–278px, e aí "Até quando o cliente pode marcar" quebra em
            duas linhas enquanto o vizinho de linha fica em uma — as duas caixas
            da mesma linha param em alturas diferentes. Em `lg` a coluna mais
            estreita já é de 340px, onde o rótulo mais longo cabe inteiro.

            Cada campo continua com o teto de `formulario`, como no card de
            cima: na largura de leitura a coluna dá 536px, acima dos 520 da
            régua, e sem o teto o campo passaria a depender de o degrau
            `leitura` nunca mudar de número. */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* A dica desta não vai pela prop `dica` do `Campo`, e é de propósito:
              o cabeçalho do `campo.tsx` avisa que o `aria-describedby` injetado
              lá morre no `Select.Root`, que só repassa o `id` ao disparador.
              Dica escrita à mão e amarrada no `SelectTrigger` é o que aquele
              comentário manda fazer — sem isso a frase fica na tela e some para
              quem ouve. */}
          <Largura tipo="formulario" className="mx-0 flex flex-col gap-2">
            <Campo rotulo="Grade de horários">
              <Select
                name="slotMinutes"
                form={ID_DO_FORMULARIO}
                items={OPCOES_DE_GRADE}
                defaultValue={String(loja.slotMinutes)}
                required
              >
                <SelectTrigger className={DISPARADOR} aria-describedby={idDaDicaDaGrade}>
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
            <p id={idDaDicaDaGrade} className={DICA}>
              De quanto em quanto tempo os horários aparecem para o cliente.
            </p>
          </Largura>

          <Largura tipo="formulario" className="mx-0">
            <Campo rotulo="Antecedência mínima" dica={dicaDaAntecedencia(antecedencia)}>
              <input
                name="minLeadMinutes"
                form={ID_DO_FORMULARIO}
                type="number"
                inputMode="numeric"
                min={0}
                defaultValue={loja.minLeadMinutes}
                onChange={(evento) =>
                  setAntecedencia((atual) => numeroDigitado(evento.target.value, atual))
                }
                required
              />
            </Campo>
          </Largura>

          <Largura tipo="formulario" className="mx-0">
            <Campo
              rotulo="Até quando o cliente pode marcar"
              dica={`${janela} ${janela === 1 ? 'dia' : 'dias'} à frente`}
            >
              <input
                name="maxAdvanceDays"
                form={ID_DO_FORMULARIO}
                type="number"
                inputMode="numeric"
                min={1}
                max={365}
                defaultValue={loja.maxAdvanceDays}
                onChange={(evento) => setJanela((atual) => numeroDigitado(evento.target.value, atual))}
                required
              />
            </Campo>
          </Largura>

          {/* O fuso desce para o rodapé da seção, atrás de um "alterar".
              Nenhum produto de salão trata fuso como preferência (§1.1): a
              Booksy não deixa o dono mexer e a Vagaro não tem o campo. Aqui ele
              fica alcançável sem estar no caminho — e quando o endereço da loja
              entrar, o fuso passa a ser derivado dele e o "alterar" some.

              **O campo oculto fica fora do `fusoAberto`, e é o único
              `name="timeZone"` do formulário.** Se o valor viajasse no `Select`,
              recolher o bloco tiraria o campo do `<form>`: a action receberia
              `timeZone` ausente e a barbearia que não é de São Paulo perderia a
              configuração. O `Select` daqui só pinta a escolha; quem a carrega é
              o estado. Nomear os dois mandaria o campo duas vezes — o mesmo
              defeito que a `fichas-de-escolha.tsx` documenta. */}
          <div className="col-span-full flex flex-col gap-2 border-t border-linha pt-6">
            <div className="flex items-start justify-between gap-4">
              {/* Fechado é texto, aberto é campo, nunca os dois: o rótulo do
                  `Campo` já escreve "Fuso horário", e mantê-lo acima repetiria a
                  palavra duas vezes na mesma linha. */}
              {fusoAberto ? (
                <Largura tipo="formulario" id={idDoFuso} className="mx-0 min-w-0 flex-1">
                  <Campo rotulo="Fuso horário">
                    <Select
                      items={OPCOES_DE_FUSO}
                      value={fuso}
                      onValueChange={(novo) => setFuso(String(novo ?? loja.timeZone))}
                    >
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
              ) : (
                <div className="flex min-w-0 flex-col gap-1">
                  <p className={MICRO_ROTULO}>Fuso horário</p>
                  <p className="text-sm leading-5 text-tinta-2">{fuso}</p>
                </div>
              )}

              <Botao
                type="button"
                variante="texto"
                aria-expanded={fusoAberto}
                aria-controls={fusoAberto ? idDoFuso : undefined}
                aria-label={fusoAberto ? 'Ocultar o fuso horário' : 'Alterar o fuso horário'}
                onClick={() => setFusoAberto((aberto) => !aberto)}
                className="shrink-0"
              >
                {fusoAberto ? 'Ocultar' : 'Alterar'}
              </Botao>
            </div>

            <input type="hidden" name="timeZone" form={ID_DO_FORMULARIO} value={fuso} />
          </div>
        </div>
      </SecaoDeAjustes>

      {/* Só existe quando há o que dizer. Montado sempre, o bloco vazio ainda
          consumia dois `gap-4` da coluna e abria 32px de nada entre o último
          campo e a barra. */}
      {state.erro || state.ok ? (
        <Largura tipo="formulario" className="mx-0 flex flex-col gap-3">
          <ErroDeAcao mensagem={state.erro} />
          {state.ok ? (
            <p role="status" className="text-sm leading-5 text-ok">
              Configurações salvas.
            </p>
          ) : null}
        </Largura>
      ) : null}

      {/* Barra fixa no celular, estática no desktop — o mesmo padrão do
          `contact-step.tsx`, com o `--sombra-barra` que a §3.6 reserva para
          barra fixa de ação. É reuso, não invenção.

          `-mx-3`, e não os `-mx-4` de lá: a margem negativa tem que valer
          exatamente o recheio da casca, e a do painel é `p-3`. Com 16px a barra
          passava 4px de cada lado da janela, e em 360px a tela rolava de lado —
          que é o que o e2e de acabamento proíbe.

          `md:pt-8` são os 32px que, somados aos 16 do `gap-4` da coluna da
          página, fecham os 48px que o Carbon pede entre o último campo e o
          botão. No celular quem dá o respiro é a barra descolar do conteúdo.

          **A barra é o `<form>`** — ver o comentário do `ID_DO_FORMULARIO`. Os
          campos moram nas seções acima e se amarram aqui pelo atributo `form`,
          que é o que deixa o link de agendamento passar pelo meio da tela sem
          entrar no formulário. */}
      <form
        id={ID_DO_FORMULARIO}
        action={formAction}
        className="sticky bottom-0 -mx-3 border-t border-linha bg-bg px-3 pt-3 shadow-[var(--sombra-barra)] md:static md:mx-0 md:flex md:justify-start md:border-0 md:px-0 md:pt-8 md:shadow-none"
        style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom))' }}
      >
        {/* No desktop ele nem chega nos 520: formulário de coluna única tem um
            envio só, e botão que atravessa a coluna inteira vira faixa de novo,
            só que menor. `md:w-auto` desfaz o `w-full` do `largura="total"` e
            `md:self-start` é o par obrigatório dele — sem isso o `align-items:
            stretch` desta coluna estica o botão de volta, porque `width: auto`
            em item de flex é justamente o caso em que o stretch manda. Abaixo de
            `md` continua largura total, que é o alvo que o polegar quer. */}
        <Botao
          type="submit"
          largura="total"
          pendente={pending}
          rotuloPendente="Salvando…"
          className="md:w-auto md:self-start"
        >
          Salvar configurações
        </Botao>
      </form>
    </>
  );
}
