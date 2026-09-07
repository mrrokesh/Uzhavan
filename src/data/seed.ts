export type CropStatus = "upcoming" | "ready";

export type Crop = {
  id: string;
  farmName: string;
  ownerName: string;
  district: string;
  location: string;
  headline: string;
  title: string;
  status: CropStatus;
  statusLabel: string;
  expectedKg: number;
  grade: string;
  pricePerKg: number;
  harvestDate: string;
  harvestDateShort: string;
  category: string;
  minOrderKg: number;
  rating: number;
  about: string;
  hasVideo: true | false;
  image: string;
  gallery: string[];
  avatar: string;
};

export type Truck = {
  id: string;
  name: string;
  meta: string;
  capacityTons: number;
  capacityKg: number;
  etaMin: number;
  price: number;
  photo: string;
  recommended?: boolean;
  tooSmall?: boolean;
  reason?: string;
  body: string;
  plate: string;
};

export type Driver = {
  name: string;
  rating: number;
  trips: number;
  photo: string;
  verified: boolean;
};

export const IMAGES = {
  pomegranate: "/images/pomegranate.jpg",
  pomegranateTree: "/images/orchard.jpg",
  pomegranateCut: "/images/pomegranate.jpg",
  orchard: "/images/farm.jpg",
  farmerField: "/images/orchard.jpg",
  turmeric: "/images/turmeric.jpg",
  turmericHeap: "/images/turmeric.jpg",
  orange: "/images/orange.jpg",
  orangeGrove: "/images/grove.jpg",
  truck: "/images/truck.jpg",
  miniTruck: "/images/minitruck.jpg",
  lcv: "/images/lcv.jpg",
  warehouse: "/images/warehouse.jpg",
  unloading: "/images/warehouse.jpg",
  arul: "/images/arul.jpg",
  muthu: "/images/muthu.jpg",
  kannan: "/images/kannan.jpg",
  selvam: "/images/selvam.jpg",
  ramesh: "/images/ramesh.jpg",
  buyer: "/images/buyer.jpg",
};

export const crops: Crop[] = [
  {
    id: "bhagwa",
    farmName: "Arul Farms",
    ownerName: "Arul Kumar",
    district: "Dindigul",
    location: "Natham, Dindigul",
    headline: "Bhagwa pomegranates nearing harvest",
    title: "Bhagwa Pomegranates",
    status: "upcoming",
    statusLabel: "Harvest in 2 weeks",
    expectedKg: 8500,
    grade: "Grade A",
    pricePerKg: 95,
    harvestDate: "18 Sep 2026",
    harvestDateShort: "18 Sep",
    category: "Fruits · Pomegranate",
    minOrderKg: 500,
    rating: 4.8,
    about:
      "Deep-red Bhagwa pomegranates grown on 12 acres in Natham. Fruit is sizing well after a dry spell and a late monsoon shower. Arils are sweet with a bright ruby colour — suited for wholesale, juice, and export packing.",
    hasVideo: true,
    image: IMAGES.pomegranate,
    gallery: [IMAGES.farmerField, IMAGES.pomegranate, IMAGES.orchard, IMAGES.pomegranateTree],
    avatar: IMAGES.arul,
  },
  {
    id: "turmeric",
    farmName: "Muthu Farms",
    ownerName: "Muthu Vel",
    district: "Attur, Salem",
    location: "Attur, Salem",
    headline: "Salem turmeric cured and ready now",
    title: "Salem Turmeric",
    status: "ready",
    statusLabel: "Ready now",
    expectedKg: 12000,
    grade: "Grade A",
    pricePerKg: 180,
    harvestDate: "02 Sep 2026",
    harvestDateShort: "02 Sep",
    category: "Spices · Turmeric",
    minOrderKg: 500,
    rating: 4.9,
    about:
      "Finger turmeric from Attur, boiled and sun-cured on-farm. High curcumin colour, clean fingers, and uniform size. Ideal for mills, exporters, and warehouse stocking.",
    hasVideo: false,
    image: IMAGES.turmericHeap,
    gallery: [IMAGES.turmericHeap, IMAGES.turmeric, IMAGES.farmerField],
    avatar: IMAGES.muthu,
  },
  {
    id: "oranges",
    farmName: "Kannan Orchard",
    ownerName: "Kannan",
    district: "Ooty",
    location: "Ooty, Nilgiris",
    headline: "Nilgiri oranges colouring on the tree",
    title: "Nilgiri Oranges",
    status: "upcoming",
    statusLabel: "Harvest in 3 weeks",
    expectedKg: 6400,
    grade: "Grade A",
    pricePerKg: 45,
    harvestDate: "28 Sep 2026",
    harvestDateShort: "28 Sep",
    category: "Fruits · Orange",
    minOrderKg: 400,
    rating: 4.7,
    about:
      "Hill oranges from a family orchard above Ooty. Tight skin, good juice, and a sharp-sweet balance that Chennai and Coimbatore markets ask for every season.",
    hasVideo: true,
    image: IMAGES.orange,
    gallery: [IMAGES.orangeGrove, IMAGES.orange, IMAGES.orchard],
    avatar: IMAGES.kannan,
  },
];

