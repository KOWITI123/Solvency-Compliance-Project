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

# Gemini configuration (Gemini-only)
# Use API-key-only flow to avoid auth ambiguity (set GEMINI_API_KEY in env)
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
# prefer an available model by default (adjust via GEMINI_MODEL env var)
# Use Gemini 2.5 Flash by default (latest, fast, and widely available). Override with GEMINI_MODEL env var if needed.
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
GEMINI_CHUNK_MODEL = os.getenv("GEMINI_CHUNK_MODEL", GEMINI_MODEL)
CHUNK_SUMMARY_MAX_TOKENS = int(os.getenv("GPT_CHUNK_MAX_TOKENS", "150"))
CHUNK_MAX_CHARS = int(os.getenv("GPT_CHUNK_MAX_CHARS", str(3000)))

# Operational defaults (ensure these exist for agent initialization)
GPT_TIMEOUT = int(os.getenv("GPT_TIMEOUT", "60"))
GPT_RETRIES = int(os.getenv("GPT_RETRIES", "3"))
GPT_MAX_WORKERS = int(os.getenv("GPT_MAX_WORKERS", "1"))

# Cache for discovered available model
_AVAILABLE_MODEL_CACHE = None

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
            # Prefer stable models: prioritize non-preview, non-experimental models
            # Sort to put stable versions first
            stable_models = [m for m in models if not any(x in m.lower() for x in ['preview', 'exp', 'experimental'])]
            preferred_models = stable_models if stable_models else models
            
            # Further prioritize gemini-2.5-pro and gemini-2.5-flash
            for priority_model in ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash']:
                if priority_model in preferred_models:
                    _AVAILABLE_MODEL_CACHE = priority_model
                    logger.info("Discovered available generation model (priority): %s", _AVAILABLE_MODEL_CACHE)
                    return _AVAILABLE_MODEL_CACHE
            
            # Fall back to first stable model
            _AVAILABLE_MODEL_CACHE = preferred_models[0]
            logger.info("Discovered available generation model: %s", _AVAILABLE_MODEL_CACHE)
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
    base = "https://generativelanguage.googleapis.com/v1beta/models"
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
    """Gemini-based agent that summarizes insurer financial statements for the regulator."""

    def __init__(self, model: Optional[str] = None):
        self.model = model or GEMINI_MODEL
        # Try to discover an available model if the default one might not exist
        if not model and self.model == GEMINI_MODEL:
            available = _get_available_model()
            if available:
                self.model = available
        self.timeout = GPT_TIMEOUT
        self.retries = GPT_RETRIES
        logger.info("Initialized GPTComplianceAgent using Gemini model=%s", self.model)

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
        """Call Google Generative Language API (Gemini) using service-account bearer token or API key.
        This wrapper guarantees a string return (may be empty) instead of None or raising for typical API
        failures so the rest of the pipeline can handle empty responses gracefully.
        """
        # flatten chat messages into a single prompt for Gemini
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
            """Single HTTP attempt; returns string or None on unrecoverable error."""
            base = "https://generativelanguage.googleapis.com/v1beta/models"
            url = f"{base}/{candidate}:generateContent"
            payload = {
                "contents": [
                    {
                        "role": "user",
                        "parts": [{"text": prompt}]
                    }
                ],
                "generationConfig": {
                    "maxOutputTokens": int(max_tokens),
                    "temperature": float(temperature)
                }
            }
            bearer = _get_bearer_token()
            headers = {"Content-Type": "application/json"}
            if bearer:
                headers["Authorization"] = f"Bearer {bearer}"
            elif GEMINI_API_KEY:
                url = f"{url}?key={GEMINI_API_KEY}"
            else:
                logger.error("No Gemini credentials configured")
                return None

            try:
                r = requests.post(url, json=payload, headers=headers, timeout=self.timeout)
            except requests.RequestException as e:
                logger.warning("HTTP request to Gemini failed for candidate %s: %s", candidate, e)
                return None

            if r.status_code != 200:
                body = r.text or ""
                try:
                    body = json.dumps(r.json())
                except Exception:
                    pass
                # For 503 (overloaded), return None to trigger retry
                # For other errors, also return None
                logger.warning("Gemini API returned %s for candidate=%s; headers=%s body=%s", r.status_code, candidate, dict(r.headers), body)
                return None

            # parse successful response
            try:
                j = r.json()
                cand = j.get("candidates", [])
                if cand and isinstance(cand, list) and len(cand) > 0:
                    content = cand[0].get("content", {})
                    parts = content.get("parts", [])
                    if parts and isinstance(parts, list) and len(parts) > 0:
                        text = parts[0].get("text", "")
                        if text:
                            return str(text).strip()
                    # Check if we hit MAX_TOKENS or other finish reasons
                    finish_reason = cand[0].get("finishReason", "")
                    if finish_reason == "MAX_TOKENS":
                        logger.warning("Gemini response hit MAX_TOKENS limit for candidate %s", candidate)
                        return None
                # No valid content found
                logger.warning("No valid content in Gemini response for candidate %s", candidate)
                return None
            except Exception as e:
                logger.warning("Failed to parse Gemini JSON response for candidate %s: %s", candidate, e)
                return None

        # Try a few candidate forms (model id and models/<id>), then try exact available model ids
        tried = []
        for candidate in [model_to_use, f"models/{model_to_use}"]:
            tried.append(candidate)
            for attempt in range(1, self.retries + 1):
                res = _invoke_once(prompt_text, candidate)
                if res:
                    return res
                # transient wait before retrying
                time.sleep(min(1.0 * attempt, 5.0))

        # try exact available ids from the service (best-effort) - filter for generation models only
        try:
            available = _list_gemini_models(filter_for_generation=True)
            logger.info("Attempting exact available generation model ids: %s", available)
            for exact in available:
                tried.append(exact)
                res = _invoke_once(prompt_text, exact)
                if res:
                    logger.info("Using exact model id: %s", exact)
                    return res
        except Exception as e:
            logger.debug("Could not list available Gemini models: %s", e)

        logger.error("All Gemini attempts failed (candidates tried: %s). Returning empty string.", tried)
        return ""

    def summarize_chunk(self, chunk_text: str, context_instructions: Optional[str] = None, model: Optional[str] = None) -> str:
        """Extract financial numbers from chunk using Gemini API with fallback to regex."""
        # First try regex extraction for quick wins
        key_numbers = {}
        
        # More specific patterns that require context (e.g., "Total Capital:" not just "Capital:")
        patterns = {
            "Capital": r"(?:total\s+capital|shareholders\s+equity|total\s+equity)[:\s=]+\s*([0-9,\.]+(?:\s+(?:million|billion|thousand|m|b|k))?)",
            "Liabilities": r"(?:total\s+liabilities)[:\s=]+\s*([0-9,\.]+(?:\s+(?:million|billion|thousand|m|b|k))?)",
            "GWP": r"(?:gross\s+written\s+premium|gwp)[:\s=]+\s*([0-9,\.]+(?:\s+(?:million|billion|thousand|m|b|k))?)",
            "Net Claims Paid": r"(?:net\s+claims\s+paid|net\s+claims)[:\s=]+\s*([0-9,\.]+(?:\s+(?:million|billion|thousand|m|b|k))?)",
            "Investment Income": r"(?:investment\s+income|investment\s+returns)[:\s=]+\s*([0-9,\.]+(?:\s+(?:million|billion|thousand|m|b|k))?)",
            "Commission Expense": r"(?:commission\s+expense|commissions)[:\s=]+\s*([0-9,\.]+(?:\s+(?:million|billion|thousand|m|b|k))?)",
            "Operating Expenses": r"(?:operating\s+expense|operating\s+costs)[:\s=]+\s*([0-9,\.]+(?:\s+(?:million|billion|thousand|m|b|k))?)",
            "Profit Before Tax": r"(?:profit\s+before\s+tax|pbt)[:\s=]+\s*([0-9,\.]+(?:\s+(?:million|billion|thousand|m|b|k))?)",
        }
        
        def parse_number(s):
            if not s:
                return None
            s_clean = re.sub(r"[,\s]", "", str(s))
            s_clean = re.sub(r"[^\d\.\-eE]", "", s_clean)
            try:
                return float(s_clean)
            except Exception:
                return None
        
        # Extract numbers using patterns
        for key, pattern in patterns.items():
            matches = re.findall(pattern, chunk_text, re.IGNORECASE)
            if matches:
                val = parse_number(matches[0])
                if val is not None:
                    key_numbers[key] = val
        
        # Extract title (first line or first sentence)
        lines = chunk_text.split('\n')
        title = lines[0][:100] if lines else "Financial Data"
        
        # Extract notes (any lines with "note", "remark", "disclosure")
        notes = []
        for line in lines:
            if any(keyword in line.lower() for keyword in ['note', 'remark', 'disclosure', 'important']):
                notes.append(line.strip())
        
        # Build JSON response
        result = {
            "title": title,
            "key_numbers": key_numbers,
            "notes": notes[:3],  # Limit to 3 notes
            "missing_items": []
        }
        
        return json.dumps(result, ensure_ascii=False)

    def synthesize_summaries(self, summaries: List[str]) -> Dict[str, Any]:
        """Combine per-chunk JSON summaries into a final structured synthesis."""
        system = (
            "You are an expert regulator-level summarizer. Combine the provided chunk JSON summaries into a single "
            "comprehensive summary. Extract and reconcile numeric values, indicate conflicts, and list missing items."
        )
        joined = "\n\n".join(summaries)
        user = (
            "Here are chunk summaries (JSON objects or text). Combine and produce a final JSON with keys:\n"
            "narrative (string), metrics (dict), recommendations (list), missing_items (list), confidence (0-100 number)\n\n"
            "Chunk summaries:\n" + joined
        )
        messages = [{"role": "system", "content": system}, {"role": "user", "content": user}]
        out = self._call_gpt(messages, max_tokens=1500, temperature=0.0)
        try:
            start = out.find("{")
            end = out.rfind("}")
            if start != -1 and end != -1:
                return json.loads(out[start:end + 1])
        except Exception:
            logger.exception("Failed to parse synthesis JSON")
        return {"narrative": out.strip(), "metrics": {}, "recommendations": [], "missing_items": [], "confidence": None}

    def extract_structured_metrics(self, chunk_summaries: List[str]) -> Dict[str, Any]:
        """Extract financial metrics from already-generated chunk summaries.
        This is more efficient than re-processing the full text.
        """
        schema_keys = [
            "capital",
            "liabilities",
            "solvency_ratio",
            "gwp",
            "net_claims_paid",
            "investment_income_total",
            "commission_expense_total",
            "operating_expenses_total",
            "profit_before_tax",
            "contingency_reserve_statutory",
            "ibnr_reserve_gross",
            "related_party_net_exposure",
            "auditors_unqualified_opinion",
        ]
        
        # Parse chunk summaries to extract numeric values
        extracted_metrics = {}
        
        # Join all summaries for searching
        all_summaries = "\n".join(chunk_summaries)
        logger.info("Searching for metrics in %d chunk summaries (total length: %d chars)", len(chunk_summaries), len(all_summaries))
        
        # Log first chunk summary for debugging
        if chunk_summaries:
            logger.info("First chunk summary (first 500 chars): %s", chunk_summaries[0][:500])
        
        def parse_number(s):
            if not s:
                return None
            s_clean = re.sub(r"[,\s]", "", str(s))
            s_clean = re.sub(r"[^\d\.\-eE]", "", s_clean)
            try:
                return float(s_clean)
            except Exception:
                return None
        
        # Try to extract from JSON key_numbers if present
        try:
            json_parsed_count = 0
            for idx, summary in enumerate(chunk_summaries):
                if not summary:
                    continue
                # Try to parse as JSON
                try:
                    obj = json.loads(summary)
                    json_parsed_count += 1
                    if isinstance(obj, dict) and "key_numbers" in obj:
                        key_nums = obj["key_numbers"]
                        if isinstance(key_nums, dict):
                            logger.info("Found key_numbers in chunk %d: %s", idx, list(key_nums.keys()))
                            for k, v in key_nums.items():
                                k_lower = k.lower()
                                # Map common key names to schema keys
                                if "capital" in k_lower or "equity" in k_lower:
                                    val = parse_number(v)
                                    if val and "capital" not in extracted_metrics:
                                        extracted_metrics["capital"] = val
                                        logger.info("Extracted capital: %s", val)
                                elif "liabil" in k_lower:
                                    val = parse_number(v)
                                    if val and "liabilities" not in extracted_metrics:
                                        extracted_metrics["liabilities"] = val
                                        logger.info("Extracted liabilities: %s", val)
                                elif "gwp" in k_lower or "gross.*written" in k_lower:
                                    val = parse_number(v)
                                    if val and "gwp" not in extracted_metrics:
                                        extracted_metrics["gwp"] = val
                                        logger.info("Extracted gwp: %s", val)
                                elif "claims" in k_lower and "paid" in k_lower:
                                    val = parse_number(v)
                                    if val and "net_claims_paid" not in extracted_metrics:
                                        extracted_metrics["net_claims_paid"] = val
                                        logger.info("Extracted net_claims_paid: %s", val)
                                elif "investment" in k_lower and "income" in k_lower:
                                    val = parse_number(v)
                                    if val and "investment_income_total" not in extracted_metrics:
                                        extracted_metrics["investment_income_total"] = val
                                        logger.info("Extracted investment_income_total: %s", val)
                                elif "commission" in k_lower:
                                    val = parse_number(v)
                                    if val and "commission_expense_total" not in extracted_metrics:
                                        extracted_metrics["commission_expense_total"] = val
                                        logger.info("Extracted commission_expense_total: %s", val)
                                elif "operating" in k_lower and "expense" in k_lower:
                                    val = parse_number(v)
                                    if val and "operating_expenses_total" not in extracted_metrics:
                                        extracted_metrics["operating_expenses_total"] = val
                                        logger.info("Extracted operating_expenses_total: %s", val)
                                elif "profit" in k_lower and "tax" in k_lower:
                                    val = parse_number(v)
                                    if val and "profit_before_tax" not in extracted_metrics:
                                        extracted_metrics["profit_before_tax"] = val
                                        logger.info("Extracted profit_before_tax: %s", val)
                except (json.JSONDecodeError, ValueError) as e:
                    pass
            logger.info("Successfully parsed %d chunk summaries as JSON", json_parsed_count)
        except Exception as e:
            logger.debug("Error extracting from JSON key_numbers: %s", e)
        
        # Fallback: use regex patterns on raw text
        patterns = {
            "capital": [r"capital[:\s]+([0-9,\.]+)", r"equity[:\s]+([0-9,\.]+)", r"shareholders.*equity[:\s]+([0-9,\.]+)"],
            "liabilities": [r"liabilities[:\s]+([0-9,\.]+)", r"total.*liabilities[:\s]+([0-9,\.]+)"],
            "gwp": [r"gwp[:\s]+([0-9,\.]+)", r"gross.*written.*premium[:\s]+([0-9,\.]+)"],
            "net_claims_paid": [r"net.*claims.*paid[:\s]+([0-9,\.]+)", r"claims.*paid[:\s]+([0-9,\.]+)"],
            "investment_income_total": [r"investment.*income[:\s]+([0-9,\.]+)", r"total.*investment.*income[:\s]+([0-9,\.]+)"],
            "commission_expense_total": [r"commission.*expense[:\s]+([0-9,\.]+)", r"commissions.*paid[:\s]+([0-9,\.]+)"],
            "operating_expenses_total": [r"operating.*expense[:\s]+([0-9,\.]+)", r"total.*operating.*expense[:\s]+([0-9,\.]+)"],
            "profit_before_tax": [r"profit.*before.*tax[:\s]+([0-9,\.]+)", r"pbt[:\s]+([0-9,\.]+)"],
            "auditors_unqualified_opinion": [r"unqualified.*opinion", r"auditors.*opinion.*unqualified"],
        }
        
        # Extract metrics using patterns (only if not already found)
        for key, pattern_list in patterns.items():
            if key in extracted_metrics:
                continue
            for pattern in pattern_list:
                matches = re.findall(pattern, all_summaries, re.IGNORECASE)
                if matches:
                    if key == "auditors_unqualified_opinion":
                        extracted_metrics[key] = True
                    else:
                        # Take the first match and parse it
                        val = parse_number(matches[0])
                        if val is not None:
                            extracted_metrics[key] = val
                            break
        
        # Calculate solvency ratio if we have capital and liabilities
        if "capital" in extracted_metrics and "liabilities" in extracted_metrics:
            try:
                capital = extracted_metrics["capital"]
                liabilities = extracted_metrics["liabilities"]
                if capital is not None and liabilities is not None and liabilities != 0:
                    extracted_metrics["solvency_ratio"] = round(((capital - liabilities) / liabilities) * 100, 2)
            except Exception:
                pass
        
        logger.info("Extracted metrics from chunk summaries: %s", extracted_metrics)
        
        # Build result with all schema keys, using extracted values or None
        result = {k: None for k in schema_keys}
        result.update(extracted_metrics)
        
        return result

    def summarize_document(self, pdf_bytes: bytes, document_title: Optional[str] = None) -> FinancialSummary:
        """Full pipeline: extract text, chunk, summarize per-chunk, synthesize, extract structured metrics."""
        full_text = self.extract_text_from_pdf(pdf_bytes)
        fs = FinancialSummary(document_title=document_title)
        if not full_text:
            fs.narrative = "No text could be extracted from the provided PDF."
            fs.missing_items = ["document_text"]
            return fs

        chunks = self._chunk_text(full_text)
        chunk_summaries = []
        max_workers = min(3, max(1, int(os.getenv("GPT_MAX_WORKERS", str(GPT_MAX_WORKERS)))))
        with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as ex:
            futures = [ex.submit(self.summarize_chunk, c, model=GEMINI_CHUNK_MODEL) for c in chunks]
            for f in concurrent.futures.as_completed(futures):
                try:
                    s = f.result()
                except Exception as e:
                    logger.warning("Chunk summarization failed: %s", e)
                    s = ""
                if s:
                    chunk_summaries.append(s)
        fs.raw_chunk_summaries = chunk_summaries

        synth = self.synthesize_summaries(chunk_summaries)
        fs.narrative = synth.get("narrative", "")
        fs.metrics = synth.get("metrics", {})
        fs.recommendations = synth.get("recommendations", [])
        fs.missing_items = synth.get("missing_items", [])
        fs.confidence = synth.get("confidence")

        # Extract structured metrics from chunk summaries (more efficient than re-processing full text)
        metrics = self.extract_structured_metrics(chunk_summaries)
        fs.metrics.setdefault("financials", {}).update(metrics or {})

        return fs


# convenience function for legacy codepaths
def generate_financial_summary(pdf_file_bytes: bytes, title: Optional[str] = None) -> Dict[str, Any]:
    agent = GPTComplianceAgent()
    summary = agent.summarize_document(pdf_file_bytes, document_title=title)
    return {
        "document_title": summary.document_title,
        "narrative": summary.narrative,
        "metrics": summary.metrics,
        "recommendations": summary.recommendations,
        "missing_items": summary.missing_items,
        "confidence": summary.confidence,
        "raw_chunk_summaries": summary.raw_chunk_summaries,
    }