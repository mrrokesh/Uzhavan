import type { ImageSourcePropType } from "react-native";
import { API_BASE_URL } from "./api";

/**
 * The API returns image *keys* (plain strings). The mobile app ships the actual
 * photos as bundled assets — this map resolves a key to its `require()`d source.
 */
export const IMAGES: Record<string, ImageSourcePropType> = {
  pomegranate: require("../../assets/images/pomegranate.jpg"),
  orchard: require("../../assets/images/orchard.jpg"),
  farm: require("../../assets/images/farm.jpg"),
  turmeric: require("../../assets/images/turmeric.jpg"),
  orange: require("../../assets/images/orange.jpg"),
  grove: require("../../assets/images/grove.jpg"),
  truck: require("../../assets/images/truck.jpg"),
  miniTruck: require("../../assets/images/minitruck.jpg"),
  lcv: require("../../assets/images/lcv.jpg"),
  warehouse: require("../../assets/images/warehouse.jpg"),
};

const FALLBACK = IMAGES.farm;

/** Resolve a single image key (or undefined) to a bundled source. */
export function imageFor(key: string | null | undefined): ImageSourcePropType {
  if (!key) return FALLBACK;
  return IMAGES[key] ?? FALLBACK;
}

/** Resolve an array of image keys to bundled sources. */
export function imagesFor(keys: string[] | null | undefined): ImageSourcePropType[] {
  if (!keys?.length) return [FALLBACK];
  return keys.map(imageFor);
}

/** A picture the farmer added, or the stock photo for that key. */
export function cropImage(crop: {
  id: string;
  imageKey: string;
  hasCustomPhoto?: boolean;
  photoUpdatedAt?: string | null;
}): ImageSourcePropType {
  if (crop.hasCustomPhoto) {
    return {
      uri: `${API_BASE_URL}/api/crops/${crop.id}/photo?v=${encodeURIComponent(crop.photoUpdatedAt ?? "")}`,
    };
  }
  return imageFor(crop.imageKey);
}
