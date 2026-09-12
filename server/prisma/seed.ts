import { PrismaClient, type Permission } from "@prisma/client";
import { hashPassword } from "../src/auth.js";
import { resolveDistrict } from "../src/data/districts.js";
import { normalisePlate } from "../src/lib/plate.js";

const prisma = new PrismaClient();

/** Everything a support agent needs day to day — no admin-only rights. */
const STAFF_PERMISSIONS: Permission[] = [
  "USERS_VIEW",
  "USERS_MODERATE",
  "KYC_REVIEW",
  "TICKETS_VIEW",
  "TICKETS_RESPOND",
  "TICKETS_ASSIGN",
  "ORDERS_VIEW",
];

/**
 * Seeds a working marketplace: three farmers with listings, three drivers with
 * trucks, and one buyer. Every account is a real login — image keys map to the
 * app's bundled assets (src/lib/images.ts).
 */

const farmers = [
  {
    email: "arul@uzhavan.app",
    name: "Arul Kumar",
    phone: "+91 98651 40012",
    farm: {
      name: "Arul Farms",
      district: "Dindigul",
      location: "Natham, Dindigul",
      rating: 4.8,
      avatarKey: "arul",
    },
    crops: [
      {
        headline: "Bhagwa pomegranates nearing harvest",
        title: "Bhagwa Pomegranates",
        status: "upcoming" as const,
        statusLabel: "Harvest in 2 weeks",
        expectedKg: 8500,
        grade: "Grade A",
        pricePerKg: 95,
        harvestDate: "18 Sep 2026",
        harvestDateShort: "18 Sep",
        category: "Fruits · Pomegranate",
        minOrderKg: 500,
        about:
          "Deep-red Bhagwa pomegranates grown on 12 acres in Natham. Fruit is sizing well after a dry spell and a late monsoon shower. Arils are sweet with a bright ruby colour — suited for wholesale, juice, and export packing.",
        hasVideo: true,
        imageKey: "pomegranate",
        galleryKeys: ["farm", "pomegranate", "orchard", "orchard"],
      },
    ],
  },
  {
    email: "muthu@uzhavan.app",
    name: "Muthu Vel",
    phone: "+91 94422 30871",
    farm: {
      name: "Muthu Farms",
      district: "Salem",
      location: "Attur, Salem",
      rating: 4.9,
      avatarKey: "muthu",
    },
    crops: [
      {
        headline: "Salem turmeric cured and ready now",
        title: "Salem Turmeric",
        status: "ready" as const,
        statusLabel: "Ready now",
        expectedKg: 12000,
        grade: "Grade A",
        pricePerKg: 180,
        harvestDate: "02 Sep 2026",
        harvestDateShort: "02 Sep",
        category: "Spices · Turmeric",
        minOrderKg: 500,
        about:
          "Finger turmeric from Attur, boiled and sun-cured on-farm. High curcumin colour, clean fingers, and uniform size. Ideal for mills, exporters, and warehouse stocking.",
        hasVideo: false,
        imageKey: "turmeric",
        galleryKeys: ["turmeric", "turmeric", "farm"],
      },
    ],
  },
  {
    email: "kannan@uzhavan.app",
    name: "Kannan",
    phone: "+91 97890 55214",
    farm: {
      name: "Kannan Orchard",
      district: "Nilgiris",
      location: "Ooty, Nilgiris",
      rating: 4.7,
      avatarKey: "kannan",
    },
    crops: [
      {
        headline: "Nilgiri oranges colouring on the tree",
        title: "Nilgiri Oranges",
        status: "upcoming" as const,
        statusLabel: "Harvest in 3 weeks",
        expectedKg: 6400,
        grade: "Grade A",
        pricePerKg: 45,
        harvestDate: "28 Sep 2026",
        harvestDateShort: "28 Sep",
        category: "Fruits · Orange",
        minOrderKg: 400,
        about:
          "Hill oranges from a family orchard above Ooty. Tight skin, good juice, and a sharp-sweet balance that Chennai and Coimbatore markets ask for every season.",
        hasVideo: true,
        imageKey: "orange",
        galleryKeys: ["grove", "orange", "farm"],
      },
    ],
  },
];

