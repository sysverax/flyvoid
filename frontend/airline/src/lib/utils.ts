export function cn(...inputs: (string | boolean | undefined | null)[]) {
  return inputs.filter(Boolean).join(" ");
}

export function sortData<T>(
  data: T[],
  sortField: keyof T | null,
  sortOrder: "asc" | "desc",
  dateFields: (keyof T)[] = []
): T[] {
  if (!sortField) return data;

  return [...data].sort((a, b) => {
    let valA: any = a[sortField];
    let valB: any = b[sortField];

    if (valA === valB) return 0;
    if (valA === null || valA === undefined) return 1;
    if (valB === null || valB === undefined) return -1;

    if (dateFields.includes(sortField)) {
      const parseDate = (dStr: any) => {
        if (!dStr) return 0;
        if (typeof dStr === "number") return dStr;
        if (typeof dStr !== "string") return 0;
        const parts = dStr.split("/");
        if (parts.length === 3) {
          const [day, month, year] = parts.map(Number);
          return new Date(year, month - 1, day).getTime() || 0;
        }
        return new Date(dStr).getTime() || 0;
      };
      valA = parseDate(valA);
      valB = parseDate(valB);
    }

    if (typeof valA === "number" && typeof valB === "number") {
      return sortOrder === "asc" ? valA - valB : valB - valA;
    }

    // Currency or numeric string parsing (e.g. "$1,200.50", "– $50.00", "+ $100.00")
    if (typeof valA === "string" && typeof valB === "string") {
      const cleanA = valA.replace(/[^0-9.-]+/g, "");
      const cleanB = valB.replace(/[^0-9.-]+/g, "");
      const isNumA = cleanA !== "" && !isNaN(Number(cleanA));
      const isNumB = cleanB !== "" && !isNaN(Number(cleanB));

      if (isNumA && isNumB && (valA.includes("$") || valB.includes("$"))) {
        const numA = Number(cleanA) * (valA.includes("–") || valA.includes("-") ? -1 : 1);
        const numB = Number(cleanB) * (valB.includes("–") || valB.includes("-") ? -1 : 1);
        return sortOrder === "asc" ? numA - numB : numB - numA;
      }

      // Natural alphanumeric comparison (e.g. "WTX-1", "WTX-2", "WTX-10")
      const comparison = valA.localeCompare(valB, undefined, {
        numeric: true,
        sensitivity: "base",
      });
      return sortOrder === "asc" ? comparison : -comparison;
    }

    const strA = String(valA).toLowerCase();
    const strB = String(valB).toLowerCase();

    if (strA < strB) return sortOrder === "asc" ? -1 : 1;
    if (strA > strB) return sortOrder === "asc" ? 1 : -1;
    return 0;
  });
}

export function formatUtcStartDate(dateStr?: string): string | undefined {
  if (!dateStr) return undefined;
  const parts = dateStr.split("-").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return undefined;
  const [year, month, day] = parts;
  const date = new Date(year, month - 1, day, 0, 0, 0, 0);
  return isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function formatUtcEndDate(dateStr?: string): string | undefined {
  if (!dateStr) return undefined;
  const parts = dateStr.split("-").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return undefined;
  const [year, month, day] = parts;
  const date = new Date(year, month - 1, day + 1, 0, 0, 0, 0);
  return isNaN(date.getTime()) ? undefined : date.toISOString();
}

