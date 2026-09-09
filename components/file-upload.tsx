"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Upload,
  FileText,
  AlertCircle,
  Lock,
  Sparkles,
  ShieldAlert,
  KeyRound,
  Plus,
} from "lucide-react";
import type { CSVData } from "@/app/page";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import {
  GlobalWorkerOptions,
  getDocument,
  version as pdfjsVersion,
} from "pdfjs-dist/build/pdf.js";
import { SAMPLE_STATEMENTS } from "@/lib/sample-data";
import { detectCurrencyFromText, SupportedCurrency } from "@/lib/currencies";

GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsVersion}/pdf.worker.min.js`;

interface FileUploadProps {
  onFileUpload: (data: CSVData) => void;
  onAppendStatement?: (data: CSVData) => void;
  onCurrencyDetected?: (currency: SupportedCurrency) => void;
  fileNumber: 1 | 2;
  hasExistingStatement?: boolean;
  disabled?: boolean;
}

const datePattern =
  /^(\d{1,2}(?:[\s/-]?[A-Za-z]{3,9}[\s/-]?\d{2,4}|[\s/-]\d{1,2}[\s/-]\d{2,4}))\b/i;
const amountPattern =
  /(?:NGN|₦|\$|£|€|KSh|R)?\(?-?\d{1,3}(?:,\d{3})*(?:\.\d{2})?\)?/g;

function numberFrom(value: string | undefined): number {
  if (!value) return 0;
  const raw = String(value).trim();
  if (!raw) return 0;
  if (/[a-zA-Z]/.test(raw)) return 0;
  const isNegative = /^\s*\(.+\)\s*$/.test(raw) || /^\s*-/.test(raw);
  const parsed = Number.parseFloat(raw.replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(parsed) || Math.abs(parsed) > 10_000_000_000_000) return 0;
  return isNegative ? -Math.abs(parsed) : parsed;
}

function parseStatementPdfLines(lines: string[]) {
  const rows: string[][] = [];
  let current: string[] | null = null;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+/g, " ").trim();
    if (!line) continue;
    const dateMatch = line.match(datePattern);
    if (!dateMatch) {
      if (
        current &&
        !/^(page|total|opening|closing|account|statement|date|description|debit|credit|balance)/i.test(
          line
        )
      ) {
        current[1] = `${current[1]} ${line}`.trim();
      }
      continue;
    }

    const date = dateMatch[1];
    const remainder = line.slice(dateMatch[0].length).trim();
    const amounts = remainder.match(amountPattern) || [];
    const description = remainder
      .replace(amountPattern, " ")
      .replace(/\s+/g, " ")
      .trim();
    // Filter out long integers (e.g. 15-30 digit session IDs or account numbers) from amount candidates
    const numericValues = amounts
      .map((value) => value.replace(/[₦$£€KShR,NGN\s]/gi, ""))
      .filter((v) => {
        const cleaned = v.replace(/[()]/g, "");
        const num = Number.parseFloat(cleaned);
        return Number.isFinite(num) && Math.abs(num) <= 10_000_000_000_000 && cleaned.replace(/\..*/, "").length <= 12;
      });

    if (numericValues.length === 0) continue;

    if (current) rows.push(current);
    const balance = numericValues[numericValues.length - 1];
    const movement =
      numericValues.length > 1 ? numericValues[numericValues.length - 2] : "";

    const hasCreditIndicators =
      /\b(cr|credit|deposit|inward|inflow|refund|reversal|salary|interest|dividend)\b|transfer\s+from|trf\s+from|received\s+from|from\s+[a-z]/i.test(
        description
      );
    const hasDebitIndicators =
      /\b(dr|debit|withdraw|withdrawal|pos|atm|payment|purchase|bill|fee|charge|stamp\s*duty|transfer\s+to|trf\s+to|paid\s+to)\b/i.test(
        description
      );
    const movementIsDebit = hasCreditIndicators ? false : hasDebitIndicators ? true : true;

    current = [
      date,
      description || "Statement transaction",
      movementIsDebit ? movement : "",
      movementIsDebit ? "" : movement,
      balance,
    ];
  }
  if (current) rows.push(current);
  return rows;
}

function extractPdfMetadata(lines: string[]) {
  const metadata: NonNullable<CSVData["metadata"]> = {};
  const periodLine = lines.find(
    (line) => /account statement/i.test(line) && /\bto\b/i.test(line)
  );
  const periodMatch = periodLine?.match(/statement:\s*(.+?)\s+to\s+(.+)$/i);
  if (periodMatch) {
    metadata.periodStart = periodMatch[1].trim();
    metadata.periodEnd = periodMatch[2].trim();
  }
  const holderLine = lines.find((line) =>
    /^[A-Z][A-Z .'-]{4,}$/.test(line.trim())
  );
  if (holderLine) metadata.accountHolder = holderLine.trim();
  const openingLine = lines.find((line) =>
    /opening balance|balance brought forward|brought forward|balance\s*(b\/f|bf)/i.test(
      line
    )
  );
  const openingAmounts = openingLine?.match(amountPattern);
  const openingAmount =
    openingAmounts && openingAmounts.length > 0
      ? openingAmounts[openingAmounts.length - 1]
      : undefined;
  if (openingAmount) metadata.openingBalance = numberFrom(openingAmount);
  const accountTypeLine = lines.find((line) => /account type/i.test(line));
  if (accountTypeLine)
    metadata.accountType = accountTypeLine
      .replace(/account type:?/i, "")
      .trim();

  // Extract Account Number (NUBAN or standard 10-digit number)
  const accNumLine = lines.find((line) =>
    /account\s*(?:no|num|number)?[:\s]+(\d{8,12})/i.test(line)
  );
  const accNumMatch = accNumLine?.match(/account\s*(?:no|num|number)?[:\s]+(\d{8,12})/i);
  if (accNumMatch) {
    metadata.accountNumber = accNumMatch[1].trim();
  } else {
    // Look for any isolated 10-digit number near the top 30 lines
    for (let i = 0; i < Math.min(lines.length, 30); i++) {
      const m = lines[i].match(/\b([01289]\d{9})\b/);
      if (m && !/date|time|ref|tel/i.test(lines[i])) {
        metadata.accountNumber = m[1];
        break;
      }
    }
  }

  return metadata;
}

export function FileUpload({
  onFileUpload,
  onAppendStatement,
  onCurrencyDetected,
  fileNumber,
  hasExistingStatement,
  disabled,
}: FileUploadProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // PDF password states
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [pdfPassword, setPdfPassword] = useState("");
  const [pendingPdfBuffer, setPendingPdfBuffer] = useState<ArrayBuffer | null>(
    null
  );
  const [pendingFileName, setPendingFileName] = useState("");

  const processPdfBuffer = useCallback(
    async (
      buffer: ArrayBuffer,
      fileName: string,
      password?: string
    ) => {
      try {
        const loadingTask = getDocument({
          data: buffer,
          password: password || undefined,
        });

        const pdf = await loadingTask.promise;
        const lines: string[] = [];
        let fullText = "";

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          const page = await pdf.getPage(pageNumber);
          const content = await page.getTextContent();
          const items = content.items as Array<{
            str: string;
            transform: number[];
          }>;
          const grouped = new Map<number, string[]>();
          items.forEach((item) => {
            fullText += " " + item.str;
            const y = Math.round(item.transform[5]);
            const line = grouped.get(y) || [];
            line.push(item.str);
            grouped.set(y, line);
          });
          Array.from(grouped.entries())
            .sort((a, b) => b[0] - a[0])
            .forEach(([, cells]) => lines.push(cells.join(" ").trim()));
        }

        if (onCurrencyDetected) {
          onCurrencyDetected(detectCurrencyFromText(fullText));
        }

        const metadata = extractPdfMetadata(lines);
        const data = parseStatementPdfLines(lines);
        if (data.length > 0)
          data.unshift(["Date", "Description", "Debit", "Credit", "Balance"]);

        if (data.length > 1) {
          onFileUpload({
            headers: data[0],
            rows: data.slice(1),
            fileName,
            metadata,
          });
          setIsPasswordModalOpen(false);
          setPendingPdfBuffer(null);
          setPdfPassword("");
          return;
        }
        throw new Error("Unable to extract transaction table rows from PDF.");
      } catch (err: unknown) {
        const errObj = err as { name?: string; message?: string };
        if (
          errObj.name === "PasswordException" ||
          (errObj.message && /password|encrypted/i.test(errObj.message))
        ) {
          setPendingPdfBuffer(buffer);
          setPendingFileName(fileName);
          setIsPasswordModalOpen(true);
          setError("This statement PDF is password-protected. Enter the password below to decrypt.");
          return;
        }
        throw err;
      }
    },
    [onCurrencyDetected, onFileUpload]
  );

  const parseFile = useCallback(
    async (file: File) => {
      setIsLoading(true);
      setError(null);

      try {
        const extension = file.name.split(".").pop()?.toLowerCase();
        let data: string[][] = [];

        if (extension === "csv") {
          const text = await file.text();
          if (onCurrencyDetected) {
            onCurrencyDetected(detectCurrencyFromText(text));
          }
          const results = await new Promise<Papa.ParseResult<string[][]>>(
            (resolve, reject) => {
              Papa.parse<string[]>(file, {
                skipEmptyLines: true,
                complete: resolve,
                error: reject,
              });
            }
          );
          if (results.errors.length > 0)
            throw new Error(`CSV parsing error: ${results.errors[0].message}`);
          data = results.data.map((row) =>
            row.map((cell) => String(cell ?? ""))
          );
        } else if (extension === "xls" || extension === "xlsx") {
          const buffer = await file.arrayBuffer();
          const workbook = XLSX.read(buffer, {
            type: "array",
            cellDates: true,
          });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          if (!firstSheet)
            throw new Error("The workbook has no readable worksheets");
          data = XLSX.utils
            .sheet_to_json<string[]>(firstSheet, {
              header: 1,
              raw: false,
              defval: "",
            })
            .map((row) => row.map((cell) => String(cell ?? "")));
        } else if (extension === "pdf") {
          const buffer = await file.arrayBuffer();
          await processPdfBuffer(buffer, file.name);
          return;
        } else {
          throw new Error(
            "Unsupported file type. Upload a PDF, XLS, XLSX, or CSV statement."
          );
        }

        if (data.length < 2 || data[0].length === 0)
          throw new Error("File appears to be empty or unreadable");
        onFileUpload({
          headers: data[0],
          rows: data.slice(1),
          fileName: file.name,
        });
      } catch (parseError) {
        setError(
          parseError instanceof Error
            ? parseError.message
            : "Failed to process file"
        );
      } finally {
        setIsLoading(false);
      }
    },
    [onFileUpload, onCurrencyDetected, processPdfBuffer]
  );

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (file) {
        void parseFile(file);
      }
    },
    [parseFile]
  );

  const handlePasswordSubmit = async () => {
    if (!pendingPdfBuffer) return;
    setIsLoading(true);
    setError(null);
    try {
      await processPdfBuffer(pendingPdfBuffer, pendingFileName, pdfPassword);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? `Incorrect password: ${err.message}`
          : "Incorrect password for this statement."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    disabled: disabled || isLoading,
    accept: {
      "text/csv": [".csv"],
      "application/pdf": [".pdf"],
      "application/vnd.ms-excel": [".xls"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
        ".xlsx",
      ],
    },
    maxFiles: 1,
  });

  return (
    <div className="space-y-4">
      <Card className="border-0 bg-transparent shadow-none transition-colors">
        <CardContent className="p-0">
          <div
            {...getRootProps()}
            id="statement-dropzone"
            className={`
              border-2 border-dashed rounded-xl p-7 text-center transition-all
              ${disabled ? "cursor-not-allowed opacity-60 bg-red-50/40 border-red-200" : "cursor-pointer"}
              ${
                isDragActive
                  ? "border-primary bg-secondary"
                  : !disabled
                  ? "border-border/80 bg-[#fbfcfb] hover:border-primary/50 hover:bg-white"
                  : ""
              }
              ${isLoading ? "pointer-events-none opacity-50" : ""}
            `}
          >
            <input {...getInputProps()} id="statement-file-input" disabled={disabled || isLoading} />
            <div className="space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#e5f3d4]">
                {isLoading ? (
                  <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-primary"></div>
                ) : (
                  <Upload className="h-6 w-6 text-primary" />
                )}
              </div>
              {disabled ? (
                <div>
                  <p className="text-base font-semibold text-red-700 flex items-center justify-center gap-1.5">
                    <ShieldAlert className="w-5 h-5 text-red-600" />
                    Account Suspended — Upload Disabled
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Your account has been suspended by an administrator. Please reach out to reactivate privileges.
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-base font-semibold">
                    {isDragActive
                      ? "Drop your statement here"
                      : "Drag & drop your bank statement"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    PDF (supports password protection), Excel, or CSV · Instant in-browser analysis
                  </p>
                </div>
              )}
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button variant="outline" disabled={isLoading || disabled} size="sm">
                  <FileText className="mr-2 h-4 w-4" />
                  {isLoading ? "Analyzing Statement..." : "Browse Statement File"}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Load Realistic Statements for instant testing / demo */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-border/80 bg-[#fbfcfb] p-3 text-xs">
        <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" /> Or test with sample data:
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            id="load-prime-sample-btn"
            type="button"
            variant="outline"
            disabled={disabled || isLoading}
            size="sm"
            className="h-8 text-xs font-medium hover:bg-[#e5f3d4] hover:text-[#183238]"
            onClick={() => onFileUpload(SAMPLE_STATEMENTS.prime)}
          >
            <ShieldAlert className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />
            Prime Borrower (3-Mo Healthy Cashflow)
          </Button>
          <Button
            id="load-flagged-sample-btn"
            type="button"
            variant="outline"
            disabled={disabled || isLoading}
            size="sm"
            className="h-8 text-xs font-medium hover:bg-rose-50 hover:text-rose-900"
            onClick={() => onFileUpload(SAMPLE_STATEMENTS.flagged)}
          >
            <AlertCircle className="mr-1.5 h-3.5 w-3.5 text-rose-600" />
            Tampered & High-Risk (Math Break & Bets)
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
          {pendingPdfBuffer && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsPasswordModalOpen(true)}
              className="gap-1 text-xs"
            >
              <KeyRound className="h-3.5 w-3.5" /> Unlock PDF
            </Button>
          )}
        </div>
      )}

      {/* Password Protected PDF Decryption Dialog */}
      <Dialog
        open={isPasswordModalOpen}
        onOpenChange={setIsPasswordModalOpen}
      >
        <DialogContent id="pdf-password-dialog" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" /> Protected Statement PDF
            </DialogTitle>
            <DialogDescription>
              This bank statement is encrypted. Most retail banks set passwords to your account number, birthdate (e.g. DDMMYYYY), or last 4 digits of your phone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <label className="text-xs font-medium text-foreground">
              Statement Decryption Password
            </label>
            <Input
              id="pdf-password-input"
              type="password"
              placeholder="Enter PDF password..."
              value={pdfPassword}
              onChange={(e) => setPdfPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handlePasswordSubmit();
              }}
              autoFocus
            />
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              variant="ghost"
              onClick={() => {
                setIsPasswordModalOpen(false);
                setPendingPdfBuffer(null);
                setPdfPassword("");
              }}
            >
              Cancel
            </Button>
            <Button
              id="submit-pdf-password-btn"
              onClick={handlePasswordSubmit}
              disabled={isLoading || !pdfPassword}
            >
              {isLoading ? "Decrypting..." : "Unlock & Analyze"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
