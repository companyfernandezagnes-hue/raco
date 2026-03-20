import { AppData, Albaran, FacturaExtended } from '../types';
import { Num, DateUtil } from './engine';

export const TOLERANCIA = 0.50;

export const basicNorm = (s?: string) => 
  (s || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

export const getOfficialProvName = (name: string) => name.toUpperCase().trim();

export function linkAlbaranesToFactura(data: AppData, facturaId: string, albaranIds: string[]) {
  const fIdx = data.facturas.findIndex(f => f.id === facturaId);
  if (fIdx === -1) return;

  const F = data.facturas[fIdx];
  const currentIds = new Set(F.albaranIdsArr || []);
  
  albaranIds.forEach(id => {
    currentIds.add(id);
    const aIdx = data.albaranes.findIndex(a => a.id === id);
    if (aIdx !== -1) {
      data.albaranes[aIdx].invoiced = true;
    }
  });

  F.albaranIdsArr = Array.from(currentIds);
  
  // Recalcular totales de la factura basados en los albaranes vinculados
  const linkedAlbs = data.albaranes.filter(a => currentIds.has(a.id));
  const total = linkedAlbs.reduce((acc, a) => acc + a.total, 0);
  const base = linkedAlbs.reduce((acc, a) => acc + a.base, 0);
  const tax = linkedAlbs.reduce((acc, a) => acc + a.taxes, 0);

  F.total = String(Num.round2(total));
  F.base = String(Num.round2(base));
  F.tax = String(Num.round2(tax));
}

export function matchAlbaranesToFactura(factura: FacturaExtended, albaranes: Albaran[], provNorm: string) {
  const fTotal = Num.parse(factura.total);
  const candidatos = albaranes.filter(a => 
    !a.invoiced && 
    basicNorm(a.prov) === provNorm &&
    a.date.startsWith(factura.date.slice(0, 7))
  );

  const sumaCandidatos = candidatos.reduce((acc, a) => acc + a.total, 0);
  const diferencia = Math.abs(sumaCandidatos - fTotal);
  const cuadraPerfecto = diferencia <= TOLERANCIA;

  return {
    candidatos,
    sumaCandidatos,
    diferencia,
    cuadraPerfecto
  };
}
