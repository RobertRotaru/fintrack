import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'react-native-reanimated';

/**
 * A number that counts up to `target` when it first appears, then glides to
 * new values (as on the web). Jumps straight there with reduced motion on.
 */
export function useCountUp(target: number, duration = 1100): number {
  const reduce = useReducedMotion();
  const [value, setValue] = useState(reduce ? target : 0);
  const from = useRef(value);

  useEffect(() => {
    if (reduce) {
      from.current = target;
      setValue(target);
      return;
    }
    const start = Date.now();
    const origin = from.current;
    let frame = 0;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const v = t === 1 ? target : origin + (target - origin) * (1 - Math.pow(1 - t, 4));
      from.current = v;
      setValue(v);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration, reduce]);

  return value;
}
