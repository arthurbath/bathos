// @vitest-environment node

import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import {
  hasBathosSentenceCaseStarts,
  isBathosSentenceCase,
  isBathosTitleCase,
} from '@/lib/uiTextCase';

type GovernedPhrase = {
  category: string;
  file: string;
  line: number;
  text: string;
};

const SOURCE_ROOT = path.resolve(process.cwd(), 'src');
const TITLE_COMPONENTS = new Set([
  'AlertDialogTitle',
  'CardTitle',
  'DialogTitle',
  'DrawerTitle',
  'SheetTitle',
  'ToastTitle',
]);
const CONTROL_COMPONENTS = new Set([
  'Button',
  'DataGridAddFormLabel',
  'Label',
  'SelectLabel',
  'button',
  'label',
]);
const OPTION_COMPONENTS = new Set([
  'DropdownMenuItem',
  'GridSelectItem',
  'SelectItem',
  'option',
]);
const ACCESSIBLE_CONTROL_ELEMENTS = new Set([
  'Button',
  'GridSelectTrigger',
  'Input',
  'SelectTrigger',
  'Textarea',
  'button',
  'input',
  'select',
  'textarea',
]);

function listSourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listSourceFiles(entryPath);
    if (!/\.(ts|tsx)$/u.test(entry.name) || /\.test\.(ts|tsx)$/u.test(entry.name)) return [];
    return [entryPath];
  });
}

function getJsxElementName(node: ts.JsxElement | ts.JsxSelfClosingElement) {
  return ts.isJsxElement(node)
    ? node.openingElement.tagName.getText()
    : node.tagName.getText();
}

function getStaticJsxText(node: ts.JsxElement): string | null {
  const parts: string[] = [];
  let dynamic = false;

  const visitChild = (child: ts.JsxChild) => {
    if (ts.isJsxText(child)) {
      parts.push(child.text);
      return;
    }
    if (ts.isJsxExpression(child)) {
      if (!child.expression) return;
      if (ts.isStringLiteral(child.expression) || ts.isNoSubstitutionTemplateLiteral(child.expression)) {
        parts.push(child.expression.text);
        return;
      }
      dynamic = true;
      return;
    }
    if (ts.isJsxElement(child)) {
      const nested = getStaticJsxText(child);
      if (nested === null) dynamic = true;
      else parts.push(nested);
    }
  };

  node.children.forEach(visitChild);
  if (dynamic) return null;
  const value = parts.join(' ').replace(/\s+/gu, ' ').trim();
  return value || null;
}

function getLiteralAttribute(
  attributes: ts.JsxAttributes,
  attributeName: string,
): { node: ts.Node; text: string } | null {
  const attribute = attributes.properties.find(
    (property): property is ts.JsxAttribute =>
      ts.isJsxAttribute(property) && property.name.getText() === attributeName,
  );
  if (!attribute?.initializer) return null;
  if (ts.isStringLiteral(attribute.initializer)) {
    return { node: attribute, text: attribute.initializer.text };
  }
  if (
    ts.isJsxExpression(attribute.initializer) &&
    attribute.initializer.expression &&
    (ts.isStringLiteral(attribute.initializer.expression) ||
      ts.isNoSubstitutionTemplateLiteral(attribute.initializer.expression))
  ) {
    return { node: attribute, text: attribute.initializer.expression.text };
  }
  return null;
}

function getStaticConditionalBranches(
  expression: ts.Expression | undefined,
): Array<{ node: ts.Node; text: string }> {
  if (!expression) return [];
  if (ts.isParenthesizedExpression(expression)) {
    return getStaticConditionalBranches(expression.expression);
  }
  if (ts.isConditionalExpression(expression)) {
    return [
      ...getStaticConditionalBranches(expression.whenTrue),
      ...getStaticConditionalBranches(expression.whenFalse),
    ];
  }
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
    return [{ node: expression, text: expression.text }];
  }
  if (ts.isTemplateExpression(expression)) {
    const text = [
      expression.head.text,
      ...expression.templateSpans.flatMap((span) => ['Value', span.literal.text]),
    ].join('');
    return [{ node: expression, text }];
  }
  return [];
}

