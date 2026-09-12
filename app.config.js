// Two apps, one codebase.
//
//   UZHAVAN_APP=farmer  → "Uzhavan"      — farmers listing harvests, drivers hauling them
//   UZHAVAN_APP=buy     → "Uzhavan Buy"  — wholesale dealers and buyers purchasing from farmers
//
// Everything the two share (version, plugins, icons, splash) stays in app.json.
// Only the identity differs here, so a build declares which app it is without a
// code change. `extra.appKind` is what the running app reads via APP_KIND, and
// what the server matches release rules against.

const TARGETS = {
  farmer: {
    name: "Uzhavan",
    slug: "uzhavan",
    id: "com.uzhavan.app",
    appKind: "PARTNER",
  },
  buy: {
    name: "Uzhavan Buy",
    slug: "uzhavan-buy",
    id: "com.uzhavan.buy",
    appKind: "BUYER",
  },
};

const key = (process.env.UZHAVAN_APP ?? "farmer").toLowerCase();
const target = TARGETS[key];

if (!target) {
  const known = Object.keys(TARGETS).join(" | ");
  throw new Error(`UZHAVAN_APP="${process.env.UZHAVAN_APP}" is not one of: ${known}`);
}

module.exports = ({ config }) => ({
  ...config,
  name: target.name,
  slug: target.slug,
  scheme: target.slug,
  ios: { ...config.ios, bundleIdentifier: target.id },
  android: { ...config.android, package: target.id },
  extra: { ...config.extra, appKind: target.appKind },
});
