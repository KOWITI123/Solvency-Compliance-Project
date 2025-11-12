from sqlalchemy import Column, Integer, String, Float, Date, DateTime, Enum, ForeignKey, Text, Boolean, Numeric, JSON
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

# Add these new enums after your existing ones

class RiskType(enum.Enum):
    UNDERWRITING = "UNDERWRITING"
    MARKET = "MARKET"
    CREDIT = "CREDIT"
    OPERATIONAL = "OPERATIONAL"
    LIQUIDITY = "LIQUIDITY"
    REPUTATIONAL = "REPUTATIONAL"

class RiskLevel(enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"

class StressTestStatus(enum.Enum):
    DRAFT = "DRAFT"
    COMPLETED = "COMPLETED"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"

class GovernanceRole(enum.Enum):
    RISK_MANAGER = "RISK_MANAGER"
    COMPLIANCE_OFFICER = "COMPLIANCE_OFFICER"
    INTERNAL_AUDITOR = "INTERNAL_AUDITOR"
    ACTUARY = "ACTUARY"
    CEO = "CEO"
    BOARD_MEMBER = "BOARD_MEMBER"

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
    # --- Risk summary fields (nullable, new) ---
    underwriting_risk_score = Column(Float, nullable=True)   # percent or score
    market_risk_score = Column(Float, nullable=True)
    credit_risk_score = Column(Float, nullable=True)
    operational_risk_score = Column(Float, nullable=True)
    overall_risk_score = Column(Float, nullable=True)
    credit_risk_grade = Column(String(4), nullable=True)     # e.g. "A+", "A", "B"
    # Optional backref to material risks linked to this submission
    material_risks = relationship("MaterialRisk", back_populates="submission", lazy='dynamic')

    submission_date = db.Column(Date, nullable=True)
    insurer_submitted_at = db.Column(DateTime, nullable=True)
    created_at = db.Column(DateTime, default=datetime.utcnow, nullable=True)
    updated_at = db.Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=True)
    # Timestamps and comments from regulator actions
    regulator_approved_at = Column(DateTime, nullable=True)
    regulator_rejected_at = Column(DateTime, nullable=True)
    regulator_comments = Column(Text, nullable=True)

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

    # --- AI extraction metadata & payload ---
    ai_extraction = Column(JSON, nullable=True)               # raw normalized JSON extracted by AI
    ai_extraction_raw = Column(Text, nullable=True)           # raw LLM chunk summaries / payload (if stored)
    ai_model = Column(String(100), nullable=True)             # model id used (e.g. gemini-2.5-pro)
    ai_confidence = Column(Float, nullable=True)              # optional confidence score
    ai_extracted_at = Column(DateTime, nullable=True)         # timestamp when AI extraction ran
    ai_used = Column(Boolean, default=False, nullable=False)  # whether AI values were applied to submission

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

# Add these new models after your existing models

