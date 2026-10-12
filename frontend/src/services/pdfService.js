/**
 * Exports a DOM element as a PDF.
 * @param {string} elementId - ID of the element to capture
 * @param {string} filename - Output filename (without .pdf)
 */
export async function exportElementToPDF(elementId, filename = "sentimind-report") {
  const element = document.getElementById(elementId);
  if (!element) throw new Error(`Element #${elementId} not found`);

  // Loaded on demand so the PDF libraries are not part of the initial bundle.
  const [{ jsPDF }, { default: html2canvas }] = await Promise.all([
    import("jspdf"),
    import("html2canvas"),
  ]);

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
  });

  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth - 20;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  // Add header
  pdf.setFontSize(18);
  pdf.setTextColor(74, 101, 74); // sage-600
  pdf.text("SentiMind Wellness Report", 10, 15);
  pdf.setFontSize(10);
  pdf.setTextColor(120, 113, 108); // warm-500
  pdf.text(`Generated: ${new Date().toLocaleDateString()}`, 10, 22);
  pdf.setDrawColor(197, 216, 197); // sage-200
  pdf.line(10, 25, pageWidth - 10, 25);

  // Add captured content
  let yPos = 30;
  if (yPos + imgHeight > pageHeight - 15) {
    // Split across pages if content is tall
    let remainingHeight = imgHeight;
    let sourceY = 0;
    while (remainingHeight > 0) {
      const sliceHeight = Math.min(remainingHeight, pageHeight - yPos - 15);
      const sliceCanvas = document.createElement("canvas");
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = (sliceHeight * canvas.width) / imgWidth;
      const ctx = sliceCanvas.getContext("2d");
      ctx.drawImage(canvas, 0, sourceY, canvas.width, sliceCanvas.height, 0, 0, canvas.width, sliceCanvas.height);
      pdf.addImage(sliceCanvas.toDataURL("image/png"), "PNG", 10, yPos, imgWidth, sliceHeight);
      remainingHeight -= sliceHeight;
      sourceY += sliceCanvas.height;
      yPos = 15;
      if (remainingHeight > 0) pdf.addPage();
    }
  } else {
    pdf.addImage(imgData, "PNG", 10, yPos, imgWidth, imgHeight);
  }

  // Footer
  const pageCount = pdf.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(168, 162, 158);
    pdf.text(
      "SentiMind · For informational purposes only · Not a substitute for professional care",
      10,
      pageHeight - 8
    );
    pdf.text(`Page ${i} of ${pageCount}`, pageWidth - 30, pageHeight - 8);
  }

  pdf.save(`${filename}.pdf`);
}
