import { BankTransaction, FacturaExtended, AppData, Albaran } from '../types';
import { Num } from './engine';

export interface MatchSuggestion {
  transaction: BankTransaction;
  invoice: FacturaExtended | null;
  confidence: number;
}

export const TreasuryService = {
  /**
   * Encuentra sugerencias de coincidencia para todas las transacciones pendientes.
   */
  findMatches: (transactions: BankTransaction[], invoices: FacturaExtended[]): MatchSuggestion[] => {
    return transactions.map(trans => {
      const pendingInvoices = invoices.filter(inv => !inv.reconciled);
      
      // Intentar encontrar la mejor coincidencia
      let bestMatch: FacturaExtended | null = null;
      let maxConfidence = 0;

      for (const inv of pendingInvoices) {
        let confidence = 0;
        const invTotal = Math.abs(Num.parse(inv.total));
        const transAmount = Math.abs(trans.amount);

        // 1. Coincidencia por importe (Peso alto)
        if (Math.abs(invTotal - transAmount) < 0.01) {
          confidence += 70;
        }

        // 2. Coincidencia por nombre de proveedor (Peso medio)
        if (trans.description.toLowerCase().includes(inv.prov.toLowerCase())) {
          confidence += 20;
        }

        // 3. Coincidencia por fecha cercana (Peso bajo)
        const daysDiff = Math.abs(new Date(trans.date).getTime() - new Date(inv.date).getTime()) / (1000 * 60 * 60 * 24);
        if (daysDiff <= 5) {
          confidence += 10;
        }

        if (confidence > maxConfidence) {
          maxConfidence = confidence;
          bestMatch = inv;
        }
      }

      return {
        transaction: trans,
        invoice: maxConfidence >= 70 ? bestMatch : null,
        confidence: maxConfidence
      };
    });
  },

  /**
   * Concilia una transacción con una factura y actualiza albaranes vinculados.
   */
  reconcile: (
    transactions: BankTransaction[],
    invoices: FacturaExtended[],
    transactionId: string,
    invoiceId: string,
    albaranes?: Albaran[]
  ) => {
    const updatedInvoices = invoices.map(inv => {
      if (inv.id === invoiceId) {
        return { 
          ...inv, 
          reconciled: true, 
          bankTransactionId: transactionId, 
          paid: true,
          status: 'paid' as const 
        };
      }
      return inv;
    });

    const updatedTransactions = transactions.map(trans => {
      if (trans.id === transactionId) {
        return { 
          ...trans, 
          status: 'Conciliado' as const, 
          reconciledId: invoiceId 
        };
      }
      return trans;
    });

    // Interconexión: Actualizar albaranes vinculados
    let updatedAlbaranes = albaranes;
    if (albaranes) {
      const targetInvoice = invoices.find(i => i.id === invoiceId);
      if (targetInvoice?.albaranIdsArr) {
        updatedAlbaranes = albaranes.map(alb => {
          if (targetInvoice.albaranIdsArr?.includes(alb.id)) {
            return { ...alb, paid: true, reconciled: true };
          }
          return alb;
        });
      }
    }

    return { updatedTransactions, updatedInvoices, updatedAlbaranes };
  },

  /**
   * Concilia automáticamente todos los movimientos con confianza >= 70%
   */
  reconcileAll: (data: AppData) => {
    const matches = TreasuryService.findMatches(data.bankTransactions, data.facturas);
    const highConfidenceMatches = matches.filter(m => m.confidence >= 70 && m.invoice);
    
    let currentTransactions = [...data.bankTransactions];
    let currentInvoices = [...data.facturas];
    let currentAlbaranes = [...data.albaranes];

    highConfidenceMatches.forEach(match => {
      const result = TreasuryService.reconcile(
        currentTransactions,
        currentInvoices,
        match.transaction.id,
        match.invoice!.id,
        currentAlbaranes
      );
      currentTransactions = result.updatedTransactions;
      currentInvoices = result.updatedInvoices;
      currentAlbaranes = result.updatedAlbaranes || currentAlbaranes;
    });

    return { 
      updatedTransactions: currentTransactions, 
      updatedInvoices: currentInvoices, 
      updatedAlbaranes: currentAlbaranes 
    };
  },

  /**
   * Genera un asiento contable virtual para una conciliación.
   */
  generateAccountingEntry: (transaction: BankTransaction, invoice: FacturaExtended) => {
    return {
      date: transaction.date,
      description: `Pago Factura ${invoice.num} - ${invoice.prov}`,
      debit: {
        account: '400.0 Proveedores',
        amount: Math.abs(transaction.amount)
      },
      credit: {
        account: '572.0 Bancos',
        amount: Math.abs(transaction.amount)
      },
      transactionId: transaction.id,
      invoiceId: invoice.id
    };
  },

  /**
   * Calcula el resumen de tesorería.
   */
  getSummary: (data: AppData) => {
    const balance = data.bankTransactions.reduce((acc, t) => acc + t.amount, 0);
    const pendingInvoices = data.facturas.filter(f => !f.paid).reduce((acc, f) => acc + Num.parse(f.total), 0);
    const reconciledInvoices = data.facturas.filter(f => f.reconciled).reduce((acc, f) => acc + Num.parse(f.total), 0);

    return {
      balance,
      pendingInvoices,
      reconciledInvoices,
      healthScore: balance > pendingInvoices ? 95 : 60
    };
  },

  /**
   * Genera alertas inteligentes basadas en los datos actuales.
   */
  getAlerts: (data: AppData) => {
    const alerts: { id: string; type: 'warning' | 'error' | 'info'; title: string; desc: string; date?: string }[] = [];
    const today = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(today.getDate() + 7);

    // 1. Vencimientos próximos
    data.facturas.forEach(f => {
      if (!f.paid && f.dueDate) {
        const dDate = new Date(f.dueDate);
        if (dDate <= nextWeek) {
          alerts.push({
            id: `due-${f.id}`,
            type: dDate < today ? 'error' : 'warning',
            title: dDate < today ? 'Factura Vencida' : 'Vencimiento Próximo',
            desc: `${f.prov}: ${Num.fmt(Num.parse(f.total))} vence el ${f.dueDate}`,
            date: f.dueDate
          });
        }
      }
    });

    // 2. Movimientos inusuales
    data.bankTransactions.forEach(t => {
      if (Math.abs(t.amount) > 2000 && t.status === 'Pendiente') {
        alerts.push({
          id: `unusual-${t.id}`,
          type: 'info',
          title: 'Movimiento de Importe Elevado',
          desc: `${t.description}: ${Num.fmt(t.amount)} requiere revisión manual.`,
          date: t.date
        });
      }
    });

    // 3. Discrepancias de conciliación
    const pendingTrans = data.bankTransactions.filter(t => t.status === 'Pendiente');
    if (pendingTrans.length > 5) {
      alerts.push({
        id: 'reconcile-backlog',
        type: 'warning',
        title: 'Pendientes de Conciliación',
        desc: `Hay ${pendingTrans.length} movimientos bancarios esperando ser conciliados.`
      });
    }

    // 4. Riesgo de Liquidez
    const totalBalance = data.bankTransactions.reduce((acc, t) => acc + t.amount, 0);
    const totalPending = data.facturas.filter(f => !f.paid).reduce((acc, f) => acc + Num.parse(f.total), 0);
    if (totalBalance < totalPending) {
      alerts.push({
        id: 'liquidity-risk',
        type: 'error',
        title: 'Riesgo de Liquidez Detectado',
        desc: `El saldo actual (${Num.fmt(totalBalance)}) es inferior a las facturas pendientes de pago (${Num.fmt(totalPending)}).`
      });
    }

    return alerts;
  },

  /**
   * Detecta subidas de precios en los albaranes comparando con el historial.
   */
  detectPriceIncreases: (data: AppData) => {
    const alerts: { id: string; type: 'warning'; title: string; desc: string; date: string }[] = [];
    const history = data.priceHistory || [];

    data.albaranes.forEach(alb => {
      alb.items.forEach(item => {
        const previousPrices = history.filter(h => h.item === item.n && h.prov === alb.prov);
        if (previousPrices.length > 0) {
          const lastPrice = previousPrices[previousPrices.length - 1].unitPrice;
          if (item.unitPrice > lastPrice * 1.05) { // Subida > 5%
            const increase = ((item.unitPrice - lastPrice) / lastPrice) * 100;
            alerts.push({
              id: `price-up-${alb.id}-${item.n}`,
              type: 'warning',
              title: 'Subida de Precio Detectada',
              desc: `${item.n} (${alb.prov}): Ha subido un ${increase.toFixed(1)}% (De ${Num.fmt(lastPrice)} a ${Num.fmt(item.unitPrice)})`,
              date: alb.date
            });
          }
        }
      });
    });

    return alerts;
  },

  /**
   * Proyecta el flujo de caja para los próximos 30 días (IA-simulated).
   */
  getCashFlowProjection: (data: AppData) => {
    const today = new Date();
    const projection = [];
    let currentBalance = data.bankTransactions.reduce((acc, t) => acc + t.amount, 0);

    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];

      // Restar facturas que vencen este día
      const dueToday = data.facturas
        .filter(f => !f.paid && f.dueDate === dateStr)
        .reduce((acc, f) => acc + Num.parse(f.total), 0);
      
      // Simular ingresos diarios promedio (basado en cierres si existieran, o histórico)
      const avgDailyIncome = 1200; // Placeholder
      
      currentBalance = currentBalance + avgDailyIncome - dueToday;
      
      projection.push({
        date: dateStr,
        balance: currentBalance,
        income: avgDailyIncome,
        expenses: dueToday
      });
    }

    return projection;
  }
};
