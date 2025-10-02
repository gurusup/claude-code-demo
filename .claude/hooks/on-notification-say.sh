# .claude/hooks/on-notification-say.sh
#!/usr/bin/env bash
set -euo pipefail

payload="$(cat)"
message=$(echo "$payload" | jq -r '.message')
# Speak it (absolute path to avoid PATH issues)
/usr/bin/say "$message"