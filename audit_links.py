import re
import urllib.request
from urllib.parse import urljoin, urlparse

BASE = "https://www.karaymodels.com"

WHITELIST = re.compile(r"https?://(www\\.)?karaymodels\\.com", re.I)

def fetch(url):
    try:
        req = urllib.request.Request(url, headers={"User-Agent":"Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status, resp.read().decode("utf-8", errors="ignore")
    except urllib.error.HTTPError as e:
        return e.code, ""
    except Exception as e:
        return f"ERR: {e}", ""

def extract_links(html, base):
    links = set()
    for m in re.finditer(r'(?:href|src|action)=["\']([^"\']+)["\']', html):
        url = m.group(1)
        full = urljoin(base, url)
        links.add(full)
    return links

status, html = fetch(BASE)
print(f"Homepage status: {status}")
links = extract_links(html, BASE)
internal = [l for l in links if WHITELIST.match(l) or l.startswith("/")]
external = [l for l in links if not WHITELIST.match(l) and l.startswith("http")]

print(f"\nInternal links found: {len(internal)}")
for l in sorted(internal):
    path = urlparse(l).path or "/"
    s, _ = fetch(l)
    print(f"  {s:>6} {path}")

print(f"\nExternal links found: {len(external)}")
for l in sorted(external)[:20]:
    print(f"  {l}")
