"use client";
import { useSyncExternalStore } from "react";

const never = () => () => {};

/** A value that only exists in the browser (matchMedia, fullscreenEnabled, the local clock): `server` during SSR and hydration, `get()` after. */
export function useClientValue<T>(get: () => T, server: T): T {
  return useSyncExternalStore(never, get, () => server);
}
