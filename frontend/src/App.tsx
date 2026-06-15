import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState, createContext, useContext } from 'react';
import Login from './pages/Login';
import MainLayout from './layouts/MainLayout';
import Dashboard from './pages/Dashboard';
import RemainsList from './pages/remains/RemainsList';
import RemainsCreate from './pages/remains/RemainsCreate';
import CeremonyList from './pages/ceremony/CeremonyList';
import CremationList from './pages/cremation/CremationList';
import AshesList from './pages/ashes/AshesList';
import PaymentList from './pages/payment/PaymentList';
import ScheduleList from './pages/schedule/ScheduleList';
import Statistics from './pages/statistics/Statistics';
import { User } from './types';

interface AuthContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  login: (user: User, token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

function AppContent() {
  const { user } = useAuth();

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route
        path="/*"
        element={
          <MainLayout user={user}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/remains" element={<RemainsList />} />
              <Route path="/remains/create" element={<RemainsCreate />} />
              <Route path="/ceremony" element={<CeremonyList />} />
              <Route path="/cremation" element={<CremationList />} />
              <Route path="/ashes" element={<AshesList />} />
              <Route path="/payment" element={<PaymentList />} />
              <Route path="/schedule" element={<ScheduleList />} />
              <Route path="/statistics" element={<Statistics />} />
            </Routes>
          </MainLayout>
        }
      />
    </Routes>
  );
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    if (token && userStr) {
      try {
        setUser(JSON.parse(userStr));
      } catch (e) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
  }, []);

  const login = (userData: User, token: string) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  if (loading) return null;

  return (
    <AuthContext.Provider value={{ user, setUser, login, logout }}>
      <Router>
        <AppContent />
      </Router>
    </AuthContext.Provider>
  );
}

export default App;
