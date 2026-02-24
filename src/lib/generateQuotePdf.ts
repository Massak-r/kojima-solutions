import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import type { Quote } from "@/types/quote";

/**
 * Generate PDF from the preview DOM element so the PDF looks exactly like the on-screen preview.
 */
export async function generateQuotePdfFromElement(
  element: HTMLElement,
  quote: Quote
): Promise<void> {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: "#ffffff",
    width: element.scrollWidth,
    height: element.scrollHeight,
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
    logging: false,
  });

  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgW = canvas.width;
  const imgH = canvas.height;
  // Fit image to one page: match aspect ratio, scale to fit within A4
  let w = pageWidth;
  let h = (imgH / imgW) * pageWidth;
  if (h > pageHeight) {
    h = pageHeight;
    w = (imgW / imgH) * pageHeight;
  }
  const x = (pageWidth - w) / 2;
  const y = (pageHeight - h) / 2;

  pdf.addImage(imgData, "PNG", x, y, w, h);
  pdf.save(`Devis-${quote.quoteNumber.replace(/\s/g, "-")}.pdf`);
}
