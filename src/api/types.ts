import type { ImageSourcePropType } from "react-native";
import { imageFor, imagesFor } from "../lib/images";

export type Role = "BUYER" | "FARMER" | "DRIVER";

export type CropStatus = "upcoming" | "ready";

export type RequestStatus =
  | "PENDING"
  | "FARMER_ACCEPTED"
  | "FARMER_DECLINED"
  | "CONFIRMED"
  | "BUYER_DECLINED"
  | "CANCELLED";

export type OrderStatus = "RESERVED" | "AWAITING_TRUCK" | "IN_TRANSIT" | "DELIVERED";

export type BookingStatus =
  | "PENDING"
  | "PAID"
  | "ACCEPTED"
  | "ARRIVED_PICKUP"
  | "LOADED"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "CANCELLED";

// ---- Raw API payloads ------------------------------------------------------

export type ApiUser = {
  id: string;
  email: string;
  role: Role;
  name: string;
  phone: string;
  avatarKey: string;
  business: string | null;
  district: string | null;
  warehouse: string | null;
  warehouseAddress: string | null;
  market: string | null;
  createdAt: string;
};

export type Me = ApiUser & { following: string[]; saved: string[] };

export type AuthSession = { token: string; user: ApiUser };

export type ApiFarm = {
  id: string;
  ownerId: string;
  name: string;
  ownerName: string;
  district: string;
  location: string;
  rating: number;
  avatarKey: string;
};

export type ApiCrop = {
  id: string;
  farmId: string;
  farm: ApiFarm;
  headline: string;
  title: string;
  status: CropStatus;
  statusLabel: string;
  expectedKg: number;
  reservedKg: number;
  grade: string;
  pricePerKg: number;
  harvestDate: string;
  harvestDateShort: string;
  category: string;
  minOrderKg: number;
  about: string;
  hasVideo: boolean;
  imageKey: string;
  galleryKeys: string[];
  listed: boolean;
  _count?: { requests: number; orders: number };
};

export type ApiDriver = {
  id: string;
  userId: string;
  name: string;
  rating: number;
  trips: number;
  photoKey: string;
  verified: boolean;
  online: boolean;
  user?: { phone: string };
};

export type ApiTruck = {
  id: string;
  driverId: string;
  name: string;
  meta: string;
  capacityTons: number;
  capacityKg: number;
  etaMin: number;
  price: number;
  photoKey: string;
  recommended: boolean;
  body: string;
  plate: string;
  driver?: ApiDriver;
  tooSmall?: boolean;
  reason?: string | null;
};

export type BuyerBrief = {
  id: string;
  name: string;
  business: string | null;
  district: string | null;
  phone: string;
  avatarKey?: string;
};

export type ApiRequest = {
  id: string;
  code: string;
  cropId: string;
  buyerId: string;
  quantityKg: number;
  estimatedValue: number;
  finalPricePerKg: number | null;
  declineReason: string | null;
  status: RequestStatus;
  createdAt: string;
  respondedAt: string | null;
  confirmedAt: string | null;
  crop?: ApiCrop;
  buyer?: BuyerBrief;
  order?: ApiOrder | null;
};

export type ApiBookingEvent = {
  id: string;
  bookingId: string;
  status: BookingStatus;
  note: string | null;
  createdAt: string;
};

export type ApiBooking = {
  id: string;
  code: string;
  orderId: string;
  truckId: string;
  driverId: string;
  pickup: string;
  destination: string;
  distanceKm: number;
  baseFare: number;
  loadingFee: number;
  protectionFee: number;
  total: number;
  paymentMethod: string;
  status: BookingStatus;
  proofReceivedBy: string | null;
  cancelReason: string | null;
  createdAt: string;
  paidAt: string | null;
  acceptedAt: string | null;
  arrivedAt: string | null;
  loadedAt: string | null;
  inTransitAt: string | null;
  deliveredAt: string | null;
  truck?: ApiTruck;
  driver?: ApiDriver;
  order?: ApiOrder;
  events?: ApiBookingEvent[];
};

export type ApiOrder = {
  id: string;
  code: string;
  requestId: string | null;
  cropId: string;
  buyerId: string;
  product: string;
  quantityKg: number;
  pricePerKg: number;
  value: number;
  pickup: string;
  destination: string;
  harvestDate: string;
  transport: "BOOK" | "PRIVATE";
  status: OrderStatus;
  createdAt: string;
  crop?: ApiCrop;
  buyer?: BuyerBrief;
  booking?: ApiBooking | null;
};

export type Fare = {
  baseFare: number;
  loadingFee: number;
  protectionFee: number;
  total: number;
};

export type FarmerSummary = {
  farm: ApiFarm;
  listedCrops: number;
  pendingRequests: number;
  awaitingBuyer: number;
  orderCount: number;
  salesValue: number;
};

export type DriverSummary = {
  driver: ApiDriver;
  truck: ApiTruck | null;
  activeTrips: number;
  completedTrips: number;
  earnings: number;
};

