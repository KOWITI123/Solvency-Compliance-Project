from flask import request, jsonify
from datetime import datetime
from database.db_connection import db
from database.models import DataSubmission, SubmissionStatus, Notification, NotificationStatus, NotificationUrgency
from utils.blockchain_verification import SimpleBlockchainVerification
import json
import hashlib

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
            
            # Create notification for regulator (using actual table structure)
            try:
                notification_message = f"🔗 CFO Submitted: Capital: {data['capital']:,}, Liabilities: {data['liabilities']:,}, Solvency: {blockchain_data['solvency_ratio']:.2f}%. Hash: {blockchain_data['submission_hash'][:8]}... [AWAITING REGULATOR APPROVAL]"
                
                # ✅ USE SIMPLE STRING VALUES INSTEAD OF ENUM
                new_notification = Notification(
                    recipient_id=1,  # Regulator ID as integer
                    sender_id=int(data['insurer_id']),  # Insurer ID as integer
                    message=notification_message,
                    urgency='Medium',  # ✅ Use string instead of NotificationUrgency.Medium
                    status='Unread',   # ✅ Use string instead of NotificationStatus.Sent
                    sent_at=datetime.utcnow()
                )
                
                db.session.add(new_notification)
                print(f"📬 Notification created for regulator")
                
            except Exception as notif_error:
                print(f"⚠️ Could not create notification: {notif_error}")
                # Continue without failing the submission
            
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

    @app.route('/api/submit-data', methods=['POST'])
    def submit_data():
        """Submit financial data for regulator approval (DataInputPage)"""
        try:
            data = request.get_json()
            print(f"📊 Received submission data from DataInputPage: {data}")
            
            # Validate required fields
            required_fields = ['insurer_id', 'capital', 'liabilities', 'submission_date']
            for field in required_fields:
                if field not in data:
                    return jsonify({
                        'success': False,
                        'error': f'Missing required field: {field}'
                    }), 400
            
            # Extract and validate data
            insurer_id = data['insurer_id']
            capital = float(data['capital'])
            liabilities = float(data['liabilities'])
            submission_date = data['submission_date']
            
            if capital <= 0 or liabilities <= 0:
                return jsonify({
                    'success': False,
                    'error': 'Capital and liabilities must be positive numbers'
                }), 400
            
            # ✅ CREATE DATA HASH
            data_string = f"{insurer_id}:{capital}:{liabilities}:{submission_date}"
            data_hash = hashlib.sha256(data_string.encode()).hexdigest()
            
            # Parse submission date
            try:
                parsed_date = datetime.fromisoformat(submission_date.replace('Z', '+00:00'))
            except:
                parsed_date = datetime.utcnow()
            
            # ✅ CREATE SUBMISSION RECORD WITH PLACEHOLDER SOLVENCY RATIO  
            new_submission = DataSubmission(
                insurer_id=insurer_id,
                capital=capital,
                liabilities=liabilities,
                solvency_ratio=0.0,  # ✅ Placeholder value (database requires non-null)
                data_hash=data_hash,
                status=SubmissionStatus.INSURER_SUBMITTED,
                submission_date=parsed_date.date(),
                insurer_submitted_at=parsed_date,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            
            db.session.add(new_submission)
            db.session.flush()  # Get the ID without committing
            
            print(f"✅ Created submission with ID: {new_submission.id} (solvency_ratio=0.0 placeholder, will be calculated during approval)")
            
            # ✅ CREATE NOTIFICATION FOR REGULATOR (without solvency ratio)
            try:
                notification_message = f"📄 New submission from Insurer {insurer_id} - Capital: KES {capital:,.0f}, Liabilities: KES {liabilities:,.0f} [AWAITING APPROVAL]"
                
                new_notification = Notification(
                    recipient_id=1,  # Regulator ID as integer
                    sender_id=int(insurer_id),  # Insurer ID as integer
                    message=notification_message,
                    urgency='Medium',
                    status='Unread',
                    sent_at=datetime.utcnow()
                )
                
                db.session.add(new_notification)
                db.session.commit()
                
                print(f"✅ Notification created for regulator (no solvency ratio yet)")
                
            except Exception as notif_error:
                print(f"⚠️ Could not create notification: {notif_error}")
                # Don't fail the submission if notification fails
                db.session.rollback()
                db.session.add(new_submission)  # Re-add the submission
                db.session.commit()
        
            return jsonify({
                'success': True,
                'message': 'Financial data submitted successfully and awaiting regulator approval',
                'transaction_id': new_submission.id,
                'data_hash': data_hash,
                'status': 'INSURER_SUBMITTED',
                'note': 'Solvency ratio will be calculated during regulator approval'
            }), 200
            
        except ValueError as e:
            print(f"❌ Validation error: {str(e)}")
            return jsonify({
                'success': False,
                'error': f'Invalid data format: {str(e)}'
            }), 400
        except Exception as e:
            print(f"❌ Error submitting data: {str(e)}")
            db.session.rollback()
            return jsonify({
                'success': False,
                'error': f'Failed to submit data: {str(e)}'
            }), 500

    print("✅ Submission routes registered successfully")