import { exec } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import chalk from "chalk";
import { Command } from "commander";
import inquirer from "inquirer";
import { getStagedDiff } from "./services/git.js";
import { auditDiff } from "./services/openai.js";
import { getApiKey, saveApiKey } from "./utils/config-store.js";

const execAsync = promisify(exec);
const program = new Command();

program
  .name("aegis")
  .description("AI-Powered DevSecOps CLI pre-commit guardrail")
  .version("1.0.0");

// Config subcommands
const configCommand = new Command("config").description("Manage configuration settings");

configCommand
  .command("set-key <key>")
  .description("Store the OpenAI API key locally")
  .action(async (key: string) => {
    try {
      await saveApiKey(key);
      console.log(chalk.green("✔ OpenAI API key saved successfully."));
      process.exit(0);
    } catch (error: unknown) {
      const err = error as Error;
      console.error(chalk.red(`Failed to save configuration: ${err.message || err}`));
      process.exit(1);
    }
  });

program.addCommand(configCommand);

// Audit command
program
  .command("audit")
  .description("Audit staged git changes for security vulnerabilities")
  .action(async () => {
    try {
      // 1. Retrieve API key
      const apiKey = await getApiKey();
      if (!apiKey) {
        console.error(
          chalk.red(
            `Error: OpenAI API key is not configured.\nPlease set it using: ${chalk.bold("aegis config set-key <OPENAI_API_KEY>")} or by setting the ${chalk.bold("OPENAI_API_KEY")} environment variable.`,
          ),
        );
        process.exit(1);
      }

      // 2. Extract git diff
      console.log(chalk.blue("Extracting staged changes..."));
      const diff = await getStagedDiff();
      if (!diff) {
        console.log(chalk.gray("No staged changes found. Security audit skipped."));
        process.exit(0);
      }

      // 3. Analyze diff
      console.log(chalk.blue("Analyzing diff for security vulnerabilities..."));
      const result = await auditDiff(apiKey, diff);

      // 4. Enforce status
      if (result.status === "pass") {
        console.log(chalk.green("\n✔ Aegis Security Audit: PASSED. No vulnerabilities identified.\n"));
        process.exit(0);
      }

      console.error(chalk.red("\n🚨 Aegis Security Audit: FAILED. Vulnerabilities detected:\n"));
      let appliedAny = false;

      for (let i = 0; i < result.issues.length; i++) {
        const issue = result.issues[i];
        console.error(chalk.yellow(`[Issue #${i + 1}]`));
        console.error(chalk.red("  Vulnerability: ") + chalk.white(issue.description));
        console.error(chalk.green("  Suggested Fix: ") + chalk.cyan(issue.suggested_fix));
        console.error(chalk.gray(`  File: ${issue.file}`));
        console.error();

        if (issue.file && issue.target_code) {
          const answers = await inquirer.prompt([
            {
              type: "confirm",
              name: "apply",
              message: `Would you like to automatically apply this fix to ${chalk.cyan(issue.file)}?`,
              default: false,
            },
          ]);

          if (answers.apply) {
            try {
              const filePath = path.resolve(process.cwd(), issue.file);
              const fileContent = await fs.readFile(filePath, "utf-8");

              if (fileContent.includes(issue.target_code)) {
                const updatedContent = fileContent.replace(issue.target_code, issue.replacement_code);
                await fs.writeFile(filePath, updatedContent, "utf-8");
                await execAsync(`git add "${filePath}"`);
                console.log(chalk.green(`✔ Applied fix and staged changes for ${issue.file}\n`));
                appliedAny = true;
              } else {
                console.warn(
                  chalk.yellow(
                    `⚠ Could not apply fix automatically: the exact target code block was not found in ${issue.file}\n`,
                  ),
                );
              }
            } catch (err: unknown) {
              const error = err as Error;
              console.error(chalk.red(`Failed to apply fix: ${error.message || error}\n`));
            }
          }
        }
      }

      if (appliedAny) {
        console.log(
          chalk.blue(
            "Applied fixes have been staged. Commit blocked for review. Please review changes and run git commit again.\n",
          ),
        );
      }
      process.exit(1);
    } catch (error: unknown) {
      const err = error as Error;
      console.error(chalk.red(`\nError: ${err.message || err}`));
      process.exit(1);
    }
  });

program.parse(process.argv);
