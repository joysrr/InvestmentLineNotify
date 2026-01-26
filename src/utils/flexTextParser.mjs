/**
 * 將 Markdown 語法轉換為 LINE Flex Message 的 spans 結構
 * 支援 **粗體** 轉換，並自動過濾星號
 */
export function parseMarkdownToSpans(text) {
  if (!text) return [];

  // 正規表達式：匹配 **文字**
  const boldRegex = /\*\*(.*?)\*\*/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  // 逐一尋找粗體語法
  while ((match = boldRegex.exec(text)) !== null) {
    // 放入粗體前的普通文字
    if (match.index > lastIndex) {
      parts.push({
        type: "span",
        text: text.substring(lastIndex, match.index),
      });
    }
    // 放入去星號後的粗體文字
    parts.push({
      type: "span",
      text: match[1],
      weight: "bold",
      color: "#000000",
    });
    lastIndex = boldRegex.lastIndex;
  }

  // 放入剩餘的文字
  if (lastIndex < text.length) {
    parts.push({
      type: "span",
      text: text.substring(lastIndex),
    });
  }

  return parts;
}

/**
 * 將整段文字按行拆分，並美化清單符號
 */
export function buildFlexTextBlocks(rawText) {
  const lines = rawText.split('\n');
  return lines.map(line => {
    // 處理清單符號，將 • 或 - 換成更美觀的圖示或間距
    const cleanLine = line.trim().replace(/^[•-]\s?/, " ◦ "); 

    return {
      type: "text",
      contents: parseMarkdownToSpans(cleanLine),
      wrap: true,
      size: "xs",
      color: "#333333",
      margin: "sm",
      lineSpacing: "4px"
    };
  });
}
