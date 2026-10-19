import { AlertTriangle, Inbox } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { getErrorMessage } from '@/lib/errors';
import { m } from '@/paraglide/messages';

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center">
      <Inbox className="size-6 text-muted-foreground" aria-hidden="true" />
      <p className="font-medium">{title}</p>
      {description && <p className="max-w-sm text-muted-foreground text-sm">{description}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-10 text-center"
    >
      <AlertTriangle className="size-6 text-destructive" aria-hidden="true" />
      <p className="font-medium">{m.error_load_title()}</p>
      <p className="max-w-md text-muted-foreground text-sm">{getErrorMessage(error)}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          {m.common_retry()}
        </Button>
      )}
    </div>
  );
}

export { PageSkeleton } from '@/components/skeletons';
