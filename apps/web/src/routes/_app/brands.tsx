import { createFileRoute, redirect } from '@tanstack/react-router';

// A evidência por marca é um separador de «Lotes e passaporte»: só se enche com as peças triadas no piloto.
export const Route = createFileRoute('/_app/brands')({
  beforeLoad: () => {
    throw redirect({ to: '/lots', search: { tab: 'brands' }, replace: true });
  },
});
