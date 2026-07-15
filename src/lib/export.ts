import * as XLSX from "xlsx";

/**
 * Export items to CSV and XLSX (§7.8).
 * Columns: code, name, brand, model, category, type, status, condition,
 *          quantity, min quantity, location, holder, last activity, notes.
 *
 * Client-side — no server round-trip. The data is the currently filtered
 * item set passed from the Items view.
 */

type ExportItem = {
  code: string;
  name: string;
  brand: string | null;
  model: string | null;
  categoryName: string | null;
  trackingType: string;
  status: string;
  condition: string;
  quantity: number;
  minQuantity: number;
  currentLocationName: string | null;
  holderName: string | null;
  notes?: string | null;
  updatedAt: string | Date;
};

const COLUMNS = [
  { key: "code", label: "Code" },
  { key: "name", label: "Name" },
  { key: "brand", label: "Brand" },
  { key: "model", label: "Model" },
  { key: "categoryName", label: "Category" },
  { key: "trackingType", label: "Type" },
  { key: "status", label: "Status" },
  { key: "condition", label: "Condition" },
  { key: "quantity", label: "Quantity" },
  { key: "minQuantity", label: "Min Quantity" },
  { key: "currentLocationName", label: "Location" },
  { key: "holderName", label: "Holder" },
  { key: "updatedAt", label: "Last Activity" },
  { key: "notes", label: "Notes" },
];

function toRows(items: ExportItem[]): Record<string, string | number>[] {
  return items.map((item) => {
    const row: Record<string, string | number> = {};
    for (const col of COLUMNS) {
      const val = item[col.key as keyof ExportItem];
      if (col.key === "updatedAt") {
        row[col.label] = new Date(val).toLocaleString("en-SG");
      } else if (col.key === "status" || col.key === "condition") {
        row[col.label] = String(val).replace(/_/g, " ");
      } else if (col.key === "trackingType") {
        row[col.label] = val === "asset" ? "Asset" : "Stock";
      } else {
        row[col.label] = (val as string | number | null) ?? "";
      }
    }
    return row;
  });
}

export function exportToCSV(items: ExportItem[], filename: string): void {
  const rows = toRows(items);
  const ws = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(ws);
  downloadBlob(csv, `${filename}.csv`, "text/csv;charset=utf-8;");
}

export function exportToXLSX(items: ExportItem[], filename: string): void {
  const rows = toRows(items);
  const ws = XLSX.utils.json_to_sheet(rows);

  // Set column widths
  ws["!cols"] = COLUMNS.map((col) => ({
    wch: Math.max(col.label.length + 2, 12),
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Items");
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  downloadBlob(blob, `${filename}.xlsx`, blob.type);
}

function downloadBlob(content: string | Blob, filename: string, type: string): void {
  const blob =
    content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
