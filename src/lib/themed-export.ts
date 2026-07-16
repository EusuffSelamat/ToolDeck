/**
 * TOOLDECK — Themed Excel Export
 *
 * Generates a 3-sheet .xlsx workbook matching the §10 dark teal glass aesthetic:
 *   Sheet 1: Dashboard Summary (stats + branded header)
 *   Sheet 2: Items (grouped by location, color-coded status, photo links)
 *   Sheet 3: Activity Log (all transactions)
 *
 * Uses exceljs (dynamically imported for code-splitting).
 * Photos are fetched, compressed to 48x48px thumbnails (~1-2KB each),
 * and embedded as images — minimal file size impact.
 */

// ── Theme colours (§10) ──────────────────────────────────────────────────
const THEME = {
  bg0: "FF030A0A",          // page background
  bg1: "FF061111",          // raised surface
  glass: "FF0A1A1A",        // card fill
  glassStrong: "FF0E2221",  // sheet/card
  hairline: "FF7EDED2",     // borders (with alpha)
  teal: "FF19E3C4",          // primary
  tealBright: "FF6BFFE9",   // glow cores
  tealDeep: "FF0E4F4A",     // chart tracks
  gold: "FFC9A063",          // selection / checked out
  magenta: "FFE06FB2",       // needs service / low stock
  danger: "FFE0566B",        // out of order
  textHi: "FFEAF7F4",       // primary text
  textMid: "FF9FBDB8",      // secondary text
  textLow: "FF6E8D89",      // muted text
};

// Status → fill colour mapping (dark variants to match the theme)
const STATUS_FILL: Record<string, string> = {
  available: THEME.tealDeep,       // #0E4F4A — dark teal
  checked_out: "FF3D2E12",         // dark gold/bronze
  needs_service: "FF4A1E38",       // dark magenta
  out_of_order: "FF3A1218",        // dark red
  // Condition values (shared mapping)
  good: THEME.tealDeep,
};

const STATUS_TEXT: Record<string, string> = {
  available: THEME.teal,            // bright teal text on dark teal bg
  checked_out: THEME.gold,          // bright gold text on dark gold bg
  needs_service: THEME.magenta,     // bright magenta text on dark magenta bg
  out_of_order: THEME.danger,       // bright red text on dark red bg
  good: THEME.teal,
};

// ── Types ────────────────────────────────────────────────────────────────
export type ExportItem = {
  id: string;
  code: string;
  name: string;
  brand: string | null;
  model: string | null;
  serialNo: string | null;
  categoryName: string | null;
  trackingType: string;
  status: string;
  condition: string;
  quantity: number;
  photoUrl: string | null;
  homeLocationId: string | null;
  currentLocationId: string | null;
  currentLocationName: string | null;
  currentLocationParentName: string | null;
  homeLocationName: string | null;
  homeLocationParentName: string | null;
  holderId: string | null;
  holderName: string | null;
  expectedReturnDate: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedByName: string | null;
  updatedAt: string;
  notes: string | null;
};

export type ExportLocation = {
  id: string;
  name: string;
  kind: string;
  parentLocationId: string | null;
  parentName: string | null;
  childrenCount: number;
  itemCount: number;
  directItemCount: number;
  homeItemCount: number;
  awayCount: number;
};

export type ExportTransaction = {
  id: string;
  action: string;
  qtyDelta: number | null;
  note: string | null;
  createdAt: string;
  itemCode: string | null;
  itemName: string | null;
  personName: string | null;
  holderName: string | null;
  fromLocationName: string | null;
  toLocationName: string | null;
};

export type ExportStats = {
  totalItems: number;
  available: number;
  checkedOut: number;
  needsService: number;
  outOfOrder: number;
  overdueReturns: number;
  byCategory: Array<{ name: string; count: number }>;
  byLocation: Array<{ id: string; name: string; kind: string; count: number }>;
};

export type ExportData = {
  items: ExportItem[];
  locations: ExportLocation[];
  transactions: ExportTransaction[];
  stats: ExportStats;
  filterDescription: string;
};