export const driver: Driver = {
  name: "Selvam",
  rating: 4.8,
  trips: 212,
  photo: IMAGES.selvam,
  verified: true,
};

export const trucks: Truck[] = [
  {
    id: "ace",
    name: "Tata Ace 1.5T",
    meta: "2-seater · Single axle",
    capacityTons: 1.5,
    capacityKg: 1500,
    etaMin: 8,
    price: 2100,
    photo: IMAGES.miniTruck,
    tooSmall: true,
    reason: "Not enough for 3,200 kg",
    body: "Closed body",
    plate: "TN 27 AC 1104",
  },
  {
    id: "mini",
    name: "Mini Truck 3.5T",
    meta: "2-seater · Dual axle",
    capacityTons: 3.5,
    capacityKg: 3500,
    etaMin: 12,
    price: 3450,
    photo: IMAGES.truck,
    recommended: true,
    body: "Open body",
    plate: "TN 30 AB 4821",
  },
  {
    id: "lcv",
    name: "LCV 5T",
    meta: "3-seater · Dual axle",
    capacityTons: 5,
    capacityKg: 5000,
    etaMin: 18,
    price: 4250,
    photo: IMAGES.lcv,
    body: "Open body",
    plate: "TN 54 CD 9022",
  },
];

export const fare = {
  base: 2900,
  loading: 350,
  protection: 200,
  total: 3450,
};

export const buyer = {
  name: "Karthik Rajan",
  business: "Karthik Traders",
  role: "Wholesale buyer",
  district: "Salem",
  warehouse: "Salem Agro Warehouse",
  warehouseAddress: "Salem, Tamil Nadu",
  market: "Koyambedu Market, Chennai",
  phone: "+91 98430 11220",
  avatar: IMAGES.buyer,
};

export const turmericOrder = {
  id: "UZH-ORD-2408",
  cropId: "turmeric",
  product: "Turmeric",
  qtyKg: 3200,
  farmName: "Muthu Farms",
  farmer: "Muthu",
  pickup: "Muthu Farms, Attur, Salem",
  destination: "Salem Agro Warehouse",
  destinationFull: "Salem Agro Warehouse, Salem, Tamil Nadu",
  harvestDate: "02 Sep 2026",
  value: 576000,
};

export const pomegranateOrder = {
  id: "UZH-ORD-1809",
  requestId: "UZH-REQ-1809",
  cropId: "bhagwa",
  product: "Bhagwa Pomegranates",
  qtyKg: 2000,
  pricePerKg: 95,
  value: 190000,
  farmName: "Arul Farms",
  pickup: "Arul Farms, Natham, Dindigul",
  destination: "Koyambedu Market, Chennai",
  harvestDate: "18 Sep 2026",
  sentAt: "10:42 AM",
  acceptedAt: "02:18 PM",
};

export function getCrop(id: string) {
  return crops.find((c) => c.id === id) ?? crops[0];
}

export function getTruck(id: string) {
  return trucks.find((t) => t.id === id) ?? trucks[1];
}

export type BookingCargo = {
  product: string;
  qtyKg: number;
  pickup: string;
  pickupShort: string;
  destination: string;
  destinationFull: string;
  image: string;
  farmName: string;
  farmer: string;
  harvestDate: string;
  orderId: string;
  bookingId: string;
};

export function cargoFor(
  source: "pomegranate" | "turmeric",
  quantity: number,
): BookingCargo {
  if (source === "pomegranate") {
    return {
      product: "Bhagwa Pomegranates",
      qtyKg: quantity,
      pickup: pomegranateOrder.pickup,
      pickupShort: "Arul Farms, Natham",
      destination: pomegranateOrder.destination,
      destinationFull: pomegranateOrder.destination,
      image: IMAGES.pomegranate,
      farmName: pomegranateOrder.farmName,
      farmer: "Arul Kumar",
      harvestDate: pomegranateOrder.harvestDate,
      orderId: pomegranateOrder.id,
      bookingId: "UZH-240918",
    };
  }
  return {
    product: "Turmeric",
    qtyKg: turmericOrder.qtyKg,
    pickup: turmericOrder.pickup,
    pickupShort: "Muthu Farms, Attur",
    destination: turmericOrder.destination,
    destinationFull: turmericOrder.destinationFull,
    image: IMAGES.turmericHeap,
    farmName: turmericOrder.farmName,
    farmer: turmericOrder.farmer,
    harvestDate: turmericOrder.harvestDate,
    orderId: turmericOrder.id,
    bookingId: "UZH-240902",
  };
}
