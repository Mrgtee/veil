import { Outlet, Navigate } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { Footer } from "./Footer";
import { useAccount } from "wagmi";

export function AppShell() {
  const { isConnected } = useAccount();

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
