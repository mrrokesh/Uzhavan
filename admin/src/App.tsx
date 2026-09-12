import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "./lib/api";
import { AuthProvider, useAuth } from "./lib/auth";
import { Layout } from "./components/Layout";
import { Spinner } from "./components/ui";
import { Login } from "./pages/Login";
import { Overview } from "./pages/Overview";
import { Verification } from "./pages/Verification";
import { Accounts } from "./pages/Accounts";
import { Tickets } from "./pages/Tickets";
import { Staff } from "./pages/Staff";
import { Settings } from "./pages/Settings";
import { Releases } from "./pages/Releases";
import { Audit } from "./pages/Audit";
import { Announcements } from "./pages/Announcements";
import { Payments } from "./pages/Payments";
import { Tracking } from "./pages/Tracking";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Retry a dropped connection, never a real answer like 403 or 404.
      retry: (count, error) =>
        error instanceof ApiError && error.status < 500 ? false : count < 2,
      staleTime: 10_000,
      refetchOnWindowFocus: true,
    },
  },
});

function Gate() {
  const { ready, session } = useAuth();
  if (!ready) return <Spinner />;
  if (!session) return <Login />;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Overview />} />
        <Route path="verification" element={<Verification />} />
        <Route path="accounts" element={<Accounts />} />
        <Route path="tickets" element={<Tickets />} />
        <Route path="tracking" element={<Tracking />} />
        <Route path="announcements" element={<Announcements />} />
        <Route path="payments" element={<Payments />} />
        <Route path="staff" element={<Staff />} />
        <Route path="settings" element={<Settings />} />
        <Route path="releases" element={<Releases />} />
        <Route path="audit" element={<Audit />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Gate />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
