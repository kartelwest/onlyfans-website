import re
import urllib.request
import urllib.error
from urllib.parse import urljoin, urlparse

BASE = "https://www.karaymodels.com"
PUBLIC_PATHS = [
    "/",
    "/por-que-nos",
    "/faq",
    "/aplicar",
    "/como-compartilhar-google-photos",
    "/diretrizes-de-gravacao",
    "/login",
    "/portal",
    "/privacidade",
    "/termos",
    "/admin/amplia",
    "/admin/models",
    "/owner",
    "/representative",
    "/area-da-modelo",
    "/administrator",
]

def fetch(path):
    url = urljoin(BASE, path)
    try:
        req = urllib.request.Request(url, method="HEAD")
        req.add_header("User-Agent", "Mozilla/5.0")
        with urllib.request.urlopen(req, timeout=20) as resp:
            return resp.status, resp.geturl(), dict(resp.headers)
    except urllib.error.HTTPError as e:
        return e.code, e.geturl(), dict(e.headers)
    except Exception as e:
        return f"ERR: {e}", url, {}

for path in PUBLIC_PATHS:
    status, final, headers = fetch(path)
    print(f"{status:>6} {path:40} -> {final}")
