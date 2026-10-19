import { Camera, RotateCcw } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { shrinkImage } from '@/lib/image';
import { cn } from '@/lib/utils';

interface PhotoInputProps {
  label: string;
  hint: string;
  value: File | null;
  onChange: (file: File | null) => void;
  required?: boolean;
  removeLabel: string;
}

/** Botão grande para fotografar (abre a câmara no telemóvel) com pré-visualização. */
export function PhotoInput({
  label,
  hint,
  value,
  onChange,
  required,
  removeLabel,
}: PhotoInputProps) {
  const id = useId();
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!value) return setPreview(null);
    const url = URL.createObjectURL(value);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block font-medium text-sm">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      <div
        className={cn(
          'relative grid aspect-[4/3] place-items-center overflow-hidden rounded-xl border-2 border-dashed bg-muted/40',
          value && 'border-solid border-primary/40',
        )}
      >
        {preview ? (
          <img src={preview} alt={label} className="size-full object-cover" />
        ) : (
          <label
            htmlFor={id}
            className="flex cursor-pointer flex-col items-center gap-2 p-4 text-center text-muted-foreground text-sm"
          >
            <Camera className="size-8" aria-hidden="true" />
            {hint}
          </label>
        )}
        <input
          id={id}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) onChange(await shrinkImage(file));
          }}
        />
      </div>
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5"
          onClick={() => onChange(null)}
        >
          <RotateCcw className="size-3.5" /> {removeLabel}
        </Button>
      )}
    </div>
  );
}
