import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { fmtPKR, fmtDate } from "./format";

type FarmerIncome = {
  entry_date: string;
  total_acre: number;
  rate_per_acre: number;
  received_amount: number;
  note: string | null;
};

export function exportFarmerPDF(args: {
  farmerName: string;
  seasonName: string;
  rows: FarmerIncome[];
}) {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text("Farmer Statement", 14, 18);
  doc.setFontSize(11);
  doc.text(`Farmer: ${args.farmerName}`, 14, 28);
  doc.text(`Season: ${args.seasonName}`, 14, 34);

  let totalAmt = 0, totalRec = 0;
  const body = args.rows.map((r) => {
    const amt = Number(r.total_acre) * Number(r.rate_per_acre);
    const rem = amt - Number(r.received_amount);
    totalAmt += amt; totalRec += Number(r.received_amount);
    return [
      fmtDate(r.entry_date),
      String(r.total_acre),
      fmtPKR(r.rate_per_acre),
      fmtPKR(amt),
      fmtPKR(r.received_amount),
      fmtPKR(rem),
      r.note ?? "",
    ];
  });

  autoTable(doc, {
    startY: 40,
    head: [["Date", "Acres", "Rate/Acre", "Total", "Received", "Balance", "Note"]],
    body,
    headStyles: { fillColor: [60, 110, 60] },
    styles: { fontSize: 9 },
  });

  const y = (doc as any).lastAutoTable.finalY + 8;
  doc.setFontSize(11);
  doc.text(`Total Earned: ${fmtPKR(totalAmt)}`, 14, y);
  doc.text(`Total Received: ${fmtPKR(totalRec)}`, 14, y + 6);
  const balance = totalAmt - totalRec;
  doc.text(`${balance >= 0 ? "Remaining" : "Advance"}: ${fmtPKR(Math.abs(balance))}`, 14, y + 12);

  doc.save(`farmer-${args.farmerName}-${args.seasonName}.pdf`);
}

export function exportOwnerPDF(args: {
  ownerName: string;
  seasonName: string;
  expenses: { entry_date: string; amount_pkr: number; note: string | null }[];
  transfersIn: { entry_date: string; from_name: string; amount_pkr: number; note: string | null }[];
  transfersOut: { entry_date: string; to_name: string; amount_pkr: number; note: string | null }[];
  incomeShare: number;
  totals: { expenses: number; incomeShare: number; transfersIn: number; transfersOut: number; net: number };
}) {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(`Owner Report — ${args.ownerName}`, 14, 18);
  doc.setFontSize(11);
  doc.text(`Season: ${args.seasonName}`, 14, 26);

  doc.setFontSize(13); doc.text("Expenses", 14, 36);
  autoTable(doc, {
    startY: 40,
    head: [["Date", "Amount", "Note"]],
    body: args.expenses.map((e) => [fmtDate(e.entry_date), fmtPKR(e.amount_pkr), e.note ?? ""]),
    headStyles: { fillColor: [60, 110, 60] }, styles: { fontSize: 9 },
  });

  let y = (doc as any).lastAutoTable.finalY + 8;
  doc.setFontSize(13); doc.text("Received from Other Owner", 14, y);
  autoTable(doc, {
    startY: y + 4,
    head: [["Date", "From", "Amount", "Note"]],
    body: args.transfersIn.map((t) => [fmtDate(t.entry_date), t.from_name, fmtPKR(t.amount_pkr), t.note ?? ""]),
    headStyles: { fillColor: [60, 110, 60] }, styles: { fontSize: 9 },
  });
  y = (doc as any).lastAutoTable.finalY + 8;
  doc.setFontSize(13); doc.text("Paid to Other Owner", 14, y);
  autoTable(doc, {
    startY: y + 4,
    head: [["Date", "To", "Amount", "Note"]],
    body: args.transfersOut.map((t) => [fmtDate(t.entry_date), t.to_name, fmtPKR(t.amount_pkr), t.note ?? ""]),
    headStyles: { fillColor: [60, 110, 60] }, styles: { fontSize: 9 },
  });

  y = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(12);
  doc.text(`Income share (50%): ${fmtPKR(args.totals.incomeShare)}`, 14, y);
  doc.text(`Total expenses: ${fmtPKR(args.totals.expenses)}`, 14, y + 6);
  doc.text(`Received from other: ${fmtPKR(args.totals.transfersIn)}`, 14, y + 12);
  doc.text(`Paid to other: ${fmtPKR(args.totals.transfersOut)}`, 14, y + 18);
  doc.setFontSize(13);
  doc.text(`Net position: ${fmtPKR(args.totals.net)}`, 14, y + 28);

  doc.save(`owner-${args.ownerName}-${args.seasonName}.pdf`);
}

export function exportSeasonGrandPDF(args: {
  seasonName: string;
  totals: {
    income: number;
    received: number;
    balance: number;
    expenses: number;
    grandNet: number;
  };
  perOwner: { name: string; expenses: number; incomeShare: number; transfersIn: number; transfersOut: number; net: number }[];
}) {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(`Season Grand Report — ${args.seasonName}`, 14, 18);

  autoTable(doc, {
    startY: 28,
    head: [["Metric", "Amount"]],
    body: [
      ["Total income (acres × rate)", fmtPKR(args.totals.income)],
      ["Total received from farmers", fmtPKR(args.totals.received)],
      ["Outstanding balance", fmtPKR(args.totals.balance)],
      ["Total expenses", fmtPKR(args.totals.expenses)],
      ["Grand net (income − expenses)", fmtPKR(args.totals.grandNet)],
    ],
    headStyles: { fillColor: [60, 110, 60] },
  });

  let y = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(13); doc.text("Per Owner", 14, y);
  autoTable(doc, {
    startY: y + 4,
    head: [["Owner", "Income share", "Expenses", "In", "Out", "Net"]],
    body: args.perOwner.map((o) => [
      o.name, fmtPKR(o.incomeShare), fmtPKR(o.expenses), fmtPKR(o.transfersIn), fmtPKR(o.transfersOut), fmtPKR(o.net),
    ]),
    headStyles: { fillColor: [60, 110, 60] },
  });

  doc.save(`season-${args.seasonName}.pdf`);
}
