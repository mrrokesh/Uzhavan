import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { pomegranateOrder, turmericOrder } from "../data/seed";

export type TransportChoice = "book" | "private";
export type FilterChip = "for-you" | "ready" | "upcoming" | "following";
export type BookingSource = "pomegranate" | "turmeric";

type AppState = {
  quantity: number;
  setQuantity: (n: number) => void;
  cropId: string;
  setCropId: (id: string) => void;
  requestSent: boolean;
  setRequestSent: (v: boolean) => void;
  farmerAccepted: boolean;
  setFarmerAccepted: (v: boolean) => void;
  quantityConfirmed: boolean;
  setQuantityConfirmed: (v: boolean) => void;
  transport: TransportChoice;
  setTransport: (v: TransportChoice) => void;
  selectedTruckId: string;
  setSelectedTruckId: (id: string) => void;
  bookingPaid: boolean;
  setBookingPaid: (v: boolean) => void;
  truckAssigned: boolean;
  setTruckAssigned: (v: boolean) => void;
  delivered: boolean;
  setDelivered: (v: boolean) => void;
  following: string[];
  toggleFollow: (id: string) => void;
  saved: string[];
  toggleSaved: (id: string) => void;
  filter: FilterChip;
  setFilter: (f: FilterChip) => void;
  destination: string;
  setDestination: (v: string) => void;
  bookingSource: BookingSource;
  setBookingSource: (v: BookingSource) => void;
  requestId: string;
  orderId: string;
  turmericReady: typeof turmericOrder;
};

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [quantity, setQuantity] = useState(pomegranateOrder.qtyKg);
  const [cropId, setCropId] = useState("bhagwa");
  const [requestSent, setRequestSent] = useState(false);
  const [farmerAccepted, setFarmerAccepted] = useState(false);
  const [quantityConfirmed, setQuantityConfirmed] = useState(false);
  const [transport, setTransport] = useState<TransportChoice>("book");
  const [selectedTruckId, setSelectedTruckId] = useState("mini");
  const [bookingPaid, setBookingPaid] = useState(false);
  const [truckAssigned, setTruckAssigned] = useState(false);
  const [delivered, setDelivered] = useState(false);
  const [following, setFollowing] = useState<string[]>(["turmeric"]);
  const [saved, setSaved] = useState<string[]>([]);
  const [filter, setFilter] = useState<FilterChip>("for-you");
  const [destination, setDestination] = useState(turmericOrder.destination);
  const [bookingSource, setBookingSource] = useState<BookingSource>("turmeric");

  const value = useMemo<AppState>(
    () => ({
      quantity,
      setQuantity,
      cropId,
      setCropId,
      requestSent,
      setRequestSent,
      farmerAccepted,
      setFarmerAccepted,
      quantityConfirmed,
      setQuantityConfirmed,
      transport,
      setTransport,
      selectedTruckId,
      setSelectedTruckId,
      bookingPaid,
      setBookingPaid,
      truckAssigned,
      setTruckAssigned,
      delivered,
      setDelivered,
      following,
      toggleFollow: (id) =>
        setFollowing((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])),
      saved,
      toggleSaved: (id) =>
        setSaved((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])),
      filter,
      setFilter,
      destination,
      setDestination,
      bookingSource,
      setBookingSource,
      requestId: pomegranateOrder.requestId,
      orderId: pomegranateOrder.id,
      turmericReady: turmericOrder,
    }),
    [
      quantity,
      cropId,
      requestSent,
      farmerAccepted,
      quantityConfirmed,
      transport,
      selectedTruckId,
      bookingPaid,
      truckAssigned,
      delivered,
      following,
      saved,
      filter,
      destination,
      bookingSource,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
