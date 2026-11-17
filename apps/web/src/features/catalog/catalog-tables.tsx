import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Handshake, Plus, ScanSearch } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { CampaignOut, CatalogItemOut, PartnerOut } from '@/client';
import {
  approveCatalogPartnerMutation,
  createCatalogItemMutation,
  createCatalogPartnerMutation,
  createPointCampaignMutation,
  deactivateCatalogPartnerMutation,
  listAdminCampaignsOptions,
  listAdminCatalogItemsOptions,
  listCatalogPartnersOptions,
  updateCatalogItemMutation,
  updatePointCampaignMutation,
  validateRedemptionCodeMutation,
} from '@/client/@tanstack/react-query.gen';
import { type Column, DataTable, type RowAction } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { getErrorCode } from '@/lib/errors';
import { formatEur, formatNumber } from '@/lib/format';
import { formatDate } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';

// O gestor de parcerias e o catálogo (#65): três mesas de equipa (itens, parceiros, campanhas)
// e a validação do código que o parceiro apresenta. Os quatro estados de cada mesa vivem no DataTable.

export const catalogKindLabel = (kind: CatalogItemOut['kind']): string => {
  switch (kind) {
    case 'ipss_donation':
      return m.catalog_kind_ipss();
    case 'partner_prize':
      return m.catalog_kind_partner();
    case 'environmental':
      return m.catalog_kind_environmental();
  }
};

export const partnerStateLabel = (state: PartnerOut['state']): string => {
  switch (state) {
    case 'proposed':
      return m.partner_state_proposed();
    case 'active':
      return m.partner_state_active();
    case 'inactive':
      return m.partner_state_inactive();
  }
};

// --- itens do catálogo -----------------------------------------------------------------------------

