import { requireSession } from '@/lib/session';
import { db } from '@/db/client';
import { findBarbershopById } from '@/db/repositories';
import { env } from '@/lib/env';
import { Bloco } from '@/components/ui/bloco';
import { CabecalhoDePagina } from '@/components/ui/cabecalho-de-pagina';
import { SettingsForm } from './settings-form';

export default async function ConfiguracoesPage() {
  const sessao = await requireSession();
  const loja = await findBarbershopById(db, sessao.barbershopId);
  if (!loja) return null;

  const linkPublico = `${env.APP_URL}/b/${loja.slug}`;

  return (
    <div className="flex flex-col gap-4">
      <CabecalhoDePagina
        titulo="Configurações"
        descricao="O endereço público da loja e as regras da agenda."
      />

      <div className="max-w-[520px]">
        <Bloco>
          <p className="text-sm leading-5 font-bold text-tinta-2">Endereço público</p>
          {/* `break-all` porque o slug pode ser longo e em 360px o endereço é a
              única coisa da tela que não tem onde quebrar. */}
          <code className="mt-1 block break-all">{linkPublico}</code>
        </Bloco>
      </div>

      <SettingsForm loja={loja} />
    </div>
  );
}
