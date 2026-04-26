import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import Entries from './pages/Entries';
import EntryDetail from './pages/EntryDetail';
import Login from './pages/Login';
import Register from './pages/Register';
import Submit from './pages/Submit';
import MySubmissions from './pages/MySubmissions';
import DashboardLayout from './pages/dashboard/DashboardLayout';
import DashboardHome from './pages/dashboard/DashboardHome';
import DashboardQueue from './pages/dashboard/DashboardQueue';
import DashboardEntries from './pages/dashboard/DashboardEntries';
import DashboardUsers from './pages/dashboard/DashboardUsers';
import DashboardLog from './pages/dashboard/DashboardLog';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/entries" element={<Entries />} />
          <Route path="/entries/:id" element={<EntryDetail />} />
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
            path="/dashboard/entries"
            element={
              <DashboardLayout>
                <DashboardEntries />
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
      </AuthProvider>
    </BrowserRouter>
  );
}
