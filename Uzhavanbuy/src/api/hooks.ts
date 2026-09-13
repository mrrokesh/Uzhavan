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
  type VerificationSubmission,
  type Announcement,
  type PaymentConfig,
  type PaymentStart,
  type PayoutLedger,
  type Suggestions,
  type Reviewable,
  type Reputation,
  type ReviewSubject,
  type Conversation,
  type ChatMessage,
  type AssistantAnswer,
  type AppNotification,
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

/** Change the quantity on a request still waiting on the farmer. */
export function useUpdateRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, quantityKg }: { id: string; quantityKg: number }) =>
      api<ApiRequest>(`/requests/${id}`, { method: "PATCH", body: { quantityKg } }),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: keys.requests });
      qc.invalidateQueries({ queryKey: keys.request(id) });
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
    mutationFn: (body: VerificationSubmission) =>
      api<{ status: string }>("/verification", { method: "POST", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["verification"] });
      qc.invalidateQueries({ queryKey: keys.me });
    },
  });
}

/**
 * Crops picked for this buyer, each with the reason it was picked. Kept a touch
 * stale on purpose — the ranking barely moves minute to minute, and a home
 * screen that reshuffles while you're reading it is worse than a slightly old one.
 */
export function useSuggestions(limit = 8) {
  return useQuery({
    queryKey: ["suggestions", limit],
    queryFn: () => api<Suggestions>(`/crops/suggested?limit=${limit}`),
    staleTime: 5 * 60 * 1000,
  });
}

// ---- Reviews ---------------------------------------------------------------

/** What this person may rate on this order, and what they already said. */
export function useReviewable(orderId: string | undefined) {
  return useQuery({
    queryKey: ["reviewable", orderId ?? "none"],
    enabled: !!orderId,
    queryFn: () => api<Reviewable>(`/orders/${orderId}/reviews`),
  });
}

export function useLeaveReview(orderId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { subject: ReviewSubject; stars: number; comment?: string }) =>
      api(`/orders/${orderId}/reviews`, { method: "POST", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reviewable", orderId ?? "none"] });
      qc.invalidateQueries({ queryKey: ["reputation"] });
      qc.invalidateQueries({ queryKey: ["crops"] });
    },
  });
}

/** Public reputation for a farm, driver or buyer. */
export function useReputation(subject: ReviewSubject, subjectId: string | undefined) {
  return useQuery({
    queryKey: ["reputation", subject, subjectId ?? "none"],
    enabled: !!subjectId,
    queryFn: () => api<Reputation>(`/reviews/${subject}/${subjectId}`),
  });
}

// ---- Password reset --------------------------------------------------------

/** Always resolves the same way, whether or not the account exists. */
export function useForgotPassword() {
  return useMutation({
    mutationFn: (email: string) =>
      api<{ sent: boolean; message: string }>("/auth/password/forgot", {
        method: "POST",
        body: { email },
      }),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (body: { email: string; code: string; password: string }) =>
      api<{ reset: boolean }>("/auth/password/reset", { method: "POST", body }),
  });
}

// ---- Payments and payouts --------------------------------------------------

export function usePaymentConfig() {
  return useQuery({
    queryKey: ["payments", "config"],
    queryFn: () => api<PaymentConfig>("/payments/config"),
  });
}

/** Opens a Razorpay order server-side. The amount is never sent by the client. */
export function useStartPayment() {
  return useMutation({
    mutationFn: (body: {
      purpose: "CROP_ORDER" | "TRUCK_BOOKING" | "PLUS_SUBSCRIPTION";
      referenceId?: string;
    }) => api<PaymentStart>("/payments/start", { method: "POST", body }),
  });
}

export function useConfirmPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      razorpayOrderId: string;
      razorpayPaymentId: string;
      signature: string;
    }) => api<{ status: string }>("/payments/confirm", { method: "POST", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.orders });
      qc.invalidateQueries({ queryKey: keys.me });
    },
  });
}

/** The farmer's own ledger: what's owed, what's landed, and when. */
export function usePayouts() {
  return useQuery({
    queryKey: ["payouts"],
    queryFn: () => api<PayoutLedger>("/payouts"),
  });
}

export function useAddPayoutAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { accountNumber: string; ifsc: string; beneficiaryName: string }) =>
      api<{ ready: boolean; addedAt: string }>("/payouts/account", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payouts"] }),
  });
}

// ---- Announcements ---------------------------------------------------------

export function useAnnouncements() {
  return useQuery({
    queryKey: ["announcements"],
    queryFn: () => api<Announcement[]>("/announcements"),
  });
}

/** Drives the bell badge. Cheap enough to poll; it's a single count query. */
export function useUnreadAnnouncements() {
  return useQuery({
    queryKey: ["announcements", "unread"],
    queryFn: () => api<{ count: number }>("/announcements/unread-count"),
    refetchInterval: 120_000,
  });
}

export function useMarkAnnouncementRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ read: boolean }>(`/announcements/${id}/read`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["announcements"] }),
  });
}

export function useMarkAllAnnouncementsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<{ marked: number }>("/announcements/read-all", { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["announcements"] }),
  });
}

// ---- Notifications ----------------------------------------------------------

/** My own activity - a request accepted, an order confirmed, a delivery. */
export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: () => api<AppNotification[]>("/notifications"),
  });
}

/** Drives the bell badge alongside unread announcements. */
export function useUnreadNotifications() {
  return useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: () => api<{ count: number }>("/notifications/unread-count"),
    refetchInterval: 120_000,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<{ read: boolean }>(`/notifications/${id}/read`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<{ marked: number }>("/notifications/read-all", { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
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

// ---- Chat -------------------------------------------------------------------

/** Every conversation I'm in, either side. Polls, so a reply shows up unread. */
export function useConversations() {
  return useQuery({
    queryKey: ["conversations"],
    queryFn: () => api<Conversation[]>("/conversations"),
    ...LIVE,
  });
}

/** Starts one if it doesn't exist, or hands back the existing thread. */
export function useStartConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { farmId: string; cropId?: string }) =>
      api<Conversation>("/conversations", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["conversations"] }),
  });
}

/** "Message the farmer" from a crop, without the caller knowing a farmId. */
export function useConversationByCrop(cropId: string | undefined) {
  return useQuery({
    queryKey: ["conversation-by-crop", cropId ?? "none"],
    enabled: !!cropId,
    queryFn: () => api<Conversation | null>(`/conversations/by-crop/${cropId}`),
  });
}

export function useMessages(conversationId: string | undefined) {
  return useQuery({
    queryKey: ["messages", conversationId ?? "none"],
    enabled: !!conversationId,
    queryFn: () => api<ChatMessage[]>(`/conversations/${conversationId}/messages`),
    ...LIVE,
  });
}

export function useSendMessage(conversationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      api<ChatMessage>(`/conversations/${conversationId}/messages`, {
        method: "POST",
        body: { body },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messages", conversationId] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

export function useMarkConversationRead(conversationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api(`/conversations/${conversationId}/read`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["conversations"] }),
  });
}

// ---- Assistant ----------------------------------------------------------------

/**
 * Rule-based, not conversational — one question, one answer, from live data.
 * Nothing is kept server-side between calls, so the exchange history on
 * screen is local-only; refreshing the app starts a clean slate.
 */
export function useAskAssistant() {
  return useMutation({
    mutationFn: (question: string) =>
      api<AssistantAnswer>("/assistant/ask", { method: "POST", body: { question } }),
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
