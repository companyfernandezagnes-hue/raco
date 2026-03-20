import { Supplier, StockItem, BankTransaction, DeliveryNote, Employee, SupplierInvoice, Recipe, FixedExpense } from '../types';

export const mockSuppliers: Supplier[] = [
  { id: 's1', name: 'Carnes Selectas S.A.', contact: 'Juan García', phone: '+34600000001', email: 'pedidos@carnesselectas.com', category: 'Carnes', cif: 'A12345678', bankAccount: 'ES21 2100 1234 5678 9012' },
  { id: 's2', name: 'Pescados del Día', contact: 'María López', phone: '+34600000002', email: 'ventas@pescadosdia.es', category: 'Pescados', cif: 'B87654321', bankAccount: 'ES21 2100 8765 4321 0987' },
  { id: 's3', name: 'Frutas y Verduras Paco', contact: 'Paco Jiménez', phone: '+34600000003', email: 'paco@frutaspaco.com', category: 'Frutas/Verduras', cif: 'A11223344', bankAccount: 'ES21 2100 1122 3344 5566' },
  { id: 's4', name: 'Bodegas Riojanas', contact: 'Elena Sanz', phone: '+34600000004', email: 'comercial@bodegasriojanas.es', category: 'Bebidas', cif: 'B55667788', bankAccount: 'ES21 2100 5566 7788 9900' },
  { id: 's5', name: 'Suministros Hostelería Pro', contact: 'Carlos Ruiz', phone: '+34600000005', email: 'info@suministrospro.com', category: 'Suministros', cif: 'A99887766', bankAccount: 'ES21 2100 9988 7766 5544' },
];

export const mockStock: StockItem[] = [
  { 
    id: 'st1', 
    name: 'Solomillo de Ternera', 
    category: 'Comida', 
    currentStock: 12.5, 
    minStock: 5, 
    unit: 'kg', 
    pricePerUnit: 24.50, 
    averageCost: 23.80,
    lastUpdated: '2026-03-10', 
    supplierId: 's1',
    history: [
      { id: 'h1', date: '2026-03-10', type: 'Salida', quantity: 2.5, reason: 'Servicio Cena', price: 24.50 },
      { id: 'h2', date: '2026-03-08', type: 'Entrada', quantity: 10, reason: 'Pedido Semanal', price: 23.50 },
      { id: 'h3', date: '2026-03-05', type: 'Salida', quantity: 1.2, reason: 'Mermas', price: 24.50 },
    ]
  },
  { 
    id: 'st2', 
    name: 'Aceite de Oliva 5L', 
    category: 'Comida', 
    currentStock: 2, 
    minStock: 4, 
    unit: 'ud', 
    pricePerUnit: 35.00, 
    averageCost: 32.50,
    lastUpdated: '2026-03-09', 
    supplierId: 's5',
    history: [
      { id: 'h4', date: '2026-03-09', type: 'Salida', quantity: 1, reason: 'Uso Cocina', price: 35.00 },
      { id: 'h5', date: '2026-03-01', type: 'Entrada', quantity: 5, reason: 'Pedido Mensual', price: 31.00 },
    ]
  },
  { 
    id: 'st3', 
    name: 'Vino Tinto Crianza', 
    category: 'Bebida', 
    currentStock: 24, 
    minStock: 12, 
    unit: 'bot', 
    pricePerUnit: 8.50, 
    averageCost: 8.20,
    lastUpdated: '2026-03-10', 
    supplierId: 's4',
    history: [
      { id: 'h6', date: '2026-03-10', type: 'Salida', quantity: 6, reason: 'Ventas Barra', price: 8.50 },
      { id: 'h7', date: '2026-03-05', type: 'Entrada', quantity: 30, reason: 'Reposición Bodega', price: 8.10 },
    ]
  },
  { 
    id: 'st4', 
    name: 'Cerveza Barril 50L', 
    category: 'Bebida', 
    currentStock: 1, 
    minStock: 2, 
    unit: 'ud', 
    pricePerUnit: 120.00, 
    averageCost: 118.00,
    lastUpdated: '2026-03-08', 
    supplierId: 's4',
    history: [
      { id: 'h8', date: '2026-03-08', type: 'Salida', quantity: 1, reason: 'Barril Agotado', price: 120.00 },
      { id: 'h9', date: '2026-03-01', type: 'Entrada', quantity: 2, reason: 'Pedido Semanal', price: 116.00 },
    ]
  },
  { 
    id: 'st5', 
    name: 'Servilletas Papel', 
    category: 'Suministros', 
    currentStock: 5000, 
    minStock: 2000, 
    unit: 'ud', 
    pricePerUnit: 0.01, 
    averageCost: 0.009,
    lastUpdated: '2026-03-05', 
    supplierId: 's5',
    history: [
      { id: 'h10', date: '2026-03-05', type: 'Salida', quantity: 500, reason: 'Uso Sala', price: 0.01 },
      { id: 'h11', date: '2026-03-01', type: 'Entrada', quantity: 10000, reason: 'Pedido Suministros', price: 0.008 },
    ]
  },
];

