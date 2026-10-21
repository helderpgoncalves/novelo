import { createFileRoute, redirect } from '@tanstack/react-router';

// A bolsa de fibra é um separador de «Lotes e passaporte»: só se enche com os lotes triados no piloto.
export const Route = createFileRoute('/_app/market')({
  beforeLoad: () => {
    throw redirect({ to: '/lots', search: { tab: 'market' }, replace: true });
  },
});
