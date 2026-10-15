#!/usr/bin/env bash
#
# scripts/edgeone-purge.sh —— 通过 EdgeOne OpenAPI 清除 CDN URL 缓存
#
# 用法:
#   TENCENT_CLOUD_SECRET_ID=AKIDxxx \
#   TENCENT_CLOUD_SECRET_KEY=xxx \
#   ZONE_ID=zone-2xxxxxxxx \
#   TARGETS="https://web-tools.example.com/ https://web-tools.example.com/index.html" \
#   ./scripts/edgeone-purge.sh
#
#   ./scripts/edgeone-purge.sh --dry-run   # 只打印签名,不发请求
#
# 复用现有 TENCENT_CLOUD_* 凭据;CAM 需要给这对凭据加权限:
#     teo:CreatePurgeTask, teo:DescribePurgeTasks
#
# 注意: 只清 HTML 入口;hash 命名的 assets/*.js|.css 不要清 —— 它们的 URL
# 一旦变就是新文件,旧 URL 没意义,清了只会白触发回源。

set -euo pipefail

# ---- 参数与环境变量 ----
DRY_RUN=0
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=1

: "${TENCENT_CLOUD_SECRET_ID:?must set TENCENT_CLOUD_SECRET_ID}"
: "${TENCENT_CLOUD_SECRET_KEY:?must set TENCENT_CLOUD_SECRET_KEY}"
: "${ZONE_ID:?must set ZONE_ID}"
: "${TARGETS:?must set TARGETS (space-separated URLs)}"

HOST="${EDGEONE_API_HOST:-teo.tencentcloudapi.com}"
SERVICE="teo"
ACTION="CreatePurgeTask"
VERSION="2022-09-01"
REGION="${EDGEONE_REGION:-ap-beijing}"
ALGO="TC3-HMAC-SHA256"

# ---- 构造 payload ----
TARGETS_JSON=$(printf '%s\n' "$TARGETS" | tr ' ' '\n' | jq -R . | jq -s 'map(select(length > 0))')
PAYLOAD=$(jq -nc \
  --arg zone "$ZONE_ID" \
  --argjson targets "$TARGETS_JSON" \
  '{ZoneId: $zone, Type: "purge", Method: "url", Targets: $targets}')

# ---- 时间戳 ----
TS=$(date +%s)
DATE=$(date -u -r "$TS" +%Y-%m-%d)

# ---- 助手 ----
sha256_hex() { openssl dgst -sha256 -hex | awk '{print $NF}'; }
hmac_sha256_hex() {
  local key="$1"
  openssl dgst -sha256 -mac HMAC -macopt "key:${key}" | awk '{print $NF}'
}

# ---- TC3 签名 ----
HASHED_PAYLOAD=$(printf '%s' "$PAYLOAD" | sha256_hex)

ACTION_LOWER=$(echo "$ACTION" | tr '[:upper:]' '[:lower:]')
# 用 ANSI-C quoting 让末尾换行不会被命令替换剥掉
CANONICAL_HEADERS=$'content-type:application/json; charset=utf-8\nhost:'"$HOST"$'\nx-tc-action:'"$ACTION_LOWER"$'\n'
SIGNED_HEADERS="content-type;host;x-tc-action"

# 6 行: method / uri / query / headers / signed-headers / hashed-payload
# 中间的空行 = CANONICAL_QUERY 是空字符串
CANONICAL_REQ="POST
/

${CANONICAL_HEADERS}${SIGNED_HEADERS}
${HASHED_PAYLOAD}"

HASHED_CANONICAL=$(printf '%s' "$CANONICAL_REQ" | sha256_hex)

CREDENTIAL_SCOPE="${DATE}/${SERVICE}/tc3_request"
STRING_TO_SIGN="${ALGO}
${TS}
${CREDENTIAL_SCOPE}
${HASHED_CANONICAL}"

SECRET_DATE=$(printf '%s' "$DATE" | hmac_sha256_hex "TC3${TENCENT_CLOUD_SECRET_KEY}")
SECRET_SERVICE=$(printf '%s' "$SERVICE" | hmac_sha256_hex "$SECRET_DATE")
SECRET_SIGNING=$(printf '%s' "tc3_request" | hmac_sha256_hex "$SECRET_SERVICE")
SIGNATURE=$(printf '%s' "$STRING_TO_SIGN" | hmac_sha256_hex "$SECRET_SIGNING")

AUTH="${ALGO} Credential=${TENCENT_CLOUD_SECRET_ID}/${CREDENTIAL_SCOPE}, SignedHeaders=${SIGNED_HEADERS}, Signature=${SIGNATURE}"

# ---- dry-run ----
if [[ $DRY_RUN -eq 1 ]]; then
  cat <<EOF
== DRY RUN ==
endpoint: https://${HOST}/
action:   ${ACTION}
zone:     ${ZONE_ID}
region:   ${REGION}
payload:  ${PAYLOAD}
signature:${SIGNATURE}
== END ==
EOF
  exit 0
fi

# ---- 发请求 ----
resp=$(curl -fsS -X POST "https://${HOST}/" \
  -H "Authorization: ${AUTH}" \
  -H "Content-Type: application/json; charset=utf-8" \
  -H "Host: ${HOST}" \
  -H "X-TC-Action: ${ACTION}" \
  -H "X-TC-Timestamp: ${TS}" \
  -H "X-TC-Version: ${VERSION}" \
  -H "X-TC-Region: ${REGION}" \
  -d "$PAYLOAD")

# 错误响应形如 {"Response":{"Error":{"Code":"...","Message":"..."},"RequestId":"..."}}
err_code=$(echo "$resp" | jq -r '.Response.Error.Code // empty')
if [[ -n "$err_code" ]]; then
  err_msg=$(echo "$resp" | jq -r '.Response.Error.Message')
  echo "EdgeOne API error: ${err_code} — ${err_msg}" >&2
  exit 1
fi

echo "$resp" | jq '.Response'
