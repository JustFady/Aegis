import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

/**
 * Executes 'git diff --cached' and returns the diff.
 * Throws a clear error if the directory is not a git repository or if git is not installed.
 */
export async function getStagedDiff(): Promise<string> {
  try {
    const { stdout } = await execAsync("git diff --cached");
    return stdout.trim();
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message?.includes("not a git repository")) {
      throw new Error("This directory is not a Git repository. Please initialize git first.");
    }
    throw new Error(`Failed to read staged changes: ${err.message || err}`);
  }
}
