type Edit = Readonly<{ kind: "equal" | "addition" | "removal"; text: string }>;
export const myers = (
  old: readonly string[],
  next: readonly string[],
  maxCells: number,
): Edit[] => {
  const trace: Map<number, number>[] = [];
  let frontier = new Map<number, number>([[1, 0]]);
  let cells = 0;
  for (let distance = 0; distance <= old.length + next.length; distance++) {
    cells += 2 * distance + 1;
    if (cells > maxCells) break;
    trace.push(new Map(frontier));
    for (let diagonal = -distance; diagonal <= distance; diagonal += 2) {
      let x =
        diagonal === -distance ||
        (diagonal !== distance &&
          (frontier.get(diagonal - 1) ?? -Infinity) < (frontier.get(diagonal + 1) ?? -Infinity))
          ? (frontier.get(diagonal + 1) ?? 0)
          : (frontier.get(diagonal - 1) ?? 0) + 1;
      let y = x - diagonal;
      while (x < old.length && y < next.length && old[x] === next[y]) {
        x++;
        y++;
      }
      frontier.set(diagonal, x);
      if (x < old.length || y < next.length) continue;
      const edits: Edit[] = [];
      x = old.length;
      y = next.length;
      for (let depth = distance; depth >= 0; depth--) {
        const previous = trace[depth]!;
        const k = x - y;
        const previousK =
          k === -depth ||
          (k !== depth && (previous.get(k - 1) ?? -Infinity) < (previous.get(k + 1) ?? -Infinity))
            ? k + 1
            : k - 1;
        const previousX = previous.get(previousK) ?? 0;
        const previousY = previousX - previousK;
        while (x > previousX && y > previousY) {
          edits.push({ kind: "equal", text: old[--x]! });
          y--;
        }
        if (depth === 0) break;
        if (x === previousX) edits.push({ kind: "addition", text: next[--y]! });
        else edits.push({ kind: "removal", text: old[--x]! });
      }
      return edits.reverse();
    }
  }
  return [
    ...old.map((text): Edit => ({ kind: "removal", text })),
    ...next.map((text): Edit => ({ kind: "addition", text })),
  ];
};
