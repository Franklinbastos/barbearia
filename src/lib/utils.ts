import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Junta classes resolvendo conflito do Tailwind — a última vence.
 * É o que permite um componente aceitar `className` de fora sem que a classe
 * de dentro ganhe por ordem de declaração.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
