import Constants from "expo-constants";

/**
 * Which of the two apps this build is. The split into separate Buyer and
 * Partner binaries is upcoming; until then this reads from app.json's `extra`
 * so a build can declare itself without a code change.
 */
export const APP_KIND: "BUYER" | "PARTNER" =
  (Constants.expoConfig?.extra?.appKind as "BUYER" | "PARTNER") ?? "BUYER";

/** Matches `expo.version` in app.json — what the server compares against. */
export const APP_VERSION: string = Constants.expoConfig?.version ?? "1.0.0";
