import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  parseTaifexSmallTxOi,
  parseTaifexNightQuote,
  parseTaifexSessionQuotes,
  parseTaifexInstitutionalOiRows,
  parseTaifexSmallTxMarketOiRows,
  fetchTaifexOfficialInstitutionalOiRows,
  fetchTaifexOfficialRetailSentiment,
  fetchTaifexOfficialSessionRows,
  fetchTaifexSmallTxRetailSentiment,
  fetchTaifexNightSession,
  clearTaifexCache,
} from "../../../modules/providers/taifexProvider.mjs";

describe("Phase 3: TAIFEX Data Provider (taifexProvider)", () => {
  beforeEach(() => {
    clearTaifexCache();
    vi.restoreAllMocks();
  });

  describe("3.1 小台指三大法人未平倉與全市場 OI 解析器 (parseTaifexSmallTxOi)", () => {
    it("正確解析小台三大法人與全市場數據並計算散戶多空比 RSR", () => {
      // 模擬期交所查詢結果數據
      const mockTaifexData = {
        totalOi: 92450,
        dealersNetOi: 3200, // 自營商小台淨部位
        sitcNetOi: -1100, // 投信小台淨部位
        finetNetOi: 18400, // 外資小台淨部位
      };

      const result = parseTaifexSmallTxOi(mockTaifexData);

      expect(result.totalOi).toBe(92450);
      expect(result.institutionalNetOi).toBe(3200 + -1100 + 18400); // 20500
      expect(result.retailNetOi).toBe(-20500); // 散戶 = -法人
      // RSR = (-20500 / 92450) * 100 = -22.17%
      expect(result.rsr).toBeCloseTo(-22.17, 2);
    });

    it("全市場 OI 為 0 或無效時回傳安全預設值，不噴錯崩潰", () => {
      const result = parseTaifexSmallTxOi({
        totalOi: 0,
        dealersNetOi: 0,
        sitcNetOi: 0,
        finetNetOi: 0,
      });

      expect(result.totalOi).toBe(0);
      expect(result.institutionalNetOi).toBe(0);
      expect(result.retailNetOi).toBe(0);
      expect(result.rsr).toBe(0);
    });
  });

  describe("3.2 TAIFEX 日盤三大法人未平倉解析器", () => {
    it("加總 MXF 三大法人淨未平倉，缺少全市場方向性 OI 時 RSR 為 null", () => {
      const result = parseTaifexInstitutionalOiRows({
        rows: [
          {
            商品名稱: "小型臺指期貨",
            身份別: "自營商",
            多空未平倉口數淨額: "-11221",
          },
          {
            商品名稱: "小型臺指期貨",
            身份別: "投信",
            多空未平倉口數淨額: "-25",
          },
          {
            商品名稱: "小型臺指期貨",
            身份別: "外資及陸資",
            多空未平倉口數淨額: "2104",
          },
        ],
      });

      expect(result.institutionalNetOi).toBe(-9142);
      expect(result.totalDirectionalOi).toBeNull();
      expect(result.rsr).toBeNull();
      expect(result.dataStatus).toBe("INSUFFICIENT_TOTAL_OI");
    });
  });

  describe("3.3 TAIFEX 全市場小台未平倉解析器", () => {
    it("只加總 MXF 一般交易時段的未沖銷契約數，忽略盤後與其他契約", () => {
      const result = parseTaifexSmallTxMarketOiRows({
        rows: [
          {
            契約: "MTX",
            "到期月份(週別)": "202610",
            交易時段: "一般",
            未沖銷契約數: "20051",
          },
          {
            契約: "MTX",
            "到期月份(週別)": "202610",
            交易時段: "盤後",
            未沖銷契約數: "",
          },
          {
            契約: "MTX",
            "到期月份(週別)": "202610W4",
            交易時段: "一般",
            未沖銷契約數: "19",
          },
          {
            契約: "TX",
            "到期月份(週別)": "202610",
            交易時段: "一般",
            未沖銷契約數: "999999",
          },
        ],
      });

      expect(result.totalOi).toBe(20070);
      expect(result.dataStatus).toBe("VERIFIED");
    });

    it("沒有有效日盤未平倉量時回傳 null", () => {
      const result = parseTaifexSmallTxMarketOiRows({ rows: [] });

      expect(result.totalOi).toBeNull();
      expect(result.dataStatus).toBe("UNAVAILABLE");
    });
  });

  describe("3.4 TAIFEX 日盤與夜盤行情列解析器", () => {
    it("從同一 MTX 合約的一般與盤後列建立日盤到夜盤變化率", () => {
      const result = parseTaifexSessionQuotes({
        rows: [
          {
            契約: "MTX",
            "到期月份(週別)": "202610",
            收盤價: "46379",
            交易時段: "一般",
          },
          {
            契約: "MTX",
            "到期月份(週別)": "202610",
            收盤價: "46701",
            交易時段: "盤後",
          },
        ],
      });

      expect(result.contract).toBe("MTX");
      expect(result.deliveryMonth).toBe("202610");
      expect(result.daySessionClose).toBe(46379);
      expect(result.close).toBe(46701);
      expect(result.dayToNightChangePct).toBeCloseTo(0.00694, 5);
      expect(result.dataStatus).toBe("VERIFIED");
    });

    it("缺少盤後列時標示資料不足，不回傳假夜盤報酬率", () => {
      const result = parseTaifexSessionQuotes({
        rows: [
          {
            契約: "MTX",
            "到期月份(週別)": "202610",
            收盤價: "46379",
            交易時段: "一般",
          },
        ],
      });

      expect(result.daySessionClose).toBe(46379);
      expect(result.close).toBeNull();
      expect(result.dayToNightChangePct).toBeNull();
      expect(result.dataStatus).toBe("UNAVAILABLE");
    });
  });

  describe("3.3 台指夜盤報價解析器 (parseTaifexNightQuote)", () => {
    it("正確解析夜盤最新價、漲跌點數與百分比", () => {
      const mockQuote = {
        close: 22100,
        referencePrice: 22350, // 昨收
      };

      const result = parseTaifexNightQuote(mockQuote);

      expect(result.close).toBe(22100);
      expect(result.change).toBe(-250);
      // changePct = -250 / 22350 = -0.01118 (-1.12%)
      expect(result.changePct).toBeCloseTo(-0.0112, 4);
    });

    it("同時提供日盤收盤價時，計算日盤到夜盤的變化率", () => {
      const result = parseTaifexNightQuote({
        close: 46701,
        referencePrice: 46769,
        daySessionClose: 46379,
      });

      expect(result.changePct).toBeCloseTo(-0.00145, 5);
      expect(result.daySessionClose).toBe(46379);
      expect(result.dayToNightChangePct).toBeCloseTo(0.00694, 5);
    });

    it("缺少日盤收盤價時，日盤到夜盤變化率必須標示為 null", () => {
      const result = parseTaifexNightQuote({
        close: 22000,
        referencePrice: 22350,
      });

      expect(result.dayToNightChangePct).toBeNull();
    });

    it("缺乏昨收參考價時保留價格，但變化率標示為 null", () => {
      const result = parseTaifexNightQuote({
        close: 22000,
        referencePrice: 0,
        daySessionClose: 21900,
      });

      expect(result.close).toBe(22000);
      expect(result.change).toBeNull();
      expect(result.changePct).toBeNull();
      expect(result.dayToNightChangePct).toBeCloseTo(0.00457, 5);
    });
  });

  describe("3.4 官方三大法人 CSV fetcher", () => {
    it("以 MXF 下載官方法人未平倉 rows", async () => {
      const csv =
        "日期,商品名稱,身份別,多空未平倉口數淨額\r\n2026/10/20,小型臺指期貨,自營商,-11221\r\n";
      const requestFn = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => new TextEncoder().encode(csv).buffer,
      });

      const result = await fetchTaifexOfficialInstitutionalOiRows({
        dateStr: "2026-10-20",
        requestFn,
      });

      expect(requestFn).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: "https://www.taifex.com.tw/cht/3/futContractsDateDown",
          fields: expect.objectContaining({
            queryStartDate: "2026/10/20",
            queryEndDate: "2026/10/20",
            commodityId: "MXF",
          }),
        }),
      );
      expect(result.rows[0].身份別).toBe("自營商");
    });
  });

  describe("3.5 官方資料合併與 RSR", () => {
    it("合併全市場 MTX 未平倉與 MXF 法人未平倉，計算非三大法人淨部位比率", async () => {
      const marketRows = [
        { 契約: "MTX", 交易時段: "一般", 未沖銷契約數: "20051" },
      ];
      const institutionalRows = [
        {
          商品名稱: "小型臺指期貨",
          身份別: "自營商",
          多空未平倉口數淨額: "-11221",
        },
        { 商品名稱: "小型臺指期貨", 身份別: "投信", 多空未平倉口數淨額: "-25" },
        {
          商品名稱: "小型臺指期貨",
          身份別: "外資及陸資",
          多空未平倉口數淨額: "2104",
        },
      ];
      const result = await fetchTaifexOfficialRetailSentiment({
        dateStr: "2026-10-20",
        marketRowsFetcher: vi.fn().mockResolvedValue({ rows: marketRows }),
        institutionalRowsFetcher: vi
          .fn()
          .mockResolvedValue({ rows: institutionalRows }),
      });

      expect(result.totalOi).toBe(20051);
      expect(result.institutionalNetOi).toBe(-9142);
      expect(result.rsr).toBeCloseTo(45.59, 2);
      expect(result.dataStatus).toBe("VERIFIED");
    });

    it("任一官方資料缺失時保留 null，不以 0 偽裝正常", async () => {
      const result = await fetchTaifexOfficialRetailSentiment({
        dateStr: "2026-10-21",
        marketRowsFetcher: vi.fn().mockResolvedValue({ rows: [] }),
        institutionalRowsFetcher: vi.fn().mockResolvedValue({ rows: [] }),
      });

      expect(result.rsr).toBeNull();
      expect(result.dataStatus).toBe("UNAVAILABLE");
    });
  });

  describe("3.6 官方行情 CSV fetcher", () => {
    it("以 POST 參數下載並將 CP950 CSV 轉成行情 rows", async () => {
      const csv =
        "契約,到期月份(週別),交易時段,收盤價\r\nMTX,202610,一般,46379\r\nMTX,202610,盤後,46701\r\n";
      const requestFn = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => new TextEncoder().encode(csv).buffer,
      });

      const result = await fetchTaifexOfficialSessionRows({
        dateStr: "2026-10-20",
        requestFn,
      });

      expect(requestFn).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: "https://www.taifex.com.tw/cht/3/futDataDown",
          fields: expect.objectContaining({
            down_type: "1",
            commodity_id: "MTX",
            queryStartDate: "2026/10/20",
            queryEndDate: "2026/10/20",
          }),
        }),
      );
      expect(result.rows).toHaveLength(2);
      expect(result.rows[1].交易時段).toBe("盤後");
      expect(result.rows[1].收盤價).toBe("46701");
    });

    it("官方回應非 2xx 時保留來源錯誤", async () => {
      await expect(
        fetchTaifexOfficialSessionRows({
          dateStr: "2026-10-20",
          requestFn: vi.fn().mockResolvedValue({ ok: false, status: 503 }),
        }),
      ).rejects.toThrow("TAIFEX futDataDown HTTP 503");
    });
  });

  describe("3.7 網路抓取與快取降級 (fetchTaifexSmallTxRetailSentiment & fetchTaifexNightSession)", () => {
    it("成功取得並緩存小台指散戶多空比", async () => {
      const mockFetcher = vi.fn().mockResolvedValue({
        totalOi: 80000,
        dealersNetOi: 1000,
        sitcNetOi: 0,
        finetNetOi: 9000, // 法人合計 10000 -> 散戶 -10000
      });

      const data = await fetchTaifexSmallTxRetailSentiment({
        dateStr: "2026-10-20",
        fetcherFn: mockFetcher,
      });

      expect(mockFetcher).toHaveBeenCalledTimes(1);
      expect(data.rsr).toBe(-12.5); // (-10000 / 80000) * 100

      // 第二次呼叫命中 cache，不應再次觸發 mockFetcher
      const cached = await fetchTaifexSmallTxRetailSentiment({
        dateStr: "2026-10-20",
        fetcherFn: mockFetcher,
      });
      expect(mockFetcher).toHaveBeenCalledTimes(1);
      expect(cached.rsr).toBe(-12.5);
    });

    it("網路失敗且無快取時回傳 null 資料狀態，不以 0 偽裝正常", async () => {
      const failingFetcher = vi
        .fn()
        .mockRejectedValue(new Error("TAIFEX 504 Gateway Timeout"));

      const data = await fetchTaifexSmallTxRetailSentiment({
        dateStr: "2026-10-21",
        fetcherFn: failingFetcher,
      });

      expect(data.rsr).toBeNull();
      expect(data.totalOi).toBeNull();
      expect(data.dataStatus).toBe("SOURCE_UNAVAILABLE");
      expect(data.isFallback).toBe(true);
    });

    it("未提供 legacy fetcher 時，使用兩個官方資料 fetcher 合併 RSR", async () => {
      const marketRequestFn = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () =>
          new TextEncoder().encode(
            "契約,交易時段,未沖銷契約數\r\nMTX,一般,20051\r\n",
          ).buffer,
      });
      const institutionalRequestFn = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () =>
          new TextEncoder().encode(
            "商品名稱,身份別,多空未平倉口數淨額\r\n小型臺指期貨,自營商,-9142\r\n",
          ).buffer,
      });

      const data = await fetchTaifexSmallTxRetailSentiment({
        dateStr: "2026-10-22",
        marketRequestFn,
        institutionalRequestFn,
      });

      expect(marketRequestFn).toHaveBeenCalledTimes(1);
      expect(institutionalRequestFn).toHaveBeenCalledTimes(1);
      expect(data.rsr).toBeCloseTo(45.59, 2);
      expect(data.dataStatus).toBe("VERIFIED");
    });

    it("夜盤抓取失敗時回傳 null 資料狀態，不以 0 偽裝正常", async () => {
      const failingNightFetcher = vi
        .fn()
        .mockRejectedValue(new Error("Network offline"));

      const data = await fetchTaifexNightSession({
        fetcherFn: failingNightFetcher,
      });

      expect(data.changePct).toBeNull();
      expect(data.dayToNightChangePct).toBeNull();
      expect(data.dataStatus).toBe("SOURCE_UNAVAILABLE");
      expect(data.isFallback).toBe(true);
    });

    it("將官方行情列解析為雷達使用的日盤到夜盤變化率", async () => {
      const data = await fetchTaifexNightSession({
        fetcherFn: vi.fn().mockResolvedValue({
          rows: [
            {
              契約: "MTX",
              "到期月份(週別)": "202610",
              收盤價: "46379",
              交易時段: "一般",
            },
            {
              契約: "MTX",
              "到期月份(週別)": "202610",
              收盤價: "46701",
              交易時段: "盤後",
            },
          ],
        }),
      });

      expect(data.dayToNightChangePct).toBeCloseTo(0.00694, 5);
      expect(data.dataStatus).toBe("VERIFIED");
    });

    it("官方行情缺少盤後列時標示不可用", async () => {
      const data = await fetchTaifexNightSession({
        fetcherFn: vi.fn().mockResolvedValue({
          rows: [
            {
              契約: "MTX",
              "到期月份(週別)": "202610",
              收盤價: "46379",
              交易時段: "一般",
            },
          ],
        }),
      });

      expect(data.dayToNightChangePct).toBeNull();
      expect(data.dataStatus).toBe("UNAVAILABLE");
    });

    it("未提供自訂 fetcher 時使用官方 futDataDown requestFn", async () => {
      const requestFn = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () =>
          new TextEncoder().encode(
            "契約,到期月份(週別),交易時段,收盤價\r\nMTX,202610,一般,46379\r\nMTX,202610,盤後,46701\r\n",
          ).buffer,
      });

      const data = await fetchTaifexNightSession({
        dateStr: "2026-10-20",
        requestFn,
      });

      expect(requestFn).toHaveBeenCalledTimes(1);
      expect(data.dayToNightChangePct).toBeCloseTo(0.00694, 5);
      expect(data.dataStatus).toBe("VERIFIED");
    });
  });
});
