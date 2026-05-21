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

/** Largest PDF the upload endpoint (admin_docs.php) will accept. */
export const MAX_PDF_SIZE = 25 * 1024 * 1024;

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
 * Merges several PDF files into one, preserving the given order. `pdf-lib` is
 * imported on demand so it stays out of the main bundle — it only loads the
 * first time a user assembles a multi-PDF document.
 */
export async function mergePdfs(files: File[], outputName = "document.pdf"): Promise<File> {
  const { PDFDocument } = await import("pdf-lib");
  const merged = await PDFDocument.create();
  for (const file of files) {
    const src = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
    const pages = await merged.copyPages(src, src.getPageIndices());
    pages.forEach((page) => merged.addPage(page));
  }
  const bytes = await merged.save();
  return new File([bytes], outputName, { type: "application/pdf" });
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