/** A mesa do catálogo: donativos IPSS (com âncora € APRESENTADA), prémios de parceiro e ambiental. */
export function CatalogItemsTable({ id }: { id: string }) {
  const query = useQuery(listAdminCatalogItemsOptions());
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CatalogItemOut | null>(null);
  const rows = useMemo(() => query.data ?? [], [query.data]);
  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: listAdminCatalogItemsOptions().queryKey });

  const update = useMutation({
    ...updateCatalogItemMutation(),
    onSuccess: () => {
      invalidate();
      setEditing(null);
      toast(m.catalog_toast_item_updated());
    },
    onError: (e) => toast(`${m.catalog_toast_item_failed()} ${getErrorCode(e) ?? ''}`),
  });

  const columns: Column<CatalogItemOut>[] = [
    {
      id: 'name',
      header: m.catalog_col_item(),
      cell: (row) => <span className="font-medium">{row.name}</span>,
      value: (row) => row.name,
      primary: true,
    },
    {
      id: 'kind',
      header: m.catalog_col_kind(),
      cell: (row) => <span className="text-sm">{catalogKindLabel(row.kind)}</span>,
      value: (row) => catalogKindLabel(row.kind),
      filter: true,
    },
    {
      id: 'cost',
      header: m.catalog_col_cost(),
      type: 'number',
      cell: (row) => <span className="tabular-nums">{formatNumber(row.points_cost)}</span>,
      value: (row) => row.points_cost,
    },
    {
      id: 'value',
      header: m.catalog_col_value(),
      type: 'number',
      cell: (row) =>
        row.donation_value_cents != null ? (
          // A âncora € é o VALOR DO DONATIVO (1 000 pontos ≈ 5 €) — nunca o valor dos pontos.
          <span className="tabular-nums">{formatEur(row.donation_value_cents / 100)}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
      value: (row) => row.donation_value_cents ?? 0,
      hideable: true,
    },
    {
      id: 'partner',
      header: m.catalog_col_partner(),
      cell: (row) => row.partner_name ?? <span className="text-muted-foreground">—</span>,
      value: (row) => row.partner_name ?? '',
      filter: true,
    },
    {
      id: 'stock',
      header: m.catalog_col_stock(),
      type: 'number',
      cell: (row) =>
        row.stock != null ? (
          <span className="tabular-nums">{formatNumber(row.stock)}</span>
        ) : (
          <span className="text-muted-foreground">{m.catalog_stock_unlimited()}</span>
        ),
      value: (row) => row.stock ?? -1,
    },
    {
      id: 'active',
      header: m.catalog_col_active(),
      cell: (row) =>
        row.active ? (
          <span className="bg-primary/10 text-primary rounded-full px-2.5 py-1 text-[11px] font-medium">
            {m.common_active()}
          </span>
        ) : (
          <span className="text-muted-foreground bg-muted rounded-full px-2.5 py-1 text-[11px]">
            {m.common_inactive()}
          </span>
        ),
      value: (row) => (row.active ? m.common_active() : m.common_inactive()),
      filter: true,
    },
  ];

  const rowActions = (row: CatalogItemOut): RowAction<CatalogItemOut>[] => [
    { id: 'edit', label: m.catalog_action_edit(), onSelect: (r) => setEditing(r) },
    {
      id: 'toggle',
      label: row.active ? m.catalog_action_deactivate() : m.catalog_action_activate(),
      onSelect: (r) => update.mutate({ path: { item_id: r.id }, body: { active: !r.active } }),
    },
  ];

  return (
    <>
      <DataTable
        id={id}
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        loading={query.isPending}
        refreshing={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        empty={m.catalog_empty_items()}
        rowActions={rowActions}
        initialSort={[{ id: 'name', desc: false }]}
        actions={
          <Button type="button" size="sm" className="min-h-10" onClick={() => setCreating(true)}>
            <Plus aria-hidden /> {m.catalog_create_item()}
          </Button>
        }
      />
      <ItemDialog
        open={creating || editing !== null}
        item={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSaved={invalidate}
      />
    </>
  );
}

/** Criar/editar item: a forma é fechada — âncora € só em donativo IPSS, parceiro obrigatório em prémio. */
function ItemDialog({
  open,
  item,
  onClose,
  onSaved,
}: {
  open: boolean;
  item: CatalogItemOut | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const partners = useQuery({ ...listCatalogPartnersOptions(), enabled: open });
  const create = useMutation({
    ...createCatalogItemMutation(),
    onSuccess: () => {
      onSaved();
      toast(m.catalog_toast_item_created());
      onClose();
    },
    onError: (e) => toast(`${m.catalog_toast_item_failed()} ${getErrorCode(e) ?? ''}`),
  });
  const update = useMutation({
    ...updateCatalogItemMutation(),
    onSuccess: () => {
      onSaved();
      toast(m.catalog_toast_item_updated());
      onClose();
    },
    onError: (e) => toast(`${m.catalog_toast_item_failed()} ${getErrorCode(e) ?? ''}`),
  });
  const activePartners = (partners.data ?? []).filter((p) => p.state === 'active');
  const pending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{item ? m.catalog_edit_title() : m.catalog_create_title()}</DialogTitle>
          <DialogDescription>{m.catalog_form_description()}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            const kind = String(data.get('kind') ?? 'ipss_donation') as CatalogItemOut['kind'];
            const valueRaw = String(data.get('donation_value_cents') ?? '').trim();
            const stockRaw = String(data.get('stock') ?? '').trim();
            const partnerRaw = String(data.get('partner_id') ?? '').trim();
            const body = {
              name: String(data.get('name') ?? '').trim(),
              kind,
              points_cost: Number(data.get('points_cost') ?? 0),
              donation_value_cents: kind === 'ipss_donation' && valueRaw ? Number(valueRaw) : null,
              partner_id: kind === 'partner_prize' && partnerRaw ? partnerRaw : null,
              description: String(data.get('description') ?? '').trim() || null,
              stock: stockRaw ? Number(stockRaw) : null,
            };
            if (item) {
              update.mutate({ path: { item_id: item.id }, body });
            } else {
              create.mutate({ body: { ...body, active: true } });
            }
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="item-name">{m.catalog_form_name()}</Label>
            <Input
              id="item-name"
              name="name"
              required
              minLength={3}
              maxLength={120}
              defaultValue={item?.name ?? ''}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="item-kind">{m.catalog_form_kind()}</Label>
              <select
                id="item-kind"
                name="kind"
                defaultValue={item?.kind ?? 'ipss_donation'}
                className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
                disabled={item !== null}
              >
                <option value="ipss_donation">{m.catalog_kind_ipss()}</option>
                <option value="partner_prize">{m.catalog_kind_partner()}</option>
                <option value="environmental">{m.catalog_kind_environmental()}</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="item-cost">{m.catalog_form_cost()}</Label>
              <Input
                id="item-cost"
                name="points_cost"
                type="number"
                min={1}
                required
                defaultValue={item?.points_cost ?? 100}
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="item-value">{m.catalog_form_value()}</Label>
              <Input
                id="item-value"
                name="donation_value_cents"
                type="number"
                min={1}
                defaultValue={item?.donation_value_cents ?? (item ? '' : 500)}
                placeholder="500"
              />
              <p className="text-muted-foreground text-xs">{m.catalog_form_value_hint()}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="item-stock">{m.catalog_form_stock()}</Label>
              <Input
                id="item-stock"
                name="stock"
                type="number"
                min={0}
                defaultValue={item?.stock ?? ''}
                placeholder={m.catalog_form_stock_hint()}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="item-partner">{m.catalog_form_partner()}</Label>
            <select
              id="item-partner"
              name="partner_id"
              defaultValue={item?.partner_id ?? ''}
              className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
            >
              <option value="">{m.catalog_form_partner_none()}</option>
              {activePartners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="item-description">{m.catalog_form_description_field()}</Label>
            <Textarea
              id="item-description"
              name="description"
              maxLength={2000}
              defaultValue={item?.description ?? ''}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} className="min-h-10">
              {m.common_cancel()}
            </Button>
            <Button type="submit" className="min-h-10" disabled={pending}>
              {pending ? m.common_saving() : m.common_save()}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// --- parceiros -------------------------------------------------------------------------------------

/** O gestor de parcerias: freguesias propõem, a Vitrus aprova — e valida o código que lhe apresentam. */
export function PartnersTable({ id }: { id: string }) {
  const query = useQuery(listCatalogPartnersOptions());
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [code, setCode] = useState('');
  const rows = useMemo(() => query.data ?? [], [query.data]);
  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: listCatalogPartnersOptions().queryKey });

  const approve = useMutation({
    ...approveCatalogPartnerMutation(),
    onSuccess: () => {
      invalidate();
      toast(m.partner_toast_approved());
    },
    onError: (e) => toast(`${m.partner_toast_failed()} ${getErrorCode(e) ?? ''}`),
  });
  const deactivate = useMutation({
    ...deactivateCatalogPartnerMutation(),
    onSuccess: () => {
      invalidate();
      toast(m.partner_toast_deactivated());
    },
    onError: (e) => toast(`${m.partner_toast_failed()} ${getErrorCode(e) ?? ''}`),
  });
  const validate = useMutation({
    ...validateRedemptionCodeMutation(),
    onSuccess: (r) => toast(`${m.validate_toast_ok()} ${r.code}`),
    onError: (e) => {
      const code = getErrorCode(e);
      toast(
        code === 'redemption_already_used'
          ? m.validate_error_already_used()
          : code === 'not_found'
            ? m.validate_error_not_found()
            : `${m.validate_error_generic()} ${code ?? ''}`,
      );
    },
  });

  const proposed = rows.filter((p) => p.state === 'proposed').length;

  const columns: Column<PartnerOut>[] = [
    {
      id: 'name',
      header: m.partner_col_name(),
      cell: (row) => <span className="font-medium">{row.name}</span>,
      value: (row) => row.name,
      primary: true,
    },
    {
      id: 'state',
      header: m.partner_col_state(),
      cell: (row) => (
        <span
          className={cn(
            'rounded-full px-2.5 py-1 text-[11px] font-medium',
            row.state === 'active' && 'bg-primary/10 text-primary',
            row.state === 'proposed' && 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
            row.state === 'inactive' && 'bg-muted text-muted-foreground',
          )}
        >
          {partnerStateLabel(row.state)}
        </span>
      ),
      value: (row) => partnerStateLabel(row.state),
      filter: true,
    },
    {
      id: 'contact',
      header: m.partner_col_contact(),
      cell: (row) => row.contact ?? <span className="text-muted-foreground">—</span>,
      value: (row) => row.contact ?? '',
      hideable: true,
    },
    {
      id: 'created',
      header: m.partner_col_since(),
      type: 'date',
      cell: (row) => <span className="text-sm tabular-nums">{formatDate(row.created_at)}</span>,
      value: (row) => row.created_at,
    },
  ];

  const rowActions = (row: PartnerOut): RowAction<PartnerOut>[] => [
    ...(row.state !== 'active'
      ? [
          {
            id: 'approve',
            label: m.partner_action_approve(),
            onSelect: (r: PartnerOut) => approve.mutate({ path: { partner_id: r.id } }),
          },
        ]
      : []),
    ...(row.state === 'active'
      ? [
          {
            id: 'pause',
            label: m.partner_action_deactivate(),
            onSelect: (r: PartnerOut) => deactivate.mutate({ path: { partner_id: r.id } }),
          },
        ]
      : []),
  ];

  return (
    <>
      {/* A validação: o parceiro apresenta o código; a equipa marca usado UMA vez (pagamento integral). */}
      <div className="ring-foreground/10 space-y-2 rounded-2xl bg-card p-4 ring-1">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <ScanSearch className="size-4" aria-hidden />
          {m.validate_title()}
        </p>
        <p className="text-muted-foreground text-xs">{m.validate_description()}</p>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim()) validate.mutate({ body: { code: code.trim() } });
            setCode('');
          }}
        >
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="RDM-XXXXXX"
            className="h-10 max-w-52 font-mono tracking-wider"
            aria-label={m.validate_title()}
          />
          <Button
            type="submit"
            size="sm"
            className="min-h-10"
            disabled={validate.isPending || !code.trim()}
          >
            {validate.isPending ? m.common_saving() : m.validate_action()}
          </Button>
        </form>
      </div>

      <DataTable
        id={id}
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        loading={query.isPending}
        refreshing={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        empty={m.partner_empty()}
        rowActions={rowActions}
        initialSort={[{ id: 'created', desc: true }]}
        views={
          proposed > 0
            ? [
                {
                  id: 'propostas',
                  label: m.partner_view_proposals({ count: proposed }),
                  state: {
                    filters: { state: { kind: 'facet', values: [m.partner_state_proposed()] } },
                  },
                },
              ]
            : undefined
        }
        actions={
          <Button type="button" size="sm" className="min-h-10" onClick={() => setCreating(true)}>
            <Handshake aria-hidden /> {m.partner_create()}
          </Button>
        }
      />
      <PartnerDialog open={creating} onClose={() => setCreating(false)} onSaved={invalidate} />
    </>
  );
}

