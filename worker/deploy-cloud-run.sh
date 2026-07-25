#!/usr/bin/env bash
set -euo pipefail

# Deploy the KarayModels video worker to Google Cloud Run.
# Usage:
#   export GOOGLE_CLOUD_PROJECT=your-project-id
#   export GOOGLE_CLOUD_REGION=southamerica-east1
#   export GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY=$(cat key.json)
#   ./deploy-cloud-run.sh

PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-}"
REGION="${GOOGLE_CLOUD_REGION:-southamerica-east1}"
SERVICE_NAME="${CLOUD_RUN_SERVICE_NAME:-karay-video-worker}"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

echo "=== KarayModels video worker Cloud Run deploy ==="
echo "Project: ${PROJECT_ID}"
echo "Region:  ${REGION}"
echo "Service: ${SERVICE_NAME}"

if [[ -z "${PROJECT_ID}" ]]; then
  echo "Error: set GOOGLE_CLOUD_PROJECT"
  exit 1
fi

if ! command -v gcloud &> /dev/null; then
  echo "Error: gcloud CLI is not installed. Install it first: https://cloud.google.com/sdk/docs/install"
  exit 1
fi

echo "=== Authenticating gcloud ==="
echo "${GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY}" > /tmp/gcloud-key.json
gcloud auth activate-service-account --key-file=/tmp/gcloud-key.json --project="${PROJECT_ID}"
gcloud config set project "${PROJECT_ID}"
gcloud config set run/region "${REGION}"

echo "=== Enabling required APIs ==="
gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com --project="${PROJECT_ID}"

echo "=== Building and pushing image ==="
REPO_NAME="${GOOGLE_CLOUD_ARTIFACT_REPO:-${SERVICE_NAME}}"
gcloud artifacts repositories create "${REPO_NAME}" \
  --repository-format=docker \
  --location="${REGION}" \
  --project="${PROJECT_ID}" \
  --quiet || true

gcloud builds submit --tag "${IMAGE_NAME}" . --project="${PROJECT_ID}"

echo "=== Deploying to Cloud Run ==="
gcloud run deploy "${SERVICE_NAME}" \
  --image "${IMAGE_NAME}" \
  --region "${REGION}" \
  --project "${PROJECT_ID}" \
  --no-allow-unauthenticated \
  --set-env-vars="NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}" \
  --set-env-vars="SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}" \
  --set-env-vars="SUPABASE_VIDEO_ORIGINAIS_BUCKET=${SUPABASE_VIDEO_ORIGINAIS_BUCKET:-video-originals}" \
  --set-env-vars="SUPABASE_VIDEO_EDITADOS_BUCKET=${SUPABASE_VIDEO_EDITADOS_BUCKET:-video-edited}" \
  --set-env-vars="VIDEO_WORKER_POLL_INTERVAL_MS=${VIDEO_WORKER_POLL_INTERVAL_MS:-15000}" \
  --set-env-vars="VIDEO_MAX_FILE_SIZE_MB=${VIDEO_MAX_FILE_SIZE_MB:-2048}" \
  --set-env-vars="VIDEO_MAX_DURATION_SECONDS=${VIDEO_MAX_DURATION_SECONDS:-600}" \
  --cpu=2 \
  --memory=2Gi \
  --timeout=3600 \
  --max-instances=1 \
  --min-instances=1 \
  --quiet

echo "=== Deployment complete ==="
