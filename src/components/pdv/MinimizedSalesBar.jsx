import React from 'react';
import { Draggable, DragDropContext, Droppable } from '@hello-pangea/dnd';
import { GripVertical, Minus } from 'lucide-react';
import { formatCurrency } from '@/lib/helpers';

const COLORS = [
  'bg-blue-600',
  'bg-purple-600',
  'bg-teal-600',
  'bg-amber-600',
  'bg-rose-600',
  'bg-indigo-600',
];

export default function MinimizedSalesBar({ sales, onRestore, onDiscard, onReorder }) {
  if (!sales.length) return null;

  const handleDragEnd = result => {
    if (!result.destination || result.destination.index === result.source.index) return;
    onReorder(result.source.index, result.destination.index);
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Droppable droppableId="minimized-sales" direction="vertical">
        {provided => (
          <div ref={provided.innerRef} {...provided.droppableProps} className="fixed right-3 top-24 z-40 flex max-h-[calc(100vh-120px)] w-[108px] flex-col gap-2 overflow-y-auto overflow-x-hidden pb-3 pr-1">
            {sales.map((sale, index) => {
              const color = COLORS[(Number(sale.temporary_number || index + 1) - 1) % COLORS.length];
              const total = (sale.items || []).reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
              return (
                <Draggable key={String(sale._localId)} draggableId={String(sale._localId)} index={index}>
                  {(dragProvided, snapshot) => (
                    <div ref={dragProvided.innerRef} {...dragProvided.draggableProps} style={dragProvided.draggableProps.style} className={`relative rounded-xl shadow-lg ${snapshot.isDragging ? 'ring-2 ring-white/70' : ''}`}>
                      <button
                        type="button"
                        onClick={() => onRestore(index)}
                        className={`${color} flex min-h-[104px] w-full flex-col items-center justify-center rounded-xl px-2 py-3 text-white transition hover:brightness-110`}
                        title="Abrir esta venda sem precisar minimizar a atual"
                      >
                        <span className="text-[11px] font-semibold uppercase tracking-wide opacity-85">Venda aberta</span>
                        <span className="text-2xl font-black">#{sale.temporary_number}</span>
                        <span className="text-[11px] opacity-90">{sale.items?.length || 0} itens</span>
                        <span className="mt-1 text-sm font-black tabular-nums">{formatCurrency(total)}</span>
                      </button>
                      <button
                        type="button"
                        aria-label="Mover venda"
                        {...dragProvided.dragHandleProps}
                        className="absolute left-1 top-1 grid h-7 w-7 place-items-center rounded-lg bg-black/25 text-white hover:bg-black/40"
                        title="Arraste para reorganizar"
                      >
                        <GripVertical className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="Descartar venda minimizada"
                        onClick={event => { event.stopPropagation(); onDiscard(index); }}
                        className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-lg bg-black/25 text-white hover:bg-destructive"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </Draggable>
              );
            })}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}
