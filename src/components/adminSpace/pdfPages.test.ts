import { describe, it, expect } from "vitest";
import { PDFDocument, degrees } from "pdf-lib";
import { assemblePdf, type PageRef } from "./pdfPages";

/** Build an in-memory PDF of `pageCount` pages at the given size. */
async function makePdf(pageCount: number, size: [number, number]): Promise<ArrayBuffer> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) doc.addPage(size);
  const bytes = await doc.save();
  return bytes.slice().buffer; // exact-length ArrayBuffer copy
}

describe("assemblePdf", () => {
  it("reorders pages, applies rotation, and interleaves across sources", async () => {
    const a = await makePdf(3, [200, 300]); // source A: 3 portrait pages
    const b = await makePdf(2, [400, 100]); // source B: 2 landscape pages
    const sources = new Map<string, ArrayBuffer>([["A", a], ["B", b]]);

    // A.page2 (rot 90) → B.page0 → A.page0 (rot 180)
    const pages: PageRef[] = [
      { srcId: "A", pageIndex: 2, rotation: 90 },
      { srcId: "B", pageIndex: 0, rotation: 0 },
      { srcId: "A", pageIndex: 0, rotation: 180 },
    ];

    const file = await assemblePdf(pages, sources, "out.pdf");
    expect(file.type).toBe("application/pdf");
    expect(file.name).toBe("out.pdf");

    const out = await PDFDocument.load(await file.arrayBuffer());
    const [p0, p1, p2] = out.getPages();
    expect(out.getPageCount()).toBe(3);

    // Rotations applied per page
    expect(p0.getRotation().angle).toBe(90);
    expect(p1.getRotation().angle).toBe(0);
    expect(p2.getRotation().angle).toBe(180);

    // Geometry proves order + source: middle page came from B (400×100 landscape)
    expect(Math.round(p1.getWidth())).toBe(400);
    expect(Math.round(p1.getHeight())).toBe(100);
    expect(Math.round(p0.getWidth())).toBe(200); // from A (rotation is metadata, not geometry)
  });

  it("adds the user's rotation on top of a page's existing rotation", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([200, 300]).setRotation(degrees(90));
    const bytes = await doc.save();
    const sources = new Map<string, ArrayBuffer>([["S", bytes.slice().buffer]]);

    const file = await assemblePdf([{ srcId: "S", pageIndex: 0, rotation: 270 }], sources, "r.pdf");
    const out = await PDFDocument.load(await file.arrayBuffer());
    expect(out.getPages()[0].getRotation().angle).toBe(0); // (90 + 270) % 360
  });

  it("extracts a subset in selection order (same path as split/extract)", async () => {
    const a = await makePdf(4, [210, 297]);
    const sources = new Map<string, ArrayBuffer>([["A", a]]);

    // Pull pages 4 and 2 (1-based) → a 2-page document, in that order
    const file = await assemblePdf(
      [{ srcId: "A", pageIndex: 3, rotation: 0 }, { srcId: "A", pageIndex: 1, rotation: 0 }],
      sources,
      "A-extrait.pdf",
    );
    const out = await PDFDocument.load(await file.arrayBuffer());
    expect(out.getPageCount()).toBe(2);
  });
});
