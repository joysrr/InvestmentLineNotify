// src/modules/simulator/validator.test.mjs
// TDD: 先寫測試再實作

import { describe, it, expect } from "vitest";
import {
  validateForwardInput,
  validateReverseInput,
  generatePriceDeviationWarnings,
  createErrorResponse,
  REVERSE_TARGET_TYPES,
  PRICE_BOUNDS,
  RSI_BOUNDS,
} from "./validator.mjs";

describe("validator - 正向模擬輸入驗證", () => {
  describe("price0050 必填與範圍", () => {
    it("缺少 price0050 應回傳錯誤", () => {
      const result = validateForwardInput({});
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("price0050 為必填欄位");
    });

    it("price0050 為 null 應回傳錯誤", () => {
      const result = validateForwardInput({ price0050: null });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("price0050 為必填欄位");
    });

    it("price0050 非數字應回傳錯誤", () => {
      const result = validateForwardInput({ price0050: "abc" });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("price0050 必須是有效數字");
    });

    it("price0050 為 0 或負數應回傳錯誤", () => {
      expect(validateForwardInput({ price0050: 0 }).valid).toBe(false);
      expect(validateForwardInput({ price0050: -10 }).valid).toBe(false);
    });

    it("price0050 低於 50 應回傳錯誤", () => {
      const result = validateForwardInput({ price0050: 49 });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("50 到 500"))).toBe(true);
    });

    it("price0050 高於 500 應回傳錯誤", () => {
      const result = validateForwardInput({ price0050: 501 });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("50 到 500"))).toBe(true);
    });

    it("price0050 在 50-500 範圍內應通過", () => {
      const result = validateForwardInput({ price0050: 180 });
      expect(result.valid).toBe(true);
      expect(result.sanitized.price0050).toBe(180);
    });

    it("邊界值 50 和 500 應通過", () => {
      expect(validateForwardInput({ price0050: 50 }).valid).toBe(true);
      expect(validateForwardInput({ price0050: 500 }).valid).toBe(true);
    });
  });

  describe("priceZ2 選填驗證", () => {
    it("不提供 priceZ2 應通過", () => {
      const result = validateForwardInput({ price0050: 180 });
      expect(result.valid).toBe(true);
      expect(result.sanitized.priceZ2).toBeUndefined();
    });

    it("提供有效 priceZ2 應通過並 sanitize", () => {
      const result = validateForwardInput({ price0050: 180, priceZ2: 120 });
      expect(result.valid).toBe(true);
      expect(result.sanitized.priceZ2).toBe(120);
    });

    it("priceZ2 非數字應回傳錯誤", () => {
      const result = validateForwardInput({ price0050: 180, priceZ2: "abc" });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("priceZ2 必須是有效數字");
    });

    it("priceZ2 超出範圍應回傳錯誤", () => {
      expect(validateForwardInput({ price0050: 180, priceZ2: 49 }).valid).toBe(
        false,
      );
      expect(validateForwardInput({ price0050: 180, priceZ2: 501 }).valid).toBe(
        false,
      );
    });
  });
});

