# Non-destructive helper to compute insurance-performance metrics from DB models.
from typing import Optional, Dict

def get_insurance_performance(user_id: int, db_session) -> Optional[Dict]:
    """
    Return a dict of metrics or None if no submissions.
    db_session should be your SQLAlchemy session or module exposing query APIs.
    Defensive: tolerates missing attributes and different model field names.
    """
    try:
        # Lazy import to avoid circular import at module load
        from database.models import DataSubmission
    except Exception:
        return None

    try:
        # Try common query patterns (works with SQLAlchemy declarative/session setups)
        try:
            subs = DataSubmission.query.filter_by(insurer_id=user_id).order_by(DataSubmission.created_at.desc()).all()
        except Exception:
            subs = db_session.session.query(DataSubmission).filter_by(insurer_id=user_id).order_by(DataSubmission.created_at.desc()).all()
        if not subs:
            return None
        latest = subs[0]

        def fnum(attr_names):
            for attr in (attr_names if isinstance(attr_names, (list, tuple)) else [attr_names]):
                v = getattr(latest, attr, None)
                if v is None:
                    continue
                try:
                    return float(v)
                except Exception:
                    continue
            return 0.0

        gwp = fnum(['gwp', 'gross_written_premium'])
        incurred = fnum(['incurred_claims', 'claims_incurred'])
        expenses = fnum('expenses')
        capital = fnum('capital')
        liabilities = fnum('liabilities')
        solvency = fnum(['solvency_ratio', 'solvency'])

        combined_ratio = round(((incurred + expenses) / gwp) * 100, 2) if gwp > 0 else 0.0

        as_of = getattr(latest, 'submission_date', None) or getattr(latest, 'created_at', None)
        as_of_iso = as_of.isoformat() if hasattr(as_of, 'isoformat') else (str(as_of) if as_of is not None else None)

        return {
            'submissionId': getattr(latest, 'id', None),
            'gwp': gwp,
            'incurredClaims': incurred,
            'expenses': expenses,
            'combinedRatio': combined_ratio,
            'capital': capital,
            'liabilities': liabilities,
            'solvencyRatio': solvency,
            'asOfDate': as_of_iso
        }
    except Exception:
        return None