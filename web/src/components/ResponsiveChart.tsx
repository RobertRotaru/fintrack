import { useEffect, useState, type ComponentProps } from 'react';
import { ResponsiveContainer as RechartsContainer } from 'recharts';

/** Safely after the page entrance (--motion-page, 220ms, in index.css) has finished. */
const AFTER_ENTRANCE_MS = 300;

/**
 * Recharts' first layout is the most expensive frame on a chart page. Mounting
 * charts just after the page entrance keeps the transition smooth on slower
 * devices; the chart then draws itself in with its own animation. The
 * placeholder holds the same size, so nothing shifts.
 */
export function ResponsiveContainer(props: ComponentProps<typeof RechartsContainer>) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setReady(true), AFTER_ENTRANCE_MS);
    return () => clearTimeout(id);
  }, []);
  if (ready) return <RechartsContainer {...props} />;
  return <div aria-hidden="true" style={{ width: props.width ?? '100%', height: props.height ?? '100%' }} />;
}
