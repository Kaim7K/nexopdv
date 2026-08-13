import React, { useRef, useState } from 'react';
import { ImageIcon, Loader2, Trash2, Upload } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { isSupportedImageFile, optimizeImageFile } from '@/lib/image-file';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const MAX_SIZE = 8 * 1024 * 1024;

export default function ImageUploadField({
  value,
  onChange,
  kind = 'product',
  scopeId = null,
  label = 'Imagem',
  name = 'imagem',
  previewClassName = 'h-16 w-16 rounded-lg',
  objectFit = 'contain',
  capture = undefined,
}) {
  void scopeId;
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleUpload = async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!isSupportedImageFile(file)) {
      toast.error('Use JPG, PNG, WEBP ou AVIF.');
      return;
    }
    if (file.size > MAX_SIZE) {
      toast.error('Imagem acima de 8 MB.');
      return;
    }
    setUploading(true);
    setProgress(1);
    try {
      const optimizedImage = await optimizeImageFile(file, { kind, onProgress: setProgress });
      onChange(optimizedImage);
      toast.success(`${name || label} carregada.`);
    } catch (error) {
      toast.error(error?.message || 'Nao foi possivel processar a imagem.');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-muted-foreground">{label}</label>
      <div className="flex gap-2">
        <div className={`${previewClassName} grid flex-shrink-0 place-items-center overflow-hidden border border-border bg-white`}>
          {value ? (
            <img src={value} alt={label} decoding="async" className={`h-full w-full ${objectFit === 'cover' ? 'object-cover' : 'object-contain p-1'}`} />
          ) : (
            <ImageIcon className="h-6 w-6 text-muted-foreground/45" />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-accent px-3 text-sm font-bold text-accent-foreground transition hover:bg-accent/90 disabled:cursor-wait disabled:opacity-60">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? `${Math.max(1, progress)}%` : 'Carregar'}
            </button>
            {value && !uploading && (
              <button type="button" onClick={() => onChange('')} className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-border px-3 text-sm font-semibold text-destructive transition hover:bg-destructive/10">
                <Trash2 className="h-4 w-4" /> Remover
              </button>
            )}
          </div>
          <input ref={inputRef} hidden type="file" accept={ACCEPTED_TYPES.join(',')} capture={capture} onChange={handleUpload} />
          <input type="url" value={value?.startsWith('data:') ? '' : value || ''} onChange={event => onChange(event.target.value)} placeholder={value?.startsWith('data:') ? 'Imagem carregada' : 'URL https://'} disabled={uploading || value?.startsWith('data:')} className="h-9 w-full rounded-lg border border-border bg-background px-2.5 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:text-muted-foreground" />
        </div>
      </div>
    </div>
  );
}
