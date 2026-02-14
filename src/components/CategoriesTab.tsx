import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import type { Category } from '@/hooks/useCategories';

interface CategoriesTabProps {
  categories: Category[];
  onAdd: (name: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}

export function CategoriesTab({ categories, onAdd, onRemove }: CategoriesTabProps) {
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    if (!name.trim()) return;
    setAdding(true);
    try {
      await onAdd(name.trim());
      setName('');
    } catch (e: any) {
      toast({ title: 'Error adding category', description: e.message, variant: 'destructive' });
    }
    setAdding(false);
  };

  const handleRemove = async (id: string) => {
    try {
      await onRemove(id);
    } catch (e: any) {
      toast({ title: 'Error removing category', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Add Category</CardTitle>
          <CardDescription>Organize your expenses into categories.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="e.g. Housing, Food, Transport"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
            <Button onClick={handleAdd} disabled={!name.trim() || adding} className="gap-1.5 shrink-0">
              <Plus className="h-4 w-4" /> Add
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Categories</CardTitle>
          <CardDescription>{categories.length} categories</CardDescription>
        </CardHeader>
        <CardContent>
          {categories.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No categories yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map(cat => (
                  <TableRow key={cat.id}>
                    <TableCell className="font-medium">{cat.name}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleRemove(cat.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
