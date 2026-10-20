import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MeOut } from '@/client';
import {
  getMeOptions,
  getMeQueryKey,
  updateOnboardingMutation,
} from '@/client/@tanstack/react-query.gen';
import type { ChecklistId } from './steps';

type Patch = { tour?: 'seen' | 'reset'; mark?: ChecklistId; checklist_dismissed?: boolean };

/**
 * Estado da introdução no servidor (por conta, vale em qualquer dispositivo) e a forma de o atualizar.
 * Em impersonação não se escreve nada: o administrador vê como a pessoa, não gasta a introdução dela.
 */
export function useOnboarding(initial: MeOut) {
  const queryClient = useQueryClient();
  const me =
    useQuery({ ...getMeOptions(), initialData: initial, staleTime: 30_000 }).data ?? initial;
  const mutation = useMutation({
    ...updateOnboardingMutation(),
    onSuccess: (onboarding) =>
      queryClient.setQueryData<MeOut>(getMeQueryKey(), (old) =>
        old ? { ...old, onboarding } : old,
      ),
  });
  const readOnly = Boolean(me.impersonation?.active);
  const onboarding = {
    tour_seen_at: me.onboarding?.tour_seen_at ?? null,
    checklist_done: me.onboarding?.checklist_done ?? [],
    checklist_dismissed: me.onboarding?.checklist_dismissed ?? false,
  };
  const update = (body: Patch) => {
    if (readOnly) return;
    mutation.mutate({ body });
  };
  return { me, onboarding, readOnly, update };
}
