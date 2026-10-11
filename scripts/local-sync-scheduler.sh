#!/bin/bash
# 每日调度循环: 每 24h 执行一次本地补采(playwright 注册商)
while true; do
  /workspace/scripts/local-sync.sh
  sleep 86400
done
