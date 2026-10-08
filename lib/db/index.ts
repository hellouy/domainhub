import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import * as schema from "./schema"

const connectionString =
  process.env.tldbi_POSTGRES_URL ?? process.env.tldbi_POSTGRES_URL_NON_POOLING ?? process.env.DATABASE_URL

export const pool = new Pool({ connectionString })
export const db = drizzle(pool, { schema })
