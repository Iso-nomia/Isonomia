"use client";

import * as React from "react";
import { useSWRConfig, Key } from "swr";
import { useBusEffect } from "./useBusEffect";

/**
 * A convenience wrapper to revalidate SWR keys when bus events arrive.
 *
 * - `keys`: a single SWR key, a list of keys, or a function (detail => keys).
 * - `shouldRevalidate`: optional predicate (detail => boolean).
 * - `waitMs`: throttle interval for events.
 */
export function useBusMutate(
  topics: string[] | readonly string[],
  keys: Key | Key[] | ((detail: any) => Key | Key[]),
  shouldRevalidate?: (detail: any) => boolean,
  waitMs = 0
) {
  const { mutate } = useSWRConfig();

  useBusEffect(
    topics,
    (detail, _type) => {
      if (shouldRevalidate && !shouldRevalidate(detail)) return;

      const ks = typeof keys === "function" ? keys(detail) : keys;
      const arr = Array.isArray(ks) ? ks : [ks];

      arr.forEach((k) => {
        // no revalidate if k is falsy
        if (k) mutate(k);
      });
    },
    waitMs
  );
}
