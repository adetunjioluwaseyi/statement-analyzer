export interface LedgerDiscrepancy {
  rowIndex: number;
  date: string;
  description: string;
  previousBalance: number;
  credit: number;
  debit: number;
  expectedBalance: number;
  statedBalance: number;
  difference: number;
}

export interface RoundTripSignal {
  inflowDate: string;
  inflowAmount: number;
  outflowDate: string;
  outflowAmount: number;
  drainedPercentage: number;
  description: string;
}

export interface StructuringSignal {
  date: string;
  amount: number;
  type: "credit" | "debit";
  description: string;
}

export interface StatementForensicsResult {
  mathIntegrityScore: number; // 0 - 100
  totalChecks: number;
  discrepancies: LedgerDiscrepancy[];
  hasMathTampering: boolean;
  roundTrips: RoundTripSignal[];
  structuringAlerts: StructuringSignal[];
  duplicateDebitsCount: number;
  forgeryRiskLevel: "Low" | "Moderate" | "Critical";
  forgeryRiskSummary: string;
}

export interface ForensicTransactionItem {
  index: number;
  date: string;
  description: string;
  credit: number;
  debit: number;
  balance: number;
}

export function runStatementForensics(
  transactions: ForensicTransactionItem[],
  openingBalance: number
): StatementForensicsResult {
  const discrepancies: LedgerDiscrepancy[] = [];
  let runningBalance = openingBalance;
  let totalChecks = 0;

  // 1. Math balance integrity check
  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i];
    if (tx.balance === 0 && tx.credit === 0 && tx.debit === 0) continue;

    const expected = runningBalance + tx.credit - tx.debit;
    // Check if stated balance deviates by more than 0.05
    if (tx.balance !== 0) {
      totalChecks++;
      const diff = Math.abs(expected - tx.balance);
      if (diff > 0.05 && runningBalance !== 0) {
        discrepancies.push({
          rowIndex: i + 1,
          date: tx.date,
          description: tx.description,
          previousBalance: runningBalance,
          credit: tx.credit,
          debit: tx.debit,
          expectedBalance: Math.round(expected * 100) / 100,
          statedBalance: tx.balance,
          difference: Math.round(diff * 100) / 100,
        });
      }
      runningBalance = tx.balance;
    } else {
      runningBalance = expected;
    }
  }

  // Calculate Math Integrity Score
  const mathIntegrityScore =
    totalChecks > 0
      ? Math.max(0, Math.round(((totalChecks - discrepancies.length) / totalChecks) * 100))
      : 100;

  // 2. Wash-Trading / Round-Tripping Detection
  // Detect large inflows that are rapidly liquidated within 2 transactions or 48 hours
  const roundTrips: RoundTripSignal[] = [];
  const largeCredits = transactions
    .filter((tx) => tx.credit > 0)
    .sort((a, b) => b.credit - a.credit);
  const creditMedian =
    largeCredits.length > 0 ? largeCredits[Math.floor(largeCredits.length / 2)].credit : 0;
  const washThreshold = Math.max(creditMedian * 1.5, 50000);

  for (let i = 0; i < transactions.length; i++) {
    const inflow = transactions[i];
    if (inflow.credit >= washThreshold) {
      let drained = 0;
      let matchingOutflow: ForensicTransactionItem | null = null;
      // Look forward up to 5 transactions or subsequent days
      for (let j = i + 1; j < Math.min(transactions.length, i + 6); j++) {
        const outflow = transactions[j];
        if (outflow.debit > 0) {
          drained += outflow.debit;
          if (drained >= inflow.credit * 0.7) {
            matchingOutflow = outflow;
            break;
          }
        }
      }

      if (matchingOutflow && drained >= inflow.credit * 0.7) {
        roundTrips.push({
          inflowDate: inflow.date,
          inflowAmount: inflow.credit,
          outflowDate: matchingOutflow.date,
          outflowAmount: drained,
          drainedPercentage: Math.min(100, Math.round((drained / inflow.credit) * 100)),
          description: inflow.description,
        });
      }
    }
  }

  // 3. Structuring / Smurfing Alert
  // E.g., repeated transactions clustered just under 5,000,000 or 1,000,000 NGN, or 10,000 USD
  const structuringAlerts: StructuringSignal[] = [];
  transactions.forEach((tx) => {
    const val = tx.credit > 0 ? tx.credit : tx.debit;
    const type = tx.credit > 0 ? "credit" : "debit";
    // Threshold bands: 4.5M - 4.99M, 900k - 999k, 9k - 9.99k
    if (
      (val >= 4500000 && val < 5000000) ||
      (val >= 900000 && val < 1000000) ||
      (val >= 9000 && val < 10000)
    ) {
      structuringAlerts.push({
        date: tx.date,
        amount: val,
        type,
        description: tx.description,
      });
    }
  });

  // 4. Duplicate debits count
  const debitFreq = new Map<string, number>();
  transactions.forEach((tx) => {
    if (tx.debit > 0) {
      const key = `${tx.description.toLowerCase().trim()}|${tx.debit}`;
      debitFreq.set(key, (debitFreq.get(key) || 0) + 1);
    }
  });
  let duplicateDebitsCount = 0;
  debitFreq.forEach((count) => {
    if (count > 1) duplicateDebitsCount += count - 1;
  });

  // Risk determination
  let forgeryRiskLevel: "Low" | "Moderate" | "Critical" = "Low";
  let forgeryRiskSummary = "Running balances and transaction increments reconcile with mathematical precision.";

  if (discrepancies.length >= 3 || mathIntegrityScore < 80) {
    forgeryRiskLevel = "Critical";
    forgeryRiskSummary = `Critical mathematical breaks detected (${discrepancies.length} mismatches). The statement shows strong indicators of manual tampering or document forgery.`;
  } else if (discrepancies.length > 0 || roundTrips.length >= 2) {
    forgeryRiskLevel = "Moderate";
    forgeryRiskSummary = `Noticeable ledger inconsistencies or round-trip wash inflows observed (${discrepancies.length} balance breaks, ${roundTrips.length} wash cycles). Enhanced review required.`;
  }

  return {
    mathIntegrityScore,
    totalChecks,
    discrepancies,
    hasMathTampering: discrepancies.length > 0,
    roundTrips,
    structuringAlerts,
    duplicateDebitsCount,
    forgeryRiskLevel,
    forgeryRiskSummary,
  };
}
