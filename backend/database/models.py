from sqlalchemy import Column, Integer, String, Float, Date, DateTime, Enum, ForeignKey, Text, Boolean, Numeric
from sqlalchemy.orm import relationship
from database.db_connection import db
from datetime import datetime
import enum
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import ENUM

# Update the UserRole enum to match your database
class UserRole(enum.Enum):
    insurer = "insurer"      # ← Changed from CFO to insurer
    regulator = "regulator"  # ← Changed from Regulator to regulator  
    admin = "admin"          # ← Changed from Admin to admin

# Application-level enum that mirrors the DB enum type `submissionstatus`
class SubmissionStatus(enum.Enum):
    INSURER_SUBMITTED = "INSURER_SUBMITTED"
    REGULATOR_APPROVED = "REGULATOR_APPROVED"
    REGULATOR_REJECTED = "REGULATOR_REJECTED"

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

    # Ensure a back-reference for submissions exists (do not remove existing fields)
    # If `submissions` already exists in your file leave it as-is.
    submissions = relationship("DataSubmission", back_populates="insurer")

class DataSubmission(db.Model):
    __tablename__ = 'data_submissions'

    # ...existing columns...
    id = Column(Integer, primary_key=True)
    insurer_id = Column(Integer, ForeignKey('users.id'), nullable=False)

    data_hash = db.Column(String(128), unique=True, nullable=False)
    capital = db.Column(Numeric, nullable=False)
    liabilities = db.Column(Numeric, nullable=False)
    solvency_ratio = db.Column(Float, nullable=True)

    submission_date = db.Column(Date, nullable=True)
    insurer_submitted_at = db.Column(DateTime, nullable=True)
    created_at = db.Column(DateTime, default=datetime.utcnow, nullable=True)
    updated_at = db.Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=True)

    # Status of the submission (mapped to DB enum type `submissionstatus`)
    # Use SAEnum so SQLAlchemy will bind Python enum -> DB enum correctly.
    status = Column(SAEnum(SubmissionStatus, name='submissionstatus', native_enum=True), nullable=True)

    # File storage: path relative to backend/ (use this if you want dedicated path column)
    financial_statement_path = db.Column(String(1024), nullable=True)
    financial_statement_filename = db.Column(String(512), nullable=True)

    # -- Manual P&L / Regulatory fields (optional, nullable so existing rows remain valid)
    gwp = Column(Numeric, nullable=True)
    net_claims_paid = Column(Numeric, nullable=True)
    investment_income_total = Column(Numeric, nullable=True)
    commission_expense_total = Column(Numeric, nullable=True)
    operating_expenses_total = Column(Numeric, nullable=True)
    profit_before_tax = Column(Numeric, nullable=True)

    # --- Mandatory Regulatory & Governance Disclosures ---
    contingency_reserve_statutory = Column(Numeric, nullable=True)
    ibnr_reserve_gross = Column(Numeric, nullable=True)
    irfs17_implementation_status = Column(String(100), nullable=True)
    related_party_net_exposure = Column(Numeric, nullable=True)
    claims_development_method = Column(String(200), nullable=True)
    auditors_unqualified_opinion = Column(Boolean, nullable=True)

    # relationship back to User (keep if not already present)
    insurer = relationship("User", back_populates="submissions")

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
    recipient_id = Column(Integer, nullable=False)  # ✅ INTEGER not String
    sender_id = Column(Integer, nullable=False)     # ✅ INTEGER not String  
    message = Column(Text, nullable=False)
    urgency = Column(String(20), nullable=False)
    status = Column(String(20), default='Unread', nullable=False)
    sent_at = Column(DateTime, default=datetime.utcnow, nullable=True)