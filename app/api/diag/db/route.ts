import { NextResponse } from "next/server"
import { pool } from "@/lib/db"

export const runtime = "nodejs"

export async function GET() {
  try {
    const r = await pool.query(`select current_user, session_user, current_database(),
      has_table_privilege(current_user, 'registrars', 'SELECT') as sel,
      has_table_privilege(current_user, 'registrars', 'UPDATE') as upd,
      has_table_privilege(current_user, 'registrars', 'INSERT') as ins,
      row_security_active('registrars') as rls_active,
      (select tableowner from pg_tables where tablename='registrars') as owner`)
    return NextResponse.json({ db: r.rows[0] })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}