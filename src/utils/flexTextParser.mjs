/**
 * 將 Markdown 轉為 LINE Flex spans
 * 支援：
 * - **粗體**
 * - 同一行多段粗體
 * - 自動合併相鄰普通文字 span
 */
export function parseMarkdownToSpans(text, { normalColor = "#333333", boldColor = "#111111" } = {}) {
  if (!text) return [];

  const s = String(text);

  // match **...** (non-greedy)
  const boldRegex = /\*\*(.+?)\*\*/g;

  const spans = [];
  let lastIndex = 0;
  let match;

  const pushSpan = (span) => {
    if (!span?.text) return;

    // 合併相鄰的「普通 span」（避免 spans 太碎）
    const prev = spans[spans.length - 1];
    const isPrevNormal = prev && !prev.weight && !prev.decoration && prev.color === normalColor;
    const isThisNormal = !span.weight && !span.decoration && span.color === normalColor;

    if (isPrevNormal && isThisNormal) {
      prev.text += span.text;
      return;
    }

    spans.push(span);
  };

  while ((match = boldRegex.exec(s)) !== null) {
    // 普通文字
    if (match.index > lastIndex) {
      pushSpan({
        type: "span",
        text: s.substring(lastIndex, match.index),
        color: normalColor,
      });
    }

    // 粗體文字（match[1]）
    pushSpan({
      type: "span",
      text: match[1],
      weight: "bold",
      color: boldColor,
    });

    lastIndex = boldRegex.lastIndex;
  }

  // 剩餘普通文字
  if (lastIndex < s.length) {
    pushSpan({
      type: "span",
      text: s.substring(lastIndex),
      color: normalColor,
    });
  }

  // 最後防呆：把單顆 * 之類的符號移除（避免 LLM 亂出星號）
  for (const sp of spans) {
    sp.text = sp.text.replace(/\*/g, "");
  }

  return spans;
}

/**
 * 把整段文字拆成多個 Flex text 元件（每行一個）
 * - 支援 "- " 清單轉換成 "◦ "
 * - 忽略空行
 * - 可選：第一行（📌）視覺強化
 */
export function buildFlexTextBlocks(rawText, opt = {}) {
  const {
    textSize = "xs",
    margin = "sm",
    normalColor = "#333333",
    boldColor = "#111111",
    bullet = "◦",
    highlightFirstLine = true,
  } = opt;

  if (!rawText) return [];

  const lines = String(rawText)
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  return lines.map((line, idx) => {
    // 清單美化：只處理 "- " 或 "• "
    const cleanLine = line.replace(/^(?:•|-)\s+/, `${bullet} `);

    const contents = parseMarkdownToSpans(cleanLine, { normalColor, boldColor });

    // LINE Flex Text：使用 spans 時用 contents，不要同時塞 text
    const base = {
      type: "text",
      contents,
      wrap: true,
      size: textSize,
      margin,
    };

    // 可選：第一行（通常是 📌）突出一點
    if (highlightFirstLine && idx === 0) {
      return {
        ...base,
        size: "sm",
        weight: "bold",
        color: "#111111",
      };
    }

    return base;
  });
}