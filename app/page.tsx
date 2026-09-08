"use client";

import { useMemo, useState } from "react";
import { FileUpload } from "@/components/file-upload";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  Check,
  CircleHelp,
  Download,
  FileJson,
  FileText,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Upload,
  WalletCards,
} from "lucide-react";

export interface CSVData {
  headers: string[];
  rows: string[][];
  fileName: string;
  metadata?: {
    periodStart?: string;
    periodEnd?: string;
    openingBalance?: number;
    accountHolder?: string;
    accountType?: string;
  };
}

export interface ComparisonResult {
  missingInFile1: string[][];
  missingInFile2: string[][];
  summary: {
    file1Count: number;
    file2Count: number;
    file1Sum?: number;
    file2Sum?: number;
    missingInFile1Count: number;
    missingInFile2Count: number;
  };
}

type Transaction = {
  values: string[];
  description: string;
  debit: number;
  credit: number;
  balance: number;
};
type Analysis = {
  income: number;
  outflow: number;
  net: number;
  transactionCount: number;
  largeTransactions: number;
  cashWithdrawalCount: number;
  transferCount: number;
  recurringCount: number;
  averageCredit: number;
  averageDebit: number;
  expenseRatio: number;
  openingBalance: number;
  closingBalance: number;
  riskScore: number;
  periodLabel: string;
  riskLabel: string;
  riskNote: string;
  transactions: Transaction[];
  findings: string[];
  recommendations: string[];
  monthlyBreakdown: { month: string; income: number; outflow: number; net: number }[];
};

const money = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

