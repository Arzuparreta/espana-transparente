#!/usr/bin/env bash
set -euo pipefail

port_range="${SUPABASE_PRIVATE_PORT_RANGE:-54321:54329}"

default_interface() {
  local family_flag="$1"
  ip "$family_flag" route show default |
    awk 'NR == 1 { print $5 }'
}

install_rule() {
  local command="$1"
  local family_flag="$2"
  local interface

  interface="${SUPABASE_EXTERNAL_INTERFACE:-$(default_interface "$family_flag")}"
  if [[ -z "$interface" ]]; then
    echo "No public interface found for ${command}; skipping"
    return
  fi

  if ! "$command" -S DOCKER-USER >/dev/null 2>&1; then
    echo "DOCKER-USER is unavailable for ${command}" >&2
    return 1
  fi

  local rule=(
    -i "$interface"
    -p tcp
    -m conntrack
    --ctorigdstport "$port_range"
    -j DROP
  )

  if ! "$command" -C DOCKER-USER "${rule[@]}" 2>/dev/null; then
    "$command" -I DOCKER-USER 1 "${rule[@]}"
  fi

  echo "${command}: blocked public ${interface} access to ${port_range}"
}

install_rule iptables -4
install_rule ip6tables -6
