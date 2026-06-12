// 从上传的文件中提取纯文本。支持 .txt/.md、.pdf、.docx
// 提取后的文本会交给 AI 做结构化解析（复用经历库导入流程）。

export async function extractTextFromFile(file) {
  const name = (file.name || '').toLowerCase();

  if (name.endsWith('.pdf')) {
    return extractPdf(file);
  }
  if (name.endsWith('.docx')) {
    return extractDocx(file);
  }
  if (name.endsWith('.txt') || name.endsWith('.md')) {
    return file.text();
  }
  if (name.endsWith('.doc')) {
    throw new Error('暂不支持旧版 .doc，请另存为 .docx 或粘贴文本');
  }
  // 兜底：当作纯文本读
  return file.text();
}

async function extractPdf(file) {
  const pdfjsLib = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const parts = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    // 按 y 坐标粗略还原换行
    let lastY = null;
    let line = '';
    const lines = [];
    for (const item of content.items) {
      const y = item.transform[5];
      if (lastY !== null && Math.abs(y - lastY) > 3) {
        lines.push(line);
        line = '';
      }
      line += item.str;
      lastY = y;
    }
    if (line) lines.push(line);
    parts.push(lines.join('\n'));
  }
  return parts.join('\n\n');
}

async function extractDocx(file) {
  const mammoth = (await import('mammoth/mammoth.browser.js')).default;
  const buf = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buf });
  return result.value || '';
}
