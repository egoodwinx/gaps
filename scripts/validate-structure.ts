#!/usr/bin/env node

/**
 * Validates the structure of a GAP directory.
 *
 * Usage: ./scripts/validate-structure.ts <gap-directory>
 *
 * Can be xarg'd over all GAP directories:
 *   find ./gaps -maxdepth 1 -type d -name 'GAP-*' | xargs -I{} node scripts/validate-structure.ts {}
 */

import { access, constants, readFile, readdir, stat } from "node:fs/promises";
import { basename, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { Ajv2020 as Ajv } from "ajv/dist/2020.js";
import { parse as parseYaml } from "yaml";
import validator from "validator";

async function exists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load JSON Schema from root directory
const schemaPath = join(__dirname, "..", "metadata.schema.json");
const metadataSchema = JSON.parse(await readFile(schemaPath, "utf8"));

// Set up ajv with JSON Schema
const ajv = new Ajv({ allErrors: true });
const validateMetadataSchema = ajv.compile(metadataSchema);

function error(gapName: string, message: string) {
  console.error(`${gapName}: ${message}`);
  process.exit(1);
}

function validateDirectoryNaming(dirPath: string) {
  const dirName = basename(dirPath);

  // Special case: GAP-0 is allowed
  if (dirName === "GAP-0") {
    return dirName;
  }

  // Must match GAP-N format (one or more digits, no zero pad)
  if (!/^GAP-[1-9]\d*$/.test(dirName)) {
    error(
      dirName,
      `Invalid directory name format. Expected GAP-N (e.g. GAP-10, GAP-123)`,
    );
  }

  return dirName;
}

async function validateReadmeExists(dirPath: string, gapName: string) {
  const readmePath = join(dirPath, "README.md");
  if (!(await exists(readmePath))) {
    error(gapName, "No README.md file found");
  }
}

async function validateMetadata(dirPath: string, gapName: string) {
  const metadataPath = join(dirPath, "metadata.yml");

  if (!(await exists(metadataPath))) {
    error(gapName, "No metadata.yml file found");
  }

  let content;
  try {
    content = await readFile(metadataPath, "utf8");
  } catch (err) {
    error(gapName, `Failed to read metadata.yml: ${String(err)}`);
    return;
  }

  let metadata;
  try {
    metadata = parseYaml(content);
  } catch (err) {
    error(gapName, `Invalid YAML in metadata.yml: ${String(err)}`);
    return;
  }

  if (typeof metadata !== "object") {
    error(gapName, "metadata.yml must contain a valid YAML object");
    return;
  }

  // Validate against JSON Schema
  const valid = validateMetadataSchema(metadata);
  if (!valid) {
    const errors = validateMetadataSchema
      .errors!.map((err) => {
        const prefix = err.instancePath ? `${err.instancePath}: ` : "";
        return `${prefix}${err.message}`;
      })
      .join("\n");
    error(gapName, `metadata.yml validation failed:\n\n${errors}`);
    return;
  }

  // Validate authors have valid email
  for (const author of metadata.authors) {
    if (!validator.isEmail(author.email)) {
      error(
        gapName,
        `metadata.yml invalid author email "${author.email}" for "${author.name}"`,
      );
    }
  }

  // Validate discussion is a valid URL
  if (!validator.isURL(metadata.discussion)) {
    error(
      gapName,
      `metadata.yml discussion must be a valid URL (got "${metadata.discussion}")`,
    );
  }
}

async function validateAllowedFiles(dirPath: string, gapName: string) {
  const entries = await readdir(dirPath);
  const promises = entries.map(async (entry) => {
    if (entry.startsWith(".")) {
      error(gapName, `Dotfiles are not allowed: "${entry}".`);
      return;
    }

    const fullPath = join(dirPath, entry);

    if ((await stat(fullPath)).isDirectory()) {
      if (entry === "versions") {
        await validateVersionsDir(fullPath, gapName);
      } else {
        error(gapName, `Unexpected directory "${entry}".`);
      }
      return;
    }

    if (
      entry === "metadata.yml" ||
      entry === "metadata.json" ||
      entry.endsWith(".md")
    ) {
      return;
    }

    error(gapName, `Unexpected file "${entry}".`);
  });
  await Promise.all(promises);
}

async function validateVersionsDir(dirPath: string, gapName: string) {
  const entries = await readdir(dirPath);
  const promises = entries.map(async (entry) => {
    if (entry.startsWith(".")) {
      error(gapName, `Dotfiles are not allowed in versions/: "${entry}".`);
      return;
    }

    if ((await stat(join(dirPath, entry))).isDirectory()) {
      error(gapName, `Unexpected directory in versions/: "${entry}".`);
      return;
    }

    if (!/^\d{4}-\d{2}\.(md|yml)$/.test(entry)) {
      error(
        gapName,
        `Unexpected file in versions/: "${entry}". Only YYYY-MM.md and YYYY-MM.yml are allowed.`,
      );
    }
  });
  await Promise.all(promises);
}

async function main() {
  const { positionals } = parseArgs({ allowPositionals: true, strict: true });

  if (positionals.length !== 1) {
    console.error("Usage: ./scripts/validate-structure.ts <gap-directory>");
    process.exit(1);
  }

  const dirPath = positionals[0];

  if (!(await exists(dirPath))) {
    console.error(`Directory does not exist: ${dirPath}`);
    process.exit(1);
  }

  if (!(await stat(dirPath)).isDirectory()) {
    console.error(`Not a directory: ${dirPath}`);
    process.exit(1);
  }

  // Validate directory naming
  const gapName = validateDirectoryNaming(dirPath);

  // Validate only allowed files are present
  await validateAllowedFiles(dirPath, gapName);

  // Validate README.md exists
  await validateReadmeExists(dirPath, gapName);

  // Validate metadata.yml
  await validateMetadata(dirPath, gapName);
}

await main();
