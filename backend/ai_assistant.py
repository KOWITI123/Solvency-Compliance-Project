import os
import io
import json
import time
import logging
import re
import concurrent.futures
import requests
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from datetime import datetime
from dotenv import load_dotenv
import PyPDF2
from pathlib import Path

# optional google auth for service-account bearer token
try:
    from google.oauth2 import service_account
    from google.auth.transport.requests import Request as GoogleRequest
    _HAS_GOOGLE_AUTH = True
except Exception:
    _HAS_GOOGLE_AUTH = False

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ai_assistant")

# Gemini configuration (primary Cloud LLM)
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
# Note: GEMINI_MODEL is set to flash by default for lower latency
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash") 
GEMINI_CHUNK_MODEL = os.getenv("GEMINI_CHUNK_MODEL", GEMINI_MODEL)

# Token and chunk configuration
CHUNK_SUMMARY_MAX_TOKENS = int(os.getenv("GPT_CHUNK_MAX_TOKENS", "150"))
CHUNK_MAX_CHARS = int(os.getenv("GPT_CHUNK_MAX_CHARS", str(3000)))

# Operational defaults - Increased Timeout/Retries for Resilience
GPT_TIMEOUT = int(os.getenv("GPT_TIMEOUT", "90"))
GPT_RETRIES = int(os.getenv("GPT_RETRIES", "4"))
GPT_MAX_WORKERS = int(os.getenv("GPT_MAX_WORKERS", "1"))

# Cache for discovered available model
_AVAILABLE_MODEL_CACHE = None

# --- Helper Functions for Numeric Extraction ---

_number_pattern = re.compile(r"[0-9\(\)\,\.\' \-KSkshs%]+", re.IGNORECASE)

def _normalize_number_token(token: str) -> Optional[float]:
    """Cleans a token string and attempts to convert it to a float."""
    if not isinstance(token, str):
        return None
    
    # Remove currency, thousands separators, and balance symbols like '000 from KShs '000
    cleaned = token.strip().replace("KShs", "").replace("Kshs", "").replace("ks", "").replace("k", "")
    cleaned = cleaned.replace("'", "").replace(",", "").replace("%", "").strip()

    # Handle parenthetical negatives (common in financial statements)
    if cleaned.startswith('(') and cleaned.endswith(')'):
        cleaned = "-" + cleaned[1:-1]
    
    try:
        # Final clean-up for common table anomalies
        if cleaned.endswith(" '000"):
            cleaned = cleaned.replace(" '000", "").strip()
        
        # Check if it's a valid float string
        if cleaned:
            return float(cleaned)
        return None
    except ValueError:
        return None

def _extract_first_number_from_text(text: str) -> Optional[float]:
    """Finds the first plausible number in a line of text using the pattern and normalizes it."""
    for match in _number_pattern.finditer(text):
        token = match.group(0)
        value = _normalize_number_token(token)
        if value is not None:
            return value
    return None

# --- End Helper Functions ---

def _get_available_model() -> Optional[str]:
    """Discover and cache the first available Gemini model that supports generateContent.
    Prefers stable models over preview/experimental versions.
    """
    global _AVAILABLE_MODEL_CACHE
    if _AVAILABLE_MODEL_CACHE:
        return _AVAILABLE_MODEL_CACHE
    try:
        # First try to get models that support generateContent
        models = _list_gemini_models(filter_for_generation=True)
        if models:
            # FIX: Prioritize Flash over Pro for lower latency
            for priority_model in ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash']:
                for m in models:
                    if m == priority_model or priority_model in m:
                        _AVAILABLE_MODEL_CACHE = m
                        logger.info("Discovered available generation model (priority -> exact): %s", _AVAILABLE_MODEL_CACHE)
                        return _AVAILABLE_MODEL_CACHE
            
            # Fall back to first discovered model if none of the top priorities match
            _AVAILABLE_MODEL_CACHE = models[0]
            logger.info("Discovered available generation model (fallback): %s", _AVAILABLE_MODEL_CACHE)
            return _AVAILABLE_MODEL_CACHE
            
    except Exception as e:
        logger.debug("Could not discover available generation models: %s", e)
    return None

