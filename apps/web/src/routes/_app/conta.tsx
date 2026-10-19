import { createFileRoute } from '@tanstack/react-router';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChangePasswordForm } from '@/features/auth/change-password-form';
import { LogoutAllButton } from '@/features/auth/logout-all-button';
import { ProfileForm } from '@/features/auth/profile-form';

export const Route = createFileRoute('/_app/conta')({
  head: () => ({ meta: [{ title: 'A minha conta · Novelo' }] }),
  component: Account,
});

function Account() {
  const { user } = Route.useRouteContext();
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Conta"
        title="A minha conta"
        description="Dados de acesso e segurança."
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="space-y-6">
          <Card className="gap-4 shadow-none ring-1 ring-foreground/10">
            <CardHeader>
              <CardTitle className="font-sans font-semibold text-base">Perfil</CardTitle>
              <CardDescription>O nome aparece no menu e nos emails.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">
                  {user.role === 'admin' ? 'Administrador' : 'Operador'}
                </Badge>
                <Badge variant={user.email_verified ? 'secondary' : 'outline'}>
                  {user.email_verified ? 'Email confirmado' : 'Email por confirmar'}
                </Badge>
                {user.google_linked && <Badge variant="outline">Google ligada</Badge>}
              </div>
              <ProfileForm user={user} />
            </CardContent>
          </Card>
          <Card className="gap-4 shadow-none ring-1 ring-foreground/10">
            <CardHeader>
              <CardTitle className="font-sans font-semibold text-base">Sessões</CardTitle>
              <CardDescription>
                Se perdeste um dispositivo ou suspeitas de acesso indevido, termina todas as
                sessões.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LogoutAllButton />
            </CardContent>
          </Card>
        </div>
        <Card className="gap-4 shadow-none ring-1 ring-foreground/10">
          <CardHeader>
            <CardTitle className="font-sans font-semibold text-base">
              {user.has_password ? 'Alterar a password' : 'Definir uma password'}
            </CardTitle>
            <CardDescription>
              {user.has_password
                ? 'Ao alterar, terminamos a sessão em todos os dispositivos.'
                : 'A tua conta entra com a Google. Define uma password para também poderes entrar com email.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm user={user} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
