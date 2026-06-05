export function renderDNAPlot2D(points, axisX, axisY) {
  const width = 48;
  const height = 12;

  const canvas = Array.from({ length: height + 1 }, () =>
    Array.from({ length: width + 1 }, () => " ")
  );

  for (const point of points) {
    const x = clamp(Number(point.x ?? 0), 0, 1);
    const y = clamp(Number(point.y ?? 0), 0, 1);

    let col = Math.round(x * width);
    let row = height - Math.round(y * height);

    const label = `🦠 ${point.id}`;

    const position = findAvailablePosition(
      canvas,
      row,
      col,
      label.length,
      height,
      width
    );

    row = position.row;
    col = position.col;

    for (let i = 0; i < label.length && col + i <= width; i++) {
      canvas[row][col + i] = label[i];
    }
  }

  console.log("");
  console.log("🧬 DNA Plot 2D");
  console.log("");
  console.log(`X = ${axisX}`);
  console.log(`Y = ${axisY}`);
  console.log("");

  console.log(`${axisY} ↑`);

  for (let row = 0; row <= height; row++) {
    const yValue = ((height - row) / height).toFixed(1);
    console.log(`${yValue} │ ${canvas[row].join("")}`);
  }

  console.log(`0.0 └${"─".repeat(width + 2)}→ ${axisX}`);
  console.log(`    0.0${" ".repeat(Math.floor(width / 2) - 3)}0.5${" ".repeat(Math.floor(width / 2) - 3)}1.0`);
  console.log("");

  console.log("Points:");
  for (const point of points) {
    console.log(
      `  ${point.id.padEnd(12)} ${axisX}=${Number(point.x).toFixed(2)} ${axisY}=${Number(point.y).toFixed(2)}`
    );
  }

  console.log("");
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function findAvailablePosition(canvas, row, col, labelLength, height, width) {
  const maxAttempts = 20;

  for (let offset = 0; offset < maxAttempts; offset++) {
    const nextRow = Math.min(row + offset, height);
    const nextCol = Math.min(col + offset * 2, width - labelLength);

    if (canPlaceLabel(canvas, nextRow, nextCol, labelLength, width)) {
      return {
        row: nextRow,
        col: nextCol,
      };
    }
  }

  return {
    row,
    col: Math.min(col, width - labelLength),
  };
}

function canPlaceLabel(canvas, row, col, labelLength, width) {
  if (col < 0 || col + labelLength > width) {
    return false;
  }

  for (let i = 0; i < labelLength; i++) {
    if (canvas[row][col + i] !== " ") {
      return false;
    }
  }

  return true;
}
