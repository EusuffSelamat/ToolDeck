"use client";

import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Navigating back to a view within this window serves cached data
            // instantly instead of re-hitting the (network-bound) API. Mutations
            // still invalidate their queries, so data stays correct.
            staleTime: 60 * 1000, // 60s
            gcTime: 5 * 60 * 1000, // keep unused data cached for 5 min
            retry: 1,
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
          },
        },
      })
  );

  return (
    <SessionProvider
      refetchOnWindowFocus={false}
      refetchInterval={5 * 60 * 1000} // 5 min (reduces fetch errors vs default polling)
    >
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </SessionProvider>
  );
}
