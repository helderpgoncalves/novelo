import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useRouter, useRouterState } from '@tanstack/react-router';
import { Search } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import type { UserOut } from '@/client';
import { getMeQueryKey } from '@/client/@tanstack/react-query.gen';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NAV, type NavItem } from '@/lib/nav';
import { normalizeText } from '@/lib/text';
import { m } from '@/paraglide/messages';
import { ErrorScreen } from './error-screen';

type Linkable = NavItem & { to: NonNullable<NavItem['to']> };

const POPULAR: Linkable['to'][] = ['/', '/map', '/chat', '/simulator', '/scenarios'];

/** Secções que a pessoa pode abrir: sem as que são só de administradores, a não ser que o seja. */
function sections(isAdmin: boolean): Linkable[] {
  return NAV.flatMap((s) => s.items).filter(
    (i): i is Linkable => i.to !== undefined && !i.soon && (isAdmin || !i.adminOnly),
  );
}

/** Secções parecidas com o endereço pedido (ex.: /scenario -> Cenários), para a pessoa chegar onde queria. */
export function likelySections(pathname: string, items: Linkable[]): Linkable[] {
  const first = normalizeText(pathname.split('/').filter(Boolean)[0] ?? '');
  if (first.length < 3) return [];
  const stem = first.slice(0, 4);
  return items.filter(
    (i) => normalizeText(i.to).includes(stem) || normalizeText(i.label()).includes(stem),
  );
}

export function searchSections(query: string, items: Linkable[]): Linkable[] {
  const q = normalizeText(query.trim());
  if (!q) return [];
  return items.filter((i) => normalizeText(`${i.label()} ${i.to}`).includes(q));
}

/** 404: diz o que se passou, deixa procurar a secção certa e oferece os atalhos mais prováveis. */
export function NotFoundScreen({ layout = 'panel' }: { layout?: 'page' | 'panel' }) {
  const qc = useQueryClient();
  const router = useRouter();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const me = qc.getQueryData<UserOut>(getMeQueryKey());
  const items = useMemo(() => sections(me?.role === 'admin'), [me?.role]);
  const [query, setQuery] = useState('');
  const listId = useId();

  const matches = searchSections(query, items);
  const likely = likelySections(pathname, items).slice(0, 3);
  const shown = query.trim()
    ? matches
    : likely.length > 0
      ? likely
      : items.filter((i) => POPULAR.includes(i.to));
  const heading = query.trim()
    ? null
    : likely.length > 0
      ? m.err_404_matches()
      : m.err_404_popular();

  return (
    <ErrorScreen
      layout={layout}
      code="404"
      eyebrow={m.notfound_eyebrow()}
      title={m.notfound_title()}
      actions={
        <>
          <Button asChild className="h-11">
            <Link to="/">{m.common_back_home()}</Link>
          </Button>
          <Button variant="outline" className="h-11" onClick={() => router.history.back()}>
            {m.err_back()}
          </Button>
        </>
      }
    >
      <p>{m.notfound_text()}</p>
      <p className="break-all text-xs">
        {m.err_404_path()}: <code className="font-mono text-foreground">{pathname}</code>
      </p>
      <search className="block pt-2 text-left">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const first = shown[0];
            if (first && query.trim()) void navigate({ to: first.to });
          }}
        >
          <label htmlFor={`${listId}-q`} className="font-medium text-foreground text-sm">
            {m.err_404_search_label()}
          </label>
          <div className="relative">
            <Search
              className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 size-4 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id={`${listId}-q`}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={m.err_404_search_placeholder()}
              autoComplete="off"
              className="h-11 pl-9 text-base"
              aria-controls={`${listId}-list`}
            />
          </div>
          <div id={`${listId}-list`} aria-live="polite">
            {heading && <p className="eyebrow mb-1.5 text-muted-foreground">{heading}</p>}
            {query.trim() && shown.length === 0 ? (
              <p className="text-sm">{m.err_404_no_match({ query: query.trim() })}</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {shown.slice(0, 8).map((item) => (
                  <li key={item.to}>
                    <Button asChild variant="secondary" className="h-11">
                      <Link to={item.to}>
                        <item.icon className="size-4" aria-hidden="true" />
                        {item.label()}
                      </Link>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </form>
      </search>
    </ErrorScreen>
  );
}
