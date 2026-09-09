import { OPS, Util } from 'pdfjs-dist/legacy/build/pdf.mjs';

// PDF.js 6 exposes painted path bounds in user space. Only full-width,
// thin rules are row separators; text and cell backgrounds are not.
export function extractRowSeparators(operatorList, tableLeft = 56, tableRight = 702) {
  let transform = [1, 0, 0, 1, 0, 0];
  const stack = [];
  const separators = [];
  operatorList.fnArray.forEach((op, index) => {
    const args = operatorList.argsArray[index];
    if (op === OPS.save) stack.push([...transform]);
    else if (op === OPS.restore) transform = stack.pop() || [1, 0, 0, 1, 0, 0];
    else if (op === OPS.transform) transform = Util.transform(transform, args);
    else if (op === OPS.constructPath && args[2] && [OPS.fill, OPS.eoFill, OPS.stroke, OPS.fillStroke, OPS.eoFillStroke].includes(args[0])) {
      const bounds = Array.from(args[2]);
      if (bounds.length !== 4 || !bounds.every(Number.isFinite)) return;
      // Rotated/sheared paths cannot safely delimit horizontal text rows.
      if (Math.abs(transform[1]) > 0.001 || Math.abs(transform[2]) > 0.001) return;
      const x1 = bounds[0] * transform[0] + transform[4];
      const x2 = bounds[2] * transform[0] + transform[4];
      const y1 = bounds[1] * transform[3] + transform[5];
      const y2 = bounds[3] * transform[3] + transform[5];
      if (Math.min(x1, x2) > tableLeft + 2 || Math.max(x1, x2) < tableRight) return;
      if (Math.abs(y2 - y1) > 1) return;
      const y = (y1 + y2) / 2;
      if (!separators.some((existing) => Math.abs(existing - y) < 0.5)) separators.push(y);
    }
  });
  return separators.sort((a, b) => b - a);
}

export function rowBoundsAt(y, separators) {
  const upper = separators.filter((value) => value > y).at(-1);
  const lower = separators.find((value) => value < y);
  return upper === undefined || lower === undefined ? null : { upper, lower };
}
