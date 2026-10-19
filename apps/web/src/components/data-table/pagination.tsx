import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { m } from '@/paraglide/messages';
import { PAGE_SIZES } from './use-table-state';

interface PaginationProps {
  page: number;
  pageCount: number;
  size: number;
  matched: number;
  total: number;
  showPager: boolean;
  onPage: (page: number) => void;
  onSize: (size: number) => void;
}

export function TablePagination({
  page,
  pageCount,
  size,
  matched,
  total,
  showPager,
  onPage,
  onSize,
}: PaginationProps) {
  const from = matched === 0 ? 0 : page * size + 1;
  const to = Math.min(matched, (page + 1) * size);
  const nav = 'size-10';

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 text-sm">
      <p className="text-muted-foreground tabular-nums" aria-live="polite">
        {m.table_showing({ from, to, matched })}
        {matched !== total && ` · ${m.table_filtered_of({ total })}`}
      </p>

      {showPager && (
        <div className="flex items-center gap-4">
          <div className="hidden items-center gap-2 sm:flex">
            <span className="text-muted-foreground">{m.table_rows_per_page()}</span>
            <Select value={String(size)} onValueChange={(v) => onSize(Number(v))}>
              <SelectTrigger className="h-10 w-20" aria-label={m.table_rows_per_page()}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((s) => (
                  <SelectItem key={s} value={String(s)}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="min-w-24 text-center text-muted-foreground tabular-nums">
            {m.table_page_of({ page: page + 1, pages: pageCount })}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className={`${nav} hidden sm:inline-flex`}
              disabled={page === 0}
              onClick={() => onPage(0)}
              aria-label={m.table_first()}
            >
              <ChevronsLeft />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className={nav}
              disabled={page === 0}
              onClick={() => onPage(page - 1)}
              aria-label={m.table_prev()}
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className={nav}
              disabled={page >= pageCount - 1}
              onClick={() => onPage(page + 1)}
              aria-label={m.table_next()}
            >
              <ChevronRight />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className={`${nav} hidden sm:inline-flex`}
              disabled={page >= pageCount - 1}
              onClick={() => onPage(pageCount - 1)}
              aria-label={m.table_last()}
            >
              <ChevronsRight />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
