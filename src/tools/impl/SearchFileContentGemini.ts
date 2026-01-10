/**
 * Gemini CLI search_file_content tool - wrapper around Deep Sci-Fi's Grep tool
 * Uses Gemini's exact schema and description
 */

import { grep } from "./Grep";

interface SearchFileContentGeminiArgs {
  pattern: string;
  dir_path?: string;
  include?: string;
}

export async function search_file_content(
  args: SearchFileContentGeminiArgs,
): Promise<{ message: string }> {
  // Validate pattern - empty pattern would match everything and cause buffer overflow
  if (!args.pattern || args.pattern.trim() === "") {
    return { message: "No matches found (empty pattern)" };
  }

  // Adapt Gemini params to Deep Sci-Fi's Grep tool
  const lettaArgs = {
    pattern: args.pattern,
    path: args.dir_path,
    glob: args.include,
    output_mode: "content" as const, // Return actual matching lines, not just file paths
  };

  const result = await grep(lettaArgs);

  // Grep returns { output: string, matches?, files? }
  return { message: result.output };
}
