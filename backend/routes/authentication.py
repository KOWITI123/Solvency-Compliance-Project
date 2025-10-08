from flask import request, jsonify
from database.db_connection import db
from database.models import User, UserRole  # ✅ Remove InsurerProfile import
from werkzeug.security import check_password_hash, generate_password_hash
from datetime import datetime

def register_auth_routes(app):
    """Register authentication routes"""
    
    @app.route('/api/signup', methods=['POST', 'OPTIONS'])
    def signup():
        """User signup endpoint"""
        if request.method == 'OPTIONS':
            return '', 200
            
        try:
            print("📝 Signup request received")
            data = request.get_json()
            print(f"📦 Signup data: {data}")
            
            # Basic validation
            if not data:
                return jsonify({
                    'success': False,
                    'error': 'No data provided'
                }), 400
            
            # Extract signup data
            business_name = data.get('business_name')
            business_email = data.get('business_email')
            registration_number = data.get('registration_number')
            password = data.get('password')
            role = data.get('role', 'insurer')
            
            # Validation
            if not business_email or not password or not business_name:
                return jsonify({
                    'success': False,
                    'error': 'Business name, email, and password are required'
                }), 400
            
            # Check if user already exists
            existing_user = User.query.filter(
                (User.email == business_email) | (User.username == business_email)
            ).first()
            
            if existing_user:
                return jsonify({
                    'success': False,
                    'error': 'User with this email already exists'
                }), 409
            
            # ✅ CREATE ONLY USER RECORD (store business info in username)
            new_user = User(
                username=business_name,  # ✅ Store business name in username
                email=business_email,
                password_hash=generate_password_hash(password),
                role=UserRole.insurer if role == 'insurer' else UserRole.regulator
            )
            
            db.session.add(new_user)
            db.session.commit()
            
            print(f"✅ Created user: {new_user.username} with email: {new_user.email} and ID: {new_user.id}")
            
            # Return success response
            response_data = {
                'success': True,
                'message': 'Account created successfully',
                'user': {
                    'id': new_user.id,
                    'username': new_user.username,
                    'business_name': business_name,
                    'business_email': new_user.email,
                    'registration_number': registration_number,  # ✅ Return but don't store (no table for it)
                    'role': new_user.role.value
                }
            }
            
            print(f"✅ Signup successful: {response_data}")
            return jsonify(response_data), 201
            
        except Exception as e:
            db.session.rollback()
            print(f"❌ Signup error: {str(e)}")
            import traceback
            traceback.print_exc()
            return jsonify({
                'success': False,
                'error': f'Signup failed: {str(e)}'
            }), 500
    
    @app.route('/api/login', methods=['POST', 'OPTIONS'])
    def login():
        """User login endpoint"""
        if request.method == 'OPTIONS':
            return '', 200
            
        try:
            print("🔐 Login request received")
            data = request.get_json()
            print(f"📦 Login data: {data}")
            
            if not data:
                return jsonify({
                    'success': False,
                    'error': 'No data provided'
                }), 400
            
            # ✅ HANDLE BOTH EMAIL FIELD NAMES from frontend
            email = data.get('email') or data.get('business_email') or data.get('username')
            password = data.get('password')
            
            print(f"👤 Email/Username: {email}")
            print(f"🔑 Password provided: {'Yes' if password else 'No'}")
            
            if not email or not password:
                return jsonify({
                    'success': False,
                    'error': 'Email and password are required'
                }), 400
            
            # Find user by email OR username
            user = User.query.filter(
                (User.username == email) | (User.email == email)
            ).first()
            
            print(f"🔍 User found: {'Yes' if user else 'No'}")
            
            if not user:
                return jsonify({
                    'success': False,
                    'error': 'Invalid email or password'
                }), 401
            
            print(f"✅ User: {user.username}, Email: {user.email}, Role: {user.role.value}, ID: {user.id}")
            
            # Check password
            password_valid = check_password_hash(user.password_hash, password)
            print(f"🔑 Password valid: {password_valid}")
            
            if not password_valid:
                return jsonify({
                    'success': False,
                    'error': 'Invalid email or password'
                }), 401
            
            # ✅ SUCCESSFUL LOGIN with clear user ID
            response_data = {
                'success': True,
                'message': 'Login successful',
                'user': {
                    'id': user.id,  # ✅ This is the key field for user-specific endpoints
                    'username': user.username,
                    'business_name': user.username,
                    'business_email': user.email,
                    'email': user.email,
                    'role': user.role.value
                },
                'user_id': user.id,  # ✅ Add this for easy access
                'token': f'mock_jwt_token_{user.id}_{datetime.utcnow().timestamp()}'
            }
            
            print(f"✅ Login successful for user ID {user.id}: {response_data}")
            return jsonify(response_data), 200
            
        except Exception as e:
            print(f"❌ Login error: {str(e)}")
            import traceback
            traceback.print_exc()
            return jsonify({
                'success': False,
                'error': f'Login failed: {str(e)}'
            }), 500
    
    @app.route('/api/test-auth', methods=['GET'])
    def test_auth():
        """Test endpoint to verify auth routes are working"""
        return jsonify({
            'message': 'Authentication routes working!',
            'endpoints': ['/api/signup', '/api/login']
        }), 200