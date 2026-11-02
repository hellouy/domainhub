#!/usr/bin/env bash
# =============================================================================
# 本地开发服务统一管理入口
# =============================================================================
# 三个本地服务，职责单一：
#   app     Next.js 开发服务器（页面 + API），默认 :3000
#   worker  browser-worker（Playwright 渲染 /render），默认 :8840
#   sync    local-sync 调度循环（每日全量补采 + 促销码），无端口
#
# 用法：
#   scripts/services.sh start   [app|worker|sync|all]
#   scripts/services.sh stop    [app|worker|sync|all]
#   scripts/services.sh restart [app|worker|sync|all]
#   scripts/services.sh status  [app|worker|sync|all]
#   scripts/services.sh health  [app|worker|sync|all]
#   scripts/services.sh logs    [app|worker|sync|all] [行数]
#
# 约定：
#   - 密钥统一从 .env.local 读取，脚本内不硬编码。
#   - pid 文件在 .run/，日志在 logs/，两者均不入库。
#   - worker 默认本地 chromium；若 .env.local 配置 REMOTE_PLAYWRIGHT_URL 则连远端农场。
#   - 启动前先探测，避免与已在运行的外部实例重复启动。
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

RUN_DIR=.run
LOG_DIR=logs
mkdir -p "$RUN_DIR" "$LOG_DIR"

envval() { grep -E "^$1=" .env.local 2>/dev/null | head -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' || true; }

APP_PORT="${APP_PORT:-3000}"
WORKER_PORT="${WORKER_PORT:-8840}"
APP_URL="http://127.0.0.1:${APP_PORT}"
WORKER_URL="http://127.0.0.1:${WORKER_PORT}"
WORKER_TOKEN="$(envval BROWSER_SERVICE_TOKEN)"
ALL="app worker sync"

pidfile() { echo "$RUN_DIR/$1.pid"; }
logfile() { echo "$LOG_DIR/$1.log"; }

# 统一用 HTTP 状态码判断连通性（Next dev 首页可能流式响应导致 curl 非零退出，
# 不能用 curl 退出码判断；连接失败时 %{http_code} 为 000）
http_code() { curl -s -m "${2:-5}" -o /dev/null -w '%{http_code}' "$1" 2>/dev/null || true; }
http_up()   { local c; c=$(http_code "$1" "${2:-5}"); [ -n "$c" ] && [ "$c" != "000" ]; }
# 端口监听探测（快，不触发编译）
port_up()   { ss -tln 2>/dev/null | awk '{print $4}' | grep -qE "[:.]$1$"; }

label() {
  case "$1" in
    app)    echo "app    next dev :$APP_PORT" ;;
    worker) echo "worker browser-worker :$WORKER_PORT" ;;
    sync)   echo "sync   local-sync 调度循环" ;;
  esac
}

is_running() {
  local pf pid
  pf=$(pidfile "$1")
  [ -f "$pf" ] || return 1
  pid=$(cat "$pf" 2>/dev/null || true)
  [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null
}

# 外部实例探测（非本脚本启动、无 pidfile）
externally_running() {
  case "$1" in
    app)    port_up "$APP_PORT" ;;
    worker) http_up "$WORKER_URL/health" 5 ;;
    sync)   pgrep -f "local-sync-scheduler.sh" >/dev/null 2>&1 ;;
  esac
}

start_one() {
  local name=$1
  local pf; pf=$(pidfile "$name")
  if is_running "$name"; then
    echo "[skip] $(label "$name") 已在运行 (pid $(cat "$pf"))"
    return 0
  fi
  if externally_running "$name"; then
    echo "[skip] $(label "$name") 已有外部实例在运行（未纳入本脚本 pid 管理）"
    return 0
  fi
  case "$name" in
    app)
      # 由子进程自己写 pid（setsid 可能 fork，$! 不可靠），exec 保持 pid 不变
      setsid bash -c "echo \$\$ > '$pf'; exec npm run dev" > "$(logfile app)" 2>&1 &
      ;;
    worker)
      if [ -z "$WORKER_TOKEN" ]; then
        echo "错误: .env.local 缺少 BROWSER_SERVICE_TOKEN，无法鉴权 browser-worker" >&2
        return 1
      fi
      local remote_url remote_tok env_tls
      remote_url="$(envval REMOTE_PLAYWRIGHT_URL)"
      remote_tok="$(envval REMOTE_PLAYWRIGHT_TOKEN)"
      env_tls=""
      if [ -n "$remote_url" ]; then env_tls="NODE_TLS_REJECT_UNAUTHORIZED=0"; fi
      setsid bash -c "echo \$\$ > '$pf'; export BROWSER_WORKER_TOKEN='$WORKER_TOKEN' PORT='$WORKER_PORT' REMOTE_PLAYWRIGHT_URL='$remote_url' REMOTE_PLAYWRIGHT_TOKEN='$remote_tok' $env_tls; cd browser-worker && exec npm start" > "$(logfile worker)" 2>&1 &
      ;;
    sync)
      setsid bash -c "echo \$\$ > '$pf'; exec ./scripts/local-sync-scheduler.sh" > "$(logfile sync)" 2>&1 &
      ;;
  esac
  # 等待子进程写入 pid
  for _ in $(seq 1 10); do
    if [ -s "$pf" ]; then break; fi
    sleep 0.2
  done
  echo "[start] $(label "$name") → 日志 $(logfile "$name")"
}

