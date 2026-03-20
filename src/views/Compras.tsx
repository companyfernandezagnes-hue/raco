import React from 'react';
import { ComprasDashboard } from '../components/ComprasDashboard';
import { AppData } from '../types';

interface ComprasViewProps {
  data: AppData;
  onSave: (newData: AppData) => Promise<void>;
}

export default function ComprasView({ data, onSave }: ComprasViewProps) {
  return <ComprasDashboard data={data} onSave={onSave} />;
}
