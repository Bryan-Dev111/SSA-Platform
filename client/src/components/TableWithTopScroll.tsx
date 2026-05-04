/**
 * Horizontal scroll synced between a thin top track and the table below
 * (same pattern as Purchase Orders / Samples wide tables).
 */
import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';

export type TableWithTopScrollProps = {
  /** Must be a native `<table>` element (single child). */
  children: ReactNode;
  /** Accessible name for the top scroll region. */
  ariaLabel: string;
};

export function TableWithTopScroll({ children, ariaLabel }: TableWithTopScrollProps) {
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const [topScrollInnerWidth, setTopScrollInnerWidth] = useState(0);

  const syncScrollFromTop = useCallback(() => {
    if (!topScrollRef.current || !tableScrollRef.current) return;
    tableScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
  }, []);

  const syncScrollFromTable = useCallback(() => {
    if (!topScrollRef.current || !tableScrollRef.current) return;
    topScrollRef.current.scrollLeft = tableScrollRef.current.scrollLeft;
  }, []);

  const syncTopTrackWidth = useCallback(() => {
    setTopScrollInnerWidth(tableRef.current?.scrollWidth ?? 0);
  }, []);

  const tableChild =
    isValidElement(children) && children.type === 'table'
      ? cloneElement(children as ReactElement<React.ComponentProps<'table'>>, { ref: tableRef })
      : children;

  useEffect(() => {
    syncTopTrackWidth();
    window.addEventListener('resize', syncTopTrackWidth);
    return () => window.removeEventListener('resize', syncTopTrackWidth);
  }, [syncTopTrackWidth, children]);

  useEffect(() => {
    const el = tableRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => syncTopTrackWidth());
    ro.observe(el);
    return () => ro.disconnect();
  }, [syncTopTrackWidth, children]);

  if (!isValidElement(children) || children.type !== 'table') {
    return <div className="table-wrap">{children}</div>;
  }

  return (
    <>
      <div
        ref={topScrollRef}
        className="purchase-orders-table-scroll"
        style={{ overflowY: 'hidden', marginBottom: 6 }}
        onScroll={syncScrollFromTop}
        aria-label={ariaLabel}
      >
        <div style={{ height: 1, width: topScrollInnerWidth || '100%' }} />
      </div>
      <div
        ref={tableScrollRef}
        className="table-wrap purchase-orders-table-scroll"
        onScroll={syncScrollFromTable}
      >
        {tableChild}
      </div>
    </>
  );
}
