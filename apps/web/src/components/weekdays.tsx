import { weekdayShort } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/** Sete pontos (segunda a domingo): preenchidos nos dias em que há serviço. */
export function WeekdayDots({ days }: { days: number[] }) {
  return (
    <ul className="flex gap-1" aria-label={days.map(weekdayShort).join(', ')}>
      {[1, 2, 3, 4, 5, 6, 7].map((d) => (
        <li
          key={d}
          title={weekdayShort(d)}
          className={cn(
            'grid size-5 place-items-center rounded-full font-semibold text-[9px] uppercase',
            days.includes(d)
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground/60',
          )}
        >
          {weekdayShort(d).charAt(0)}
        </li>
      ))}
    </ul>
  );
}
