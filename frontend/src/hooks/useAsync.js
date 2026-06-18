import { useCallback, useEffect, useState } from "react";

export const useAsync = (callback, deps = []) => {
  const [state, setState] = useState({ data: null, loading: true, error: "" });

  const run = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const data = await callback();
      setState({ data, loading: false, error: "" });
    } catch (error) {
      setState({ data: null, loading: false, error: error.response?.data?.message || error.message });
    }
  }, deps);

  useEffect(() => {
    run();
  }, [run]);

  return { ...state, reload: run };
};
