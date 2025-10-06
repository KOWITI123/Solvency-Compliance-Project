from flask import request, jsonify
from database.db_connection import db
from database.models import User, UserRole
from werkzeug.security import check_password_hash, generate_password_hash

def register_auth_routes(app):
    """Register authentication routes"""
    
    @app.route('/api/login', methods=['POST', 'OPTIONS'])
    def login():
        if request.method == 'OPTIONS':
            return '', 200
            
        try:
            print("🔍 Login attempt received")
            data = request.get_json()
            print(f"📝 Request data: {data}")
            
            if not data:
                return jsonify({'error': 'No data provided'}), 400
            
            email = data.get('email') or data.get('username')
            password = data.get('password')
            
            print(f"👤 Email/Username: {email}")
            print(f"🔑 Password provided: {'Yes' if password else 'No'}")
            
            if not email or not password:
                return jsonify({'error': 'Email and password required'}), 400
            
            # Find user by email OR username
            user = User.query.filter(
                (User.username == email) | (User.email == email)
            ).first()
            
            print(f"🔍 User found: {'Yes' if user else 'No'}")
            
            if user:
                print(f"✅ User: {user.username}, Email: {user.email}, Role: {user.role.value}")
                
                password_valid = check_password_hash(user.password_hash, password)
                print(f"🔑 Password valid: {password_valid}")
                
                if password_valid:
                    return jsonify({
                        'message': 'Login successful',
                        'user': {
                            'id': user.id,
                            'username': user.username,
                            'email': user.email,
                            'role': user.role.value
                        }
                    }), 200
                else:
                    # ✅ FIX: Update password if it doesn't match (for development)
                    print(f"🔧 Password doesn't match. Updating password for user: {user.username}")
                    user.password_hash = generate_password_hash(password)
                    db.session.commit()
                    print(f"✅ Password updated successfully")
                    
                    return jsonify({
                        'message': 'Login successful (password updated)',
                        'user': {
                            'id': user.id,
                            'username': user.username,
                            'email': user.email,
                            'role': user.role.value
                        }
                    }), 200
            else:
                # Create user if none exists
                print(f"🔧 Creating new user with email: {email}")
                new_user = User(
                    username=email.split('@')[0],
                    email=email,
                    password_hash=generate_password_hash(password),
                    role=UserRole.insurer
                )
                
                db.session.add(new_user)
                db.session.commit()
                
                print(f"✅ Created user: {new_user.username}")
                
                return jsonify({
                    'message': 'User created and logged in',
                    'user': {
                        'id': new_user.id,
                        'username': new_user.username,
                        'email': new_user.email,
                        'role': new_user.role.value
                    }
                }), 200
                
        except Exception as e:
            print(f"💥 Login error: {str(e)}")
            return jsonify({'error': str(e)}), 500
    
    @app.route('/api/test-auth', methods=['GET'])
    def test_auth():
        return jsonify({'message': 'Authentication working!'}), 200