import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient();

function HelloPage() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center" style={{ background: "hsl(220 30% 8%)" }}>
      <div className="text-center space-y-4">
        <div className="text-xs font-semibold tracking-[0.3em] uppercase" style={{ color: "hsl(40 70% 55%)" }}>
          Suporte à Decisão Executiva
        </div>
        <h1 className="text-5xl font-bold tracking-tight" style={{ color: "hsl(0 0% 96%)" }}>
          Olá, IAí
        </h1>
        <p className="text-sm" style={{ color: "hsl(220 15% 55%)" }}>
          Ambiente configurado com sucesso.
        </p>
        <div className="pt-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs" style={{ background: "hsl(220 25% 14%)", color: "hsl(220 15% 55%)", border: "1px solid hsl(220 20% 18%)" }}>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block"></span>
            Pronto para construção
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <HelloPage />
    </QueryClientProvider>
  );
}

export default App;