// ── Main export function ────────────────────────────────────────────────
export async function generateThemedExport(
  data: ExportData,
  filename: string
): Promise<void> {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "TOOLDECK";
  workbook.created = new Date();

  // Sheet 1: Dashboard Summary
  buildSummarySheet(workbook, data);

  // Sheet 2: Items (grouped by location)
  buildItemsSheet(workbook, data.items);

  // Sheet 3: Activity Log (was Sheet 4 — Locations sheet removed per request)
  buildActivitySheet(workbook, data.transactions);

  // Generate + download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Sheet 1: Dashboard Summary ──────────────────────────────────────────
function buildSummarySheet(workbook: any, data: ExportData) {
  const ws = workbook.addWorksheet("Summary", {
    properties: { tabColor: THEME.teal.slice(2) },
  });

  ws.views = [{ showGridLines: false }];

  // Set column widths
  ws.columns = [
    { width: 4 }, { width: 28 }, { width: 14 }, { width: 14 },
    { width: 14 }, { width: 14 }, { width: 14 }, { width: 4 },
  ];

  // Fill background for used range
  const fillBg = (row: number, col: number) => {
    const cell = ws.getCell(row, col);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME.bg0 } };
  };

  // Branded header
  ws.mergeCells("B2:G2");
  const titleCell = ws.getCell("B2");
  titleCell.value = "TOOLDECK";
  titleCell.font = { name: "Space Grotesk", size: 28, bold: true, color: { argb: THEME.teal } };
  titleCell.alignment = { horizontal: "left", vertical: "middle" };
  ws.getRow(2).height = 40;

  ws.mergeCells("B3:G3");
  const subtitleCell = ws.getCell("B3");
  subtitleCell.value = "Inventory Platform · Export Report";
  subtitleCell.font = { name: "Inter", size: 11, color: { argb: THEME.textLow } };
  subtitleCell.alignment = { horizontal: "left", vertical: "middle" };

  ws.mergeCells("B4:G4");
  const dateCell = ws.getCell("B4");
  dateCell.value = `Exported: ${new Date().toLocaleString("en-SG", {
    day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  })}`;
  dateCell.font = { name: "Inter", size: 10, color: { argb: THEME.textMid } };

  ws.mergeCells("B5:G5");
  const filterCell = ws.getCell("B5");
  filterCell.value = `Scope: ${data.filterDescription} · ${data.items.length} items · ${data.transactions.length} transactions`;
  filterCell.font = { name: "Inter", size: 10, color: { argb: THEME.textMid } };

  // Stats section
  ws.getRow(7).height = 8; // spacer

  const statDefs = [
    { label: "TOTAL", value: data.stats.totalItems, color: THEME.teal },
    { label: "AVAILABLE", value: data.stats.available, color: THEME.teal },
    { label: "CHECKED OUT", value: data.stats.checkedOut, color: THEME.gold },
    { label: "NEEDS SERVICE", value: data.stats.needsService, color: THEME.magenta },
    { label: "OVERDUE", value: data.stats.overdueReturns, color: THEME.danger },
  ];

  statDefs.forEach((stat, i) => {
    const col = i + 2; // columns B-G
    const labelCell = ws.getCell(8, col);
    labelCell.value = stat.label;
    labelCell.font = { name: "Inter", size: 8, bold: true, color: { argb: THEME.textLow } };
    labelCell.alignment = { horizontal: "center", vertical: "middle" };
    labelCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME.glass } };
    labelCell.border = {
      top: { style: "thin", color: { argb: THEME.hairline } },
      left: { style: "thin", color: { argb: THEME.hairline } },
      right: { style: "thin", color: { argb: THEME.hairline } },
    };

    const valueCell = ws.getCell(9, col);
    valueCell.value = stat.value;
    valueCell.font = { name: "Space Grotesk", size: 22, bold: true, color: { argb: stat.color } };
    valueCell.alignment = { horizontal: "center", vertical: "middle" };
    valueCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME.glass } };
    valueCell.border = {
      left: { style: "thin", color: { argb: THEME.hairline } },
      right: { style: "thin", color: { argb: THEME.hairline } },
      bottom: { style: "thin", color: { argb: THEME.hairline } },
    };
  });
  ws.getRow(9).height = 36;

  // Category breakdown
  ws.getRow(11).height = 8; // spacer

  const catHeaderCell = ws.getCell("B12");
  catHeaderCell.value = "BY CATEGORY";
  catHeaderCell.font = { name: "Inter", size: 9, bold: true, color: { argb: THEME.textLow } };

  data.stats.byCategory.forEach((cat, i) => {
    const row = 13 + i;
    const nameCell = ws.getCell(row, 2);
    nameCell.value = cat.name;
    nameCell.font = { name: "Inter", size: 11, color: { argb: THEME.textHi } };
    nameCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME.bg1 } };
    nameCell.border = { bottom: { style: "hair", color: { argb: THEME.hairline } } };

    const countCell = ws.getCell(row, 3);
    countCell.value = cat.count;
    countCell.font = { name: "Space Grotesk", size: 12, bold: true, color: { argb: THEME.teal } };
    countCell.alignment = { horizontal: "center" };
    countCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME.bg1 } };
    countCell.border = { bottom: { style: "hair", color: { argb: THEME.hairline } } };

    // Visual bar — single merged cell with proportional fill
    const maxCount = data.stats.byCategory[0]?.count || 1;
    const barPct = (cat.count / maxCount);
    ws.mergeCells(row, 4, row, 7);
    const barCell = ws.getCell(row, 4);
    barCell.value = "";
    barCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME.tealDeep } };
    barCell.border = { bottom: { style: "hair", color: { argb: THEME.hairline } } };

    // Overlay a proportional fill by setting the cell value to a bar string
    const barChars = Math.round(barPct * 20);
    barCell.value = "█".repeat(barChars) + "░".repeat(20 - barChars);
    barCell.font = { name: "Consolas", size: 9, color: { argb: THEME.teal } };
    barCell.alignment = { horizontal: "left", vertical: "middle" };
  });

  // Fill background for all used cells
  const maxRow = Math.max(13 + data.stats.byCategory.length, 20);
  for (let r = 1; r <= maxRow; r++) {
    for (let c = 1; c <= 8; c++) {
      const cell = ws.getCell(r, c);
      if (!cell.fill || cell.fill.type !== "pattern") {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME.bg0 } };
      }
    }
  }
}

