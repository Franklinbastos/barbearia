import { requireSession } from '@/lib/session';
import { db } from '@/db/client';
import { findBarbershopById } from '@/db/repositories';
import { env } from '@/lib/env';
import { SettingsForm } from './settings-form';

export default async function ConfiguracoesPage() {
  const sessao = await requireSession();
  const loja = await findBarbershopById(db, sessao.barbershopId);
  if (!loja) return null;

  const linkPublico = `${env.APP_URL}/b/${loja.slug}`;

  return (
    <div>
      <h1>Configurações</h1>
      <p>
        Endereço público: <code>{linkPublico}</code>
      </p>
      <SettingsForm loja={loja} />
    </div>
  );
}
