import { notFound } from 'next/navigation';
import { db } from '@/db/client';
import { findBarbershopBySlug } from '@/db/repositories';
import { env } from '@/lib/env';
import { Bloco } from '@/components/ui/bloco';
import { carregarCatalogo } from './catalogo';
import { estiloDaMarca } from './marca';
import { BookingWizard } from './booking-wizard';

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const loja = await findBarbershopBySlug(db, slug);
  if (!loja) notFound();

  const catalogo = await carregarCatalogo(db, loja);
  const marca = estiloDaMarca(loja.accentHue);

  // Barbearia recém-criada, sem serviço cadastrado: o spec é explícito em nunca
  // mostrar grade vazia sem explicação. Quem chegou aqui veio de um link e
  // precisa de um caminho, não de um beco.
  if (catalogo.services.length === 0) {
    return (
      <main className="mx-auto w-full max-w-[480px] px-4 py-6 md:max-w-[560px]" style={marca}>
        <h1 className="text-2xl leading-8 font-bold">{loja.name}</h1>
        <div className="mt-4">
          <Bloco tom="alerta">
            A agenda desta barbearia ainda não está disponível. Volte em breve.
            {loja.phone ? ' Se precisar marcar agora, fale com a barbearia pelo telefone.' : ''}
          </Bloco>
        </div>
        {loja.phone ? (
          <p className="mt-3 text-[15px] leading-6">
            <a href={`tel:${loja.phone.replace(/\D/g, '')}`}>{loja.phone}</a>
          </p>
        ) : null}
      </main>
    );
  }

  // O <h1> mora DENTRO do assistente (§5.1): o cabeçalho precisa do número da
  // etapa, e a etapa é estado do wizard. Não há perda de SEO — Client Component
  // é renderizado no servidor e o <h1> sai no HTML inicial.
  return (
    <main>
      <BookingWizard
        slug={slug}
        catalogo={catalogo}
        telefoneDaLoja={loja.phone}
        whatsappConfigurado={env.WHATSAPP_ENABLED === 'true'}
        marca={marca}
      />
    </main>
  );
}
