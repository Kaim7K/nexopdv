import React, { useRef, useState } from 'react';
import { ImageIcon, Loader2, Trash2, Upload } from 'lucide-react';
import { upload } from '@vercel/blob/client';
import { toast } from 'react-hot-toast';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const MAX_SIZE = 8 * 1024 * 1024;

const safeFileName = value => String(value || 'imagem')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')
  .slice(0, 60) || 'imagem';

const blobHelp = 'Conecte um Blob Store em Vercel > Storage e faça redeploy para gerar BLOB_READ_WRITE_TOKEN.';

export default function ImageUploadField({
  value,
  onChange,
  kind = 'product',
  scopeId,
  label = 'Imagem',
  name = 'imagem',
  previewClassName = 'h-20 w-20 rounded-xl',
  objectFit = 'contain',
}) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleUpload = async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error('Use uma imagem JPG, PNG, WEBP ou AVIF.');
      return;
    }
    if (file.size > MAX_SIZE) {
      toast.error('A imagem deve ter no máximo 8 MB.');
      return;
    }
    if (!scopeId) {
      toast.error('Não foi possível identificar o destino do upload.');
      return;
    }

    setUploading(true);
    setProgress(0);
    try {
      const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const folder = { product: 'products', market: 'markets', user: 'users' }[kind] || 'images';
      const pathname = `${folder}/${scopeId}/${Date.now()}-${safeFileName(name || file.name)}.${extension}`;
      const blob = await upload(pathname, file, {
        access: 'public',
        handleUploadUrl: '/api/media/upload',
        clientPayload: JSON.stringify({ kind }),
        contentType: file.type,
        onUploadProgress: current => setProgress(Math.round(current.percentage || 0)),
      });
      onChange(blob.url);
      toast.success('Imagem enviada.');
    } catch (error) {
      toast.error(error.code === 'BLOB_NOT_CONFIGURED' ? blobHelp : error.message || 'Não foi possível enviar a imagem.');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="flex items-center gap-3">
        <div className={`${previewClassName} grid flex-shrink-0 place-items-center overflow-hidden border border-border bg-white`}>
          {value ? (
            <img src={value} alt={label} className={`h-full w-full ${objectFit === 'cover' ? 'object-cover' : 'object-contain p-1'}`} />
          ) : (
            <ImageIcon className="h-7 w-7 text-muted-foreground/45" />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-accent px-3 text-sm font-bold text-accent-foreground hover:bg-accent/90 disabled:opacity-50">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? `${progress}%` : 'Enviar'}
            </button>
            {value && (
              <button type="button" onClick={() => onChange('')} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-border px-3 text-sm font-semibold text-destructive hover:bg-destructive/10">
                <Trash2 className="h-4 w-4" /> Remover
              </button>
            )}
          </div>
          <input ref={inputRef} hidden type="file" accept={ACCEPTED_TYPES.join(',')} onChange={handleUpload} />
          <input type="url" value={value || ''} onChange={event => onChange(event.target.value)} placeholder="ou cole uma URL https://" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
          <p className="text-[11px] text-muted-foreground">JPG, PNG, WEBP ou AVIF até 8 MB. {blobHelp}</p>
        </div>
      </div>
    </div>
  );
}
