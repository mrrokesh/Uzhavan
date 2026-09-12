import type { Role } from "../api/types";


/** Screens every role can reach from their profile tab or the bell. */
export type SharedScreens = {
  Verification: undefined;
  Help: undefined;
  MyTickets: undefined;
  NewTicket: undefined;
  TicketDetail: { code: string };
  Announcements: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  ChooseRole: undefined;
  CreateAccount: { role: Role };
};

// ---- Buyer -----------------------------------------------------------------

export type RootStackParamList = SharedScreens & {
  Tabs: undefined;
  CropDetail: { id: string };
  FarmerProfile: { farmId: string; cropId: string };
  SelectQuantity: { id: string };
  ReviewRequest: { id: string; quantityKg: number };
  RequestSent: { requestId: string };
  RequestDetails: { requestId: string };
  ConfirmPurchase: { requestId: string };
  QuantityConfirmed: { orderId: string };
  BookTruckOrder: { orderId: string };
  ChooseOrder: undefined;
  PickupDelivery: { orderId: string };
  NearbyTrucks: { orderId: string };
  TruckDetails: { orderId: string; truckId: string };
  ReviewBooking: { orderId: string; truckId: string };
  TrackTruck: { bookingId: string };
  DeliveryCompleted: { bookingId: string };
  Checkout: { orderId: string };
};

export type TabParamList = {
  Home: undefined;
  BookTrack: undefined;
  Orders: undefined;
  Profile: undefined;
};

// ---- Farmer ----------------------------------------------------------------

export type FarmerStackParamList = SharedScreens & {
  FarmerTabs: undefined;
  CropForm: { cropId?: string };
  FarmerRequestDetail: { requestId: string };
  Demand: undefined;
  FarmerPayouts: undefined;
};

export type FarmerTabParamList = {
  FarmerHome: undefined;
  Listings: undefined;
  Requests: undefined;
  FarmerAccount: undefined;
};

// ---- Driver ----------------------------------------------------------------

export type DriverStackParamList = SharedScreens & {
  DriverTabs: undefined;
  TripDetail: { bookingId: string };
};

export type DriverTabParamList = {
  Jobs: undefined;
  Trips: undefined;
  DriverAccount: undefined;
};
