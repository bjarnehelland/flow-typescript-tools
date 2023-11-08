import { exists, walk } from "https://deno.land/std@0.205.0/fs/mod.ts";

export async function findBasePath() {
  let base: string | undefined = undefined;
  for await (const walkEntry of walk(Deno.cwd(), {
    exts: ["json"],
    match: [/config\.json/],
    includeDirs: false,
    maxDepth: 6,
  })) {
    if (walkEntry.path.toLowerCase().endsWith("process/config.json")) {
      base = walkEntry.path.split("/").slice(0, -1).join("/");
    }
  }

  return base;
}

export async function cleanOutputDir(outputDir: string) {
  if (await exists(outputDir)) {
    await Deno.remove(outputDir, { recursive: true });
  }
  await Deno.mkdir(outputDir, { recursive: true });
}
