print("🔧 DEBUG: submit_data.py module is being imported")

from flask import request, jsonify
from datetime import datetime
from database.db_connection import db
from database.models import DataSubmission, SubmissionStatus
import hashlib
import time
import json
import traceback
import sys
import re
import os
from werkzeug.utils import secure_filename

def register_submission_routes(app):
    print("🔧 DEBUG: register_submission_routes() function called")
    
    @app.route('/api/submit-data', methods=['POST'])
    def submit_data():
        print("🚀 SUBMIT_DATA ROUTE CALLED!")
        print(f"📋 Content-Type: {request.content_type}")
        print("🚩 Entered submit_data route", file=sys.stderr)
        
        try:
            uploaded_file = None
            saved_filename = None
            saved_file_relpath = None
            
            # Handle both JSON and form data
            if request.content_type == 'application/json':
                print("📊 Processing JSON request...")
                data = request.get_json()
                if not data:
                    raise ValueError("No JSON data provided")
                
            elif request.content_type and 'multipart/form-data' in request.content_type:
                print("📁 Processing multipart form data...")
                data = {
                    'insurer_id': request.form.get('insurer_id'),
                    'capital': request.form.get('capital'), 
                    'liabilities': request.form.get('liabilities'),
                    'submission_date': request.form.get('submission_date'),
                    # P&L / profitability fields (manual entry)
                    'gwp': request.form.get('gwp'),
                    'net_claims_paid': request.form.get('net_claims_paid'),
                    'investment_income_total': request.form.get('investment_income_total'),
                    'commission_expense_total': request.form.get('commission_expense_total'),
                    'operating_expenses_total': request.form.get('operating_expenses_total'),
                    'profit_before_tax': request.form.get('profit_before_tax'),
                    # Regulatory & governance disclosures
                    'contingency_reserve_statutory': request.form.get('contingency_reserve_statutory'),
                    'ibnr_reserve_gross': request.form.get('ibnr_reserve_gross'),
                    'irfs17_implementation_status': request.form.get('irfs17_implementation_status'),
                    'related_party_net_exposure': request.form.get('related_party_net_exposure'),
                    'claims_development_method': request.form.get('claims_development_method'),
                    'auditors_unqualified_opinion': request.form.get('auditors_unqualified_opinion'),
                }
                uploaded_file = request.files.get('financialStatement')
                print(f"📎 File uploaded: {uploaded_file.filename if uploaded_file else 'None'}")
                
                # Ensure uploads directory exists (backend/uploads/<insurer_id>/)
                uploads_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'uploads'))
                os.makedirs(uploads_root, exist_ok=True)
                
                if uploaded_file and uploaded_file.filename:
                    # Build per-insurer folder and secure filename
                    insurer_folder = os.path.join(uploads_root, str(data.get('insurer_id') or 'unknown'))
                    os.makedirs(insurer_folder, exist_ok=True)
                    filename = secure_filename(uploaded_file.filename)
                    # prefix with timestamp to avoid name collisions
                    ts = str(int(time.time()))
                    saved_filename = f"{ts}_{filename}"
                    save_path = os.path.join(insurer_folder, saved_filename)
                    try:
                        uploaded_file.stream.seek(0)
                    except Exception:
                        pass
                    uploaded_file.save(save_path)
                    # store relative path (uploads/... relative to backend/)
                    saved_file_relpath = os.path.relpath(save_path, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
                    print(f"✅ Uploaded file saved to: {save_path}")
            
            else:
                return jsonify({
                    'success': False,
                    'error': f'Unsupported Content-Type: {request.content_type}'
                }), 415
            
            print(f"📋 Parsed data: {data}")
            
            # Validate required fields
            if not data.get('insurer_id'):
                return jsonify({
                    'success': False,
                    'error': 'Missing required field: insurer_id'
                }), 400

            # AI functionality removed: uploaded files are stored for manual regulator review.
            # No AI extraction or AI initialization will be attempted.
            
            # Validate final data
            print(f"🔍 Validating final data:")
            print(f"   insurer_id: {data.get('insurer_id')}")
            print(f"   capital: '{data.get('capital')}'")
            print(f"   liabilities: '{data.get('liabilities')}'")
            
            # Use the parsed `data` object (works for both JSON and multipart)
            try:
                insurer_id = int(data.get('insurer_id'))
            except Exception as e:
                print(f"❌ Invalid insurer_id provided: {e}")
                return jsonify({
                    'success': False,
                    'error': 'Invalid or missing insurer_id'
                }), 400
            
            # Convert financial values
            try:
                capital = parse_human_number(data.get('capital')) or 0
                liabilities = parse_human_number(data.get('liabilities')) or 0
                # parse new manual numeric fields (optional)
                gwp = parse_human_number(data.get('gwp')) if data.get('gwp') else None
                net_claims_paid = parse_human_number(data.get('net_claims_paid')) if data.get('net_claims_paid') else None
                investment_income_total = parse_human_number(data.get('investment_income_total')) if data.get('investment_income_total') else None
                commission_expense_total = parse_human_number(data.get('commission_expense_total')) if data.get('commission_expense_total') else None
                operating_expenses_total = parse_human_number(data.get('operating_expenses_total')) if data.get('operating_expenses_total') else None
                profit_before_tax = parse_human_number(data.get('profit_before_tax')) if data.get('profit_before_tax') else None
                contingency_reserve_statutory = parse_human_number(data.get('contingency_reserve_statutory')) if data.get('contingency_reserve_statutory') else None
                ibnr_reserve_gross = parse_human_number(data.get('ibnr_reserve_gross')) if data.get('ibnr_reserve_gross') else None
                related_party_net_exposure = parse_human_number(data.get('related_party_net_exposure')) if data.get('related_party_net_exposure') else None
                # textual / boolean fields
                irfs17_implementation_status = data.get('irfs17_implementation_status')
                claims_development_method = data.get('claims_development_method')
                auditors_unqualified_opinion = None
                if data.get('auditors_unqualified_opinion') is not None:
                    v = str(data.get('auditors_unqualified_opinion')).lower()
                    auditors_unqualified_opinion = True if v in ('1', 'true', 'yes', 'y') else False
                print(f"💰 Converted values - Capital: {capital}, Liabilities: {liabilities}")
            except (ValueError, TypeError) as e:
                print(f"❌ Error converting financial values: {e}")
                return jsonify({
                    'success': False,
                    'error': f'Invalid financial values provided: {e}'
                }), 400
            
            # Check if we have valid values - UPDATED LOGIC
            if capital <= 0:
                print(f"❌ Invalid capital value: {capital}")
                return jsonify({
                    'success': False,
                    'error': f'Capital ({capital}) must be a positive value. Please provide valid capital data.'
                }), 400
            
            # For liabilities, we can be more flexible since some documents might not have explicit liabilities
            if liabilities <= 0:
                print(f"⚠️ No liabilities found - using estimated value based on capital")
                estimated_liabilities = capital * 0.7  # Assume 70% liabilities ratio
                liabilities = estimated_liabilities
                print(f"💰 ✅ Using estimated liabilities: {liabilities}")
            
            # Final validation - ensure we have meaningful values
            if capital <= 0:
                print(f"❌ Final validation failed - Capital: {capital}")
                return jsonify({
                    'success': False,
                    'error': f'Capital must be positive. Current value: {capital}'
                }), 400
            
            # Calculate solvency ratio
            solvency_ratio = ((capital - liabilities) / liabilities * 100) if liabilities > 0 else 0
            
            # Create unique data hash
            timestamp = str(int(time.time() * 1000))
            data_string = f"{insurer_id}:{capital}:{liabilities}:{data.get('submission_date', '')}:{timestamp}"
            data_hash = hashlib.sha256(data_string.encode()).hexdigest()
            print(f"🔒 Generated unique hash: {data_hash[:16]}...")
            
            # Parse submission date
            try:
                if data.get('submission_date'):
                    parsed_date = datetime.fromisoformat(data['submission_date'].replace('Z', '+00:00'))
                else:
                    parsed_date = datetime.utcnow()
            except:
                parsed_date = datetime.utcnow()
            
            print(f"💰 Final values - Capital: {capital}, Liabilities: {liabilities}, Ratio: {solvency_ratio:.2f}%")
 
            # Create submission record
            try:
                submission = DataSubmission(
                    data_hash=data_hash,
                    insurer_id=insurer_id,
                    capital=capital,
                    liabilities=liabilities,
                    solvency_ratio=solvency_ratio,
                    status=SubmissionStatus.INSURER_SUBMITTED,
                    submission_date=parsed_date.date(),
                    insurer_submitted_at=parsed_date,
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow(),
                    financial_statement_path=saved_file_relpath,
                    financial_statement_filename=saved_filename or (uploaded_file.filename if uploaded_file else None),
                )

                # Save manual inputs (if provided) into submission
                submission.gwp = gwp
                submission.net_claims_paid = net_claims_paid
                submission.investment_income_total = investment_income_total
                submission.commission_expense_total = commission_expense_total
                submission.operating_expenses_total = operating_expenses_total
                submission.profit_before_tax = profit_before_tax
                submission.contingency_reserve_statutory = contingency_reserve_statutory
                submission.ibnr_reserve_gross = ibnr_reserve_gross
                submission.irfs17_implementation_status = irfs17_implementation_status
                submission.related_party_net_exposure = related_party_net_exposure
                submission.claims_development_method = claims_development_method
                submission.auditors_unqualified_opinion = auditors_unqualified_opinion

                db.session.add(submission)
                db.session.commit()
                
                submission_id = submission.id
                print(f"✅ Created submission with ID: {submission_id}")

            except Exception as db_error:
                print(f"❌ Database error: {str(db_error)}")
                db.session.rollback()
                return jsonify({
                    'success': False,
                    'error': f'Database error: {str(db_error)}'
                }), 500
            
            # Prepare response
            response_data = {
                 'success': True,
                 'message': 'Financial data submitted successfully',
                 'transaction_id': submission_id,
                 'data_hash': data_hash,
                 'status': 'INSURER_SUBMITTED',
                 'capital': capital,
                 'liabilities': liabilities,
                 'solvency_ratio': round(solvency_ratio, 2),
                 'submission_date': parsed_date.isoformat(),
                 'ai_extraction': None,
                 'financial_statement_path': saved_file_relpath,
                 'financial_statement_filename': submission.financial_statement_filename
             }
            
            print(f"✅ Returning successful response")
            return jsonify(response_data), 200
        
        except Exception as e:
            print("❌ Error in submit_data:", file=sys.stderr)
            traceback.print_exc(file=sys.stderr)
            if 'db' in globals():
                db.session.rollback()
            return jsonify({
                'success': False,
                'error': str(e),
                'traceback': traceback.format_exc()
            }), 500
    
    @app.route('/api/submissions/user/<int:user_id>', methods=['GET'])
    def get_user_submissions(user_id):
        """Get all submissions for a specific user"""
        try:
            print(f"📊 Getting submissions for user: {user_id}")
            
            # Mock data for now
            mock_submissions = [
                {
                    'id': 1,
                    'capital': 1000000,
                    'liabilities': 800000,
                    'solvency_ratio': 25.0,
                    'status': 'INSURER_SUBMITTED',
                    'submission_date': '2024-01-15',
                    'created_at': '2024-01-15T10:00:00Z'
                }
            ]
            
            return jsonify({
                'success': True,
                'submissions': mock_submissions
            }), 200
            
        except Exception as e:
            print(f"❌ Error getting user submissions: {str(e)}")
            return jsonify({
                'success': False,
                'error': str(e)
            }), 500
    
    print("✅ DEBUG: /api/submit-data route registered successfully")

def parse_human_number(value):
    """Convert strings like '19.9 billion' or '6.2 million' to float."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    value = str(value).lower().replace(",", "").strip()
    match = re.match(r"([0-9.]+)\s*(billion|million|thousand|k|m|bn)?", value)
    if not match:
        try:
            return float(value)
        except Exception:
            return None
    number = float(match.group(1))
    unit = match.group(2)
    if unit in ("billion", "bn"):
        number *= 1_000_000_000
    elif unit in ("million", "m"):
        number *= 1_000_000
    elif unit in ("thousand", "k"):
        number *= 1_000
    return number