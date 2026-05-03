import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuth } from "./hooks/useAuth";
import Login from "./pages/Login";
import Chat from "./pages/Chat";
import IaiIcon from "./components/IaiIcon";

const queryClient = new QueryClient();

function Splash() {
  return (
    <div
      className="fade-in"
      style={{
        height: "100dvh",
        background: "#0D0D0D",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "0",
      }}
    >
      <IaiIcon width={56} height={66} />
      <div
        style={{
          color: "#F2F2F2",
          fontSize: "28px",
          fontWeight: 700,
          lineHeight: 1.1,
          letterSpacing: "-0.01em",
          marginTop: "12px",
        }}
      >
        IAí
      </div>
      <div
        style={{
          color: "#B8953F",
          fontSize: "11px",
          letterSpacing: "0.12em",
          marginTop: "4px",
          fontWeight: 400,
        }}
      >
        by PRIORIS
      </div>
    </div>
  );
}

function AppInner() {
  const { user, loading, login, logout } = useAuth();

  if (loading) return <Splash />;
  if (!user) return <Login onLogin={login} />;
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
