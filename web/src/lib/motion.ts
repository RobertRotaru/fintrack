import { useEffect, useRef, useState } from 'react';

const reducedMotion = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * A number that counts up to `target` when it first appears, then glides to
 * new values. Jumps straight there when the person prefers reduced motion.
 */
export function useCountUp(target: number, duration = 1100): number {
  const [value, setValue] = useState(() => (reducedMotion() ? target : 0));
  const from = useRef(value);

  useEffect(() => {
    if (reducedMotion() || typeof requestAnimationFrame !== 'function') {
      from.current = target;
      setValue(target);
      return;
    }
    const start = performance.now();
    const origin = from.current;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 4);
      const v = t === 1 ? target : origin + (target - origin) * eased;
      from.current = v;
      setValue(v);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return value;
}
