#!/usr/bin/env node

import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";

const rootDir = join(import.meta.dirname, "..");
const gapsDir = join(rootDir, "gaps");

async function getGapDirs() {
  const entries = await readdir(gapsDir, { withFileTypes: true });
  return entries.filter(
    (d) => d.isDirectory() && /^GAP-[1-9]\d*$/.test(d.name),
  );
}

async function main() {
  const dirs = await getGapDirs();
  dirs.sort(
    (a, b) =>
      parseInt(a.name.split("-")[1], 10) - parseInt(b.name.split("-")[1], 10),
  );

  const lines = await Promise.all(
    dirs.map(async (dir) => {
      const metadataPath = join(gapsDir, dir.name, "metadata.yml");
      const metadata = parseYaml(await readFile(metadataPath, "utf8"));
      const owners = metadata.authors.map((a) =>
        a.githubUsername.replace(/^@/, ""),
      );
      const ownerList = owners.map((o) => `@${o}`).join(" ");
      return `/gaps/${dir.name}/ ${ownerList}`;
    }),
  );

  await writeFile(join(rootDir, "CODEOWNERS"), lines.join("\n") + "\n");
}

main();
