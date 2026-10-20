import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { m } from '@/paraglide/messages';

/** Referência do pedido com copiar: é o que a pessoa envia à equipa para encontrarmos o erro nos logs. */
export function ErrorReference({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sem permissão para a área de transferência: a referência continua visível e selecionável.
    }
  };
  return (
    <div className="flex items-center justify-center gap-1 text-xs">
      <span className="text-muted-foreground">{m.err_ref_label()}</span>
      <code className="select-all rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">
        {value}
      </code>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-10"
        onClick={() => void copy()}
        aria-label={m.err_ref_copy()}
      >
        {copied ? (
          <Check className="size-4" aria-hidden="true" />
        ) : (
          <Copy className="size-4" aria-hidden="true" />
        )}
      </Button>
      <span role="status" className="sr-only">
        {copied ? m.err_ref_copied() : ''}
      </span>
    </div>
  );
}
