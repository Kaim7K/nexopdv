import React from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatCurrency, formatDate } from '@/lib/helpers';

const COLORS = [
  '#16a06a',
  '#0ea5e9',
  '#8b5cf6',
  '#f59e0b',
  '#ef4444',
  '#64748b',
];
const compactMoney = (value) =>
  `R$ ${Number(value || 0) >= 1000 ? `${(Number(value) / 1000).toFixed(0)} mil` : Number(value || 0).toFixed(0)}`;

export function FinanceTrendChart({ data = [] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="finance-revenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#16a06a" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#16a06a" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
        <XAxis
          dataKey="date"
          tickFormatter={(value) => value.slice(5)}
          fontSize={11}
        />
        <YAxis tickFormatter={compactMoney} fontSize={11} />
        <Tooltip
          formatter={(value) => formatCurrency(value)}
          labelFormatter={formatDate}
        />
        <Legend />
        <Area
          type="monotone"
          dataKey="revenue"
          name="Entradas"
          stroke="#16a06a"
          fill="url(#finance-revenue)"
        />
        <Area
          type="monotone"
          dataKey="expense"
          name="Saídas"
          stroke="#ef4444"
          fill="transparent"
        />
        <Area
          type="monotone"
          dataKey="profit"
          name="Lucro"
          stroke="#0ea5e9"
          fill="transparent"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function ExpenseCategoryChart({ data = [] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="label"
          innerRadius={52}
          outerRadius={82}
          paddingAngle={2}
        >
          {data.map((item, index) => (
            <Cell key={item.label} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={formatCurrency} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function CashFlowChart({ data = [] }) {
  return (
    <ResponsiveContainer width="100%" height={340}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
        <XAxis
          dataKey="date"
          tickFormatter={(value) => value.slice(5)}
          fontSize={11}
        />
        <YAxis tickFormatter={compactMoney} fontSize={11} />
        <Tooltip formatter={formatCurrency} />
        <Legend />
        <Bar
          dataKey="revenue"
          name="Entradas"
          fill="#16a06a"
          radius={[5, 5, 0, 0]}
        />
        <Bar
          dataKey="expense"
          name="Saídas"
          fill="#ef4444"
          radius={[5, 5, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
