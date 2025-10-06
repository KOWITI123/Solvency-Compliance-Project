from sqlalchemy import Column, Integer, String, Float, Date, DateTime, Enum, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from database.db_connection import db
import enum
from datetime import datetime

# Update the UserRole enum to match your database
class UserRole(enum.Enum):
    insurer = "insurer"      # ← Changed from CFO to insurer
    regulator = "regulator"  # ← Changed from Regulator to regulator  
    admin = "admin"          # ← Changed from Admin to admin

# Update your enums to match what's in the database
class SubmissionStatus(enum.Enum):
    # Check what values actually exist in your database first
    PENDING = "PENDING" 
    INSURER_SUBMITTED = "INSURER_SUBMITTED"  # ✅ Changed from SUBMITTED to match DB
    REGULATOR_APPROVED = "REGULATOR_APPROVED"  # ✅ Changed from APPROVED to match DB
    REJECTED = "REJECTED"  # ✅ Use this instead of REGULATOR_REJECTED
    FINALIZED = "FINALIZED"  # ✅ Added this new status from DB

class ComplianceStatus(enum.Enum):
    Compliant = "Compliant"
    Non_Compliant = "Non_Compliant" 
    Under_Review = "Under_Review"

class NotificationUrgency(enum.Enum):
    Low = "Low"
    Medium = "Medium"
    High = "High"
    Critical = "Critical"

class NotificationStatus(enum.Enum):
    Sent = "Sent"
    Read = "Read"
    Unread = "Unread"

# Models
class User(db.Model):
    __tablename__ = 'users'
    
    id = Column(Integer, primary_key=True)
    username = Column(String(50), unique=True, nullable=False)
    email = Column(String(100), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class DataSubmission(db.Model):
    __tablename__ = 'data_submissions'
    
    id = Column(Integer, primary_key=True)
    data_hash = Column(String(64), unique=True, nullable=False)
    capital = Column(Float, nullable=False)  # numeric(15,2) in db
    liabilities = Column(Float, nullable=False)  # numeric(15,2) in db
    solvency_ratio = Column(Float, nullable=False)  # numeric(5,2) in db
    submission_date = Column(Date, nullable=False)
    insurer_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    insurer_submitted_at = Column(DateTime, nullable=True)
    regulator_id = Column(Integer, ForeignKey('users.id'), nullable=True)
    regulator_approved_at = Column(DateTime, nullable=True)
    regulator_rejected_at = Column(DateTime, nullable=True)
    regulator_comments = Column(Text, nullable=True)
    status = Column(Enum(SubmissionStatus), nullable=False)
    compliance_status = Column(Enum(ComplianceStatus), nullable=True)
    blockchain_tx_hash = Column(String(66), nullable=True)
    smart_contract_address = Column(String(42), nullable=True)
    created_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, nullable=True)
    blockchain_data = Column(Text, nullable=True)
    
    # Relationships
    insurer = relationship("User", foreign_keys=[insurer_id])
    regulator = relationship("User", foreign_keys=[regulator_id])

class FinancialData(db.Model):
    __tablename__ = 'financial_data'
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    capital = Column(Float, nullable=False)
    liabilities = Column(Float, nullable=False)
    date = Column(Date, nullable=False)
    solvency_ratio = Column(Float, nullable=False)
    status = Column(Enum(ComplianceStatus), nullable=True)
    submission_id = Column(Integer, ForeignKey('data_submissions.id'), nullable=True)
    verification_hash = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship("User")
    submission = relationship("DataSubmission")

class Notification(db.Model):
    __tablename__ = 'notifications'
    
    id = Column(Integer, primary_key=True)
    sender_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    recipient_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    message = Column(Text, nullable=False)
    urgency = Column(Enum(NotificationUrgency), nullable=False)
    sent_at = Column(DateTime, nullable=True)  # Note: nullable in your DB
    status = Column(Enum(NotificationStatus), nullable=False)
    
    # Relationships
    sender = relationship("User", foreign_keys=[sender_id])
    recipient = relationship("User", foreign_keys=[recipient_id])