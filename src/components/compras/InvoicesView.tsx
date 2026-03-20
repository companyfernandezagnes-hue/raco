import React, { useState } from 'react';
import { InvoicesList } from './InvoicesList';
import { InvoiceDetailModal } from './InvoiceDetailModal';
import { FacturaExtended, BusinessUnit, AppData } from '../../types';

interface InvoicesViewProps {
  data: AppData;
  searchQ: string;
  selectedUnit: BusinessUnit | 'ALL';
  onSave: (newData: AppData) => Promise<void>;
}

export const InvoicesView = ({ 
  data, searchQ, selectedUnit, onSave 
}: InvoicesViewProps) => {
  
  const [selectedFactura, setSelectedFactura] = useState<FacturaExtended | null>(null);

  const handleUpdateData = async (newData: AppData) => {
    await onSave(newData);
    if (selectedFactura) {
      const updated = newData.facturas.find(f => f.id === selectedFactura.id);
      if (updated) setSelectedFactura(updated);
    }
  };

  const handleDeleteFactura = async (id: string) => {
    const newFacturas = data.facturas.filter(f => f.id !== id);
    await onSave({ ...data, facturas: newFacturas });
    setSelectedFactura(null);
  };

  return (
    <>
      <InvoicesList 
        facturas={data.facturas || []}
        albaranes={data.albaranes || []}
        searchQ={searchQ}
        selectedUnit={selectedUnit}
        onOpenDetail={setSelectedFactura}
      />

      {selectedFactura && (
        <InvoiceDetailModal 
          factura={selectedFactura}
          albaranes={data.albaranes || []}
          data={data}
          onClose={() => setSelectedFactura(null)}
          onUpdateData={handleUpdateData}
          onDelete={handleDeleteFactura}
        />
      )}
    </>
  );
};
