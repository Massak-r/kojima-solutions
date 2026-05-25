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

// Re-export from the central date helpers so callers don't have to know two
// utility paths. Same output ("05 nov 2026") as before.
export { formatDateShortWithYear as formatDate } from "@/lib/dateFormat";

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

const IMAGE_PAGE_MAX = 1200; // px on the longest side — keeps PDFs lean

/** True when the file is a JPEG/PNG/WebP/HEIC the browser can handle. */
export function isImage(f: File): boolean {
  return /^image\//.test(f.type) || /\.(jpe?g|png|webp|heic|heif)$/i.test(f.name);
}

/** Decode an image File into an ImageBitmap (or HTMLImageElement fallback)
 *  so we can read its natural pixel dimensions. */
async function loadImage(file: File): Promise<{ width: number; height: number; bitmap: ImageBitmap | HTMLImageElement }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      return { width: bitmap.width, height: bitmap.height, bitmap };
    } catch {
      /* fall through to <img> */
    }
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight, bitmap: img });
      URL.revokeObjectURL(url);
    };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

/** Re-encode an image to JPEG at a sane size via canvas — keeps the PDF
 *  page light enough for the 25 Mo upload limit even on phone-camera shots. */
async function downscaleImage(file: File): Promise<{ bytes: ArrayBuffer; width: number; height: number; mime: string }> {
  const { width: srcW, height: srcH, bitmap } = await loadImage(file);
  const longest = Math.max(srcW, srcH);
  const scale = longest > IMAGE_PAGE_MAX ? IMAGE_PAGE_MAX / longest : 1;
  const w = Math.round(srcW * scale);
  const h = Math.round(srcH * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(bitmap as CanvasImageSource, 0, 0, w, h);
  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/jpeg", 0.85);
  });
  return { bytes: await blob.arrayBuffer(), width: w, height: h, mime: "image/jpeg" };
}

/** Wrap one or several images (jpg/png/heic) into a single PDF, one image per
 *  page, preserving the order. Used by the triage scan zone so a mobile photo
 *  flows through the same PDF-only pipeline. */
export async function imagesToPdf(files: File[], outputName = "scan.pdf"): Promise<File> {
  const { PDFDocument } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  for (const file of files) {
    const { bytes, width, height } = await downscaleImage(file);
    const img = await pdf.embedJpg(new Uint8Array(bytes));
    const page = pdf.addPage([width, height]);
    page.drawImage(img, { x: 0, y: 0, width, height });
  }
  const out = await pdf.save();
  return new File([out], outputName, { type: "application/pdf" });
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
