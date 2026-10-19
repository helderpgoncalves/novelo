import { createFileRoute } from '@tanstack/react-router';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChangePasswordForm } from '@/features/auth/change-password-form';

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
        <Card className="gap-4 shadow-none ring-1 ring-foreground/10">
          <CardHeader>
            <CardTitle className="font-sans font-semibold text-base">Perfil</CardTitle>
            <CardDescription>Estes dados vêm do teu registo.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <p className="eyebrow text-muted-foreground">Nome</p>
              <p className="mt-1">{user.name ?? 'Sem nome'}</p>
            </div>
            <div>
              <p className="eyebrow text-muted-foreground">Email</p>
              <p className="mt-1">{user.email}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">
                {user.role === 'admin' ? 'Administrador' : 'Operador'}
              </Badge>
              {user.google_linked && <Badge variant="outline">Google ligada</Badge>}
            </div>
          </CardContent>
        </Card>
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
