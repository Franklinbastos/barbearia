'use client';

import type { CSSProperties } from 'react';

import { useEffect, useRef, useState } from 'react';
import { formatDuration, formatPrice, formatTime, isoDateInZone } from '@/lib/format';
import { aplicarMascaraTelefone } from '@/lib/telefone';
import { Bloco } from '@/components/ui/bloco';
import type { EscolhaDeHorario } from '@/components/ui/grade-de-horarios';
import type { Catalog, CatalogService, Escolha, Resultado } from './types';
import { ServiceStep } from './steps/service-step';
import { StaffStep } from './steps/staff-step';
import { SlotStep } from './steps/slot-step';
import { ContactStep, lerContatoGuardado } from './steps/contact-step';
import { DoneStep } from './steps/done-step';

type Etapa = 'servico' | 'barbeiro' | 'horario' | 'contato' | 'pronto';

/**
 * As quatro etapas que o contador do cabeçalho conta. `pronto` fica de fora de
 * propósito: quando o horário está confirmado não há mais formulário para
 * medir, e o jurado-cliente pediu o contador justamente para saber quanto falta.
 */
const ETAPAS: { chave: Etapa; rotulo: string }[] = [
  { chave: 'servico', rotulo: 'Serviço' },
  { chave: 'barbeiro', rotulo: 'Barbeiro' },
  { chave: 'horario', rotulo: 'Horário' },
  { chave: 'contato', rotulo: 'Contato' },
];

/** Fragmento da faixa de resumo: texto visível + para onde ele volta. */
type FragmentoDoResumo = { chave: string; texto: string; rotulo: string; aoTocar: () => void };

/**
 * O catálogo chega pronto do Server Component: a etapa 1 sai no HTML inicial,
 * sem busca no cliente e sem tela de carregando. `telefoneDaLoja` e
 * `whatsappConfigurado` vêm do servidor junto e alimentam o rodapé de
 * identidade e a confirmação (§5.1 e §5.4 da direção de UI).
 */
