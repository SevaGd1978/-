#!/bin/bash
cd "$(dirname "$0")" || exit 1
xattr -dr com.apple.quarantine "./Putevoy.app"
open "./Putevoy.app"
