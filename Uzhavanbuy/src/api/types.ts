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
  sellerVerified?: boolean;
  distanceKm?: number | null;
  _count?: { requests: number; orders: number };
};

/** `/crops` returns the result set plus where it searched from. */
export type CropSearch = {
  origin: string | null;
  radiusKm: number | null;
  count: number;
  crops: ApiCrop[];
};

export type CropFilters = {
  district?: string;
  radiusKm?: number;
  verifiedOnly?: boolean;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: "newest" | "distance" | "priceLow" | "priceHigh";
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
  /**
   * What the buyer will pay if they confirm. Computed live, because the rate is
   * only fixed onto the order once it exists. Farmers and drivers pay no fee —
   * `goodsValue` is the farmer's money and it is never reduced by `platformFee`.
   */
  goodsValue?: number;
  feeBps?: number;
  platformFee?: number;
  totalPayable?: number;
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
  /** The farmer's money — quantity x agreed price, never reduced by the fee. */
  value: number;
  /** The rate that applied when this order was placed, in basis points. */
  feeBps: number;
  platformFee: number;
  /** value + platformFee. What the buyer paid. */
  totalPayable: number;
  pickup: string;
  destination: string;
  harvestDate: string;
  transport: "BOOK" | "PRIVATE";
  status: OrderStatus;
  /** Null until the buyer has paid. Nothing is owed to the farmer before this. */
  paidAt: string | null;
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
  sellerVerified: boolean;
  distanceKm: number | null;
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
    sellerVerified: c.sellerVerified ?? false,
    distanceKm: c.distanceKm ?? null,
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

// ---- Verification (KYC) ----------------------------------------------------

export type VerificationStatus = "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED";

export type DocumentType =
  | "FARMER_CARD"
  | "LAND_RECORD"
  | "GST_CERTIFICATE"
  | "MSME_CERTIFICATE"
  | "PAN_CARD"
  // Driver / vehicle
  | "DRIVING_LICENCE"
  | "VEHICLE_RC"
  | "VEHICLE_INSURANCE"
  | "VEHICLE_PERMIT"
  | "OTHER";

export type VerificationState = {
  status: VerificationStatus;
  submittedAt: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  idLast4: string | null;
  hasGstin: boolean;
  hasUdyam: boolean;
  hasFarmerCard: boolean;
  documents: {
    id: string;
    type: DocumentType;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    uploadedAt: string;
  }[];
  required: { identifier: "farmerCard" | "gstinOrUdyam" | "licence"; documents: DocumentType[] };
};

export type UploadDoc = {
  type: DocumentType;
  filename: string;
  mimeType: string;
  data: string;
};

/** Everything /verification accepts. Which fields are required depends on role. */
export type VerificationSubmission = {
  gstin?: string;
  udyam?: string;
  pan?: string;
  farmerCard?: string;
  licence?: string;
  rcNumber?: string;
  /** ISO date, yyyy-mm-dd. Cover and permit lapse; staff need the dates. */
  insuranceExpiry?: string;
  permitExpiry?: string;
  documents: UploadDoc[];
};

// ---- Announcements ---------------------------------------------------------

export type Audience = "ALL" | "FARMERS" | "BUYERS" | "DRIVERS";

export type Announcement = {
  id: string;
  title: string;
  body: string;
  audience: Audience;
  pinned: boolean;
  publishedAt: string | null;
  expiresAt: string | null;
  read: boolean;
};

// ---- Support tickets -------------------------------------------------------

export type TicketStatus =
  | "OPEN"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "WAITING_ON_USER"
  | "RESOLVED"
  | "CLOSED";

export type TicketCategory =
  | "ORDER"
  | "PAYMENT"
  | "DELIVERY"
  | "ACCOUNT"
  | "VERIFICATION"
  | "APP_ISSUE"
  | "OTHER";

export type Ticket = {
  id: string;
  code: string;
  category: TicketCategory;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  status: TicketStatus;
  subject: string;
  orderCode: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  assignedTo: { id: string; name: string } | null;
  _count?: { messages: number };
};

export type TicketThread = Ticket & {
  raisedBy: { id: string; name: string };
  messages: {
    id: string;
    body: string;
    internal: boolean;
    createdAt: string;
    author: { id: string; name: string; role: Role };
  }[];
};

export const TICKET_LABEL: Record<TicketStatus, string> = {
  OPEN: "Waiting for support",
  ASSIGNED: "With our team",
  IN_PROGRESS: "Being looked at",
  WAITING_ON_USER: "Awaiting your reply",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

// ---- App config ------------------------------------------------------------

export type AppConfig = {
  support: { email: string; phone: string; whatsapp: string | null; hours: string | null };
  update: {
    action: "ok" | "soft" | "force";
    latestVersion: string | null;
    minSupportedVersion: string | null;
    releaseNotes: string | null;
    storeUrl: string | null;
  };
};

// ---- Farmer demand board ---------------------------------------------------

export type DemandBoard = {
  origin: string | null;
  radiusKm: number;
  districtsInRange: number;
  trends: {
    category: string;
    requests: number;
    totalKg: number;
    avgPricePerKg: number | null;
    acceptRate: number;
    /** True when this farm lists nothing in a category buyers are asking for. */
    gap: boolean;
  }[];
  buyers: {
    id: string;
    name: string;
    business: string | null;
    district: string | null;
    market: string | null;
    verified: boolean;
    orders: number;
    distanceKm: number | null;
  }[];
};

// ---- Payments and payouts --------------------------------------------------

export type PaymentConfig = {
  enabled: boolean;
  keyId: string | null;
  mode: "TEST" | "LIVE" | null;
  plus: { amountPaise: number; months: number };
};

export type PaymentStart = {
  paymentId: string;
  orderId: string;
  amountPaise: number;
  currency: string;
  keyId: string;
  mode: "TEST" | "LIVE";
};

export type PayoutPolicy = "SPLIT_ON_LOAD" | "AFTER_DELIVERY";
export type PayoutState = "HELD" | "RELEASED" | "PAID" | "FAILED" | "CANCELLED";

export type Payout = {
  id: string;
  stage: "ADVANCE" | "BALANCE";
  stageLabel: string;
  state: PayoutState;
  amount: number;
  releaseAfter: string | null;
  releasedAt: string | null;
  paidAt: string | null;
  note: string | null;
  failureReason: string | null;
  order: { code: string; product: string; quantityKg: number } | null;
};

export type PayoutLedger = {
  account: { ready: boolean; addedAt: string } | null;
  policy: PayoutPolicy;
  advancePercent: number;
  holdHours: number;
  owed: number;
  received: number;
  payouts: Payout[];
};

// ---- Suggestions -----------------------------------------------------------

/** A crop the server picked for this buyer, with why it did. */
export type SuggestedCrop = ApiCrop & { reason: string };

export type Suggestions = {
  /** False when there's no history yet and it's going on location alone. */
  personalised: boolean;
  count: number;
  crops: SuggestedCrop[];
};

// ---- Reviews ---------------------------------------------------------------

export type ReviewSubject = "FARM" | "DRIVER" | "BUYER";

export type ReviewableSubject = {
  subject: ReviewSubject;
  id: string;
  name: string;
  existing: { stars: number; comment: string | null } | null;
};

export type Reviewable = {
  orderCode: string;
  delivered: boolean;
  canReview: boolean;
  subjects: ReviewableSubject[];
};

export type Review = {
  id: string;
  stars: number;
  comment: string | null;
  createdAt: string;
  product: string;
  /** First name only — a full business name beside one star is a grudge. */
  author: string;
  district: string | null;
};

export type Reputation = {
  /** Null when nobody has reviewed yet. Not the same as zero. */
  rating: number | null;
  count: number;
  /** False until there are enough reviews for the average to mean anything. */
  established: boolean;
  reviews: Review[];
};

// ---- Chat -------------------------------------------------------------------

export type ConversationParty =
  | { kind: "farm"; id: string; name: string; avatarKey: string }
  | { kind: "buyer"; id: string; name: string; avatarKey: string };

export type Conversation = {
  id: string;
  with: ConversationParty;
  crop: { id: string; title: string; imageKey: string } | null;
  lastMessageAt: string;
  lastMessageBody: string | null;
  unread: boolean;
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  kind: "TEXT" | "VOICE";
  body: string | null;
  audioUrl: string | null;
  durationSec: number | null;
  createdAt: string;
  sender: { id: string; name: string };
};

// ---- Assistant ---------------------------------------------------------------

export type AssistantAnswer = {
  intent: string;
  text: string;
  data?: unknown;
};
