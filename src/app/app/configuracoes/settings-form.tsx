'use client';

import { useActionState, useId, useState, type ReactNode } from 'react';

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


/**
 * As duas listas no formato que o `<Select.Root items>` da lib pede — é ele que
 * faz o `<SelectValue>` mostrar o **rótulo** do item escolhido em vez do valor
 * cru. Sem isso o disparador da grade escreveria "30" onde a lista escreve
 * "30 min".
 */
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
 * "Sem cor" precisa de um valor de string porque `Select` não carrega `null`, e
 * string vazia é o que o base-ui usa para "nada escolhido" — o que apagaria a
 * diferença entre *escolher* preto-e-branco e *não ter escolhido*. Vira `''` de
 * volta no campo oculto, que é o que a server action lê.
 */
const SEM_COR = 'sem-cor';

const OPCOES_DE_COR: { value: string; label: string }[] = [
  { value: SEM_COR, label: 'Sem cor (preto e branco)' },
  ...MATIZES_PERMITIDOS.map((h) => ({ value: String(h), label: NOME_DO_MATIZ[h]! })),
];

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

/**
 * A janela de alterar/cancelar é apresentada em HORAS (24h lê melhor que 1440 min), mas o
 * banco guarda minutos — o campo oculto leva `minChangeMinutes = horas × 60`.
 */
function dicaDaJanelaDeMudanca(horas: number): string {
  if (horas <= 0) return 'Sem prazo: o cliente altera ou cancela até a hora do corte.';
  return `${horas}h de antecedência — dentro desse prazo o cliente não mexe pelo chat; `
    + 'o bot passa a conversa para uma pessoa.';
}

