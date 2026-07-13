# Storage 平台

> 所有权:Platform Team · 代码:`packages/storage/`

Storage 平台只负责持久化:插入、更新、历史、差异对比、回滚。不做校验(校验平台的职责),不含注册商特定逻辑。

## PriceSink

SDK 通过 `PriceSink` 接口与存储解耦(SDK 本身不依赖数据库):

```ts
interface PriceSink {
  lookupExisting: (tld: string) => { registerPrice, renewPrice } | undefined
  save: (prices: ValidatedPrice[]) => Promise<{ inserted, updated, skipped, databaseMs }>
}
```

- `createPriceSink(registrarId)` —— 真实数据库实现,预加载现有价格避免循环查询
- `createDryRunSink(registrarId)` —— 干跑实现,compare 逻辑一致但不写库(测试用)

## Compare(diff)语义

- 价格与币种完全一致的行 → `skipped`(不写 prices,不写 history)
- 有变化 → 更新 prices + 追加 price_history
- 新 TLD → 插入 prices + 追加 price_history
- 未收录的 TLD(tlds 表中不存在)→ 跳过,在 tlds 表添加后自动收录

## 历史与回滚

- 每次变化都在 `price_history` 追加一行(只增不删,完整审计轨迹)
- `rollbackPrice(registrarId, tldId)` 将价格恢复到上一个历史版本,回滚本身也作为一条历史记录追加

## 失败保护

适配器失败时 `save` 不会被调用,旧价格完整保留。这保证了坏采集永远不会破坏好数据。
