import requests, json, os, sys, time

# WARNING: for testing only. Do NOT commit this file with a real key.
# Option A: read from env (preferred for quick test)
KEY = os.getenv("GEMINI_API_KEY")
# Option B: hardcode a freshly created key for one-off testing
# KEY = "AIzaSy...YOUR_NEW_KEY_HERE..."

if not KEY:
    print("No GEMINI_API_KEY in env and no hardcoded key provided.")
    sys.exit(1)

# Use an exact model name from your models list
MODEL = "models/gemini-2.5-flash"  # or models/gemini-2.5-pro per list
URL = f"https://generativelanguage.googleapis.com/v1/{MODEL}:generate?key={KEY}"

payload = {
    "content": [{"type":"text","text":"Hello from test script — reply briefly."}],
    "maxOutputTokens": 64
}
# Some deployments accept 'contents' shaped payloads; try alternate if needed
alt_payload = {
    "contents": [{"role": "user", "parts": [{"text": "Hello from test script — reply briefly."}]}],
    "config": {"max_output_tokens": 64}
}

def try_post(u, p):
    try:
        r = requests.post(u, json=p, timeout=15)
        print("URL:", u)
        print("Status:", r.status_code)
        print("Response:", r.text[:2000])
        return r.status_code
    except Exception as e:
        print("Request failed:", e)
        return None

print("Trying payload format A...")
s = try_post(URL, payload)
if s != 200:
    print("\nTrying alternate payload format B...")
    try_post(URL, alt_payload)

print("\nDone. If you see 404, the key/project likely lacks generation access or has restrictions.")
print("If list (GET /v1/models) works but generate returns 404, check: API enabled, key restrictions, and project ownership.")