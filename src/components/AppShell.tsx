import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Household, Category, IncomeStream, Expense, RestorePoint } from '@/types/fairshare';
import { DollarSign, PieChart, BarChart3, Tag, History, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AppShellProps {
  household: Household;
  onReset: () => void;
}

export function AppShell({ household, onReset }: AppShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-4 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <h1 className="text-lg font-bold tracking-tight text-foreground">
            FairShare
          </h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {household.partnerX} & {household.partnerY}
            </span>
            <Button variant="ghost" size="icon" onClick={onReset} title="Reset household">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <Tabs defaultValue="incomes">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="incomes" className="gap-1.5 text-xs sm:text-sm">
              <DollarSign className="h-4 w-4" />
              <span className="hidden sm:inline">Incomes</span>
            </TabsTrigger>
            <TabsTrigger value="expenses" className="gap-1.5 text-xs sm:text-sm">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Expenses</span>
            </TabsTrigger>
            <TabsTrigger value="summary" className="gap-1.5 text-xs sm:text-sm">
              <PieChart className="h-4 w-4" />
              <span className="hidden sm:inline">Summary</span>
            </TabsTrigger>
            <TabsTrigger value="categories" className="gap-1.5 text-xs sm:text-sm">
              <Tag className="h-4 w-4" />
              <span className="hidden sm:inline">Categories</span>
            </TabsTrigger>
            <TabsTrigger value="restore" className="gap-1.5 text-xs sm:text-sm">
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">Restore</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="incomes">
            <PlaceholderTab title="Incomes" description="Manage income streams for each partner." />
          </TabsContent>
          <TabsContent value="expenses">
            <PlaceholderTab title="Expenses" description="Add and manage shared expenses." />
          </TabsContent>
          <TabsContent value="summary">
            <PlaceholderTab title="Summary" description="See how expenses are split and who owes whom." />
          </TabsContent>
          <TabsContent value="categories">
            <PlaceholderTab title="Categories" description="Organize expenses by category." />
          </TabsContent>
          <TabsContent value="restore">
            <PlaceholderTab title="Restore Points" description="Save and restore budget snapshots." />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function PlaceholderTab({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 py-20 text-center">
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      <p className="mt-4 text-xs text-muted-foreground/60">Coming in the next phase</p>
    </div>
  );
}
