export const fmtPKR = (n: number | null | undefined) => {
  const v = Number(n ?? 0);
  return "PKR " + v.toLocaleString("en-PK", { maximumFractionDigits: 2 });
};

export const fmtDate = (d: string | Date | null | undefined) => {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

export const todayISO = () => new Date().toISOString().slice(0, 10);
