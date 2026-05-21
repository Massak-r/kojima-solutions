import type { DocFolder } from "@/api/adminDocs";

export const DOC_CATEGORIES = [
  "Général", "Contrats", "Comptabilité", "Impôts", "Assurances", "RH", "Juridique", "Divers",
];

export const YEAR_OPTIONS = (() => {
  const current = new Date().getFullYear();
  const years: number[] = [];
  for (let y = current; y >= current - 6; y--) years.push(y);
  return years;
})();

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + " o";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " Ko";
  return (bytes / 1024 / 1024).toFixed(1) + " Mo";
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-CH", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Read a picked file fully into memory immediately. Android revokes the
 * temporary content URI behind a `File` after any `await` gap (e.g. while a
 * dialog is open), which makes the upload fail. Materialising the bytes right
 * away — before the dialog interaction — keeps the file readable.
 */
export async function bufferFile(file: File): Promise<File> {
  const buf = await file.arrayBuffer();
  return new File([buf], file.name, { type: file.type, lastModified: file.lastModified });
}

/**
 * Flattens the folder tree into `{ id, label }` entries with indented full
 * paths (e.g. "Assurances / 2026"), sorted alphabetically — ready for a
 * `<Select>` of filing destinations.
 */
export function folderOptions(folders: DocFolder[]): { id: string; label: string }[] {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const pathOf = (f: DocFolder): string => {
    const parts: string[] = [f.name];
    let parentId = f.parentId;
    let guard = 0;
    while (parentId && guard++ < 20) {
      const parent = byId.get(parentId);
      if (!parent) break;
      parts.unshift(parent.name);
      parentId = parent.parentId;
    }
    return parts.join(" / ");
  };
  return folders
    .map((f) => ({ id: f.id, label: pathOf(f) }))
    .sort((a, b) => a.label.localeCompare(b.label, "fr"));
}
