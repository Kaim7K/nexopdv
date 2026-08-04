import React from 'react';
import {
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
import { formatCurrency, formatNumber } from '@/lib/helpers';

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

const compactChartHeight = (desktopHeight) =>
  typeof window !== 'undefined' && window.innerWidth < 640
    ? Math.min(210, desktopHeight)
    : desktopHeight;

export function BreakdownChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={compactChartHeight(280)}>
      <BarChart data={data} margin={{ left: 8, right: 16 }}>
        <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          axisLine={{ stroke: 'hsl(var(--border))' }}
        />
        <YAxis
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          tickFormatter={(value) => `R$ ${formatNumber(value)}`}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={(value) => formatCurrency(value)}
          contentStyle={TOOLTIP_STYLE}
        />
        <Bar
          dataKey="revenue"
          name="Faturamento"
          fill="hsl(var(--chart-1))"
          radius={[6, 6, 0, 0]}
        />
        <Legend />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DailyRevenueChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={compactChartHeight(270)}>
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
              ? `R$ ${formatNumber(Number(value) / 1000)} mil`
              : `R$ ${formatNumber(value)}`
          }
        />
        <Tooltip
          formatter={(value) => formatCurrency(value)}
          contentStyle={TOOLTIP_STYLE}
          labelStyle={{ color: 'hsl(var(--popover-foreground))' }}
        />
        <Bar dataKey="value" fill="hsl(var(--chart-1))" radius={[5, 5, 0, 0]} />
        <Legend />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function PaymentChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={compactChartHeight(270)}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={86}
          label={({ value }) => formatCurrency(value)}
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
