import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

// Utility for conditional Tailwind class merging
// Analyzability: single-purpose, clear name
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
