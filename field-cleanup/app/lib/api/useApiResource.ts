"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "./client";

export function useApiResource<T>(path: string, sample: T) {
  const [data, setData] = useState(sample);
  const [revision, setRevision] = useState(0);
  const [requestState, setRequestState] = useState<{
    revision: number;
    error: string | null;
  }>({ revision: -1, error: null });

  useEffect(() => {
    const controller = new AbortController();
    api<T>(path, { signal: controller.signal })
      .then((nextData) => {
        setData(nextData);
        setRequestState({ revision, error: null });
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setRequestState({
          revision,
          error: reason instanceof Error ? reason.message : "Unable to load control-plane data.",
        });
      });
    return () => controller.abort();
  }, [path, revision]);

  const reload = useCallback(() => setRevision((value) => value + 1), []);
  return {
    data,
    loading: requestState.revision !== revision,
    error: requestState.revision === revision ? requestState.error : null,
    reload,
    setData,
  };
}