/** Propor um parceiro (nasce `proposed`): a freguesia proponente escolhe-se na lista de freguesias. */
function PartnerDialog({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const create = useMutation({
    ...createCatalogPartnerMutation(),
    onSuccess: () => {
      onSaved();
      toast(m.partner_toast_created());
      onClose();
    },
    onError: (e) => toast(`${m.partner_toast_failed()} ${getErrorCode(e) ?? ''}`),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{m.partner_form_title()}</DialogTitle>
          <DialogDescription>{m.partner_form_description()}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            create.mutate({
              body: {
                name: String(data.get('name') ?? '').trim(),
                description: String(data.get('description') ?? '').trim() || null,
                contact: String(data.get('contact') ?? '').trim() || null,
              },
            });
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="partner-name">{m.partner_form_name()}</Label>
            <Input id="partner-name" name="name" required minLength={3} maxLength={120} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="partner-contact">{m.partner_form_contact()}</Label>
            <Input id="partner-contact" name="contact" maxLength={200} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="partner-description">{m.partner_form_about()}</Label>
            <Textarea id="partner-description" name="description" maxLength={2000} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} className="min-h-10">
              {m.common_cancel()}
            </Button>
            <Button type="submit" className="min-h-10" disabled={create.isPending}>
              {create.isPending ? m.common_saving() : m.partner_form_propose()}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// --- campanhas sazonais ----------------------------------------------------------------------------

/** As campanhas de pontos: janela temporal + descrição (informativa no MVP, sem multiplicador). */
export function CampaignsTable({ id }: { id: string }) {
  const query = useQuery(listAdminCampaignsOptions());
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CampaignOut | null>(null);
  const rows = useMemo(() => query.data ?? [], [query.data]);
  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: listAdminCampaignsOptions().queryKey });

  const columns: Column<CampaignOut>[] = [
    {
      id: 'name',
      header: m.campaign_col_name(),
      cell: (row) => <span className="font-medium">{row.name}</span>,
      value: (row) => row.name,
      primary: true,
    },
    {
      id: 'window',
      header: m.campaign_col_window(),
      cell: (row) => (
        <span className="text-sm tabular-nums">
          {formatDate(row.starts_at)} → {formatDate(row.ends_at)}
        </span>
      ),
      value: (row) => `${row.starts_at} → ${row.ends_at}`,
    },
    {
      id: 'description',
      header: m.campaign_col_description(),
      cell: (row) => (
        <span className="text-muted-foreground line-clamp-2 block max-w-96 text-sm">
          {row.description ?? '—'}
        </span>
      ),
      value: (row) => row.description ?? '',
      full: true,
    },
  ];

  const rowActions = (): RowAction<CampaignOut>[] => [
    { id: 'edit', label: m.catalog_action_edit(), onSelect: (r) => setEditing(r) },
  ];

  return (
    <>
      <DataTable
        id={id}
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        loading={query.isPending}
        refreshing={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        empty={m.campaign_empty()}
        rowActions={rowActions}
        initialSort={[{ id: 'window', desc: true }]}
        actions={
          <Button type="button" size="sm" className="min-h-10" onClick={() => setCreating(true)}>
            <Plus aria-hidden /> {m.campaign_create()}
          </Button>
        }
      />
      <CampaignDialog
        open={creating || editing !== null}
        campaign={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSaved={invalidate}
      />
    </>
  );
}

function CampaignDialog({
  open,
  campaign,
  onClose,
  onSaved,
}: {
  open: boolean;
  campaign: CampaignOut | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const create = useMutation({
    ...createPointCampaignMutation(),
    onSuccess: () => {
      onSaved();
      toast(m.campaign_toast_created());
      onClose();
    },
    onError: (e) => toast(`${m.campaign_toast_failed()} ${getErrorCode(e) ?? ''}`),
  });
  const update = useMutation({
    ...updatePointCampaignMutation(),
    onSuccess: () => {
      onSaved();
      toast(m.campaign_toast_updated());
      onClose();
    },
    onError: (e) => toast(`${m.campaign_toast_failed()} ${getErrorCode(e) ?? ''}`),
  });
  const pending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {campaign ? m.campaign_edit_title() : m.campaign_create_title()}
          </DialogTitle>
          <DialogDescription>{m.campaign_form_description()}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            const body = {
              name: String(data.get('name') ?? '').trim(),
              description: String(data.get('description') ?? '').trim() || null,
              starts_at: new Date(String(data.get('starts_at'))).toISOString(),
              ends_at: new Date(String(data.get('ends_at'))).toISOString(),
            };
            if (campaign) {
              update.mutate({ path: { campaign_id: campaign.id }, body });
            } else {
              create.mutate({ body });
            }
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="campaign-name">{m.campaign_form_name()}</Label>
            <Input
              id="campaign-name"
              name="name"
              required
              minLength={3}
              maxLength={120}
              defaultValue={campaign?.name ?? ''}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="campaign-starts">{m.campaign_form_starts()}</Label>
              <Input
                id="campaign-starts"
                name="starts_at"
                type="datetime-local"
                required
                defaultValue={campaign?.starts_at?.slice(0, 16) ?? ''}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="campaign-ends">{m.campaign_form_ends()}</Label>
              <Input
                id="campaign-ends"
                name="ends_at"
                type="datetime-local"
                required
                defaultValue={campaign?.ends_at?.slice(0, 16) ?? ''}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="campaign-description">{m.campaign_col_description()}</Label>
            <Textarea
              id="campaign-description"
              name="description"
              maxLength={2000}
              defaultValue={campaign?.description ?? ''}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} className="min-h-10">
              {m.common_cancel()}
            </Button>
            <Button type="submit" className="min-h-10" disabled={pending}>
              {pending ? m.common_saving() : m.common_save()}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
