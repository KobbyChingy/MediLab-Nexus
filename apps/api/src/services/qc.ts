type QcPoint = {
  observedValue: number;
  meanValue: number;
  standardDeviation: number;
  occurredAt: Date;
};

function sigmaDistance(point: QcPoint) {
  return (point.observedValue - point.meanValue) / point.standardDeviation;
}

export function evaluateWestgard(history: QcPoint[]) {
  if (history.length === 0) {
    return [] as string[];
  }

  const rules = new Set<string>();
  const latest = history[history.length - 1];
  if (!latest) {
    return [];
  }
  const latestSigma = sigmaDistance(latest);

  if (Math.abs(latestSigma) > 3) {
    rules.add("1_3s");
  }

  const lastTwo = history.slice(-2);
  if (lastTwo.length === 2) {
    const [firstPoint, secondPoint] = lastTwo;
    if (
      firstPoint &&
      secondPoint &&
      [firstPoint, secondPoint].every(
        (point) => Math.abs(sigmaDistance(point)) > 2,
      ) &&
      Math.sign(sigmaDistance(firstPoint)) ===
        Math.sign(sigmaDistance(secondPoint))
    ) {
      rules.add("2_2s");
    }
  }

  if (lastTwo.length === 2) {
    const [firstPoint, secondPoint] = lastTwo;
    if (!firstPoint || !secondPoint) {
      return [...rules];
    }

    const first = sigmaDistance(firstPoint);
    const second = sigmaDistance(secondPoint);
    if (
      Math.abs(first - second) > 4 &&
      Math.sign(first) !== Math.sign(second)
    ) {
      rules.add("R_4s");
    }
  }

  const lastFour = history.slice(-4);
  if (
    lastFour.length === 4 &&
    lastFour.every((point) => Math.abs(sigmaDistance(point)) > 1)
  ) {
    const firstPoint = lastFour[0];
    const sameSide = firstPoint
      ? lastFour.every(
          (point) =>
            Math.sign(sigmaDistance(point)) ===
            Math.sign(sigmaDistance(firstPoint)),
        )
      : false;
    if (sameSide) {
      rules.add("4_1s");
    }
  }

  const lastTen = history.slice(-10);
  if (lastTen.length === 10) {
    const firstPoint = lastTen[0];
    const sameSide = firstPoint
      ? lastTen.every(
          (point) =>
            Math.sign(point.observedValue - point.meanValue) ===
            Math.sign(firstPoint.observedValue - firstPoint.meanValue),
        )
      : false;
    if (sameSide) {
      rules.add("10x");
    }
  }

  return [...rules];
}

export function buildLeveyJenningsSeries(history: QcPoint[]) {
  return history.slice(-10).map((point) => ({
    label: point.occurredAt.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
    }),
    value: point.observedValue,
    mean: point.meanValue,
    plus1sd: point.meanValue + point.standardDeviation,
    minus1sd: point.meanValue - point.standardDeviation,
    plus2sd: point.meanValue + point.standardDeviation * 2,
    minus2sd: point.meanValue - point.standardDeviation * 2,
    plus3sd: point.meanValue + point.standardDeviation * 3,
    minus3sd: point.meanValue - point.standardDeviation * 3,
  }));
}
