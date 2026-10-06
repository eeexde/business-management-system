import { sql, type Column, type SQL } from "drizzle-orm";

/**
 * Case-insensitive literal substring match. Uses instr() rather than LIKE so that
 * "%" and "_" typed by the user match literally instead of acting as wildcards.
 */
export function contains(column: Column, needle: string): SQL {
  return sql`instr(lower(coalesce(${column}, '')), ${needle.toLowerCase()}) > 0`;
}
