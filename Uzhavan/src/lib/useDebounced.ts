import { useEffect, useState } from "react";

/** The value, but only once it has stopped changing for `ms`. Keeps typing from firing a request per keystroke. */
export function useDebounced<T>(value: T, ms = 350): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return settled;
}
