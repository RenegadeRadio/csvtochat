import Papa from "papaparse";
import { afterEach, describe, expect, it, vi } from "vitest";

import { extractCsvData } from "../csvUtils";

const csvFile = (csv: string) => csv as unknown as File;

describe("extractCsvData", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("trims headers and returns every row when there are four or fewer", async () => {
    const result = await extractCsvData(
      csvFile(" Name , Age \nAda,36\nGrace,40\nLinus,28\nMargaret,31")
    );

    expect(result.headers).toEqual(["Name", "Age"]);
    expect(result.sampleRows).toHaveLength(4);
    expect(result.sampleRows.map((row) => row[" Name "])).toEqual([
      "Ada",
      "Grace",
      "Linus",
      "Margaret",
    ]);
  });

  it("selects four evenly spaced rows including the first and last of ten", async () => {
    const rows = Array.from({ length: 10 }, (_, index) => `${index + 1}`);
    const result = await extractCsvData(csvFile(["Value", ...rows].join("\n")));

    expect(result.sampleRows).toHaveLength(4);
    expect(result.sampleRows.map((row) => row.Value)).toEqual(["1", "4", "7", "10"]);
  });

  it("rejects when Papa Parse reports an error", async () => {
    const error = new Error("boom");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(Papa, "parse").mockImplementation(((
      _input: unknown,
      config: Papa.ParseConfig
    ) => {
      config.error?.(error);
      return undefined;
    }) as typeof Papa.parse);

    await expect(extractCsvData(csvFile("Value\n1"))).rejects.toThrow("boom");
  });
});
