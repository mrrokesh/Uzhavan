import type { Role } from "../api/types";

export type AuthStackParamList = {
  Login: undefined;
  ChooseRole: undefined;
  CreateAccount: { role: Role };
};

// ---- Buyer -----------------------------------------------------------------

export type RootStackParamList = {
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
};

export type TabParamList = {
  Home: undefined;
  BookTrack: undefined;
  Orders: undefined;
  Profile: undefined;
};

// ---- Farmer ----------------------------------------------------------------

export type FarmerStackParamList = {
  FarmerTabs: undefined;
  CropForm: { cropId?: string };
  FarmerRequestDetail: { requestId: string };
};

export type FarmerTabParamList = {
  FarmerHome: undefined;
  Listings: undefined;
  Requests: undefined;
  FarmerAccount: undefined;
};

// ---- Driver ----------------------------------------------------------------

export type DriverStackParamList = {
  DriverTabs: undefined;
  TripDetail: { bookingId: string };
};

export type DriverTabParamList = {
  Jobs: undefined;
  Trips: undefined;
  DriverAccount: undefined;
};
