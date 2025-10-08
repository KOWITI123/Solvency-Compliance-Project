from flask import request, jsonify
from datetime import datetime
from database.db_connection import db
from database.models import DataSubmission, SubmissionStatus, Notification
import json

def register_regulator_routes(app):
    """Register all regulator-related routes"""
    
    print("🏛️ Registering regulator routes...")
    
    @app.route('/api/regulator/pending-submissions', methods=['GET'])
    def regulator_get_pending_submissions():
        """Get all submissions pending regulator approval"""
        try:
            print("📋 Fetching pending submissions for regulator")
            
            # Query for submissions with INSURER_SUBMITTED status
            pending_submissions = DataSubmission.query.filter(
                DataSubmission.status == SubmissionStatus.INSURER_SUBMITTED
            ).order_by(DataSubmission.insurer_submitted_at.desc()).all()
            
            print(f"🔍 Found {len(pending_submissions)} submissions with INSURER_SUBMITTED status")
            
            # Debug: Check what statuses actually exist
            all_submissions = DataSubmission.query.all()
            all_statuses = [(s.id, str(s.status), s.status.value if hasattr(s.status, 'value') else 'N/A') for s in all_submissions]
            print(f"🔍 All submissions in DB: {all_statuses}")
            
            submissions_data = []
            for submission in pending_submissions:
                submissions_data.append({
                    'id': submission.id,
                    'insurer_id': submission.insurer_id,
                    'capital': float(submission.capital),
                    'liabilities': float(submission.liabilities),
                    'data_hash': submission.data_hash,
                    'status': submission.status.value if hasattr(submission.status, 'value') else str(submission.status),
                    'submission_date': submission.insurer_submitted_at.isoformat() if submission.insurer_submitted_at else None,
                    'insurer': {
                        'username': f'Insurer {submission.insurer_id}',
                        'email': f'insurer{submission.insurer_id}@company.com'
                    }
                })
            
            response_data = {
                'success': True,
                'submissions': submissions_data,
                'total_count': len(submissions_data)
            }
            
            print(f"✅ Returning response: {response_data}")
            
            return jsonify(response_data), 200
            
        except Exception as e:
            print(f"❌ Error fetching pending submissions: {str(e)}")
            import traceback
            traceback.print_exc()
            return jsonify({
                'success': False,
                'error': f'Failed to fetch pending submissions: {str(e)}',
                'submissions': [],
                'total_count': 0
            }), 500

    @app.route('/api/regulator/approve-submission', methods=['POST', 'OPTIONS'])
    def regulator_approve_submission():
        # Handle CORS preflight
        if request.method == 'OPTIONS':
            return '', 200
            
        try:
            print("🟢 Regulator APPROVAL request received")
            data = request.get_json()
            print(f"📦 Approval data: {data}")
            
            submission_id = data.get('submission_id')
            regulator_comments = data.get('comments', '')
            
            if not submission_id:
                return jsonify({'success': False, 'error': 'submission_id is required'}), 400
            
            # Find the submission
            submission = DataSubmission.query.get(submission_id)
            if not submission:
                return jsonify({'success': False, 'error': 'Submission not found'}), 404
            
            if submission.status != SubmissionStatus.INSURER_SUBMITTED:
                return jsonify({
                    'success': False, 
                    'error': f'Submission is not in pending status. Current status: {submission.status.value}'
                }), 400
            
            # ✅ CALCULATE SOLVENCY RATIO DURING APPROVAL
            solvency_ratio = (submission.capital / submission.liabilities) * 100 if submission.liabilities > 0 else 0
            
            # Update submission status to APPROVED
            submission.status = SubmissionStatus.REGULATOR_APPROVED
            submission.solvency_ratio = solvency_ratio  # ✅ Calculate ONLY during approval
            submission.regulator_approved_at = datetime.utcnow()
            submission.regulator_comments = regulator_comments
            
            db.session.commit()
            
            print(f"✅ Submission {submission_id} APPROVED with solvency ratio: {solvency_ratio:.2f}%")
            
            return jsonify({
                'success': True,
                'message': 'Submission approved successfully',
                'submission_id': submission_id,
                'status': 'REGULATOR_APPROVED',
                'solvency_ratio': solvency_ratio,
                'approved_at': submission.regulator_approved_at.isoformat()  # ✅ FIXED: Use correct field name
            }), 200
            
        except Exception as e:
            db.session.rollback()
            print(f"❌ Error approving submission: {str(e)}")
            import traceback
            traceback.print_exc()
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/api/regulator/reject-submission', methods=['POST', 'OPTIONS'])
    def regulator_reject_submission():
        # Handle CORS preflight
        if request.method == 'OPTIONS':
            return '', 200
            
        try:
            print("🔴 Regulator REJECTION request received")
            data = request.get_json()
            print(f"📦 Rejection data: {data}")
            
            submission_id = data.get('submission_id')
            regulator_comments = data.get('comments', 'No reason provided')
            
            if not submission_id:
                return jsonify({'success': False, 'error': 'submission_id is required'}), 400
            
            # Find the submission
            submission = DataSubmission.query.get(submission_id)
            if not submission:
                return jsonify({'success': False, 'error': 'Submission not found'}), 404
            
            if submission.status != SubmissionStatus.INSURER_SUBMITTED:
                return jsonify({
                    'success': False,
                    'error': f'Submission is not in pending status. Current status: {submission.status.value}'
                }), 400
            
            # Update submission status to REJECTED
            submission.status = SubmissionStatus.REJECTED
            submission.regulator_rejected_at = datetime.utcnow()  # ✅ Use correct field name
            submission.regulator_comments = regulator_comments
            
            db.session.commit()
            
            print(f"❌ Submission {submission_id} REJECTED by regulator")
            
            return jsonify({
                'success': True,
                'message': 'Submission rejected',
                'submission_id': submission_id,
                'status': 'REJECTED',
                'rejected_at': submission.regulator_rejected_at.isoformat(),  # ✅ Use correct field name
                'comments': regulator_comments
            }), 200
            
        except Exception as e:
            db.session.rollback()
            print(f"❌ Error rejecting submission: {str(e)}")
            import traceback
            traceback.print_exc()
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/api/notifications/regulator/<regulator_id>', methods=['GET'])
    def regulator_get_notifications(regulator_id):
        """Get notifications for a specific regulator"""
        try:
            print(f"📬 Fetching notifications for regulator: {regulator_id}")
            
            # ✅ CONVERT STRING TO INTEGER
            if regulator_id == 'reg-1':
                regulator_id_int = 1
            else:
                try:
                    regulator_id_int = int(regulator_id)
                except ValueError:
                    regulator_id_int = 1
            
            # ✅ SIMPLE QUERY USING ACTUAL TABLE STRUCTURE
            notifications = Notification.query.filter_by(
                recipient_id=regulator_id_int
            ).order_by(Notification.sent_at.desc()).all()
            
            notifications_data = []
            for notification in notifications:
                notifications_data.append({
                    'id': notification.id,
                    'message': notification.message,
                    'urgency': notification.urgency,
                    'status': notification.status,
                    'sender_id': notification.sender_id,
                    'created_at': notification.sent_at.isoformat() if notification.sent_at else None
                })
            
            print(f"✅ Found {len(notifications_data)} notifications")
            
            return jsonify({
                'success': True,
                'notifications': notifications_data
            }), 200
            
        except Exception as e:
            print(f"❌ Error fetching notifications: {str(e)}")
            return jsonify({
                'success': True,
                'notifications': []
            }), 200

    print("✅ Regulator routes registered successfully")
