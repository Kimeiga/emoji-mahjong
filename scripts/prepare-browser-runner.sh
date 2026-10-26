#!/usr/bin/env bash
set -euo pipefail
# GitHub's Azure package mirror stalled multiple browser setup jobs for 25 minutes.
# Keep signed Ubuntu packages, using the official archive with bounded retries.
if test -f /etc/apt/sources.list.d/ubuntu.sources; then
  sudo sed -i -E 's@^URIs: (mirror\+file:.*|http://azure\.archive\.ubuntu\.com/ubuntu/?)$@URIs: https://archive.ubuntu.com/ubuntu/@' /etc/apt/sources.list.d/ubuntu.sources
fi
printf 'Acquire::http::Timeout "15";\nAcquire::https::Timeout "15";\nAcquire::Retries "2";\n' | sudo tee /etc/apt/apt.conf.d/99-browser-download-timeouts >/dev/null
