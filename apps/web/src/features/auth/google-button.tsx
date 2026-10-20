import type { GoogleLoginData } from '@/client';
import { client } from '@/client/client.gen';
import { Button } from '@/components/ui/button';
import { getLocale } from '@/lib/i18n';
import { setSessionHint } from '@/lib/session-hint';
import { m } from '@/paraglide/messages';

/** "G" oficial da Google (marca multicolor, igual em tema claro e escuro; kit de marca "Sign in with Google"). */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" width="20" height="20" className="block shrink-0" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

/**
 * Botão "Entrar com o Google": mesmo estilo secundário (outline), altura, raio e peso dos restantes botões; só o "G"
 * leva as cores oficiais da Google (kit de marca). Fluxo completo no servidor: /auth/google/login redireciona para
 * a Google e o callback volta com a sessão. O aviso de termos fica numa linha comum no fim do cartão (`AuthConsent`).
 */
export function GoogleButton({
  next,
  mode = 'signin',
}: {
  next?: string;
  mode?: 'signin' | 'signup';
}) {
  // URL construído pelo cliente gerado, tipado contra o contrato (nada de strings soltas).
  const href = client.buildUrl<GoogleLoginData>({
    url: '/api/v1/auth/google/login',
    query: { next, locale: getLocale() },
  });
  return (
    <Button asChild variant="outline" className="h-11 w-full gap-3 font-medium">
      <a href={href} onClick={setSessionHint}>
        <GoogleMark />
        <span>{mode === 'signup' ? m.google_signup() : m.google_signin()}</span>
      </a>
    </Button>
  );
}