function numberFrom(value: string | undefined) {
  const parsed = Number.parseFloat((value || "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function monthFrom(value: string | undefined) {
  const text = (value || "").trim();
  const compact = text.match(/^(\d{1,2})\s*([A-Za-z]{3,9})\s*(\d{2,4})/);
  const separated = text.match(/^(\d{1,2})[\s/-](\d{1,2})[\s/-](\d{2,4})/);
  const date = compact
    ? new Date(`${compact[1]} ${compact[2]} ${compact[3]}`)
    : separated
      ? new Date(Number(separated[3].length === 2 ? `20${separated[3]}` : separated[3]), Number(separated[2]) - 1, Number(separated[1]))
      : new Date(text);
  return Number.isNaN(date.getTime()) ? "Unclassified" : date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function downloadFile(content: string, filename: string, type: string) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([content], { type }));
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

function Metric({
  label,
  value,
  note,
  icon,
}: {
  label: string;
  value: string;
  note: string;
  icon: React.ReactNode;
}) {
  return (
    <Card className="border-border/80 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {label}
            </p>
            <p className="mt-2 text-xl font-semibold tracking-tight">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{note}</p>
          </div>
          <div className="rounded-lg bg-[#eef3f0] p-2">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function Signal({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-border/80 bg-[#fbfcfb] p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

export default function Home() {
  const [statement, setStatement] = useState<CSVData | null>(null);
  const analysis = useMemo<Analysis | null>(() => {
    if (!statement) return null;
    const headers = statement.headers.map((header) => header.toLowerCase());
    const descriptionIndex = headers.findIndex((header) =>
      /description|narration|details|memo|particular/.test(header),
    );
    const debitIndex = headers.findIndex((header) =>
      /debit|withdrawal|outflow|spent/.test(header),
    );
    const creditIndex = headers.findIndex((header) =>
      /credit|deposit|inflow|received/.test(header),
    );
    const balanceIndex = headers.findIndex((header) =>
      /balance|running balance|closing/.test(header),
    );
    const amountIndex = headers.findIndex((header) =>
      /amount|value|transaction amount|transaction_value/.test(header),
    );
    const transactions = statement.rows.map((values) => {
      const description =
        values[descriptionIndex >= 0 ? descriptionIndex : 0] ||
        "Unlabelled transaction";
      const debit = debitIndex >= 0 ? numberFrom(values[debitIndex]) : 0;
      const credit = creditIndex >= 0 ? numberFrom(values[creditIndex]) : 0;
      const amount = amountIndex >= 0 ? numberFrom(values[amountIndex]) : 0;
      return {
        values,
        description,
        debit: debit || (creditIndex < 0 && amount < 0 ? Math.abs(amount) : 0),
        credit: credit || (debitIndex < 0 && amount > 0 ? amount : 0),
        balance: balanceIndex >= 0 ? numberFrom(values[balanceIndex]) : 0,
      };
    });
    const income = transactions.reduce(
      (sum, transaction) => sum + transaction.credit,
      0,
    );
    const outflow = transactions.reduce(
      (sum, transaction) => sum + transaction.debit,
      0,
    );
    const largeTransactions = transactions.filter(
      ({ debit }) => debit > 500000,
    ).length;
    const cashWithdrawalCount = transactions.filter(({ description }) =>
      /atm|cash withdrawal|pos cash/.test(description.toLowerCase()),
    ).length;
    const transferCount = transactions.filter(({ description }) =>
      /transfer|bank to bank|instant/.test(description.toLowerCase()),
    ).length;
    const recurringCount = transactions.filter(({ description }) =>
      /salary|rent|subscription|netflix|airtime|utility|bill/.test(
        description.toLowerCase(),
      ),
    ).length;
    const credits = transactions
      .filter(({ credit }) => credit > 0)
      .map(({ credit }) => credit);
    const debits = transactions
      .filter(({ debit }) => debit > 0)
      .map(({ debit }) => debit);
    const closingBalance =
      [...transactions].reverse().find(({ balance }) => balance !== 0)
        ?.balance || 0;
    const firstBalance =
      transactions.find(({ balance }) => balance !== 0)?.balance || 0;
    const firstTransaction = transactions.find(
      ({ debit, credit }) => debit > 0 || credit > 0,
    );
    const openingBalance =
      statement.metadata?.openingBalance ??
      (firstTransaction
        ? firstBalance - firstTransaction.credit + firstTransaction.debit
        : 0);
    const expenseRatio = income > 0 ? (outflow / income) * 100 : 0;
    const monthlyMap = new Map<string, { month: string; income: number; outflow: number; net: number }>();
    transactions.forEach((transaction) => {
      const month = monthFrom(transaction.values[0]);
      const current = monthlyMap.get(month) || { month, income: 0, outflow: 0, net: 0 };
      current.income += transaction.credit;
      current.outflow += transaction.debit;
      current.net = current.income - current.outflow;
      monthlyMap.set(month, current);
    });
    const riskScore = Math.min(
      99,
      12 +
        largeTransactions * 16 +
        cashWithdrawalCount * 8 +
        (expenseRatio > 100 ? 25 : 0),
    );
    const findings = [
      ...(expenseRatio > 100
        ? ["Outflows exceed detected inflows during the statement period."]
        : []),
      ...(largeTransactions > 0
        ? [
            `${largeTransactions} debit transaction${largeTransactions === 1 ? "" : "s"} exceeded ₦500,000.`,
          ]
        : []),
      ...(cashWithdrawalCount > 3
        ? [
            `${cashWithdrawalCount} cash withdrawals may require source-of-funds validation.`,
          ]
        : []),
      ...(findingsPlaceholder(transactions)
        ? [
            "Transaction descriptions contain patterns that should be reviewed against supporting documents.",
          ]
        : []),
    ];
    const recommendations =
      riskScore >= 60
        ? [
            "Place the case in enhanced review before approval.",
            "Request supporting documents for material debits and cash activity.",
            "Validate income consistency against external evidence.",
          ]
        : riskScore >= 35
          ? [
              "Verify unusual transfers and cash activity before a decision.",
              "Review affordability using verified recurring income.",
              "Retain this report with the case file for auditability.",
            ]
          : [
              "No immediate high-signal exception was detected.",
              "Confirm statement authenticity and period coverage.",
              "Use verified income and obligations in the final decision.",
            ];
    const periodLabel =
      statement.metadata?.periodStart && statement.metadata?.periodEnd
        ? `${statement.metadata.periodStart} to ${statement.metadata.periodEnd}`
        : "Period unavailable from source file";
    return {
      income,
      outflow,
      net: income - outflow,
      transactionCount: transactions.length,
      largeTransactions,
      cashWithdrawalCount,
      transferCount,
      recurringCount,
      averageCredit: credits.length ? income / credits.length : 0,
      averageDebit: debits.length ? outflow / debits.length : 0,
      expenseRatio,
      openingBalance,
      closingBalance,
      periodLabel,
      riskScore,
      riskLabel:
        riskScore >= 60
          ? "Needs review"
          : riskScore >= 35
            ? "Watchlist"
            : "Low concern",
      riskNote:
        riskScore >= 60
          ? "Several patterns need an investigator's attention before a lending decision."
          : riskScore >= 35
            ? "Some activity is unusual for a first-pass review. Validate source documents."
            : "No high-signal anomalies were detected by the current rules.",
      transactions,
      findings,
      recommendations,
      monthlyBreakdown: Array.from(monthlyMap.values()),
    };
  }, [statement]);

  function findingsPlaceholder(transactions: Transaction[]) {
    return transactions.some(({ description }) =>
      /loan|bet|gaming|crypto|cash/i.test(description),
    );
  }

  const exportReport = () => {
    if (!statement || !analysis) return;
    downloadFile(
      JSON.stringify(
        {
          reportTitle: "Bank Statement Analysis Report",
          generatedAt: new Date().toISOString(),
          sourceFile: statement.fileName,
          statementMetadata: statement.metadata,
          summary: { ...analysis, transactions: undefined },
          findings: analysis.findings,
          recommendations: analysis.recommendations,
          transactions: analysis.transactions.map(({ values }) =>
            Object.fromEntries(
              statement.headers.map((header, index) => [
                header,
                values[index] || "",
              ]),
            ),
          ),
        },
        null,
        2,
      ),
      `${statement.fileName.replace(/\.[^.]+$/, "")}-analysis-report.json`,
      "application/json",
    );
  };

  const exportTransactions = () => {
    if (!statement) return;
    const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
    downloadFile(
      [statement.headers, ...statement.rows]
        .map((row) => row.map((cell) => escape(cell || "")).join(","))
        .join("\n"),
      `${statement.fileName.replace(/\.[^.]+$/, "")}-transactions.csv`,
      "text/csv;charset=utf-8",
    );
  };

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-[1440px] px-4 pb-12 sm:px-6 lg:px-10">
        <header className="flex items-center justify-between border-b border-border/80 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-accent shadow-sm">
              <RefreshCw className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight">
                Mofdan Digitals
              </p>
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Statement intelligence
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="hidden items-center gap-2 sm:flex">
              <span className="h-2 w-2 rounded-full bg-[#68a98e]" />
              Workspace ready
            </span>
            <button
              className="rounded-full border border-border bg-white p-2.5 transition-colors hover:bg-muted"
              aria-label="Help and support"
            >
              <CircleHelp className="h-4 w-4" />
            </button>
          </div>
        </header>
        <main className="workspace-grid mt-6 overflow-hidden rounded-[1.5rem] border border-border/80 bg-white/60 shadow-[0_24px_80px_rgba(24,50,56,0.08)]">
          <section className="animate-rise grid gap-8 border-b border-border/80 bg-primary px-6 py-10 text-primary-foreground sm:px-10 lg:grid-cols-[1.25fr_0.75fr] lg:px-14 lg:py-14">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-accent">
                <ShieldCheck className="h-3.5 w-3.5" /> Decision support for
                financial teams
              </div>
              <h1 className="max-w-3xl text-4xl font-semibold leading-[1.05] tracking-[-0.04em] sm:text-6xl">
                See the story
                <br />
                <span className="text-accent">behind the balance.</span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-white/70 sm:text-lg">
                A professional statement review for cash-flow assessment, fraud
                triage, and lending decisions.
              </p>
            </div>
            <div className="flex items-end lg:justify-end">
              <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-sm">
                <div className="flex items-center justify-between text-xs uppercase tracking-[0.16em] text-white/55">
                  <span>Analysis flow</span>
                  <span>01 / 03</span>
                </div>
                <div className="mt-6 space-y-4">
                  {[
                    "Upload a statement",
                    "Map the money",
                    "Review decision signals",
                  ].map((step, index) => (
                    <div key={step} className="flex items-center gap-3 text-sm">
                      <span
                        className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${index === 0 ? "bg-accent text-primary" : "border border-white/20 text-white/50"}`}
                      >
                        {index === 0 ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          index + 1
                        )}
                      </span>
                      <span
                        className={index === 0 ? "text-white" : "text-white/50"}
                      >
                        {step}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
          <div className="space-y-8 p-5 sm:p-8 lg:p-10">
            <div className="animate-rise-delay flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6a8e88]">
                  New analysis
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                  Start with a statement
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Upload a PDF, Excel workbook, or CSV export. Analysis runs in
                  your browser.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <LockKeyhole className="h-3.5 w-3.5" /> Your file stays in this
                session
              </div>
            </div>
            <Card className="overflow-hidden border-border/80 bg-white shadow-sm">
              <CardHeader className="border-b border-border/70 bg-[#fbfcfb] pb-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#e5f3d4] text-[#47705d]">
                      <Upload className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-base">
                        Bank statement
                      </CardTitle>
                      <CardDescription className="mt-1">
                        PDF, Excel, or CSV statement with transaction and
                        balance details.
                      </CardDescription>
                    </div>
                  </div>
                  {statement && (
                    <Badge className="bg-[#e5f3d4] text-[#47705d] hover:bg-[#e5f3d4]">
                      <Check className="mr-1 h-3 w-3" /> Analysed
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <FileUpload onFileUpload={setStatement} fileNumber={1} />
                {statement && (
                  <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg bg-muted p-3">
                    <FileText className="h-4 w-4 text-[#47705d]" />
                    <span className="max-w-[15rem] truncate text-sm font-medium">
                      {statement.fileName}
                    </span>
                    <Badge variant="outline" className="ml-auto bg-white">
                      {statement.rows.length.toLocaleString()} transactions
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>
            {analysis && (
              <div className="space-y-6">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      Analysis report
                    </p>
                    <h2 className="mt-1 text-2xl font-semibold tracking-tight">
                      Executive financial review
                    </h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={exportReport}>
                      <FileJson className="h-4 w-4" /> Export full report
                    </Button>
                    <Button variant="outline" onClick={exportTransactions}>
                      <Download className="h-4 w-4" /> Export transactions
                    </Button>
                  </div>
                </div>
                <Card className="border-border/80 bg-[#fbfcfb] shadow-sm">
                  <CardContent className="grid gap-4 p-5 sm:grid-cols-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Statement period</p>
                      <p className="mt-1 font-medium">{analysis.periodLabel}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Opening balance</p>
                      <p className="mt-1 font-medium">{money.format(analysis.openingBalance)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Closing balance</p>
                      <p className="mt-1 font-medium">{money.format(analysis.closingBalance)}</p>
                    </div>
                  </CardContent>
                </Card>
                <div className="grid gap-4 md:grid-cols-4">
                  <Metric
                    label="Money in"
                    value={money.format(analysis.income)}
                    icon={<ArrowDownRight className="h-5 w-5 text-[#2e8b80]" />}
                    note="Total credits detected"
                  />
                  <Metric
                    label="Money out"
                    value={money.format(analysis.outflow)}
                    icon={<ArrowUpRight className="h-5 w-5 text-[#c85b4c]" />}
                    note="Total debits detected"
                  />
                  <Metric
                    label="Net cash flow"
                    value={money.format(analysis.net)}
                    icon={<TrendingUp className="h-5 w-5 text-[#47705d]" />}
                    note={`${analysis.transactionCount} transactions`}
                  />
                  <Metric
                    label="Risk signal"
                    value={`${analysis.riskScore}/100`}
                    icon={<AlertTriangle className="h-5 w-5 text-[#d68b46]" />}
                    note={analysis.riskLabel}
                  />
                </div>
                <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
                  <Card className="border-border/80 shadow-sm">
                    <CardHeader className="border-b border-border/70 bg-[#fbfcfb] pb-5">
                      <CardTitle className="flex items-center gap-2">
                        <WalletCards className="h-5 w-5 text-[#47705d]" />{" "}
                        Lending and cash-flow indicators
                      </CardTitle>
                      <CardDescription>
                        Measures to support affordability, source-of-funds, and
                        account management review.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-3 pt-6 sm:grid-cols-2">
                      <Signal
                        label="Expense ratio"
                        value={`${analysis.expenseRatio.toFixed(1)}%`}
                        detail="Outflows as a share of inflows"
                      />
                      <Signal
                        label="Opening balance"
                        value={money.format(analysis.openingBalance)}
                        detail="Balance at the start of the period"
                      />
                      <Signal
                        label="Closing balance"
                        value={money.format(analysis.closingBalance)}
                        detail="Last detected running balance"
                      />
                      <Signal
                        label="Average credit"
                        value={money.format(analysis.averageCredit)}
                        detail="Average incoming transaction"
                      />
                      <Signal
                        label="Average debit"
                        value={money.format(analysis.averageDebit)}
                        detail="Average outgoing transaction"
                      />
                      <Signal
                        label="Transfers"
                        value={`${analysis.transferCount}`}
                        detail="Bank transfer activity"
                      />
                      <Signal
                        label="Recurring patterns"
                        value={`${analysis.recurringCount}`}
                        detail="Salary, bills, subscriptions"
                      />
                    </CardContent>
                  </Card>
                  <Card className="border-border/80 bg-[#183238] text-white shadow-sm">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-white">
                        <Banknote className="h-5 w-5 text-[#d9f36b]" /> Analyst
                        conclusion
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Badge className="bg-[#d9f36b] text-[#183238] hover:bg-[#d9f36b]">
                        {analysis.riskLabel}
                      </Badge>
                      <p className="mt-4 text-sm leading-6 text-white/70">
                        {analysis.riskNote}
                      </p>
                      <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4 text-xs text-white/50">
                        <span>Rules-based triage</span>
                        <span>Human review required</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
                <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
                  <Card className="border-border/80 shadow-sm">
                    <CardHeader className="border-b border-border/70 bg-[#fbfcfb] pb-5">
                      <CardTitle>Monthly cash-flow trend</CardTitle>
                      <CardDescription>Compare incoming and outgoing funds across the complete statement period.</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={analysis.monthlyBreakdown} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#dbe6e1" />
                            <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} tickFormatter={(value) => `₦${Math.round(value / 1000)}k`} />
                            <Tooltip formatter={(value) => money.format(Number(value))} cursor={{ fill: "rgba(24,50,56,0.04)" }} />
                            <Legend />
                            <Bar dataKey="income" name="Money in" fill="#2e8b80" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="outflow" name="Money out" fill="#c85b4c" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-border/80 shadow-sm">
                    <CardHeader className="border-b border-border/70 bg-[#fbfcfb] pb-5">
                      <CardTitle>Monthly net position</CardTitle>
                      <CardDescription>Net movement after detected debits.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-6">
                      {analysis.monthlyBreakdown.map((month) => <div key={month.month} className="flex items-center justify-between border-b border-border/70 pb-3 last:border-0"><span className="text-sm text-muted-foreground">{month.month}</span><span className={`font-semibold ${month.net < 0 ? "text-[#c85b4c]" : "text-[#2e8b80]"}`}>{money.format(month.net)}</span></div>)}
                    </CardContent>
                  </Card>
                </div>
                <div className="grid gap-6 lg:grid-cols-2">
                  <Card className="border-border/80 shadow-sm">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-[#d68b46]" />{" "}
                        Findings and exceptions
                      </CardTitle>
                      <CardDescription>
                        Items that should be documented before a financial
                        decision.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {analysis.findings.length ? (
                        <ul className="space-y-3 text-sm">
                          {analysis.findings.map((finding) => (
                            <li key={finding} className="flex gap-3">
                              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#d68b46]" />
                              {finding}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No rule-based exceptions were detected in this
                          statement.
                        </p>
                      )}
                    </CardContent>
                  </Card>
                  <Card className="border-border/80 shadow-sm">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5 text-[#47705d]" />{" "}
                        Recommended next steps
                      </CardTitle>
                      <CardDescription>
                        Practical controls for the case officer or finance team.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-3 text-sm">
                        {analysis.recommendations.map((recommendation) => (
                          <li key={recommendation} className="flex gap-3">
                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#47705d]" />
                            {recommendation}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </div>
                <Card className="border-border/80 shadow-sm">
                  <CardHeader className="border-b border-border/70 bg-[#fbfcfb] pb-5">
                    <CardTitle>Transaction register</CardTitle>
                    <CardDescription>
                      First 12 transactions shown for audit review. Export the
                      complete register above.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="overflow-x-auto pt-6">
                    <table className="w-full min-w-[680px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-border text-xs uppercase tracking-[0.12em] text-muted-foreground">
                          {statement.headers.map((header) => (
                            <th
                              key={header}
                              className="px-3 pb-3 font-semibold"
                            >
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {statement.rows.slice(0, 12).map((row, rowIndex) => (
                          <tr
                            key={rowIndex}
                            className="border-b border-border/70 last:border-0"
                          >
                            {statement.headers.map((_, cellIndex) => (
                              <td
                                key={cellIndex}
                                className="px-3 py-3 font-mono text-xs"
                              >
                                {row[cellIndex] || (
                                  <span className="text-muted-foreground">
                                    -
                                  </span>
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </main>
        <footer className="flex flex-col gap-2 px-2 pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>
            Mofdan Digitals · Statement intelligence for modern finance teams
          </span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" /> Session-first processing
          </span>
        </footer>
      </div>
    </div>
  );
}
