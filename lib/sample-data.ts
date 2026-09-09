import type { CSVData } from "@/app/page";

export const SAMPLE_STATEMENTS: Record<string, CSVData> = {
  prime: {
    fileName: "AccessBank_Statement_Q1_2024.csv",
    metadata: {
      accountHolder: "OLUWASEYI ADEBAYO",
      accountType: "INDIVIDUAL SAVINGS",
      periodStart: "01 Jan 2024",
      periodEnd: "31 Mar 2024",
      openingBalance: 420000,
    },
    headers: ["Date", "Description", "Debit", "Credit", "Balance"],
    rows: [
      ["02/01/2024", "TRANSFER FROM KUNLE ADEBAYO", "", "85000", "505000"],
      ["05/01/2024", "POS SHOPRITE IKEJA CITY MALL", "24500", "", "480500"],
      ["10/01/2024", "IKEDC PREPAID ELECTRICITY TOKEN", "15000", "", "465500"],
      ["15/01/2024", "ATM CASH WITHDRAWAL ACCESS PALMGROVE", "30000", "", "435500"],
      ["20/01/2024", "MTN AIRTIME & DATA SUBSCRIPTION", "8000", "", "427500"],
      ["25/01/2024", "SALARY CR - TECH HORIZONS LTD JAN PAYROLL", "", "750000", "1177500"],
      ["28/01/2024", "FAIRMONEY LOAN REPAYMENT INSTALLMENT 1/3", "45000", "", "1132500"],
      ["30/01/2024", "COWRYWISE AUTO-INVESTMENT SAVINGS", "100000", "", "1032500"],
      ["31/01/2024", "ELECTRONIC MONEY TRANSFER LEVY EMTL", "50", "", "1032450"],

      ["04/02/2024", "FUEL MOBIL SERVICE STATION LEKKI", "28000", "", "1004450"],
      ["08/02/2024", "SPORTYBET WALLET TOPUP NIGERIA", "5000", "", "999450"],
      ["12/02/2024", "DSTV PREMIUM MONTHLY RENEWAL", "29500", "", "969950"],
      ["16/02/2024", "POS SPAR SUPERMARKET VICTORIA ISLAND", "34200", "", "935750"],
      ["20/02/2024", "TRANSFER TO BOLA JOHNSON CONSULTING", "50000", "", "885750"],
      ["25/02/2024", "SALARY CR - TECH HORIZONS LTD FEB PAYROLL", "", "750000", "1635750"],
      ["28/02/2024", "FAIRMONEY LOAN REPAYMENT INSTALLMENT 2/3", "45000", "", "1590750"],
      ["29/02/2024", "SMS ALERT NOTIFICATION CHARGE", "120", "", "1590630"],

      ["03/03/2024", "PIGGYVEST TARGET SAVINGS LOCK", "150000", "", "1440630"],
      ["07/03/2024", "IKEDC PREPAID ELECTRICITY TOKEN", "15000", "", "1425630"],
      ["12/03/2024", "ATM CASH WITHDRAWAL ACCESS LEKKI", "40000", "", "1385630"],
      ["18/03/2024", "POS HEALTHPLUS PHARMACY", "18400", "", "1367230"],
      ["25/03/2024", "SALARY CR - TECH HORIZONS LTD MAR PAYROLL", "", "750000", "2117230"],
      ["28/03/2024", "FAIRMONEY LOAN FINAL REPAYMENT 3/3", "45000", "", "2072230"],
      ["31/03/2024", "ACCOUNT MAINTENANCE CHARGE & VAT", "350", "", "2071880"],
    ],
  },
  flagged: {
    fileName: "Suspicious_Ledger_Tampered_Statement.csv",
    metadata: {
      accountHolder: "CHIDI OKONKWO",
      accountType: "CURRENT ACCOUNT",
      periodStart: "01 Feb 2024",
      periodEnd: "28 Feb 2024",
      openingBalance: 50000,
    },
    headers: ["Date", "Description", "Debit", "Credit", "Balance"],
    rows: [
      ["02/02/2024", "INWARD TRF FROM FRIENDS POOL", "", "4850000", "4900000"],
      // Wash round-trip: drained within 24 hours!
      ["03/02/2024", "OUTWARD TRF TO CRYPTO WALLET P2P", "4500000", "", "400000"],
      ["06/02/2024", "BET9JA WALLET PAYMENT 1", "75000", "", "325000"],
      ["08/02/2024", "SPORTYBET DIRECT RECHARGE", "120000", "", "205000"],
      ["10/02/2024", "RETURNED CHEQUE UNPAID NSF PENALTY", "10000", "", "195000"],
      // Math break below! 195,000 - 50,000 should be 145,000, but edited statement claims 850,000!
      ["12/02/2024", "CARBON LOAN REPAYMENT", "50000", "", "850000"],
      ["15/02/2024", "BRANCH LOAN DEBIT", "45000", "", "805000"],
      ["18/02/2024", "QUICKCHECK MICROFINANCE DEBIT", "60000", "", "745000"],
      ["22/02/2024", "1XBET ONLINE CASINO DEPOSIT", "150000", "", "595000"],
      ["27/02/2024", "TRANSFER FROM SISTER TRF", "", "50000", "645000"],
    ],
  },
};
