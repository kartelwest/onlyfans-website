import urllib.request
from urllib.parse import urljoin

BASE = "https://www.karaymodels.com"

PROTECTED = [
    "/owner",
    "/owner/users",
    "/owner/users/new",
    "/owner/users/123",
    "/admin/models",
    "/admin/models/example-slug",
    "/admin/users/new",
    "/admin/amplia",
    "/admin/amplia/models",
    "/admin/amplia/models/new",
    "/admin/import",
    "/admin/assistant",
    "/administrator",
    "/representative",
    "/representative/models/123",
    "/area-da-modelo",
    "/alterar-senha",
]

def fetch_no_redirect(path):
    url = urljoin(BASE, path)
    try:
        req = urllib.request.Request(url, method="HEAD", headers={"User-Agent":"Mozilla/5.0"})
        # don't follow redirects
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.status, resp.geturl(), dict(resp.headers)
    except urllib.error.HTTPError as e:
        return e.code, e.geturl(), dict(e.headers)
    except Exception as e:
        return f"ERR: {e}", url, {}

for p in PROTECTED:
    status, final, headers = fetch_no_redirect(p)
    loc = headers.get("Location", "")
    print(f"{status:>6} {p:40} -> {loc}")
