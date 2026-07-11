import crypto from "node:crypto";

export interface FileDiff {
  filePath: string;
  diffBlock: string;
  hash: string;
}

/**
 * Splits a raw git diff into per-file diff blocks and computes a SHA-256 hash for each.
 */
export function parseDiff(rawDiff: string): FileDiff[] {
  const fileDiffs: FileDiff[] = [];
  const lines = rawDiff.split(/\r?\n/);
  let currentFile: string | null = null;
  let currentBlock: string[] = [];

  const saveCurrent = () => {
    if (currentFile && currentBlock.length > 0) {
      const diffBlock = currentBlock.join("\n");
      const hash = crypto.createHash("sha256").update(diffBlock).digest("hex");
      fileDiffs.push({
        filePath: currentFile,
        diffBlock,
        hash,
      });
    }
  };

  for (const line of lines) {
    const match = line.match(/^diff --git a\/(.+) b\/(.+)$/);
    if (match) {
      saveCurrent();
      currentFile = match[2];
      currentBlock = [line];
    } else if (currentFile) {
      currentBlock.push(line);
    }
  }
  saveCurrent();

  return fileDiffs;
}
