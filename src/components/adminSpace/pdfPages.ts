/**
 * Page-level PDF helpers for the admin scan editor.
 *
 * Two libraries, two jobs — both imported on demand so they stay out of the
 * main bundle and only land the first time someone opens the page editor:
 *   • pdfjs-dist → renders page thumbnails to a canvas (pdf-lib cannot render).
 *   • pdf-lib    → re-assembles the chosen pages, in order, with rotations.
 *
 * Everything runs client-side; scanned documents never leave the device.
 */

// ── pdfjs (rendering) ──────────────────────────────────────────────

/** Minimal slice of the pdfjs API we use — avoids leaning on pdfjs's own
 *  (sometimes shifting) exported types while staying type-safe at call sites. */
interface Viewport {
  width: number;
  height: number;
}
interface RenderPage {
  getViewport(params: { scale: number }): Viewport;
  render(params: { canvasContext: CanvasRenderingContext2D; viewport: Viewport }): { promise: Promise<void> };
  cleanup(): void;
}
export interface RenderDoc {
  numPages: number;
  getPage(pageNumber: number): Promise<RenderPage>;
  destroy(): Promise<void>;
}

type PdfjsModule = typeof import("pdfjs-dist");
let pdfjsPromise: Promise<PdfjsModule> | null = null;

/** Loads pdfjs once and points it at its web worker. Vite emits the worker as a
 *  hashed asset thanks to the `?url` import, so it's cached independently. */
async function getPdfjs(): Promise<PdfjsModule> {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjs = await import("pdfjs-dist");
      const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      return pdfjs;
    })();
  }
  return pdfjsPromise;
}

/** Opens a PDF for rendering. pdfjs detaches (transfers) the bytes it's handed
 *  to the worker, so we give it a private copy — the caller keeps the original
 *  intact for pdf-lib assembly afterwards. */
export async function openForRender(bytes: ArrayBuffer): Promise<RenderDoc> {
  const pdfjs = await getPdfjs();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes) }).promise;
  return doc as unknown as RenderDoc;
}

/** Renders one page (1-based) to a JPEG data URL roughly `targetWidth` px wide. */
export async function renderThumbnail(
  doc: RenderDoc,
  pageNumber: number,
  targetWidth = 220,
): Promise<string> {
  const page = await doc.getPage(pageNumber);
  const unscaled = page.getViewport({ scale: 1 });
  const scale = targetWidth / unscaled.width;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Contexte canvas 2D indisponible");
  await page.render({ canvasContext: ctx, viewport }).promise;
  const url = canvas.toDataURL("image/jpeg", 0.72);
  page.cleanup();
  return url;
}

// ── pdf-lib (assembly) ─────────────────────────────────────────────

/** One page in the working set: which source it came from, its original index
 *  there, and any extra rotation the user applied (0/90/180/270). */
export interface PageRef {
  srcId: string;
  pageIndex: number; // 0-based, within its source document
  rotation: number;  // degrees added on top of the page's own rotation
}

/** Builds a single PDF from the given pages, in order, applying rotations.
 *  Pages may interleave across sources — each source is loaded once and reused. */
export async function assemblePdf(
  pages: PageRef[],
  sources: Map<string, ArrayBuffer>,
  outputName: string,
): Promise<File> {
  const { PDFDocument, degrees } = await import("pdf-lib");
  const out = await PDFDocument.create();
  const cache = new Map<string, Awaited<ReturnType<typeof PDFDocument.load>>>();

  const loadSource = async (srcId: string) => {
    let doc = cache.get(srcId);
    if (!doc) {
      const bytes = sources.get(srcId);
      if (!bytes) throw new Error("Source PDF introuvable");
      doc = await PDFDocument.load(bytes.slice(0), { ignoreEncryption: true });
      cache.set(srcId, doc);
    }
    return doc;
  };

  for (const p of pages) {
    const src = await loadSource(p.srcId);
    const [copied] = await out.copyPages(src, [p.pageIndex]);
    const extra = (((p.rotation % 360) + 360) % 360);
    if (extra !== 0) {
      const current = copied.getRotation().angle;
      copied.setRotation(degrees((current + extra) % 360));
    }
    out.addPage(copied);
  }

  const bytes = await out.save();
  return new File([bytes], outputName, { type: "application/pdf" });
}

/** Triggers a browser download for an in-memory file. */
export function downloadFile(file: File): void {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
