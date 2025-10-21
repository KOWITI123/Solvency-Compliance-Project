from flask import Flask, jsonify, request
from flask_cors import CORS
from database.db_connection import db, connect_database
from routes.submit_data import register_submission_routes
from routes.regulator_routes import register_regulator_routes
from routes.authentication import register_auth_routes
from routes.compliance_routes import register_compliance_routes
from datetime import datetime

app = Flask(__name__)

# CORS configuration
CORS(app, 
     origins=["http://localhost:3000", "http://localhost:5173"],
     methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
     allow_headers=['Content-Type', 'Authorization'],
     supports_credentials=False)

# Connect database
connect_database(app)

# Import models AFTER database is connected
from database.models import *

# Register routes
register_submission_routes(app)
register_regulator_routes(app)
register_auth_routes(app)
register_compliance_routes(app)

@app.route('/health', methods=['GET'])
def health_check():
    return {'status': 'healthy', 'message': 'Solvency Compliance API is running'}, 200

@app.route('/debug/routes', methods=['GET'])
def debug_routes():
    """Debug endpoint to see all registered routes"""
    routes = []
    for rule in app.url_map.iter_rules():
        routes.append({
            'endpoint': rule.endpoint,
            'methods': list(rule.methods),
            'path': str(rule)
        })
    return {'routes': routes}, 200

