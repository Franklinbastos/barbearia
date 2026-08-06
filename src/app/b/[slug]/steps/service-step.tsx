import { formatDuration, formatPrice } from '@/lib/format';
import type { CatalogService } from '../types';

export function ServiceStep({
  services,
  onSelect,
}: {
  services: CatalogService[];
  onSelect: (service: CatalogService) => void;
}) {
  return (
    <div>
      <h2>Escolha o serviço</h2>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {services.map((s) => (
          <li key={s.id}>
            <button type="button" onClick={() => onSelect(s)} style={{ width: '100%', textAlign: 'left' }}>
              {s.name} — {formatDuration(s.durationMinutes)} — {formatPrice(s.priceCents)}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
