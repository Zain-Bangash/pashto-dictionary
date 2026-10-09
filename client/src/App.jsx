import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { LookupsProvider } from './context/LookupsContext';
import { FieldsProvider } from './context/FieldsContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Concepts from './pages/Concepts';
import Wanted from './pages/Wanted';
import ConceptDetail from './pages/ConceptDetail';
import Login from './pages/Login';
import Register from './pages/Register';
import Submit from './pages/Submit';
import MySubmissions from './pages/MySubmissions';
import DashboardLayout from './pages/dashboard/DashboardLayout';
import DashboardHome from './pages/dashboard/DashboardHome';
import DashboardQueue from './pages/dashboard/DashboardQueue';
import DashboardConcepts from './pages/dashboard/DashboardConcepts';
import DashboardUsers from './pages/dashboard/DashboardUsers';
import DashboardLog from './pages/dashboard/DashboardLog';
import DashboardLists from './pages/dashboard/DashboardLists';
import DashboardFields from './pages/dashboard/DashboardFields';
import NotFound from './pages/NotFound';

function AppRoutes() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/concepts" element={<Concepts />} />
        <Route path="/concepts/:id" element={<ConceptDetail />} />
        <Route path="/wanted" element={<Wanted />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/submit"
          element={
            <ProtectedRoute>
              <Submit />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-submissions"
          element={
            <ProtectedRoute>
              <MySubmissions />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <DashboardLayout>
              <DashboardHome />
            </DashboardLayout>
          }
        />
        <Route
          path="/dashboard/queue"
          element={
            <DashboardLayout>
              <DashboardQueue />
            </DashboardLayout>
          }
        />
        <Route
          path="/dashboard/concepts"
          element={
            <DashboardLayout>
              <DashboardConcepts />
            </DashboardLayout>
          }
        />
        <Route
          path="/dashboard/users"
          element={
            <DashboardLayout>
              <DashboardUsers />
            </DashboardLayout>
          }
        />
        <Route
          path="/dashboard/log"
          element={
            <DashboardLayout>
              <DashboardLog />
            </DashboardLayout>
          }
        />
        <Route
          path="/dashboard/lists"
          element={
            <DashboardLayout>
              <DashboardLists />
            </DashboardLayout>
          }
        />
        <Route
          path="/dashboard/fields"
          element={
            <DashboardLayout>
              <DashboardFields />
            </DashboardLayout>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <LookupsProvider>
          <FieldsProvider>
            <AppRoutes />
          </FieldsProvider>
        </LookupsProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
