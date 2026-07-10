import Papa from "papaparse";
import {
  fixHeaderlessCsvParse,
  looksLikeHeaderlessExport,
} from "@/lib/imports/resolve-mapping";
import type { CsvRow } from "@/lib/imports/types";

export type ParsedCsvResult = {
  headers: string[];
  rows: CsvRow[];
};

export function normalizeParsedCsv(
  headers: string[],
  rows: CsvRow[],
): ParsedCsvResult {
  if (looksLikeHeaderlessExport(headers)) {
    const fixed = fixHeaderlessCsvParse(headers, rows);
    return { headers: fixed.headers, rows: fixed.rows };
  }

  return { headers, rows };
}

export function parseCsvText(csvText: string): ParsedCsvResult {
  const results = Papa.parse<CsvRow>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  if (results.errors.length > 0) {
    const firstError = results.errors[0];
    throw new Error(firstError.message || "CSV parsing failed.");
  }

  const headers = results.meta.fields ?? [];
  return normalizeParsedCsv(headers, results.data);
}
