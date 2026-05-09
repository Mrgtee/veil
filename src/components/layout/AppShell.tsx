import { Outlet, Navigate } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { Footer } from "./Footer";
import { useAccount } from "wagmi";

export function AppShell() {
  const { isConnected, isConnecting, isReconnecting } = useAccount();

  if (isConnecting || isReconnecting) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-6 text-center">
        <div>
          <div className="font-display text-2xl text-foreground">Opening Veil</div>
          <div className="mt-2 text-sm text-muted-foreground">Checking wallet connection.</div>
        </div>
      </div>
    );
  }

  if (!isConnected) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen flex bg-background overflow-x-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 w-full">
        <TopBar />
        <main className="flex-1 w-full max-w-[1400px] mx-auto px-4 py-5 sm:px-6 sm:py-8 animate-fade-in overflow-x-hidden">
          <Outlet />
        </main>
        <Footer />
      </div>
    </div>
  );
}
