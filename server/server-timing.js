export function attachServerTiming(res, now = () => performance.now()) {
  const start = now();
  const phases = [];
  const flush = () => {
    if (res.headersSent) return;
    const total = Math.max(0, now() - start);
    const measured = phases.reduce((sum, phase) => sum + phase.duration, 0);
    res.setHeader('Server-Timing', [
      `handler;dur=${total.toFixed(1)}`,
      ...phases.map(phase => `${phase.name};dur=${phase.duration.toFixed(1)}`),
      `other;dur=${Math.max(0, total - measured).toFixed(1)}`,
    ].join(', '));
  };
  const end = res.end;
  if (typeof end === 'function') res.end = function (...args) { flush(); return end.apply(this, args); };
  return {
    flush,
    async measure(name, operation) {
      const started = now();
      try { return await operation(); }
      finally { phases.push({ name, duration: Math.max(0, now() - started) }); flush(); }
    },
  };
}
