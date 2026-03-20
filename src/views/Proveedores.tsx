import React from 'react';
import { 
  Users, 
  Search, 
  Plus, 
  Phone, 
  Mail, 
  MapPin, 
  ExternalLink,
  MoreVertical,
  MessageCircle,
  Truck,
  Star,
  Clock,
  Filter,
  ShieldCheck,
  CreditCard,
  X,
  Trash2,
  AlertTriangle,
  Zap,
  TrendingUp,
  TrendingDown,
  Globe,
  FileCheck,
  Brain,
  Scale
} from 'lucide-react';
import { Supplier } from '../types';
import { mockSuppliers } from '../data/mockData';
import { cn } from '../lib/utils';
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';

export default function ProveedoresView() {
  const [search, setSearch] = React.useState('');
  const [categoryFilter, setCategoryFilter] = React.useState('Todas');
  const [selectedSupplier, setSelectedSupplier] = React.useState<Supplier | null>(null);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [newSupplier, setNewSupplier] = React.useState({
    name: '',
    category: 'Alimentación',
    contact: '',
    phone: '',
    email: '',
    address: '',
    bankAccount: ''
  });

  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [editingSupplier, setEditingSupplier] = React.useState<Supplier | null>(null);
  const [showPriceComparison, setShowPriceComparison] = React.useState(false);
  const [comparisonData, setComparisonData] = React.useState<any[]>([]);

  const handleComparePrices = () => {
    setShowPriceComparison(true);
    setComparisonData([
      { item: 'Aceite de Oliva (5L)', best: 'Distribuciones Norte', price: 24.50, others: [{ name: 'Suministros BCN', price: 26.80 }, { name: 'GastroHoreca', price: 25.90 }] },
      { item: 'Harina de Trigo (25kg)', best: 'Suministros BCN', price: 18.20, others: [{ name: 'Distribuciones Norte', price: 19.50 }] },
      { item: 'Vino Tinto Crianza', best: 'Bodegas Rioja', price: 6.40, others: [{ name: 'Distribuciones Norte', price: 7.10 }] },
    ]);
  };
  const [showNegotiationBrief, setShowNegotiationBrief] = React.useState<Supplier | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState<string | null>(null);
  const [isVerifyingCIF, setIsVerifyingCIF] = React.useState<string | null>(null);
  const [verifiedCIFs, setVerifiedCIFs] = React.useState<Record<string, boolean>>({});

  const handleDeleteSupplier = (id: string) => {
    // In a real app, this would delete from Firestore
    console.log('Deleting supplier:', id);
    setShowDeleteConfirm(null);
    alert('Proveedor eliminado correctamente.');
  };

  const handleVerifyCIF = async (id: string) => {
    setIsVerifyingCIF(id);
    await new Promise(resolve => setTimeout(resolve, 1500));
    setVerifiedCIFs(prev => ({ ...prev, [id]: true }));
    setIsVerifyingCIF(null);
  };

  const priceTrendData = [
    { name: 'Ene', price: 100 },
    { name: 'Feb', price: 105 },
    { name: 'Mar', price: 102 },
    { name: 'Abr', price: 110 },
  ];

  const handleEditSupplier = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setIsEditModalOpen(true);
  };

  const handleSaveSupplier = () => {
    // In a real app, this would save to Firestore
    console.log('Saving supplier:', editingSupplier);
    setIsEditModalOpen(false);
    setSelectedSupplier(editingSupplier);
    alert('Proveedor actualizado correctamente.');
  };

  const categories = ['Todas', ...Array.from(new Set(mockSuppliers.map(s => s.category)))];

  const filteredSuppliers = mockSuppliers.filter(s => 
    (categoryFilter === 'Todas' ? true : s.category === categoryFilter) &&
    (s.name.toLowerCase().includes(search.toLowerCase()) || s.contact.toLowerCase().includes(search.toLowerCase()))
  );

  const handleWhatsApp = (phone: string, name: string) => {
    const message = encodeURIComponent(`Hola ${name}, me pongo en contacto desde GastroGestión Pro.`);
    window.open(`https://wa.me/${phone.replace('+', '')}?text=${message}`, '_blank');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Users className="text-indigo-600" />
            Agenda de Proveedores
          </h1>
          <p className="text-slate-500 text-sm">Directorio completo de proveedores y contactos directos.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleComparePrices}
            className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-all shadow-sm"
          >
            <Scale size={18} className="text-indigo-500" />
            Comparar Precios
          </button>
          <button className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-all shadow-sm shadow-indigo-100">
            <Plus size={18} />
            Nuevo Proveedor
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 text-sm uppercase tracking-wider">
              <Filter size={16} className="text-indigo-600" />
              Categorías
            </h3>
            <div className="space-y-1">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-all",
                    categoryFilter === cat 
                      ? "bg-indigo-50 text-indigo-700 shadow-sm" 
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-indigo-600 text-white p-6 rounded-3xl shadow-xl shadow-indigo-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Star size={20} />
              </div>
              <h3 className="font-bold">Proveedores Top</h3>
            </div>
            <p className="text-indigo-100 text-sm mb-4">Basado en cumplimiento de plazos y calidad de producto.</p>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span>Carnes Selectas</span>
                <span className="bg-white/20 px-2 py-0.5 rounded-full font-bold">4.9/5</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span>Pescados del Día</span>
                <span className="bg-white/20 px-2 py-0.5 rounded-full font-bold">4.8/5</span>
              </div>
            </div>
          </div>
        </div>

        <div className="md:col-span-3 space-y-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="Buscar por nombre, contacto o categoría..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filteredSuppliers.map((supplier) => (
              <div key={supplier.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                  <button 
                    onClick={() => handleEditSupplier(supplier)}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                  >
                    <MoreVertical size={18} />
                  </button>
                  <button 
                    onClick={() => setShowDeleteConfirm(supplier.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
                
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0">
                    <Truck size={28} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{supplier.name}</h3>
                    <p className="text-xs text-slate-500 font-medium">{supplier.category}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <Star size={12} className="text-amber-400 fill-amber-400" />
                      <span className="text-[10px] font-black text-slate-400 uppercase">4.5 • Verificado</span>
                    </div>
                  </div>
                </div>

                {/* Innovative Feature 1: AI Health Score */}
                <div className="mb-6 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Health Score (AI)</span>
                    <span className="text-xs font-bold text-emerald-600">92%</span>
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full w-[92%] transition-all duration-1000" />
                  </div>
                  <div className="mt-2 flex justify-between text-[9px] font-bold text-slate-400 uppercase">
                    <span>Fiabilidad</span>
                    <span>Calidad</span>
                    <span>Precio</span>
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck size={14} className="text-indigo-500" />
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Reliability Score IA</span>
                    </div>
                    <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">A+ EXCELENTE</span>
                  </div>
                </div>

                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-3 text-sm text-slate-600">
                    <Users size={16} className="text-slate-400" />
                    <span className="font-medium">{supplier.contact}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-600">
                    <Phone size={16} className="text-slate-400" />
                    <span className="font-medium">{supplier.phone}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-600">
                    <Mail size={16} className="text-slate-400" />
                    <span className="font-medium truncate">{supplier.email}</span>
                  </div>
                  {supplier.bankAccount && (
                    <div className="flex items-center gap-3 text-sm text-slate-600">
                      <CreditCard size={16} className="text-slate-400" />
                      <span className="font-medium truncate">{supplier.bankAccount}</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => handleWhatsApp(supplier.phone, supplier.contact)}
                    className="flex items-center justify-center gap-2 bg-emerald-50 text-emerald-700 py-2.5 rounded-xl text-xs font-bold hover:bg-emerald-100 transition-all"
                  >
                    <MessageCircle size={16} />
                    WhatsApp
                  </button>
                  <button 
                    onClick={() => setSelectedSupplier(supplier)}
                    className="flex items-center justify-center gap-2 bg-slate-50 text-slate-700 py-2.5 rounded-xl text-xs font-bold hover:bg-slate-100 transition-all"
                  >
                    <ExternalLink size={16} />
                    Ficha
                  </button>
                </div>
              </div>
            ))}
          </div>

          {filteredSuppliers.length === 0 && (
            <div className="text-center py-20 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
              <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Users size={32} />
              </div>
              <h3 className="text-lg font-bold text-slate-900">No se encontraron proveedores</h3>
              <p className="text-slate-500 text-sm">Prueba con otros términos de búsqueda o filtros.</p>
            </div>
          )}
        </div>
      </div>
      {selectedSupplier && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[3rem] w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-10 border-b border-slate-100 flex items-center justify-between bg-indigo-600 text-white">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
                  <Truck size={32} />
                </div>
                <div>
                  <h2 className="text-2xl font-black uppercase tracking-tight">{selectedSupplier.name}</h2>
                  <p className="text-indigo-100 text-sm font-bold uppercase tracking-widest">{selectedSupplier.category}</p>
                </div>
              </div>
              <button onClick={() => setSelectedSupplier(null)} className="p-3 text-white/60 hover:text-white hover:bg-white/10 rounded-2xl transition-all">
                <X size={28} />
              </button>
            </div>
            <div className="p-10 space-y-8">
              {/* Innovative Feature 4: Price Trend Visualization */}
              <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp size={16} className="text-indigo-600" />
                    <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Tendencia de Precios (Últ. 4 meses)</h4>
                  </div>
                  <span className="text-xs font-bold text-rose-600">+8.2% vs Q4</span>
                </div>
                <div className="h-24 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={priceTrendData}>
                      <defs>
                        <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="price" stroke="#4f46e5" fillOpacity={1} fill="url(#colorPrice)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Contacto Principal</p>
                    <div className="flex items-center gap-3 text-slate-700">
                      <Users size={18} className="text-indigo-500" />
                      <span className="font-bold">{selectedSupplier.contact}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Teléfono</p>
                    <div className="flex items-center gap-3 text-slate-700">
                      <Phone size={18} className="text-indigo-500" />
                      <span className="font-bold">{selectedSupplier.phone}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Email</p>
                    <div className="flex items-center gap-3 text-slate-700">
                      <Mail size={18} className="text-indigo-500" />
                      <span className="font-bold">{selectedSupplier.email}</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-6">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Dirección</p>
                    <div className="flex items-center gap-3 text-slate-700">
                      <MapPin size={18} className="text-indigo-500" />
                      <span className="font-bold">{selectedSupplier.address}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Cuenta Bancaria (IBAN)</p>
                    <div className="flex items-center gap-3 text-slate-700">
                      <CreditCard size={18} className="text-indigo-500" />
                      <span className="font-bold">{selectedSupplier.bankAccount || 'No especificada'}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Días de Reparto</p>
                    <div className="flex items-center gap-3 text-slate-700">
                      <Clock size={18} className="text-indigo-500" />
                      <span className="font-bold">Lunes, Miércoles, Viernes</span>
                    </div>
                  </div>
                  {/* Innovative Feature 5: Proximity / Carbon Footprint */}
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Huella de Carbono / Proximidad</p>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-black uppercase tracking-widest">
                        <Globe size={12} />
                        Km 0 • Local
                      </div>
                      <span className="text-xs font-bold text-slate-500">12.4 km</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-8 border-t border-slate-100 flex flex-wrap gap-4">
                {/* Innovative Feature 2: Smart Negotiation Brief */}
                <button 
                  onClick={() => setShowNegotiationBrief(selectedSupplier)}
                  className="flex-1 flex items-center justify-center gap-2 bg-indigo-50 text-indigo-700 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-indigo-100 transition-all border border-indigo-100"
                >
                  <Brain size={18} />
                  Briefing Negociación IA
                </button>

                {/* Innovative Feature 3: CIF/NIF Verification (Verifactu) */}
                <button 
                  onClick={() => handleVerifyCIF(selectedSupplier.id)}
                  disabled={isVerifyingCIF === selectedSupplier.id || verifiedCIFs[selectedSupplier.id]}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-lg",
                    verifiedCIFs[selectedSupplier.id] 
                      ? "bg-emerald-50 text-emerald-700 shadow-emerald-50 border border-emerald-100" 
                      : "bg-slate-900 text-white hover:bg-slate-800 shadow-slate-100"
                  )}
                >
                  {isVerifyingCIF === selectedSupplier.id ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : verifiedCIFs[selectedSupplier.id] ? (
                    <FileCheck size={18} />
                  ) : (
                    <ShieldCheck size={18} />
                  )}
                  {verifiedCIFs[selectedSupplier.id] ? 'CIF Verificado (AEAT)' : 'Verificar CIF (Verifactu)'}
                </button>

                <button 
                  onClick={() => handleWhatsApp(selectedSupplier.phone, selectedSupplier.contact)}
                  className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
                >
                  <MessageCircle size={18} />
                  Contactar por WhatsApp
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {isEditModalOpen && editingSupplier && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[3rem] w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                  <Users size={24} />
                </div>
                <h2 className="text-xl font-black uppercase tracking-tight">Editar Proveedor</h2>
              </div>
              <button onClick={() => setIsEditModalOpen(false)} className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-xl transition-all">
                <X size={24} />
              </button>
            </div>
            <div className="p-8 space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Nombre Comercial</label>
                <input 
                  type="text" 
                  value={editingSupplier.name}
                  onChange={e => setEditingSupplier({...editingSupplier, name: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Contacto</label>
                  <input 
                    type="text" 
                    value={editingSupplier.contact}
                    onChange={e => setEditingSupplier({...editingSupplier, contact: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Teléfono</label>
                  <input 
                    type="text" 
                    value={editingSupplier.phone}
                    onChange={e => setEditingSupplier({...editingSupplier, phone: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Email</label>
                <input 
                  type="email" 
                  value={editingSupplier.email}
                  onChange={e => setEditingSupplier({...editingSupplier, email: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Cuenta Bancaria (IBAN)</label>
                <input 
                  type="text" 
                  value={editingSupplier.bankAccount || ''}
                  onChange={e => setEditingSupplier({...editingSupplier, bankAccount: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                />
              </div>
              <button 
                onClick={handleSaveSupplier}
                className="w-full bg-indigo-600 text-white py-4 rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 mt-4"
              >
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showPriceComparison && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[3rem] w-full max-w-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-10 border-b border-slate-100 flex items-center justify-between bg-indigo-50/50">
              <div className="flex items-center gap-3">
                <Scale className="text-indigo-600" size={24} />
                <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Comparador de Precios IA</h2>
              </div>
              <button onClick={() => setShowPriceComparison(false)} className="p-3 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-2xl transition-all">
                <X size={28} />
              </button>
            </div>
            <div className="p-10 space-y-6">
              <p className="text-sm text-slate-500 font-medium">
                Análisis comparativo de los productos más comprados entre tus proveedores habituales.
              </p>
              <div className="space-y-4">
                {comparisonData.map((item, i) => (
                  <div key={i} className="p-6 bg-slate-50 rounded-3xl border border-slate-200">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-base font-black text-slate-900 uppercase tracking-tight">{item.item}</h4>
                      <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase rounded-full tracking-widest">Mejor Opción</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="p-4 bg-white rounded-2xl border border-emerald-200 shadow-sm">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{item.best}</p>
                        <p className="text-xl font-black text-emerald-600">{item.price.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</p>
                      </div>
                      <div className="space-y-2">
                        {item.others.map((other: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-white/50 rounded-xl border border-slate-200">
                            <span className="text-xs font-bold text-slate-600">{other.name}</span>
                            <span className="text-xs font-black text-slate-900">{other.price.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-slate-800 transition-all mt-4">
                Generar Informe de Ahorro Potencial
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 text-center">
              <div className="w-20 h-20 bg-rose-50 text-rose-600 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
                <AlertTriangle size={40} />
              </div>
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">¿Eliminar Proveedor?</h3>
              <p className="text-slate-500 text-sm font-medium mb-8">
                Esta acción no se puede deshacer. Se perderá el historial de contactos y vinculación directa.
              </p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setShowDeleteConfirm(null)}
                  className="flex-1 px-6 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-200 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => handleDeleteSupplier(showDeleteConfirm)}
                  className="flex-1 px-6 py-4 bg-rose-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-rose-700 transition-all shadow-lg shadow-rose-100"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Negotiation Brief Modal */}
      {showNegotiationBrief && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[3rem] w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 bg-indigo-600 text-white flex justify-between items-center">
              <div className="flex items-center gap-3">
                <Brain size={24} />
                <h3 className="text-xl font-black uppercase tracking-tight">Briefing de Negociación IA</h3>
              </div>
              <button onClick={() => setShowNegotiationBrief(null)} className="p-2 hover:bg-white/10 rounded-xl transition-all">
                <X size={24} />
              </button>
            </div>
            <div className="p-8 space-y-6">
              <div className="p-6 bg-indigo-50 rounded-3xl border border-indigo-100">
                <p className="text-xs font-bold text-indigo-900 leading-relaxed">
                  "Basado en los últimos 3 meses, {showNegotiationBrief.name} ha incrementado sus precios un 8.2% por encima de la media del sector. Además, se han registrado 4 retrasos en entregas críticas los viernes."
                </p>
              </div>

              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tendencia de Precios (vs Sector)</h4>
                <div className="h-32 w-full bg-slate-50 rounded-2xl border border-slate-100 p-4 relative overflow-hidden">
                  <div className="absolute inset-0 flex items-end px-4 pb-4 gap-2">
                    {[40, 60, 45, 80, 70, 90].map((h, i) => (
                      <div key={i} className="flex-1 bg-indigo-500/20 rounded-t-lg relative group">
                        <div 
                          className="absolute bottom-0 left-0 right-0 bg-indigo-600 rounded-t-lg transition-all duration-1000" 
                          style={{ height: `${h}%` }} 
                        />
                      </div>
                    ))}
                  </div>
                  <div className="absolute top-4 right-4 flex items-center gap-2">
                    <TrendingUp size={14} className="text-rose-500" />
                    <span className="text-[10px] font-black text-rose-500">+8.2%</span>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Puntos Clave para Negociar</h4>
                <div className="space-y-2">
                  {[
                    'Solicitar descuento por volumen del 5%',
                    'Revisar penalizaciones por retraso',
                    'Comparar precios con Proveedor Alternativo B',
                    'Extender plazo de pago a 60 días'
                  ].map((point, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <Zap size={14} className="text-amber-500" />
                      <span className="text-xs font-bold text-slate-700">{point}</span>
                    </div>
                  ))}
                </div>
              </div>
              <button 
                onClick={() => setShowNegotiationBrief(null)}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-800 transition-all"
              >
                Entendido, preparar reunión
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