def _validate_api_key():
    """Quick validation of GEMINI_API_KEY by listing models (non-fatal)."""
    if not GEMINI_API_KEY:
        logger.warning("GEMINI_API_KEY not set; Gemini calls will fail.")
        return
    try:
        url = f"https://generativelanguage.googleapis.com/v1/models?key={GEMINI_API_KEY}"
        r = requests.get(url, timeout=8)
        if r.status_code == 200:
            logger.info("Gemini API key appears valid (models list retrieved).")
        else:
            logger.warning("Gemini key test returned %s: %s", r.status_code, r.text[:200])
    except Exception as e:
        logger.warning("Gemini key validation failed: %s", e)

# run quick validation at import time to catch obvious key issues early
_validate_api_key()

# Helper to avoid logging raw API keys in URLs
def _mask_url(u: str) -> str:
    try:
        if "?key=" in u:
            pre, _ = u.split("?key=", 1)
            return f"{pre}?key=REDACTED"
    except Exception:
        pass
    return u

# Ollama support removed — no local LLM call function retained.

@dataclass
class FinancialSummary:
    insurer_id: Optional[int] = None
    document_title: Optional[str] = None
    submission_date: Optional[str] = None
    narrative: str = ""
    metrics: Dict[str, Any] = field(default_factory=dict)
    recommendations: List[str] = field(default_factory=list)
    missing_items: List[str] = field(default_factory=list)
    confidence: Optional[float] = None
    raw_chunk_summaries: List[str] = field(default_factory=list)


def _get_bearer_token() -> Optional[str]:
    """Return a bearer token from GOOGLE_APPLICATION_CREDENTIALS if available (else None)."""
    if not _HAS_GOOGLE_AUTH:
        return None
    cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    if not cred_path or not os.path.exists(cred_path):
        return None
    try:
        creds = service_account.Credentials.from_service_account_file(cred_path)
        scoped = creds.with_scopes(["https://www.googleapis.com/auth/cloud-platform"])
        scoped.refresh(GoogleRequest())
        return scoped.token
    except Exception as e:
        logger.warning("Failed to obtain bearer token from service account: %s", e)
        return None


def _list_gemini_models(filter_for_generation: bool = False) -> List[str]:
    """List available models (uses bearer token when possible or GEMINI_API_KEY).
    If filter_for_generation=True, only return models that support generateContent.
    """
    # use the v1 endpoint (matches the model listing you verified with curl)
    base = "https://generativelanguage.googleapis.com/v1/models"
    bearer = _get_bearer_token()
    headers = {}
    url = base
    if bearer:
        headers["Authorization"] = f"Bearer {bearer}"
    elif GEMINI_API_KEY:
        url = f"{url}?key={GEMINI_API_KEY}"
    else:
        raise RuntimeError("No credentials to list Gemini models.")
    r = requests.get(url, headers=headers, timeout=10)
    if r.status_code != 200:
        raise RuntimeError(f"Model list failed: {r.status_code} {r.text}")
    jd = r.json()
    models = []
    for e in jd.get("models", []):
        name = e.get("name") or e.get("model")
        if name and name.startswith("models/"):
            model_id = name.split("/", 1)[1]
        elif name:
            model_id = name
        else:
            continue
        
        # Filter for generation models if requested
        if filter_for_generation:
            supported_methods = e.get("supportedGenerationMethods", [])
            if "generateContent" not in supported_methods:
                continue
        
        models.append(model_id)
    
    logger.info("Available Gemini models: %s", models)
    return models


