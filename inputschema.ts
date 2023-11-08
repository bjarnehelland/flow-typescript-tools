import { compileFromFile } from "npm:json-schema-to-typescript";
import { exists } from "https://deno.land/std@0.205.0/fs/mod.ts";
import { cleanOutputDir, findBasePath } from "./utils.ts";

interface Output {
  file: string;
  interfaceName: string;
  importStr: string;
  updateInterfaces: {
    name: string;
    position: number;
  }[];
}

async function process(base: string, processNames: string[]) {
  for (const processName of processNames) {
    const inputDir = `${base}/${processName}/schema`;
    const outputDir = `${base}/${processName}/types/input`;
    const list = await handlerList(base, processName);

    const schemas: string[] = [];
    for await (const dirEntry of Deno.readDir(inputDir)) {
      if (dirEntry.isFile) {
        schemas.push(dirEntry.name.replace(".json", ""));
      }
    }

    await cleanOutputDir(outputDir);

    console.log("");
    console.log(`--${processName}--`);
    for (const schema of schemas) {
      console.log(`Reading schema ${schema}.json`);
      const ts = await compileFromFile(`${inputDir}/${schema}.json`, {
        additionalProperties: false,
      });
      const outputFileName = schema.replace(".schema", "");
      console.log(`Writing type ${outputFileName}.ts`);

      await Deno.writeTextFile(`${outputDir}/${outputFileName}.ts`, ts);

      if (list.has(outputFileName)) {
        updateHandler(list, outputFileName);
      }
    }
  }
}

async function processUserTasks(base: string, processName: string) {
  const dir = `${base}/${processName}/handlers/user-tasks`;
  if (!(await exists(dir))) {
    return new Map<string, Output>();
  }

  const files: string[] = [];
  for await (const dirEntry of Deno.readDir(dir)) {
    if (dirEntry.isFile) {
      files.push(dirEntry.name.replace(".ts", ""));
    }
  }

  return files.reduce((list, handler) => {
    const interfaceName = toPascalCase(handler);
    list.set(handler, {
      file: `${dir}/${handler}.ts`,
      interfaceName: interfaceName,
      importStr: `import { ${interfaceName} } from '../../types/input/${handler}';`,
      updateInterfaces: [
        {
          name: "UserTaskHandler",
          position: 4,
        },
        {
          name: "UserTaskExecuteProps",
          position: 3,
        },
      ],
    });
    return list;
  }, new Map<string, Output>());
}

async function processMessageTasks(base: string, processName: string) {
  const dir = `${base}/${processName}/handlers/message-tasks`;
  if (!(await exists(dir))) {
    return new Map<string, Output>();
  }

  const files: string[] = [];
  for await (const dirEntry of Deno.readDir(dir)) {
    if (dirEntry.isFile) {
      files.push(dirEntry.name.replace(".ts", ""));
    }
  }
  return files.reduce((list, handler) => {
    const interfaceName = toPascalCase(handler);
    list.set(handler, {
      file: `${dir}/${handler}.ts`,
      interfaceName: interfaceName,
      importStr: `import { ${interfaceName} } from '../../types/input/${handler}';`,
      updateInterfaces: [
        {
          name: "MessageTaskHandler",
          position: 4,
        },
        {
          name: "MessageTaskExecuteProps",
          position: 3,
        },
      ],
    });
    return list;
  }, new Map<string, Output>());
}

function processRootTasks(base: string, processName: string) {
  const dir = `${base}/${processName}/handlers`;
  const list = new Map<string, Output>();
  list.set("start", {
    file: `${dir}/start.ts`,
    interfaceName: "Start",
    importStr: `import { Start } from '../types/input/start';`,
    updateInterfaces: [
      {
        name: "StartHandler",
        position: 4,
      },
      {
        name: "StartHandlerExecuteProps",
        position: 1,
      },
    ],
  });
  return list;
}

async function handlerList(base: string, processName: string) {
  const rootTasks = await processRootTasks(base, processName);
  const userTasks = await processUserTasks(base, processName);
  const messageTasks = await processMessageTasks(base, processName);
  return new Map([...rootTasks, ...userTasks, ...messageTasks]);
}

async function updateHandler(list: Map<string, Output>, handler: string) {
  const output = list.get(handler);
  if (!output) {
    throw new Error(`Handler ${handler} not found`);
  }
  const { interfaceName, file, importStr, updateInterfaces } = output;
  try {
    let content = await Deno.readTextFile(file);

    const lines = content.split("\n");
    const hasImport = lines.some(
      (line) => line.includes(`${handler}"`) || line.includes(`${handler}'`)
    );

    if (hasImport) {
      return;
    }

    const lastImport = lines[lines.findIndex((line) => line === "") - 1];
    content = content.replace(lastImport, `${lastImport}\n${importStr}`);
    updateInterfaces.forEach(({ name, position }) => {
      const searchStr = `${name}<`;
      const startIndex = content.indexOf(searchStr) + searchStr.length;
      const endIndex = content.indexOf(">", startIndex);

      const oldParams = content.substring(startIndex, endIndex);

      const paramList = oldParams.split(",").map((part) => part.trim());

      paramList[position] = interfaceName;

      const newParams = paramList.join(", ");

      content = content.replace(searchStr + oldParams, searchStr + newParams);
    });

    await Deno.writeTextFile(file, content);
  } catch (error) {
    console.log(error);
  }
}

function toPascalCase(text: string) {
  return text.replace(/(^\w|-\w)/g, clearAndUpper);
}

function clearAndUpper(text: string) {
  return text.replace(/-/, "").toUpperCase();
}

async function getJson(filePath: string) {
  return JSON.parse(await Deno.readTextFile(filePath));
}

async function readConfigAndProcess(base: string) {
  const config = await getJson(`${base}/config.json`);
  process(base, Object.keys(config.processes));
}

export async function generateInputSchema() {
  const base = await findBasePath();

  if (base) {
    await readConfigAndProcess(base);
  } else {
    console.log("Base path not found");
  }
}
