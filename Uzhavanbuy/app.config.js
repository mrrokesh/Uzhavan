// Uzhavan Buy — wholesale dealers and buyers purchasing from farmers.
//
// This used to share a codebase with the farmer/driver app (Uzhavan), switched
// at build time via UZHAVAN_APP. The two are now independent projects (this
// folder and ../Uzhavan), so the identity below is fixed rather than chosen
// by an env var.
//
// `extra.appKind` is what the running app reads via APP_KIND, and what the
// server matches release rules against.
//
// The EAS project (slug + updates URL, in app.json) is still shared with
// Uzhavan on purpose — one dashboard, one set of credentials for what is one
// product. `scheme`, the Android package and the iOS bundle id stay
// different, or the two would fight over deep links and installs. See the
// channels in eas.json for how OTA updates stay separated too.

const TARGET = {
  name: "Uzhavan Buy",
  scheme: "uzhavanbuy",
  id: "com.uzhavan.buy",
  appKind: "BUYER",
};

module.exports = ({ config }) => ({
  ...config,
  name: TARGET.name,
  slug: "uzhavan",
  scheme: TARGET.scheme,
  ios: { ...config.ios, bundleIdentifier: TARGET.id },
  android: { ...config.android, package: TARGET.id },
  extra: { ...config.extra, appKind: TARGET.appKind },
});
