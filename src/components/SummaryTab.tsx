import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toMonthly } from '@/lib/frequency';
import type { Income } from '@/hooks/useIncomes';
import type { Expense } from '@/hooks/useExpenses';

interface SummaryTabProps {
  incomes: Income[];
  expenses: Expense[];
  partnerX: string;
  partnerY: string;
}

export function SummaryTab({ incomes, expenses, partnerX, partnerY }: SummaryTabProps) {
  // Monthly incomes
  const incomeX = incomes
    .filter(i => i.partner_label === 'X')
    .reduce((s, i) => s + toMonthly(i.amount, i.frequency_type, i.frequency_param ?? undefined), 0);
  const incomeY = incomes
    .filter(i => i.partner_label === 'Y')
    .reduce((s, i) => s + toMonthly(i.amount, i.frequency_type, i.frequency_param ?? undefined), 0);
  const totalIncome = incomeX + incomeY;
  const incomeRatioX = totalIncome > 0 ? incomeX / totalIncome : 0.5;

  // Per-expense fair share calculation
  let fairShareX = 0;
  let fairShareY = 0;
  let paidByX = 0;
  let paidByY = 0;

  for (const exp of expenses) {
    const monthly = toMonthly(exp.amount, exp.frequency_type, exp.frequency_param ?? undefined);
    const benefitX = exp.benefit_x / 100;
    const benefitY = 1 - benefitX;

    // Fair share = benefit_ratio * income_ratio (normalized)
    // Each partner's fair share of this expense is proportional to
    // both how much they benefit AND their share of total income
    const weightX = benefitX * incomeRatioX;
    const weightY = benefitY * (1 - incomeRatioX);
    const totalWeight = weightX + weightY || 1;

    fairShareX += monthly * (weightX / totalWeight);
    fairShareY += monthly * (weightY / totalWeight);

    if (exp.payer === 'X') paidByX += monthly;
    else paidByY += monthly;
  }

  const totalExpenses = paidByX + paidByY;
  const balanceX = paidByX - fairShareX; // positive = X overpaid
  const settlement = balanceX; // positive means Y owes X

  return (
    <div className="space-y-6">
      {/* Income summary */}
      <Card>
        <CardHeader>
          <CardTitle>Income Summary</CardTitle>
          <CardDescription>Monthly income breakdown</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <SummaryRow label={partnerX} value={incomeX} suffix="/mo" />
          <SummaryRow label={partnerY} value={incomeY} suffix="/mo" />
          <Separator />
          <SummaryRow label="Total" value={totalIncome} suffix="/mo" bold />
          <p className="text-xs text-muted-foreground">
            Income ratio: {partnerX} {(incomeRatioX * 100).toFixed(0)}% / {partnerY} {((1 - incomeRatioX) * 100).toFixed(0)}%
          </p>
        </CardContent>
      </Card>

      {/* Expense summary */}
      <Card>
        <CardHeader>
          <CardTitle>Expense Summary</CardTitle>
          <CardDescription>Who pays what vs. fair share</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div />
            <div className="font-medium text-center">Paid</div>
            <div className="font-medium text-center">Fair share</div>
            
            <div className="font-medium">{partnerX}</div>
            <div className="text-center">${paidByX.toFixed(2)}</div>
            <div className="text-center">${fairShareX.toFixed(2)}</div>
            
            <div className="font-medium">{partnerY}</div>
            <div className="text-center">${paidByY.toFixed(2)}</div>
            <div className="text-center">${fairShareY.toFixed(2)}</div>
          </div>
          <Separator />
          <SummaryRow label="Total expenses" value={totalExpenses} suffix="/mo" bold />
        </CardContent>
      </Card>

      {/* Settlement */}
      <Card className={settlement === 0 ? '' : 'border-primary/30'}>
        <CardHeader>
          <CardTitle>Settlement</CardTitle>
        </CardHeader>
        <CardContent>
          {Math.abs(settlement) < 0.01 ? (
            <p className="text-center text-muted-foreground py-4">All settled! No payments needed.</p>
          ) : settlement > 0 ? (
            <div className="text-center py-4">
              <p className="text-lg font-semibold text-primary">
                {partnerY} owes {partnerX}
              </p>
              <p className="text-3xl font-bold tracking-tight mt-1">
                ${Math.abs(settlement).toFixed(2)}
                <span className="text-base font-normal text-muted-foreground">/mo</span>
              </p>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-lg font-semibold text-primary">
                {partnerX} owes {partnerY}
              </p>
              <p className="text-3xl font-bold tracking-tight mt-1">
                ${Math.abs(settlement).toFixed(2)}
                <span className="text-base font-normal text-muted-foreground">/mo</span>
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryRow({ label, value, suffix = '', bold = false }: { label: string; value: number; suffix?: string; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${bold ? 'font-semibold' : ''}`}>
      <span>{label}</span>
      <span>${value.toFixed(2)}{suffix}</span>
    </div>
  );
}
