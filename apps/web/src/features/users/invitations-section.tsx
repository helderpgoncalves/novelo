import { QrCode } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { m } from '@/paraglide/messages';
import { EventPoster } from './event-poster';
import { GuestsTable } from './guests-table';
import { InvitationsPanel } from './invitations-panel';

/** Convites por email e, logo abaixo, quem entrou pelo QR do evento; o cartaz do QR abre num diálogo. */
export function InvitationsSection() {
  const [poster, setPoster] = useState(false);
  return (
    <div className="space-y-8">
      <InvitationsPanel />
      <section className="space-y-3" aria-labelledby="guests-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <h2 id="guests-heading" className="text-xl">
              {m.guests_title()}
            </h2>
            <p className="max-w-3xl text-muted-foreground text-sm leading-relaxed">
              {m.guests_intro()}
            </p>
          </div>
          <Button
            variant="outline"
            className="h-10 w-full gap-2 font-semibold sm:w-auto"
            onClick={() => setPoster(true)}
          >
            <QrCode aria-hidden="true" />
            {m.poster_button()}
          </Button>
        </div>
        <GuestsTable />
      </section>
      <Dialog open={poster} onOpenChange={setPoster}>
        <DialogContent className="sm:max-w-4xl" aria-describedby={undefined}>
          <DialogTitle className="sr-only">{m.poster_button()}</DialogTitle>
          {poster && <EventPoster />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
