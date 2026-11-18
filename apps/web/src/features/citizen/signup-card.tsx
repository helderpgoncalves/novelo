import { useMutation } from '@tanstack/react-query';
import { MailCheck } from 'lucide-react';
import { useState } from 'react';
import { donorSignUpMutation } from '@/client/@tanstack/react-query.gen';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getErrorCode } from '@/lib/errors';

// Strings em pt-PT de propósito: a área do cidadão é só portuguesa no MVP (decisão da spec #54).

/**
 * A porta de entrada do doador: email sem password (magic link), idade DECLARADA — abaixo de 13 é
 * recusa explícita (ADR: RGPD da conta de doador) — e consentimento. A resposta é sempre a mesma para
 * quem já tem conta: só o email diz se chegou alguma coisa.
 */
export function SignupCard() {
  const [email, setEmail] = useState('');
  const [age, setAge] = useState('');
  const [consent, setConsent] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const signup = useMutation({
    ...donorSignUpMutation(),
    onSuccess: () => setSent(email.trim().toLowerCase()),
  });

  if (sent) {
    return (
      <div className="ring-foreground/10 space-y-4 rounded-2xl bg-card p-6 text-center ring-1">
        <MailCheck className="text-primary mx-auto size-10" aria-hidden />
        <h2 className="font-serif text-2xl text-balance">Abre o teu email</h2>
        <p className="text-muted-foreground text-sm">
          Enviámos um link de entrada a <span className="text-foreground font-medium">{sent}</span>.
          Abre-o neste telemóvel para entrar na carteira. Não chegou nada? Confirma o email ou
          espera um minuto — por segurança, só enviamos um link de cada vez.
        </p>
      </div>
    );
  }

  const ageBelowMinimum = signup.error && getErrorCode(signup.error) === 'age_below_minimum';

  return (
    <form
      className="ring-foreground/10 space-y-4 rounded-2xl bg-card p-6 ring-1"
      onSubmit={(e) => {
        e.preventDefault();
        const parsed = Number.parseInt(age, 10);
        if (!email.includes('@') || Number.isNaN(parsed) || !consent) return;
        signup.mutate({
          body: { email: email.trim().toLowerCase(), declared_age: parsed, consent: true },
        });
      }}
    >
      <div className="space-y-1.5">
        <h2 className="font-serif text-2xl leading-tight text-balance">
          Cria a tua carteira de têxtil
        </h2>
        <p className="text-muted-foreground text-sm">
          Sacos, pontos e histórico do que dás. Sem palavra-passe: um link para o teu email e fica
          tudo guardado neste telemóvel.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="donor-email">Email</Label>
        <Input
          id="donor-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="oteuemail@exemplo.pt"
          className="text-base"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="donor-age">Que idade tens?</Label>
        <Input
          id="donor-age"
          type="number"
          inputMode="numeric"
          min={1}
          max={120}
          placeholder="Ex.: 34"
          className="text-base"
          value={age}
          onChange={(e) => setAge(e.target.value)}
          required
          aria-invalid={Boolean(ageBelowMinimum)}
        />
        {ageBelowMinimum && (
          <p role="alert" className="text-destructive text-sm">
            É preciso ter 13 anos ou mais para ter conta. Podem usar a conta um adulto contigo —
            obrigado por entenderes.
          </p>
        )}
      </div>
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          className="border-foreground/30 accent-primary mt-0.5 size-5 rounded"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
        />
        <span className="text-muted-foreground">
          Aceito a política de privacidade: a conta serve para creditar os meus sacos. O meu apelido
          de sacos e a minha idade nunca aparecem em público; o lote e o passaporte nunca mostram
          quem entregou.
        </span>
      </label>
      <Button
        type="submit"
        className="h-12 w-full text-base"
        disabled={signup.isPending || !consent}
      >
        {signup.isPending ? 'A enviar…' : 'Entrar com email'}
      </Button>
      <p className="text-muted-foreground text-center text-xs">
        13 anos ou mais. Pontos não são dinheiro nem são conversíveis — trocam-se por donativos e
        prémios locais.
      </p>
    </form>
  );
}
