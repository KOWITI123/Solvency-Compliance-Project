from app import create_app
from database.db_connection import db
from database.models import User, UserRole
from werkzeug.security import generate_password_hash

app = create_app()

with app.app_context():
    # Check if users exist
    users = User.query.all()
    print(f"📊 Total users in database: {len(users)}")
    
    for user in users:
        print(f"👤 User: {user.username}, Email: {user.email}, Role: {user.role.value}")
    
    # Create test users if none exist
    if len(users) == 0:
        print("🔧 Creating test users...")
        
        # Create CFO user
        cfo_user = User(
            username="cfo",
            email="cfo@company.com",
            password_hash=generate_password_hash("password123"),
            role=UserRole.CFO
        )
        
        # Create Regulator/Actuary user
        regulator_user = User(
            username="regulator",
            email="regulator@company.com",
            password_hash=generate_password_hash("password123"),
            role=UserRole.Regulator
        )
        
        db.session.add(cfo_user)
        db.session.add(regulator_user)
        db.session.commit()
        
        print("✅ Test users created:")
        print("   👤 Username: cfo, Password: password123, Role: CFO")
        print("   👤 Username: regulator, Password: password123, Role: Regulator")
    else:
        print("✅ Users already exist in database")