// ── Sheet 2: Items (grouped by location) ────────────────────────────────
function buildItemsSheet(workbook: any, items: ExportItem[]) {
  const ws = workbook.addWorksheet("Items", {
    properties: { tabColor: THEME.teal.slice(2) },
  });

  ws.views = [{ showGridLines: false }];

  const columns = [
    { header: "Photo", key: "photo", width: 8 },
    { header: "Code", key: "code", width: 12 },
    { header: "Name", key: "name", width: 24 },
    { header: "Brand", key: "brand", width: 14 },
    { header: "Model", key: "model", width: 14 },
    { header: "Serial", key: "serial", width: 14 },
    { header: "Category", key: "category", width: 16 },
    { header: "Type", key: "type", width: 8 },
    { header: "Status", key: "status", width: 14 },
    { header: "Condition", key: "condition", width: 14 },
    { header: "Qty", key: "qty", width: 6 },
    { header: "Home Location", key: "homeLoc", width: 16 },
    { header: "Parent", key: "homeParent", width: 14 },
    { header: "Current Location", key: "currLoc", width: 16 },
    { header: "Parent", key: "currParent", width: 14 },
    { header: "Holder", key: "holder", width: 14 },
    { header: "Expected Return", key: "returnDate", width: 14 },
    { header: "Created", key: "created", width: 14 },
    { header: "Created By", key: "createdBy", width: 14 },
    { header: "Updated", key: "updated", width: 14 },
    { header: "Updated By", key: "updatedBy", width: 14 },
    { header: "Notes", key: "notes", width: 30 },
  ];

  ws.columns = columns;

  // Group items by current location
  const grouped = new Map<string, ExportItem[]>();
  const noLocation: ExportItem[] = [];
  for (const item of items) {
    const key = item.currentLocationName ?? "__no_location__";
    if (key === "__no_location__") {
      noLocation.push(item);
    } else {
      const arr = grouped.get(key) ?? [];
      arr.push(item);
      grouped.set(key, arr);
    }
  }

  let row = 1;

  // Styled header helper
  const styleHeader = (cell: any) => {
    cell.font = { name: "Inter", size: 9, bold: true, color: { argb: THEME.textLow } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME.glassStrong } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: THEME.hairline } },
      bottom: { style: "thin", color: { argb: THEME.hairline } },
      left: { style: "thin", color: { argb: THEME.hairline } },
      right: { style: "thin", color: { argb: THEME.hairline } },
    };
  };

  // Column headers
  for (let c = 1; c <= columns.length; c++) {
    styleHeader(ws.getCell(row, c));
  }
  ws.getRow(row).height = 24;
  row++;

  // Location groups
  for (const [locationName, locationItems] of grouped) {
    // Location group header
    ws.mergeCells(row, 1, row, columns.length);
    const groupCell = ws.getCell(row, 1);
    groupCell.value = `📍 ${locationName} · ${locationItems.length} item${locationItems.length === 1 ? "" : "s"}`;
    groupCell.font = { name: "Inter", size: 11, bold: true, color: { argb: THEME.teal } };
    groupCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME.tealDeep } };
    groupCell.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
    ws.getRow(row).height = 22;
    row++;

    // Item rows
    for (const item of locationItems) {
      writeItemRow(ws, row, item);
      row++;
    }
  }

  // No-location group
  if (noLocation.length > 0) {
    ws.mergeCells(row, 1, row, columns.length);
    const groupCell = ws.getCell(row, 1);
    groupCell.value = `📍 No location · ${noLocation.length} item${noLocation.length === 1 ? "" : "s"}`;
    groupCell.font = { name: "Inter", size: 11, bold: true, color: { argb: THEME.textLow } };
    groupCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME.bg1 } };
    groupCell.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
    ws.getRow(row).height = 22;
    row++;

    for (const item of noLocation) {
      writeItemRow(ws, row, item);
      row++;
    }
  }

  // Fill background for all cells
  for (let r = 1; r <= row; r++) {
    for (let c = 1; c <= columns.length; c++) {
      const cell = ws.getCell(r, c);
      if (!cell.fill || cell.fill.type !== "pattern") {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME.bg0 } };
      }
    }
  }
}

