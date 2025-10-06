import hashlib
import json
from datetime import datetime
from typing import Dict, Any

class SimpleBlockchainVerification:
    """Simple blockchain-like verification without external blockchain"""
    
    @staticmethod
    def create_submission_hash(capital: float, liabilities: float, insurer_id: str) -> Dict[str, Any]:
        """Create CFO submission with blockchain-like hash"""
        timestamp = datetime.utcnow().isoformat()
        
        # Create deterministic hash
        data_string = f"{capital}-{liabilities}-{insurer_id}-{timestamp}"
        submission_hash = hashlib.sha256(data_string.encode()).hexdigest()
        
        # Calculate solvency ratio
        solvency_ratio = (capital / liabilities) * 100
        
        return {
            "submission_hash": submission_hash,
            "capital": capital,
            "liabilities": liabilities,
            "solvency_ratio": round(solvency_ratio, 2),
            "insurer_id": insurer_id,
            "timestamp": timestamp,
            "status": "CFO_SUBMITTED",
            "verification_data": {
                "original_string": data_string,
                "hash_algorithm": "SHA256"
            }
        }
    
    @staticmethod
    def create_approval_hash(submission_hash: str, regulator_id: str, decision: str) -> Dict[str, Any]:
        """Create regulator approval with blockchain-like hash"""
        timestamp = datetime.utcnow().isoformat()
        
        # Create approval hash
        approval_string = f"{submission_hash}-{regulator_id}-{decision}-{timestamp}"
        approval_hash = hashlib.sha256(approval_string.encode()).hexdigest()
        
        return {
            "approval_hash": approval_hash,
            "submission_hash": submission_hash,
            "regulator_id": regulator_id,
            "decision": decision,
            "timestamp": timestamp,
            "status": "REGULATOR_APPROVED" if decision == "APPROVE" else "REJECTED"
        }
    
    @staticmethod
    def verify_integrity(original_hash: str, capital: float, liabilities: float, insurer_id: str, timestamp: str) -> bool:
        """Verify data hasn't been tampered with"""
        recreated_string = f"{capital}-{liabilities}-{insurer_id}-{timestamp}"
        recreated_hash = hashlib.sha256(recreated_string.encode()).hexdigest()
        return original_hash == recreated_hash