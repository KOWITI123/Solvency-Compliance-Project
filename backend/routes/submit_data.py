from flask import request, jsonify
from datetime import datetime
from database.db_connection import db
from database.models import DataSubmission, SubmissionStatus, Notification, NotificationStatus, NotificationUrgency
from utils.blockchain_verification import SimpleBlockchainVerification
import json

def register_submission_routes(app):
    """Register all submission-related routes with blockchain verification"""
    
    print("📋 Registering submission routes...")
    
    @app.route('/api/insurer/submit-data', methods=['POST', 'OPTIONS'])
    def insurer_submit_data():
        # Handle CORS preflight
        if request.method == 'OPTIONS':
            print("🌐 CORS preflight request received for insurer submission")
            return '', 200
            
        try:
            print("🚀 CFO Submission with blockchain verification")
            data = request.get_json()
            print(f"📦 Received data: {data}")
            
            # Validate required fields
            required_fields = ['capital', 'liabilities', 'insurer_id']
            for field in required_fields:
                if field not in data:
                    print(f"❌ Missing field: {field}")
                    return jsonify({'error': f'{field} is required'}), 400
            
            print(f"✅ All required fields present")
            
            # Create blockchain verification
            blockchain_data = SimpleBlockchainVerification.create_submission_hash(
                capital=data['capital'],
                liabilities=data['liabilities'],
                insurer_id=str(data['insurer_id'])
            )
            
            print(f"⛓️ Blockchain data created: {blockchain_data}")
            
            # Create submission record
            submission = DataSubmission(
                insurer_id=int(data['insurer_id']),
                data_hash=blockchain_data['submission_hash'],
                capital=data['capital'],
                liabilities=data['liabilities'],
                solvency_ratio=blockchain_data['solvency_ratio'],
                submission_date=datetime.utcnow().date(),
                status=SubmissionStatus.INSURER_SUBMITTED,
                insurer_submitted_at=datetime.utcnow(),
                blockchain_data=json.dumps(blockchain_data)
            )
            
            db.session.add(submission)
            print(f"📝 Submission record created")
            
            # Create notification for regulator
            notification = Notification(
                sender_id=int(data['insurer_id']),
                recipient_id=1,  # Regulator ID
                message=f"🔗 CFO Submitted: Capital: {data['capital']:,}, Liabilities: {data['liabilities']:,}, Solvency: {blockchain_data['solvency_ratio']:.2f}%. Hash: {blockchain_data['submission_hash'][:8]}... [AWAITING REGULATOR APPROVAL]",
                urgency=NotificationUrgency.Medium,
                status=NotificationStatus.Sent,
                sent_at=datetime.utcnow()
            )
            
            db.session.add(notification)
            print(f"📬 Notification created for regulator")
            
            db.session.commit()
            print(f"💾 Database committed successfully")
            
            print(f"✅ CFO submission verified with hash: {blockchain_data['submission_hash']}")
            
            return jsonify({
                'message': '✅ CFO Submission Complete - Awaiting Regulator Approval',
                'submission_id': submission.id,
                'submission_hash': blockchain_data['submission_hash'],
                'solvency_ratio': blockchain_data['solvency_ratio'],
                'status': submission.status.value,
                'verification': 'BLOCKCHAIN_VERIFIED',
                'two_way_status': 'STEP_1_COMPLETE'
            }), 200
            
        except Exception as e:
            db.session.rollback()
            print(f"❌ CFO submission error: {str(e)}")
            import traceback
            traceback.print_exc()  # Print full error details
            return jsonify({'error': str(e)}), 500

    @app.route('/api/insurer/submission-history', methods=['GET'])
    def get_submission_history():
        try:
            user_id = request.args.get('user_id', 1)
            print(f"📊 Fetching submission history for user: {user_id}")
            
            submissions = DataSubmission.query.filter_by(
                insurer_id=int(user_id)
            ).order_by(DataSubmission.submission_date.desc()).limit(10).all()
            
            submissions_data = []
            for submission in submissions:
                submissions_data.append({
                    'id': submission.id,
                    'capital': submission.capital,
                    'liabilities': submission.liabilities,
                    'solvency_ratio': submission.solvency_ratio,
                    'data_hash': submission.data_hash,
                    'status': submission.status.value,
                    'submission_date': submission.submission_date.isoformat() if submission.submission_date else None,
                    'insurer_submitted_at': submission.insurer_submitted_at.isoformat() if submission.insurer_submitted_at else None
                })
            
            print(f"✅ Found {len(submissions_data)} submission records")
            return jsonify({
                'submissions': submissions_data,
                'count': len(submissions_data)
            }), 200
            
        except Exception as e:
            print(f"❌ Error fetching submission history: {str(e)}")
            return jsonify({'error': str(e)}), 500

    @app.route('/api/submissions', methods=['GET'])
    def get_all_submissions():
        """Get all financial submissions for blockchain log"""
        try:
            print("📊 Fetching all submissions for blockchain log...")
            
            # First, let's check what model we should use
            # Try DataSubmission first
            try:
                submissions = DataSubmission.query.order_by(
                    DataSubmission.insurer_submitted_at.desc()
                ).all()
                
                submissions_data = []
                for submission in submissions:
                    # Check if submission has regulator fields, if not use None
                    regulator_processed_at = getattr(submission, 'regulator_processed_at', None)
                    regulator_comments = getattr(submission, 'regulator_comments', None)
                    
                    submissions_data.append({
                        'id': submission.id,
                        'data_hash': submission.data_hash,
                        'capital': submission.capital,
                        'liabilities': submission.liabilities,
                        'solvency_ratio': submission.solvency_ratio,
                        'status': submission.status.value if hasattr(submission.status, 'value') else str(submission.status),
                        'insurer_submitted_at': submission.insurer_submitted_at.isoformat() if submission.insurer_submitted_at else None,
                        'regulator_processed_at': regulator_processed_at.isoformat() if regulator_processed_at else None,
                        'regulator_comments': regulator_comments,
                        'insurer_id': submission.insurer_id
                    })
                
                print(f"✅ Found {len(submissions_data)} submissions for blockchain log")
                
                return jsonify({
                    'success': True,
                    'submissions': submissions_data,
                    'total_count': len(submissions_data)
                }), 200
                
            except Exception as inner_e:
                print(f"⚠️ DataSubmission query failed: {str(inner_e)}")
                
                # Try FinancialSubmission as fallback
                try:
                    from database.models import FinancialSubmission
                    
                    submissions = FinancialSubmission.query.order_by(
                        FinancialSubmission.insurer_submitted_at.desc()
                    ).all()
                    
                    submissions_data = []
                    for submission in submissions:
                        submissions_data.append({
                            'id': submission.id,
                            'data_hash': submission.data_hash,
                            'capital': submission.capital,
                            'liabilities': submission.liabilities,
                            'solvency_ratio': submission.solvency_ratio,
                            'status': submission.status.value if hasattr(submission.status, 'value') else str(submission.status),
                            'insurer_submitted_at': submission.insurer_submitted_at.isoformat() if submission.insurer_submitted_at else None,
                            'regulator_processed_at': submission.regulator_processed_at.isoformat() if submission.regulator_processed_at else None,
                            'regulator_comments': submission.regulator_comments,
                            'insurer_id': submission.insurer_id
                        })
                    
                    print(f"✅ Found {len(submissions_data)} submissions (FinancialSubmission) for blockchain log")
                    
                    return jsonify({
                        'success': True,
                        'submissions': submissions_data,
                        'total_count': len(submissions_data)
                    }), 200
                    
                except Exception as financial_e:
                    print(f"❌ FinancialSubmission query also failed: {str(financial_e)}")
                    raise inner_e
            
        except Exception as e:
            print(f"❌ Error fetching submissions: {str(e)}")
            return jsonify({
                'success': False,
                'error': f'Failed to fetch submissions: {str(e)}'
            }), 500

    print("✅ Submission routes registered successfully")