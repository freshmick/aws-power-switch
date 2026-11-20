#!/bin/sh
# Copies the shared theme's built files (github.com/freshmick/site-theme) into app/theme/.
# The Lambda zips app/ straight from git, so the theme is committed rather than installed.
# Usage: scripts/update-theme.sh v0.1.0   (a tag of the theme repo; needs node and npm)
set -eu

version=${1:?usage: scripts/update-theme.sh <theme tag, e.g. v0.1.0>}
dest=$(dirname "$0")/../app/theme
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

# npm pack builds dist/ (the theme's prepare script) and leaves a tarball of the package.
(cd "$tmp" && npm pack --silent "github:freshmick/site-theme#$version" > /dev/null && tar -xzf ./*.tgz)

mkdir -p "$dest"
cp "$tmp/package/dist/theme.css" "$tmp/package/dist/theme-init.js" "$tmp/package/dist/theme-switch.js" "$dest/"
echo "$version" > "$dest/VERSION"
echo "app/theme/ updated to site-theme $version"
