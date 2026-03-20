import React, { useState } from 'react';
import { AlbaranesList } from './AlbaranesList';
import { AlbaranEditModal } from './AlbaranEditModal';
import { Albaran, BusinessUnit, AppData } from '../../types';

interface AlbaranesViewProps {
  data: AppData;
  searchQ: string;
  selectedUnit: BusinessUnit | 'ALL';
  businessUnits: any[];
  onSave: (newData: AppData) => Promise<void>;
}

export const AlbaranesView = ({ 
  data, searchQ, selectedUnit, businessUnits, onSave 
}: AlbaranesViewProps) => {
  
  const [editingAlbaran, setEditingAlbaran] = useState<Albaran | null>(null);

  const handleSaveAlbaran = async () => {
    if (!editingAlbaran) return;
    const newAlbaranes = data.albaranes.map(a => a.id === editingAlbaran.id ? editingAlbaran : a);
    await onSave({ ...data, albaranes: newAlbaranes });
    setEditingAlbaran(null);
  };

  const handleDeleteAlbaran = async (id: string) => {
    const newAlbaranes = data.albaranes.filter(a => a.id !== id);
    await onSave({ ...data, albaranes: newAlbaranes });
    setEditingAlbaran(null);
  };

  return (
    <>
      <AlbaranesList 
        albaranes={data.albaranes || []}
        searchQ={searchQ}
        selectedUnit={selectedUnit}
        businessUnits={businessUnits}
        onOpenEdit={setEditingAlbaran}
      />

      {editingAlbaran && (
        <AlbaranEditModal 
          editForm={editingAlbaran}
          sociosReales={data.socios || []}
          setEditForm={setEditingAlbaran as any}
          onClose={() => setEditingAlbaran(null)}
          onSave={handleSaveAlbaran}
          onDelete={handleDeleteAlbaran}
        />
      )}
    </>
  );
};
