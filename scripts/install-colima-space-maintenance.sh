#!/bin/zsh

set -euo pipefail

readonly LABEL="garden.bath.colima-space-maintenance"
readonly SOURCE_DIR="${0:A:h}"
readonly REPOSITORY_DIR="${SOURCE_DIR:h}"
readonly INSTALL_DIR="${HOME}/Library/Application Support/${LABEL}"
readonly LAUNCH_AGENT="${HOME}/Library/LaunchAgents/${LABEL}.plist"
readonly TEMPLATE="${REPOSITORY_DIR}/launchd/${LABEL}.plist.template"
readonly GUI_DOMAIN="gui/$(id -u)"

mkdir -p "${INSTALL_DIR}" "${HOME}/Library/LaunchAgents"
install -m 0755 "${SOURCE_DIR}/colima-space-maintenance.sh" "${INSTALL_DIR}/colima-space-maintenance.sh"

temporary_plist="$(mktemp "${TMPDIR:-/tmp}/${LABEL}.XXXXXX")"
trap 'rm -f "${temporary_plist}"' EXIT

sed \
  -e "s|__INSTALL_DIR__|${INSTALL_DIR}|g" \
  "${TEMPLATE}" > "${temporary_plist}"

plutil -lint "${temporary_plist}" >/dev/null

launchctl bootout "${GUI_DOMAIN}" "${LAUNCH_AGENT}" >/dev/null 2>&1 || true
install -m 0644 "${temporary_plist}" "${LAUNCH_AGENT}"
launchctl bootstrap "${GUI_DOMAIN}" "${LAUNCH_AGENT}"

print "Installed ${LABEL}."
print "Run a read-only check with:"
print "  '${INSTALL_DIR}/colima-space-maintenance.sh' check"
