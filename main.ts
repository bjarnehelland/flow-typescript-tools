import Denomander from "https://deno.land/x/denomander@0.9.3/mod.ts";
import { generateInputSchema } from "./inputschema.ts";
import { generateDecisions } from "./decisions.ts";
import { sleep } from "https://deno.land/x/sleep/mod.ts";

const program = new Denomander({
  app_name: "Flow typescript tools",
  app_description:
    "A collection of tools to help with typescript development in Flow",
});

program
  .command("inputschema")
  .description("Generate input schemas typescript types")
  .action(async () => {
    await generateInputSchema();
  });

program
  .command("decisions")
  .option("-o --output", "generate output types", Boolean)
  .description("Generate decisions typescript types")
  .action(async ({ output }: { output: boolean }) => {
    const command = new Deno.Command("stacc", {
      args: ["forward", "flow-decision-engine"],
    });
    const process = command.spawn();

    await sleep(1);
    await generateDecisions(output ?? false);

    process.kill();
  });

program.parse(Deno.args);
