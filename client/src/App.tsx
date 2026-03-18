/**
 * Sentinel Supplier Assurance Platform — Client
 * Day 4: Router, layout, protected routes, placeholder pages, login
 */
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { getDefaultPath } from './config/rolePageAccess';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Risk } from './pages/Risk';
import { CorrectiveActions } from './pages/CorrectiveActions';
import { CARRecord } from './pages/CARRecord';
import { Findings } from './pages/Findings';
import { FindingsRecord } from './pages/FindingsRecord';
import { Audits } from './pages/Audits';
import { SupplierProfile } from './pages/SupplierProfile';
import { SupplierList } from './pages/SupplierList';
import { SuppliersMap } from './pages/SuppliersMap';
import { Records } from './pages/Records';
import { Shipments } from './pages/Shipments';
import { Documents } from './pages/Documents';
import { InternalManagement } from './pages/InternalManagement';
import { Admin } from './pages/Admin';

function RedirectToDefault() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={getDefaultPath(user.roleNames)} replace />;
}

function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<RedirectToDefault />} />
            <Route path="dashboard" element={<ProtectedRoute path="/dashboard"><Dashboard /></ProtectedRoute>} />
            <Route path="risk" element={<ProtectedRoute path="/risk"><Risk /></ProtectedRoute>} />
            <Route path="corrective-actions" element={<ProtectedRoute path="/corrective-actions"><CorrectiveActions /></ProtectedRoute>} />
            <Route path="car-record" element={<ProtectedRoute path="/car-record"><CARRecord /></ProtectedRoute>} />
            <Route path="findings" element={<ProtectedRoute path="/findings"><Findings /></ProtectedRoute>} />
            <Route path="findings-record" element={<ProtectedRoute path="/findings-record"><FindingsRecord /></ProtectedRoute>} />
            <Route path="audits" element={<ProtectedRoute path="/audits"><Audits /></ProtectedRoute>} />
            <Route path="supplier-profile" element={<ProtectedRoute path="/supplier-profile"><SupplierProfile /></ProtectedRoute>} />
            <Route path="supplier-list" element={<ProtectedRoute path="/supplier-list"><SupplierList /></ProtectedRoute>} />
            <Route path="suppliers-map" element={<ProtectedRoute path="/suppliers-map"><SuppliersMap /></ProtectedRoute>} />
            <Route path="records" element={<ProtectedRoute path="/records"><Records /></ProtectedRoute>} />
            <Route path="shipments" element={<ProtectedRoute path="/shipments"><Shipments /></ProtectedRoute>} />
            <Route path="documents" element={<ProtectedRoute path="/documents"><Documents /></ProtectedRoute>} />
            <Route path="internal-management" element={<ProtectedRoute path="/internal-management"><InternalManagement /></ProtectedRoute>} />
            <Route path="admin" element={<ProtectedRoute path="/admin"><Admin /></ProtectedRoute>} />
          </Route>
          <Route path="*" element={<RedirectToDefault />} />
        </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}

export default App;
