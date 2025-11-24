import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default("0.0.0.0"),
  REDIS_URL: z.string().default("redis://127.0.0.1:6379"),
  CACHE_TTL_SECONDS: z.coerce.number().default(30),
  AGGREGATOR_REFRESH_SECONDS: z.coerce.number().default(15),
  DEXSCREENER_SEARCH_QUERY: z.string().default("trending"),
  JUPITER_SEARCH_QUERY: z.string().default("SOL"),
  LOG_LEVEL: z.string().default("info"),
});

const env = envSchema.parse(process.env);

export default env;
