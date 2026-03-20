export interface Supplier {
  id: string;
  name: string;
  contact: string;
  phone: string;
  email: string;
  category: string;
  cif?: string;
  bankAccount?: string;
}

export interface DeliveryNote {
  id: string;
  date: string;
  supplierId: string;
  reference: string;
  status: 'Pendiente' | 'Recibido' | 'Facturado' | 'Rechazado';
  total: number;
  items: DeliveryNoteItem[];
}

export interface DeliveryNoteItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  price: number;
  total: number;
}

export interface SupplierInvoice {
  id: string;
  date: string;
  supplierId: string;
  number: string;
  dueDate: string;
  status: 'Pendiente' | 'Pagado' | 'Vencido';
  total: number;
  tax: number;
  deliveryNoteIds: string[];
}

export interface CustomerInvoice {
  id: string;
  number: string;
  date: string;
  issuer: FiscalData;
  receiver: FiscalData;
  items: InvoiceItem[];
  subtotal: number;
  taxBreakdown: { rate: number; amount: number }[];
  total: number;
  status: 'Pendiente' | 'Cobrada' | 'Anulada';
  paymentMethod?: string;
  type: 'Individual' | 'Agrupada';
  verifactuStatus?: 'Pendiente' | 'Enviado' | 'Error';
}

export interface FiscalData {
  name: string;
  taxId: string; // CIF/NIF
  address: string;
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  total: number;
}

export interface Ticket {
  id: string;
  number: string;
  date: string;
  total: number;
  items: InvoiceItem[];
  status: 'Abierto' | 'Cerrado' | 'Facturado';
}

export interface CashEntry {
  id: string;
  date: string;
  type: 'Ingreso' | 'Gasto';
  category: string;
  description: string;
  amount: number;
  paymentMethod: 'Efectivo' | 'Tarjeta' | 'Transferencia' | 'Banco';
}

export interface BankTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  balance: number;
  category?: string;
  status: 'Conciliado' | 'Pendiente';
  documentId?: string; // For reconciliation
  reconciledId?: string; // Link to Invoice or Expense
  source?: 'manual' | 'api' | 'csv';
}

export interface Employee {
  id: string;
  name: string;
  role: string;
  status: 'En turno' | 'Descanso' | 'Vacaciones' | 'Baja';
  img: string;
  hourlyRate: number;
  contractHours: number;
  dni?: string;
  email?: string;
  contractType?: string;
  monthlySalary?: number;
  schedules: Schedule[];
  vacations: Vacation[];
}

export interface Schedule {
  id: string;
  day: string; // ISO date
  startTime: string;
  endTime: string;
  extraHours: number;
}

export interface Vacation {
  id: string;
  startDate: string;
  endDate: string;
  status: 'Solicitada' | 'Aprobada' | 'Rechazada';
}

export interface Recipe {
  id: string;
  name: string;
  category: string;
  servings: number;
  ingredients: RecipeIngredient[];
  laborCost: number;
  margin: number;
  instructions?: string;
}

export interface RecipeIngredient {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  wastePercentage: number; // Merma
  pricePerUnit: number;
}

export interface BankAccount {
  id: string;
  name: string;
  bankName: string;
  accountNumber: string;
  balance: number;
  lastSync: string;
  transactions: BankTransaction[];
}

export interface StockItem {
  id: string;
  name: string;
  category: 'Comida' | 'Bebida' | 'Suministros';
  currentStock: number;
  minStock: number;
  unit: string;
  pricePerUnit: number;
  lastPricePerUnit?: number;
  averageCost?: number;
  lastUpdated: string;
  supplierId?: string;
  history?: StockMovement[];
}

export interface StockMovement {
  id: string;
  date: string;
  type: 'Entrada' | 'Salida' | 'Ajuste';
  quantity: number;
  reason?: string;
  price?: number;
}

export interface Document {
  id: string;
  name: string;
  type: 'Factura' | 'Albarán' | 'Contrato' | 'Impuesto' | 'Otro';
  module: 'Compras' | 'Ventas' | 'Personal' | 'Tesorería' | 'General';
  date: string;
  url: string;
  status: 'Procesado' | 'Pendiente' | 'Error';
  relatedId?: string; // ID of the related entity (e.g., SupplierInvoice ID)
}

export interface FixedExpense {
  id: string;
  name: string;
  amount: number;
  category: 'Personal' | 'Alquiler' | 'Suministros' | 'Seguros' | 'Otros';
  frequency: 'Mensual' | 'Trimestral' | 'Anual';
  relatedId?: string;
}

export interface MenuEvaluation {
  id: string;
  menuName: string;
  items: {
    id: string;
    name: string;
    cost: number;
    price: number;
    popularity: number; // 0-100
    margin: number; // %
    classification: 'Estrella' | 'Vaca' | 'Puzzle' | 'Perro';
  }[];
  totalItems: number;
  averageMargin: number;
  aiRecommendations: string[];
  lastUpdated: string;
}

// --- Advanced Compras Module Types ---

export type BusinessUnit = 'REST' | 'DLV' | 'SHOP' | 'CORP';

export interface AlbaranItem {
  q: number;
  n: string;
  u: string;
  rate: number;
  unitPrice: number;
  base: number;
  tax: number;
  t: number;
}

export interface Albaran {
  id: string;
  prov: string;
  date: string;
  num: string;
  socio: string;
  notes?: string;
  items: AlbaranItem[];
  total: number;
  base: number;
  taxes: number;
  invoiced: boolean;
  paid: boolean;
  status: 'ok' | 'warning' | 'error';
  reconciled: boolean;
  unitId: BusinessUnit;
  img?: string;
}

export interface FacturaExtended {
  id: string;
  tipo: 'compra' | 'venta' | 'caja';
  num: string;
  date: string;
  dueDate?: string; // Vencimiento
  prov: string;
  cliente?: string;
  total: string;
  base: string;
  tax: string;
  albaranIdsArr?: string[];
  paid: boolean;
  reconciled: boolean;
  bankTransactionId?: string;
  category?: string; // e.g., "Materia Prima", "Suministros"
  source: 'gmail-sync' | 'dropzone' | 'manual-group' | 'auto-from-albaran';
  status: 'draft' | 'approved' | 'paid' | 'mismatch';
  unidad_negocio: BusinessUnit;
  file_base64?: string;
  attachmentSha?: string;
  emailMeta?: {
    from: string;
    subject: string;
  };
}

export interface Plato {
  id: string;
  name: string;
  category: string;
  price: number;
  cost: number;
  iva?: number;
  merma?: number;
  popularidad?: number;
  rentabilidad?: number;
  estado?: 'Activo' | 'Inactivo';
}

export interface VentaMenu {
  id: string; // Plato ID
  date: string;
  qty: number;
}

export interface Cierre {
  id: string;
  date: string;
  totalVenta: number;
  clientes: number;
  unitId: string;
}

export interface AppData {
  albaranes: Albaran[];
  facturas: FacturaExtended[];
  bankTransactions: BankTransaction[];
  socios: Socio[];
  priceHistory: PriceHistoryEntry[];
  platos: Plato[];
  ventas_menu: VentaMenu[];
  cierres: Cierre[];
}

export interface Socio {
  id: string;
  n: string;
  active: boolean;
}

export interface PriceHistoryEntry {
  id: string;
  prov: string;
  item: string;
  unitPrice: number;
  date: string;
}

export interface EmailDraft {
  id: string;
  from: string;
  subject: string;
  date: string;
  fileBase64?: string;
}
