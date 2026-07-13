import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatCurrency } from '@/lib/helpers';

const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(280 65% 60%)',
];
const TOOLTIP_STYLE = {
  backgroundColor: 'hsl(var(--popover))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 10,
  color: 'hsl(var(--popover-foreground))',
  boxShadow: '0 12px 30px rgb(0 0 0 / 0.16)',
};

export function BreakdownChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ left: 8, right: 16 }}>
        <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          axisLine={{ stroke: 'hsl(var(--border))' }}
        />
        <YAxis
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          tickFormatter={(value) => `R$ ${Number(value).toFixed(0)}`}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={(value) => formatCurrency(value)}
          contentStyle={TOOLTIP_STYLE}
        />
        <Line
          type="monotone"
          dataKey="revenue"
          name="Faturamento"
          stroke="hsl(var(--chart-1))"
          strokeWidth={2.5}
          dot={{ r: 4, fill: 'hsl(var(--chart-1))' }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function DailyRevenueChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={270}>
      <BarChart data={data}>
        <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          axisLine={{ stroke: 'hsl(var(--border))' }}
          tickLine={{ stroke: 'hsl(var(--border))' }}
        />
        <YAxis
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          axisLine={{ stroke: 'hsl(var(--border))' }}
          tickLine={{ stroke: 'hsl(var(--border))' }}
          tickFormatter={(value) =>
            Number(value) >= 1000
              ? `R$${(Number(value) / 1000).toFixed(1)}k`
              : `R$${Number(value).toFixed(0)}`
          }
        />
        <Tooltip
          formatter={(value) => formatCurrency(value)}
          contentStyle={TOOLTIP_STYLE}
          labelStyle={{ color: 'hsl(var(--popover-foreground))' }}
        />
        <Bar dataKey="value" fill="hsl(var(--chart-1))" radius={[5, 5, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function PaymentChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={270}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={86}
          label={{ fill: 'hsl(var(--foreground))', fontSize: 11 }}
          labelLine={{ stroke: 'hsl(var(--muted-foreground))' }}
        >
          {data.map((item, index) => (
            <Cell
              key={item.name}
              fill={CHART_COLORS[index % CHART_COLORS.length]}
            />
          ))}
        </Pie>
        <Tooltip
          formatter={(value) => formatCurrency(value)}
          contentStyle={TOOLTIP_STYLE}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
