import { formatTime, formatDayLabelFromInstant } from '@/lib/format';
import type { Resultado } from '../types';

export function DoneStep({ resultado, timeZone }: { resultado: Resultado; timeZone: string }) {
  return (
    <div>
      <h2>Horário confirmado</h2>
      <p>
        {formatDayLabelFromInstant(resultado.startAt, timeZone)} às{' '}
        {formatTime(resultado.startAt, timeZone)} com {resultado.staffName}
      </p>
      <a href={resultado.manageUrl}>Ver ou cancelar meu horário</a>
    </div>
  );
}