# 1. Risk Appetite Statement
class RiskAppetiteStatement(db.Model):
    __tablename__ = 'risk_appetite_statements'
    
    id = Column(Integer, primary_key=True)
    insurer_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    statement_year = Column(Integer, nullable=False)  # e.g., 2024
    max_acceptable_loss_percentage = Column(Float, nullable=False)  # e.g., 20.0
    target_profit_margin = Column(Float, nullable=False)  # e.g., 15.0
    risk_tolerance_level = Column(Enum(RiskLevel), nullable=False)
    strategic_objectives = Column(Text, nullable=True)
    board_approved = Column(Boolean, default=False)
    board_approval_date = Column(Date, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    insurer = relationship("User", foreign_keys=[insurer_id])

# 2. Material Risk Register
class MaterialRisk(db.Model):
    __tablename__ = 'material_risks'
    
    id = Column(Integer, primary_key=True)
    insurer_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    # Optional link to the submission that generated/relates to this risk
    submission_id = Column(Integer, ForeignKey('data_submissions.id'), nullable=True)
    risk_type = Column(Enum(RiskType), nullable=False)
    risk_title = Column(String(200), nullable=False)
    risk_description = Column(Text, nullable=False)
    probability = Column(Integer, nullable=False)  # 1-10 scale
    financial_impact = Column(Float, nullable=False)  # KES amount
    risk_score = Column(Float, nullable=False)  # probability * impact
    risk_level = Column(Enum(RiskLevel), nullable=False)
    mitigation_measures = Column(Text, nullable=True)
    risk_owner = Column(String(100), nullable=False)
    review_date = Column(Date, nullable=False)
    last_reviewed = Column(Date, nullable=True)
    status = Column(String(20), default='ACTIVE')  # ACTIVE, MITIGATED, CLOSED
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    insurer = relationship("User", foreign_keys=[insurer_id])
    submission = relationship("DataSubmission", back_populates="material_risks", foreign_keys=[submission_id])

# 3. Stress Testing & Scenarios
class StressTest(db.Model):
    __tablename__ = 'stress_tests'
    
    id = Column(Integer, primary_key=True)
    insurer_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    test_name = Column(String(200), nullable=False)
    test_description = Column(Text, nullable=True)
    base_capital = Column(Float, nullable=False)
    base_liabilities = Column(Float, nullable=False)
    base_solvency_ratio = Column(Float, nullable=False)
    
    # Stress factors (percentages)
    market_decline_percentage = Column(Float, default=0.0)
    claims_increase_percentage = Column(Float, default=0.0)
    economic_decline_percentage = Column(Float, default=0.0)
    interest_rate_change = Column(Float, default=0.0)
    
    # Results
    stressed_capital = Column(Float, nullable=True)
    stressed_liabilities = Column(Float, nullable=True)
    stressed_solvency_ratio = Column(Float, nullable=True)
    capital_shortfall = Column(Float, default=0.0)
    still_compliant = Column(Boolean, nullable=True)
    
    # Action plan if stress scenario occurs
    action_plan = Column(Text, nullable=True)
    
    status = Column(Enum(StressTestStatus), default=StressTestStatus.DRAFT)
    test_date = Column(Date, nullable=False)
    approved_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    insurer = relationship("User", foreign_keys=[insurer_id])
    approver = relationship("User", foreign_keys=[approved_by])

# 4. Key Function Holders (Governance)
class KeyFunctionHolder(db.Model):
    __tablename__ = 'key_function_holders'
    
    id = Column(Integer, primary_key=True)
    insurer_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    full_name = Column(String(200), nullable=False)
    position = Column(Enum(GovernanceRole), nullable=False)
    qualifications = Column(Text, nullable=True)  # JSON string of qualifications
    fit_and_proper_status = Column(Boolean, default=False)
    fit_and_proper_date = Column(Date, nullable=True)
    appointment_date = Column(Date, nullable=False)
    last_review_date = Column(Date, nullable=True)
    next_review_date = Column(Date, nullable=True)
    is_active = Column(Boolean, default=True)
    ira_approval_ref = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    insurer = relationship("User", foreign_keys=[insurer_id])

# 5. Board Oversight & Meeting Minutes
class BoardMeeting(db.Model):
    __tablename__ = 'board_meetings'
    
    id = Column(Integer, primary_key=True)
    insurer_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    meeting_date = Column(Date, nullable=False)
    meeting_type = Column(String(50), nullable=False)  # BOARD, AUDIT_COMMITTEE, RISK_COMMITTEE
    attendees = Column(Text, nullable=True)  # JSON array of attendee names
    risk_topics_discussed = Column(Text, nullable=True)  # JSON array of topics
    decisions_approved = Column(Text, nullable=True)  # JSON array of decisions
    minutes_reference = Column(String(200), nullable=True)
    next_meeting_date = Column(Date, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    insurer = relationship("User", foreign_keys=[insurer_id])

# 6. Internal Control Systems
class InternalControl(db.Model):
    __tablename__ = 'internal_controls'
    
    id = Column(Integer, primary_key=True)
    insurer_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    control_area = Column(String(100), nullable=False)  # e.g., "Claims Processing", "Underwriting"
    control_description = Column(Text, nullable=False)
    control_type = Column(String(50), nullable=False)  # PREVENTIVE, DETECTIVE, CORRECTIVE
    responsible_person = Column(String(100), nullable=False)
    testing_frequency = Column(String(50), nullable=False)  # MONTHLY, QUARTERLY, ANNUALLY
    last_test_date = Column(Date, nullable=True)
    test_result = Column(String(20), nullable=True)  # EFFECTIVE, INEFFECTIVE, NOT_TESTED
    deficiencies_noted = Column(Text, nullable=True)
    remediation_plan = Column(Text, nullable=True)
    next_test_date = Column(Date, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    insurer = relationship("User", foreign_keys=[insurer_id])

# 7. ORSA Report Summary (Annual submission to IRA)
class ORSAReport(db.Model):
    __tablename__ = 'orsa_reports'
    
    id = Column(Integer, primary_key=True)
    insurer_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    report_year = Column(Integer, nullable=False)
    submission_date = Column(Date, nullable=False)
    
    # Summary metrics
    total_risks_identified = Column(Integer, nullable=False)
    high_critical_risks = Column(Integer, nullable=False)
    stress_tests_performed = Column(Integer, nullable=False)
    worst_case_solvency_ratio = Column(Float, nullable=False)
    capital_adequacy_assessment = Column(Text, nullable=True)
    
    # Governance status
    board_approved = Column(Boolean, default=False)
    board_approval_date = Column(Date, nullable=True)
    
    # IRA submission
    submitted_to_ira = Column(Boolean, default=False)
    ira_submission_date = Column(Date, nullable=True)
    ira_reference_number = Column(String(100), nullable=True)
    ira_feedback = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    insurer = relationship("User", foreign_keys=[insurer_id])