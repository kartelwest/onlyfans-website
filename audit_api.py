import urllib.request
from urllib.error import HTTPError

BASE = "https://www.karaymodels.com"

API_PATHS = [
    "/api/aplicar",
    "/api/models/notes",
    "/api/models/payments",
    "/api/models/earnings",
    "/api/models/documents",
    "/api/models/onboarding",
    "/api/models/checklist",
    "/api/models/update",
    "/api/models/avatar",
    "/api/models/delete",
    "/api/models/status",
    "/api/models/marketing",
    "/api/admin/users",
    "/api/brand/clients",
    "/api/brand/content/generate",
    "/api/brand/enroll-model",
    "/api/brand/launch",
]

def check(path):
    url = BASE + path
    try:
        req = urllib.request.Request(url, method="GET", headers={"User-Agent":"Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.status, "OK"
    except HTTPError as e:
        return e.code, e.read().decode(errors="ignore")[:100]
    except Exception as e:
        return f"ERR: {e}", ""

for p in API_PATHS:
    status, body = check(p)
    print(f"{status:>6} {p:40} {body[:60]}")
