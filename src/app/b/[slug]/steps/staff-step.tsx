import type { CatalogStaff } from '../types';

export function StaffStep({
  staff,
  serviceId,
  onSelect,
  onVoltar,
}: {
  staff: CatalogStaff[];
  serviceId: string;
  onSelect: (staffId: string | undefined, staffName: string | undefined) => void;
  onVoltar: () => void;
}) {
  const equipe = staff.filter((b) => b.serviceIds.includes(serviceId));

  return (
    <div>
      <h2>Escolha o barbeiro</h2>
      <button type="button" onClick={onVoltar}>Voltar</button>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        <li>
          <button type="button" onClick={() => onSelect(undefined, undefined)} style={{ width: '100%', textAlign: 'left' }}>
            Qualquer barbeiro
          </button>
        </li>
        {equipe.map((b) => (
          <li key={b.id}>
            <button type="button" onClick={() => onSelect(b.id, b.name)} style={{ width: '100%', textAlign: 'left' }}>
              {b.name}
            </button>
          </li>
        ))}
      </ul>
      {equipe.length === 0 ? <p>Nenhum barbeiro disponível para esse serviço no momento.</p> : null}
    </div>
  );
}
