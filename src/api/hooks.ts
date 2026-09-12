import { Platform } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import {
  toCrop,
  toTruck,
  type ApiBooking,
  type ApiCrop,
  type ApiOrder,
  type ApiRequest,
  type ApiTruck,
  type Crop,
  type CropFilters,
  type CropSearch,
  type DemandBoard,
  type DriverSummary,
  type FarmerSummary,
  type Fare,
  type Me,
  type Truck,
  type AppConfig,
  type Ticket,
  type TicketCategory,
  type TicketThread,
  type UploadDoc,
  type VerificationState,
} from "./types";

export const keys = {
  me: ["me"] as const,
  crops: (filter: string, q: string) => ["crops", filter, q] as const,
  crop: (id: string) => ["crop", id] as const,
  trucks: (loadKg?: number) => ["trucks", loadKg ?? 0] as const,
  requests: ["requests"] as const,
  request: (id: string) => ["request", id] as const,
  orders: ["orders"] as const,
  order: (id: string) => ["order", id] as const,
  booking: (id: string) => ["booking", id] as const,
  farmerSummary: ["farmer", "summary"] as const,
  farmerCrops: ["farmer", "crops"] as const,
  farmerRequests: ["farmer", "requests"] as const,
  farmerOrders: ["farmer", "orders"] as const,
  driverSummary: ["driver", "summary"] as const,
  driverJobs: ["driver", "jobs"] as const,
  driverTrips: ["driver", "trips"] as const,
};

/** Poll while a screen is waiting on someone else to act. */
const LIVE = { refetchInterval: 8000 } as const;

// ---- Shared ---------------------------------------------------------------

export function useMe() {
  return useQuery({ queryKey: keys.me, queryFn: () => api<Me>("/me") });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, string>) =>
      api<Me>("/me", { method: "PATCH", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.me }),
  });
}

// ---- Buyer: browsing ------------------------------------------------------

export function useCrops(
  filter: "for-you" | "ready" | "upcoming" | "following",
  search = "",
  filters: CropFilters = {},
) {
  return useQuery({
    queryKey: [...keys.crops(filter, search), filters],
    queryFn: async (): Promise<{ origin: string | null; crops: Crop[] }> => {
      const params = new URLSearchParams();
      if (filter === "ready" || filter === "upcoming") params.set("status", filter);
      if (filter === "following") params.set("following", "true");
      if (search.trim()) params.set("q", search.trim());
      if (filters.district) params.set("district", filters.district);
      if (filters.radiusKm) params.set("radiusKm", String(filters.radiusKm));
      if (filters.verifiedOnly) params.set("verifiedOnly", "true");
      if (filters.category) params.set("category", filters.category);
      if (filters.minPrice !== undefined) params.set("minPrice", String(filters.minPrice));
      if (filters.maxPrice !== undefined) params.set("maxPrice", String(filters.maxPrice));
      if (filters.sort) params.set("sort", filters.sort);
      const qs = params.toString();
      const res = await api<CropSearch>(`/crops${qs ? `?${qs}` : ""}`);
      return { origin: res.origin, crops: res.crops.map(toCrop) };
    },
  });
}

/** The 38 Tamil Nadu districts, for the location picker. */
export function useDistricts() {
  return useQuery({
    queryKey: ["districts"],
    queryFn: () => api<string[]>("/crops/districts"),
    staleTime: Infinity,
  });
}

/** What buyers nearby are actually buying — the farmer's demand board. */
export function useDemand(radiusKm = 200) {
  return useQuery({
    queryKey: ["demand", radiusKm],
    queryFn: () => api<DemandBoard>(`/farmer/demand?radiusKm=${radiusKm}`),
  });
}

export function useCrop(id: string | undefined) {
  return useQuery({
    queryKey: keys.crop(id ?? "none"),
    enabled: !!id,
    queryFn: async () => toCrop(await api<ApiCrop>(`/crops/${id}`)),
  });
}

/** Other listings from the same farm — powers the farmer profile screen. */
export function useFarmCrops(farmId: string | undefined) {
  return useQuery({
    queryKey: ["farmCrops", farmId ?? "none"],
    enabled: !!farmId,
    queryFn: async (): Promise<Crop[]> => {
      const rows = await api<ApiCrop[]>(`/crops?farmId=${farmId}`);
      return rows.map(toCrop);
    },
  });
}

export function useToggleFollow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ cropId, on }: { cropId: string; on: boolean }) =>
      api<{ following: string[] }>(`/me/follows/${cropId}`, { method: on ? "PUT" : "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.me });
      qc.invalidateQueries({ queryKey: ["crops"] });
    },
  });
}

export function useToggleSaved() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ cropId, on }: { cropId: string; on: boolean }) =>
      api<{ saved: string[] }>(`/me/saved/${cropId}`, { method: on ? "PUT" : "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.me }),
  });
}

// ---- Buyer: requests ------------------------------------------------------

