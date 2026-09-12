import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./src/context/AuthContext";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { UpdateGate } from "./src/components/UpdateGate";
import { ApiError } from "./src/lib/api";

/**
 * The API talks to a database over the internet, so the odd dropped connection
 * is normal. Retry those; never retry a real answer like 401/403/404/409.
 */
function retry(failureCount: number, error: unknown) {
  if (error instanceof ApiError && error.status < 500) return false;
  return failureCount < 3;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
    mutations: { retry },
  },
});

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <UpdateGate>
            <AuthProvider>
              <StatusBar style="dark" />
              <RootNavigator />
            </AuthProvider>
          </UpdateGate>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