function writeItemRow(
  ws: any,
  row: number,
  item: ExportItem,
) {
  const isAlt = row % 2 === 0;
  const rowBg = isAlt ? THEME.bg0 : THEME.glass;
  const rowHeight = 28;

  // Photo: include as a clickable hyperlink — must be absolute URL for Excel
  if (item.photoUrl) {
    const photoCell = ws.getCell(row, 1);
    const absoluteUrl = item.photoUrl.startsWith("http")
      ? item.photoUrl
      : `${window.location.origin}${item.photoUrl}`;
    photoCell.value = { text: "📷 View", hyperlink: absoluteUrl };
    photoCell.font = { name: "Inter", size: 9, color: { argb: THEME.teal }, underline: true };
    photoCell.alignment = { horizontal: "center", vertical: "middle" };
  }

  const values: Record<string, string | number | null> = {
    code: item.code,
    name: item.name,
    brand: item.brand ?? "",
    model: item.model ?? "",
    serial: item.serialNo ?? "",
    category: item.categoryName ?? "Uncategorised",
    type: item.trackingType === "asset" ? "Asset" : "Stock",
    status: item.status.replace(/_/g, " "),
    condition: item.condition.replace(/_/g, " "),
    qty: item.quantity,
    homeLoc: item.homeLocationName ?? "—",
    homeParent: item.homeLocationParentName ?? "",
    currLoc: item.currentLocationName ?? "—",
    currParent: item.currentLocationParentName ?? "",
    holder: item.holderName ?? "—",
    returnDate: item.expectedReturnDate
      ? new Date(item.expectedReturnDate).toLocaleDateString("en-SG")
      : "",
    created: new Date(item.createdAt).toLocaleDateString("en-SG"),
    createdBy: item.createdByName ?? "—",
    updated: new Date(item.updatedAt).toLocaleDateString("en-SG"),
    updatedBy: item.updatedByName ?? "—",
    notes: item.notes ?? "",
  };

  for (let c = 2; c <= 22; c++) {
    const cell = ws.getCell(row, c);
    // Column 1 = Photo (handled above), so column 2 = columns[1] (Code)
    const key = columns[c - 1]?.key;
    if (key && key in values) {
      cell.value = values[key];
    }
    cell.font = { name: "Inter", size: 10, color: { argb: THEME.textHi } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: rowBg } };
    cell.alignment = { vertical: "middle", wrapText: false };
    cell.border = {
      bottom: { style: "hair", color: { argb: THEME.hairline } },
    };
  }

  // Photo cell background
  const photoCell = ws.getCell(row, 1);
  photoCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: rowBg } };

  // Color-code status cell (column 9)
  const statusCell = ws.getCell(row, 9);
  const statusFill = STATUS_FILL[item.status] ?? THEME.bg1;
  statusCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: statusFill } };
  statusCell.font = {
    name: "Inter", size: 10, bold: true,
    color: { argb: STATUS_TEXT[item.status] ?? THEME.textHi },
  };
  statusCell.alignment = { horizontal: "center", vertical: "middle" };

  // Color-code condition cell (column 10)
  const condCell = ws.getCell(row, 10);
  const condFill = STATUS_FILL[item.condition] ?? THEME.bg1;
  condCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: condFill } };
  condCell.font = {
    name: "Inter", size: 10, bold: true,
    color: { argb: STATUS_TEXT[item.condition] ?? THEME.textHi },
  };
  condCell.alignment = { horizontal: "center", vertical: "middle" };

  ws.getRow(row).height = rowHeight;
}

