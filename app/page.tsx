"use client"

import { useState } from "react"
import { FileUpload } from "@/components/file-upload"
import { DataPreview } from "@/components/data-preview"
import { ComparisonResults } from "@/components/comparison-results"
import { ExportSection } from "@/components/export-section"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { ArrowUpRight, BarChart3, Check, CircleHelp, Download, FileText, LockKeyhole, RefreshCw, ShieldCheck } from "lucide-react"

export interface CSVData {
  headers: string[]
  rows: string[][]
  fileName: string
}

export interface ComparisonResult {
  missingInFile1: string[][]
  missingInFile2: string[][]
  summary: {
    file1Count: number
    file2Count: number
    file1Sum?: number
    file2Sum?: number
    missingInFile1Count: number
    missingInFile2Count: number
  }
}

export default function Home() {
  const [file1Data, setFile1Data] = useState<CSVData | null>(null)
  const [file2Data, setFile2Data] = useState<CSVData | null>(null)
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null)
  const [keyColumn, setKeyColumn] = useState<string>("")
  const [amountColumn, setAmountColumn] = useState<string>("")

  const handleFileUpload = (fileNumber: 1 | 2, data: CSVData) => {
    if (fileNumber === 1) {
      setFile1Data(data)
    } else {
      setFile2Data(data)
    }
    setComparisonResult(null) // Reset comparison when new file is uploaded
  }

  const handleCompare = () => {
    if (!file1Data || !file2Data || !keyColumn) return

    const keyIndex = file1Data.headers.indexOf(keyColumn)
    const amountIndex = amountColumn ? file1Data.headers.indexOf(amountColumn) : -1

    // Create sets of keys for comparison
    const file1Keys = new Set(file1Data.rows.map((row) => row[keyIndex]?.toLowerCase().trim()).filter(Boolean))
    const file2Keys = new Set(file2Data.rows.map((row) => row[keyIndex]?.toLowerCase().trim()).filter(Boolean))

    // Find missing records
    const missingInFile2 = file1Data.rows.filter((row) => {
      const key = row[keyIndex]?.toLowerCase().trim()
      return key && !file2Keys.has(key)
    })

    const missingInFile1 = file2Data.rows.filter((row) => {
      const key = row[keyIndex]?.toLowerCase().trim()
      return key && !file1Keys.has(key)
    })

    // Calculate sums if amount column is specified
    let file1Sum, file2Sum
    if (amountIndex >= 0) {
      file1Sum = file1Data.rows.reduce((sum, row) => {
        const amount = Number.parseFloat(row[amountIndex] || "0")
        return sum + (isNaN(amount) ? 0 : amount)
      }, 0)

      file2Sum = file2Data.rows.reduce((sum, row) => {
        const amount = Number.parseFloat(row[amountIndex] || "0")
        return sum + (isNaN(amount) ? 0 : amount)
      }, 0)
    }

    setComparisonResult({
      missingInFile1,
      missingInFile2,
      summary: {
        file1Count: file1Data.rows.length,
        file2Count: file2Data.rows.length,
        file1Sum,
        file2Sum,
        missingInFile1Count: missingInFile1.length,
        missingInFile2Count: missingInFile2.length,
      },
    })
  }

  const availableColumns = file1Data && file2Data ? [...new Set([...file1Data.headers, ...file2Data.headers])] : []

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-[1440px] px-4 pb-12 sm:px-6 lg:px-10">
        <header className="flex items-center justify-between border-b border-border/80 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-accent shadow-sm"><RefreshCw className="h-5 w-5" /></div>
            <div><p className="text-sm font-semibold tracking-tight">Mofdan Digitals</p><p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Reconciliation workspace</p></div>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground"><span className="hidden items-center gap-2 sm:flex"><span className="h-2 w-2 rounded-full bg-[#68a98e]" />Workspace ready</span><button className="rounded-full border border-border bg-white p-2.5 transition-colors hover:bg-muted" aria-label="Help and support"><CircleHelp className="h-4 w-4" /></button></div>
        </header>

        <main className="workspace-grid mt-6 overflow-hidden rounded-[1.5rem] border border-border/80 bg-white/60 shadow-[0_24px_80px_rgba(24,50,56,0.08)]">
          <section className="animate-rise grid gap-8 border-b border-border/80 bg-primary px-6 py-10 text-primary-foreground sm:px-10 lg:grid-cols-[1.25fr_0.75fr] lg:px-14 lg:py-14">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-accent"><ShieldCheck className="h-3.5 w-3.5" /> Built for controlled financial operations</div>
              <h1 className="max-w-3xl text-4xl font-semibold leading-[1.05] tracking-[-0.04em] sm:text-6xl">Know what moved.<br /><span className="text-accent">Prove what matched.</span></h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-white/70 sm:text-lg">A focused reconciliation desk for banks, payment teams, and finance operations. Compare source files, surface exceptions, and export an audit-ready record.</p>
            </div>
            <div className="flex items-end lg:justify-end"><div className="w-full max-w-sm rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-sm"><div className="flex items-center justify-between text-xs uppercase tracking-[0.16em] text-white/55"><span>Control centre</span><span>01 / 03</span></div><div className="mt-6 space-y-4">{["Load source files", "Set match rules", "Review exceptions"].map((step, index) => <div key={step} className="flex items-center gap-3 text-sm"><span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${index === 0 ? "bg-accent text-primary" : "border border-white/20 text-white/50"}`}>{index === 0 ? <Check className="h-3.5 w-3.5" /> : index + 1}</span><span className={index === 0 ? "text-white" : "text-white/50"}>{step}</span></div>)}</div></div></div>
          </section>

          <div className="space-y-8 p-5 sm:p-8 lg:p-10">
            <div className="animate-rise-delay flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6a8e88]">New reconciliation</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">Bring two records into focus</h2><p className="mt-1 text-sm text-muted-foreground">Upload the files you want to validate against each other.</p></div><div className="flex items-center gap-2 text-xs text-muted-foreground"><LockKeyhole className="h-3.5 w-3.5" /> Files are processed in this session</div></div>

            <div className="grid gap-5 lg:grid-cols-2">{[{ number: 1 as const, label: "Source A", description: "Your internal ledger, switch, or settlement export", data: file1Data }, { number: 2 as const, label: "Source B", description: "The external statement or partner file to validate", data: file2Data }].map((source) => <Card key={source.number} className="overflow-hidden border-border/80 bg-white shadow-sm transition-shadow hover:shadow-md"><CardHeader className="border-b border-border/70 bg-[#fbfcfb] pb-5"><div className="flex items-start justify-between gap-4"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#e5f3d4] text-sm font-bold text-[#47705d]">0{source.number}</div><div><CardTitle className="text-base">{source.label}</CardTitle><CardDescription className="mt-1">{source.description}</CardDescription></div></div>{source.data && <Badge className="bg-[#e5f3d4] text-[#47705d] hover:bg-[#e5f3d4]"><Check className="mr-1 h-3 w-3" /> Ready</Badge>}</div></CardHeader><CardContent className="pt-6"><FileUpload onFileUpload={(data) => handleFileUpload(source.number, data)} fileNumber={source.number} />{source.data && <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg bg-muted p-3"><FileText className="h-4 w-4 text-[#47705d]" /><span className="max-w-[15rem] truncate text-sm font-medium">{source.data.fileName}</span><Badge variant="outline" className="ml-auto bg-white">{source.data.rows.length.toLocaleString()} rows</Badge></div>}</CardContent></Card>)}</div>

            {(file1Data || file2Data) && <Tabs defaultValue="preview" className="w-full"><TabsList className="h-auto w-full justify-start gap-1 rounded-xl border border-border/80 bg-[#eef3f0] p-1 sm:w-fit"><TabsTrigger value="preview" className="gap-2 px-4 py-2.5"><FileText className="h-4 w-4" /> Preview</TabsTrigger><TabsTrigger value="compare" disabled={!file1Data || !file2Data} className="gap-2 px-4 py-2.5"><BarChart3 className="h-4 w-4" /> Compare</TabsTrigger><TabsTrigger value="export" disabled={!comparisonResult} className="gap-2 px-4 py-2.5"><Download className="h-4 w-4" /> Export</TabsTrigger></TabsList>

              <TabsContent value="preview" className="space-y-6 pt-5"><DataPreview file1Data={file1Data} file2Data={file2Data} /></TabsContent>

              <TabsContent value="compare" className="space-y-6 pt-5"><ComparisonResults file1Data={file1Data} file2Data={file2Data} comparisonResult={comparisonResult} keyColumn={keyColumn} amountColumn={amountColumn} availableColumns={availableColumns} onKeyColumnChange={setKeyColumn} onAmountColumnChange={setAmountColumn} onCompare={handleCompare} /></TabsContent>

              <TabsContent value="export" className="space-y-6 pt-5"><ExportSection comparisonResult={comparisonResult} headers={file1Data?.headers || []} /></TabsContent></Tabs>}
          </div>
        </main>
        <footer className="flex flex-col gap-2 px-2 pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><span>Mofdan Digitals · Reconciliation controls for modern finance teams</span><span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Session-first processing <ArrowUpRight className="ml-1 h-3 w-3" /></span></footer>
      </div>
    </div>
  )
}
