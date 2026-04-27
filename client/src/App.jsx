import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/AuthContext';
import { setLogoutHandler } from './services/api';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Concepts from './pages/Concepts';
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

function AppRoutes() {
  const { logout } = useAuth();

  useEffect(() => {
    setLogoutHandler(logout);
  }, [logout]);

  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/concepts" element={<Concepts />} />
        <Route path="/concepts/:id" element={<ConceptDetail />} />
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
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
