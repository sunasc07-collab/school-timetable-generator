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
  
  const { time: time12, ampm } = to12Hour(`${hours}:${minutes}`);
  return `${time12}${ampm}`;
}

export function to12Hour(time24: string): { time: string, ampm: 'am' | 'pm' } {
  if (!time24 || !time24.includes(':')) {
    return { time: time24 || '', ampm: 'am' };
  }
  const [hours, minutes] = time24.split(':');
  let h = parseInt(hours, 10);
  if (isNaN(h) || isNaN(parseInt(minutes, 10))) {
      return { time: time24, ampm: 'am' };
  }
  const ampm = h >= 12 ? 'pm' : 'am';
  h = h % 12;
  h = h ? h : 12; // the hour '0' should be '12'
  const hStr = h < 10 ? `0${h}` : String(h);
  return { time: `${hStr}:${minutes}`, ampm };
}

export function to24Hour(time12: string, ampm: 'am' | 'pm'): string {
    if (!time12 || !time12.includes(':')) {
        return time12;
    }
    let [hours, minutes] = time12.split(':');
    let h = parseInt(hours, 10);

    if (isNaN(h) || isNaN(parseInt(minutes, 10))) {
        return time12;
    }

    if (ampm === 'pm' && h < 12) {
        h = h + 12;
    }
    if (ampm === 'am' && h === 12) {
        h = 0;
    }
    const hStr = h < 10 ? `0${h}` : String(h);
    return `${hStr}:${minutes}`;
}

    