from flask import Blueprint, jsonify
from database.models import FinancialSubmission
from database.db_connection import db

def register_blockchain_routes(app):
    
    @app.route('/api/blockchain/transactions', methods=['GET'])
    def get_blockchain_transactions():
        """Get all blockchain transactions with complete audit trail"""
        try:
            print("🔗 Fetching all blockchain transactions...")
            
            # Get all submissions with their complete transaction history
            submissions = FinancialSubmission.query.order_by(
                FinancialSubmission.insurer_submitted_at.desc()
            ).all()
            
            transactions = []
            
            for submission in submissions:
                # Add submission transaction
                transactions.append({
                    'id': submission.id,
                    'transaction_hash': submission.data_hash,
                    'data_hash': submission.data_hash,
                    'transaction_type': 'SUBMISSION',
                    'status': submission.status,
                    'timestamp': submission.insurer_submitted_at.isoformat() if submission.insurer_submitted_at else None,
                    'insurer_id': submission.insurer_id,
                    'capital': submission.capital,
                    'liabilities': submission.liabilities,
                    'solvency_ratio': submission.solvency_ratio,
                    'comments': f"Initial submission by insurer {submission.insurer_id}",
                    'gas_used': 21000,  # Standard gas for data submission
                    'block_number': submission.id + 1000,  # Simulate block numbers
                    'insurer': {
                        'username': f"insurer_{submission.insurer_id}",
                        'email': f"insurer_{submission.insurer_id}@example.com"
                    }
                })
                
                # Add regulator approval/rejection transaction if processed
                if submission.regulator_processed_at:
                    transaction_type = 'APPROVAL' if submission.status == 'REGULATOR_APPROVED' else 'REJECTION'
                    transactions.append({
                        'id': submission.id + 10000,  # Unique ID for regulator action
                        'transaction_hash': f"reg_{submission.data_hash[:32]}",
                        'data_hash': submission.data_hash,
                        'transaction_type': transaction_type,
                        'status': submission.status,
                        'timestamp': submission.regulator_processed_at.isoformat(),
                        'insurer_id': submission.insurer_id,
                        'regulator_id': 'reg-1',
                        'capital': submission.capital,
                        'liabilities': submission.liabilities,
                        'solvency_ratio': submission.solvency_ratio,
                        'comments': submission.regulator_comments or f"Submission {transaction_type.lower()} by regulator",
                        'gas_used': 35000,  # Higher gas for regulator actions
                        'block_number': submission.id + 1000 + 1,  # Next block
                        'insurer': {
                            'username': f"insurer_{submission.insurer_id}",
                            'email': f"insurer_{submission.insurer_id}@example.com"
                        }
                    })
            
            # Sort by timestamp (most recent first)
            transactions.sort(key=lambda x: x['timestamp'] or '', reverse=True)
            
            print(f"✅ Found {len(transactions)} blockchain transactions")
            
            return jsonify({
                'success': True,
                'transactions': transactions,
                'total_count': len(transactions)
            }), 200
            
        except Exception as e:
            print(f"❌ Error fetching blockchain transactions: {str(e)}")
            return jsonify({
                'success': False,
                'error': f'Failed to fetch blockchain transactions: {str(e)}'
            }), 500