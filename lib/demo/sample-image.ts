/**
 * Loads the bundled demo weld sample (manual-derived SVG) and rasterizes to PNG
 * for the vision API (jpeg/png/webp only).
 */
export async function loadDemoWeldSample(
  imagePath = "/demo/sample-weld-porosity.svg",
): Promise<{ base64: string; mimeType: "image/png"; previewUrl: string }> {
  const res = await fetch(imagePath);
  if (!res.ok) {
    throw new Error(`Failed to load demo sample image (${res.status})`);
  }
  const svgText = await res.text();
  const blob = new Blob([svgText], { type: "image/svg+xml" });
  const previewUrl = URL.createObjectURL(blob);

  const base64 = await rasterizeSvgToPng(svgText);
  return { base64, mimeType: "image/png", previewUrl };
}

function rasterizeSvgToPng(svgText: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const svgBlob = new Blob([svgText], { type: "image/svg+xml" });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      const width = 640;
      const height = 360;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("Canvas not available"));
        return;
      }
      ctx.fillStyle = "#1a1a1a";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL("image/png");
      URL.revokeObjectURL(url);
      const base64 = dataUrl.split(",")[1];
      if (!base64) {
        reject(new Error("Failed to encode demo image"));
        return;
      }
      resolve(base64);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to decode demo SVG"));
    };

    img.src = url;
  });
}
