// 文本清洗：去掉行首项目符号/序号、制表符、多余空白。
// 导入提取和「整理经历库」都用这个，保证规则一致。

export function cleanText(str) {
  if (!str) return '';
  return String(str)
    // normalize whitespace and remove zero-width / BOM / NBSP
    .replace(/[\t ]+/g, ' ')
    .replace(/\u200B|\uFEFF/g, '')
    .replace(/\u00A0/g, ' ')
    .replace(/^[\s•·‣◦▪▫■●○◆◇*\-–—>·]+/, '')
    .replace(/^\s*[（(]?\d+[)）.、]\s*/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// 归一化用于比较（去空格、转小写、去标点），用于重复检测
export function normalizeForCompare(str) {
  return cleanText(str)
    .toLowerCase()
    .replace(/[\s,，.。、:：;；|/\\()（）]/g, '');
}
