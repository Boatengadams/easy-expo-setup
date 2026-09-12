#!/usr/bin/env bash
cd "$(dirname "$0")"
node setup-project.js
echo ""
read -n 1 -s -r -p "Press any key to close this window..."
