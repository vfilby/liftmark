#!/usr/bin/env npx --prefix=../validator tsx
/**
 * LMWF Spec Generator
 *
 * Reads spec-template.md, validates all referenced example files against the
 * parser, and produces the final LIFTMARK_WORKOUT_FORMAT_SPEC.md.
 *
 * Usage:
 *   npx --prefix=../validator tsx generate-spec.ts          # Generate spec
 *   npx --prefix=../validator tsx generate-spec.ts --check   # Validate only
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseWorkout } from '../validator/src/parser/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const TEMPLATE_PATH = resolve(__dirname, 'spec-template.md');
const OUTPUT_PATH = resolve(__dirname, 'LIFTMARK_WORKOUT_FORMAT_SPEC.md');
const EXAMPLES_DIR = resolve(__dirname, 'examples');

// Matches: <!-- EXAMPLE: path/to/file.md --> or <!-- EXAMPLE: path/to/file.md EXPECT_ERROR -->
const EXAMPLE_RE = /^<!-- EXAMPLE: (.+?)(\s+EXPECT_ERROR)? -->$/;

interface ValidationResult {
  file: string;
  expectError: boolean;
  success: boolean;
  errors: string[];
  warnings: string[];
}

function processExample(relPath: string, expectError: boolean): { output: string; result: ValidationResult } {
  const absPath = resolve(EXAMPLES_DIR, relPath);
  let content: string;
  try {
    content = readFileSync(absPath, 'utf-8');
  } catch {
    throw new Error(`Example file not found: ${relPath} (looked at ${absPath})`);
  }

  // Remove trailing newline for clean display in code block
  const displayContent = content.replace(/\n+$/, '');

  const parseResult = parseWorkout(content);

  const result: ValidationResult = {
    file: relPath,
    expectError,
    success: parseResult.success,
    errors: parseResult.errors,
    warnings: parseResult.warnings,
  };

  let output = '```markdown\n' + displayContent + '\n```';

  if (expectError) {
    // For error examples, append the actual validator error messages
    if (parseResult.errors.length > 0) {
      output += '\n' + parseResult.errors.map(e => `❌ ${e}`).join('\n');
    }
    if (parseResult.warnings.length > 0) {
      output += '\n' + parseResult.warnings.map(w => `⚠️ ${w}`).join('\n');
    }
  }

  return { output, result };
}

function generate(checkOnly: boolean): boolean {
  const template = readFileSync(TEMPLATE_PATH, 'utf-8');
  const lines = template.split('\n');
  const outputLines: string[] = [];
  const results: ValidationResult[] = [];
  let hasFailures = false;

  for (const line of lines) {
    const match = line.trim().match(EXAMPLE_RE);
    if (!match) {
      outputLines.push(line);
      continue;
    }

    const relPath = match[1];
    const expectError = !!match[2];

    try {
      const { output, result } = processExample(relPath, expectError);
      results.push(result);
      outputLines.push(output);
    } catch (err) {
      console.error(`❌ ${(err as Error).message}`);
      hasFailures = true;
      outputLines.push(line); // Keep the marker as-is
    }
  }

  // Check results
  for (const r of results) {
    if (r.expectError) {
      if (r.success) {
        console.error(`❌ FAIL: ${r.file} — expected validation errors but parsed successfully`);
        hasFailures = true;
      } else {
        console.log(`✓ ${r.file} — correctly fails: ${r.errors[0]}`);
      }
    } else {
      if (!r.success) {
        console.error(`❌ FAIL: ${r.file} — expected valid but got errors:`);
        for (const e of r.errors) {
          console.error(`    ${e}`);
        }
        hasFailures = true;
      } else {
        const warnSuffix = r.warnings.length > 0 ? ` (${r.warnings.length} warning(s))` : '';
        console.log(`✓ ${r.file}${warnSuffix}`);
      }
    }
  }

  console.log(`\n${results.length} examples processed`);

  if (hasFailures) {
    console.error('\n❌ Generation failed — fix the errors above');
    return false;
  }

  if (!checkOnly) {
    const output = outputLines.join('\n');
    writeFileSync(OUTPUT_PATH, output, 'utf-8');
    console.log(`\n✅ Generated ${OUTPUT_PATH}`);
  } else {
    console.log('\n✅ All examples valid (check mode, no file written)');
  }

  return true;
}

const checkOnly = process.argv.includes('--check');
const success = generate(checkOnly);
process.exit(success ? 0 : 1);
