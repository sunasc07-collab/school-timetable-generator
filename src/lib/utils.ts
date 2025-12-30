import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTime(time: string | undefined): string {
  if (!time || !time.includes(':')) {
    return time || '';
  }
  const [hours, minutes] = time.split(':');
  if (isNaN(parseInt(hours, 10)) || isNaN(parseInt(minutes, 10))) {
    return time;
  }
  
  let h = parseInt(hours, 10);
  const ampm = h >= 12 ? 'pm' : 'am';
  h = h % 12;
  h = h ? h : 12; // the hour '0' should be '12'
  return `${h}:${minutes}${ampm}`;
}