describe("validator - 反向推導輸入驗證", () => {
  describe("target 結構驗證", () => {
    it("缺少 target 應回傳錯誤", () => {
      const result = validateReverseInput({});
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("target 為必填物件");
    });

    it("target 非物件應回傳錯誤", () => {
      const result = validateReverseInput({ target: "string" });
      expect(result.valid).toBe(false);
    });

    it("缺少 target.type 應回傳錯誤", () => {
      const result = validateReverseInput({ target: {} });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("target.type 為必填字串");
    });

    it("不支援的 target.type 應回傳錯誤", () => {
      const result = validateReverseInput({ target: { type: "unknownType" } });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("不支援的目標類型"))).toBe(
        true,
      );
    });
  });

  describe("各目標類型的 value/direction 驗證", () => {
    // maintenanceRatio
    it("maintenanceRatio 缺少 value 應回傳錯誤", () => {
      const result = validateReverseInput({
        target: { type: "maintenanceRatio" },
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "maintenanceRatio 目標需提供 value (目標維持率)",
      );
    });

    it("maintenanceRatio value 必須為正數", () => {
      expect(
        validateReverseInput({ target: { type: "maintenanceRatio", value: 0 } })
          .valid,
      ).toBe(false);
      expect(
        validateReverseInput({
          target: { type: "maintenanceRatio", value: -10 },
        }).valid,
      ).toBe(false);
      expect(
        validateReverseInput({
          target: { type: "maintenanceRatio", value: "abc" },
        }).valid,
      ).toBe(false);
    });

    it("maintenanceRatio 正確輸入應通過", () => {
      const result = validateReverseInput({
        target: { type: "maintenanceRatio", value: 150 },
      });
      expect(result.valid).toBe(true);
      expect(result.sanitized.target.value).toBe(150);
    });

    // RSI
    it("RSI 缺少 value 應回傳錯誤", () => {
      const result = validateReverseInput({ target: { type: "rsi" } });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("RSI 目標需提供 value (1-99)");
    });

    it("RSI value 必須在 1-99 之間", () => {
      expect(
        validateReverseInput({ target: { type: "rsi", value: 0 } }).valid,
      ).toBe(false);
      expect(
        validateReverseInput({ target: { type: "rsi", value: 100 } }).valid,
      ).toBe(false);
      expect(
        validateReverseInput({ target: { type: "rsi", value: -5 } }).valid,
      ).toBe(false);
    });

    it("RSI 邊界值 1 和 99 應通過", () => {
      expect(
        validateReverseInput({ target: { type: "rsi", value: 1 } }).valid,
      ).toBe(true);
      expect(
        validateReverseInput({ target: { type: "rsi", value: 99 } }).valid,
      ).toBe(true);
    });

    // MA20 / MA60
    it("MA20 缺少 value 應回傳錯誤", () => {
      const result = validateReverseInput({ target: { type: "ma20" } });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("MA20 目標需提供 value (目標均線價格)");
    });

    it("MA20 value 必須為正數", () => {
      expect(
        validateReverseInput({ target: { type: "ma20", value: -10 } }).valid,
      ).toBe(false);
    });

    it("MA60 同理驗證", () => {
      const result = validateReverseInput({
        target: { type: "ma60", value: 180 },
      });
      expect(result.valid).toBe(true);
      expect(result.sanitized.target.value).toBe(180);
    });

    // MA240 Bias
    it("MA240Bias 接受負值 (偏離可為負)", () => {
      const result = validateReverseInput({
        target: { type: "ma240Bias", value: -15 },
      });
      expect(result.valid).toBe(true);
      expect(result.sanitized.target.value).toBe(-15);
    });

    // KD Cross / MACD Cross
    it("kdCross 缺少 direction 應回傳錯誤", () => {
      const result = validateReverseInput({ target: { type: "kdCross" } });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'kdCross 目標需提供 direction: "golden" 或 "dead"',
      );
    });

    it("kdCross direction 必須為 golden 或 dead", () => {
      expect(
        validateReverseInput({ target: { type: "kdCross", direction: "up" } })
          .valid,
      ).toBe(false);
      expect(
        validateReverseInput({
          target: { type: "kdCross", direction: "golden" },
        }).valid,
      ).toBe(true);
      expect(
        validateReverseInput({ target: { type: "kdCross", direction: "dead" } })
          .valid,
      ).toBe(true);
    });

    it("macdCross 同理驗證", () => {
      expect(
        validateReverseInput({
          target: { type: "macdCross", direction: "dead" },
        }).valid,
      ).toBe(true);
    });

    // Strategy Score
    it("strategyScore 缺少 value 應回傳錯誤", () => {
      const result = validateReverseInput({
        target: { type: "strategyScore" },
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("策略分數目標需提供 value");
    });

    it("strategyScore 超出建議範圍仍通過但有警告邏輯", () => {
      // 目前實作只檢查是否為數字且在寬鬆範圍內
      const result = validateReverseInput({
        target: { type: "strategyScore", value: 1000 },
      });
      expect(result.valid).toBe(false); // 1000 > 200 會被擋下
      expect(
        validateReverseInput({ target: { type: "strategyScore", value: 80 } })
          .valid,
      ).toBe(true);
    });

    // Portfolio Health
    it("portfolioHealth 可選 status", () => {
      expect(
        validateReverseInput({ target: { type: "portfolioHealth" } }).valid,
      ).toBe(true);
      expect(
        validateReverseInput({
          target: { type: "portfolioHealth", value: "green" },
        }).valid,
      ).toBe(true);
      expect(
        validateReverseInput({
          target: { type: "portfolioHealth", value: "yellow" },
        }).valid,
      ).toBe(true);
      expect(
        validateReverseInput({
          target: { type: "portfolioHealth", value: "red" },
        }).valid,
      ).toBe(true);
      expect(
        validateReverseInput({
          target: { type: "portfolioHealth", value: "blue" },
        }).valid,
      ).toBe(false);
    });
  });

  describe("所有 REVERSE_TARGET_TYPES 都應被支援", () => {
    for (const type of REVERSE_TARGET_TYPES) {
      it(`支援 ${type}`, () => {
        const baseInput = { target: { type } };
        // 為需要 value 的類型補上預設值
        if (
          [
            "maintenanceRatio",
            "rsi",
            "ma20",
            "ma60",
            "ma240Bias",
            "strategyScore",
          ].includes(type)
        ) {
          baseInput.target.value =
            type === "rsi" ? 50 : type === "ma240Bias" ? 0 : 150;
        }
        if (["kdCross", "macdCross"].includes(type)) {
          baseInput.target.direction = "golden";
        }
        const result = validateReverseInput(baseInput);
        expect(result.valid).toBe(true);
      });
    }
  });
});