const drivers = [
  {
    email: "selvam@uzhavan.app",
    name: "Selvam",
    phone: "+91 90031 77420",
    rating: 4.8,
    trips: 212,
    photoKey: "selvam",
    truck: {
      name: "Mini Truck 3.5T",
      meta: "Open body · 3.5 ton",
      capacityTons: 3.5,
      capacityKg: 3500,
      etaMin: 12,
      price: 3450,
      photoKey: "truck",
      body: "Open body",
      plate: "TN 30 AB 4821",
    },
  },
  {
    email: "ramesh@uzhavan.app",
    name: "Ramesh Kumar",
    phone: "+91 89400 21678",
    rating: 4.6,
    trips: 96,
    photoKey: "ramesh",
    truck: {
      name: "Tata Ace 1.5T",
      meta: "Closed body · 1.5 ton",
      capacityTons: 1.5,
      capacityKg: 1500,
      etaMin: 8,
      price: 2100,
      photoKey: "miniTruck",
      body: "Closed body",
      plate: "TN 27 AC 1104",
    },
  },
  {
    email: "vikram@uzhavan.app",
    name: "Vikram Raj",
    phone: "+91 93451 60934",
    rating: 4.9,
    trips: 341,
    photoKey: "selvam",
    truck: {
      name: "LCV 5T",
      meta: "Open body · 5 ton",
      capacityTons: 5,
      capacityKg: 5000,
      etaMin: 18,
      price: 4250,
      photoKey: "lcv",
      body: "Open body",
      plate: "TN 54 CD 9022",
    },
  },
];

