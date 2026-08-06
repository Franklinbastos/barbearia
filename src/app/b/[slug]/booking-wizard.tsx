'use client';

import { useEffect, useState } from 'react';
import type { Catalog, CatalogService, AvailabilitySlot, Escolha, Resultado } from './types';
import { ServiceStep } from './steps/service-step';
import { StaffStep } from './steps/staff-step';
import { SlotStep } from './steps/slot-step';
import { ContactStep } from './steps/contact-step';
import { DoneStep } from './steps/done-step';

type Etapa = 'servico' | 'barbeiro' | 'horario' | 'contato' | 'pronto';

export function BookingWizard({
  slug,
  timeZone,
  maxAdvanceDays,
}: {
  slug: string;
  timeZone: string;
  maxAdvanceDays: number;
}) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [erroCatalogo, setErroCatalogo] = useState<string | null>(null);
  const [etapa, setEtapa] = useState<Etapa>('servico');
  const [escolha, setEscolha] = useState<Escolha>({});
  const [avisoHorarioTomado, setAvisoHorarioTomado] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  async function carregarCatalogo() {
    setCatalog(null);
    setErroCatalogo(null);
    try {
      const res = await fetch(`/api/public/${slug}/catalog`);
      if (!res.ok) throw new Error('Falha ao carregar');
      setCatalog(await res.json());
    } catch {
      setErroCatalogo('Não foi possível carregar os serviços.');
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregarCatalogo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  if (erroCatalogo) {
    return (
      <div>
        <p role="alert">{erroCatalogo}</p>
        <button type="button" onClick={carregarCatalogo}>Tentar de novo</button>
      </div>
    );
  }

  if (!catalog) {
    return <p>Carregando…</p>;
  }

  function selecionarServico(service: CatalogService) {
    setEscolha({ serviceId: service.id, serviceName: service.name });
    setEtapa('barbeiro');
  }

  function selecionarBarbeiro(staffId: string | undefined, staffName: string | undefined) {
    setEscolha((atual) => ({ ...atual, staffId, staffName }));
    setEtapa('horario');
  }

  function selecionarHorario(slot: AvailabilitySlot) {
    setEscolha((atual) => ({ ...atual, startAt: slot.startAt, staffId: slot.staffId, staffName: slot.staffName }));
    setAvisoHorarioTomado(null);
    setEtapa('contato');
  }

  function handleSlotTaken(message: string) {
    setAvisoHorarioTomado(message);
    setEtapa('horario');
  }

  return (
    <div>
      {avisoHorarioTomado ? <p role="alert">{avisoHorarioTomado}</p> : null}

      {etapa === 'servico' ? <ServiceStep services={catalog.services} onSelect={selecionarServico} /> : null}

      {etapa === 'barbeiro' && escolha.serviceId ? (
        <StaffStep
          staff={catalog.staff}
          serviceId={escolha.serviceId}
          onSelect={selecionarBarbeiro}
          onVoltar={() => setEtapa('servico')}
        />
      ) : null}

      {etapa === 'horario' && escolha.serviceId ? (
        <SlotStep
          slug={slug}
          serviceId={escolha.serviceId}
          staffId={escolha.staffId}
          timeZone={timeZone}
          maxAdvanceDays={maxAdvanceDays}
          onSelect={selecionarHorario}
          onVoltar={() => setEtapa('barbeiro')}
        />
      ) : null}

      {etapa === 'contato' && escolha.serviceId && escolha.startAt ? (
        <ContactStep
          slug={slug}
          serviceId={escolha.serviceId}
          staffId={escolha.staffId}
          startAt={escolha.startAt}
          onDone={(r) => {
            setResultado(r);
            setEtapa('pronto');
          }}
          onSlotTaken={handleSlotTaken}
          onVoltar={() => setEtapa('horario')}
        />
      ) : null}

      {etapa === 'pronto' && resultado ? <DoneStep resultado={resultado} timeZone={timeZone} /> : null}
    </div>
  );
}