export function useRequests() {
  return useQuery({ queryKey: keys.requests, queryFn: () => api<ApiRequest[]>("/requests"), ...LIVE });
}

export function useRequest(id: string | undefined, live = false) {
  return useQuery({
    queryKey: keys.request(id ?? "none"),
    enabled: !!id,
    queryFn: () => api<ApiRequest>(`/requests/${id}`),
    ...(live ? LIVE : {}),
  });
}

export function useCreateRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { cropId: string; quantityKg: number }) =>
      api<ApiRequest>("/requests", { method: "POST", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.requests });
      qc.invalidateQueries({ queryKey: ["crops"] });
    },
  });
}

export function useConfirmRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<ApiOrder>(`/requests/${id}/confirm`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.requests });
      qc.invalidateQueries({ queryKey: keys.orders });
      qc.invalidateQueries({ queryKey: ["crops"] });
    },
  });
}

export function useRequestAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: "decline" | "cancel" }) =>
      api<ApiRequest>(`/requests/${id}/${action}`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.requests });
      qc.invalidateQueries({ queryKey: ["crops"] });
    },
  });
}

// ---- Buyer: orders, trucks, bookings --------------------------------------

export function useOrders() {
  return useQuery({ queryKey: keys.orders, queryFn: () => api<ApiOrder[]>("/orders"), ...LIVE });
}

export function useOrder(id: string | undefined, live = false) {
  return useQuery({
    queryKey: keys.order(id ?? "none"),
    enabled: !!id,
    queryFn: () => api<ApiOrder>(`/orders/${id}`),
    ...(live ? LIVE : {}),
  });
}

export function useSetTransport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, transport }: { id: string; transport: "BOOK" | "PRIVATE" }) =>
      api<ApiOrder>(`/orders/${id}`, { method: "PATCH", body: { transport } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.orders }),
  });
}

export function useTrucks(loadKg?: number) {
  return useQuery({
    queryKey: keys.trucks(loadKg),
    enabled: !!loadKg,
    queryFn: async (): Promise<Truck[]> => {
      const rows = await api<ApiTruck[]>(`/trucks${loadKg ? `?loadKg=${loadKg}` : ""}`);
      return rows.map(toTruck);
    },
  });
}

export function useFare(truckId: string | undefined) {
  return useQuery({
    queryKey: ["fare", truckId ?? "none"],
    enabled: !!truckId,
    queryFn: () => api<Fare>(`/bookings/quote/fare?truckId=${truckId}`),
  });
}

export function useBooking(id: string | undefined, live = false) {
  return useQuery({
    queryKey: keys.booking(id ?? "none"),
    enabled: !!id,
    queryFn: () => api<ApiBooking>(`/bookings/${id}`),
    ...(live ? LIVE : {}),
  });
}

export function useCreateBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { orderId: string; truckId: string }) =>
      api<ApiBooking>("/bookings", { method: "POST", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.orders });
      qc.invalidateQueries({ queryKey: ["trucks"] });
    },
  });
}

export function usePayBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<ApiBooking>(`/bookings/${id}/pay`, { method: "POST" }),
    onSuccess: (b) => {
      qc.invalidateQueries({ queryKey: keys.booking(b.id) });
      qc.invalidateQueries({ queryKey: keys.orders });
    },
  });
}

export function useCancelBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<ApiBooking>(`/bookings/${id}/cancel`, { method: "POST" }),
    onSuccess: (b) => {
      qc.invalidateQueries({ queryKey: keys.booking(b.id) });
      qc.invalidateQueries({ queryKey: keys.orders });
    },
  });
}

// ---- Farmer ---------------------------------------------------------------

export function useFarmerSummary() {
  return useQuery({
    queryKey: keys.farmerSummary,
    queryFn: () => api<FarmerSummary>("/farmer/summary"),
    ...LIVE,
  });
}

export function useFarmerCrops() {
  return useQuery({
    queryKey: keys.farmerCrops,
    queryFn: async (): Promise<Crop[]> => {
      const rows = await api<ApiCrop[]>("/farmer/crops");
      return rows.map(toCrop);
    },
  });
}

export type CropInput = {
  title: string;
  headline?: string;
  category: string;
  grade: string;
  status: "upcoming" | "ready";
  statusLabel?: string;
  expectedKg: number;
  minOrderKg: number;
  pricePerKg: number;
  harvestDate: string;
  about: string;
  hasVideo: boolean;
  imageKey: string;
  galleryKeys: string[];
  listed: boolean;
};

function invalidateFarmer(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: keys.farmerCrops });
  qc.invalidateQueries({ queryKey: keys.farmerSummary });
  qc.invalidateQueries({ queryKey: ["crops"] });
}

export function useSaveCrop() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: CropInput }) =>
      api<ApiCrop>(id ? `/farmer/crops/${id}` : "/farmer/crops", {
        method: id ? "PATCH" : "POST",
        body: input,
      }),
    onSuccess: () => invalidateFarmer(qc),
  });
}

