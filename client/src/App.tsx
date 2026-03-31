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
import { RequestAccess } from './pages/RequestAccess';
import { ForgotPassword } from './pages/ForgotPassword';
import { Dashboard } from './pages/Dashboard';
import { Risk } from './pages/Risk';
import { CorrectiveActions } from './pages/CorrectiveActions';
import { CARRecord } from './pages/CARRecord';
import { Findings } from './pages/Findings';
import { FindingsRecord } from './pages/FindingsRecord';
import { Audits } from './pages/Audits';
import { AuditRecord } from './pages/AuditRecord';
import { SupplierProfile } from './pages/SupplierProfile';
import { SupplierList } from './pages/SupplierList';
import { SuppliersMap } from './pages/SuppliersMap';
import { Records } from './pages/Records';
import { Shipments } from './pages/Shipments';
import { Documents } from './pages/Documents';
import { InternalManagement } from './pages/InternalManagement';
import { Admin } from './pages/Admin';
import { NoAccess } from './pages/NoAccess';
import { ProductHub } from './pages/ProductHub';
import { GlobalVendorsIndex } from './pages/globalVendors/GlobalVendorsIndex';
import { FarmersInformationPage } from './pages/globalVendors/FarmersInformationPage';
import { ApprovedFarmersPage } from './pages/globalVendors/ApprovedFarmersPage';
import { GlobalVendorsAdmin } from './pages/globalVendors/GlobalVendorsAdmin';

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
          <Route path="/request-access" element={<RequestAccess />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route
            path="/product-hub"
            element={
              <ProtectedRoute path="/product-hub">
                <ProductHub />
              </ProtectedRoute>
            }
          />
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
            <Route path="findings/create" element={<ProtectedRoute path="/findings/create"><FindingsRecord /></ProtectedRoute>} />
            <Route path="findings-record" element={<ProtectedRoute path="/findings-record"><FindingsRecord /></ProtectedRoute>} />
            <Route path="audits" element={<ProtectedRoute path="/audits"><Audits /></ProtectedRoute>} />
            <Route path="audit-record" element={<ProtectedRoute path="/audits"><AuditRecord /></ProtectedRoute>} />
            <Route path="supplier-profile" element={<ProtectedRoute path="/supplier-profile"><SupplierProfile /></ProtectedRoute>} />
            <Route path="supplier-list" element={<ProtectedRoute path="/supplier-list"><SupplierList /></ProtectedRoute>} />
            <Route path="suppliers-map" element={<ProtectedRoute path="/suppliers-map"><SuppliersMap /></ProtectedRoute>} />
            <Route path="records" element={<ProtectedRoute path="/records"><Records /></ProtectedRoute>} />
            <Route path="shipments" element={<ProtectedRoute path="/shipments"><Shipments /></ProtectedRoute>} />
            <Route path="documents" element={<ProtectedRoute path="/documents"><Documents /></ProtectedRoute>} />
            <Route path="internal-management" element={<ProtectedRoute path="/internal-management"><InternalManagement /></ProtectedRoute>} />
            <Route path="admin" element={<ProtectedRoute path="/admin"><Admin /></ProtectedRoute>} />
            <Route path="no-access" element={<ProtectedRoute path="/no-access"><NoAccess /></ProtectedRoute>} />
            <Route path="global-vendors">
              <Route
                index
                element={
                  <ProtectedRoute path="/global-vendors">
                    <GlobalVendorsIndex />
                  </ProtectedRoute>
                }
              />
              <Route
                path="farmers"
                element={
                  <ProtectedRoute path="/global-vendors/farmers">
                    <FarmersInformationPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="approved"
                element={
                  <ProtectedRoute path="/global-vendors/approved">
                    <ApprovedFarmersPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="admin"
                element={
                  <ProtectedRoute path="/global-vendors/admin">
                    <GlobalVendorsAdmin />
                  </ProtectedRoute>
                }
              />
            </Route>
          </Route>
          <Route path="*" element={<RedirectToDefault />} />
        </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}

export default App;
