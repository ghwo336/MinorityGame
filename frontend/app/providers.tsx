"use client";

import { RainbowKitProvider, lightTheme, darkTheme } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { config } from "@/config/wagmi";
import Header from "@/components/Header";
import "@rainbow-me/rainbowkit/styles.css";

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();

  const rainbowTheme = resolvedTheme === "dark"
    ? darkTheme({
        accentColor: "#0052ff",
        accentColorForeground: "white",
        borderRadius: "large",
      })
    : lightTheme({
        accentColor: "#0052ff",
        accentColorForeground: "white",
        borderRadius: "large",
      });

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={rainbowTheme}>
          <Header />
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
