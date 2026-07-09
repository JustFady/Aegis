import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

interface Config {
  openai_api_key?: string;
}

const CONFIG_DIR = path.join(os.homedir(), ".aegis");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

/**
 * Saves the OpenAI API key to ~/.aegis/config.json
 */
export async function saveApiKey(apiKey: string): Promise<void> {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  const config: Config = {};

  try {
    const existing = await fs.readFile(CONFIG_FILE, "utf-8");
    Object.assign(config, JSON.parse(existing));
  } catch {
    // Ignore error if file doesn't exist
  }

  config.openai_api_key = apiKey;
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
}

/**
 * Retrieves the OpenAI API key from ~/.aegis/config.json or process.env.OPENAI_API_KEY
 */
export async function getApiKey(): Promise<string | undefined> {
  // 1. Check environment variable first
  if (process.env.OPENAI_API_KEY) {
    return process.env.OPENAI_API_KEY;
  }

  // 2. Check local config file
  try {
    const data = await fs.readFile(CONFIG_FILE, "utf-8");
    const config: Config = JSON.parse(data);
    return config.openai_api_key;
  } catch {
    return undefined;
  }
}
