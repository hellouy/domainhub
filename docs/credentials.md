# Credential Manager

> 所有权:Platform Team · 代码:`packages/credentials/`

## 支持的凭证类型

| 类型 | 说明 | payload 字段 |
|---|---|---|
| `api_key` | API Key | `{ apiKey, secretKey? }` |
| `bearer` | Bearer Token | `{ token }` |
| `cookie` | Cookie 串 | `{ cookie }` |
| `session` | 会话凭证 | `{ session }` |
| `basic` | Basic Auth | `{ username, password }` |
| `custom_header` | 自定义请求头 | `{ headerName, headerValue }` |

## 加密

- 算法:**AES-256-GCM**(认证加密,密文格式 `iv:authTag:ciphertext`,hex 编码)
- 密钥:环境变量 `CREDENTIAL_ENCRYPTION_KEY`(64 位 hex = 32 字节)
- **禁止**从 `ADMIN_PASSWORD` 派生密钥;两者完全独立,更换管理密码不影响凭证
- 明文永不落库、永不写日志、永不返回给前端(后台只显示掩码)

生成密钥:

```
openssl rand -hex 32
```

## 使用方式

适配器通过 `ctx.getCredential(type?)` 获取解密后的凭证,不直接接触数据库或密钥:

```ts
const cred = await ctx.getCredential("api_key")
if (cred) headers["Authorization"] = `Bearer ${cred.payload.apiKey}`
```

## 管理

- 后台页面:`/admin/credentials`(登录保护)
- Server actions:`app/actions/credentials.ts`(创建/启停/删除,全部要求管理员会话)
- 数据表:`registrar_credentials`(每商可存多条,按 `isActive` 过滤)

## 轮换

新增一条新凭证 → 验证采集正常 → 停用旧凭证。密钥本身轮换需要先用旧密钥解密、新密钥重加密所有行(脚本待未来 Sprint 提供)。