class GPTComplianceAgent:
    """AI agent that summarizes insurer financial statements using the Gemini Generative Language API."""

    def __init__(self, model: Optional[str] = None):
        # Use provided model or discover a suitable Gemini model; fall back to GEMINI_MODEL
        self.model = model or _get_available_model() or GEMINI_MODEL
        logger.info("Initialized GPTComplianceAgent using Gemini model=%s", self.model)
         
        self.timeout = GPT_TIMEOUT
        self.retries = GPT_RETRIES

    def extract_text_from_pdf(self, pdf_file: bytes) -> str:
        """Extract text from PDF bytes. Returns plain text concatenation of pages."""
        try:
            if hasattr(pdf_file, "read"):
                pdf_bytes = pdf_file.read()
            else:
                pdf_bytes = pdf_file
            reader = PyPDF2.PdfReader(io.BytesIO(pdf_bytes))
            texts = []
            for page in reader.pages:
                try:
                    p = page.extract_text() or ""
                except Exception:
                    p = ""
                if p:
                    texts.append(p)
            full_text = "\n\n".join(texts)
            logger.info("Extracted %d characters from PDF (%d pages).", len(full_text), len(texts))
            return full_text
        except Exception:
            logger.exception("Failed to extract text from PDF")
            return ""

    def _chunk_text(self, text: str, max_chars: int = CHUNK_MAX_CHARS) -> List[str]:
        """Naive chunker on character count that tries to split on paragraph boundaries."""
        if not text:
            return []
        paragraphs = re.split(r"\n{2,}", text)
        chunks = []
        current = []
        current_len = 0
        for p in paragraphs:
            plen = len(p) + 2
            if current_len + plen > max_chars and current:
                chunks.append("\n\n".join(current))
                current = [p]
                current_len = plen
            else:
                current.append(p)
                current_len += plen
        if current:
            chunks.append("\n\n".join(current))
        logger.info("Split text into %d chunks (max %d chars).", len(chunks), max_chars)
        return chunks

    def _call_gpt(self, messages: List[Dict[str, str]], max_tokens: int = 1024, temperature: float = 0.0, model_override: Optional[str] = None) -> str:
        """Call AI API (Gemini). Returns a string (may be empty) on failure."""
        # flatten chat messages into a single prompt
        prompt_parts = []
        for m in messages:
            role = m.get("role", "")
            content = m.get("content", "")
            if role:
                prompt_parts.append(f"[{role.upper()}]\n{content}\n")
            else:
                prompt_parts.append(content)
        prompt_text = "\n\n".join(prompt_parts)

        model_to_use = model_override or self.model

        def _invoke_once(prompt: str, candidate: str) -> Optional[str]:
            # Use only the :generate endpoint (v1) with payload shapes known to be accepted.
            base = "https://generativelanguage.googleapis.com/v1/models"
            endpoint = f"{base}/{candidate}:generate"

            bearer = _get_bearer_token()
            headers_base = {"Content-Type": "application/json"}
            if bearer:
                headers_base["Authorization"] = f"Bearer {bearer}"

            # Keep payload variants minimal and compatible with v1 :generate
            payload_variants = [
                {"prompt": {"text": prompt}, "maxOutputTokens": int(max_tokens), "temperature": float(temperature)},
                {"contents": [{"role": "user", "parts": [{"text": prompt}]}],
                 "generationConfig": {"maxOutputTokens": int(max_tokens), "temperature": float(temperature)}},
            ]

            for payload in payload_variants:
                url = endpoint if bearer else (f"{endpoint}?key={GEMINI_API_KEY}" if GEMINI_API_KEY else endpoint)
                headers = dict(headers_base)
                try:
                    r = requests.post(url, json=payload, headers=headers, timeout=self.timeout)
                except requests.RequestException as e:
                    logger.debug(
                        "HTTP request to Gemini failed for candidate %s endpoint=%s payload_variant=%s: %s",
                        candidate, _mask_url(url), type(payload).__name__, e
                    )
                    continue

                if r.status_code != 200:
                    body = r.text or ""
                    try:
                        body = json.dumps(r.json())
                    except Exception:
                        pass
                    if r.status_code == 404:
                        logger.debug("Gemini returned 404 for candidate=%s endpoint=%s", candidate, _mask_url(url))
                    elif r.status_code in (401, 403):
                        logger.warning("Gemini authorization error %s for candidate=%s endpoint=%s", r.status_code, candidate, _mask_url(url))
                    else:
                        logger.warning("Gemini API returned %s for candidate=%s endpoint=%s body=%s", r.status_code, candidate, _mask_url(url), body)
                    continue

                try:
                    j = r.json()
                except Exception as e:
                    logger.warning("Failed to parse Gemini JSON for candidate=%s endpoint=%s: %s", candidate, _mask_url(url), e)
                    continue

                # Handle common response shapes (conservative)
                if "candidates" in j and isinstance(j["candidates"], list) and j["candidates"]:
                    cand = j["candidates"][0]
                    # older shape: content -> parts -> text
                    content = cand.get("content", {})
                    parts = content.get("parts", [])
                    if parts and isinstance(parts, list) and parts:
                        text = parts[0].get("text", "")
                        if text:
                            return str(text).strip()
                    # newer shape: candidates[].output[].content[].text
                    if "output" in cand and isinstance(cand["output"], list) and cand["output"]:
                        out0 = cand["output"][0]
                        if isinstance(out0, dict) and "content" in out0 and isinstance(out0["content"], list):
                            for item in out0["content"]:
                                if isinstance(item, dict) and "text" in item:
                                    return str(item["text"]).strip()

                if "output" in j and isinstance(j["output"], list) and j["output"]:
                    for entry in j["output"]:
                        if isinstance(entry, dict) and "content" in entry and isinstance(entry["content"], list):
                            for part in entry["content"]:
                                if isinstance(part, dict) and "text" in part:
                                    return str(part["text"]).strip()

                if isinstance(j.get("candidates"), list) and j["candidates"]:
                    first = j["candidates"][0]
                    if isinstance(first, str):
                        return first.strip()

                if isinstance(j.get("text"), str) and j.get("text").strip():
                    return j.get("text").strip()

                logger.debug("No valid content in Gemini response for candidate=%s endpoint=%s; trying next variant", candidate, _mask_url(url))
            return None

        tried = []
        for candidate in [model_to_use, f"models/{model_to_use}"]:
            tried.append(candidate)
            for attempt in range(1, self.retries + 1):
                res = _invoke_once(prompt_text, candidate)
                if res:
                    return res
                time.sleep(min(1.0 * attempt, 5.0))

        logger.error("All Gemini attempts failed (candidates tried: %s). Returning empty string.", tried)
        return ""

    def summarize_chunk(self, chunk_text: str, context_instructions: Optional[str] = None, model: Optional[str] = None) -> str:
        """Extract financial numbers from chunk using Gemini API with fallback to strict LLM JSON extraction."""
        # First try regex extraction for quick wins
        # canonical target keys (match final metrics keys)
        target_keys = {
            # Use non-greedy match for Capital/Liabilities to capture the number immediately following the label
            "capital": r"(?:total\s+equity\s+\(capital\)|total\s+equity)(?:\s*.*?\s*|\s*[:\s=]*)([0-9\(\)\-,\.\sA-Zaz']+)",
            "liabilities": r"(?:total\s+liabilities)(?:\s*.*?\s*|\s*[:\s=]*)([0-9\(\)\-,\.\sA-Zaz']+)",
            "solvency_ratio": r"(?:solvency\s+ratio|solvency)[:\s=]*([0-9\.\,\-]+%?)",
            "auditors_unqualified_opinion": r"(?:(?:auditor(?:'s)?\s+opinion)|(?:opinion\s+of\s+the\s+auditors)).{0,120}",
            "profit_before_tax": r"(?:profit\s+before\s+tax|pbt)[:\s=]*([0-9\(\)\-,\.\sA-Zaz']+)",
            "gwp": r"(?:gross\s+written\s+premium|gwp)[:\s=]*([0-9\(\)\-,\.\sA-Zaz']+)",
            # Specific regex for IBNR to avoid swap with Net Claims
            "ibnr_reserve_gross": r"(?:IBNR\s+Reserve\s+\(Gross\))(?:\s*.*?\s*|\s*[:\s=]*)([0-9\(\)\-,\.\sA-Zaz']+)",
            "net_claims_paid": r"(?:Net\s+Claims\s+Paid)[:\s=]*([0-9\(\)\-,\.\sA-Zaz']+)",
            
            # Patterns for the financial items
            "investment_income_total": r"(?:Investment\s+Income)[:\s=]*([0-9\(\)\-,\.\sA-Zaz']+)",
            "commission_expense_total": r"(?:Commission\s+Expense\s+\(Total\))(?:\s*.*?\s*|\s*[:\s=]*)([0-9\(\)\-,\.\sA-Zaz']+)",
            "operating_expenses_total": r"(?:Operating\s+Expenses\s+\(Total\))(?:\s*.*?\s*|\s*[:\s=]*)([0-9\(\)\-,\.\sA-Zaz']+)",
            "contingency_reserve_statutory": r"(?:Contingency\s+Reserve)(?:\s*.*?\s*|\s*[:\s=]*)([0-9\(\)\-,\.\sA-Zaz']+)",
            
            "related_party_net_exposure": r"(?:Related\s+Party\s+Net\s+Exposure)(?:\s*.*?\s*|\s*[:\s=]*)([0-9\(\)\-,\.\sA-Zaz']+)",
            
            "total_premiums": r"(?:total\s+premiums|net\s+premiums)[:\s=]*([0-9\(\)\-,\.\sA-Zaz']+)",
            "expenses": r"(?:total\s+expenses|underwriting\s+expenses)[:\s=]*([0-9\(\)\-,\.\sA-Zaz']+)",
            "profit_after_tax": r"(?:profit\s+after\s+tax|net\s+profit)[:\s=]*([0-9\(\)\-,\.\sA-Zaz']+)",
            "roe": r"(?:return\s+on\s+equity|roe)[:\s=]*([0-9\.\,\-]+%?)",
            "combined_ratio": r"(?:combined\s+ratio|cr)[:\s=]*([0-9\.\,\-]+%?)",
            "loss_ratio": r"(?:loss\s+ratio|lr)[:\s=]*([0-9\.\,\-]+%?)",
            "expense_ratio": r"(?:expense\s+ratio|er)[:\s=]*([0-9\.\,\-]+%?)",
        }
        # inverse mapping for strict fallback
        target_keys_invert = {v: k for k, v in target_keys.items()}

        chunk_text = chunk_text.strip()

        # 1. strict JSON extraction attempt
        try:
            logger.info("Attempting strict JSON extraction on chunk.")
            msg = [{"role": "user", "content": f"Extract financial metrics from the following text:\n\n{chunk_text}\n\nMetrics: {list(target_keys.keys())}"}]
            json_res = self._call_gpt(msg, max_tokens=1500, temperature=0.0, model_override=model)
            logger.info("Raw Gemini response for JSON extraction: %s", json_res)
            
            # Explicit logging when Gemini fails to provide a response
            if not json_res:
                logger.warning("Gemini API call failed or returned empty response after all retries. Proceeding to heuristic regex fallback.")
            
            if json_res:
                json_res = json_res.strip()
                # try to parse as JSON
                if json_res.startswith("{") and json_res.endswith("}"):
                    try:
                        jd = json.loads(json_res)
                        logger.info("Parsed JSON extraction result: %s", jd)
                        # validate keys
                        missing_keys = [k for k in target_keys.keys() if k not in jd]
                        if not missing_keys:
                            # exact match — return as-is
                            return json_res
                        else:
                            logger.warning("JSON extraction missing keys: %s", missing_keys)
                    except json.JSONDecodeError:
                        logger.warning("JSON extraction result not valid JSON: %s", json_res)
                else:
                    logger.warning("JSON extraction result not enclosed in braces: %s", json_res)
        except Exception as e:
            logger.exception("Error during strict JSON extraction: %s", e)

        # 2. fallback to regex and heuristics
        logger.info("Falling back to regex and heuristic extractions.")
        metrics = {}
        for key, pattern in target_keys.items():
            try:
                logger.info("Extracting %s using pattern: %s", key, pattern)

                # First try inline "label ... number" pattern
                inline_re = re.compile(pattern, re.IGNORECASE)
                m = inline_re.search(chunk_text)
                if m and m.group(1):
                    # m.group(1) captures the value portion defined in the target_keys regex
                    v = _normalize_number_token(m.group(1))
                    if v is not None:
                        metrics[key] = v
                        continue
                        
                # Otherwise search line-by-line neighbours (Fallback for remaining fields)
                lines = [l for l in chunk_text.splitlines()]
                found_value = None

                # Simplified label extraction for line-by-line search
                # Use highly specific regex matching for the line-by-line scan to anchor the search
                label_re = re.compile(r"|PricewaterhouseCoopers|IFRS|KShs '000", re.IGNORECASE) # Default very generic

                if key == 'capital':
                    label_re = re.compile(r"(Total\s+Equity\s+\(Capital\)|Total\s+Equity)", re.IGNORECASE)
                elif key == 'liabilities':
                    label_re = re.compile(r"Total\s+Liabilities", re.IGNORECASE)
                elif key == 'profit_before_tax':
                    label_re = re.compile(r"Profit\s+Before\s+Tax", re.IGNORECASE)
                elif key == 'gwp':
                    label_re = re.compile(r"Gross\s+Written\s+Premium", re.IGNORECASE)
                elif key == 'net_claims_paid':
                    label_re = re.compile(r"Net\s+Claims\s+Paid", re.IGNORECASE)
                elif key == 'investment_income_total':
                    label_re = re.compile(r"Investment\s+Income", re.IGNORECASE)
                elif key == 'commission_expense_total':
                    label_re = re.compile(r"Commission\s+Expense\s+\(Total\)", re.IGNORECASE)
                elif key == 'operating_expenses_total':
                    label_re = re.compile(r"Operating\s+Expenses\s+\(Total\)", re.IGNORECASE)
                elif key == 'contingency_reserve_statutory':
                    label_re = re.compile(r"Contingency\s+Reserve", re.IGNORECASE)
                elif key == 'ibnr_reserve_gross':
                    label_re = re.compile(r"IBNR\s+Reserve\s+\(Gross\)", re.IGNORECASE)
                elif key == 'related_party_net_exposure':
                    label_re = re.compile(r"Related\s+Party\s+Net\s+Exposure", re.IGNORECASE)
                elif key == 'auditors_unqualified_opinion':
                    label_re = re.compile(r"auditor(?:'s)?\s+opinion|opinion\s+of\s+the\s+auditors", re.IGNORECASE)
                elif key == 'solvency_ratio':
                    label_re = re.compile(r"solvency\s+ratio", re.IGNORECASE)


                for i, line in enumerate(lines):
                    # Check if the line contains the label
                    if label_re.search(line):
                        # 1. Try extracting from the line containing the keyword (for cleaner extraction)
                        nv = _extract_first_number_from_text(line)
                        if nv is not None:
                            found_value = nv
                            break
                        
                        # 2. Look ahead up to 2 lines (for the table value)
                        if found_value is None:
                            for j in range(i + 1, min(i + 3, len(lines))):
                                nv = _extract_first_number_from_text(lines[j]) 
                                if nv is not None:
                                    found_value = nv
                                    break
                        
                        # 3. Look back up to 2 lines
                        if found_value is None:
                            for j in range(max(0, i - 2), i):
                                nv = _extract_first_number_from_text(lines[j]) 
                                if nv is not None:
                                    found_value = nv
                                    break
                                    
                    if found_value is not None:
                        metrics[key] = found_value
                        break # Found for this key, move to the next key

            except Exception as e:
                logger.exception("Error extracting key %s: %s", key, e)

        logger.info("Extracted metrics: %s", metrics)
        
        # Define keys that require the 1000 scaling (i.e., monetary figures in KShs '000)
        # FIX: Restrict this list to only the core monetary figures, excluding spurious/ratio keys.
        KSHS_THOUSANDS_KEYS = {
            "capital", "liabilities", "gwp", "ibnr_reserve_gross", "net_claims_paid", 
            "investment_income_total", "commission_expense_total", "operating_expenses_total", 
            "contingency_reserve_statutory", "profit_before_tax", "related_party_net_exposure"
        }

        # post-process common fields (Scaling, k/m/b, and 1000 multiplier)
        for k in target_keys.keys():
            if k in metrics and metrics[k] is not None:
                try:
                    v = metrics[k]
                    original_v_str = str(v)
                    scaled_by_suffix = False

                    if isinstance(v, str):
                        # 1. Check for explicit K/M/B scaling *first*
                        if re.search(r'[a-zA-Z]', original_v_str):
                            v_cleaned = original_v_str.replace(",", "").replace(" ", "").strip()
                            scale = 1.0
                            if v_cleaned.lower().endswith("b"):
                                scale = 1e9
                                v_cleaned = v_cleaned[:-1]
                            elif v_cleaned.lower().endswith("m"):
                                scale = 1e6
                                v_cleaned = v_cleaned[:-1]
                            elif v_cleaned.lower().endswith("k"):
                                scale = 1e3
                                v_cleaned = v_cleaned[:-1]
                            
                            v_cleaned = v_cleaned.replace(",", "").replace(" ", "").strip()
                            if v_cleaned.startswith('(') and v_cleaned.endswith(')'):
                                v_cleaned = "-" + v_cleaned[1:-1]
                            
                            if v_cleaned:
                                v = float(v_cleaned) * scale
                                scaled_by_suffix = True
                            else:
                                continue
                        # If no suffix, normalize to float
                        else:
                            v = float(v)
                    
                    # 2. Apply 1000 scaling to financial amounts only if in the restrictive list
                    #    AND only if not already scaled by an explicit K/M/B suffix
                    if k in KSHS_THOUSANDS_KEYS and not scaled_by_suffix:
                        v = float(v) * 1000.0 # Multiply by 1000
                        logger.info("Applied 1000 scaling to key %s: %f", k, v)


                    metrics[k] = v
                except Exception as e:
                    logger.warning("Error processing metric %s value %s: %s", k, metrics[k], e)

        # promote or add missing fields as null
        for k in target_keys.keys():
            if k not in metrics:
                metrics[k] = None

        logger.info("Final extracted metrics: %s", metrics)
        return metrics

    def summarize_document(self, pdf_file_bytes: bytes, document_title: Optional[str] = None) -> FinancialSummary:
        """Extract text from a PDF, call summarize_chunk for each chunk and aggregate metrics."""
        text = self.extract_text_from_pdf(pdf_file_bytes)
        summary = FinancialSummary(document_title=document_title or None)
        if not text:
            logger.warning("summarize_document: no text extracted from PDF")
            summary.narrative = ""
            return summary

        chunks = self._chunk_text(text)
        raw_chunk_summaries: List[str] = []
        expected_keys = [
            "capital",
            "liabilities",
            "solvency_ratio",
            "auditors_unqualified_opinion",
            "profit_before_tax",
            "gwp",
            "ibnr_reserve_gross",
            "net_claims_paid",
            "investment_income_total",
            "commission_expense_total",
            "operating_expenses_total",
            "contingency_reserve_statutory",
            "related_party_net_exposure",
        ]
        aggregated: Dict[str, Any] = {k: None for k in expected_keys}
        missing_items: List[str] = []

        for idx, chunk in enumerate(chunks):
            try:
                metrics = self.summarize_chunk(chunk)
                # normalize if summarize_chunk returned JSON string
                if isinstance(metrics, str):
                    try:
                        metrics = json.loads(metrics)
                    except Exception:
                        # keep as-is if not JSON
                        pass
                raw_chunk_summaries.append(str(metrics))
                if isinstance(metrics, dict):
                    # For non-overlapping keys, take the first value found
                    for k, v in metrics.items():
                        # Only take a value if we haven't found one yet and the value is not empty/None
                        if k in aggregated and aggregated.get(k) is None and v not in (None, ""):
                            # Apply additional aggregation logic for specific fields
                            if k == 'auditors_unqualified_opinion':
                                # Only keep if the text suggests 'unqualified' or 'clean'
                                if isinstance(v, str) and ('unqualified' in v.lower() or 'clean' in v.lower()):
                                    aggregated[k] = v
                            # For financial amounts, we might need a better heuristic, but for now, take the first non-null
                            elif k in expected_keys:
                                # Ensure we don't accidentally get an empty string or non-numeric placeholder
                                if v is not None and v != '':
                                    aggregated[k] = v
                            # For ratios, only take if it looks like a valid ratio (e.g., contains a %)
                            elif k == 'solvency_ratio':
                                if isinstance(v, str) and '%' in v:
                                    # Simple regex to extract the number from a string like '150%'
                                    ratio_match = re.search(r'([0-9\.\,]+)%?', v)
                                    if ratio_match:
                                        try:
                                            # Store as a float percentage (e.g., 150.0)
                                            aggregated[k] = float(ratio_match.group(1).replace(',', ''))
                                        except ValueError:
                                            pass
                            else:
                                aggregated[k] = v
                                
                    # Special Case: Manually check for 'auditors_unqualified_opinion' in the raw text if not found in metrics
                    if aggregated.get("auditors_unqualified_opinion") is None:
                        # Note: The pattern in target_keys is for finding the *mention* of opinion, not extracting its state.
                        # Since the full document text is available in 'text', we search it directly.
                        if re.search(r'Auditor(?:s)?\'? (?:Unqualified|Clean) Opinion', text, re.IGNORECASE):
                            aggregated["auditors_unqualified_opinion"] = "Unqualified (Found in text)"
                        elif re.search(r'qualified opinion|adverse opinion|disclaimer of opinion', text, re.IGNORECASE):
                            # Log if a negative opinion is found, though we only track 'unqualified' as a positive flag
                            logger.warning("Found evidence of a Qualified/Adverse/Disclaimer of Opinion.")


            except Exception as e:
                logger.debug("summarize_document: failed on chunk %d: %s", idx, e)

        # compute solvency_ratio if possible
        try:
            # Need to ensure capital and liabilities are in the same scale (KShs '000 in this case)
            cap = aggregated.get("capital")
            liab = aggregated.get("liabilities")
            
            # Ensure they are numeric (float/int) before calculation
            if isinstance(cap, str): cap = _normalize_number_token(cap)
            if isinstance(liab, str): liab = _normalize_number_token(liab)
            
            if aggregated.get("solvency_ratio") is None and cap is not None and liab is not None:
                if cap > 0 and liab > 0:
                    # Solvency ratio = (Capital - Liabilities) / Liabilities * 100.
                    aggregated["solvency_ratio"] = round(((float(cap) - float(liab)) / float(liab)) * 100, 2)
                    logger.info("summarize_document: computed solvency_ratio: %s%%", aggregated["solvency_ratio"])
        except Exception:
            logger.debug("summarize_document: could not compute solvency_ratio", exc_info=True)


        # Simple check for missing expected keys
        summary.raw_chunk_summaries = raw_chunk_summaries
        summary.metrics = aggregated
        # Recalculate missing items based on final aggregated metrics
        summary.missing_items = [k for k in expected_keys if aggregated.get(k) is None or aggregated.get(k) == '']
        summary.narrative = ""
        summary.confidence = None
        logger.info("summarize_document: extracted metrics: %s", aggregated)
        logger.info("summarize_document: missing items: %s", summary.missing_items)
        return summary