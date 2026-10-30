// Educational constant-price path. No guarantee-period, fees, financing or settlement model.
export function accumulatorModel(
  level: number,
  days: number,
  initial = 226.87,
) {
  if (
    !Number.isFinite(level) ||
    level < 0 ||
    level > 130 ||
    !Number.isInteger(days) ||
    days < 1 ||
    days > 60
  )
    throw Error("Invalid accumulator scenario");
  const strike = initial * 0.88,
    price = (initial * level) / 100,
    knockedOut = level >= 105,
    daily = knockedOut ? 0 : level < 88 ? 80 : 40;
  return Array.from({ length: days + 1 }, (_, day) => ({
    day,
    shares: day * daily,
    cost: day * daily * strike,
    value: day * daily * price,
  }));
}