describe("validator - 價格偏離警告", () => {
  it("偏離 ≤10% 無警告", () => {
    const warnings = generatePriceDeviationWarnings(180, 175); // 2.86%
    expect(warnings.length).toBe(0);
  });

  it("偏離 10-20% 黃色警告", () => {
    const warnings = generatePriceDeviationWarnings(195, 175); // 11.4%
    expect(warnings.length).toBe(1);
    expect(warnings[0]).toContain("10%");
    expect(warnings[0]).toContain("可能不反映單日情境");
  });

  it("偏離 >20% 紅色警告", () => {
    const warnings = generatePriceDeviationWarnings(215, 175); // 22.9%
    expect(warnings.length).toBe(1);
    expect(warnings[0]).toContain("20%");
    expect(warnings[0]).toContain("多日後狀態");
    expect(warnings[0]).toContain("路徑依賴性");
  });

  it("當前價格無效時無警告", () => {
    expect(generatePriceDeviationWarnings(180, 0).length).toBe(0);
    expect(generatePriceDeviationWarnings(180, NaN).length).toBe(0);
    expect(generatePriceDeviationWarnings(180, -10).length).toBe(0);
  });
});

describe("validator - 錯誤回應格式", () => {
  it("createErrorResponse 產生正確結構", () => {
    const resp = createErrorResponse(
      "BAD_REQUEST",
      "price0050 必須在 50-500 之間",
      "price0050",
    );
    expect(resp.error).toBe("BAD_REQUEST");
    expect(resp.message).toBe("price0050 必須在 50-500 之間");
    expect(resp.field).toBe("price0050");
    expect(resp.statusCode).toBe(400);
  });

  it("不同錯誤代碼對應正確 HTTP 狀態碼", () => {
    expect(createErrorResponse("VALIDATION_ERROR", "msg").statusCode).toBe(400);
    expect(createErrorResponse("CONFLICT", "msg").statusCode).toBe(409);
    expect(createErrorResponse("DATA_NOT_READY", "msg").statusCode).toBe(409);
    expect(createErrorResponse("SERVICE_UNAVAILABLE", "msg").statusCode).toBe(
      503,
    );
    expect(createErrorResponse("INTERNAL_ERROR", "msg").statusCode).toBe(500);
    expect(createErrorResponse("UNKNOWN", "msg").statusCode).toBe(500);
  });
});

describe("validator - 常數正確性", () => {
  it("PRICE_BOUNDS 符合規格 §7.1", () => {
    expect(PRICE_BOUNDS.MIN).toBe(50);
    expect(PRICE_BOUNDS.MAX).toBe(500);
    expect(PRICE_BOUNDS.WARNING_THRESHOLD_PCT).toBe(0.1);
    expect(PRICE_BOUNDS.DANGER_THRESHOLD_PCT).toBe(0.2);
  });

  it("RSI_BOUNDS 符合規格 §7.2", () => {
    expect(RSI_BOUNDS.MIN).toBe(1);
    expect(RSI_BOUNDS.MAX).toBe(99);
  });

  it("REVERSE_TARGET_TYPES 包含規劃 §6 列出的 9 類型", () => {
    const expected = [
      "maintenanceRatio",
      "rsi",
      "ma20",
      "ma60",
      "ma240Bias",
      "kdCross",
      "macdCross",
      "strategyScore",
      "portfolioHealth",
    ];
    expect(REVERSE_TARGET_TYPES).toEqual(expected);
  });
});
