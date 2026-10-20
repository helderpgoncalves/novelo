import { createFileRoute } from '@tanstack/react-router';
import { NotFoundScreen } from '@/features/errors/not-found-screen';
import { m } from '@/paraglide/messages';

// Qualquer endereço desconhecido: o 404 aparece dentro da app, com o menu à volta.
export const Route = createFileRoute('/_app/$')({
  head: () => ({ meta: [{ title: m.notfound_title() }] }),
  component: () => <NotFoundScreen />,
});