export function useDeleteCrop() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ deleted?: boolean; unlisted?: boolean }>(`/farmer/crops/${id}`, { method: "DELETE" }),
    onSuccess: () => invalidateFarmer(qc),
  });
}

export function useFarmerRequests() {
  return useQuery({
    queryKey: keys.farmerRequests,
    queryFn: () => api<ApiRequest[]>("/farmer/requests"),
    ...LIVE,
  });
}

export function useRespondToRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      action,
      finalPricePerKg,
      reason,
    }: {
      id: string;
      action: "accept" | "decline";
      finalPricePerKg?: number;
      reason?: string;
    }) =>
      api<ApiRequest>(`/farmer/requests/${id}/${action}`, {
        method: "POST",
        body: action === "accept" ? { finalPricePerKg } : { reason },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.farmerRequests });
      qc.invalidateQueries({ queryKey: keys.farmerSummary });
    },
  });
}

export function useFarmerOrders() {
  return useQuery({
    queryKey: keys.farmerOrders,
    queryFn: () => api<ApiOrder[]>("/farmer/orders"),
    ...LIVE,
  });
}

// ---- Driver ---------------------------------------------------------------

export function useDriverSummary() {
  return useQuery({
    queryKey: keys.driverSummary,
    queryFn: () => api<DriverSummary>("/driver/summary"),
    ...LIVE,
  });
}

export function useDriverJobs() {
  return useQuery({
    queryKey: keys.driverJobs,
    queryFn: () => api<ApiBooking[]>("/driver/jobs"),
    ...LIVE,
  });
}

export function useDriverTrips() {
  return useQuery({
    queryKey: keys.driverTrips,
    queryFn: () => api<ApiBooking[]>("/driver/trips"),
    ...LIVE,
  });
}

function invalidateDriver(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: keys.driverJobs });
  qc.invalidateQueries({ queryKey: keys.driverTrips });
  qc.invalidateQueries({ queryKey: keys.driverSummary });
}

export function useAdvanceTrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, receivedBy }: { id: string; receivedBy?: string }) =>
      api<ApiBooking>(`/driver/trips/${id}/advance`, { method: "POST", body: { receivedBy } }),
    onSuccess: () => invalidateDriver(qc),
  });
}

export function useCancelTrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api<ApiBooking>(`/driver/trips/${id}/cancel`, { method: "POST", body: { reason } }),
    onSuccess: () => invalidateDriver(qc),
  });
}

export function useSetAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (online: boolean) =>
      api("/driver/availability", { method: "PATCH", body: { online } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.driverSummary }),
  });
}

export function useUpdateTruck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, string | number>) =>
      api<ApiTruck>("/driver/truck", { method: "PATCH", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.driverSummary }),
  });
}

// ---- Verification (KYC) ----------------------------------------------------

export function useVerification() {
  return useQuery({
    queryKey: ["verification"],
    queryFn: () => api<VerificationState>("/verification"),
    // Poll while under review so approval shows up without a manual refresh.
    refetchInterval: (q) => (q.state.data?.status === "PENDING" ? 20_000 : false),
  });
}

export function useSubmitVerification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      gstin?: string;
      udyam?: string;
      pan?: string;
      farmerCard?: string;
      documents: UploadDoc[];
    }) => api<{ status: string }>("/verification", { method: "POST", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["verification"] });
      qc.invalidateQueries({ queryKey: keys.me });
    },
  });
}

// ---- Support tickets -------------------------------------------------------

export function useTickets() {
  return useQuery({
    queryKey: ["tickets"],
    queryFn: () => api<Ticket[]>("/tickets"),
    refetchInterval: 30_000,
  });
}

export function useTicket(code: string | undefined) {
  return useQuery({
    queryKey: ["ticket", code ?? "none"],
    enabled: !!code,
    queryFn: () => api<TicketThread>(`/tickets/${code}`),
    refetchInterval: 20_000,
  });
}

export function useRaiseTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      category: TicketCategory;
      subject: string;
      message: string;
      orderCode?: string;
    }) => api<Ticket>("/tickets", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tickets"] }),
  });
}

export function useReplyToTicket(code: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      api(`/tickets/${code}/reply`, { method: "POST", body: { body } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket", code] });
      qc.invalidateQueries({ queryKey: ["tickets"] });
    },
  });
}

// ---- App config (support details + version gate) --------------------------

export function useAppConfig(app: "BUYER" | "PARTNER", version: string) {
  return useQuery({
    queryKey: ["app-config", app, version],
    queryFn: () => {
      const platform = Platform.OS === "ios" ? "IOS" : "ANDROID";
      return api<AppConfig>(`/app/config?app=${app}&platform=${platform}&version=${version}`);
    },
    // Unauthenticated on purpose — a force-update screen and the support
    // number both have to work before anyone signs in.
    staleTime: 5 * 60_000,
    retry: 1,
  });
}
