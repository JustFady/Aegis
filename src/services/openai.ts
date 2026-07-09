import OpenAI from "openai";

export interface AuditIssue {
  description: string;
  suggested_fix: string;
}

export interface AuditResult {
  status: "pass" | "fail";
  issues: AuditIssue[];
}

/**
 * Sends a git diff to OpenAI gpt-4o-mini for security auditing.
 * Enforces a strict JSON response.
 */
export async function auditDiff(apiKey: string, diff: string): Promise<AuditResult> {
  const openai = new OpenAI({ apiKey });

  const systemPrompt = `Act as a strict security auditor. Identify vulnerabilities (exposed secrets, SQL injection, logic flaws, dependency security risks, etc.) within the provided git diff.
You must respond with a JSON object in the following format:
{
  "status": "pass" | "fail",
  "issues": [
    {
      "description": "A description of the vulnerability or security issue.",
      "suggested_fix": "Clear guidelines on how to remediate the issue."
    }
  ]
}
If no security vulnerabilities are found, the status must be "pass" and "issues" should be an empty array. If any security issues are found, status must be "fail".`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Please audit this git diff:\n\n${diff}` },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1, // low temperature for consistent classification
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Received empty response from OpenAI.");
  }

  try {
    const parsed = JSON.parse(content) as AuditResult;
    // Basic validation of the response shape
    if (parsed.status !== "pass" && parsed.status !== "fail") {
      throw new Error(`Invalid status in response: ${parsed.status}`);
    }
    if (!Array.isArray(parsed.issues)) {
      throw new Error("Missing 'issues' array in response.");
    }
    return parsed;
  } catch (error: unknown) {
    const err = error as Error;
    throw new Error(`Failed to parse audit results: ${err.message || err}`);
  }
}
