import type { CSSProperties, ReactNode } from "react";

/** Horizontally scrollable table with the panel's header/cell styling. */
export function DataTable({
  head,
  children,
  minWidth = 560,
  cellPadding = 12,
}: Readonly<{
  head: ReadonlyArray<ReactNode>;
  children: ReactNode;
  minWidth?: number;
  /** Vertical padding of body cells, in px. */
  cellPadding?: number;
}>) {
  return (
    <div className="overflow-x-auto">
      <table className="data-table w-full border-collapse" style={{ minWidth, "--cell-py": `${cellPadding}px` } as CSSProperties}>
        <thead>
          <tr>
            {head.map((cell, index) => (
              <th key={index} scope="col">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
