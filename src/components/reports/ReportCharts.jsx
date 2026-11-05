import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatCurrency, formatNumber } from '@/lib/helpers';

import { CHART_COLORS } from './chart-colors';

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
        <Bar isAnimationActive={false}
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
        <Bar isAnimationActive={false} dataKey="value" fill="hsl(var(--chart-1))" radius={[5, 5, 0, 0]} />
        <Legend />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function PaymentChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={compactChartHeight(270)}>
      <PieChart>
        <Pie isAnimationActive={false}
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={86}
          innerRadius={46}
          paddingAngle={2}
          labelLine={false}
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

export function ProductSalesChart({ data, unitLabel }) {
  return (
    <ResponsiveContainer width="100%" height={compactChartHeight(250)}>
      <ComposedChart data={data} margin={{ left: 0, right: 4, top: 8 }}>
        <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="label"
          minTickGap={16}
          tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
          axisLine={{ stroke: 'hsl(var(--border))' }}
          tickLine={false}
        />
        <YAxis
          yAxisId="quantity"
          width={38}
          tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
          tickFormatter={(value) => formatNumber(value)}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          yAxisId="revenue"
          orientation="right"
          width={48}
          tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
          tickFormatter={(value) =>
            Number(value) >= 1000
              ? `R$ ${formatNumber(Number(value) / 1000)}k`
              : `R$ ${formatNumber(value)}`
          }
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={(value, name) =>
            name === 'Faturamento'
              ? formatCurrency(value)
              : `${formatNumber(value)} ${unitLabel}`
          }
          contentStyle={TOOLTIP_STYLE}
          labelStyle={{ color: 'hsl(var(--popover-foreground))' }}
        />
        <Legend />
        <Bar isAnimationActive={false}
          yAxisId="quantity"
          dataKey="quantity"
          name="Quantidade"
          fill="hsl(var(--chart-1))"
          radius={[5, 5, 0, 0]}
        />
        <Line isAnimationActive={false}
          yAxisId="revenue"
          type="monotone"
          dataKey="revenue"
          name="Faturamento"
          stroke="hsl(var(--chart-3))"
          strokeWidth={2.5}
          dot={{ r: 3, fill: 'hsl(var(--chart-3))' }}
          activeDot={{ r: 5 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
