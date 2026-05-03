import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuth } from "./hooks/useAuth";
import Login from "./pages/Login";
import Chat from "./pages/Chat";

const queryClient = new QueryClient();

function AppInner() {
  const { user, loading, login, logout } = useAuth();

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "#0D0D0D" }}
      >
        <span className="text-xs" style={{ color: "#333" }}>
          Carregando...
        </span>
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={login} />;
  }

  return <Chat user={user} onLogout={logout} />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppInner />
    </QueryClientProvider>
  );
}

export default App;
