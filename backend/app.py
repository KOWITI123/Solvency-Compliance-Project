print("🔧 DEBUG: Starting app.py imports...")

from flask import Flask, jsonify, request
from flask_cors import CORS
from database.db_connection import db, connect_database

print("🔧 DEBUG: About to import routes...")
from routes.submit_data import register_submission_routes
print("🔧 DEBUG: submit_data routes imported successfully")

from routes.regulator_routes import register_regulator_routes
from routes.authentication import register_auth_routes
from datetime import datetime
import sys
import traceback

print("🔧 DEBUG: All imports completed")

app = Flask(__name__)
app.config["DEBUG"] = True
app.config["PROPAGATE_EXCEPTIONS"] = True

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
print("🔧 DEBUG: About to register routes...")
register_submission_routes(app)
print("🔧 DEBUG: Submission routes registered")
register_regulator_routes(app)
register_auth_routes(app)
print("🔧 DEBUG: All routes registered")

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'message': 'Solvency Compliance Backend API is running',
        'timestamp': datetime.utcnow().isoformat(),
        'version': '1.0.0'
    }), 200

@app.route('/debug/routes', methods=['GET'])
def debug_routes():
    """Debug endpoint to see all registered routes"""
    routes = []
    for rule in app.url_map.iter_rules():
        routes.append({
            'endpoint': rule.endpoint,
            'methods': list(rule.methods),
            'rule': str(rule)
        })
    return {'routes': routes}, 200

@app.route('/api/debug/submissions', methods=['GET'])
def debug_submissions():
    """Debug endpoint to see all submissions"""
    try:
        submissions = DataSubmission.query.all()
        submissions_data = []
        for sub in submissions:
            submissions_data.append({
                'id': sub.id,
                'insurer_id': sub.insurer_id,
                'capital': float(sub.capital) if sub.capital else None,
                'liabilities': float(sub.liabilities) if sub.liabilities else None,
                'status': sub.status.value if hasattr(sub.status, 'value') else str(sub.status),
                'created_at': sub.created_at.isoformat() if sub.created_at else None
            })
        
        return jsonify({
            'success': True,
            'count': len(submissions_data),
            'submissions': submissions_data
        }, 200)
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/debug/notifications', methods=['GET'])
def debug_notifications():
    """Debug endpoint to see notification table structure"""
    try:
        notifications = Notification.query.all()
        notifications_data = []
        for notif in notifications:
            notifications_data.append({
                'id': notif.id,
                'user_id': notif.user_id,
                'message': notif.message,
                'type': notif.type,
                'is_read': notif.is_read,
                'created_at': notif.created_at.isoformat() if notif.created_at else None
            })
        
        return jsonify({
            'success': True,
            'count': len(notifications_data),
            'notifications': notifications_data
        }), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/debug/users', methods=['GET'])
def debug_users():
    """Debug endpoint to see existing users"""
    try:
        users = User.query.all()
        users_data = []
        for user in users:
            users_data.append({
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'role': user.role.value if hasattr(user.role, 'value') else str(user.role),
                'created_at': user.created_at.isoformat() if user.created_at else None
            })
        
        return jsonify({
            'success': True,
            'count': len(users_data),
            'users': users_data
        }), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/debug/data-status', methods=['GET'])
def debug_data_status():
    """Debug endpoint to see current data status"""
    try:
        # Get counts
        total_submissions = DataSubmission.query.count()
        pending_submissions = DataSubmission.query.filter(
            DataSubmission.status == SubmissionStatus.INSURER_SUBMITTED
        ).count()
        approved_submissions = DataSubmission.query.filter(
            DataSubmission.status == SubmissionStatus.REGULATOR_APPROVED
        ).count()
        
        return jsonify({
            'success': True,
            'data_status': {
                'total_submissions': total_submissions,
                'pending_submissions': pending_submissions,
                'approved_submissions': approved_submissions,
                'database_connected': True
            }
        }), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'database_connected': False
        }), 500

@app.route('/api/submissions', methods=['GET'])
def get_all_submissions():
    """Get all financial submissions for blockchain log"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)
        
        submissions = DataSubmission.query.paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        submissions_data = []
        for submission in submissions.items:
            submissions_data.append({
                'id': submission.id,
                'insurer_id': submission.insurer_id,
                'capital': float(submission.capital) if submission.capital else None,
                'liabilities': float(submission.liabilities) if submission.liabilities else None,
                'solvency_ratio': float(submission.solvency_ratio) if submission.solvency_ratio else None,
                'status': submission.status.value if hasattr(submission.status, 'value') else str(submission.status),
                'submission_date': submission.submission_date.isoformat() if submission.submission_date else None,
                'created_at': submission.created_at.isoformat() if submission.created_at else None
            })
        
        return jsonify({
            'success': True,
            'submissions': submissions_data,
            'pagination': {
                'page': submissions.page,
                'pages': submissions.pages,
                'per_page': submissions.per_page,
                'total': submissions.total
            }
        }), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/test/create-pending-submissions', methods=['POST'])
def create_test_submissions():
    """Create multiple test submissions with INSURER_SUBMITTED status"""
    try:
        # Create test submissions
        test_submissions = [
            {
                'insurer_id': 1,
                'capital': 5000000,
                'liabilities': 3000000,
                'solvency_ratio': 66.67
            },
            {
                'insurer_id': 2,
                'capital': 8000000,
                'liabilities': 6000000,
                'solvency_ratio': 33.33
            }
        ]
        
        created_submissions = []
        for data in test_submissions:
            submission = DataSubmission(
                insurer_id=data['insurer_id'],
                capital=data['capital'],
                liabilities=data['liabilities'],
                solvency_ratio=data['solvency_ratio'],
                status=SubmissionStatus.INSURER_SUBMITTED,
                submission_date=datetime.utcnow().date(),
                insurer_submitted_at=datetime.utcnow(),
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
                data_hash=f"test_hash_{data['insurer_id']}"
            )
            db.session.add(submission)
            created_submissions.append(submission)
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'Created {len(created_submissions)} test submissions',
            'submissions': [{'id': s.id, 'insurer_id': s.insurer_id} for s in created_submissions]
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.errorhandler(Exception)
def handle_exception(e):
    print("🔥 GLOBAL ERROR HANDLER CAUGHT AN EXCEPTION", file=sys.stderr)
    traceback.print_exc(file=sys.stderr)
    return jsonify({
        "success": False,
        "error": str(e),
        "traceback": traceback.format_exc()
    }), 500

# ✅ REMOVED ALL DUPLICATE ENDPOINTS:
# - get_user_submissions (now only in submit_data.py)
# - debug_check_user_submissions (removed duplicate)
# - Any other duplicates

if __name__ == '__main__':
    print("🚀 Starting Flask server...")
    app.run(debug=True, host='0.0.0.0', port=5000)