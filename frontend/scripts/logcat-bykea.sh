#!/usr/bin/env bash
# Farely / Bykea accessibility debug: ride handoff + picked fare + raw UI_DATA lines.
# Usage: ./scripts/logcat-bykea.sh   (from frontend/) or bash frontend/scripts/logcat-bykea.sh
set -euo pipefail
exec adb logcat -v time BykeaFare:D UI_DATA:D '*:S'
