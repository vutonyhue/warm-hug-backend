import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility for merging Tailwind CSS classes
 * Combines clsx for conditional classes with tailwind-merge for deduplication
 * 
 * @example
 * cn('p-4', 'bg-primary', condition && 'text-white')
 * cn(['flex', 'items-center'], { 'opacity-50': disabled })
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
