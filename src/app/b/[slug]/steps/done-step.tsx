import { formatTime, formatDayLabel } from '@/lib/format';
import type { Resultado } from '../types';

export function DoneStep({ resultado, timeZone }: { resultado: Resultado; timeZone: string }) {
  const data = resultado.startAt.slice(0, 10);

  return (
    <div>
      <h2>Horário confirmado</h2>
      <p>
        {formatDayLabel(data, timeZone)} às {formatTime(resultado.startAt, timeZone)} com {resultado.staffName}
      </p>
      <a href={resultado.manageUrl}>Ver ou cancelar meu horário</a>
    </div>
  );
}
