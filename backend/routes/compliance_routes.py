from flask import Blueprint, jsonify, request
from database.db_connection import db
from database.compliance_models import (
    CapitalSolvencyMetric,
    InsurancePerformanceMetric,
    RiskManagementMetric,
    CorporateGovernanceMetric
)
from datetime import datetime, date

def register_compliance_routes(app):

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
    def get_insurance_performance(user_id):
        try:
            metric = InsurancePerformanceMetric.query.filter_by(user_id=user_id).order_by(
                InsurancePerformanceMetric.as_of_date.desc()
            ).first()

            if not metric:
                return jsonify({
                    'success': True,
                    'metrics': {
                        'insuranceServiceResult': 681690000,
                        'insuranceRevenue': 17460597000,
                        'previousYearRevenue': 16724384000,
                        'insuranceRevenueGrowth': 4.4,
                        'liabilityAdequacy': 'Adequate',
                        'asOfDate': datetime.now().isoformat()
                    }
                }), 200

            return jsonify({
                'success': True,
                'metrics': {
                    'insuranceServiceResult': metric.insurance_service_result,
                    'insuranceRevenue': metric.insurance_revenue,
                    'previousYearRevenue': metric.previous_year_revenue,
                    'insuranceRevenueGrowth': metric.insurance_revenue_growth,
                    'liabilityAdequacy': metric.liability_adequacy,
                    'asOfDate': metric.as_of_date.isoformat()
                }
            }), 200

        except Exception as e:
            print(f"Error fetching insurance performance metrics: {str(e)}")
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
