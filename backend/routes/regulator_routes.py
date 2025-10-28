from flask import request, jsonify, send_from_directory, url_for, current_app
from datetime import datetime
from database.db_connection import db
from database.models import DataSubmission, SubmissionStatus, Notification, User
from sqlalchemy import cast, String
import sqlalchemy as sa
import json
import os
import time
from ai_assistant import GPTComplianceAgent
import textwrap
try:
    from reportlab.lib.pagesizes import letter
    from reportlab.pdfgen import canvas
    _HAS_REPORTLAB = True
except Exception:
    _HAS_REPORTLAB = False
    try:
        from fpdf import FPDF
        _HAS_FPDF = True
    except Exception:
        _HAS_FPDF = False

def register_regulator_routes(app):
    """Register all regulator-related routes"""
    
    print("🏛️ Registering regulator routes...")
    
    # Serve uploaded files by submission/insurer path (basic, dev-only)
    uploads_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'uploads'))

    def _get_user_from_auth():
        """Resolve user from Authorization header (Bearer token) or api_key query param.
           Looks up User.api_token first, then falls back to interpreting token as user id.
           Returns User or None.
        """
        auth = request.headers.get('Authorization') or request.args.get('api_key')
        if not auth:
            return None
        token = auth
        if isinstance(auth, str) and auth.lower().startswith('bearer '):
            token = auth.split(None, 1)[1].strip()
        # Try to find user by api_token field
        try:
            user = User.query.filter_by(api_token=token).first()
            if user:
                return user
        except Exception:
            # ignore and try id fallback
            pass
        # Fallback: if token is numeric, try as user id
        try:
            uid = int(token)
            return User.query.get(uid)
        except Exception:
            return None

    @app.route('/api/uploads/<path:filepath>', methods=['GET'])
    def uploaded_file(filepath):
        # Normalize incoming path so it works with windows backslashes and double 'uploads' segments.
        # Accept both "uploads/1/file.pdf" and "uploads\\1\\file.pdf" and also "1/file.pdf"
        try:
            normalized = filepath.replace('\\', '/').lstrip('/')
            if normalized.startswith('uploads/'):
                # route param may include a leading 'uploads' segment from url_for calls -> strip it
                normalized = normalized[len('uploads/'):]
            # Build full path under uploads_root
            full_path = os.path.abspath(os.path.join(uploads_root, normalized))
        except Exception:
            return jsonify({'success': False, 'error': 'invalid filepath'}), 400

        # Security: ensure filepath stays under uploads_root
        if not full_path.startswith(uploads_root):
            return jsonify({'success': False, 'error': 'invalid filepath'}), 400

        # Enforce authentication & simple authorization.
        # Allow local/dev access (when app.debug True or request from localhost) so UI can fetch files without auth during development.
        user = _get_user_from_auth()
        if not user:
            if not (current_app.debug or request.remote_addr in ('127.0.0.1', '::1')):
                return jsonify({'success': False, 'error': 'authentication required'}), 401

        # If user exists, do simple insurer/regulator check (best-effort)
        if user:
            user_role = getattr(user, 'role', None)
            user_id = str(getattr(user, 'id', '')) if getattr(user, 'id', None) is not None else None
            allowed = False
            # Determine insurer_id from path if present
            try:
                parts = normalized.split('/')
                insurer_id_in_path = parts[0] if len(parts) >= 2 else None
            except Exception:
                insurer_id_in_path = None

            if user_role and isinstance(user_role, str) and user_role.lower() in ('regulator', 'admin', 'superuser'):
                allowed = True
            elif insurer_id_in_path and user_id and insurer_id_in_path == user_id:
                allowed = True

            if not allowed:
                return jsonify({'success': False, 'error': 'forbidden'}), 403

        directory = os.path.dirname(full_path)
        filename = os.path.basename(full_path)
        return send_from_directory(directory, filename, as_attachment=True)

    # When serializing pending submissions, include file URL if present
    @app.route('/api/regulator/pending-submissions', methods=['GET'])
    def pending_submissions():
        try:
            # Prefer comparing against the enum's string value to avoid DB type mismatches
            # DataSubmission.status is stored as String in the DB; comparing to an Enum object
            # produced the error "operator does not exist: submissionstatus = character varying".
            # compare using the Enum object (SQLAlchemy maps it to DB enum)
            submissions_query = DataSubmission.query.filter(
                DataSubmission.status == SubmissionStatus.INSURER_SUBMITTED
            ).all()
        except Exception as e:
            # Ensure any partial/failed transaction is rolled back before retrying
            try:
                db.session.rollback()
            except Exception:
                pass

            # Attempt a safe fallback using explicit cast to string in case the DB mapping is unusual
            try:
                submissions_query = DataSubmission.query.filter(
                    cast(DataSubmission.status, String) == SubmissionStatus.INSURER_SUBMITTED.value
                ).all()
            except Exception as inner:
                # Rollback again and return an error response instead of leaving the session aborted
                try:
                    db.session.rollback()
                except Exception:
                    pass
                import traceback; traceback.print_exc()
                return jsonify({'success': False, 'error': f'Failed to query pending submissions: {str(inner)}'}), 500

        # Build response rows (keep original serialization logic)
        try:
            result = []
            for submission in submissions_query:
                ai_data = None
                try:
                    ai_data = json.loads(submission.ai_extraction) if getattr(submission, 'ai_extraction', None) else None
                except Exception:
                    ai_data = submission.ai_extraction

                file_url = None
                try:
                    if getattr(submission, 'financial_statement_path', None):
                        # Normalize to forward slashes and strip any leading 'uploads/' so uploaded_file receives path relative to uploads_root
                        rel_path = submission.financial_statement_path.replace('\\', '/').lstrip('/')
                        if rel_path.startswith('uploads/'):
                            rel_path = rel_path[len('uploads/'):]
                        file_url = url_for('uploaded_file', filepath=rel_path, _external=True)
                    elif getattr(submission, 'financial_statement_filename', None):
                        fallback_path = f"{submission.insurer_id}/{submission.financial_statement_filename}".lstrip('/\\')
                        file_url = url_for('uploaded_file', filepath=fallback_path, _external=True)
                except Exception:
                    # don't fail on URL building issues
                    file_url = None

                row = {
                    'id': submission.id,
                    'insurer_id': submission.insurer_id,
                    'capital': float(submission.capital) if submission.capital is not None else None,
                    'liabilities': float(submission.liabilities) if submission.liabilities is not None else None,
                    'solvency_ratio': float(submission.solvency_ratio) if submission.solvency_ratio is not None else None,
                    'ai_extraction': ai_data,
                    'insurer': {
                        'username': getattr(submission.insurer, 'username', None),
                        'email': getattr(submission.insurer, 'email', None),
                        'business_name': getattr(submission.insurer, 'business_name', getattr(submission.insurer, 'username', '')),
                        'business_email': getattr(submission.insurer, 'business_email', getattr(submission.insurer, 'email', ''))
                    },
                    'car': getattr(submission, 'car', None),
                    'required_capital': getattr(submission, 'required_capital', None),
                    'available_capital': getattr(submission, 'available_capital', None),
                    'asset_adequacy': getattr(submission, 'asset_adequacy', None),
                    'insurance_service_result': getattr(submission, 'insurance_service_result', None),
                    'insurance_revenue_growth': getattr(submission, 'insurance_revenue_growth', None),
                    'insurance_liabilities_adequacy': getattr(submission, 'insurance_liabilities_adequacy', None),
                    'reinsurance_strategy': getattr(submission, 'reinsurance_strategy', None),
                    'claims_development': getattr(submission, 'claims_development', None),
                    'internal_controls': getattr(submission, 'internal_controls', None),
                    'board_structure': getattr(submission, 'board_structure', None),
                    'board_committee_oversight': getattr(submission, 'board_committee_oversight', None),
                    'related_party_transactions': getattr(submission, 'related_party_transactions', None),
                    'investment_policy_submission': getattr(submission, 'investment_policy_submission', None),
                    # Manual / P&L fields
                    'gwp': getattr(submission, 'gwp', None),
                    'net_claims_paid': getattr(submission, 'net_claims_paid', None),
                    'investment_income_total': getattr(submission, 'investment_income_total', None),
                    'commission_expense_total': getattr(submission, 'commission_expense_total', None),
                    'operating_expenses_total': getattr(submission, 'operating_expenses_total', None),
                    'profit_before_tax': getattr(submission, 'profit_before_tax', None),
                    'contingency_reserve_statutory': getattr(submission, 'contingency_reserve_statutory', None),
                    'ibnr_reserve_gross': getattr(submission, 'ibnr_reserve_gross', None),
                    'irfs17_implementation_status': getattr(submission, 'irfs17_implementation_status', None),
                    'related_party_net_exposure': getattr(submission, 'related_party_net_exposure', None),
                    'claims_development_method': getattr(submission, 'claims_development_method', None),
                    'auditors_unqualified_opinion': getattr(submission, 'auditors_unqualified_opinion', None),
                    'financial_statement_url': file_url,
                    'financial_statement_filename': submission.financial_statement_filename
                }
                result.append(row)

            return jsonify({'success': True, 'submissions': result}), 200
        except Exception as e:
            try:
                db.session.rollback()
            except Exception:
                pass
            import traceback; traceback.print_exc()
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/api/regulator/approve-submission', methods=['POST', 'OPTIONS'])
    def regulator_approve_submission():
        # Handle CORS preflight
        if request.method == 'OPTIONS':
            return '', 200
            
        try:
            print("🟢 Regulator APPROVAL request received")
            data = request.get_json()
            print(f"📦 Approval data: {data}")
            
            submission_id = data.get('submission_id')
            regulator_comments = data.get('comments', '')
            
            if not submission_id:
                return jsonify({'success': False, 'error': 'submission_id is required'}), 400
            
            # Find the submission
            submission = DataSubmission.query.get(submission_id)
            if not submission:
                return jsonify({'success': False, 'error': 'Submission not found'}), 404
            
            if submission.status != SubmissionStatus.INSURER_SUBMITTED:
                return jsonify({
                    'success': False, 
                    'error': f'Submission is not in pending status. Current status: {submission.status.value}'
                }), 400
            
            # ✅ CALCULATE SOLVENCY RATIO DURING APPROVAL
            solvency_ratio = (submission.capital / submission.liabilities) * 100 if submission.liabilities > 0 else 0
            
            # Update submission status to APPROVED
            submission.status = SubmissionStatus.REGULATOR_APPROVED
            submission.solvency_ratio = solvency_ratio  # ✅ Calculate ONLY during approval
            submission.regulator_approved_at = datetime.utcnow()
            submission.regulator_comments = regulator_comments
            
            db.session.commit()
            
            print(f"✅ Submission {submission_id} APPROVED with solvency ratio: {solvency_ratio:.2f}%")
            
            return jsonify({
                'success': True,
                'message': 'Submission approved successfully',
                'submission_id': submission_id,
                'status': 'REGULATOR_APPROVED',
                'solvency_ratio': solvency_ratio,
                'approved_at': submission.regulator_approved_at.isoformat()  # ✅ FIXED: Use correct field name
            }), 200
            
        except Exception as e:
            db.session.rollback()
            print(f"❌ Error approving submission: {str(e)}")
            import traceback
            traceback.print_exc()
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/api/regulator/reject-submission', methods=['POST', 'OPTIONS'])
    def regulator_reject_submission():
        # Handle CORS preflight
        if request.method == 'OPTIONS':
            return '', 200
            
        try:
            print("🔴 Regulator REJECTION request received")
            data = request.get_json()
            print(f"📦 Rejection data: {data}")
            
            submission_id = data.get('submission_id')
            regulator_comments = data.get('comments', 'No reason provided')
            
            if not submission_id:
                return jsonify({'success': False, 'error': 'submission_id is required'}), 400
            
            # Find the submission
            submission = DataSubmission.query.get(submission_id)
            if not submission:
                return jsonify({'success': False, 'error': 'Submission not found'}), 404
            
            if submission.status != SubmissionStatus.INSURER_SUBMITTED:
                return jsonify({
                    'success': False,
                    'error': f'Submission is not in pending status. Current status: {submission.status.value}'
                }), 400
            
            # Update submission status to REJECTED
            submission.status = SubmissionStatus.REJECTED
            submission.regulator_rejected_at = datetime.utcnow()  # ✅ Use correct field name
            submission.regulator_comments = regulator_comments
            
            db.session.commit()
            
            print(f"❌ Submission {submission_id} REJECTED by regulator")
            
            return jsonify({
                'success': True,
                'message': 'Submission rejected',
                'submission_id': submission_id,
                'status': 'REJECTED',
                'rejected_at': submission.regulator_rejected_at.isoformat(),  # ✅ Use correct field name
                'comments': regulator_comments
            }), 200
            
        except Exception as e:
            db.session.rollback()
            print(f"❌ Error rejecting submission: {str(e)}")
            import traceback
            traceback.print_exc()
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/api/notifications/regulator/<regulator_id>', methods=['GET'])
    def regulator_get_notifications(regulator_id):
        """Get notifications for a specific regulator"""
        try:
            print(f"📬 Fetching notifications for regulator: {regulator_id}")
            
            # ✅ CONVERT STRING TO INTEGER
            if regulator_id == 'reg-1':
                regulator_id_int = 1
            else:
                try:
                    regulator_id_int = int(regulator_id)
                except ValueError:
                    regulator_id_int = 1
            
            # ✅ SIMPLE QUERY USING ACTUAL TABLE STRUCTURE
            notifications = Notification.query.filter_by(
                recipient_id=regulator_id_int  # This should be the integer user ID
            ).order_by(Notification.sent_at.desc()).all()
            
            notifications_data = []
            for notification in notifications:
                notifications_data.append({
                    'id': notification.id,
                    'message': notification.message,
                    'urgency': notification.urgency,
                    'status': notification.status,
                    'sender_id': notification.sender_id,
                    'created_at': notification.sent_at.isoformat() if notification.sent_at else None
                })
            
            print(f"✅ Found {len(notifications_data)} notifications")
            
            return jsonify({
                'success': True,
                'notifications': notifications_data
            }), 200
            
        except Exception as e:
            print(f"❌ Error fetching notifications: {str(e)}")
            return jsonify({
                'success': True,
                'notifications': []
            }), 200

    @app.route('/api/regulator/upload-and-summarize', methods=['POST'])
    def regulator_upload_and_summarize():
        """
        Regulator uploads a PDF (multipart/form-data: file, optional insurer_id).
        Returns a structured AI summary and a download URL for a JSON summary file.
        """
        try:
            # Simple auth: only regulator/admin or local dev
            user = _get_user_from_auth()
            if not user and not (current_app.debug or request.remote_addr in ('127.0.0.1', '::1')):
                return jsonify({'success': False, 'error': 'authentication required'}), 401
            if user:
                role = getattr(user, 'role', '')
                if isinstance(role, str) and role.lower() not in ('regulator', 'admin', 'superuser'):
                    return jsonify({'success': False, 'error': 'forbidden'}), 403

            uploaded = request.files.get('file')
            if not uploaded:
                return jsonify({'success': False, 'error': 'file is required'}), 400

            insurer_id = request.form.get('insurer_id') or 'unknown'
            filename = uploaded.filename or f'upload-{int(time.time())}.pdf'

            # Save regulator-uploaded file under uploads/regulator_uploads/<insurer_id>/
            dest_dir = os.path.join(uploads_root, 'regulator_uploads', str(insurer_id))
            os.makedirs(dest_dir, exist_ok=True)
            timestamp = int(time.time())
            safe_name = f"{timestamp}_{filename}"
            saved_path = os.path.join(dest_dir, safe_name)
            uploaded.save(saved_path)

            # Read bytes and run GPT agent
            with open(saved_path, 'rb') as fh:
                pdf_bytes = fh.read()

            try:
                agent = GPTComplianceAgent()
                summary = agent.summarize_document(pdf_bytes, document_title=filename)
                summary_dict = {
                    "document_title": summary.document_title,
                    "narrative": summary.narrative,
                    "metrics": summary.metrics,
                    "recommendations": summary.recommendations,
                    "missing_items": summary.missing_items,
                    "confidence": summary.confidence,
                    "raw_chunk_summaries": summary.raw_chunk_summaries
                }
            except Exception as e:
                import traceback; traceback.print_exc()
                return jsonify({'success': False, 'error': f'AI summarization failed: {str(e)}'}), 500

            # Persist summary JSON to uploads_root/summaries/<insurer_id>_<timestamp>_<filename>.json
            summaries_dir = os.path.join(uploads_root, 'summaries', str(insurer_id))
            os.makedirs(summaries_dir, exist_ok=True)
            summary_filename = f"{timestamp}_{os.path.splitext(filename)[0]}.json"
            summary_path = os.path.join(summaries_dir, summary_filename)
            try:
                with open(summary_path, 'w', encoding='utf-8') as sf:
                    json.dump(summary_dict, sf, ensure_ascii=False, indent=2)
            except Exception as e:
                return jsonify({'success': False, 'error': f'Failed to save summary file: {str(e)}'}), 500

            # Generate a simple PDF from the summary JSON so regulator can download a PDF report
            def _save_summary_pdf(summary_obj: dict, out_path: str) -> bool:
                txt = json.dumps(summary_obj, ensure_ascii=False, indent=2)
                try:
                    if _HAS_REPORTLAB:
                        c = canvas.Canvas(out_path, pagesize=letter)
                        width, height = letter
                        title = summary_obj.get("document_title") or "AI Summary"
                        c.setFont("Helvetica-Bold", 14)
                        c.drawString(40, height - 50, title)
                        c.setFont("Helvetica", 9)
                        y = height - 80
                        for line in txt.splitlines():
                            for sub in textwrap.wrap(line, 100):
                                if y < 60:
                                    c.showPage()
                                    y = height - 50
                                    c.setFont("Helvetica", 9)
                                c.drawString(40, y, sub)
                                y -= 12
                        c.save()
                        return True
                    elif _HAS_FPDF:
                        pdf = FPDF()
                        pdf.add_page()
                        pdf.set_auto_page_break(auto=True, margin=15)
                        pdf.set_font("Arial", size=10)
                        pdf.cell(0, 8, txt=str(summary_obj.get("document_title") or "AI Summary"), ln=1)
                        for line in txt.splitlines():
                            for sub in textwrap.wrap(line, 90):
                                pdf.multi_cell(0, 6, sub)
                        pdf.output(out_path)
                        return True
                    else:
                        # no PDF lib; write a plain text file with .pdf extension (best-effort)
                        with open(out_path, 'w', encoding='utf-8') as pf:
                            pf.write(txt)
                        return True
                except Exception:
                    import traceback; traceback.print_exc()
                    return False

            # write PDF next to JSON
            summary_pdf_filename = summary_filename.rsplit('.', 1)[0] + '.pdf'
            summary_pdf_path = os.path.join(summaries_dir, summary_pdf_filename)
            pdf_ok = _save_summary_pdf(summary_dict, summary_pdf_path)
            rel_summary_path = os.path.relpath(summary_path, uploads_root).replace('\\', '/')
            download_url = url_for('uploaded_file', filepath=rel_summary_path, _external=True)
            download_pdf_url = None
            if pdf_ok:
                rel_pdf_path = os.path.relpath(summary_pdf_path, uploads_root).replace('\\', '/')
                download_pdf_url = url_for('uploaded_file', filepath=rel_pdf_path, _external=True)

            # Return summary metadata and download links
            response = {
                'success': True,
                'summary': summary_dict,
                'summary_json_url': download_url,
                'summary_pdf_url': download_pdf_url,
                'summary_filename': summary_filename
            }
            return jsonify(response), 200
        except Exception as e:
            import traceback; traceback.print_exc()
            return jsonify({'success': False, 'error': str(e)}), 500
 
            