stop_one() {
  local name=$1 pf pid
  pf=$(pidfile "$name")
  if [ ! -f "$pf" ]; then
    if externally_running "$name"; then
      echo "[warn] $(label "$name") 在运行但不属于本脚本管理，请在原终端停止" >&2
    else
      echo "[stop] $(label "$name") 未运行"
    fi
    return 0
  fi
  pid=$(cat "$pf" 2>/dev/null || true)
  if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
    # setsid 使 pid 成为会话/进程组组长，按组结束避免残留子进程
    kill -TERM -- "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
    for _ in $(seq 1 20); do
      kill -0 "$pid" 2>/dev/null || break
      sleep 0.5
    done
    if kill -0 "$pid" 2>/dev/null; then
      kill -KILL -- "-$pid" 2>/dev/null || kill -KILL "$pid" 2>/dev/null || true
    fi
    echo "[stop] $(label "$name") 已停止 (pid $pid)"
  else
    echo "[stop] $(label "$name") 进程已不存在，清理 pid 文件"
  fi
  rm -f "$pf"
}

status_one() {
  local name=$1
  if is_running "$name"; then
    echo "[up]   $(label "$name") pid=$(cat "$(pidfile "$name")")"
  elif externally_running "$name"; then
    echo "[up*]  $(label "$name") 外部实例"
  else
    echo "[down] $(label "$name")"
  fi
}

health_one() {
  local name=$1
  case "$name" in
    app)
      # Next dev 首次请求要编译，给足超时
      local code
      code=$(http_code "$APP_URL/" 60)
      echo "$(label "$name") → HTTP ${code:-000}"
      ;;
    worker)
      local body
      body=$(curl -sf -m 5 "$WORKER_URL/health" 2>/dev/null || echo "unreachable")
      echo "$(label "$name") → $body"
      ;;
    sync)
      if is_running sync || externally_running sync; then
        echo "$(label "$name") → 运行中，最近日志："
        tail -n 3 "$(logfile sync)" 2>/dev/null || tail -n 3 "$LOG_DIR/local-sync.log" 2>/dev/null || echo "  （无日志）"
      else
        echo "$(label "$name") → 未运行"
      fi
      ;;
  esac
}

logs_one() {
  local name=$1 lines=${2:-50} f
  f=$(logfile "$name")
  [ -f "$f" ] || { echo "$(label "$name") 无日志文件 ($f)"; return 0; }
  tail -n "$lines" "$f"
}

resolve_targets() {
  # 支持多目标：`start worker app`；无参数或 all 表示全部
  if [ "$#" -eq 0 ]; then echo "$ALL"; return 0; fi
  local out=""
  for t in "$@"; do
    if [ "$t" = all ]; then echo "$ALL"; return 0; fi
    case "$t" in app|worker|sync) out="$out $t" ;; *) echo "未知服务: $t（可选: app worker sync all）" >&2; exit 2 ;; esac
  done
  echo "$out"
}

cmd=${1:-status}
case "$cmd" in
  start|stop|restart|status|health|logs) ;;
  -h|--help|help) sed -n '2,28p' "$0"; exit 0 ;;
  *) echo "用法: $0 {start|stop|restart|status|health|logs} [app|worker|sync|all]... [行数]" >&2; exit 2 ;;
esac
shift || true

# logs 的最后一个纯数字参数视为行数
LOG_LINES=50
if [ "$cmd" = logs ] && [ "$#" -gt 0 ]; then
  last="${*: -1}"
  case "$last" in ''|*[!0-9]*) ;; *) LOG_LINES="$last"; set -- "${@:1:$(($#-1))}" ;; esac
fi

targets=$(resolve_targets "$@")

case "$cmd" in
  start)   for s in $targets; do start_one "$s"; done ;;
  stop)    for s in $targets; do stop_one "$s"; done ;;
  restart) for s in $targets; do stop_one "$s"; done; for s in $targets; do start_one "$s"; done ;;
  status)  for s in $targets; do status_one "$s"; done ;;
  health)  for s in $targets; do health_one "$s"; done ;;
  logs)    for s in $targets; do echo "===== $(label "$s") ====="; logs_one "$s" "$LOG_LINES"; done ;;
esac
