import { Children, cloneElement, isValidElement, type CSSProperties, type ReactElement, type ReactNode } from "react";

/** Gives every cell of a row the name of its column, read by the stacked layout of narrow screens. */
function labelCells(row: ReactNode, labels: ReadonlyArray<string>): ReactNode {
  if (!isValidElement<{ children?: ReactNode }>(row)) {
    return row;
  }

  let column = 0;
  const cells = Children.map(row.props.children, (cell) =>
    isValidElement(cell) ? cloneElement(cell as ReactElement<Record<string, unknown>>, { "data-label": labels[column++] ?? "" }) : cell,
  );

  return cloneElement(row, undefined, cells);
}

/**
 * Table with the panel's header/cell styling, horizontally scrollable. Below 640 px each row becomes a small
 * card: the first cell as its heading, then one line per column with the column's name (see `.data-table-stack`).
 */
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
  const labels = head.map((cell) => (typeof cell === "string" ? cell : ""));

  return (
    <div className="overflow-x-auto">
      <table className="data-table data-table-stack w-full border-collapse" style={{ minWidth, "--cell-py": `${cellPadding}px` } as CSSProperties}>
        <thead>
          <tr>
            {head.map((cell, index) => (
              <th key={index} scope="col">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{Children.map(children, (row) => labelCells(row, labels))}</tbody>
      </table>
    </div>
  );
}
