import { requireSession } from '@/lib/session';
import { db } from '@/db/client';
import { findBarbershopById } from '@/db/repositories';
import { env } from '@/lib/env';
import { CabecalhoDePagina } from '@/components/ui/cabecalho-de-pagina';
import { Largura } from '@/components/ui/largura';
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

      {/* O teto da tela mora aqui, não dentro do formulário: a página decide
          quanto ocupa, o formulário decide como se arruma por dentro. Era um
          card de 520px sobre um formulário de 520px numa tela de 1400 — dois
          terços vazios. */}
      <Largura tipo="leitura">
        <SettingsForm loja={loja} linkPublico={linkPublico} />
      </Largura>
    </div>
  );
}
