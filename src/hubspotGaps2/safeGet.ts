// HubSpot gaps batch 2 - a GET that always gives a promise of an object (an empty reply becomes {}).
import { api } from "@/api";

export function safeGet<T = any>(path: string): Promise<T> {
  return Promise.resolve()
    .then(() => api.get<T>(path))
    .then((r) => ((r ?? {}) as T));
}
