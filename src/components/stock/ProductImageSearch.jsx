import React, { useState } from 'react';
import { Loader2, Check, ImageIcon, X, ZoomIn } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function ProductImageSearch({ barcode, productName, category, onSelect, onClose }) {
  const [images, setImages] = useState([]);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [previewUrl, setPreviewUrl] = useState('');

  const doSearch = async (pageNum = 1) => {
    setLoading(true);
    try {
      const query = barcode || productName;
      if (!query) { toast.error('Informe nome ou código de barras'); setLoading(false); return; }
      const res = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=${pageNum === 1 ? 5 : 5}&page=${pageNum}`);
      const data = await res.json();
      const found = [];
      if (data.products) {
        data.products.forEach(p => {
          if (p.image_url) found.push({ url: p.image_url, source: 'Open Food Facts', name: p.product_name });
        });
      }
      if (pageNum === 1) setImages(found.slice(0, 5));
      else setImages(prev => [...prev, ...found].slice(0, 10));
      if (found.length === 0 && pageNum === 1) {
        toast('Nenhuma imagem adequada foi encontrada. Tente revisar o nome, código de barras ou categoria.', { icon: 'ℹ️' });
      }
    } catch { toast.error('Erro ao buscar imagens'); }
    setLoading(false);
  };

  React.useEffect(() => { doSearch(1); }, []);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-bold flex items-center gap-2"><ImageIcon className="w-5 h-5 text-accent" /> Busca de Imagens</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin mr-2" /> Buscando imagens...
            </div>
          ) : images.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Nenhuma imagem adequada foi encontrada para este produto.<br />
              Tente revisar o nome, código de barras ou categoria.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                {images.map((img, i) => (
                  <div key={i} className="relative group">
                    <button onClick={() => setSelected(img.url)}
                      className={`w-full aspect-square rounded-lg overflow-hidden border-2 ${selected === img.url ? 'border-accent' : 'border-border'}`}>
                      <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
                    </button>
                    <button onClick={() => setPreviewUrl(img.url)}
                      className="absolute top-1 right-1 w-6 h-6 bg-black/50 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                    {selected === img.url && (
                      <div className="absolute inset-0 bg-accent/20 flex items-center justify-center">
                        <Check className="w-6 h-6 text-white" />
                      </div>
                    )}
                    <div className="text-[10px] text-muted-foreground text-center mt-1 truncate">{img.source}</div>
                  </div>
                ))}
              </div>
              {images.length < 10 && (
                <button onClick={() => { setPage(page + 1); doSearch(page + 1); }} disabled={loading}
                  className="mt-4 w-full py-2 text-sm text-accent border border-accent rounded-lg hover:bg-accent/5">
                  Buscar mais imagens
                </button>
              )}
            </>
          )}
        </div>
        {images.length > 0 && (
          <div className="flex gap-2 px-6 py-4 border-t">
            <button onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-secondary">Cancelar</button>
            <button onClick={() => { onSelect(selected); onClose(); }} disabled={!selected}
              className="flex-1 px-4 py-2 rounded-lg bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-40 text-sm font-bold">Confirmar Imagem</button>
          </div>
        )}
      </div>
      {previewUrl && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4" onClick={() => setPreviewUrl('')}>
          <img src={previewUrl} alt="" className="max-w-full max-h-full rounded-lg" />
        </div>
      )}
    </div>
  );
}