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
from sqlalchemy import select  # add near other imports
import sqlalchemy as sa

# NEW: import AI agent
from ai_assistant import GPTComplianceAgent

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
            ai_extraction = None
            ai_agent = None
            ai_metrics = {}

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

                    # NEW: Run AI extraction on the saved PDF
                    try:
                        print("🤖 Running AI extraction on uploaded document...")
                        ai_agent = GPTComplianceAgent()  # lightweight init
                        with open(save_path, "rb") as fh:
                            pdf_bytes = fh.read()
                        summary = ai_agent.summarize_document(pdf_bytes, document_title=filename)
                        # summary.metrics is a dict of canonical keys
                        if isinstance(summary, dict):
                            ai_metrics = summary.get("metrics", {}) or {}
                        else:
                            ai_metrics = getattr(summary, "metrics", {}) or {}
                        ai_extraction = {
                            "metrics": ai_metrics,
                            "raw_chunk_summaries": getattr(summary, "raw_chunk_summaries", None)
                        }
                        print("🤖 AI extraction complete. Keys:", list(ai_metrics.keys()))
                    except Exception as ai_e:
                        print("⚠️ AI extraction failed:", ai_e)
                        ai_extraction = None
                        ai_metrics = {}
                
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
            
            # Convert financial values (manual or AI fill-ins)
            try:
                # Prefer explicit manual values first; otherwise use AI metrics if available
                raw_cap = data.get('capital')
                if raw_cap:
                    capital = parse_human_number(raw_cap) or 0
                else:
                    capital = None
                raw_liab = data.get('liabilities')
                if raw_liab:
                    liabilities = parse_human_number(raw_liab) or 0
                else:
                    liabilities = None

                # If AI metrics present, fill missing values
                if ai_metrics:
                    if (capital is None or capital == 0) and ai_metrics.get('capital') not in (None, 0):
                        capital = float(ai_metrics.get('capital'))
                    if (liabilities is None or liabilities == 0) and ai_metrics.get('liabilities') not in (None, 0):
                        liabilities = float(ai_metrics.get('liabilities'))
                    # other optional fields
                    if ai_metrics.get('gwp') not in (None, '') and not data.get('gwp'):
                        data['gwp'] = ai_metrics.get('gwp')
                    if ai_metrics.get('net_claims_paid') not in (None, '') and not data.get('net_claims_paid'):
                        data['net_claims_paid'] = ai_metrics.get('net_claims_paid')
                    if ai_metrics.get('investment_income_total') not in (None, '') and not data.get('investment_income_total'):
                        data['investment_income_total'] = ai_metrics.get('investment_income_total')
                    if ai_metrics.get('commission_expense_total') not in (None, '') and not data.get('commission_expense_total'):
                        data['commission_expense_total'] = ai_metrics.get('commission_expense_total')
                    if ai_metrics.get('operating_expenses_total') not in (None, '') and not data.get('operating_expenses_total'):
                        data['operating_expenses_total'] = ai_metrics.get('operating_expenses_total')
                    if ai_metrics.get('profit_before_tax') not in (None, '') and not data.get('profit_before_tax'):
                        data['profit_before_tax'] = ai_metrics.get('profit_before_tax')
                    if ai_metrics.get('contingency_reserve_statutory') not in (None, '') and not data.get('contingency_reserve_statutory'):
                        data['contingency_reserve_statutory'] = ai_metrics.get('contingency_reserve_statutory')
                    if ai_metrics.get('ibnr_reserve_gross') not in (None, '') and not data.get('ibnr_reserve_gross'):
                        data['ibnr_reserve_gross'] = ai_metrics.get('ibnr_reserve_gross')
                    if ai_metrics.get('related_party_net_exposure') not in (None, '') and not data.get('related_party_net_exposure'):
                        data['related_party_net_exposure'] = ai_metrics.get('related_party_net_exposure')
                    if ai_metrics.get('auditors_unqualified_opinion') is not None and data.get('auditors_unqualified_opinion') in (None, ''):
                        data['auditors_unqualified_opinion'] = ai_metrics.get('auditors_unqualified_opinion')

                # final fallback: ensure numeric defaults
                capital = float(capital) if capital not in (None, '') else 0
                liabilities = float(liabilities) if liabilities not in (None, '') else 0

                # parse new numeric fields (manual or AI-supplied)
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

                # Attach AI metadata if available
                if ai_extraction is not None:
                    submission.ai_extraction = ai_extraction.get('metrics') if isinstance(ai_extraction, dict) else None
                    submission.ai_extraction_raw = json.dumps(ai_extraction.get('raw_chunk_summaries')) if isinstance(ai_extraction, dict) and ai_extraction.get('raw_chunk_summaries') else None
                    submission.ai_model = getattr(ai_agent, 'model_name', None) or None
                    submission.ai_used = True if ai_extraction else False
                    submission.ai_extracted_at = datetime.utcnow()

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
                 'ai_extraction': ai_extraction,
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

            # Use a column-level select to avoid ORM Enum coercion on load
            tbl = DataSubmission.__table__
            # build column list defensively so missing DB columns don't raise KeyError
            cols = [
                tbl.c.id,
                tbl.c.capital,
                tbl.c.liabilities,
                tbl.c.solvency_ratio,
                # cast status to plain text to avoid SQLAlchemy Enum coercion/validation
                sa.cast(tbl.c.status, sa.String).label('status'),
                tbl.c.submission_date,
                tbl.c.created_at,
                tbl.c.financial_statement_filename,
            ]

            optional_cols = ['regulator_approved_at', 'regulator_rejected_at', 'regulator_comments', 'ai_extraction']
            tbl_keys = set(tbl.c.keys())
            for oc in optional_cols:
                if oc in tbl_keys:
                    cols.append(tbl.c[oc])

            stmt = select(*cols).where(tbl.c.insurer_id == user_id).order_by(tbl.c.created_at.desc())

            res = db.session.execute(stmt).all()
            out = []
            for row in res:
                # row is a sqlalchemy.engine.Row; access by column name
                status_raw = row.status
                # Normalize status to canonical frontend-friendly string used by UI
                # Accept DB enum labels like 'REJECTED' / 'APPROVED' and map them to the frontend constants.
                try:
                    if status_raw is None:
                        status_str = None
                    else:
                        sr = str(status_raw).strip()
                        up = sr.upper()
                        # direct canonical forms (pass-through)
                        if up in ("REGULATOR_REJECTED", "REGULATOR_APPROVED", "INSURER_SUBMITTED", "INSURER_SUB"):
                            # normalize slight variants
                            if up == "INSURER_SUB":
                                status_str = "INSURER_SUBMITTED"
                            else:
                                status_str = up
                        else:
                            # map common DB labels/legacy values to canonical frontend names
                            if "REJECT" in up:
                                status_str = "REGULATOR_REJECTED"
                            elif "APPROVE" in up or "APPROVED" in up:
                                status_str = "REGULATOR_APPROVED"
                            elif "INSURER" in up or "SUBMIT" in up:
                                status_str = "INSURER_SUBMITTED"
                            else:
                                # fallback to the raw string
                                status_str = up
                except Exception:
                    status_str = str(status_raw)

                # normalize ai_extraction (may be JSON string or JSON/JSONB type)
                ai_payload = None
                try:
                    raw_ai = row.ai_extraction
                    if isinstance(raw_ai, (dict, list)):
                        ai_payload = raw_ai
                    elif isinstance(raw_ai, str) and raw_ai.strip():
                        ai_payload = json.loads(raw_ai)
                    else:
                        ai_payload = raw_ai
                except Exception:
                    ai_payload = row.ai_extraction

                out.append({
                    'id': int(row.id) if row.id is not None else None,
                    'capital': float(row.capital) if row.capital is not None else None,
                    'liabilities': float(row.liabilities) if row.liabilities is not None else None,
                    'solvency_ratio': float(row.solvency_ratio) if row.solvency_ratio is not None else None,
                    'status': status_str,
                    'submission_date': row.submission_date.isoformat() if getattr(row, 'submission_date', None) else (row.created_at.isoformat() if getattr(row, 'created_at', None) else None),
                    'created_at': row.created_at.isoformat() if getattr(row, 'created_at', None) else None,
                    'financial_statement_filename': row.financial_statement_filename,
                    'regulator_approved_at': row.regulator_approved_at.isoformat() if getattr(row, 'regulator_approved_at', None) else None,
                    'regulator_rejected_at': row.regulator_rejected_at.isoformat() if getattr(row, 'regulator_rejected_at', None) else None,
                    'regulator_comments': row.regulator_comments,
                    'ai_extraction': ai_payload
                })

            # DEBUG: summary of serialized results to help diagnose missing rejections in the insurer UI
            try:
                print(f"📣 Serialized {len(out)} submissions for user {user_id}")
                stats = {}
                rejected_list = []
                for s in out:
                    st = s.get('status') or 'UNKNOWN'
                    stats[st] = stats.get(st, 0) + 1
                    if 'REJECT' in (st or '').upper():
                        rejected_list.append({
                            'id': s.get('id'),
                            'regulator_rejected_at': s.get('regulator_rejected_at'),
                            'regulator_comments': s.get('regulator_comments')
                        })
                print("📊 Status counts:", stats)
                if rejected_list:
                    print("🛑 Rejected submissions present:", rejected_list)
                else:
                    print("ℹ️ No rejected submissions found in query results")
            except Exception as dbg_e:
                print("⚠️ Debug logging failed while summarizing submissions:", dbg_e)
 
            return jsonify({'success': True, 'submissions': out}), 200
             
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