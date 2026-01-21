import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";

// 1. 取得並處理私鑰 (自動修復格式問題)
let privateKey = process.env.GOOGLE_PRIVATE_KEY || "";
if (privateKey.includes("\\n")) {
  privateKey = privateKey.replace(/\\n/g, '\n');
}
if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
  privateKey = privateKey.slice(1, -1);
}

// 2. 初始化驗證
const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: privateKey,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

async function getSheetDoc() {
  const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);
  await doc.loadInfo();
  return doc;
}

/**
 * 讀取「資產紀錄」（第一張表）的最後一筆有效紀錄
 * 用途：獲取你手動更新的最新持股狀態
 */
async function fetchLastPortfolioState() {
  try {
    const doc = await getSheetDoc();
    // ★ 鎖定第一張表 (index 0) 作為「讀取來源」
    const sheet = doc.sheetsByIndex[0];
    const rows = await sheet.getRows();

    if (rows.length === 0) {
      console.log("⚠️ 資產紀錄表為空，將使用預設值");
      return null;
    }

    // 倒序尋找最後一筆有日期的紀錄
    let lastRow = null;
    for (let i = rows.length - 1; i >= 0; i--) {
      const dateCell = rows[i].get('日期');
      if (dateCell && dateCell.trim() !== '') {
        lastRow = rows[i];
        break;
      }
    }

    if (!lastRow) {
      console.log("⚠️ 找不到有效持股紀錄，將使用預設值");
      return null;
    }

    console.log(`✅ 讀取持股來源: [${sheet.title}] 日期: ${lastRow.get('日期')}`);

    // 解析數值
    let loan = lastRow.get('借貸總額');
    if (typeof loan === 'string') loan = loan.replace(/,/g, '').trim();
    if (loan === '無借貸' || !loan || isNaN(parseFloat(loan))) loan = 0;

    let cash = lastRow.get('現金儲備'); // 記得在第一張表也要加這個欄位
    if (typeof cash === 'string') cash = cash.replace(/,/g, '').trim();
    const cashValue = (cash && !isNaN(parseFloat(cash)))
      ? parseFloat(cash)
      : parseFloat(process.env.CASH_RESERVE || 0);

    return {
      qty0050: parseFloat(lastRow.get('0050股數') || 0),
      qtyZ2: parseFloat(lastRow.get('00675L股數') || 0),
      totalLoan: parseFloat(loan),
      cash: cashValue
    };
  } catch (err) {
    console.error("❌ 讀取持股失敗:", err);
    return null;
  }
}

/**
 * 將每日戰報寫入到「通知紀錄」工作表
 * 如果工作表不存在，會自動建立
 */
async function logDailyToSheet(data) {
  try {
    const doc = await getSheetDoc();
    const targetSheetTitle = '通知紀錄'; // ★ 指定寫入的目標名稱

    let sheet = doc.sheetsByTitle[targetSheetTitle];

    // 如果「通知紀錄」分頁不存在，自動建立並加上標題
    if (!sheet) {
      console.log(`🆕 發現新需求，正在建立 [${targetSheetTitle}] 分頁...`);
      sheet = await doc.addSheet({ title: targetSheetTitle });
      await sheet.setHeaderRow([
        '日期',
        '0050股數', '00675L股數',
        '0050市值', '00675L市值',
        '借貸總額', '現金儲備',
        '維持率（%）',
        '總淨資產', '正2占總資產比例',
        '正2應賣出金額', '備註'
      ]);
    }

    const rows = await sheet.getRows();

    // 格式化日期
    const today = new Date();
    const dateStr = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}`;

    // 計算數值
    const val0050 = Math.round(data.portfolio.qty0050 * data.price0050);
    const valZ2 = Math.round(data.portfolio.qtyZ2 * data.currentPrice);
    const loan = data.portfolio.totalLoan;
    const cash = data.portfolio.cash || 0;
    const netAsset = val0050 + valZ2 - loan + cash;

    let marginStr = '無借貸';
    if (loan > 0) {
      marginStr = data.maintenanceMargin.toFixed(2) + '%';
    }

    let sellAmount = 0;
    if (data.z2Ratio > 42) {
      const targetZ2Value = netAsset * 0.4;
      sellAmount = Math.round(valZ2 - targetZ2Value);
    }

    const rowData = {
      '日期': dateStr,
      '0050股數': data.portfolio.qty0050,
      '00675L股數': data.portfolio.qtyZ2,
      '0050市值': val0050,
      '00675L市值': valZ2,
      '借貸總額': loan === 0 ? '無借貸' : loan,
      '現金儲備': cash,
      '維持率（%）': marginStr,
      '總淨資產': netAsset,
      '正2占總資產比例': (data.z2Ratio / 100).toFixed(3),
      '正2應賣出金額': sellAmount,
      '備註': data.suggestion
    };

    // ★ 檢查「通知紀錄」的最後一行是否為今天 (防止重複寫入)
    const lastRow = rows[rows.length - 1];

    if (lastRow && lastRow.get('日期') === dateStr) {
      console.log(`🔄 [${targetSheetTitle}] 今天已有資料，執行更新...`);
      lastRow.assign(rowData);
      await lastRow.save();
    } else {
      console.log(`📝 [${targetSheetTitle}] 新增今日紀錄...`);
      await sheet.addRow(rowData);
    }

    console.log("✅ 通知紀錄已同步");

  } catch (err) {
    console.error("❌ 寫入通知紀錄失敗:", err);
  }
}

export { fetchLastPortfolioState, logDailyToSheet };