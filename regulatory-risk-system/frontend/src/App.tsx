import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import DashboardLayout from './layouts/DashboardLayout';
import RequireAuth from './components/RequireAuth';
import Dashboard from './pages/Dashboard';
import CompanyDetail from './pages/CompanyDetail';
import BatchScan from './pages/BatchScan';
import EvalCenter from './pages/EvalCenter';
import McpTools from './pages/McpTools';
import History from './pages/History';
import MlMetrics from './pages/MlMetrics';
import SkillFiles from './pages/SkillFiles';
import Login from './pages/Login';
import Backtest from './pages/Backtest';
import RegulationFocus from './pages/RegulationFocus';
import Tasks from './pages/Tasks';

function ProtectedShell() {
  return (
    <RequireAuth>
      <DashboardLayout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/company/:code" element={<CompanyDetail />} />
          <Route path="/scan" element={<BatchScan />} />
          <Route path="/eval" element={<EvalCenter />} />
          <Route path="/backtest" element={<Backtest />} />
          <Route path="/regulation-focus" element={<RegulationFocus />} />
          <Route path="/mcp" element={<McpTools />} />
          <Route path="/history" element={<History />} />
          <Route path="/ml" element={<MlMetrics />} />
          <Route path="/skills" element={<SkillFiles />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </DashboardLayout>
    </RequireAuth>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/*" element={<ProtectedShell />} />
      </Routes>
    </BrowserRouter>
  );
}
