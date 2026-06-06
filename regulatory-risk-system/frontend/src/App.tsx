import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from './layouts/DashboardLayout';
import Dashboard from './pages/Dashboard';
import CompanyDetail from './pages/CompanyDetail';
import BatchScan from './pages/BatchScan';
import EvalCenter from './pages/EvalCenter';
import McpTools from './pages/McpTools';
import History from './pages/History';
import MlMetrics from './pages/MlMetrics';
import SkillFiles from './pages/SkillFiles';

export default function App() {
  return (
    <BrowserRouter>
      <DashboardLayout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/company/:code" element={<CompanyDetail />} />
          <Route path="/scan" element={<BatchScan />} />
          <Route path="/eval" element={<EvalCenter />} />
          <Route path="/mcp" element={<McpTools />} />
          <Route path="/history" element={<History />} />
          <Route path="/ml" element={<MlMetrics />} />
          <Route path="/skills" element={<SkillFiles />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </DashboardLayout>
    </BrowserRouter>
  );
}