type Loja = {
  name: string;
  slotMinutes: number;
  minLeadMinutes: number;
  maxAdvanceDays: number;
  minChangeMinutes: number;
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
  // Só leitura: o fuso vem do cadastro (o navegador o informa) e a tela não o
  // oferece mais. O estado existe porque o campo oculto precisa de um valor, e
  // ele é o que veio do banco.
  const fuso = loja.timeZone;

  /**
   * As duas dicas com número acompanham o que está digitado, não o que está
   * salvo: quem troca 60 por 30 espera ler 15h30 na frase, não 15h.
   */
  const [antecedencia, setAntecedencia] = useState(loja.minLeadMinutes);
  const [janela, setJanela] = useState(loja.maxAdvanceDays);
  const [horasMudanca, setHorasMudanca] = useState(Math.round(loja.minChangeMinutes / 60));

  const idDaDicaDaGrade = useId();
  const idDaDicaDaCor = useId();

  return (
    // Fragmento, e não um `<div>`: quem dá a coluna e os 16px entre as seções é
    // a `<Largura>` da página. Um invólucro aqui só somaria um nível de flex
    // para repetir o mesmo `gap`.
    <>
      {/* Uma seção só, a pedido do dono. Eram três blocos com título — o
          padrão de "settings page" do Polaris —, mas com sete campos os três
          títulos gastavam mais altura do que organizavam: a tela inteira cabe
          numa dobra e o olho não precisa de placa para achar sete coisas.

          A divisória entre identidade e regras fica, porque ela **separa sem
          gastar linha**: são dois assuntos, e o dono mexe num sem olhar o
          outro. */}
      <SecaoDeAjustes titulo="Configurações">
        {/* O card ocupa a largura de leitura da tela, mas cada campo para nos
            520px da régua: linha de input larga demais faz o olho perder o
            começo ao voltar. */}
        {/* Nome e cor na mesma linha a partir de 640px: são as duas coisas que
            o cliente vê, e o dono confere as duas de uma olhada. Meio a meio,
            a pedido do dono: os dois campos dividem a largura da seção em vez de
            o nome comer o que sobra. */}
        <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
          {/* Sem o teto de `formulario` aqui: quem limita agora é a coluna de
              metade da seção, que em 880px dá ~420px — abaixo dos 520 da régua. */}
          <div>
            <Campo rotulo="Nome da barbearia">
              <input
                name="name"
                form={ID_DO_FORMULARIO}
                defaultValue={loja.name}
                required
                minLength={2}
              />
            </Campo>
          </div>

          {/* Treze fichas viraram um `Select`, a pedido do dono: elas ocupavam
              três linhas do card para uma escolha que se faz uma vez na vida.

              O que **não** muda é o que a §3.4 guarda: o valor continua sendo um
              matiz de 0 a 360, com L e croma travados em `oklch(0.45 0.09 H)`.
              Nada de `input type="color"` — o mercado dá hex livre e por isso
              precisa avisar sobre contraste (o Cal.com roda checagem WCAG a cada
              mudança); aqui nenhuma escolha produz botão ilegível, porque a
              escolha é só o matiz.

              A cor viaja no `value` do `Select`, mas quem a envia é o campo
              oculto — mesma razão do fuso: `Select` recolhido tira o campo do
              `<form>` e o valor some no submit. Nomear os dois mandaria o campo
              duas vezes, que é o defeito que a `fichas-de-escolha.tsx` documenta.

              A dica não vai pela prop `dica` do `Campo`: o cabeçalho do
              `campo.tsx` avisa que o `aria-describedby` dele morre no
              `Select.Root`. Vai à mão, amarrada no `SelectTrigger`. */}
          <div className="flex flex-col gap-2">
            <Campo rotulo="Cor da loja">
              <Select
                items={OPCOES_DE_COR}
                value={matiz === null ? SEM_COR : String(matiz)}
                onValueChange={(novo) => {
                  const escolhido = String(novo ?? SEM_COR);
                  setMatiz(escolhido === SEM_COR ? null : Number(escolhido));
                }}
              >
                <SelectTrigger
                  className="min-h-11 w-full md:min-h-9"
                  aria-describedby={idDaDicaDaCor}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OPCOES_DE_COR.map((opcao) => (
                    <SelectItem key={opcao.value} value={opcao.value}>
                      <span className="flex items-center gap-2">
                        {/* `aria-hidden` porque o nome do matiz está escrito ao
                            lado — sem isso o leitor de tela anunciaria a mesma
                            cor duas vezes. O contorno existe para o "Sem cor"
                            não sumir no fundo do menu. */}
                        <span
                          aria-hidden="true"
                          className="size-4 shrink-0 rounded-full border border-linha"
                          style={
                            opcao.value === SEM_COR
                              ? undefined
                              : { backgroundColor: corDoMatiz(Number(opcao.value)) }
                          }
                        />
                        {opcao.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>

            <input
              type="hidden"
              name="accentHue"
              form={ID_DO_FORMULARIO}
              value={matiz === null ? '' : String(matiz)}
            />

            <p id={idDaDicaDaCor} className={DICA}>
              Aparece só na página que o cliente vê.
            </p>
          </div>
        </div>
        {linkDeAgendamento}

        {/* A divisória é o que sobrou dos títulos: separa identidade de regras
            sem gastar uma faixa de 24px para escrever o óbvio. */}
        <div className="border-t border-linha pt-6">
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

          {/* Janela de alterar/cancelar pelo chat, em HORAS. O input visível não tem `name`
              (é só a interface); quem leva o valor à action é o campo oculto, em minutos —
              mesmo padrão do fuso e da cor, e o que o banco (`min_change_minutes`) guarda. */}
          <Largura tipo="formulario" className="mx-0">
            <Campo
              rotulo="Antecedência para alterar ou cancelar"
              dica={dicaDaJanelaDeMudanca(horasMudanca)}
            >
              <input
                type="number"
                inputMode="numeric"
                min={0}
                defaultValue={Math.round(loja.minChangeMinutes / 60)}
                onChange={(evento) =>
                  setHorasMudanca((atual) => numeroDigitado(evento.target.value, atual))
                }
              />
            </Campo>
            <input
              type="hidden"
              name="minChangeMinutes"
              form={ID_DO_FORMULARIO}
              value={horasMudanca * 60}
            />
          </Largura>

          {/* O fuso não aparece: ele é capturado do navegador no cadastro
              (`signup/page.tsx` manda `Intl.DateTimeFormat().resolvedOptions()`),
              que é o que Calendly, Cal.com e Acuity fazem. Uma barbearia tem um
              endereço e nunca muda de fuso — a Booksy nem deixa o dono mexer, a
              Vagaro não tem o campo (§1.1).

              O oculto continua aqui, e é o único `name="timeZone"`: sem ele a
              action receberia o campo ausente e gravaria o padrão por cima,
              apagando o fuso de quem não é de São Paulo. */}
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
