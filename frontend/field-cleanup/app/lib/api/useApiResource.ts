"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "./client";

export function useApiResource<T>(path: string, initialData: T) {
  const [data, setData] = useState(initialData);
  const [revision, setRevision] = useState(0);
  const [requestState, setRequestState] = useState<{
    path: string;
    revision: number;
    error: string | null;
  }>({ path, revision: -1, error: null });

  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    api<T>(path, { signal: controller.signal })
      .then((nextData) => {
        if (controller.signal.aborted) return;
        setData(nextData);
        setRequestState({ path, revision, error: null });
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setRequestState({
          path,
          revision,
          error: reason instanceof Error ? reason.message : "Unable to load control-plane data.",
        });
      });
    return () => controller.abort();
  }, [path, revision]);

  const reload = useCallback(() => setRevision((value) => value + 1), []);
  return {
    data,
    loading: !!path && (requestState.path !== path || requestState.revision !== revision),
    error: requestState.path === path && requestState.revision === revision ? requestState.error : null,
    reload,
    setData,
  };
}