export function BookingWizard({
  slug,
  catalogo,
  telefoneDaLoja,
  whatsappConfigurado,
  marca,
}: {
  slug: string;
  catalogo: Catalog;
  telefoneDaLoja: string | null;
  whatsappConfigurado: boolean;
  /** Cor da loja (§3.4). `undefined` = preto e branco, que é o padrão. */
  marca?: CSSProperties;
}) {
  const { name: nomeDaLoja, timeZone, maxAdvanceDays } = catalogo.shop;
  const [etapa, setEtapa] = useState<Etapa>('servico');
  const [escolha, setEscolha] = useState<Escolha>({});
  /**
   * O dia mora aqui, não no `SlotStep` (§5.4). O passo do horário é desmontado
   * quando o cliente vai digitar o contato: com o dia no estado local, quem
   * escolhia sexta voltava do conflito 409 olhando a grade de hoje.
   */
  const [dia, setDia] = useState(() => isoDateInZone(new Date(), timeZone));
  /**
   * Nome e telefone moram aqui pelo mesmo motivo que o dia: o `ContactStep` é
   * desmontado quando o 409 devolve o cliente à grade, e refazer os dois campos
   * logo depois de perder o horário é o momento em que se fecha a aba.
   *
   * O valor inicial vem do `localStorage` do aparelho (§5.5). Ler na
   * inicialização preguiçosa é seguro aqui: a etapa de contato nunca faz parte
   * do HTML do servidor, então não há hidratação para divergir.
   */
  const [contatoGuardado] = useState(lerContatoGuardado);
  const [nome, setNome] = useState(contatoGuardado?.nome ?? '');
  const [telefone, setTelefone] = useState(() =>
    aplicarMascaraTelefone(contatoGuardado?.telefone ?? ''),
  );
  const [avisoHorarioTomado, setAvisoHorarioTomado] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const avisoRef = useRef<HTMLDivElement>(null);

  // O aviso de conflito nasce acima da grade e, vindo do formulário de contato,
  // pode nascer fora da tela. Sem isto o cliente vê a grade se refazer sozinha
  // e não sabe por quê.
  useEffect(() => {
    if (avisoHorarioTomado) avisoRef.current?.scrollIntoView({ block: 'start' });
  }, [avisoHorarioTomado]);

  function selecionarServico(service: CatalogService) {
    setEscolha({ serviceId: service.id, serviceName: service.name });
    setEtapa('barbeiro');
  }

  function selecionarBarbeiro(staffId: string | undefined, staffName: string | undefined) {
    setEscolha((atual) => ({ ...atual, staffId, staffName }));
    setEtapa('horario');
  }

  /**
   * O barbeiro da ficha **não** sobrescreve a escolha da etapa 2.
   *
   * Com "Qualquer barbeiro" os dois lados são `undefined` e é assim que a ficha
   * sai para o servidor: quem distribui é `escolherBarbeiro`, que desempata por
   * carga. A versão anterior gravava `slot.staffId` aqui e desligava esse
   * balanceamento sem ninguém perceber.
   */
  function selecionarHorario(horario: EscolhaDeHorario) {
    setEscolha((atual) => ({
      ...atual,
      startAt: horario.startAt,
      staffId: atual.staffId ?? horario.staffId,
      staffName: atual.staffName ?? horario.staffName,
    }));
    setAvisoHorarioTomado(null);
    setEtapa('contato');
  }

  function handleSlotTaken(message: string) {
    setAvisoHorarioTomado(message);
    setEtapa('horario');
  }

  const indice = ETAPAS.findIndex((e) => e.chave === etapa);
  const emAndamento = indice >= 0;
  const numeroDaEtapa = indice + 1;
  const progresso = emAndamento ? (numeroDaEtapa / ETAPAS.length) * 100 : 100;

  const servicoEscolhido = catalogo.services.find((s) => s.id === escolha.serviceId) ?? null;

  /**
   * Faixa de resumo (§5.3): cada decisão já tomada vira um botão que volta para
   * a etapa dela. É isto que substitui o stepper clicável — mesma capacidade de
   * voltar em um toque, sem gastar altura, porque a faixa já precisava existir
   * para o cliente conferir o que escolheu.
   */
  const fragmentos: FragmentoDoResumo[] = [];

  if (servicoEscolhido && indice >= 1) {
    fragmentos.push({
      chave: 'servico',
      rotulo: 'Trocar serviço',
      texto: [
        servicoEscolhido.name,
        formatDuration(servicoEscolhido.durationMinutes),
        formatPrice(servicoEscolhido.priceCents),
      ].join(' · '),
      aoTocar: () => setEtapa('servico'),
    });
  }

  if (indice >= 2) {
    fragmentos.push({
      chave: 'barbeiro',
      rotulo: 'Trocar barbeiro',
      texto: escolha.staffName ?? 'Qualquer barbeiro',
      aoTocar: () => setEtapa('barbeiro'),
    });
  }

  if (escolha.startAt && indice >= 3) {
    fragmentos.push({
      chave: 'horario',
      rotulo: 'Trocar horário',
      texto: formatTime(escolha.startAt, timeZone),
      aoTocar: () => setEtapa('horario'),
    });
  }

  const telefoneSoDigitos = telefoneDaLoja ? telefoneDaLoja.replace(/\D/g, '') : '';

  return (
    <div className="mx-auto w-full max-w-[480px] px-4 pb-24 md:max-w-[560px]" style={marca}>
      <header className="sticky top-0 z-10 -mx-4 bg-bg">
        <div className="flex min-h-14 items-center justify-between gap-3 px-4">
          {/* O <h1> mora aqui (§5.1) porque o cabeçalho precisa do número da
              etapa, e a etapa é estado deste componente. Sai no HTML inicial. */}
          <h1 className="min-w-0 truncate text-[17px] leading-[22px] font-bold">{nomeDaLoja}</h1>
          {/* Confirmado, o contador some: não há mais formulário para medir. */}
          {emAndamento ? (
            <p className="shrink-0 text-sm leading-5 text-tinta-2">
              {numeroDaEtapa} de {ETAPAS.length} · {ETAPAS[indice].rotulo}
            </p>
          ) : null}
        </div>
        {/* Trilho de progresso: o jurado-cliente foi explícito — formulário de
            tamanho desconhecido é o que faz fechar a aba. No fim ele fecha em
            100% e troca para a cor de confirmado. */}
        <div
          role="progressbar"
          aria-label="Progresso do agendamento"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progresso}
          className="h-1 bg-superficie-2"
        >
          <div
            className={`h-1 ${emAndamento ? 'bg-marca' : 'bg-ok'}`}
            style={{ width: `${progresso}%` }}
          />
        </div>
      </header>

      {fragmentos.length > 0 ? (
        <div className="sticky top-[60px] z-10 -mx-4 flex min-h-12 flex-wrap items-center gap-x-1 border-b border-linha bg-superficie px-4">
          {fragmentos.map((fragmento, i) => (
            <span key={fragmento.chave} className="flex items-center gap-x-1">
              {i > 0 ? (
                <span aria-hidden="true" className="text-sm leading-5 text-tinta-3">
                  ·
                </span>
              ) : null}
              <button
                type="button"
                aria-label={fragmento.rotulo}
                onClick={fragmento.aoTocar}
                className="min-h-11 text-left text-sm leading-5 text-tinta-2 underline underline-offset-[3px]"
              >
                {fragmento.texto}
              </button>
            </span>
          ))}
        </div>
      ) : null}

      {avisoHorarioTomado ? (
        <div ref={avisoRef} className="mt-4 scroll-mt-[60px]">
          <Bloco tom="alerta" papel="alert">
            {avisoHorarioTomado}
          </Bloco>
        </div>
      ) : null}

      {etapa === 'servico' ? (
        <ServiceStep servicos={catalogo.services} aoEscolher={selecionarServico} />
      ) : null}

      {etapa === 'barbeiro' && escolha.serviceId ? (
        <StaffStep
          equipe={catalogo.staff}
          servicoId={escolha.serviceId}
          aoEscolher={selecionarBarbeiro}
          aoVoltar={() => setEtapa('servico')}
        />
      ) : null}

      {etapa === 'horario' && escolha.serviceId ? (
        <SlotStep
          slug={slug}
          serviceId={escolha.serviceId}
          staffId={escolha.staffId}
          timeZone={timeZone}
          maxAdvanceDays={maxAdvanceDays}
          dia={dia}
          aoTrocarDia={setDia}
          telefoneDaLoja={telefoneDaLoja}
          onSelect={selecionarHorario}
          onVoltar={() => setEtapa('barbeiro')}
        />
      ) : null}

      {etapa === 'contato' && escolha.serviceId && escolha.startAt && servicoEscolhido ? (
        <ContactStep
          slug={slug}
          serviceId={escolha.serviceId}
          serviceName={servicoEscolhido.name}
          staffId={escolha.staffId}
          staffName={escolha.staffName}
          startAt={escolha.startAt}
          durationMinutes={servicoEscolhido.durationMinutes}
          priceCents={servicoEscolhido.priceCents}
          timeZone={timeZone}
          whatsappConfigurado={whatsappConfigurado}
          nome={nome}
          telefone={telefone}
          contatoDoAparelho={Boolean(contatoGuardado?.nome || contatoGuardado?.telefone)}
          aoTrocarNome={setNome}
          aoTrocarTelefone={setTelefone}
          onDone={(r) => {
            setResultado(r);
            setEtapa('pronto');
          }}
          onSlotTaken={handleSlotTaken}
          onVoltar={() => setEtapa('horario')}
        />
      ) : null}

      {etapa === 'pronto' && resultado ? (
        <DoneStep
          resultado={resultado}
          timeZone={timeZone}
          servico={
            servicoEscolhido
              ? { nome: servicoEscolhido.name, precoCents: servicoEscolhido.priceCents }
              : undefined
          }
          whatsappConfigurado={whatsappConfigurado}
        />
      ) : null}

      {/* Rodapé de identidade (§5.1): o cliente precisa poder confirmar que é a
          barbearia certa — e falar com ela — antes de entregar o telefone. */}
      <footer className="mt-8 flex flex-col items-start gap-3 border-t border-linha pt-8">
        <p className="text-sm leading-5 text-tinta-2">{nomeDaLoja}</p>
        {telefoneSoDigitos ? (
          <a
            className="btn btn--sec"
            href={`https://wa.me/55${telefoneSoDigitos}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Falar no WhatsApp
          </a>
        ) : null}
      </footer>
    </div>
  );
}
