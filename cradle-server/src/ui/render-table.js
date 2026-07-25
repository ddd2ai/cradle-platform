export function renderTable(columns, rows) {
  if (!rows || rows.length === 0) {
    console.log("(empty)");
    return;
  }

  const widths = {};

  for (const column of columns) {
    widths[column] = Math.max(
      column.length,
      ...rows.map((row) => String(row[column] ?? "").length)
    );
  }

  const border = (left, middle, right) =>
    left +
    columns
      .map((column) => "─".repeat(widths[column] + 2))
      .join(middle) +
    right;

  const renderRow = (row) =>
    "│ " +
    columns
      .map((column) =>
        String(row[column] ?? "").padEnd(widths[column])
      )
      .join(" │ ") +
    " │";

  console.log(border("┌", "┬", "┐"));
  console.log(renderRow(Object.fromEntries(columns.map((c) => [c, c]))));
  console.log(border("├", "┼", "┤"));

  for (const row of rows) {
    console.log(renderRow(row));
  }

  console.log(border("└", "┴", "┘"));
}