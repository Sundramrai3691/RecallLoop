import { useEffect, useState } from "react";
import { api } from "../api/client";
import { ApiError, type DashboardData } from "../types";

export function useDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [mock, setMock] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.dashboard(), api.health()])
      .then(([dashboard, health]) => {
        if (cancelled) return;
        setData(dashboard);
        setMock(health.mockLlm);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "Could not load dashboard");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, mock, error };
}