export const mockAlbaranes: DeliveryNote[] = [
  {
    id: '1',
    date: '2026-03-10',
    supplierId: 's1',
    reference: 'ALB-2026-001',
    status: 'Recibido',
    total: 1250.40,
    items: [
      { id: 'i1', description: 'Entrecot de Ternera', quantity: 20, unit: 'kg', price: 25.50, total: 510.00 },
      { id: 'i2', description: 'Solomillo Ibérico', quantity: 15, unit: 'kg', price: 18.20, total: 273.00 },
      { id: 'i3', description: 'Chuletón de Buey', quantity: 10, unit: 'kg', price: 46.74, total: 467.40 },
    ]
  },
  {
    id: '2',
    date: '2026-03-09',
    supplierId: 's3',
    reference: 'ALB-2026-002',
    status: 'Pendiente',
    total: 450.00,
    items: [
      { id: 'i4', description: 'Tomate Rosa', quantity: 50, unit: 'kg', price: 3.50, total: 175.00 },
      { id: 'i5', description: 'Aguacate Hass', quantity: 25, unit: 'kg', price: 11.00, total: 275.00 },
    ]
  }
];

export const mockInvoices: SupplierInvoice[] = [
  {
    id: '1',
    date: '2026-03-01',
    supplierId: 's1',
    number: 'FAC-2026-001',
    dueDate: '2026-03-31',
    status: 'Pendiente',
    total: 3450.60,
    tax: 600.10,
    deliveryNoteIds: ['1']
  }
];

export const mockEmployees: Employee[] = [
  { 
    id: '1', 
    name: 'Juan Pérez', 
    role: 'Jefe de Cocina', 
    status: 'En turno', 
    img: 'https://i.pravatar.cc/150?u=juan',
    hourlyRate: 18,
    contractHours: 40,
    dni: '12345678A',
    email: 'juan.perez@gastrogestion.com',
    contractType: 'Indefinido',
    monthlySalary: 2200,
    schedules: [
      { id: 'sch1', day: '2026-03-10', startTime: '09:00', endTime: '18:00', extraHours: 1 },
      { id: 'sch2', day: '2026-03-11', startTime: '09:00', endTime: '17:00', extraHours: 0 },
    ],
    vacations: [
      { id: 'v1', startDate: '2026-08-01', endDate: '2026-08-15', status: 'Aprobada' }
    ]
  },
  {
    id: '2',
    name: 'María García',
    role: 'Maître',
    status: 'Descanso',
    img: 'https://i.pravatar.cc/150?u=maria',
    hourlyRate: 15,
    contractHours: 40,
    dni: '87654321B',
    email: 'maria.garcia@gastrogestion.com',
    contractType: 'Indefinido',
    monthlySalary: 1900,
    schedules: [],
    vacations: []
  }
];

export const mockFixedExpenses: FixedExpense[] = [
  { id: 'fe1', name: 'Alquiler Local', amount: 2500, category: 'Alquiler', frequency: 'Mensual' },
  { id: 'fe2', name: 'Suministro Eléctrico', amount: 450, category: 'Suministros', frequency: 'Mensual' },
  { id: 'fe3', name: 'Seguro Responsabilidad Civil', amount: 1200, category: 'Seguros', frequency: 'Anual' },
  { id: 'fe4', name: 'Salario Juan Pérez', amount: 2200, category: 'Personal', frequency: 'Mensual', relatedId: '1' },
  { id: 'fe5', name: 'Salario María García', amount: 1900, category: 'Personal', frequency: 'Mensual', relatedId: '2' },
];

export const mockRecipes: Recipe[] = [
  {
    id: '1',
    name: 'Spider Tartar de Atún',
    category: 'Entrantes',
    servings: 1,
    laborCost: 3.50,
    margin: 78,
    ingredients: [
      { id: 'i1', name: 'Atún Rojo Balfegó', quantity: 150, unit: 'g', wastePercentage: 12, pricePerUnit: 0.055 },
      { id: 'i2', name: 'Aguacate Hass', quantity: 60, unit: 'g', wastePercentage: 35, pricePerUnit: 0.008 },
      { id: 'i3', name: 'Alga Wakame', quantity: 20, unit: 'g', wastePercentage: 5, pricePerUnit: 0.012 },
      { id: 'i4', name: 'Salsa Kimchi', quantity: 15, unit: 'ml', wastePercentage: 2, pricePerUnit: 0.015 },
      { id: 'i5', name: 'Sésamo Negro', quantity: 2, unit: 'g', wastePercentage: 0, pricePerUnit: 0.005 },
      { id: 'i6', name: 'Lima (Zumo)', quantity: 10, unit: 'ml', wastePercentage: 50, pricePerUnit: 0.004 },
    ],
    instructions: 'Cortar el atún en dados de 0.5cm. Mezclar con el aliño de kimchi y lima. Emplatar con base de aguacate y decorar con sésamo y wakame.'
  }
];