# Add this endpoint to see what's in your database:
@app.route('/api/debug/submissions', methods=['GET'])
def debug_submissions():
    """Debug endpoint to see all submissions"""
    try:
        all_submissions = DataSubmission.query.all()
        
        submissions_data = []
        for submission in all_submissions:
            submissions_data.append({
                'id': submission.id,
                'insurer_id': submission.insurer_id,
                'capital': submission.capital,
                'liabilities': submission.liabilities,
                'status': str(submission.status),
                'status_value': submission.status.value if hasattr(submission.status, 'value') else 'N/A',
                'submitted_at': submission.insurer_submitted_at.isoformat() if submission.insurer_submitted_at else None,
                'data_hash': submission.data_hash[:16] + '...' if submission.data_hash else None
            })
        
        return jsonify({
            'total_submissions': len(submissions_data),
            'submissions': submissions_data
        }), 200
        
    except Exception as e:
        print(f"❌ Debug error: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Add this debug endpoint to your app.py to see the actual table structure:

@app.route('/api/debug/notifications', methods=['GET'])
def debug_notifications():
    """Debug endpoint to see notification table structure"""
    try:
        # Get all notifications to see the actual structure
        notifications = Notification.query.all()
        
        if notifications:
            # Get the first notification to see available attributes
            first_notif = notifications[0]
            available_attrs = [attr for attr in dir(first_notif) if not attr.startswith('_')]
            
            notifications_data = []
            for notif in notifications:
                notif_data = {'id': notif.id}
                # Safely get each attribute
                for attr in ['message', 'urgency', 'status', 'recipient_id', 'sender_id', 'created_at', 'sent_at']:
                    if hasattr(notif, attr):
                        value = getattr(notif, attr)
                        if hasattr(value, 'isoformat'):
                            notif_data[attr] = value.isoformat()
                        else:
                            notif_data[attr] = str(value) if value is not None else None
                    else:
                        notif_data[attr] = 'COLUMN_MISSING'
                
                notifications_data.append(notif_data)
            
            return jsonify({
                'total_notifications': len(notifications),
                'available_attributes': available_attrs,
                'notifications': notifications_data
            }), 200
        else:
            return jsonify({
                'total_notifications': 0,
                'message': 'No notifications found'
            }), 200
        
    except Exception as e:
        print(f"❌ Debug notifications error: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Add this debug endpoint to check column constraints:

@app.route('/api/debug/table-structure', methods=['GET'])
def debug_table_structure():
    """Debug endpoint to check table structure"""
    try:
        from sqlalchemy import text
        
        # Check data_submissions table structure
        table_info = db.session.execute(text("""
            SELECT column_name, is_nullable, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'data_submissions' 
            AND column_name IN ('solvency_ratio', 'capital', 'liabilities')
            ORDER BY column_name
        """))
        
        columns = []
        for row in table_info:
            columns.append({
                'column_name': row[0],
                'is_nullable': row[1],
                'data_type': row[2]
            })
        
        return jsonify({
            'table': 'data_submissions',
            'columns': columns
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Add this debug endpoint (keep existing code, just add this):

@app.route('/api/debug/notifications-table', methods=['GET'])
def debug_notifications_table():
    """Debug endpoint to see actual notifications table structure"""
    try:
        from sqlalchemy import text
        
        # Get actual column names from the database
        result = db.session.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'notifications' ORDER BY ordinal_position"))
        columns = [row[0] for row in result]
        
        # Get sample data if any exists
        sample_result = db.session.execute(text("SELECT * FROM notifications LIMIT 3"))
        sample_data = [dict(row) for row in sample_result]
        
        return jsonify({
            'existing_columns': columns,
            'sample_data': sample_data,
            'total_rows': db.session.execute(text("SELECT COUNT(*) FROM notifications")).scalar()
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Add this to check the current status of your data:

@app.route('/api/debug/data-status', methods=['GET'])
def debug_data_status():
    """Debug endpoint to see current data status"""
    try:
        from sqlalchemy import text
        
        # Check submissions
        submissions_result = db.session.execute(text("SELECT id, insurer_id, status, capital, liabilities FROM data_submissions ORDER BY id DESC LIMIT 5"))
        submissions = []
        for row in submissions_result:
            submissions.append({
                'id': row[0],
                'insurer_id': row[1],
                'status': row[2],
                'capital': float(row[3]) if row[3] else 0,
                'liabilities': float(row[4]) if row[4] else 0
            })
        
        # Check notifications  
        notifications_result = db.session.execute(text("SELECT id, recipient_id, message, status FROM notifications ORDER BY id DESC LIMIT 5"))
        notifications = []
        for row in notifications_result:
            notifications.append({
                'id': row[0],
                'recipient_id': row[1],
                'message': str(row[2])[:50] + '...' if row[2] and len(str(row[2])) > 50 else str(row[2]) if row[2] else '',
                'status': row[3]
            })
        
        # Check submission statuses
        status_result = db.session.execute(text("SELECT status, COUNT(*) FROM data_submissions GROUP BY status"))
        status_counts = []
        for row in status_result:
            status_counts.append({
                'status': row[0], 
                'count': row[1]
            })
        
        return jsonify({
            'recent_submissions': submissions,
            'recent_notifications': notifications,
            'submission_status_counts': status_counts,
            'total_submissions': db.session.execute(text("SELECT COUNT(*) FROM data_submissions")).scalar(),
            'total_notifications': db.session.execute(text("SELECT COUNT(*) FROM notifications")).scalar()
        }), 200
        
    except Exception as e:
        print(f"❌ Debug error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

# Replace the test_create_submission function:

@app.route('/api/test/create-submission', methods=['POST'])
def test_create_submission():
    """Test endpoint to create a submission with INSURER_SUBMITTED status"""
    try:
        capital = 1000000.0
        liabilities = 500000.0
        solvency_ratio = (capital / liabilities) * 100  # ✅ Calculate solvency ratio
        
        # Create a test submission
        test_submission = DataSubmission(
            insurer_id=999,
            capital=capital,
            liabilities=liabilities,
            solvency_ratio=solvency_ratio,  # ✅ Add required solvency_ratio
            data_hash='test_hash_123',
            status=SubmissionStatus.INSURER_SUBMITTED,  # ✅ Explicitly set status
            submission_date=datetime.utcnow().date(),
            insurer_submitted_at=datetime.utcnow(),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        db.session.add(test_submission)
        db.session.commit()
        
        print(f"✅ Test submission created with ID: {test_submission.id} and status: {test_submission.status}")
        
        return jsonify({
            'success': True,
            'message': 'Test submission created',
            'submission_id': test_submission.id,
            'status': test_submission.status.value,
            'solvency_ratio': solvency_ratio
        }, 200)
        
    except Exception as e:
        db.session.rollback()
        print(f"❌ Error creating test submission: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Also add this endpoint to see submission status enum values:
@app.route('/api/debug/enum-values', methods=['GET'])
def debug_enum_values():
    """Check what enum values are being used"""
    try:
        return jsonify({
            'INSURER_SUBMITTED': str(SubmissionStatus.INSURER_SUBMITTED),
            'INSURER_SUBMITTED_value': SubmissionStatus.INSURER_SUBMITTED.value,
            'all_statuses': [status.value for status in SubmissionStatus]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Add this missing endpoint:

@app.route('/api/submissions', methods=['GET'])
def get_all_submissions():
    """Get all financial submissions for blockchain log"""
    try:
        print("📊 Fetching all submissions for blockchain log...")
        
        submissions = DataSubmission.query.order_by(
            DataSubmission.insurer_submitted_at.desc()
        ).all()
        
        submissions_data = []
        for submission in submissions:
            submissions_data.append({
                'id': submission.id,
                'data_hash': submission.data_hash,
                'capital': float(submission.capital),
                'liabilities': float(submission.liabilities),
                'solvency_ratio': float(submission.solvency_ratio) if submission.solvency_ratio else None,
                'status': submission.status.value if hasattr(submission.status, 'value') else str(submission.status),
                'insurer_submitted_at': submission.insurer_submitted_at.isoformat() if submission.insurer_submitted_at else None,
                'regulator_approved_at': submission.regulator_approved_at.isoformat() if hasattr(submission, 'regulator_approved_at') and submission.regulator_approved_at else None,
                'regulator_comments': submission.regulator_comments,
                'insurer_id': submission.insurer_id
            })
        
        print(f"✅ Found {len(submissions_data)} submissions for blockchain log")
        
        return jsonify({
            'success': True,
            'submissions': submissions_data,
            'total_count': len(submissions_data)
        }), 200
        
    except Exception as e:
        print(f"❌ Error fetching submissions: {str(e)}")
        return jsonify({
            'success': False,
            'error': f'Failed to fetch submissions: {str(e)}',
            'submissions': [],
            'total_count': 0
        }), 500

# Replace the create_pending_submissions function:

@app.route('/api/test/create-pending-submissions', methods=['POST'])
def create_pending_submissions():
    """Create multiple test submissions with INSURER_SUBMITTED status"""
    try:
        # ✅ SIMPLE: Use the existing user ID 1 (we know it exists)
        insurer_id = 1  # From debug output, we know user ID 1 exists with role "insurer"
        
        print(f"🔍 Using existing insurer ID: {insurer_id}")
        
        test_submissions = []
        
        for i in range(3):
            capital = 1000000.0 + (i * 100000)
            liabilities = 500000.0 + (i * 50000)
            
            # ✅ CALCULATE SOLVENCY RATIO (required by database)
            solvency_ratio = (capital / liabilities) * 100 if liabilities > 0 else 0
            
            test_submission = DataSubmission(
                insurer_id=insurer_id,  # ✅ Use existing insurer ID 1
                capital=capital,
                liabilities=liabilities,
                solvency_ratio=solvency_ratio,
                data_hash=f'pending_test_hash_{i}_' + str(datetime.utcnow().timestamp()),
                status=SubmissionStatus.INSURER_SUBMITTED,  # ✅ This will show as pending
                submission_date=datetime.utcnow().date(),
                insurer_submitted_at=datetime.utcnow(),
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            
            db.session.add(test_submission)
            test_submissions.append(test_submission)
        
        db.session.commit()
        
        print(f"✅ Created {len(test_submissions)} test submissions with INSURER_SUBMITTED status")
        
        return jsonify({
            'success': True,
            'message': f'Created {len(test_submissions)} pending submissions',
            'submission_ids': [s.id for s in test_submissions],
            'details': [
                {
                    'id': s.id,
                    'insurer_id': s.insurer_id,
                    'capital': s.capital,
                    'liabilities': s.liabilities,
                    'solvency_ratio': s.solvency_ratio,
                    'status': s.status.value
                } for s in test_submissions
            ]
        }), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"❌ Error creating test submissions: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Add this endpoint to see what users exist:

@app.route('/api/debug/users', methods=['GET'])
def debug_users():
    """Debug endpoint to see existing users"""
    try:
        from sqlalchemy import text
        
        # Check what users exist
        users_result = db.session.execute(text("SELECT id, username, role FROM users ORDER BY id"))
        users = []
        for row in users_result:
            users.append({
                'id': row[0],
                'username': row[1],
                'role': row[2]
            })
        
        return jsonify({
            'total_users': len(users),
            'users': users
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Add these debug endpoints to verify data is being created:

@app.route('/api/debug/users-and-profiles', methods=['GET'])
def debug_users_and_profiles():
    """Debug endpoint to see users and insurer profiles"""
    try:
        from sqlalchemy import text
        
        # Check users table
        users_result = db.session.execute(text("SELECT id, username, email, role FROM users ORDER BY id"))
        users = []
        for row in users_result:
            users.append({
                'id': row[0],
                'username': row[1],
                'email': row[2],
                'role': row[3]
            })
        
        # Check insurer_profiles table
        profiles_result = db.session.execute(text("SELECT id, user_id, business_name, registration_number, business_email FROM insurer_profiles ORDER BY id"))
        profiles = []
        for row in profiles_result:
            profiles.append({
                'id': row[0],
                'user_id': row[1],
                'business_name': row[2],
                'registration_number': row[3],
                'business_email': row[4]
            })
        
        return jsonify({
            'total_users': len(users),
            'users': users,
            'total_profiles': len(profiles),
            'insurer_profiles': profiles
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Remove these duplicate functions from app.py (they're now in authentication.py):

# DELETE THIS ENTIRE FUNCTION:
# @app.route('/api/signup', methods=['POST', 'OPTIONS'])
# def signup():
#     """User signup endpoint"""
#     ... entire signup function ...

# DELETE THIS ENTIRE FUNCTION:
# @app.route('/api/login', methods=['POST', 'OPTIONS'])
# def login():
#     """User login endpoint"""
#     ... entire login function ...

# Add this debug endpoint:

@app.route('/api/debug/check-solvency-constraint', methods=['GET'])
def check_solvency_constraint():
    """Check if solvency_ratio column allows NULL"""
    try:
        from sqlalchemy import text
        
        # Check the actual constraint
        constraint_check = db.session.execute(text("""
            SELECT 
                column_name, 
                is_nullable, 
                data_type,
                column_default
            FROM information_schema.columns 
            WHERE table_name = 'data_submissions' 
            AND column_name = 'solvency_ratio'
        """))
        
        result = constraint_check.fetchone()
        
        if result:
            return jsonify({
                'column_name': result[0],
                'is_nullable': result[1],  # This should tell us if NULL is allowed
                'data_type': result[2],
                'column_default': result[3],
                'database_allows_null': result[1] == 'YES'
            }), 200
        else:
            return jsonify({'error': 'Column not found'}), 404
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Add these endpoints after your existing endpoints:

@app.route('/api/submissions/user/<int:user_id>', methods=['GET'])
def get_user_submissions(user_id):
    """Get submissions for a specific user only"""
    try:
        print(f"📊 Fetching submissions for user ID: {user_id}")
        
        # Get submissions for this specific user only
        user_submissions = DataSubmission.query.filter_by(insurer_id=user_id).order_by(DataSubmission.created_at.desc()).all()
        
        submissions_data = []
        for submission in user_submissions:
            # Get insurer info
            insurer = User.query.get(submission.insurer_id)
            
            submission_data = {
                'id': submission.id,
                'insurer_id': submission.insurer_id,
                'insurer_name': insurer.username if insurer else 'Unknown',
                'capital': submission.capital,
                'liabilities': submission.liabilities,
                'solvency_ratio': submission.solvency_ratio,
                'data_hash': submission.data_hash,
                'status': submission.status.value,
                'submission_date': submission.submission_date.isoformat() if submission.submission_date else None,
                'insurer_submitted_at': submission.insurer_submitted_at.isoformat() if submission.insurer_submitted_at else None,
                'regulator_approved_at': submission.regulator_approved_at.isoformat() if submission.regulator_approved_at else None,
                'regulator_rejected_at': submission.regulator_rejected_at.isoformat() if submission.regulator_rejected_at else None,
                'regulator_comments': submission.regulator_comments,
                'created_at': submission.created_at.isoformat() if submission.created_at else None
            }
            submissions_data.append(submission_data)
        
        print(f"✅ Found {len(submissions_data)} submissions for user {user_id}")
        
        return jsonify({
            'success': True,
            'submissions': submissions_data,
            'total_count': len(submissions_data),
            'user_id': user_id
        }), 200
        
    except Exception as e:
        print(f"❌ Error fetching user submissions: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/debug/check-user-submissions/<int:user_id>', methods=['GET'])
def debug_check_user_submissions(user_id):
    """Debug endpoint to check what submissions exist for a user"""
    try:
        print(f"🔍 Debug: Checking submissions for user ID: {user_id}")
        
        # Check if user exists
        user = User.query.get(user_id)
        if not user:
            return jsonify({
                'error': f'User {user_id} not found',
                'user_exists': False
            }), 404
        
        # Get all submissions for this user
        submissions = DataSubmission.query.filter_by(insurer_id=user_id).all()
        
        # Get all submissions in system for comparison
        all_submissions = DataSubmission.query.all()
        
        submission_summary = []
        for sub in submissions:
            submission_summary.append({
                'id': sub.id,
                'status': sub.status.value,
                'capital': sub.capital,
                'liabilities': sub.liabilities,
                'created_at': sub.created_at.isoformat() if sub.created_at else None
            })
        
        return jsonify({
            'user_id': user_id,
            'user_exists': True,
            'username': user.username,
            'user_email': user.email,
            'user_submissions_count': len(submissions),
            'user_submissions': submission_summary,
            'total_submissions_in_system': len(all_submissions),
            'all_insurer_ids_in_system': list(set([sub.insurer_id for sub in all_submissions]))
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print("🚀 Starting Solvency Compliance Server...")
    
    # Print all registered routes for debugging
    print("\n📍 Registered Routes:")
    with app.app_context():
        for rule in app.url_map.iter_rules():
            print(f"  {rule.methods} {rule}")
    
    app.run(debug=True, host='0.0.0.0', port=5000)