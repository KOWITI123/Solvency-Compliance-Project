from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine
from .models import User, FinancialData, InsurerProfile, Alert, UserRole, ComplianceStatus, InsurerSize, AlertSeverity
from werkzeug.security import generate_password_hash
from datetime import datetime, date
import random

def seed_database(database_uri):
    """Seed the database with 50 mock insurers and related data"""
    
    engine = create_engine(database_uri)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        # Check if data already exists
        existing_users = session.query(User).count()
        if existing_users > 0:
            print(f"Database already has {existing_users} users. Skipping seeding.")
            return
        
        # Sample data for seeding
        regions = ['Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Eldoret', 'Thika', 'Malindi', 'Garissa', 'Kericho', 'Nyeri']
        company_names = [
            'Maisha Insurance', 'Kilifi General', 'Savannah Assurance', 'Coastal Insurance',
            'Highland Mutual', 'Urban Insurance Co', 'Rural Assurance', 'Metro Insurance',
            'County Insurance', 'Regional Assurance', 'Local Insurance', 'Community Mutual',
            'Farmers Insurance', 'Workers Assurance', 'Family Insurance', 'Security Mutual',
            'Trust Insurance', 'Unity Assurance', 'Progress Insurance', 'Future Mutual'
        ]
        
        # Create sample users (insurers)
        users = []
        for i in range(50):
            company_name = f"{random.choice(company_names)} {i+1}"
            email = f"insurer{i+1}@example.com"
            username = f"insurer_{i+1}"
            
            user = User(
                username=username,
                email=email,
                password_hash=generate_password_hash('password123'),
                role=UserRole.insurer,
                created_at=datetime.utcnow()
            )
            users.append(user)
            session.add(user)
        
        # Add some regulators and admins
        regulator = User(
            username='regulator_main',
            email='regulator@ira.go.ke',
            password_hash=generate_password_hash('regulator123'),
            role=UserRole.regulator,
            created_at=datetime.utcnow()
        )
        users.append(regulator)
        session.add(regulator)
        
        admin = User(
            username='admin_main',
            email='admin@solvasure.co.ke',
            password_hash=generate_password_hash('admin123'),
            role=UserRole.admin,
            created_at=datetime.utcnow()
        )
        users.append(admin)
        session.add(admin)
        
        session.commit()
        print("Users created successfully")
        
        # Create insurer profiles
        insurer_users = [u for u in users if u.role == UserRole.insurer]
        for user in insurer_users:
            profile = InsurerProfile(
                user_id=user.id,
                size=random.choice(list(InsurerSize)),
                region=random.choice(regions),
                compliance_history=[
                    {"date": "2024-01-01", "status": "Compliant"},
                    {"date": "2023-12-01", "status": random.choice(["Compliant", "Non-Compliant"])},
                    {"date": "2023-11-01", "status": random.choice(["Compliant", "Non-Compliant"])}
                ]
            )
            session.add(profile)
        
        session.commit()
        print("Insurer profiles created successfully")
        
        # Create financial data for insurers
        for user in insurer_users:
            for month in range(1, 4):  # 3 months of data
                capital = random.uniform(1000000, 10000000)  # 1M to 10M
                liabilities = random.uniform(500000, capital * 1.2)  # Variable liabilities
                solvency_ratio = capital / liabilities
                
                financial_data = FinancialData(
                    user_id=user.id,
                    capital=capital,
                    liabilities=liabilities,
                    date=date(2024, month, 1),
                    solvency_ratio=solvency_ratio,
                    status=ComplianceStatus.Compliant if solvency_ratio >= 1.0 else ComplianceStatus.Non_Compliant,
                    created_at=datetime.utcnow()
                )
                session.add(financial_data)
        
        session.commit()
        print("Financial data created successfully")
        
        # Create some alerts for non-compliant insurers
        financial_data_list = session.query(FinancialData).filter(
            FinancialData.status == ComplianceStatus.Non_Compliant
        ).all()
        
        for fd in financial_data_list[:10]:  # Create alerts for first 10 non-compliant records
            alert = Alert(
                insurer_id=fd.user_id,
                issue=f"Solvency ratio below minimum threshold: {fd.solvency_ratio:.2f}",
                timestamp=datetime.utcnow(),
                severity=AlertSeverity.High if fd.solvency_ratio < 0.8 else AlertSeverity.Low,
                read=False
            )
            session.add(alert)
        
        session.commit()
        print("Alerts created successfully")
        print(f"Successfully seeded database with {len(insurer_users)} insurers and related data")
        
    except Exception as e:
        session.rollback()
        print(f"Error seeding database: {e}")
        raise e
    finally:
        session.close()