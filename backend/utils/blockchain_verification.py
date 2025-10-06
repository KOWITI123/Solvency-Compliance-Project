import hashlib
import json
from datetime import datetime

class SimpleBlockchainVerification:
    """Simple blockchain-style verification for financial data submissions"""
    
    @staticmethod
    def create_submission_hash(capital, liabilities, insurer_id, timestamp=None):
        """
        Create a blockchain-style hash for submission verification
        
        Args:
            capital: Capital amount
            liabilities: Liabilities amount
            insurer_id: ID of the insurer
            timestamp: Optional timestamp (uses current time if not provided)
            
        Returns:
            dict: Contains submission hash, solvency ratio, and verification data
        """
        
        if timestamp is None:
            timestamp = datetime.utcnow().isoformat()
        
        # Calculate solvency ratio
        solvency_ratio = (float(capital) / float(liabilities)) * 100 if float(liabilities) > 0 else 0
        
        # Create data string for hashing
        data_string = f"{capital}|{liabilities}|{insurer_id}|{timestamp}|{solvency_ratio}"
        
        # Create SHA-256 hash
        submission_hash = hashlib.sha256(data_string.encode()).hexdigest()
        
        # Create verification data
        verification_data = {
            'submission_hash': submission_hash,
            'solvency_ratio': round(solvency_ratio, 4),
            'timestamp': timestamp,
            'capital': float(capital),
            'liabilities': float(liabilities),
            'insurer_id': str(insurer_id),
            'verification_status': 'BLOCKCHAIN_VERIFIED',
            'data_string': data_string  # For audit purposes
        }
        
        return verification_data
    
    @staticmethod
    def verify_submission(original_data, provided_hash):
        """
        Verify if a submission hash matches the original data
        
        Args:
            original_data: Dict with capital, liabilities, insurer_id, timestamp
            provided_hash: The hash to verify
            
        Returns:
            bool: True if hash is valid, False otherwise
        """
        try:
            # Recreate the hash from original data
            recreated_data = SimpleBlockchainVerification.create_submission_hash(
                capital=original_data['capital'],
                liabilities=original_data['liabilities'],
                insurer_id=original_data['insurer_id'],
                timestamp=original_data.get('timestamp')
            )
            
            return recreated_data['submission_hash'] == provided_hash
            
        except Exception as e:
            print(f"❌ Hash verification error: {e}")
            return False
    
    @staticmethod
    def get_compliance_status(solvency_ratio, minimum_ratio=100.0):
        """
        Determine compliance status based on solvency ratio
        
        Args:
            solvency_ratio: The calculated solvency ratio
            minimum_ratio: Minimum required ratio (default 100%)
            
        Returns:
            str: 'COMPLIANT' or 'NON_COMPLIANT'
        """
        return 'COMPLIANT' if solvency_ratio >= minimum_ratio else 'NON_COMPLIANT'