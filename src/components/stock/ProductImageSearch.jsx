import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ImageIcon, Loader2, RotateCcw, Search, X, ZoomIn } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { nexoApi } from '@/api/nexoApi';

const EMPTY_MESSAGE = 'Nenhuma imagem foi encontrada. Tente um nome mais simples ou retire detalhes da pesquisa.';

const initialSearch = productName => {
  const name = String(productName || '').trim();
  return name ? `${name} fundo branco` : '';
};

export default function ProductImageSearch({ productName, onSelect, onClose }) {
  const [query, setQuery] = useState(() => initialSearch(productName));
  const [searchedQuery, setSearchedQuery] = useState('');
  const [images, setImages] = useState([]);
  const [selected, setSelected] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const inputRef = useRef(null);
  const requestIdRef = useRef(0);

  const normalizedInitialQuery = useMemo(() => initialSearch(productName), [productName]);

  const loadImages = async ({ search = query, pageNumber = 1, append = false } = {}) => {
    const cleanQuery = String(search || '').trim();
    if (!cleanQuery) {
      toast.error('Digite o nome do produto para pesquisar.');
      inputRef.current?.focus();
      return;
    }

    const requestId = ++requestIdRef.current;
    setLoading(true);
    if (!append) {
      setImages([]);
      setSelected(null);
      setPreview(null);
    }
    try {
      const data = await nexoApi.productImages.search({ query: cleanQuery, page: pageNumber });
      if (requestId !== requestIdRef.current) return;
      setSearchedQuery(data.query || cleanQuery);
      setHasMore(Boolean(data.hasMore));
      setPage(pageNumber);
      setImages(current => {
        const next = append ? [...current, ...(data.results || [])] : (data.results || []);
        return next.filter((image, index, all) => all.findIndex(item => item.url === image.url) === index);
      });
      if (!append && !(data.results || []).length) toast(EMPTY_MESSAGE, { icon: 'ℹ️' });
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      if (!append) setImages([]);
      toast.error(error.message || 'Não foi possível buscar imagens.');
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    const automaticQuery = normalizedInitialQuery;
    setQuery(automaticQuery);
    if (automaticQuery) loadImages({ search: automaticQuery, pageNumber: 1, append: false });
    else window.setTimeout(() => inputRef.current?.focus(), 50);
    // A pesquisa automática deve acontecer somente ao abrir/trocar o produto.
  }, [normalizedInitialQuery]);

  const submitSearch = event => {
    event?.preventDefault();
    loadImages({ search: query, pageNumber: 1, append: false });
  };

  const useImage = async image => {
    const target = image || selected || preview;
    if (!target) return;
    setSaving(true);
    try {
      const imported = await nexoApi.media.importProductImage(target.url, productName || searchedQuery || 'produto');
      onSelect(imported.url);
      onClose();
      toast.success('Imagem adicionada ao produto.');
    } catch (error) {
      toast.error(error.message || 'Não foi possível salvar a imagem selecionada.');
    } finally {
      setSaving(false);
    }
  };

  const searchAgain = () => {
    setPreview(null);
    setSelected(null);
    window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 50);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/65 p-3 sm:p-4" role="presentation">
      <div className="flex max-h-[94dvh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-border bg-card text-card-foreground shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="product-image-search-title">
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
          <div>
            <h2 id="product-image-search-title" className="flex items-center gap-2 text-lg font-bold"><ImageIcon className="h-5 w-5 text-accent" /> Buscar imagem do produto</h2>
            <p className="mt-1 text-xs text-muted-foreground">A busca começa automaticamente pelo nome e prioriza resultados com fundo branco.</p>
          </div>
          <button type="button" aria-label="Fechar busca de imagens" onClick={onClose} disabled={saving} className="grid h-10 w-10 flex-none place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"><X className="h-5 w-5" /></button>
        </div>

        <form onSubmit={submitSearch} className="border-b border-border bg-muted/20 p-4 sm:px-6">
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative flex-1">
              <span className="sr-only">Pesquisar outra imagem</span>
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input ref={inputRef} value={query} onChange={event => setQuery(event.target.value)} placeholder="Pesquisar outra imagem..." className="h-12 w-full rounded-xl border border-border bg-background pl-10 pr-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" />
            </label>
            <button type="submit" disabled={loading || !query.trim()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-accent px-5 text-sm font-bold text-accent-foreground hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Pesquisar
            </button>
          </div>
          {searchedQuery && <p className="mt-2 truncate text-xs text-muted-foreground">Resultados para: <strong className="text-foreground">{searchedQuery}</strong></p>}
        </form>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {loading && images.length === 0 ? (
            <div className="grid min-h-72 place-items-center text-muted-foreground"><div className="text-center"><Loader2 className="mx-auto h-7 w-7 animate-spin text-accent" /><p className="mt-3 text-sm font-semibold">Buscando imagens...</p></div></div>
          ) : images.length === 0 ? (
            <div className="grid min-h-72 place-items-center rounded-2xl border border-dashed border-border bg-muted/20 px-6 text-center"><div><Search className="mx-auto h-10 w-10 text-muted-foreground/40" /><p className="mt-3 max-w-md text-sm text-muted-foreground">{query.trim() ? EMPTY_MESSAGE : 'Digite o nome do produto para começar.'}</p></div></div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {images.map((image, index) => {
                  const active = selected?.url === image.url;
                  return (
                    <button key={`${image.url}-${index}`} type="button" onClick={() => { setSelected(image); setPreview(image); }} className={`group overflow-hidden rounded-2xl border bg-background text-left transition hover:-translate-y-0.5 hover:shadow-md ${active ? 'border-accent ring-2 ring-accent/20' : 'border-border hover:border-accent/50'}`}>
                      <span className="relative block aspect-square overflow-hidden bg-white">
                        <img src={image.thumbnailUrl || image.url} alt={image.title || productName || 'Resultado da pesquisa'} className="h-full w-full object-contain p-2" loading="lazy" />
                        <span className="absolute inset-0 grid place-items-center bg-black/0 transition group-hover:bg-black/10"><span className="grid h-10 w-10 scale-90 place-items-center rounded-full bg-card/95 text-foreground opacity-0 shadow-lg transition group-hover:scale-100 group-hover:opacity-100"><ZoomIn className="h-5 w-5" /></span></span>
                        {active && <span className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-accent text-accent-foreground shadow"><Check className="h-4 w-4" /></span>}
                      </span>
                      <span className="block p-3"><span className="line-clamp-2 min-h-8 text-xs font-semibold">{image.title || searchedQuery}</span><span className="mt-1 block truncate text-[10px] text-muted-foreground">{image.source || 'Resultado da pesquisa'}</span></span>
                    </button>
                  );
                })}
              </div>

              {hasMore && (
                <div className="mt-5 flex justify-center"><button type="button" onClick={() => loadImages({ search: searchedQuery || query, pageNumber: page + 1, append: true })} disabled={loading} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-accent px-5 text-sm font-bold text-accent hover:bg-accent/10 disabled:opacity-50">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Carregar mais</button></div>
              )}
            </>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:justify-between sm:px-6">
          <button type="button" onClick={searchAgain} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-bold hover:bg-muted"><RotateCcw className="h-4 w-4" /> Pesquisar novamente</button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <button type="button" onClick={onClose} disabled={saving} className="min-h-11 rounded-xl border border-border px-4 text-sm font-bold hover:bg-muted disabled:opacity-50">Cancelar</button>
            <button type="button" onClick={() => useImage()} disabled={!selected || saving} className="inline-flex min-h-11 min-w-40 items-center justify-center gap-2 rounded-xl bg-accent px-5 text-sm font-bold text-accent-foreground hover:bg-accent/90 disabled:bg-muted disabled:text-muted-foreground">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {saving ? 'Salvando...' : 'Usar imagem'}</button>
          </div>
        </div>
      </div>

      {preview && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/85 p-4" role="presentation" onMouseDown={event => event.target === event.currentTarget && !saving && setPreview(null)}>
          <div className="flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-white/15 bg-card shadow-2xl" role="dialog" aria-modal="true" aria-label="Pré-visualização da imagem">
            <div className="flex items-center justify-between border-b border-border px-5 py-4"><div><h3 className="font-bold">Pré-visualização</h3><p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{preview.title || searchedQuery}</p></div><button type="button" onClick={() => setPreview(null)} disabled={saving} className="grid h-10 w-10 place-items-center rounded-xl text-muted-foreground hover:bg-muted"><X className="h-5 w-5" /></button></div>
            <div className="grid min-h-0 flex-1 place-items-center overflow-auto bg-white p-4 sm:p-8"><img src={preview.url} alt={preview.title || productName || 'Imagem do produto'} className="max-h-[60dvh] max-w-full object-contain" /></div>
            <div className="flex flex-col-reverse gap-2 border-t border-border p-4 sm:flex-row sm:justify-end sm:px-5"><button type="button" onClick={searchAgain} disabled={saving} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-bold hover:bg-muted"><RotateCcw className="h-4 w-4" /> Pesquisar novamente</button><button type="button" onClick={() => useImage(preview)} disabled={saving} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent px-5 text-sm font-bold text-accent-foreground hover:bg-accent/90 disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Usar imagem</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
