from database.models import db, DataSubmission
from services.XBRLTransformService import generate_xbrl_bytes

def generate_xbrl_for_submission(submission_id: int):
    """Load submission and return (filename, bytes) or raise ValueError if not found."""
    sub = db.session.get(DataSubmission, submission_id)
    if sub is None:
        raise ValueError("Submission not found")
    return generate_xbrl_bytes(sub)