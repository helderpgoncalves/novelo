import { createFileRoute } from '@tanstack/react-router';
import { ViaturaPage } from '@/features/viatura/viatura-page';
import { m } from '@/paraglide/messages';

/** O ecrã da paragem da viatura (#58): «Cheguei», scan, pesar em pratos, «Partir» — offline-first.
 *
 * Exige Android + Chrome na viatura (Web Bluetooth da balança/impressora e Background Sync); o texto de
 * ajuda no ecrã diz-o e `docs/engenharia/features.md` §12 documenta. Sem GPS no MVP.
 */
export const Route = createFileRoute('/_app/viatura')({
  head: () => ({ meta: [{ title: m.viatura_title() }] }),
  staticData: { skeleton: 'form' },
  component: ViaturaPage,
});
