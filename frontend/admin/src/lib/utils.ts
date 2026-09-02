import { countries } from "countries-list";
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

    // Handle custom date sorting for fields in dateFields (format DD/MM/YYYY or standard)
    if (dateFields.includes(sortField)) {
      const parseDate = (dStr: any) => {
        if (typeof dStr !== "string") return 0;
        const parts = dStr.split("/");
        if (parts.length === 3) {
          const [day, month, year] = parts.map(Number);
          return new Date(year, month - 1, day).getTime();
        }
        return new Date(dStr).getTime() || 0;
      };
      valA = parseDate(valA);
      valB = parseDate(valB);
    }

    if (typeof valA === "number" && typeof valB === "number") {
      return sortOrder === "asc" ? valA - valB : valB - valA;
    }

    const strA = String(valA).toLowerCase();
    const strB = String(valB).toLowerCase();

    if (strA < strB) return sortOrder === "asc" ? -1 : 1;
    if (strA > strB) return sortOrder === "asc" ? 1 : -1;
    return 0;
  });
}

export const getCountryCode = (countryName: string): string => {
  const entry = Object.entries(countries).find(
    ([_, c]) => c.name.toLowerCase() === countryName.toLowerCase()
  );
  return entry ? entry[0] : "US";
};

export const formatDate = (dateStr?: string) => {
  if (!dateStr) return "N/A";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "N/A";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};
