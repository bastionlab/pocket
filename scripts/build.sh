#!/bin/sh
# Build the static app in CT 104 (pve has no node), serialized so concurrent callers cannot OOM the dashboard CT.
# Usage: scripts/build.sh   -> fills /root/bastion-pocket/dist ; prints BUILD_OK or the error tail.
set -u
SRC=/root/bastion-pocket
exec 9>/tmp/pocket-build.lock
flock 9
D=/tmp/pocket-build-$$
cd "$SRC" || exit 1
tar cf - --exclude=./dist --exclude=./node_modules --exclude=./.nuxt --exclude=./.output . \
 | pct exec 104 -- sh -c "rm -rf $D && mkdir -p $D && tar xf - -C $D" || { echo BUILD_FAIL copy; exit 1; }
pct exec 104 -- sh -c "cd $D && export NODE_OPTIONS=--max-old-space-size=1536 && nice -n 19 npm install --no-audit --no-fund >$D/install.log 2>&1 && nice -n 19 npx nuxi generate >$D/gen.log 2>&1; echo rc=\$?; tail -25 $D/gen.log; tail -5 $D/install.log" > /tmp/pocket-build-$$.out 2>&1
if grep -q '^rc=0' /tmp/pocket-build-$$.out; then
  rm -rf "$SRC/dist" && mkdir -p "$SRC/dist"
  pct exec 104 -- sh -c "cd $D/.output/public && tar cf - ." | tar xf - -C "$SRC/dist"
  echo BUILD_OK
else
  cat /tmp/pocket-build-$$.out; echo BUILD_FAIL
fi
pct exec 104 -- rm -rf "$D"; rm -f /tmp/pocket-build-$$.out
