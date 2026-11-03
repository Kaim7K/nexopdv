import { Gauge } from 'lucide-react';
import { PageHeader } from '@/components/common/AppShell';
import ManagementPanel from '@/components/management/ManagementPanel';

export default function Inicio() {
  return <div className="page-shell"><PageHeader icon={Gauge} eyebrow="Gestão da loja" title="Visão geral" description="O que aconteceu hoje e o que precisa de atenção." /><ManagementPanel onboarding /></div>;
}
