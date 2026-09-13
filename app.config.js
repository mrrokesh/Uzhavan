// Two apps, one codebase.
//
//   UZHAVAN_APP=farmer  → "Uzhavan"      — farmers listing harvests, drivers hauling them
//   UZHAVAN_APP=buy     → "Uzhavan Buy"  — wholesale dealers and buyers purchasing from farmers
//
// Everything the two share (version, plugins, icons, splash, the EAS project
// and its update URL) stays in app.json. Only the identity differs here, so a
// build declares which app it is without a code change. `extra.appKind` is what
// the running app reads via APP_KIND, and what the server matches release rules
// against.
//
// The two deliberately share one `slug`, and therefore one EAS project. An EAS
// project maps to exactly one slug, so two slugs would mean two projects, two
// sets of credentials and two dashboards for what is one product. They stay
// separate where it matters — a different Android package and iOS bundle id
// make them genuinely different installs — and separate EAS Update *channels*
// keep their over-the-air updates apart, which is the part that would actually
// hurt if it were shared: publishing the buyer app's JavaScript onto farmers'
// phones. See the channels in eas.json.
//
// `scheme` differs too, or two apps on one handset would fight over the same
// deep links.

const TARGETS = {
  farmer: {
    name: "Uzhavan",
    scheme: "uzhavan",
    id: "com.uzhavan.app",
    appKind: "PARTNER",
  },
  buy: {
    name: "Uzhavan Buy",
    scheme: "uzhavanbuy",
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
  slug: "uzhavan",
  scheme: target.scheme,
  ios: { ...config.ios, bundleIdentifier: target.id },
  android: { ...config.android, package: target.id },
  extra: { ...config.extra, appKind: target.appKind },
});
