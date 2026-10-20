import { UserRound } from 'lucide-react';
import { memo, type ReactNode, useMemo, useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { displayName, initialsOf, type Person, toneOf } from '@/lib/person';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';

export type UserAvatarSize = 'xs' | 'sm' | 'md' | 'lg';
/** Só o que pede atenção tem indicador; `active` não mostra nada para o avatar ficar discreto. */
export type UserStatus = 'active' | 'pending' | 'inactive' | 'rejected';

const PX: Record<UserAvatarSize, number> = { xs: 24, sm: 32, md: 40, lg: 56 };
const SIZE_CLASS: Record<UserAvatarSize, string> = {
  xs: 'size-6 text-[10px]',
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-14 text-lg',
};
const DOT_CLASS: Record<UserAvatarSize, string> = {
  xs: 'size-2',
  sm: 'size-2.5',
  md: 'size-3',
  lg: 'size-3.5',
};
const DOT_COLOR: Record<Exclude<UserStatus, 'active'>, string> = {
  pending: 'bg-areia',
  inactive: 'bg-muted-foreground',
  rejected: 'bg-destructive',
};

interface AvatarProps {
  person: Person;
  size?: UserAvatarSize;
  status?: UserStatus;
  /** Texto do estado (para leitores de ecrã); obrigatório para o indicador ter nome acessível. */
  statusLabel?: string;
  /** Texto adicional do `aria-label` (p. ex. o papel). */
  roleLabel?: string;
  /** `true` quando o nome já está escrito ao lado: o avatar fica decorativo. */
  decorative?: boolean;
  className?: string;
}

/** Foto da conta (se existir e carregar) sobre iniciais numa cor estável; a foto só aparece quando já carregou. */
export const UserAvatar = memo(function UserAvatar({
  person,
  size = 'sm',
  status,
  statusLabel,
  roleLabel,
  decorative = false,
  className,
}: AvatarProps) {
  const { name, email, avatar_url: url } = person;
  const look = useMemo(() => {
    const p = { name, email };
    return { tone: toneOf(p), initials: initialsOf(p), label: displayName(p) };
  }, [name, email]);
  const px = PX[size];
  const label = [look.label, roleLabel, status && status !== 'active' ? statusLabel : undefined]
    .filter(Boolean)
    .join(', ');

  return (
    <span
      className="relative inline-flex shrink-0"
      {...(decorative
        ? { 'aria-hidden': true }
        : { role: 'img', 'aria-label': label || undefined })}
    >
      <Avatar
        className={cn(
          'bg-(--av-bg) font-semibold text-(--av-fg) dark:bg-(--av-dbg) dark:text-(--av-dfg)',
          SIZE_CLASS[size],
          className,
        )}
        style={
          {
            '--av-bg': look.tone.bg,
            '--av-fg': look.tone.fg,
            '--av-dbg': look.tone.darkBg,
            '--av-dfg': look.tone.darkFg,
          } as React.CSSProperties
        }
      >
        <span
          aria-hidden="true"
          className="flex size-full items-center justify-center leading-none tracking-tight"
        >
          {look.initials || <UserRound className="size-[55%]" strokeWidth={1.75} />}
        </span>
        {url ? <AvatarPhoto key={url} url={url} px={px} /> : null}
      </Avatar>
      {status && status !== 'active' && (
        <span
          aria-hidden="true"
          className={cn(
            'absolute right-0 bottom-0 rounded-full ring-2 ring-background',
            DOT_CLASS[size],
            DOT_COLOR[status],
          )}
        />
      )}
    </span>
  );
});

/** A imagem entra por cima das iniciais com um fundido; se falhar (403, rede, CSP) desaparece e ficam as iniciais. */
function AvatarPhoto({ url, px }: { url: string; px: number }) {
  const [state, setState] = useState<'loading' | 'loaded' | 'failed'>('loading');
  if (state === 'failed') return null;
  return (
    <img
      src={url}
      alt=""
      width={px}
      height={px}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      draggable={false}
      onLoad={() => setState('loaded')}
      onError={() => setState('failed')}
      className={cn(
        'absolute inset-0 size-full rounded-full object-cover transition-opacity duration-200 motion-reduce:transition-none',
        state === 'loaded' ? 'opacity-100' : 'opacity-0',
      )}
    />
  );
}

interface ChipProps extends Omit<AvatarProps, 'decorative' | 'className'> {
  /** `stacked`: nome com o email por baixo; `inline`: só o nome (o email vai no tooltip). */
  variant?: 'stacked' | 'inline';
  /** Marca a própria pessoa com «Tu». */
  you?: boolean;
  /** Etiqueta ao lado do nome (papel, estado). */
  badge?: ReactNode;
  /** Linhas extra por baixo do email. */
  children?: ReactNode;
  /** Esconde o email na variante `stacked` (quando só há nome). */
  hideEmail?: boolean;
  className?: string;
  nameClassName?: string;
}

/** Avatar + nome (+ email). Truncado com `min-w-0`, o texto completo no tooltip. */
export const UserChip = memo(function UserChip({
  person,
  size = 'sm',
  variant = 'stacked',
  status,
  statusLabel,
  roleLabel,
  you,
  badge,
  children,
  hideEmail,
  className,
  nameClassName,
}: ChipProps) {
  const name = displayName(person);
  const email = person.email?.trim() ?? '';
  const showEmail = variant === 'stacked' && !hideEmail && email !== '' && email !== name;
  return (
    <div className={cn('flex min-w-0 items-center gap-3', className)}>
      <UserAvatar
        person={person}
        size={size}
        status={status}
        statusLabel={statusLabel}
        roleLabel={roleLabel}
        decorative
      />
      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-center gap-2">
          <span
            className={cn('truncate font-medium', size === 'xs' && 'text-sm', nameClassName)}
            title={email && email !== name ? `${name} · ${email}` : name}
          >
            {name || email}
          </span>
          {you && (
            <Badge variant="outline" className="shrink-0">
              {m.users_you()}
            </Badge>
          )}
          {badge}
        </p>
        {showEmail && (
          <p className="truncate font-normal text-muted-foreground text-xs" title={email}>
            {email}
          </p>
        )}
        {status && status !== 'active' && statusLabel && (
          <span className="sr-only">{`(${statusLabel})`}</span>
        )}
        {children}
      </div>
    </div>
  );
});

/** Várias pessoas sobrepostas (ações em massa): os primeiros avatares e «+N». */
export const UserAvatarStack = memo(function UserAvatarStack({
  people,
  max = 5,
  size = 'md',
}: {
  people: Person[];
  max?: number;
  size?: UserAvatarSize;
}) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <div className="flex items-center -space-x-2" aria-hidden="true">
      {shown.map((p, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: a mesma pessoa pode repetir-se; a ordem é fixa
          key={`${p.email ?? p.name ?? ''}-${i}`}
          className="rounded-full ring-2 ring-background"
        >
          <UserAvatar person={p} size={size} decorative />
        </span>
      ))}
      {rest > 0 && (
        <span
          className={cn(
            'z-0 flex shrink-0 items-center justify-center rounded-full bg-muted font-semibold text-muted-foreground text-xs ring-2 ring-background',
            SIZE_CLASS[size],
          )}
        >
          +{rest}
        </span>
      )}
    </div>
  );
});
