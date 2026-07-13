import { defineConfig } from "vitest/config"
import path from "node:path"

export default defineConfig({
  resolve: {
    alias: {
      // 测试环境下将 server-only 空实现，允许直接单测服务层
      "server-only": path.resolve(__dirname, "tests/mocks/server-only.ts"),
      "@": path.resolve(__dirname),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
})
