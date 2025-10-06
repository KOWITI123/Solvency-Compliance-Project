from flask import request, jsonify
from datetime import datetime
from database.db_connection import db
from database.models import DataSubmission, SubmissionStatus, Notification, NotificationStatus, NotificationUrgency
import json

def register_regulator_routes(app):
    """Register all regulator-related routes"""
    
    print("🏛️ Registering regulator routes...")
    
    @app.route('/api/regulator/pending-submissions', methods=['GET'])
    def regulator_pending_list():  # ✅ COMPLETELY UNIQUE NAME
        try:
            print("📋 Fetching pending submissions for regulator")
            
            # Get all submissions that are pending regulator approval
            pending_submissions = DataSubmission.query.filter_by(
                status=SubmissionStatus.INSURER_SUBMITTED
            ).order_by(DataSubmission.submission_date.desc()).all()
            
            submissions_data = []
            for submission in pending_submissions:
                submissions_data.append({
                    'id': submission.id,
                    'insurer_id': submission.insurer_id,
                    'capital': submission.capital,
                    'liabilities': submission.liabilities,
                    'solvency_ratio': submission.solvency_ratio,
                    'data_hash': submission.data_hash,
                    'submission_date': submission.submission_date.isoformat() if submission.submission_date else None,
                    'insurer_submitted_at': submission.insurer_submitted_at.isoformat() if submission.insurer_submitted_at else None,
                    'status': submission.status.value,
                    'blockchain_data': json.loads(submission.blockchain_data) if submission.blockchain_data else None
                })
            
            print(f"✅ Found {len(submissions_data)} pending submissions")
            return jsonify({
                'submissions': submissions_data,
                'count': len(submissions_data)
            }), 200
            
        except Exception as e:
            print(f"❌ Error fetching pending submissions: {str(e)}")
            return jsonify({'error': str(e)}), 500

    @app.route('/api/regulator/approve-submission', methods=['POST', 'OPTIONS'])
    def regulator_approve_action():  # ✅ COMPLETELY UNIQUE NAME
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
                return jsonify({'error': 'submission_id is required'}), 400
            
            # Find the submission
            submission = DataSubmission.query.get(submission_id)
            if not submission:
                return jsonify({'error': 'Submission not found'}), 404
            
            if submission.status != SubmissionStatus.INSURER_SUBMITTED:
                return jsonify({'error': f'Submission is not in pending status. Current status: {submission.status.value}'}), 400
            
            # Update submission status to APPROVED
            submission.status = SubmissionStatus.REGULATOR_APPROVED
            submission.regulator_approved_at = datetime.utcnow()
            submission.regulator_comments = regulator_comments
            submission.regulator_id = 1  # Assuming regulator ID is 1
            
            # Create notification for insurer
            notification = Notification(
                sender_id=1,  # Regulator ID
                recipient_id=submission.insurer_id,
                message=f"✅ APPROVED: Your submission (Hash: {submission.data_hash[:8]}...) has been APPROVED by the regulator. Solvency Ratio: {submission.solvency_ratio}%. Two-way authentication COMPLETE!",
                urgency=NotificationUrgency.High,
                status=NotificationStatus.Sent,
                sent_at=datetime.utcnow()
            )
            
            db.session.add(notification)
            db.session.commit()
            
            print(f"✅ Submission {submission_id} APPROVED by regulator")
            
            return jsonify({
                'message': '✅ Submission approved successfully',
                'submission_id': submission_id,
                'status': 'REGULATOR_APPROVED',
                'two_way_authentication': 'COMPLETE',
                'approved_at': submission.regulator_approved_at.isoformat()
            }), 200
            
        except Exception as e:
            db.session.rollback()
            print(f"❌ Error approving submission: {str(e)}")
            return jsonify({'error': str(e)}), 500

    @app.route('/api/regulator/reject-submission', methods=['POST', 'OPTIONS'])
    def regulator_reject_action():  # ✅ COMPLETELY UNIQUE NAME
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
                return jsonify({'error': 'submission_id is required'}), 400
            
            # Find the submission
            submission = DataSubmission.query.get(submission_id)
            if not submission:
                return jsonify({'error': 'Submission not found'}), 404
            
            if submission.status != SubmissionStatus.INSURER_SUBMITTED:
                return jsonify({'error': f'Submission is not in pending status. Current status: {submission.status.value}'}), 400
            
            # Update submission status to REJECTED
            submission.status = SubmissionStatus.REJECTED
            submission.regulator_rejected_at = datetime.utcnow()
            submission.regulator_comments = regulator_comments
            submission.regulator_id = 1  # Assuming regulator ID is 1
            
            # Create notification for insurer
            notification = Notification(
                sender_id=1,  # Regulator ID
                recipient_id=submission.insurer_id,
                message=f"❌ REJECTED: Your submission (Hash: {submission.data_hash[:8]}...) has been REJECTED by the regulator. Reason: {regulator_comments}. Please resubmit with corrections.",
                urgency=NotificationUrgency.High,
                status=NotificationStatus.Sent,
                sent_at=datetime.utcnow()
            )
            
            db.session.add(notification)
            db.session.commit()
            
            print(f"❌ Submission {submission_id} REJECTED by regulator")
            
            return jsonify({
                'message': '❌ Submission rejected',
                'submission_id': submission_id,
                'status': 'REJECTED',
                'rejected_at': submission.regulator_rejected_at.isoformat(),
                'comments': regulator_comments
            }), 200
            
        except Exception as e:
            db.session.rollback()
            print(f"❌ Error rejecting submission: {str(e)}")
            return jsonify({'error': str(e)}), 500

    @app.route('/api/notifications/regulator/<regulator_id>', methods=['GET'])
    def regulator_notifications_list(regulator_id):  # ✅ COMPLETELY UNIQUE NAME
        try:
            print(f"📬 Fetching notifications for regulator: {regulator_id}")
            
            # Get recent notifications for the regulator (assuming ID 1)
            notifications = Notification.query.filter_by(
                recipient_id=1  # Regulator ID
            ).order_by(Notification.sent_at.desc()).limit(10).all()
            
            notifications_data = []
            for notification in notifications:
                notifications_data.append({
                    'id': notification.id,
                    'message': notification.message,
                    'urgency': notification.urgency.value,
                    'status': notification.status.value,
                    'sent_at': notification.sent_at.isoformat() if notification.sent_at else None
                })
            
            print(f"✅ Found {len(notifications_data)} notifications")
            return jsonify({
                'notifications': notifications_data,
                'count': len(notifications_data)
            }), 200
            
        except Exception as e:
            print(f"❌ Error fetching regulator notifications: {str(e)}")
            return jsonify({'error': str(e)}), 500

    print("✅ Regulator routes registered successfully")