// ---- View models (image keys resolved to bundled sources) ------------------

export type Crop = {
  id: string;
  farmId: string;
  farmName: string;
  ownerName: string;
  district: string;
  location: string;
  headline: string;
  title: string;
  status: CropStatus;
  statusLabel: string;
  expectedKg: number;
  reservedKg: number;
  availableKg: number;
  grade: string;
  pricePerKg: number;
  harvestDate: string;
  harvestDateShort: string;
  category: string;
  minOrderKg: number;
  rating: number;
  about: string;
  hasVideo: boolean;
  listed: boolean;
  imageKey: string;
  galleryKeys: string[];
  image: ImageSourcePropType;
  gallery: ImageSourcePropType[];
  avatar: ImageSourcePropType;
  requestCount: number;
  orderCount: number;
};

export type Driver = {
  id: string;
  name: string;
  rating: number;
  trips: number;
  verified: boolean;
  online: boolean;
  phone: string | null;
  photo: ImageSourcePropType;
};

export type Truck = {
  id: string;
  name: string;
  meta: string;
  capacityTons: number;
  capacityKg: number;
  etaMin: number;
  price: number;
  recommended: boolean;
  tooSmall: boolean;
  reason: string | null;
  body: string;
  plate: string;
  photo: ImageSourcePropType;
  driver: Driver | null;
};

export function toCrop(c: ApiCrop): Crop {
  return {
    id: c.id,
    farmId: c.farmId,
    farmName: c.farm.name,
    ownerName: c.farm.ownerName,
    district: c.farm.district,
    location: c.farm.location,
    headline: c.headline,
    title: c.title,
    status: c.status,
    statusLabel: c.statusLabel,
    expectedKg: c.expectedKg,
    reservedKg: c.reservedKg,
    availableKg: Math.max(0, c.expectedKg - c.reservedKg),
    grade: c.grade,
    pricePerKg: c.pricePerKg,
    harvestDate: c.harvestDate,
    harvestDateShort: c.harvestDateShort,
    category: c.category,
    minOrderKg: c.minOrderKg,
    rating: c.farm.rating,
    about: c.about,
    hasVideo: c.hasVideo,
    listed: c.listed,
    imageKey: c.imageKey,
    galleryKeys: c.galleryKeys,
    image: imageFor(c.imageKey),
    gallery: imagesFor(c.galleryKeys.length ? c.galleryKeys : [c.imageKey]),
    avatar: imageFor(c.farm.avatarKey),
    requestCount: c._count?.requests ?? 0,
    orderCount: c._count?.orders ?? 0,
  };
}

export function toDriver(d: ApiDriver): Driver {
  return {
    id: d.id,
    name: d.name,
    rating: d.rating,
    trips: d.trips,
    verified: d.verified,
    online: d.online,
    phone: d.user?.phone ?? null,
    photo: imageFor(d.photoKey),
  };
}

export function toTruck(t: ApiTruck): Truck {
  return {
    id: t.id,
    name: t.name,
    meta: t.meta,
    capacityTons: t.capacityTons,
    capacityKg: t.capacityKg,
    etaMin: t.etaMin,
    price: t.price,
    recommended: t.recommended,
    tooSmall: t.tooSmall ?? false,
    reason: t.reason ?? null,
    body: t.body,
    plate: t.plate,
    photo: imageFor(t.photoKey),
    driver: t.driver ? toDriver(t.driver) : null,
  };
}

// ---- Status presentation ---------------------------------------------------

export const REQUEST_LABEL: Record<RequestStatus, string> = {
  PENDING: "Awaiting farmer",
  FARMER_ACCEPTED: "Farmer accepted",
  FARMER_DECLINED: "Farmer declined",
  CONFIRMED: "Confirmed",
  BUYER_DECLINED: "You declined",
  CANCELLED: "Cancelled",
};

export const BOOKING_LABEL: Record<BookingStatus, string> = {
  PENDING: "Payment pending",
  PAID: "Finding a driver",
  ACCEPTED: "Driver assigned",
  ARRIVED_PICKUP: "Driver at the farm",
  LOADED: "Crop loaded",
  IN_TRANSIT: "On the way",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

/** Ordered trip steps used by both the buyer tracker and driver stepper. */
export const TRIP_STEPS: { status: BookingStatus; title: string; action: string }[] = [
  { status: "ACCEPTED", title: "Truck assigned", action: "Accept this trip" },
  { status: "ARRIVED_PICKUP", title: "Reached the farm", action: "I've reached the farm" },
  { status: "LOADED", title: "Crop loaded", action: "Crop is loaded" },
  { status: "IN_TRANSIT", title: "On the way", action: "Start the delivery" },
  { status: "DELIVERED", title: "Delivered", action: "Mark as delivered" },
];

export function tripStepIndex(status: BookingStatus): number {
  const i = TRIP_STEPS.findIndex((s) => s.status === status);
  return i; // -1 for PENDING / PAID / CANCELLED
}
