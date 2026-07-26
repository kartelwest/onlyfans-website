#!/usr/bin/env bash
set -euo pipefail

# Run this script on a fresh Oracle Cloud Infrastructure Always Free ARM or AMD instance.
# It installs Node.js, FFmpeg, fonts, and creates a systemd service for the video worker.

APP_DIR="${APP_DIR:-/opt/karay-video-worker}"
SERVICE_NAME="${SERVICE_NAME:-karay-video-worker}"

echo "=== Updating packages ==="
sudo apt-get update
sudo apt-get install -y curl ca-certificates gnupg git ffmpeg fonts-dejavu-core

echo "=== Installing Node.js ==="
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

echo "=== Installing worker dependencies ==="
if [[ -d "$APP_DIR" ]]; then
  cd "$APP_DIR"
  if [[ -f package-lock.json ]]; then
    npm ci
  else
    npm install
  fi
else
  echo "Worker directory not found at $APP_DIR. Copy the worker/ folder to the VM first."
  exit 1
fi

echo "=== Writing environment file ==="
sudo mkdir -p /etc/karay
sudo tee /etc/karay/video-worker.env > /dev/null <<'EOF'
# Set these to match your Vercel/Supabase project
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_VIDEO_ORIGINAIS_BUCKET=video-originals
SUPABASE_VIDEO_EDITADOS_BUCKET=video-edited
VIDEO_WORKER_API_KEY=
VIDEO_MAX_FILE_SIZE_MB=2048
VIDEO_MAX_DURATION_SECONDS=600
VIDEO_WORKER_CONCURRENCY=2
VIDEO_WORKER_POLL_INTERVAL_MS=15000
EOF

echo "=== Creating systemd service ==="
sudo tee "/etc/systemd/system/${SERVICE_NAME}.service" > /dev/null <<EOF
[Unit]
Description=KarayModels video editor worker
After=network.target

[Service]
Type=simple
WorkingDirectory=${APP_DIR}
EnvironmentFile=/etc/karay/video-worker.env
ExecStart=/usr/bin/npx tsx src/index.ts
Restart=always
RestartSec=10
User=ubuntu

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE_NAME"

echo "=== Setup complete ==="
echo "Edit /etc/karay/video-worker.env with your secrets, then run:"
echo "  sudo systemctl start $SERVICE_NAME"
echo "Check logs with:"
echo "  sudo journalctl -u $SERVICE_NAME -f"
