import fs from "fs";
import path from "path";

export function SaveTmpFile(data, typeName, fileName) {
  try {
    // 1. 定義資料夾路徑與檔案路徑
    const tmpDir = path.join(process.cwd(), "tmp");
    const tempFilePath = path.join(tmpDir, `${fileName}.json`);

    // 2. 確保資料夾存在 (recursive: true 代表如果父資料夾不存在也會一併建立)
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }

    // 3. 寫入檔案
    fs.writeFileSync(tempFilePath, JSON.stringify(data, null, 2), "utf8");
    console.log(`\n📝 [Debug] ${typeName} 已導出至: ${tempFilePath}`);
  } catch (err) {
    console.warn(`⚠️ 無法寫入暫存 ${typeName} 檔案:`, err.message);
  }
}
