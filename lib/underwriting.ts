export interface UnderwritingMetrics {
  averageDailyBalance: number;
  dtiRatio: number; // Debt to Income %
  foirRatio: number; // Fixed Obligation to Income Ratio %
  dscrRatio: number; // Debt Service Coverage Ratio
  cashRunwayDays: number; // Days of operating survival
  creditScore: number; // 0 - 100
  creditGrade: "A+" | "A" | "B" | "C" | "D";
  creditGradeDescription: string;
  recommendedLoanCeiling: number;
  maxMonthlyRepayment: number;
  salaryCadenceStatus: "Regular Institutional" | "Semi-Regular" | "Irregular / Variable";
  gamblingExposure: {
    totalSpent: number;
    count: number;
    percentOfOutflow: number;
  };
  paydayLoanExposure: {
    totalRepayments: number;
    appCount: number;
    detectedApps: string[];
  };
  nsfAndPenalties: {
    count: number;
    totalAmount: number;
  };
}

export interface UnderwritingInput {
  income: number;
  outflow: number;
  net: number;
  openingBalance: number;
  closingBalance: number;
  minimumBalance: number;
  averageBalance: number;
  transactions: {
    date: string;
    description: string;
    debit: number;
    credit: number;
    balance: number;
    category: string;
  }[];
  monthlyBreakdown: { month: string; income: number; outflow: number; net: number }[];
  mathIntegrityScore: number;
}

