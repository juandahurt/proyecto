import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import {
  PublicOnly,
  RequireNotOnboarded,
  RequireOnboarded,
  RequireSession,
  SessionRedirect,
} from './auth/guards';
import { AppLayout } from './components/AppLayout';
import History from './pages/History';
import Login from './pages/Login';
import NotFound from './pages/NotFound';
import Onboarding from './pages/Onboarding';
import Register from './pages/Register';
import Settings from './pages/Settings';
import Upload from './pages/Upload';

function Root() {
  const { token } = useAuth();
  return token ? <SessionRedirect /> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Root />} />
        <Route element={<PublicOnly />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Route>
        <Route element={<RequireSession />}>
          <Route element={<RequireNotOnboarded />}>
            <Route path="/onboarding" element={<Onboarding />} />
          </Route>
          <Route element={<RequireOnboarded />}>
            <Route element={<AppLayout />}>
              <Route path="/upload" element={<Upload />} />
              <Route path="/history" element={<History />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  );
}
