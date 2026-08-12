import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  triggerDownload,
  generateFilename,
  arrayToCSV,
  toJSON,
  exportCSV,
  exportJSON,
  exportChartAsImage,
  exportAllFormats,
} from "@/utils/exportUtility.js";

// Mock document.createElement and related DOM APIs
const mockAnchor = {
  href: "",
  download: "",
  click: vi.fn(),
  style: { display: "" },
};

const mockBlob = class MockBlob {
  constructor(content, options) {
    this.content = content;
    this.options = options;
    this.size = content.reduce((sum, c) => sum + c.length, 0);
    this.type = options?.type || "";
  }
  slice() { return this; }
};

const mockURL = {
  createObjectURL: vi.fn(() => "blob:mock-url"),
  revokeObjectURL: vi.fn(),
};

describe("exportUtility.js", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.document = {
      createElement: vi.fn(() => mockAnchor),
      body: {
        appendChild: vi.fn(),
        removeChild: vi.fn(),
      },
    };
    global.URL = mockURL;
    global.Blob = mockBlob;
    global.fetch = vi.fn().mockResolvedValue({
      blob: () => Promise.resolve(new Blob(["mock"], { type: "image/png" })),
    });
  });

  describe("triggerDownload", () => {
    it("creates anchor, sets attributes, clicks, and cleans up", () => {
      const blob = new Blob(["test"], { type: "text/plain" });
      triggerDownload(blob, "test.txt");

      expect(document.createElement).toHaveBeenCalledWith("a");
      expect(mockAnchor.href).toBe("blob:mock-url");
      expect(mockAnchor.download).toBe("test.txt");
      expect(mockAnchor.style.display).toBe("none");
      expect(document.body.appendChild).toHaveBeenCalledWith(mockAnchor);
      expect(mockAnchor.click).toHaveBeenCalled();
      expect(document.body.removeChild).toHaveBeenCalledWith(mockAnchor);
      expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
    });
  });

  describe("generateFilename", () => {
    it("generates filename with timestamp", () => {
      const filename = generateFilename("export", "csv");
      expect(filename).toMatch(/^export-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.csv$/);
    });

    it("uses custom extension", () => {
      const filename = generateFilename("data", "json");
      expect(filename).toMatch(/\.json$/);
    });
  });

  describe("arrayToCSV", () => {
    it("converts array of objects to CSV with header", () => {
      const data = [{ a: 1, b: "x" }, { a: 2, b: "y" }];
      const csv = arrayToCSV(data);
      expect(csv).toContain("a,b");
      expect(csv).toContain("1,x");
      expect(csv).toContain("2,y");
    });

    it("handles custom headers", () => {
      const data = [{ a: 1, b: "x" }];
      const csv = arrayToCSV(data, {
        headers: [{ key: "a", label: "Column A" }],
      });
      expect(csv).toContain("Column A");
      expect(csv).not.toContain("b");
    });

    it("escapes values with commas and quotes", () => {
      const data = [{ a: 'hello, "world"' }];
      const csv = arrayToCSV(data);
      expect(csv).toContain('"hello, ""world"""');
    });

    it("handles null/undefined values", () => {
      const data = [{ a: null, b: undefined }];
      const csv = arrayToCSV(data, { nullValue: "N/A" });
      expect(csv).toContain("N/A");
    });

    it("returns empty string for empty array", () => {
      expect(arrayToCSV([])).toBe("");
    });

    it("supports custom delimiter", () => {
      const data = [{ a: 1, b: 2 }];
      const csv = arrayToCSV(data, { delimiter: ";" });
      expect(csv).toContain("a;b");
      expect(csv).toContain("1;2");
    });

    it("supports disabling header", () => {
      const data = [{ a: 1 }];
      const csv = arrayToCSV(data, { includeHeader: false });
      expect(csv).not.toContain("a");
      expect(csv).toContain("1");
    });
  });

  describe("toJSON", () => {
    it("wraps data with metadata", () => {
      const data = { key: "value" };
      const json = toJSON(data);
      const parsed = JSON.parse(json);
      expect(parsed.data).toEqual(data);
      expect(parsed.metadata).toHaveProperty("exportedAt");
      expect(parsed.metadata.version).toBe("1.0");
    });

    it("includes custom metadata", () => {
      const data = { key: "value" };
      const json = toJSON(data, { metadata: { source: "test" } });
      const parsed = JSON.parse(json);
      expect(parsed.metadata.source).toBe("test");
    });

    it("supports non-pretty output", () => {
      const data = { a: 1 };
      const json = toJSON(data, { pretty: false });
      expect(json).not.toContain("\n");
      expect(json).not.toContain("  ");
    });

    it("removes undefined exportedAt when includeTimestamp is false", () => {
      const data = { a: 1 };
      const json = toJSON(data, { includeTimestamp: false });
      const parsed = JSON.parse(json);
      expect(parsed.metadata).not.toHaveProperty("exportedAt");
    });
  });

  describe("exportCSV", () => {
    it("calls triggerDownload with CSV blob", () => {
      const data = [{ a: 1 }];
      exportCSV(data, "test");
      
      expect(URL.createObjectURL).toHaveBeenCalled();
      expect(mockAnchor.download).toBe("test.csv");
      expect(mockAnchor.click).toHaveBeenCalled();
    });

    it("uses BOM for UTF-8", () => {
      const data = [{ a: "測試" }];
      exportCSV(data, "test");
      
      // The blob should contain BOM
      const blobArg = URL.createObjectURL.mock.calls[0][0];
      expect(blobArg.content[0]).toContain("\uFEFF");
    });
  });

  describe("exportJSON", () => {
    it("calls triggerDownload with JSON blob", () => {
      const data = { key: "value" };
      exportJSON(data, "test");
      
      expect(URL.createObjectURL).toHaveBeenCalled();
      expect(mockAnchor.download).toBe("test.json");
      expect(mockAnchor.click).toHaveBeenCalled();
    });

    it("uses application/json content type", () => {
      const data = { a: 1 };
      exportJSON(data, "test");
      
      const blobArg = URL.createObjectURL.mock.calls[0][0];
      expect(blobArg.options.type).toBe("application/json;charset=utf-8;");
    });
  });

  describe("exportChartAsImage", () => {
    const mockChartInstance = {
      getDataURL: vi.fn().mockReturnValue("data:image/png;base64,mockdata"),
    };

    it("exports chart as PNG by default", async () => {
      await exportChartAsImage(mockChartInstance, "chart");
      
      expect(mockChartInstance.getDataURL).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "image/png",
          pixelRatio: 2,
          backgroundColor: "#fff",
          excludeComponents: ["toolbox"],
        })
      );
      expect(fetch).toHaveBeenCalledWith("data:image/png;base64,mockdata");
    });

    it("supports custom options", async () => {
      await exportChartAsImage(mockChartInstance, "chart", {
        type: "jpeg",
        pixelRatio: 3,
        backgroundColor: "#000",
      });
      
      expect(mockChartInstance.getDataURL).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "image/jpeg",
          pixelRatio: 3,
          backgroundColor: "#000",
        })
      );
    });

    it("throws error when chartInstance is missing", async () => {
      await expect(exportChartAsImage(null, "chart")).rejects.toThrow("Chart instance is required");
    });
  });

  describe("exportAllFormats", () => {
    const mockChartInstance = {
      getDataURL: vi.fn().mockReturnValue("data:image/png;base64,mockdata"),
    };

    it("exports CSV when data is array", async () => {
      const results = await exportAllFormats([{ a: 1 }], "test", ["csv", "json", "png"], mockChartInstance);
      expect(results).toContain("csv");
      expect(results).toContain("json");
      expect(results).toContain("png");
    });

    it("skips CSV when data is not array", async () => {
      const results = await exportAllFormats({ a: 1 }, "test", ["csv", "json", "png"], mockChartInstance);
      expect(results).not.toContain("csv");
      expect(results).toContain("json");
      expect(results).toContain("png");
    });

    it("skips PNG when chartInstance is null", async () => {
      const results = await exportAllFormats([{ a: 1 }], "test", ["csv", "json", "png"], null);
      expect(results).toContain("csv");
      expect(results).toContain("json");
      expect(results).not.toContain("png");
    });

    it("returns json only when only json data available", async () => {
      const results = await exportAllFormats({}, "test", ["csv", "json", "png"], null);
      expect(results).toEqual(["json"]);
    });
  });
});