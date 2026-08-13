import { requireSession } from '@/lib/session';
import { db } from '@/db/client';
import { findBarbershopById } from '@/db/repositories';
import { env } from '@/lib/env';
import { CabecalhoDePagina } from '@/components/ui/cabecalho-de-pagina';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

      {/* Era `Bloco`, mas nunca foi mensagem: é o endereço da loja parado na
          tela, ou seja, conteúdo. Card com cabeçalho é exatamente essa forma. */}
      <Card className="max-w-[520px]">
        <CardHeader>
          <CardTitle>Endereço público</CardTitle>
        </CardHeader>
        <CardContent>
          {/* `break-all` porque o slug pode ser longo e em 360px o endereço é a
              única coisa da tela que não tem onde quebrar. */}
          <code className="block break-all text-base leading-6">{linkPublico}</code>
        </CardContent>
      </Card>

      <SettingsForm loja={loja} />
    </div>
  );
}
