import React from 'react';

export const LOGO_URL = 'https://media.base44.com/images/public/user_69e5151266e509211dfb8669/e253fd66c_MA-Logo1.png';

export const formatCurrency = (value) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
};

export const formatDate = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('pt-BR');
};

export const formatDateTime = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
};

export const generateInternalCode = () => {
  return 'MA' + Date.now().toString().slice(-6);
};

export const PAYMENT_METHODS = [
  { method: 'dinheiro', label: 'Dinheiro', color: 'bg-green-100 text-green-800 border-green-300' },
  { method: 'debito', label: 'Cartão de Débito', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  { method: 'credito', label: 'Cartão de Crédito', color: 'bg-purple-100 text-purple-800 border-purple-300' },
  { method: 'pix', label: 'Pix', color: 'bg-teal-100 text-teal-800 border-teal-300' },
  { method: 'outros', label: 'Outros', color: 'bg-gray-100 text-gray-800 border-gray-300' },
  { method: 'fiado', label: 'Venda Fiado', color: 'bg-orange-100 text-orange-800 border-orange-300' },
];

export const getPaymentLabel = (method) => {
  const pm = PAYMENT_METHODS.find(p => p.method === method);
  return pm ? pm.label : method;
};

export const calculateSaleTotals = (sale) => {
  const subtotal = (sale.items || []).reduce((sum, item) => sum + (item.subtotal || 0), 0);
  let discount = sale.discount_value || 0;
  if (sale.discount_type === 'percentual') {
    discount = subtotal * (discount / 100);
  }
  const total = Math.max(0, subtotal - discount);
  const totalItems = (sale.items || []).reduce((sum, item) => sum + (item.quantity || (item.weight ? 1 : 0)), 0);
  return { subtotal, discount, total, totalItems };
};