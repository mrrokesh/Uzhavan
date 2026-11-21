import * as SecureStore from "expo-secure-store";

const KEY = "uzhavanbuy.place";

export type BuyerPlace = {
  state: string;
  district: string;
  radiusKm?: number;
};

export async function loadPlace(): Promise<BuyerPlace | null> {
  const raw = await SecureStore.getItemAsync(KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as BuyerPlace;
    if (!parsed.state || !parsed.district) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function savePlace(place: BuyerPlace): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(place));
}
