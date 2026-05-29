import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Domains from "./pages/Domains";
import SmtpCredentials from "./pages/SmtpCredentials";
import EmailLogs from "./pages/EmailLogs";
import Layout from "./components/Layout";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem("token");
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
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
        <Route index element={<Dashboard />} />
        <Route path="domains" element={<Domains />} />
        <Route path="smtp-credentials" element={<SmtpCredentials />} />
        <Route path="email-logs" element={<EmailLogs />} />
      </Route>
    </Routes>
  );
}
