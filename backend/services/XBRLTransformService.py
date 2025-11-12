import io
import xml.etree.ElementTree as ET
from typing import Tuple
import json

from database.models import DataSubmission  # local model

NS = {'xbrl': 'http://www.xbrl.org/2003/instance', 'ira': 'http://example.org/ira-project'}

def _text_or_none(val):
    if val is None:
        return None
    return str(val)

def generate_xbrl_bytes(submission: DataSubmission) -> Tuple[str, bytes]:
    """
    Build a lightweight XBRL-like XML document from a DataSubmission instance.
    Returns (filename, bytes).
    The output is not persisted — generated on-demand.
    """
    root = ET.Element('xbrl', xmlns=NS['xbrl'])
    # Provide a top-level instance element corresponding to our mock taxonomy
    inst = ET.SubElement(root, 'ira:IraSubmission', xmlns_ira=NS['ira'])
    # Helper to add element if value present (keep elements for clarity)
    def add(tag, value):
        el = ET.SubElement(inst, f'ira:{tag}')
        if value is None:
            el.text = ''
        else:
            el.text = str(value)

    add('SubmissionID', getattr(submission, 'id', ''))
    add('InsurerID', getattr(submission, 'insurer_id', '') or '')
    insurer_name = ''
    try:
        insurer_obj = getattr(submission, 'insurer', None)
        insurer_name = getattr(insurer_obj, 'username', '') if insurer_obj else ''
    except Exception:
        insurer_name = ''
    add('InsurerName', insurer_name)
    add('Capital', getattr(submission, 'capital', '') or '')
    add('Liabilities', getattr(submission, 'liabilities', '') or '')
    add('SolvencyRatio', getattr(submission, 'solvency_ratio', '') or '')
    # dates
    sd = getattr(submission, 'submission_date', None) or getattr(submission, 'created_at', None)
    add('SubmissionDate', sd.isoformat() if hasattr(sd, 'isoformat') else sd or '')
    add('RegulatorStatus', _text_or_none(getattr(submission, 'status', '')))
    add('RegulatorComments', _text_or_none(getattr(submission, 'regulator_comments', '')))
    ra = getattr(submission, 'regulator_approved_at', None)
    rr = getattr(submission, 'regulator_rejected_at', None)
    add('RegulatorApprovedAt', ra.isoformat() if hasattr(ra, 'isoformat') else ra or '')
    add('RegulatorRejectedAt', rr.isoformat() if hasattr(rr, 'isoformat') else rr or '')

    # AI extraction block (if present)
    ai_raw = getattr(submission, 'ai_extraction', None) or {}
    ai = {}
    if isinstance(ai_raw, dict):
        ai = ai_raw
    elif isinstance(ai_raw, str) and ai_raw.strip():
        try:
            ai = json.loads(ai_raw)
            if not isinstance(ai, dict):
                ai = {}
        except Exception:
            ai = {}
    else:
        ai = {}

    ai_el = ET.SubElement(inst, 'ira:AIExtraction')
    ET.SubElement(ai_el, 'ira:CAR').text = _text_or_none(ai.get('car'))
    ET.SubElement(ai_el, 'ira:RequiredCapital').text = _text_or_none(ai.get('required_capital'))
    ET.SubElement(ai_el, 'ira:AvailableCapital').text = _text_or_none(ai.get('available_capital'))

    # produce bytes
    tree = ET.ElementTree(root)
    bio = io.BytesIO()
    tree.write(bio, encoding='utf-8', xml_declaration=True)
    bio.seek(0)
    filename = f'ira-submission-{getattr(submission, "id", "unknown")}.xbrl'
    return filename, bio.read()