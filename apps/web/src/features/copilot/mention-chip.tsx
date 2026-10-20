import {
  AtSign,
  Bell,
  Database,
  FileText,
  GitCompareArrows,
  LayoutDashboard,
  type LucideIcon,
  Map as MapIcon,
  MapPin,
  Package,
  Route,
  Shirt,
  Tag,
  Truck,
  Warehouse,
} from 'lucide-react';
import type { MentionType } from '@/client';
import { cn } from '@/lib/utils';
import type { ResolvedMention } from './mentions';

const ICONS: Record<MentionType, LucideIcon> = {
  scenario: GitCompareArrows,
  municipal_site: Warehouse,
  parish: MapIcon,
  circuit: Route,
  locality: MapPin,
  vehicle: Truck,
  lot: Package,
  alert: Bell,
  report: FileText,
  brand: Tag,
  fibre: Shirt,
  page: LayoutDashboard,
  data_source: Database,
};

export const mentionIcon = (type: MentionType): LucideIcon => ICONS[type] ?? AtSign;

/** Ícone do tipo de entidade (freguesia, circuito, viatura…). */
export function MentionIcon({ type, className }: { type: MentionType; className?: string }) {
  const Icon = mentionIcon(type);
  return <Icon className={className} strokeWidth={1.75} aria-hidden="true" />;
}

/** Menção numa mensagem enviada: mesma marca do campo (floresta sobre fundo suave) com o ícone do tipo. */
export function MentionChip({
  mention,
  className,
}: {
  mention: ResolvedMention;
  className?: string;
}) {
  return (
    <span
      data-testid="copilot-mention-chip"
      className={cn(
        'inline-flex items-center gap-1 rounded-md bg-primary/12 px-1.5 align-baseline font-medium text-primary leading-snug',
        className,
      )}
    >
      <MentionIcon type={mention.ref.type} className="size-3.5 shrink-0" />
      <span className="sr-only">@</span>
      {mention.label}
    </span>
  );
}
