from flask import Blueprint, jsonify, request, current_app
from database.db_connection import db
from database.compliance_models import (
    CapitalSolvencyMetric,
    InsurancePerformanceMetric,
    RiskManagementMetric,
    CorporateGovernanceMetric
)
from datetime import datetime, date
from services.metrics_service import get_insurance_performance

def register_compliance_routes(app):
    """
    Register compliance endpoints on the provided Flask app.
    Call this from app.py when you are ready. No automatic registration is performed.
    """

    @app.route('/api/compliance/capital-solvency/<int:user_id>', methods=['GET'])
    def get_capital_solvency(user_id):
        try:
            metric = CapitalSolvencyMetric.query.filter_by(user_id=user_id).order_by(
                CapitalSolvencyMetric.as_of_date.desc()
            ).first()

            if not metric:
                return jsonify({
                    'success': True,
                    'metrics': {
                        'capitalAdequacyRatio': 241,
                        'requiredCapital': 2532924000,
                        'availableCapital': 6104681000,
                        'totalAssets': 21537026000,
                        'totalLiabilities': 15157119000,
                        'asOfDate': datetime.now().isoformat()
                    }
                }), 200

            return jsonify({
                'success': True,
                'metrics': {
                    'capitalAdequacyRatio': metric.capital_adequacy_ratio,
                    'requiredCapital': metric.required_capital,
                    'availableCapital': metric.available_capital,
                    'totalAssets': metric.total_assets,
                    'totalLiabilities': metric.total_liabilities,
                    'asOfDate': metric.as_of_date.isoformat()
                }
            }), 200

        except Exception as e:
            print(f"Error fetching capital solvency metrics: {str(e)}")
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/api/compliance/insurance-performance/<int:user_id>', methods=['GET'])
    def compliance_insurance_performance(user_id):
        try:
            metrics = get_insurance_performance(user_id, db_models)
            return jsonify({'success': True, 'metrics': metrics}), 200
        except Exception as e:
            current_app.logger.exception("Error building insurance-performance metrics")
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/api/compliance/risk-management/<int:user_id>', methods=['GET'])
    def get_risk_management(user_id):
        try:
            metric = RiskManagementMetric.query.filter_by(user_id=user_id).order_by(
                RiskManagementMetric.as_of_date.desc()
            ).first()

            if not metric:
                return jsonify({
                    'success': True,
                    'metrics': {
                        'reinsuranceStrategy': {
                            'creditRating': 'A+',
                            'paymentHistory': 'Excellent',
                            'lastReviewDate': datetime.now().isoformat()
                        },
                        'claimsDevelopment': {
                            'accuracyRate': 94.5,
                            'reservingAdequacy': 'Adequate'
                        },
                        'internalControls': {
                            'effectiveness': 'Strong',
                            'lastAuditDate': datetime.now().isoformat()
                        }
                    }
                }), 200

            return jsonify({
                'success': True,
                'metrics': {
                    'reinsuranceStrategy': {
                        'creditRating': metric.reinsurance_credit_rating,
                        'paymentHistory': metric.reinsurance_payment_history,
                        'lastReviewDate': metric.reinsurance_last_review_date.isoformat()
                    },
                    'claimsDevelopment': {
                        'accuracyRate': metric.claims_accuracy_rate,
                        'reservingAdequacy': metric.claims_reserving_adequacy
                    },
                    'internalControls': {
                        'effectiveness': metric.internal_controls_effectiveness,
                        'lastAuditDate': metric.internal_controls_last_audit_date.isoformat()
                    }
                }
            }), 200

        except Exception as e:
            print(f"Error fetching risk management metrics: {str(e)}")
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/api/compliance/corporate-governance/<int:user_id>', methods=['GET'])
    def get_corporate_governance(user_id):
        try:
            metric = CorporateGovernanceMetric.query.filter_by(user_id=user_id).order_by(
                CorporateGovernanceMetric.as_of_date.desc()
            ).first()

            if not metric:
                return jsonify({
                    'success': True,
                    'metrics': {
                        'boardStructure': {
                            'totalMembers': 9,
                            'independentDirectors': 4,
                            'hasIndependentChair': True
                        },
                        'committees': [
                            {'name': 'Audit and Risk Committee', 'members': 4, 'meetingsPerYear': 6},
                            {'name': 'ICT Committee', 'members': 3, 'meetingsPerYear': 4},
                            {'name': 'Investment Committee', 'members': 4, 'meetingsPerYear': 4},
                            {'name': 'Human Resources Committee', 'members': 3, 'meetingsPerYear': 4}
                        ],
                        'relatedPartyTransactions': [
                            {
                                'party': 'Apollo Group (Parent Company)',
                                'amount': 45000000,
                                'description': 'Insurance premiums and services',
                                'date': datetime.now().isoformat()
                            }
                        ],
                        'investmentPolicySubmitted': True,
                        'investmentPolicyDate': datetime.now().isoformat()
                    }
                }), 200

            return jsonify({
                'success': True,
                'metrics': {
                    'boardStructure': {
                        'totalMembers': metric.total_board_members,
                        'independentDirectors': metric.independent_directors,
                        'hasIndependentChair': metric.has_independent_chair
                    },
                    'committees': metric.committees_data,
                    'relatedPartyTransactions': metric.related_party_transactions,
                    'investmentPolicySubmitted': metric.investment_policy_submitted,
                    'investmentPolicyDate': metric.investment_policy_date.isoformat() if metric.investment_policy_date else None
                }
            }), 200

        except Exception as e:
            print(f"Error fetching corporate governance metrics: {str(e)}")
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/api/compliance/seed-sample-data/<int:user_id>', methods=['POST'])
    def seed_sample_compliance_data(user_id):
        try:
            capital_solvency = CapitalSolvencyMetric(
                user_id=user_id,
                capital_adequacy_ratio=241,
                required_capital=2532924000,
                available_capital=6104681000,
                total_assets=21537026000,
                total_liabilities=15157119000,
                as_of_date=date.today()
            )
            db.session.add(capital_solvency)

            insurance_performance = InsurancePerformanceMetric(
                user_id=user_id,
                insurance_service_result=681690000,
                insurance_revenue=17460597000,
                previous_year_revenue=16724384000,
                insurance_revenue_growth=4.4,
                liability_adequacy='Adequate',
                as_of_date=date.today()
            )
            db.session.add(insurance_performance)

            risk_management = RiskManagementMetric(
                user_id=user_id,
                reinsurance_credit_rating='A+',
                reinsurance_payment_history='Excellent',
                reinsurance_last_review_date=date.today(),
                claims_accuracy_rate=94.5,
                claims_reserving_adequacy='Adequate',
                internal_controls_effectiveness='Strong',
                internal_controls_last_audit_date=date.today(),
                as_of_date=date.today()
            )
            db.session.add(risk_management)

            corporate_governance = CorporateGovernanceMetric(
                user_id=user_id,
                total_board_members=9,
                independent_directors=4,
                has_independent_chair=True,
                committees_data=[
                    {'name': 'Audit and Risk Committee', 'members': 4, 'meetingsPerYear': 6},
                    {'name': 'ICT Committee', 'members': 3, 'meetingsPerYear': 4},
                    {'name': 'Investment Committee', 'members': 4, 'meetingsPerYear': 4},
                    {'name': 'Human Resources Committee', 'members': 3, 'meetingsPerYear': 4}
                ],
                related_party_transactions=[
                    {
                        'party': 'Apollo Group (Parent Company)',
                        'amount': 45000000,
                        'description': 'Insurance premiums and services',
                        'date': datetime.now().isoformat()
                    },
                    {
                        'party': 'Associated Investment Fund',
                        'amount': 125000000,
                        'description': 'Investment management services',
                        'date': datetime.now().isoformat()
                    }
                ],
                investment_policy_submitted=True,
                investment_policy_date=date.today(),
                as_of_date=date.today()
            )
            db.session.add(corporate_governance)

            db.session.commit()

            return jsonify({
                'success': True,
                'message': 'Sample compliance data seeded successfully'
            }), 201

        except Exception as e:
            db.session.rollback()
            print(f"Error seeding compliance data: {str(e)}")
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/api/submissions/<int:submission_id>/risk-scores', methods=['GET'])
    def submission_risk_scores(submission_id: int):
        """
        Compute risk score percentages from a DataSubmission's solvency_ratio.
        Returns:
          { success: true, scores: { underwriting, market, credit, operational, solvency } }
        Defensive: tolerates missing DB or fields.
        """
        try:
            # lazy import DB models
            from database.models import db, DataSubmission
        except Exception:
            return jsonify({'success': False, 'error': 'DB models not available'}), 500

        try:
            # load submission safely (works with various SQLAlchemy setups)
            sub = None
            try:
                sub = DataSubmission.query.get(submission_id)
            except Exception:
                try:
                    sub = db.session.get(DataSubmission, submission_id)
                except Exception:
                    sub = None

            if sub is None:
                return jsonify({'success': False, 'error': 'Submission not found'}), 404

            # get solvency ratio (handle different field names)
            solv = getattr(sub, 'solvency_ratio', None)
            if solv is None:
                solv = getattr(sub, 'solvency', None)
            try:
                solvency = float(solv or 0.0)
            except Exception:
                solvency = 0.0

            # Basic mapping: the larger (100 - solvency), the larger the risk exposure.
            stress_base = max(0.0, min(100.0, 100.0 - solvency))

            # weights (can be adjusted)
            weights = {
                'underwriting': 0.40,
                'market': 0.25,
                'credit': 0.20,
                'operational': 0.15
            }

            scores = {}
            for k, w in weights.items():
                # raw proportion of stress_base
                scores[k] = round(stress_base * w, 2)

            # Ensure small rounding adjustments keep totals sensible
            total = sum(scores.values())
            # If due to floating rounding total != stress_base, adjust underwriting to compensate
            if abs(total - stress_base) >= 0.01:
                scores['underwriting'] = round(scores['underwriting'] + (stress_base - total), 2)

            return jsonify({'success': True, 'scores': {
                'underwriting': scores['underwriting'],
                'market': scores['market'],
                'credit': scores['credit'],
                'operational': scores['operational'],
                'solvency': round(solvency, 2)
            }}), 200
        except Exception as e:
            current_app.logger.exception("Error computing risk scores")
            return jsonify({'success': False, 'error': str(e)}), 500