function isInsideToastCall(node: ts.Node, sourceFile: ts.SourceFile) {
  let current: ts.Node | undefined = node;
  for (let depth = 0; depth < 5 && current; depth += 1, current = current.parent) {
    if (
      ts.isCallExpression(current) &&
      /(^|\.)toast$/u.test(current.expression.getText(sourceFile))
    ) {
      return true;
    }
  }
  return false;
}

function isInsideToastBuilder(node: ts.Node) {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (
      ts.isFunctionDeclaration(current) &&
      current.name &&
      /Toast/u.test(current.name.text)
    ) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

function isInsideSemanticHeading(node: ts.Node) {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (
      ts.isJsxElement(current) &&
      /^h[1-6]$/u.test(getJsxElementName(current))
    ) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

function collectGovernedPhrases(): {
  titleCase: GovernedPhrase[];
  sentenceCase: GovernedPhrase[];
} {
  const titleCase: GovernedPhrase[] = [];
  const sentenceCase: GovernedPhrase[] = [];

  const add = (
    target: GovernedPhrase[],
    category: string,
    text: string,
    node: ts.Node,
    sourceFile: ts.SourceFile,
  ) => {
    if (!/[A-Za-z]/u.test(text)) return;
    target.push({
      category,
      file: path.relative(process.cwd(), sourceFile.fileName),
      line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
      text,
    });
  };

  listSourceFiles(SOURCE_ROOT).forEach((fileName) => {
    const sourceFile = ts.createSourceFile(
      fileName,
      fs.readFileSync(fileName, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );

    const visit = (node: ts.Node) => {
      if (ts.isJsxElement(node)) {
        const elementName = getJsxElementName(node);
        const text = getStaticJsxText(node);
        const titleCaseElement =
          /^h[1-6]$/u.test(elementName) ||
          TITLE_COMPONENTS.has(elementName) ||
          CONTROL_COMPONENTS.has(elementName) ||
          OPTION_COMPONENTS.has(elementName);
        if (text) {
          if (titleCaseElement) {
            add(titleCase, elementName, text, node, sourceFile);
          } else if (
            /^No\b/u.test(text) &&
            ['div', 'p', 'span'].includes(elementName) &&
            !isInsideSemanticHeading(node)
          ) {
            add(sentenceCase, 'empty state', text, node, sourceFile);
          }
        }
        if (titleCaseElement) {
          node.children.forEach((child) => {
            if (!ts.isJsxExpression(child)) return;
            getStaticConditionalBranches(child.expression).forEach((branch) => {
              add(titleCase, elementName, branch.text, branch.node, sourceFile);
            });
          });
        }
      }

      if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
        const elementName = getJsxElementName(node);
        const attributes = ts.isJsxElement(node)
          ? node.openingElement.attributes
          : node.attributes;
        const placeholder = getLiteralAttribute(attributes, 'placeholder');
        if (placeholder) {
          add(titleCase, 'placeholder', placeholder.text, placeholder.node, sourceFile);
        }
        attributes.properties.forEach((property) => {
          if (
            !ts.isJsxAttribute(property) ||
            !property.initializer ||
            !ts.isJsxExpression(property.initializer)
          ) {
            return;
          }
          const attributeName = property.name.getText();
          const branches = getStaticConditionalBranches(property.initializer.expression);
          if (
            attributeName === 'placeholder' ||
            (
              ACCESSIBLE_CONTROL_ELEMENTS.has(elementName) &&
              ['aria-label', 'title'].includes(attributeName)
            )
          ) {
            branches.forEach((branch) => {
              add(titleCase, attributeName, branch.text, branch.node, sourceFile);
            });
          }
          if (attributeName === 'emptyMessage') {
            branches
              .filter((branch) => /^No\b/u.test(branch.text))
              .forEach((branch) => {
                add(sentenceCase, 'empty state', branch.text, branch.node, sourceFile);
              });
          }
          if (/[A-Za-z]+(?:Placeholder|Title)$/u.test(attributeName)) {
            branches.forEach((branch) => {
              add(titleCase, attributeName, branch.text, branch.node, sourceFile);
            });
          }
        });
        const emptyMessage = getLiteralAttribute(attributes, 'emptyMessage');
        if (emptyMessage && /^No\b/u.test(emptyMessage.text)) {
          add(
            sentenceCase,
            'empty state',
            emptyMessage.text,
            emptyMessage.node,
            sourceFile,
          );
        }
        attributes.properties.forEach((property) => {
          if (
            !ts.isJsxAttribute(property) ||
            !/[A-Za-z]+(?:Placeholder|Title)$/u.test(property.name.getText())
          ) {
            return;
          }
          const title = getLiteralAttribute(attributes, property.name.getText());
          if (title) {
            add(
              titleCase,
              property.name.getText(),
              title.text,
              title.node,
              sourceFile,
            );
          }
        });
        if (ACCESSIBLE_CONTROL_ELEMENTS.has(elementName)) {
          for (const attributeName of ['aria-label', 'title']) {
            const label = getLiteralAttribute(attributes, attributeName);
            if (label) {
              add(
                titleCase,
                `${elementName} ${attributeName}`,
                label.text,
                label.node,
                sourceFile,
              );
            }
          }
        }
      }

      if (
        ts.isObjectLiteralExpression(node) &&
        (isInsideToastCall(node, sourceFile) || isInsideToastBuilder(node))
      ) {
        node.properties.forEach((property) => {
          if (
            !ts.isPropertyAssignment(property) ||
            !ts.isIdentifier(property.name) ||
            !['description', 'title'].includes(property.name.text)
          ) {
            return;
          }
          const target = property.name.text === 'title' ? titleCase : sentenceCase;
          getStaticConditionalBranches(property.initializer).forEach((branch) => {
            add(
              target,
              `toast ${property.name.text}`,
              branch.text,
              branch.node,
              sourceFile,
            );
          });
        });
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
  });

  return { titleCase, sentenceCase };
}

function formatViolations(
  phrases: GovernedPhrase[],
  validator: (value: string) => boolean,
) {
  return phrases
    .filter((phrase) => !validator(phrase.text))
    .map(
      (phrase) =>
        `${phrase.file}:${phrase.line} [${phrase.category}] ${JSON.stringify(phrase.text)}`,
    );
}

const TITLE_CASE_STATIC_FRAGMENT_EXCEPTIONS = new Set([
  'Households are module-specific',
  'I Agree to the',
]);

describe('BathOS source-authored UI casing policy', () => {
  const governedPhrases = collectGovernedPhrases();

  it('evaluates parsed governed phrases with the shared casing rules', () => {
    const parsedTitle = governedPhrases.titleCase.find(
      (phrase) => phrase.text === 'Failed to Validate CSV',
    );
    expect(parsedTitle?.text).toBe('Failed to Validate CSV');
    expect(parsedTitle ? isBathosTitleCase(parsedTitle.text) : false).toBe(true);
    expect(
      formatViolations(governedPhrases.titleCase, isBathosTitleCase).some((violation) =>
        violation.includes('Failed to Validate CSV'),
      ),
    ).toBe(false);
  });

  it('keeps governed titles, controls, options, and placeholders in title case', () => {
    expect(
      formatViolations(
        governedPhrases.titleCase.filter(
          (phrase) => !TITLE_CASE_STATIC_FRAGMENT_EXCEPTIONS.has(phrase.text),
        ),
        isBathosTitleCase,
      ),
    ).toEqual([]);
  });

  it('keeps empty-state messages and toast bodies in sentence case', () => {
    const violations = governedPhrases.sentenceCase.flatMap((phrase) => {
      const isCompliant =
        phrase.category === 'toast description'
          ? hasBathosSentenceCaseStarts(phrase.text)
          : isBathosSentenceCase(phrase.text);
      return isCompliant
        ? []
        : [
            `${phrase.file}:${phrase.line} [${phrase.category}] ${JSON.stringify(phrase.text)}`,
          ];
    });
    expect(violations).toEqual([]);
  });
});
