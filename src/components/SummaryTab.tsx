import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { toMonthly } from '@/lib/frequency';
import type { Income } from '@/hooks/useIncomes';
import type { Expense } from '@/hooks/useExpenses';

interface SummaryTabProps {
  incomes: Income[];
  expenses: Expense[];
  partnerX: string;
  partnerY: string;
}

function $(v: number) { return `$${Math.round(v)}`; }

export function SummaryTab({ incomes, expenses, partnerX, partnerY }: SummaryTabProps) {
  const incomeX = incomes.filter(i => i.partner_label === 'X').reduce((s, i) => s + toMonthly(i.amount, i.frequency_type, i.frequency_param ?? undefined), 0);
  const incomeY = incomes.filter(i => i.partner_label === 'Y').reduce((s, i) => s + toMonthly(i.amount, i.frequency_type, i.frequency_param ?? undefined), 0);
  const totalIncome = incomeX + incomeY;
  const incomeRatioX = totalIncome > 0 ? incomeX / totalIncome : 0.5;

  let totalFairX = 0, totalFairY = 0, paidByX = 0, paidByY = 0;

  const breakdown = expenses.map(exp => {
    const monthly = toMonthly(exp.amount, exp.frequency_type, exp.frequency_param ?? undefined);
    const bx = exp.benefit_x / 100;
    const by = 1 - bx;
    const wx = bx * incomeRatioX;
    const wy = by * (1 - incomeRatioX);
    const tw = wx + wy || 1;
    const fairX = monthly * (wx / tw);
    const fairY = monthly * (wy / tw);

    totalFairX += fairX;
    totalFairY += fairY;
    if (exp.payer === 'X') paidByX += monthly;
    else paidByY += monthly;

    const paidX = exp.payer === 'X' ? monthly : 0;
    const paidY = exp.payer === 'Y' ? monthly : 0;

    return {
      id: exp.id,
      name: exp.name,
      monthly,
      payer: exp.payer === 'X' ? partnerX : partnerY,
      benefitSplit: `${exp.benefit_x}/${100 - exp.benefit_x}`,
      fairX,
      fairY,
      overUnderX: paidX - fairX,
      overUnderY: paidY - fairY,
    };
  }).sort((a, b) => a.name.localeCompare(b.name));

  const totalExpenses = paidByX + paidByY;
  const settlement = paidByX - totalFairX; // positive = Y owes X

  return (
    <div className="space-y-6">
      {/* Settlement callout */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="py-8">
          {Math.abs(settlement) < 0.5 ? (
            <p className="text-center text-xl font-semibold text-foreground">All square! 🎉</p>
          ) : settlement > 0 ? (
            <div className="text-center">
              <p className="text-lg font-medium text-muted-foreground">Monthly settlement</p>
              <p className="text-3xl font-bold tracking-tight text-primary mt-1">
                {partnerY} pays {partnerX} {$(Math.abs(settlement))}
              </p>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-lg font-medium text-muted-foreground">Monthly settlement</p>
              <p className="text-3xl font-bold tracking-tight text-primary mt-1">
                {partnerX} pays {partnerY} {$(Math.abs(settlement))}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Totals */}
      <Card>
        <CardHeader>
          <CardTitle>Totals</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div />
            <div className="font-medium text-center">Paid</div>
            <div className="font-medium text-center">Fair share</div>
            <div className="font-medium">{partnerX}</div>
            <div className="text-center">{$(paidByX)}</div>
            <div className="text-center">{$(totalFairX)}</div>
            <div className="font-medium">{partnerY}</div>
            <div className="text-center">{$(paidByY)}</div>
            <div className="text-center">{$(totalFairY)}</div>
          </div>
          <Separator />
          <div className="flex justify-between font-semibold">
            <span>Total monthly expenses</span>
            <span>{$(totalExpenses)}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Income ratio: {partnerX} {(incomeRatioX * 100).toFixed(0)}% / {partnerY} {((1 - incomeRatioX) * 100).toFixed(0)}%
          </p>
        </CardContent>
      </Card>

      {/* Per-expense breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Per-expense Breakdown</CardTitle>
          
        </CardHeader>
        <CardContent>
          {breakdown.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No expenses to show.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">Monthly</TableHead>
                    <TableHead>Payer</TableHead>
                    <TableHead>Benefit</TableHead>
                    <TableHead className="text-right">Fair {partnerX}</TableHead>
                    <TableHead className="text-right">Fair {partnerY}</TableHead>
                    <TableHead className="text-right">Over/Under {partnerX}</TableHead>
                    <TableHead className="text-right">Over/Under {partnerY}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {breakdown.map(row => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{$(row.monthly)}</TableCell>
                      <TableCell>{row.payer}</TableCell>
                      <TableCell className="text-xs">{row.benefitSplit}</TableCell>
                      <TableCell className="text-right tabular-nums">{$(row.fairX)}</TableCell>
                      <TableCell className="text-right tabular-nums">{$(row.fairY)}</TableCell>
                      <TableCell className={`text-right tabular-nums ${row.overUnderX > 0.5 ? 'text-primary' : row.overUnderX < -0.5 ? 'text-destructive' : ''}`}>
                        {row.overUnderX > 0.5 ? `+${$(row.overUnderX)}` : row.overUnderX < -0.5 ? `-${$(Math.abs(row.overUnderX))}` : '—'}
                      </TableCell>
                      <TableCell className={`text-right tabular-nums ${row.overUnderY > 0.5 ? 'text-primary' : row.overUnderY < -0.5 ? 'text-destructive' : ''}`}>
                        {row.overUnderY > 0.5 ? `+${$(row.overUnderY)}` : row.overUnderY < -0.5 ? `-${$(Math.abs(row.overUnderY))}` : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell className="font-semibold">Total</TableCell>
                    <TableCell className="text-right font-bold tabular-nums">{$(totalExpenses)}</TableCell>
                    <TableCell colSpan={2} />
                    <TableCell className="text-right font-bold tabular-nums">{$(totalFairX)}</TableCell>
                    <TableCell className="text-right font-bold tabular-nums">{$(totalFairY)}</TableCell>
                    <TableCell className={`text-right font-bold tabular-nums ${paidByX - totalFairX > 0.5 ? 'text-primary' : paidByX - totalFairX < -0.5 ? 'text-destructive' : ''}`}>
                      {Math.abs(paidByX - totalFairX) > 0.5 ? (paidByX - totalFairX > 0 ? `+${$(paidByX - totalFairX)}` : `-${$(Math.abs(paidByX - totalFairX))}`) : '—'}
                    </TableCell>
                    <TableCell className={`text-right font-bold tabular-nums ${paidByY - totalFairY > 0.5 ? 'text-primary' : paidByY - totalFairY < -0.5 ? 'text-destructive' : ''}`}>
                      {Math.abs(paidByY - totalFairY) > 0.5 ? (paidByY - totalFairY > 0 ? `+${$(paidByY - totalFairY)}` : `-${$(Math.abs(paidByY - totalFairY))}`) : '—'}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
