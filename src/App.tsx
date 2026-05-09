import "@rainbow-me/rainbowkit/styles.css";
import { RainbowKitProvider, lightTheme } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WagmiProvider } from "wagmi";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import { AppShell } from "./components/layout/AppShell";
import Dashboard from "./pages/Dashboard";
import NewPayment from "./pages/NewPayment";
import BatchPayments from "./pages/BatchPayments";
import UnifiedBalance from "./pages/UnifiedBalance";
import Bridge from "./pages/Bridge";
import History from "./pages/History";
import ConfidentialRecords from "./pages/ConfidentialRecords";
import AccessControl from "./pages/AccessControl";
import Settings from "./pages/Settings";
import { wagmiConfig } from "./lib/wallet";
import { arcTestnet } from "./lib/arc";

const queryClient = new QueryClient();
const rainbowTheme = lightTheme({
  accentColor: "#56351f",
  accentColorForeground: "#fffaf2",
  borderRadius: "small",
  fontStack: "system",
  overlayBlur: "small",
});

const App = () => (
  <WagmiProvider config={wagmiConfig}>
    <QueryClientProvider client={queryClient}>
      <RainbowKitProvider initialChain={arcTestnet} modalSize="compact" theme={rainbowTheme}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/app" element={<AppShell />}>
                <Route index element={<Dashboard />} />
                <Route path="payments/new" element={<NewPayment />} />
                <Route path="batch" element={<BatchPayments />} />
                <Route path="unified-balance" element={<UnifiedBalance />} />
                <Route path="bridge" element={<Bridge />} />
                <Route path="history" element={<History />} />
                <Route path="confidential" element={<ConfidentialRecords />} />
                <Route path="access" element={<AccessControl />} />
                <Route path="settings" element={<Settings />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </RainbowKitProvider>
    </QueryClientProvider>
  </WagmiProvider>
);

export default App;