async function main() {
  console.log("Seeding Uzhavan…");

  const pw = await hashPassword("uzhavan123");

  for (const f of farmers) {
    const user = await prisma.user.upsert({
      where: { email: f.email },
      create: {
        email: f.email,
        passwordHash: pw,
        role: "FARMER",
        name: f.name,
        phone: f.phone,
        avatarKey: f.farm.avatarKey,
        district: f.farm.district,
        districtKey: resolveDistrict(f.farm.district)?.name ?? null,
      },
      update: { passwordHash: pw },
    });

    const farm = await prisma.farm.upsert({
      where: { ownerId: user.id },
      create: {
        ownerId: user.id,
        ownerName: f.name,
        ...f.farm,
        districtKey: resolveDistrict(f.farm.district)?.name ?? null,
      },
      update: {
        ...f.farm,
        ownerName: f.name,
        districtKey: resolveDistrict(f.farm.district)?.name ?? null,
      },
    });

    for (const crop of f.crops) {
      const existing = await prisma.crop.findFirst({
        where: { farmId: farm.id, title: crop.title },
      });
      if (existing) {
        await prisma.crop.update({ where: { id: existing.id }, data: crop });
      } else {
        await prisma.crop.create({ data: { ...crop, farmId: farm.id } });
      }
    }
  }

  for (const d of drivers) {
    const user = await prisma.user.upsert({
      where: { email: d.email },
      create: {
        email: d.email,
        passwordHash: pw,
        role: "DRIVER",
        name: d.name,
        phone: d.phone,
        avatarKey: d.photoKey,
      },
      update: { passwordHash: pw },
    });

    const driver = await prisma.driver.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        name: d.name,
        rating: d.rating,
        trips: d.trips,
        photoKey: d.photoKey,
      },
      update: { rating: d.rating, trips: d.trips, online: true },
    });

    await prisma.truck.upsert({
      where: { driverId: driver.id },
      create: { driverId: driver.id, ...d.truck, plateKey: normalisePlate(d.truck.plate) },
      update: { ...d.truck, plateKey: normalisePlate(d.truck.plate) },
    });
  }

  const buyer = await prisma.user.upsert({
    where: { email: "karthik@uzhavan.app" },
    create: {
      email: "karthik@uzhavan.app",
      passwordHash: pw,
      role: "BUYER",
      name: "Karthik Rajan",
      phone: "+91 98430 11220",
      avatarKey: "buyer",
      business: "Karthik Traders",
      district: "Salem",
      districtKey: "Salem",
      warehouse: "Salem Agro Warehouse",
      warehouseAddress: "Salem, Tamil Nadu",
      market: "Koyambedu Market, Chennai",
    },
    update: { passwordHash: pw },
  });

  // Admin and staff for the console. The admin password comes from the
  // environment in production — never leave the seeded one in place.
  await prisma.user.upsert({
    where: { email: "admin@uzhavan.app" },
    create: {
      email: "admin@uzhavan.app",
      passwordHash: process.env.ADMIN_PASSWORD
        ? await hashPassword(process.env.ADMIN_PASSWORD)
        : pw,
      role: "ADMIN",
      name: "Platform Admin",
      phone: "+91 80000 00001",
      avatarKey: "buyer",
    },
    update: { role: "ADMIN" },
  });

  await prisma.user.upsert({
    where: { email: "staff@uzhavan.app" },
    create: {
      email: "staff@uzhavan.app",
      passwordHash: pw,
      role: "STAFF",
      name: "Support Staff",
      phone: "+91 80000 00002",
      avatarKey: "buyer",
      permissions: STAFF_PERMISSIONS,
    },
    // Keep permissions in step with the seed on re-runs — otherwise an older
    // staff row silently keeps an empty permission set.
    update: { role: "STAFF", permissions: STAFF_PERMISSIONS },
  });

  // Runtime settings — editable from the admin console, never in code again.
  const settings = [
    {
      key: "support_email",
      value: "support@uzhavan.app",
      label: "Support email",
      description: "Shown in the apps and on blocked-account messages.",
      isPublic: true,
    },
    {
      key: "support_phone",
      value: "+91 80000 00000",
      label: "Support phone",
      description: "Shown on the help screen in every app.",
      isPublic: true,
    },
    {
      key: "support_whatsapp",
      value: "+91 80000 00000",
      label: "WhatsApp number",
      description: "Optional. Leave as the support number if you don't have a separate line.",
      isPublic: true,
    },
    {
      key: "support_hours",
      value: "Mon–Sat, 9am – 7pm IST",
      label: "Support hours",
      description: "Displayed next to the contact details.",
      isPublic: true,
    },
    {
      key: "platform_fee_percent",
      value: "5",
      label: "Platform fee (%)",
      description:
        "Charged to buyers on top of the price the farmer agreed. Farmers and drivers pay nothing. Minimum 5%, maximum 30%.",
      isPublic: false,
    },
    {
      key: "payout_policy",
      value: "SPLIT_ON_LOAD",
      label: "When farmers get paid",
      description:
        "SPLIT_ON_LOAD releases an advance when the driver confirms the load and the rest after delivery. AFTER_DELIVERY pays nothing until delivered — the Amazon / Flipkart shape.",
      isPublic: false,
    },
    {
      key: "payout_advance_percent",
      value: "30",
      label: "Advance on loading (%)",
      description:
        "Only under SPLIT_ON_LOAD, and only for verified farmers whose crop moves on a booked truck. 0 to 50.",
      isPublic: false,
    },
    {
      key: "payout_hold_hours",
      value: "48",
      label: "Hold after delivery (hours)",
      description:
        "The dispute window. Once it passes the rest is released automatically, so a silent buyer can't strand a farmer's money. 0 to 336.",
      isPublic: false,
    },
  ];
  for (const s of settings) {
    await prisma.appSetting.upsert({ where: { key: s.key }, create: s, update: { label: s.label, description: s.description, isPublic: s.isPublic } });
  }

  // Version gates. Both apps start permissive; tighten from the console.
  for (const app of ["BUYER", "PARTNER"] as const) {
    for (const platform of ["ANDROID", "IOS"] as const) {
      await prisma.appRelease.upsert({
        where: { app_platform: { app, platform } },
        create: {
          app,
          platform,
          latestVersion: "1.0.0",
          minSupportedVersion: "1.0.0",
          releaseNotes: "First release.",
          mandatory: false,
        },
        update: {},
      });
    }
  }

  const turmeric = await prisma.crop.findFirst({ where: { title: "Salem Turmeric" } });
  if (turmeric) {
    await prisma.follow.upsert({
      where: { userId_cropId: { userId: buyer.id, cropId: turmeric.id } },
      create: { userId: buyer.id, cropId: turmeric.id },
      update: {},
    });
  }

  console.log("Done.");
  console.log("  Buyer   karthik@uzhavan.app");
  console.log("  Farmers arul@ / muthu@ / kannan@uzhavan.app");
  console.log("  Drivers selvam@ / ramesh@ / vikram@uzhavan.app");
  console.log("  Admin   admin@uzhavan.app");
  console.log("  Staff   staff@uzhavan.app");
  console.log("  Password for all: uzhavan123  (set ADMIN_PASSWORD to override the admin's)");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
