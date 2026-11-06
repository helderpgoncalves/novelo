import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, Send, XCircle } from 'lucide-react';
import { useState } from 'react';
import type { PreCollectionAdvice } from '@/client';
import { checkPreCollectionMutation } from '@/client/@tanstack/react-query.gen';
import { Panel } from '@/components/page';
import { Button } from '@/components/ui/button';
import { FormAlert } from '@/features/auth/form-alert';
import { PhotoInput } from '@/features/triage/photo-input';
import { getErrorMessage } from '@/lib/errors';
import { getLocale } from '@/lib/i18n';
import { m } from '@/paraglide/messages';

/** «Vai no saco?»: fotografia, conselho numa frase e opção de verificar outra peça. Sem sessão, sem escrita. */
export function BagCheckFlow() {
  const [photo, setPhoto] = useState<File | null>(null);
  const [advice, setAdvice] = useState<PreCollectionAdvice | null>(null);
  const check = useMutation({ ...checkPreCollectionMutation(), onSuccess: setAdvice });

  const submit = () => {
    if (!photo || check.isPending) return;
    setAdvice(null);
    check.mutate({ body: { photo }, query: { locale: getLocale() } });
  };

  if (advice) {
    const inBag = advice.decision === 'in_bag';
    return (
      <Panel className="space-y-5">
        <div
          className={`flex items-start gap-3 rounded-xl border p-4 ${
            inBag ? 'border-[#2e6b57]/35 bg-[#2e6b57]/8' : 'border-destructive/35 bg-destructive/8'
          }`}
          role="status"
        >
          {inBag ? (
            <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-[#2e6b57]" aria-hidden="true" />
          ) : (
            <XCircle className="mt-0.5 size-6 shrink-0 text-destructive" aria-hidden="true" />
          )}
          <div className="space-y-1">
            <p className="font-semibold">
              {inBag
                ? advice.condition === 'reuse'
                  ? m.bag_in_bag_reuse()
                  : m.bag_in_bag_recycle()
                : m.bag_keep_out_title()}
            </p>
            <p>{advice.reason}</p>
          </div>
        </div>
        {!inBag && <p className="text-muted-foreground text-sm">{m.bag_keep_out_hint()}</p>}
        <p className="text-muted-foreground text-xs">{m.bag_disclaimer()}</p>
        <Button
          variant="outline"
          className="h-11 w-full gap-2 sm:w-auto"
          onClick={() => {
            setAdvice(null);
            setPhoto(null);
          }}
        >
          {m.bag_again()}
        </Button>
      </Panel>
    );
  }

  return (
    <Panel className="space-y-5">
      <PhotoInput
        label={m.bag_photo_label()}
        hint={m.bag_photo_hint()}
        value={photo}
        onChange={setPhoto}
        required
        removeLabel={m.bag_photo_remove()}
      />
      <FormAlert message={check.isError ? getErrorMessage(check.error) : null} />
      <Button className="h-12 w-full gap-2 font-semibold" disabled={!photo} onClick={submit}>
        <Send className="size-4" aria-hidden="true" />
        {m.bag_submit()}
      </Button>
      <p className="text-center text-muted-foreground text-xs">{m.bag_privacy_note()}</p>
    </Panel>
  );
}