// Column definitions for writeItemRow
const columns = [
  { key: "photo" }, { key: "code" }, { key: "name" }, { key: "brand" },
  { key: "model" }, { key: "serial" }, { key: "category" }, { key: "type" },
  { key: "status" }, { key: "condition" }, { key: "qty" }, { key: "min" },
  { key: "homeLoc" }, { key: "homeParent" }, { key: "currLoc" }, { key: "currParent" },
  { key: "holder" }, { key: "returnDate" }, { key: "created" }, { key: "createdBy" },
  { key: "updated" }, { key: "updatedBy" }, { key: "notes" },
];

// ── Sheet 3: Activity Log ───────────────────────────────────────────────
function buildActivitySheet(workbook: any, transactions: ExportTransaction[]) {
  const ws = workbook.addWorksheet("Activity", {
    properties: { tabColor: THEME.teal.slice(2) },
  });

  ws.views = [{ showGridLines: false }];

  ws.columns = [
    { width: 4 }, { width: 18 }, { width: 14 }, { width: 12 },
    { width: 22 }, { width: 16 }, { width: 16 }, { width: 16 },
    { width: 16 }, { width: 8 }, { width: 30 },
  ];

  // Header
  const headers = [
    "", "Date", "Time", "Action", "Item", "Code",
    "Person", "Holder", "From → To", "Qty", "Note",
  ];
  for (let c = 1; c <= headers.length; c++) {
    const cell = ws.getCell(1, c);
    cell.value = headers[c - 1];
    cell.font = { name: "Inter", size: 9, bold: true, color: { argb: THEME.textLow } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME.glassStrong } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin", color: { argb: THEME.hairline } },
      bottom: { style: "thin", color: { argb: THEME.hairline } },
    };
  }
  ws.getRow(1).height = 22;

  const ACTION_COLORS: Record<string, string> = {
    add: THEME.teal,
    checkout: THEME.gold,
    checkin: THEME.teal,
    move: THEME.teal,
    adjust_qty: THEME.tealBright,
    condition: THEME.magenta,
    edit: THEME.textLow,
    delete: THEME.danger,
    restore: THEME.teal,
    maintenance: THEME.magenta,
  };

  transactions.forEach((tx, i) => {
    const row = i + 2;
    const isAlt = row % 2 === 0;
    const rowBg = isAlt ? THEME.bg0 : THEME.glass;
    const date = new Date(tx.createdAt);

    const fromTo = [tx.fromLocationName, tx.toLocationName]
      .filter(Boolean)
      .join(" → ");

    const values = [
      "",
      date.toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" }),
      date.toLocaleTimeString("en-SG", { hour: "2-digit", minute: "2-digit", hour12: false }),
      tx.action.replace(/_/g, " "),
      tx.itemName ?? "—",
      tx.itemCode ?? "—",
      tx.personName ?? "—",
      tx.holderName ?? "",
      fromTo,
      tx.qtyDelta !== null ? (tx.qtyDelta > 0 ? `+${tx.qtyDelta}` : `${tx.qtyDelta}`) : "",
      tx.note ?? "",
    ];

    for (let c = 1; c <= values.length; c++) {
      const cell = ws.getCell(row, c);
      cell.value = values[c - 1];
      cell.font = { name: "Inter", size: 10, color: { argb: THEME.textHi } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: rowBg } };
      cell.alignment = { vertical: "middle", wrapText: false };
      cell.border = { bottom: { style: "hair", color: { argb: THEME.hairline } } };
    }

    // Color-code action cell
    const actionCell = ws.getCell(row, 4);
    const actionColor = ACTION_COLORS[tx.action] ?? THEME.textLow;
    actionCell.font = { name: "Inter", size: 10, bold: true, color: { argb: actionColor } };

    // Color-code item code
    const codeCell = ws.getCell(row, 6);
    codeCell.font = { name: "Inter", size: 10, color: { argb: THEME.teal } };

    ws.getRow(row).height = 20;
  });

  // Fill background
  const maxRow = transactions.length + 1;
  for (let r = 1; r <= maxRow; r++) {
    for (let c = 1; c <= 11; c++) {
      const cell = ws.getCell(r, c);
      if (!cell.fill || cell.fill.type !== "pattern") {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME.bg0 } };
      }
    }
  }
}

// ── Filename helper ─────────────────────────────────────────────────────
export function buildExportFilename(filterName: string): string {
  const date = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  return `tooldeckitems.${filterName}.${date}.xlsx`;
}
