import React from 'react';
import { Minus } from 'lucide-react';

const COLORS = [
  'bg-blue-500', 'bg-purple-500', 'bg-teal-500', 'bg-amber-500', 'bg-rose-500', 'bg-indigo-500',
];

export default function MinimizedSalesBar({ sales, onRestore, onDiscard }) {
  if (sales.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 flex gap-2 z-40">
      {sales.map((sale, idx) => {
        const color = COLORS[idx % COLORS.length];
        const total = (sale.items || []).reduce((sum, item) => sum + (item.subtotal || 0), 0);
        return (
          <div key={sale._localId || idx} className="relative group">
            <button onClick={() => onRestore(idx)}
              className={`${color} text-white rounded-lg shadow-lg px-4 py-3 flex flex-col items-center min-w-[80px] hover:scale-105 transition-transform`}>
              <span className="text-xs font-medium opacity-90">Venda</span>
              <span className="text-lg font-bold">#{sale.sale_number || idx + 1}</span>
              <span className="text-xs opacity-90">{sale.items?.length || 0} itens</span>
              <span className="text-sm font-semibold">R$ {total.toFixed(2)}</span>
            </button>
            <button onClick={(e) => { e.stopPropagation(); onDiscard(idx); }}
              className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Minus className="w-3 h-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}