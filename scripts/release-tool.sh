#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Kullanım: bash scripts/release-tool.sh <version> [release-notes]"
  echo "Örnek:  bash scripts/release-tool.sh 1.7.0 \"Yeni özellikler ve hata düzeltmeleri\""
  exit 1
fi

VERSION="$1"
RELEASE_NOTES="${2:-}"

if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Hata: Versiyon formatı semver olmalı (örn: 1.7.0)"
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "Hata: GitHub CLI (gh) bulunamadı. Önce yükleyin: https://cli.github.com/"
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "Hata: GitHub CLI ile giriş yapılmamış. Önce 'gh auth login' çalıştırın."
  exit 1
fi

echo "Release workflow tetikleniyor... (v$VERSION)"

if [[ -n "$RELEASE_NOTES" ]]; then
  gh workflow run release.yml \
    --field version="$VERSION" \
    --field release_notes="$RELEASE_NOTES"
else
  gh workflow run release.yml \
    --field version="$VERSION"
fi

sleep 2

RUN_ID=$(gh run list --workflow release.yml --limit 1 --json databaseId --jq '.[0].databaseId')

if [[ -z "$RUN_ID" || "$RUN_ID" == "null" ]]; then
  echo "Workflow tetiklendi fakat run id alınamadı. GitHub Actions ekranını kontrol edin."
  exit 0
fi

echo "Workflow başlatıldı. Run ID: $RUN_ID"
echo "Canlı takip başlatılıyor..."

gh run watch "$RUN_ID"

echo "Bitti. Release kontrolü: https://github.com/$(gh repo view --json nameWithOwner -q .nameWithOwner)/releases"
