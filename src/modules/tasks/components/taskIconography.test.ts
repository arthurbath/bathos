import {
  ArrowBigRightDash,
  Circle,
  CircleCheck,
  FileText,
  Flag,
  Lasso,
  Layers3,
  Link2,
  ListChecks,
  ListTree,
  NotepadText,
  Paperclip,
  Plus,
  Play,
  Square,
  SquareCheck,
  SquareCheckBig,
  SquareDashed,
  SquareX,
  Sparkles,
  Star,
  Zap,
} from 'lucide-react';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  createSourceFile,
  isImportDeclaration,
  isNamedImports,
  ScriptKind,
  ScriptTarget,
} from 'typescript';
import { describe, expect, it } from 'vitest';

import {
  TASK_ICON_NAMES,
  TASK_ICONS,
  type TaskIconConcept,
} from '@/modules/tasks/components/taskIconography';

describe('Tasks iconography', () => {
  it('uses the approved concept overrides', () => {
    expect(TASK_ICONS.Task).toBe(SquareCheckBig);
    expect(TASK_ICONS.OpenTask).toBe(Square);
    expect(TASK_ICONS.SomedayTask).toBe(SquareDashed);
    expect(TASK_ICONS.CompletedTask).toBe(SquareCheck);
    expect(TASK_ICONS.DeletedTask).toBe(SquareX);
    expect(TASK_ICON_NAMES.DeletedTask).toBe('SquareX');
    expect(TASK_ICONS.Selection).toBe(Circle);
    expect(TASK_ICONS.Selected).toBe(CircleCheck);
    expect(TASK_ICONS.Area).toBe(Layers3);
    expect(TASK_ICONS.Notes).toBe(NotepadText);
    expect(TASK_ICONS.TaskChecklist).toBe(ListTree);
    expect(TASK_ICONS.Attachment).toBe(Paperclip);
    expect(TASK_ICONS.Someday).toBe(SquareDashed);
    expect(TASK_ICONS.Done).toBe(ListChecks);
    expect(TASK_ICONS.Today).toBe(Star);
    expect(TASK_ICONS.AddTask).toBe(Plus);
    expect(TASK_ICONS.AddArea).toBe(Plus);
    expect(TASK_ICONS.MultiSelect).toBe(Lasso);
    expect(TASK_ICONS.EmptyState).toBe(Sparkles);
    expect(TASK_ICONS.JiraLink).toBe(Zap);
    expect(TASK_ICONS.ObsidianLink).toBe(FileText);
    expect(TASK_ICONS.PrimaryLink).toBe(Link2);
    expect(TASK_ICONS.Start).toBe(Play);
    expect(TASK_ICONS.Deadline).toBe(Flag);
    expect(TASK_ICONS.Ready).toBe(ArrowBigRightDash);
  });

  it('records every registered concept in the human iconography reference', () => {
    const documentation = readFileSync(
      resolve(process.cwd(), 'docs/human/TASKS_ICONOGRAPHY.md'),
      'utf8',
    );

    for (const [concept, lucideName] of Object.entries(TASK_ICON_NAMES) as [
      TaskIconConcept,
      string,
    ][]) {
      expect(documentation).toContain(`| ${concept} | \`${lucideName}\``);
    }
  });

  it('routes documented concept icons through the canonical registry', () => {
    const componentDirectory = resolve(
      process.cwd(),
      'src/modules/tasks/components',
    );
    const canonicalIconNames: readonly string[] = [
      ...new Set<string>(Object.values(TASK_ICON_NAMES)),
    ];
    const bypasses = readdirSync(componentDirectory)
      .filter((fileName) => (
        /\.(ts|tsx)$/.test(fileName)
        && fileName !== 'taskIconography.ts'
        && !fileName.includes('.test.')
      ))
      .flatMap((fileName) => {
        const source = readFileSync(resolve(componentDirectory, fileName), 'utf8');
        const sourceFile = createSourceFile(
          fileName,
          source,
          ScriptTarget.Latest,
          true,
          fileName.endsWith('.tsx') ? ScriptKind.TSX : ScriptKind.TS,
        );
        return sourceFile.statements.flatMap((statement) => {
          if (
            !isImportDeclaration(statement)
            || statement.moduleSpecifier.getText(sourceFile) !== "'lucide-react'"
            || !statement.importClause?.namedBindings
            || !isNamedImports(statement.importClause.namedBindings)
          ) {
            return [];
          }
          return statement.importClause.namedBindings.elements
            .map((element) => element.propertyName?.text ?? element.name.text)
            .filter((iconName) => canonicalIconNames.includes(iconName))
            .map((iconName) => `${fileName}:${iconName}`);
        });
      });

    expect(bypasses).toEqual([]);
  });
});
