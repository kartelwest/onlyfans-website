import re
import urllib.request
from urllib.parse import urljoin, urlparse

BASE = "https://www.karaymodels.com"

public_paths = [
    "/",
    "/por-que-nos",
    "/faq",
    "/aplicar",
    "/como-compartilhar-google-photos",
    "/diretrizes-de-gravacao",
    "/login",
    "/portal",
]

internal_pattern = re.compile(r'(?:href|src|action)=["\']([^"\']+)["\']')

def fetch(url):
    try:
        req = urllib.request.Request(url, headers={"User-Agent":"Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=20) as resp:
            return resp.status, resp.read().decode("utf-8", errors="ignore")
    except urllib.error.HTTPError as e:
        return e.code, ""
    except Exception as e:
        return f"ERR: {e}", ""

def extract_links(html, base):
    links = set()
    for m in internal_pattern.finditer(html):
        url = m.group(1)
        if url.startswith("#") or url.startswith("mailto:") or url.startswith("tel:") or url.startswith("javascript:"):
            continue
        full = urljoin(base, url)
        links.add(full)
    return links

all_links = set()
for path in public_paths:
    url = BASE + path
    status, html = fetch(url)
    print(f"{status:>6} {path}")
    if status == 200:
        links = extract_links(html, url)
        for l in links:
            if l.startswith(BASE) or urlparse(l).netloc == urlparse(BASE).netloc:
                all_links.add(l)

print("\nChecking internal links:")
for l in sorted(all_links):
    path = urlparse(l).path or "/"
    if "/_next/" in path or path.endswith(('.js','.css','.png','.jpg','.jpeg','.webp','.svg','.ico','.woff','.woff2')):
        continue
    s, _ = fetch(l)
    print(f"  {s:>6} {path}")
