export const parseStrictPositiveInt = (
  value: unknown,
  defaultValue: number,
): unknown => {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    return value;
  }

  return Number(trimmed);
};
