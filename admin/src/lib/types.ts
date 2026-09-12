export type Permission =
  | "USERS_VIEW"
  | "USERS_MODERATE"
  | "KYC_REVIEW"
  | "TICKETS_VIEW"
  | "TICKETS_RESPOND"
  | "TICKETS_ASSIGN"
  | "ORDERS_VIEW"
  | "CROPS_MODERATE"
  | "CONFIG_WRITE"
  | "ADMIN_STAFF_MANAGE"
  | "ADMIN_PERMISSIONS_GRANT"
  | "ADMIN_APP_RELEASE"
  | "ADMIN_AUDIT_VIEW";

export type Role = "BUYER" | "FARMER" | "DRIVER" | "STAFF" | "ADMIN";
export type AccountStatus = "ACTIVE" | "SUSPENDED" | "BLOCKED";
export type VerificationStatus = "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED";

export type Session = {
  id: string;
  name: string;
  email: string;
  role: Role;
  permissions: Permission[];
  isAdmin: boolean;
};

export type Overview = {
  users: Partial<Record<Role, number>>;
  pendingKyc: number;
  blocked: number;
  openTickets: number;
  unassignedTickets: number;
  orderCount: number;
  gmv: number;
};

export type AccountRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  status: AccountStatus;
  statusReason: string | null;
  verification: VerificationStatus;
  business: string | null;
  district: string | null;
  farmName: string | null;
  driver: { id: string; online: boolean; trips: number } | null;
  orderCount: number;
  requestCount: number;
  createdAt: string;
};

export type KycDoc = {
  id: string;
  type: string;
  filename: string;
  mimeType: string;
  sizeBytes?: number;
};

export type KycRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  business: string | null;
  district: string | null;
  farm: { name: string; district: string; location: string } | null;
  submittedAt: string | null;
  idLast4: string | null;
  gstin: string | null;
  udyam: string | null;
  pan: string | null;
  farmerCard: string | null;
  documents: KycDoc[];
};

export type TicketStatus =
  | "OPEN"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "WAITING_ON_USER"
  | "RESOLVED"
  | "CLOSED";

export type TicketRow = {
  id: string;
  code: string;
  category: string;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  status: TicketStatus;
  subject: string;
  orderCode: string | null;
  createdAt: string;
  updatedAt: string;
  escalatedAt: string | null;
  raisedBy: { id: string; name: string; role: Role; business: string | null; phone: string };
  assignedTo: { id: string; name: string } | null;
  _count?: { messages: number };
};

export type TicketDetail = TicketRow & {
  raisedBy: TicketRow["raisedBy"] & { email: string };
  messages: {
    id: string;
    body: string;
    internal: boolean;
    createdAt: string;
    author: { id: string; name: string; role: Role };
  }[];
};

export type StaffRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  status: AccountStatus;
  permissions: Permission[];
  openTickets: number;
  createdAt: string;
};

export type Setting = {
  key: string;
  value: string;
  label: string;
  description: string | null;
  isPublic: boolean;
  updatedAt: string;
};

export type Release = {
  id: string;
  app: "BUYER" | "PARTNER";
  platform: "ANDROID" | "IOS";
  latestVersion: string;
  minSupportedVersion: string;
  releaseNotes: string | null;
  storeUrl: string | null;
  mandatory: boolean;
  updatedAt: string;
};

export type AuditEntry = {
  id: string;
  action: string;
  targetType: string;
  targetId: string | null;
  summary: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actor: { id: string; name: string; role: Role } | null;
};

export type Audience = "ALL" | "FARMERS" | "BUYERS" | "DRIVERS";

export type AdminAnnouncement = {
  id: string;
  title: string;
  body: string;
  audience: Audience;
  pinned: boolean;
  publishedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  reads: number;
  audienceSize: number;
  author: { id: string; name: string } | null;
};

export type Gateway = {
  id: string;
  label: string;
  mode: "TEST" | "LIVE";
  keyId: string;
  /** Without one, Razorpay's callbacks can't be verified. */
  hasWebhookSecret: boolean;
  active: boolean;
  createdAt: string;
};

export type TrackedVehicle = {
  truck: {
    id: string;
    name: string;
    plate: string;
    body: string;
    capacityKg: number;
    rcNumber: string | null;
    insuranceExpiry: string | null;
    permitExpiry: string | null;
    insuranceExpired: boolean;
    permitExpired: boolean;
  };
  driver: {
    id: string;
    name: string;
    phone: string | null;
    rating: number;
    trips: number;
    online: boolean;
    accountStatus: string;
    verification: string;
  };
  currentTrip: {
    code: string;
    status: string;
    pickup: string;
    destination: string;
    product: string;
    quantityKg: number;
    orderCode: string;
    farm: string | null;
    buyer: string;
    buyerPhone: string | null;
  } | null;
};

export type PayoutPolicy = "SPLIT_ON_LOAD" | "AFTER_DELIVERY";
export type PayoutState = "HELD" | "RELEASED" | "PAID" | "FAILED" | "CANCELLED";

export type AdminPayout = {
  id: string;
  stage: "ADVANCE" | "BALANCE";
  stageLabel: string;
  state: PayoutState;
  amount: number;
  policy: PayoutPolicy;
  releaseAfter: string | null;
  releasedAt: string | null;
  paidAt: string | null;
  note: string | null;
  failureReason: string | null;
  farmer: { id: string; name: string; verified: boolean; hasAccount: boolean };
  order: { id: string; code: string; product: string; status: string; paidAt: string | null } | null;
};

export type PayoutList = {
  policy: PayoutPolicy;
  advancePercent: number;
  holdHours: number;
  payouts: AdminPayout[];
};
