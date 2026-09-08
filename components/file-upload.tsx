"use client"

import { useCallback, useState } from "react"
import { useDropzone } from "react-dropzone"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Upload, FileText, AlertCircle } from "lucide-react"
import type { CSVData } from "@/app/page"
import Papa from "papaparse"
import * as XLSX from "xlsx"
import { GlobalWorkerOptions, getDocument, version as pdfjsVersion } from "pdfjs-dist/build/pdf.js"

GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsVersion}/pdf.worker.min.js`

interface FileUploadProps {
  onFileUpload: (data: CSVData) => void
  fileNumber: 1 | 2
}

const datePattern = /^(\d{1,2}(?:[\s/-]?[A-Za-z]{3,9}[\s/-]?\d{2,4}|[\s/-]\d{1,2}[\s/-]\d{2,4}))\b/i
const amountPattern = /(?:NGN|₦)?\(?-?\d{1,3}(?:,\d{3})*(?:\.\d{2})?\)?/g

function numberFrom(value: string | undefined) {
  const parsed = Number.parseFloat((value || "").replace(/[^\d.-]/g, ""))
  return Number.isFinite(parsed) ? parsed : 0
}

function parseStatementPdfLines(lines: string[]) {
  const rows: string[][] = []
  let current: string[] | null = null

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+/g, " ").trim()
    if (!line) continue
    const dateMatch = line.match(datePattern)
    if (!dateMatch) {
      if (current && !/^(page|total|opening|closing|account|statement|date|description|debit|credit|balance)/i.test(line)) {
        current[1] = `${current[1]} ${line}`.trim()
      }
      continue
    }

    const date = dateMatch[1]
    const remainder = line.slice(dateMatch[0].length).trim()
    const amounts = remainder.match(amountPattern) || []
    const description = remainder.replace(amountPattern, " ").replace(/\s+/g, " ").trim()
    const numericValues = amounts.map((value) => value.replace(/[₦,NGN\s]/gi, ""))
    if (numericValues.length === 0) continue

    if (current) rows.push(current)
    const balance = numericValues[numericValues.length - 1]
    const movement = numericValues.length > 1 ? numericValues[numericValues.length - 2] : ""
    const movementIsDebit = /withdraw|debit|pos|atm|transfer|fee|charge|payment|purchase|bill/i.test(description)
    current = [date, description || "Statement transaction", movementIsDebit ? movement : "", movementIsDebit ? "" : movement, balance]
  }
  if (current) rows.push(current)
  return rows
}

function extractPdfMetadata(lines: string[]) {
  const metadata: NonNullable<CSVData["metadata"]> = {}
  const periodLine = lines.find((line) => /account statement/i.test(line) && /\bto\b/i.test(line))
  const periodMatch = periodLine?.match(/statement:\s*(.+?)\s+to\s+(.+)$/i)
  if (periodMatch) {
    metadata.periodStart = periodMatch[1].trim()
    metadata.periodEnd = periodMatch[2].trim()
  }
  const holderLine = lines.find((line) => /^[A-Z][A-Z .'-]{4,}$/.test(line.trim()))
  if (holderLine) metadata.accountHolder = holderLine.trim()
  const openingLine = lines.find((line) => /opening balance|balance brought forward|brought forward|balance\s*(b\/f|bf)/i.test(line))
  const openingAmounts = openingLine?.match(amountPattern)
  const openingAmount = openingAmounts && openingAmounts.length > 0
    ? openingAmounts[openingAmounts.length - 1]
    : undefined
  if (openingAmount) metadata.openingBalance = numberFrom(openingAmount)
  const accountTypeLine = lines.find((line) => /account type/i.test(line))
  if (accountTypeLine) metadata.accountType = accountTypeLine.replace(/account type:?/i, "").trim()
  return metadata
}

export function FileUpload({ onFileUpload, fileNumber }: FileUploadProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const parseFile = useCallback(async (file: File) => {
    setIsLoading(true)
    setError(null)

    try {
      const extension = file.name.split(".").pop()?.toLowerCase()
      let data: string[][] = []

      if (extension === "csv") {
        const results = await new Promise<Papa.ParseResult<string[][]>>((resolve, reject) => {
          Papa.parse<string[]>(file, { skipEmptyLines: true, complete: resolve, error: reject })
        })
        if (results.errors.length > 0) throw new Error(`CSV parsing error: ${results.errors[0].message}`)
        data = results.data.map((row) => row.map((cell) => String(cell ?? "")))
      } else if (extension === "xls" || extension === "xlsx") {
        const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true })
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
        if (!firstSheet) throw new Error("The workbook has no readable worksheets")
        data = XLSX.utils.sheet_to_json<string[]>(firstSheet, { header: 1, raw: false, defval: "" })
          .map((row) => row.map((cell) => String(cell ?? "")))
      } else if (extension === "pdf") {
        const pdf = await getDocument({ data: await file.arrayBuffer() }).promise
        const lines: string[] = []
        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          const page = await pdf.getPage(pageNumber)
          const content = await page.getTextContent()
          const items = content.items as Array<{ str: string; transform: number[] }>
          const grouped = new Map<number, string[]>()
          items.forEach((item) => {
            const y = Math.round(item.transform[5])
            const line = grouped.get(y) || []
            line.push(item.str)
            grouped.set(y, line)
          })
          Array.from(grouped.entries()).sort((a, b) => b[0] - a[0]).forEach(([, cells]) => lines.push(cells.join(" ").trim()))
        }
        const metadata = extractPdfMetadata(lines)
        data = parseStatementPdfLines(lines)
        if (data.length > 0) data.unshift(["Date", "Description", "Debit", "Credit", "Balance"])
        if (data.length > 1) {
          onFileUpload({ headers: data[0], rows: data.slice(1), fileName: file.name, metadata })
          return
        }
      } else {
        throw new Error("Unsupported file type. Upload a PDF, XLS, XLSX, or CSV statement.")
      }

      if (data.length < 2 || data[0].length === 0) throw new Error("File appears to be empty or unreadable")
      onFileUpload({ headers: data[0], rows: data.slice(1), fileName: file.name })
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : "Failed to process file")
    } finally {
      setIsLoading(false)
    }
  }, [onFileUpload])

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0]
      if (file) {
        void parseFile(file)
      }
    },
    [parseFile],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
      "application/pdf": [".pdf"],
      "application/vnd.ms-excel": [".xls"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
    },
    maxFiles: 1,
  })

  return (
    <div className="space-y-4">
      <Card className="border-0 bg-transparent shadow-none transition-colors">
        <CardContent className="p-0">
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-xl p-7 text-center cursor-pointer transition-all
              ${isDragActive ? "border-primary bg-secondary" : "border-border/80 bg-[#fbfcfb] hover:border-primary/50 hover:bg-white"}
              ${isLoading ? "pointer-events-none opacity-50" : ""}
            `}
          >
            <input {...getInputProps()} />
            <div className="space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#e5f3d4]">
                {isLoading ? (
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                ) : (
                  <Upload className="h-6 w-6 text-primary" />
                )}
              </div>
              <div>
                <p className="text-base font-semibold">
                  {isDragActive ? "Drop your statement here" : "Drag & drop your statement"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">PDF, Excel, or CSV · processed in this session</p>
              </div>
              <Button variant="outline" disabled={isLoading}>
                <FileText className="h-4 w-4 mr-2" />
                {isLoading ? "Reading statement..." : "Choose statement"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
    </div>
  )
}
