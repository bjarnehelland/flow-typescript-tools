import { compile, JSONSchema } from "npm:json-schema-to-typescript";
import { cleanOutputDir, findBasePath } from "./utils.ts";

async function process(base: string, generateOutputFiles: boolean) {
  const outputDir = `${base}/_types/decisions/generated`;
  let data: JSONSchema;
  try {
    const res = await fetch("http://localhost:8080/openapi.json");
    const json = await res.json();

    data = json;
  } catch {
    console.error("Unable to connect to flow-decision-engine");
    console.error("Run: stacc forward flow-decision-engine");
    return;
  }

  await cleanOutputDir(outputDir);

  for (const key of Object.keys(data.paths).filter((key) =>
    key.endsWith("/evaluate")
  )) {
    if (data.paths[key].post) {
      const outputFileName = key.split("/").at(-2) as string;
      const inputSchema =
        data.paths[key].post.requestBody.content["application/json"].schema;
      const outputSchema =
        data.paths[key].post.responses["200"].content["application/json"]
          .schema;
      await processSchema(
        outputDir,
        inputSchema,
        outputFileName,
        generateOutputFiles ? "input" : ""
      );
      if (generateOutputFiles) {
        await processSchema(outputDir, outputSchema, outputFileName, "output");
      }
    }
  }
}

async function processSchema(
  outputDir: string,
  schema: JSONSchema,
  outputFileName: string,
  sufix = ""
) {
  sufix = sufix ? `-${sufix}` : "";
  const ts = await compile(schema, outputFileName, {
    additionalProperties: false,
    unreachableDefinitions: true,
  });

  console.log(`Writing type ${outputFileName}${sufix}.ts`);

  await Deno.writeTextFile(`${outputDir}/${outputFileName}${sufix}.ts`, ts);
}

export async function generateDecisions(generateOutputFiles: boolean) {
  const base = await findBasePath();

  if (base) {
    await process(base, generateOutputFiles);
  } else {
    console.log("Base path not found");
  }
}
