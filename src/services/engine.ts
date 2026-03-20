export const Num = {
  parse: (val: any): number => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      const clean = val.replace(/[€$]/g, '').replace(',', '.').trim();
      return parseFloat(clean) || 0;
    }
    return 0;
  },
  round2: (val: number): number => Math.round((val + Number.EPSILON) * 100) / 100,
  fmt: (val: number): string => 
    new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(val)
};

export const DateUtil = {
  today: () => new Date().toISOString().slice(0, 10),
  format: (date: string | Date) => new Intl.DateTimeFormat('es-ES').format(new Date(date))
};

export const ArumeEngine = {
  calcularImpuestos: (total: number, rate: 4 | 10 | 21) => {
    const base = Num.round2(total / (1 + rate / 100));
    const tax = Num.round2(total - base);
    return { base, tax, total: Num.round2(total) };
  }
};
