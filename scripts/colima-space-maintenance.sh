#!/bin/zsh

set -euo pipefail

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

readonly LABEL="garden.bath.colima-space-maintenance"
readonly SOFT_LIMIT_PERCENT=65
readonly HARD_LIMIT_PERCENT=80
readonly SOFT_RETENTION="168h"
readonly STOPPED_CONTAINER_RETENTION="720h"
readonly COLIMA_DATA_MOUNT="/mnt/lima-colima"
readonly STATE_DIR="${HOME}/Library/Application Support/${LABEL}"
readonly LOCK_DIR="${STATE_DIR}/run.lock"

mode="${1:-auto}"

if [[ "${mode}" != "auto" && "${mode}" != "check" && "${mode}" != "force" ]]; then
  print -u2 "Usage: ${0:t} [auto|check|force]"
  exit 64
fi

mkdir -p "${STATE_DIR}"

if ! mkdir "${LOCK_DIR}" 2>/dev/null; then
  print "$(date -u +%Y-%m-%dT%H:%M:%SZ) Maintenance is already running."
  exit 0
fi
trap 'rmdir "${LOCK_DIR}" 2>/dev/null || true' EXIT

log() {
  print "$(date -u +%Y-%m-%dT%H:%M:%SZ) $*"
}

colima_bin="$(command -v colima || true)"
docker_bin="$(command -v docker || true)"

if [[ -z "${colima_bin}" || -z "${docker_bin}" ]]; then
  log "Colima or Docker is not installed; no maintenance was performed."
  exit 0
fi

if ! "${colima_bin}" status >/dev/null 2>&1; then
  log "Colima is not running; no maintenance was performed."
  exit 0
fi

export DOCKER_HOST="unix://${HOME}/.colima/default/docker.sock"

disk_percent() {
  "${colima_bin}" ssh -- df -Pk "${COLIMA_DATA_MOUNT}" 2>/dev/null \
    | awk 'NR == 2 { gsub(/%/, "", $5); print $5 }'
}

report() {
  local percent="$1"
  log "Colima container disk usage: ${percent}%."
  "${docker_bin}" system df
}

before_percent="$(disk_percent)"

if [[ -z "${before_percent}" || "${before_percent}" != <-> ]]; then
  log "Could not determine Colima container disk usage; no maintenance was performed."
  exit 1
fi

report "${before_percent}"

if [[ "${mode}" == "check" ]]; then
  exit 0
fi

# Dangling image layers and old build cache are always disposable. Volumes are
# deliberately excluded because they can contain local databases and user data.
"${docker_bin}" image prune --force
"${docker_bin}" builder prune --force --filter "until=${SOFT_RETENTION}"

if [[ "${mode}" == "force" ]]; then
  log "Forced cleanup requested; pruning every unused image and all build cache."
  "${docker_bin}" image prune --all --force
  "${docker_bin}" builder prune --all --force
  "${docker_bin}" container prune --force --filter "until=${STOPPED_CONTAINER_RETENTION}"
  "${docker_bin}" network prune --force
elif [[ ${before_percent} -ge ${SOFT_LIMIT_PERCENT} ]]; then
  log "Soft limit reached; pruning unused images older than ${SOFT_RETENTION}."
  "${docker_bin}" image prune --all --force --filter "until=${SOFT_RETENTION}"
  "${docker_bin}" container prune --force --filter "until=${STOPPED_CONTAINER_RETENTION}"
  "${docker_bin}" network prune --force --filter "until=${SOFT_RETENTION}"
fi

middle_percent="$(disk_percent)"

if [[ ${middle_percent} -ge ${HARD_LIMIT_PERCENT} ]]; then
  log "Hard limit remains exceeded; pruning every unused image and all build cache."
  "${docker_bin}" image prune --all --force
  "${docker_bin}" builder prune --all --force
fi

"${colima_bin}" ssh -- sudo fstrim "${COLIMA_DATA_MOUNT}" >/dev/null 2>&1 || true

after_percent="$(disk_percent)"
report "${after_percent}"

if [[ ${after_percent} -ge ${HARD_LIMIT_PERCENT} ]]; then
  message="Colima container storage remains at ${after_percent}% after safe cleanup. Volumes were preserved."
  log "WARNING: ${message}"
  /usr/bin/logger -t "${LABEL}" "${message}"
  /usr/bin/osascript -e "display notification \"${message}\" with title \"Colima Storage Warning\"" >/dev/null 2>&1 || true
  exit 2
fi

log "Maintenance completed without pruning any volumes."
