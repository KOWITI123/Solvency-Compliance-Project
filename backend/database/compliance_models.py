from sqlalchemy import Column, Integer, String, Float, Date, DateTime, ForeignKey, Text, Boolean, JSON
from sqlalchemy.orm import relationship
from database.db_connection import db
from datetime import datetime

class ComplianceMetrics(db.Model):
    __tablename__ = 'compliance_metrics'

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    metric_type = Column(String(50), nullable=False)
    metric_data = Column(JSON, nullable=False)
    as_of_date = Column(Date, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User")

class CapitalSolvencyMetric(db.Model):
    __tablename__ = 'capital_solvency_metrics'

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    capital_adequacy_ratio = Column(Float, nullable=False)
    required_capital = Column(Float, nullable=False)
    available_capital = Column(Float, nullable=False)
    total_assets = Column(Float, nullable=False)
    total_liabilities = Column(Float, nullable=False)
    as_of_date = Column(Date, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User")

class InsurancePerformanceMetric(db.Model):
    __tablename__ = 'insurance_performance_metrics'

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    insurance_service_result = Column(Float, nullable=False)
    insurance_revenue = Column(Float, nullable=False)
    previous_year_revenue = Column(Float, nullable=False)
    insurance_revenue_growth = Column(Float, nullable=False)
    liability_adequacy = Column(String(20), nullable=False)
    as_of_date = Column(Date, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User")

class RiskManagementMetric(db.Model):
    __tablename__ = 'risk_management_metrics'

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    reinsurance_credit_rating = Column(String(10), nullable=False)
    reinsurance_payment_history = Column(String(20), nullable=False)
    reinsurance_last_review_date = Column(Date, nullable=False)
    claims_accuracy_rate = Column(Float, nullable=False)
    claims_reserving_adequacy = Column(String(20), nullable=False)
    internal_controls_effectiveness = Column(String(20), nullable=False)
    internal_controls_last_audit_date = Column(Date, nullable=False)
    as_of_date = Column(Date, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User")

class CorporateGovernanceMetric(db.Model):
    __tablename__ = 'corporate_governance_metrics'

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    total_board_members = Column(Integer, nullable=False)
    independent_directors = Column(Integer, nullable=False)
    has_independent_chair = Column(Boolean, nullable=False)
    committees_data = Column(JSON, nullable=False)
    related_party_transactions = Column(JSON, nullable=False)
    investment_policy_submitted = Column(Boolean, nullable=False)
    investment_policy_date = Column(Date, nullable=True)
    as_of_date = Column(Date, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User")
