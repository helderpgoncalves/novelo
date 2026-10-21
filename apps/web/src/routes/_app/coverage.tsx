import { createFileRoute, redirect } from '@tanstack/react-router';

// A antiga «Cobertura da rede» media uma rede de contentores de têxtil que a Vitrus não tem nem quer. A cobertura que
// existe (a 300 m dos contentores municipais, onde a viatura já passa) é uma camada do mapa; ligações antigas e o
// Copiloto continuam a chegar lá.
export const Route = createFileRoute('/_app/coverage')({
  beforeLoad: () => {
    throw redirect({ to: '/map', search: { fill: 'cover' }, replace: true });
  },
});
