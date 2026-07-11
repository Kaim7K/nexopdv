import React, { useEffect, useState } from 'react';
import { Check, ExternalLink, ImageIcon, Loader2, Search, X, ZoomIn } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { nexoApi } from '@/api/nexoApi';

const EMPTY_MESSAGE = 'Nenhuma imagem adequada foi encontrada para este produto. Tente revisar o nome, código de barras ou categoria.';

export default function ProductImageSearch({ barcode, productName, category, onSelect, onClose }) {
  const [images, setImages] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [preview, setPreview] = useState(null);
  const [providers, setProviders] = useState(null);

  const loadImages = async (pageNumber, append = false) => {
    setLoading(true);
    try {
      const data = await nexoApi.productImages.search({
        barcode: barcode || '',
        name: productName || '',
        category: category || '',
        page: pageNumber,
      });
      setProviders(data.providers || null);
      setHasMore(Boolean(data.hasMore));
      setPage(pageNumber);
      setImages(current => {
        const next = append ? [...current, ...(data.results || [])] : (data.results || []);
        return next.filter((image, index, all) => all.findIndex(item => item.url === image.url) === index);
      });
      if (!append && !(data.results || []).length) toast(EMPTY_MESSAGE, { icon: 'ℹ️' });
    } catch (error) {
      toast.error(error.message || 'Não foi possível buscar imagens.');
      if (!append) setImages([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadImages(1, false);
    // Search is intentionally refreshed whenever the product identification changes.
  }, [barcode, productName, category]);

  const confirmSelection = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const imported = await nexoApi.media.importProductImage(selected.url, productName || 'produto');
      onSelect(imported.url);
      onClose();
      toast.success('Imagem salva no produto.');
    } catch (error) {
      if (error.code === 'BLOB_NOT_CONFIGURED' || error.status === 503) {
        onSelect(selected.url);
        onClose();
        toast.success('Imagem vinculada por URL. Conecte o Vercel Blob depois para armazenar uma cópia própria.');
        return;
      }
      toast.error(error.message || 'Não foi possível salvar a imagem selecionada.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/65 p-4">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <ImageIcon className="h-5 w-5 text-accent" /> Buscar imagem do produto
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Prioridade: produto isolado, fundo transparente ou branco. Fotos de catálogo aparecem só como alternativa.
            </p>
          </div>
          <button aria-label="Fechar" onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          {loading && images.length === 0 ? (
            <div className="flex min-h-64 items-center justify-center text-muted-foreground">
              <Loader2 className="mr-2 h-6 w-6 animate-spin" /> Buscando imagens adequadas...
            </div>
          ) : images.length === 0 ? (
            <div className="grid min-h-64 place-items-center rounded-xl border border-dashed border-border bg-muted/20 px-6 text-center">
              <div>
                <Search className="mx-auto mb-3 h-9 w-9 text-muted-foreground/50" />
                <p className="max-w-lg text-sm text-muted-foreground">{EMPTY_MESSAGE}</p>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {images.map((image, index) => {
                  const active = selected?.url === image.url;
                  return (
                    <article key={`${image.url}-${index}`} className={`overflow-hidden rounded-xl border bg-background transition ${active ? 'border-accent ring-2 ring-accent/25' : 'border-border hover:border-accent/50'}`}>
                      <button type="button" onClick={() => setSelected(image)} className="relative block aspect-square w-full overflow-hidden bg-white">
                        <img src={image.thumbnailUrl || image.url} alt={image.title || productName} className="h-full w-full object-contain p-2" loading="lazy" />
                        {active && (
                          <span className="absolute inset-0 grid place-items-center bg-accent/15">
                            <span className="grid h-9 w-9 place-items-center rounded-full bg-accent text-accent-foreground shadow-lg">
                              <Check className="h-5 w-5" />
                            </span>
                          </span>
                        )}
                        <span className="absolute left-2 top-2 rounded-md bg-black/65 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                          {image.background === 'transparent' ? 'Transparente' : image.background === 'white' ? 'Fundo branco' : 'Catálogo'}
                        </span>
                      </button>
                      <div className="space-y-2 p-2.5">
                        <p title={image.title} className="line-clamp-2 min-h-8 text-xs font-medium">{image.title || productName}</p>
                        <div className="flex items-center justify-between gap-1">
                          {image.sourceUrl ? (
                            <a href={image.sourceUrl} target="_blank" rel="noreferrer" title={image.source} className="min-w-0 truncate text-[10px] text-muted-foreground hover:text-accent">
                              {image.source}
                            </a>
                          ) : <span className="min-w-0 truncate text-[10px] text-muted-foreground">{image.source}</span>}
                          <button type="button" aria-label="Visualizar imagem" onClick={() => setPreview(image)} className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                            <ZoomIn className="h-4 w-4" />
                          </button>
                        </div>
                        <button type="button" onClick={() => setSelected(image)} className={`w-full rounded-lg px-2 py-1.5 text-xs font-semibold ${active ? 'bg-accent text-accent-foreground' : 'border border-border hover:bg-muted'}`}>
                          {active ? 'Selecionada' : 'Selecionar'}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>

              <div className="mt-5 flex flex-col items-center gap-2">
                {hasMore && (
                  <button type="button" onClick={() => loadImages(page + 1, true)} disabled={loading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-accent px-5 py-2 text-sm font-semibold text-accent hover:bg-accent/10 disabled:opacity-50">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    Buscar mais imagens
                  </button>
                )}
                {providers && !providers.googleCustomSearch && (
                  <p className="text-center text-[11px] text-muted-foreground">
                    Busca ampliada indisponível: configure GOOGLE_CSE_API_KEY e GOOGLE_CSE_ID na Vercel para encontrar imagens limpas como packshots.
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4 sm:px-6">
          <button type="button" onClick={onClose} className="min-h-11 rounded-xl border border-border px-4 text-sm font-semibold hover:bg-muted">Cancelar</button>
          <button type="button" onClick={confirmSelection} disabled={!selected || saving} className="inline-flex min-h-11 min-w-48 items-center justify-center gap-2 rounded-xl bg-accent px-5 text-sm font-bold text-accent-foreground hover:bg-accent/90 disabled:bg-muted disabled:text-muted-foreground">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {saving ? 'Salvando imagem...' : 'Usar imagem selecionada'}
          </button>
        </div>
      </div>

      {preview && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/85 p-5" onClick={() => setPreview(null)}>
          <div className="relative max-h-full max-w-4xl" onClick={event => event.stopPropagation()}>
            <img src={preview.url} alt={preview.title || productName} className="max-h-[82vh] max-w-full rounded-xl bg-white object-contain p-3 shadow-2xl" />
            <div className="mt-2 flex items-center justify-between text-sm text-white">
              <span className="truncate">{preview.title}</span>
              {preview.sourceUrl && <a href={preview.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">Fonte <ExternalLink className="h-3.5 w-3.5" /></a>}
            </div>
            <button type="button" aria-label="Fechar visualização" onClick={() => setPreview(null)} className="absolute -right-3 -top-3 rounded-full bg-white p-2 text-black shadow-lg"><X className="h-5 w-5" /></button>
          </div>
        </div>
      )}
    </div>
  );
}