export function calculateUnderwriting(input: UnderwritingInput): UnderwritingMetrics {
  const { income, outflow, closingBalance, transactions, monthlyBreakdown, mathIntegrityScore } = input;

  // 1. Calculate Average Daily Balance (ADB)
  // Group end-of-day balances by parsed date
  const dailyBalances = new Map<string, number>();
  transactions.forEach((tx) => {
    if (tx.date && tx.balance !== 0) {
      dailyBalances.set(tx.date, tx.balance);
    }
  });

  const distinctDailyBalances = Array.from(dailyBalances.values());
  const averageDailyBalance =
    distinctDailyBalances.length > 0
      ? distinctDailyBalances.reduce((sum, b) => sum + b, 0) / distinctDailyBalances.length
      : input.averageBalance || (input.openingBalance + closingBalance) / 2;

  // 2. Behavioral Exposures
  // Gambling
  let gamblingSpent = 0;
  let gamblingCount = 0;
  // Payday Loans
  let paydayRepayments = 0;
  const paydayApps = new Set<string>();
  // NSF & Penalties
  let nsfCount = 0;
  let nsfTotal = 0;
  // Fixed Commitments (Bills + Rent + Utilities)
  let fixedCommitments = 0;
  // Salary counts
  let salaryTransactionsCount = 0;

  transactions.forEach((tx) => {
    const desc = tx.description.toLowerCase();
    if (tx.category === "Gambling & Betting" || /bet9ja|sportybet|1xbet|betway|nairabet|stake|casino/i.test(desc)) {
      if (tx.debit > 0) {
        gamblingSpent += tx.debit;
        gamblingCount++;
      }
    }
    if (tx.category === "Loan / Payday Apps" || /fairmoney|carbon|branch|quickcheck|renmoney|palmpay loan|opay loan/i.test(desc)) {
      if (tx.debit > 0) {
        paydayRepayments += tx.debit;
        const matched = desc.match(/(fairmoney|carbon|branch|quickcheck|renmoney|palmpay|opay|kuda|specta)/i);
        if (matched) paydayApps.add(matched[1].toUpperCase());
      }
    }
    if (tx.category === "Bank Penalty / NSF" || /dishonou?red|nsf|insufficient funds|overdraft charge|penalty fee/i.test(desc)) {
      nsfCount++;
      nsfTotal += tx.debit;
    }
    if (tx.category === "Bills & Utilities" && tx.debit > 0) {
      fixedCommitments += tx.debit;
    }
    if (tx.category === "Salary / Payroll" && tx.credit > 0) {
      salaryTransactionsCount++;
    }
  });

  const gamblingPercent = outflow > 0 ? (gamblingSpent / outflow) * 100 : 0;

  // 3. Ratios
  // DTI (Debt-to-Income): Payday + Loan repayments / Total Inflows
  const totalDebtRepayments = paydayRepayments + transactions
    .filter((tx) => tx.category === "Loan / Debt" || tx.category === "Loan / Payday Apps")
    .reduce((sum, tx) => sum + tx.debit, 0);

  const dtiRatio = income > 0 ? (totalDebtRepayments / income) * 100 : 0;
  const foirRatio = income > 0 ? ((totalDebtRepayments + fixedCommitments) / income) * 100 : 0;

  // DSCR (Debt Service Coverage Ratio): Net Operating Inflows / Total Debt Service
  const netOperatingInflows = Math.max(0, income - (outflow - totalDebtRepayments));
  const dscrRatio = totalDebtRepayments > 0 ? netOperatingInflows / totalDebtRepayments : netOperatingInflows > 0 ? 3.5 : 1.0;

  // 4. Cash Runway
  // Days of statement coverage ~ months * 30
  const statementDays = Math.max(30, (monthlyBreakdown.length || 1) * 30);
  const averageDailyOutflow = outflow > 0 ? outflow / statementDays : 1;
  const cashRunwayDays = Math.max(0, Math.round(closingBalance / averageDailyOutflow));

  // 5. Salary Cadence
  const salaryCadenceStatus =
    salaryTransactionsCount >= monthlyBreakdown.length && monthlyBreakdown.length > 0
      ? "Regular Institutional"
      : salaryTransactionsCount > 0
      ? "Semi-Regular"
      : "Irregular / Variable";

  // 6. Credit Risk Score & Grade Formulation (0 - 100, Higher = Better)
  let baseScore = 75;

  // Cashflow cushion adjustment
  if (income > 0) {
    const savingsRate = ((income - outflow) / income) * 100;
    if (savingsRate > 25) baseScore += 10;
    else if (savingsRate > 10) baseScore += 5;
    else if (savingsRate < 0) baseScore -= 15;
  }

  // ADB buffer
  if (outflow > 0 && averageDailyBalance > (outflow / (monthlyBreakdown.length || 1)) * 0.5) {
    baseScore += 5;
  }

  // DTI penalties
  if (dtiRatio > 50) baseScore -= 20;
  else if (dtiRatio > 35) baseScore -= 10;

  // Gambling penalty
  if (gamblingPercent > 15) baseScore -= 25;
  else if (gamblingPercent > 5) baseScore -= 12;

  // NSF / Penalties
  if (nsfCount > 2) baseScore -= 20;
  else if (nsfCount > 0) baseScore -= 10;

  // Payday stacking
  if (paydayApps.size > 2) baseScore -= 15;
  else if (paydayApps.size > 0) baseScore -= 8;

  // Math tampering / Forgery penalty
  if (mathIntegrityScore < 80) baseScore -= 35;
  else if (mathIntegrityScore < 95) baseScore -= 15;

  const creditScore = Math.max(10, Math.min(99, Math.round(baseScore)));

  // Grade classification
  let creditGrade: "A+" | "A" | "B" | "C" | "D";
  let creditGradeDescription: string;

  if (creditScore >= 85) {
    creditGrade = "A+";
    creditGradeDescription = "Prime Borrower · Low Risk · Strong Cash Buffers & No Gambling/NSF Signals";
  } else if (creditScore >= 75) {
    creditGrade = "A";
    creditGradeDescription = "Standard Prime · Acceptable Debt Load · Good Repayment Capacity";
  } else if (creditScore >= 60) {
    creditGrade = "B";
    creditGradeDescription = "Near Prime / Conditional Approval · Recommend Collateral or Lower Tenure";
  } else if (creditScore >= 45) {
    creditGrade = "C";
    creditGradeDescription = "Subprime / Elevated Risk · High Debt Load, Irregular Cashflow, or Behavioral Triggers";
  } else {
    creditGrade = "D";
    creditGradeDescription = "Decline / Severe Risk · Negative Cashflow, Multiple Payday Debts, or Tampered Statement Math";
  }

  // 7. Recommended Loan Ceiling & Affordability
  // Standard underwriting formula: (Median Monthly Net Disposable Income) * 35% debt capacity * 3-month multiplier
  const monthsCount = Math.max(1, monthlyBreakdown.length);
  const monthlyAverageNet = Math.max(0, (income - outflow) / monthsCount);
  const monthlyAverageIncome = income / monthsCount;
  // Free cash flow capacity
  const maxMonthlyRepayment = Math.max(
    0,
    Math.round(Math.min(monthlyAverageNet * 0.6, monthlyAverageIncome * 0.33))
  );
  const recommendedLoanCeiling = Math.round(maxMonthlyRepayment * 3.5);

  return {
    averageDailyBalance: Math.round(averageDailyBalance),
    dtiRatio: Math.round(dtiRatio * 10) / 10,
    foirRatio: Math.round(foirRatio * 10) / 10,
    dscrRatio: Math.round(dscrRatio * 100) / 100,
    cashRunwayDays,
    creditScore,
    creditGrade,
    creditGradeDescription,
    recommendedLoanCeiling,
    maxMonthlyRepayment,
    salaryCadenceStatus,
    gamblingExposure: {
      totalSpent: Math.round(gamblingSpent),
      count: gamblingCount,
      percentOfOutflow: Math.round(gamblingPercent * 10) / 10,
    },
    paydayLoanExposure: {
      totalRepayments: Math.round(paydayRepayments),
      appCount: paydayApps.size,
      detectedApps: Array.from(paydayApps),
    },
    nsfAndPenalties: {
      count: nsfCount,
      totalAmount: Math.round(nsfTotal),
    },
  };
}
