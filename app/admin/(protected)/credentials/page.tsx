import { asc } from "drizzle-orm"
import { listCredentials } from "@/app/actions/credentials"
import { CredentialManager } from "@/components/admin/credential-manager"
import { db } from "@/lib/db"
import { registrars } from "@/lib/db/schema"

export default async function AdminCredentialsPage() {
  const [credentials, registrarRows] = await Promise.all([
    listCredentials(),
    db
      .select({ id: registrars.id, name: registrars.name })
      .from(registrars)
      .orderBy(asc(registrars.name)),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">凭证管理</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          管理注册商 API 凭证(API Key / Bearer / Cookie / Session / Basic / 自定义请求头)。凭证以
          AES-256-GCM 加密存储, 适配器在采集时按需解密使用。
        </p>
      </div>
      <CredentialManager credentials={credentials} registrarOptions={registrarRows} />
    </div>
  )
}
