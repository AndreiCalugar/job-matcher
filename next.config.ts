import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prompts are read from disk at runtime (prompts live in versioned files,
  // not code). Make sure the serverless bundle carries them.
  outputFileTracingIncludes: { "/**": ["./prompts/**"] },
};

export default nextConfig;
