from flask import request, jsonify, send_from_directory, url_for, current_app
from database.models import db, DataSubmission, SubmissionStatus
from datetime import datetime
import json
# use the project's local database.models import (the correct import is below)
from sqlalchemy import cast, String
import sqlalchemy as sa
from database.models import (
    DataSubmission, SubmissionStatus, Notification, 
    MaterialRisk, StressTest, RiskAppetiteStatement, 
    KeyFunctionHolder, BoardMeeting, InternalControl, ORSAReport,
    RiskType, RiskLevel, StressTestStatus, GovernanceRole
)
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

    def _resolve_submission_status_member(preferred_name: str):
        """Return a SubmissionStatus enum member that best matches preferred_name, or None."""
        if not preferred_name:
            return None

        name_up = preferred_name.strip().upper()

        # 1) direct attribute
        if hasattr(SubmissionStatus, name_up):
            return getattr(SubmissionStatus, name_up)

        # 2) try matching by name or value substring
        try:
            for member in SubmissionStatus:
                try:
                    if name_up == member.name.upper():
                        return member
                    if name_up == str(member.value).upper():
                        return member
                    if name_up in member.name.upper() or name_up in str(member.value).upper():
                        return member
                except Exception:
                    continue
        except Exception:
            pass

        # 3) common legacy mappings
        legacy_map = {
            "REJECTED": ["REJECTED", "REGULATOR_REJECTED", "REGULATOR_REJECT"],
            "APPROVED": ["APPROVED", "REGULATOR_APPROVED", "REGULATOR_APPROVE"],
            "INSURER_SUBMITTED": ["INSURER_SUB", "INSURER_SUBMITTED"]
        }
        for canonical, aliases in legacy_map.items():
            if any(a == name_up or a in name_up for a in aliases):
                if hasattr(SubmissionStatus, canonical):
                    return getattr(SubmissionStatus, canonical)

        # 4) fuzzy fallback: match by keyword contained in enum member name
        try:
            keywords = []
            if "REJECT" in name_up:
                keywords = ["REJECT"]
            elif "APPROVE" in name_up or "APPROVED" in name_up:
                keywords = ["APPROVE"]
            elif "INSURER" in name_up or "SUBMIT" in name_up:
                keywords = ["INSURER", "SUBMIT"]

            if keywords:
                for member in SubmissionStatus:
                    mn = member.name.upper()
                    for kw in keywords:
                        if kw in mn:
                            return member
        except Exception:
            pass

        # 5) no match found
        return None

    def _set_status_and_commit(submission, status_name: str, comment: str | None):
        """Set status (prefer enum member) and commit. Use DB-enum fallback if direct assignment fails."""
        member = _resolve_submission_status_member(status_name)
        if member is None:
            raise RuntimeError(
                f"No matching SubmissionStatus enum member found for requested status '{status_name}'. "
                "Either map to an existing enum member or add the value to the DB enum (migration required). "
                f"Available members: {[m.name for m in SubmissionStatus]}"
            )

        now = datetime.utcnow()
        # First try to assign the python enum member (preferred)
        try:
            submission.status = member
            if member.name.upper().endswith("APPROVED"):
                submission.regulator_approved_at = now
            if member.name.upper().endswith("REJECTED"):
                submission.regulator_rejected_at = now
            submission.regulator_comments = comment
            db.session.add(submission)
            db.session.commit()

            # create a simple Notification for the insurer so their UI can refresh/show the change
            try:
                recipient = getattr(submission, "insurer_id", None)
                if not recipient:
                    # try related object fallback
                    insurer_obj = getattr(submission, "insurer", None)
                    recipient = getattr(insurer_obj, "id", None) if insurer_obj is not None else None

                if recipient:
                    n = Notification()
                    try:
                        n.recipient_id = recipient
                    except Exception:
                        pass
                    try:
                        action = "approved" if member.name.upper().endswith("APPROVED") else "rejected"
                        n.message = f"Your submission {getattr(submission, 'id', '')} was {action} by the regulator."
                    except Exception:
                        n.message = f"Submission {getattr(submission, 'id', '')} status updated"
                    # optional fields (defensive)
                    try: n.sender_id = None
                    except Exception: pass
                    try: n.urgency = "high"
                    except Exception: pass
                    try: n.status = "UNREAD"
                    except Exception: pass
                    try: n.sent_at = now
                    except Exception: pass

                    db.session.add(n)
                    db.session.commit()
            except Exception:
                try:
                    db.session.rollback()
                except Exception:
                    pass

            return
        except Exception as first_err:
            # commit/assignment failed (likely DB enum mismatch). Rollback and try a fallback using existing DB enum labels.
            try:
                db.session.rollback()
            except Exception:
                pass

            labels = _get_db_enum_labels('submissionstatus')
            # pick keyword from requested member
            key = None
            mn = member.name.upper()
            if 'REJECT' in mn:
                key = 'REJECT'
            elif 'APPROVE' in mn:
                key = 'APPROVE'
            elif 'INSURER' in mn or 'SUBMIT' in mn:
                key = 'SUBMIT'

            chosen_label = None
            if key and labels:
                for lab in labels:
                    if key in lab.upper():
                        chosen_label = lab
                        break

            if chosen_label:
                try:
                    # assign existing DB label (string) which Postgres enum accepts
                    submission.status = chosen_label
                    if 'APPROVE' in chosen_label.upper():
                        submission.regulator_approved_at = now
                    if 'REJECT' in chosen_label.upper():
                        submission.regulator_rejected_at = now
                    submission.regulator_comments = comment
                    db.session.add(submission)
                    db.session.commit()
                    current_app.logger.info(f"✅ Fallback: assigned DB enum label '{chosen_label}' for status '{status_name}'")

                    # create notification for insurer (fallback path)
                    try:
                        recipient = getattr(submission, "insurer_id", None)
                        if not recipient:
                            insurer_obj = getattr(submission, "insurer", None)
                            recipient = getattr(insurer_obj, "id", None) if insurer_obj is not None else None

                        if recipient:
                            n = Notification()
                            try: n.recipient_id = recipient
                            except Exception: pass
                            try:
                                action = "approved" if "APPROVE" in chosen_label.upper() else "rejected"
                                n.message = f"Your submission {getattr(submission, 'id', '')} was {action} by the regulator."
                            except Exception:
                                n.message = f"Submission {getattr(submission, 'id', '')} status updated"
                            try: n.sender_id = None
                            except Exception: pass
                            try: n.urgency = "high"
                            except Exception: pass
                            try: n.status = "UNREAD"
                            except Exception: pass
                            try: n.sent_at = now
                            except Exception: pass

                            db.session.add(n)
                            db.session.commit()
                    except Exception:
                        try:
                            db.session.rollback()
                        except Exception:
                            pass

                    return
                except Exception as second_err:
                    try:
                        db.session.rollback()
                    except Exception:
                        pass
                    # Re-raise the original DB error for visibility
                    raise second_err from first_err

            # No usable DB label found or fallback failed — surface clear error
            raise first_err

    @app.route('/api/regulator/approve-submission', methods=['POST'])
    def regulator_approve_submission():
        payload = request.get_json(force=True, silent=True) or {}
        sid = payload.get('submission_id')
        comments = payload.get('comments')
        if not sid:
            return jsonify({'success': False, 'error': 'submission_id required'}), 400

        sub = db.session.get(DataSubmission, sid)
        if not sub:
            return jsonify({'success': False, 'error': 'submission not found'}), 404

        current_app.logger.info("🟢 Regulator APPROVAL request received")
        try:
            _set_status_and_commit(sub, 'REGULATOR_APPROVED', comments)
            current_app.logger.info(f"✅ Submission {sid} APPROVED")
            return jsonify({'success': True, 'submission_id': sid}), 200
        except Exception as e:
            current_app.logger.error("❌ Error approving submission: %s", str(e))
            return jsonify({'success': False, 'error': str(e)}), 500


    @app.route('/api/regulator/reject-submission', methods=['POST'])
    def regulator_reject_submission():
        payload = request.get_json(force=True, silent=True) or {}
        sid = payload.get('submission_id')
        comments = payload.get('comments')
        if not sid:
            return jsonify({'success': False, 'error': 'submission_id required'}), 400

        sub = db.session.get(DataSubmission, sid)
        if not sub:
            return jsonify({'success': False, 'error': 'submission not found'}), 404

        current_app.logger.info("⛔ Regulator REJECTION request received")
        try:
            _set_status_and_commit(sub, 'REGULATOR_REJECTED', comments)
            current_app.logger.info(f"⛔ Submission {sid} REJECTED")
            return jsonify({'success': True, 'submission_id': sid}), 200
        except Exception as e:
            current_app.logger.error("❌ Error rejecting submission: %s", str(e))
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
 
            
    @app.route('/api/regulator/risk-assessments', methods=['GET'])
    def regulator_get_risk_assessments():
        """Get all risk assessments for regulator oversight"""
        try:
            print("📊 Fetching risk assessments for regulator")
            
            # Get all material risks across all insurers
            risk_assessments = MaterialRisk.query.filter(
                MaterialRisk.status == 'ACTIVE'
            ).order_by(MaterialRisk.risk_score.desc()).all()
            
            assessments_data = []
            for risk in risk_assessments:
                assessments_data.append({
                    'id': risk.id,
                    'insurer_id': risk.insurer_id,
                    'risk_type': risk.risk_type.value if hasattr(risk.risk_type, 'value') else str(risk.risk_type),
                    'risk_title': risk.risk_title,
                    'risk_description': risk.risk_description,
                    'probability': risk.probability,
                    'financial_impact': float(risk.financial_impact),
                    'risk_score': float(risk.risk_score),
                    'risk_level': risk.risk_level.value if hasattr(risk.risk_level, 'value') else str(risk.risk_level),
                    'mitigation_measures': risk.mitigation_measures,
                    'risk_owner': risk.risk_owner,
                    'review_date': risk.review_date.isoformat() if risk.review_date else None,
                    'last_reviewed': risk.last_reviewed.isoformat() if risk.last_reviewed else None,
                    'created_at': risk.created_at.isoformat() if risk.created_at else None
                })
            
            return jsonify({
                'success': True,
                'assessments': assessments_data,
                'total_count': len(assessments_data)
            }), 200
            
        except Exception as e:
            print(f"❌ Error fetching risk assessments: {str(e)}")
            return jsonify({
                'success': False,
                'error': str(e),
                'assessments': []
            }), 500

    @app.route('/api/regulator/stress-tests', methods=['GET'])
    def regulator_get_stress_tests():
        """Get all stress tests for regulator oversight"""
        try:
            print("🧪 Fetching stress tests for regulator")
            
            # Get all completed stress tests
            stress_tests = StressTest.query.filter(
                StressTest.status == StressTestStatus.COMPLETED
            ).order_by(StressTest.test_date.desc()).all()
            
            tests_data = []
            for test in stress_tests:
                tests_data.append({
                    'id': test.id,
                    'insurer_id': test.insurer_id,
                    'test_name': test.test_name,
                    'test_description': test.test_description,
                    'base_solvency_ratio': float(test.base_solvency_ratio),
                    'stressed_solvency_ratio': float(test.stressed_solvency_ratio) if test.stressed_solvency_ratio else None,
                    'market_decline_percentage': float(test.market_decline_percentage),
                    'claims_increase_percentage': float(test.claims_increase_percentage),
                    'capital_shortfall': float(test.capital_shortfall),
                    'still_compliant': test.still_compliant,
                    'action_plan': test.action_plan,
                    'test_date': test.test_date.isoformat() if test.test_date else None,
                    'status': test.status.value if hasattr(test.status, 'value') else str(test.status)
                })
            
            return jsonify({
                'success': True,
                'tests': tests_data,
                'total_count': len(tests_data)
            }, 200)
            
        except Exception as e:
            print(f"❌ Error fetching stress tests: {str(e)}")
            return jsonify({
                'success': False,
                'error': str(e),
                'tests': []
            }), 500

    @app.route('/api/regulator/approve-risk/<int:assessment_id>', methods=['POST'])
    def regulator_approve_risk_assessment(assessment_id):
        """Approve a risk assessment"""
        try:
            print(f"✅ Approving risk assessment: {assessment_id}")
            
            risk_assessment = MaterialRisk.query.get(assessment_id)
            if not risk_assessment:
                return jsonify({'success': False, 'error': 'Risk assessment not found'}), 404
            
            # Update the review date
            risk_assessment.last_reviewed = datetime.utcnow()
            
            db.session.commit()
            
            return jsonify({
                'success': True,
                'message': 'Risk assessment approved',
                'assessment_id': assessment_id
            }), 200
            
        except Exception as e:
            db.session.rollback()
            print(f"❌ Error approving risk assessment: {str(e)}")
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/api/regulator/orsa-reports', methods=['GET'])
    def regulator_get_orsa_reports():
        """Get all ORSA reports for regulator review"""
        try:
            print("📋 Fetching ORSA reports for regulator")
            
            orsa_reports = ORSAReport.query.filter(
                ORSAReport.submitted_to_ira == True
            ).order_by(ORSAReport.ira_submission_date.desc()).all()
            
            reports_data = []
            for report in orsa_reports:
                reports_data.append({
                    'id': report.id,
                    'insurer_id': report.insurer_id,
                    'report_year': report.report_year,
                    'total_risks_identified': report.total_risks_identified,
                    'high_critical_risks': report.high_critical_risks,
                    'stress_tests_performed': report.stress_tests_performed,
                    'worst_case_solvency_ratio': float(report.worst_case_solvency_ratio),
                    'capital_adequacy_assessment': report.capital_adequacy_assessment,
                    'board_approved': report.board_approved,
                    'board_approval_date': report.board_approval_date.isoformat() if report.board_approval_date else None,
                    'ira_submission_date': report.ira_submission_date.isoformat() if report.ira_submission_date else None,
                    'ira_reference_number': report.ira_reference_number,
                    'ira_feedback': report.ira_feedback
                })
            
            return jsonify({
                'success': True,
                'reports': reports_data,
                'total_count': len(reports_data)
            }), 200
            
        except Exception as e:
            print(f"❌ Error fetching ORSA reports: {str(e)}")
            return jsonify({
                'success': False,
                'error': str(e),
                'reports': []
            }), 500

    @app.route('/api/regulator/governance-overview', methods=['GET'])
    def regulator_get_governance_overview():
        """Get governance overview across all insurers"""
        try:
            print("🏛️ Fetching governance overview for regulator")
            
            # Get key function holders
            key_persons = KeyFunctionHolder.query.filter(
                KeyFunctionHolder.is_active == True
            ).all()
            
            # Get recent board meetings
            board_meetings = BoardMeeting.query.filter(
                BoardMeeting.meeting_date >= datetime.utcnow().replace(month=1, day=1)  # This year
            ).order_by(BoardMeeting.meeting_date.desc()).all()
            
            governance_data = {
                'key_function_holders': [],
                'board_meetings': [],
                'governance_summary': {
                    'total_insurers_with_complete_governance': 0,
                    'fit_and_proper_compliance_rate': 0,
                    'board_meeting_frequency_compliance': 0
                }
            }
            
            # Process key function holders
            for person in key_persons:
                governance_data['key_function_holders'].append({
                    'id': person.id,
                    'insurer_id': person.insurer_id,
                    'full_name': person.full_name,
                    'position': person.position.value if hasattr(person.position, 'value') else str(person.position),
                    'fit_and_proper_status': person.fit_and_proper_status,
                    'fit_and_proper_date': person.fit_and_proper_date.isoformat() if person.fit_and_proper_date else None,
                    'appointment_date': person.appointment_date.isoformat() if person.appointment_date else None,
                    'next_review_date': person.next_review_date.isoformat() if person.next_review_date else None,
                    'ira_approval_ref': person.ira_approval_ref
                })
            
            # Process board meetings
            for meeting in board_meetings:
                governance_data['board_meetings'].append({
                    'id': meeting.id,
                    'insurer_id': meeting.insurer_id,
                    'meeting_date': meeting.meeting_date.isoformat(),
                    'meeting_type': meeting.meeting_type,
                    'attendees': json.loads(meeting.attendees) if meeting.attendees else [],
                    'risk_topics_discussed': json.loads(meeting.risk_topics_discussed) if meeting.risk_topics_discussed else [],
                    'decisions_approved': json.loads(meeting.decisions_approved) if meeting.decisions_approved else [],
                    'next_meeting_date': meeting.next_meeting_date.isoformat() if meeting.next_meeting_date else None
                })
            
            return jsonify({
                'success': True,
                'governance': governance_data
            }), 200
            
        except Exception as e:
            print(f"❌ Error fetching governance overview: {str(e)}")
            return jsonify({
                'success': False,
                'error': str(e),
                'governance': {}
            }), 500

    @app.route('/api/regulator/risk-dashboard-stats', methods=['GET'])
    def regulator_get_risk_dashboard_stats():
        """Get risk dashboard statistics for regulator overview"""
        try:
            print("📊 Fetching risk dashboard stats")
            
            # Count high-risk insurers (solvency ratio < 100%)
            high_risk_count = DataSubmission.query.filter(
                DataSubmission.status == SubmissionStatus.REGULATOR_APPROVED,
                DataSubmission.solvency_ratio < 100
            ).count()
            
            # Count pending risk assessments
            pending_risk_assessments = MaterialRisk.query.filter(
                MaterialRisk.status == 'ACTIVE',
                MaterialRisk.last_reviewed.is_(None)
            ).count()
            
            # Count stress tests due (older than 12 months)
            from dateutil.relativedelta import relativedelta
            twelve_months_ago = datetime.utcnow() - relativedelta(months=12)
            stress_tests_due = db.session.query(DataSubmission.insurer_id).distinct().filter(
                ~DataSubmission.insurer_id.in_(
                    db.session.query(StressTest.insurer_id).filter(
                        StressTest.test_date >= twelve_months_ago
                    )
                )
            ).count()
            
            # Count ORSA reports pending
            orsa_pending = ORSAReport.query.filter(
                ORSAReport.board_approved == False
            ).count()
            
            stats = {
                'high_risk_insurers': high_risk_count,
                'pending_risk_assessments': pending_risk_assessments,
                'stress_tests_due': stress_tests_due,
                'orsa_reports_pending': orsa_pending,
                'total_active_risks': MaterialRisk.query.filter(MaterialRisk.status == 'ACTIVE').count(),
                'total_completed_stress_tests': StressTest.query.filter(StressTest.status == StressTestStatus.COMPLETED).count()
            }
            
            return jsonify({
                'success': True,
                'stats': stats
            }), 200
            
        except Exception as e:
            print(f"❌ Error fetching risk dashboard stats: {str(e)}")
            return jsonify({
                'success': False,
                'error': str(e),
                'stats': {}
            }), 500

    def _get_db_enum_labels(enum_type_name: str) -> list:
        """Return list of labels for a Postgres enum type (empty list on failure)."""
        try:
            sql = sa.text(
                "SELECT enumlabel FROM pg_enum "
                "JOIN pg_type ON pg_enum.enumtypid = pg_type.oid "
                "WHERE pg_type.typname = :ename ORDER BY pg_enum.enumsortorder"
            )
            rows = db.session.execute(sql, {"ename": enum_type_name}).fetchall()
            return [r[0] for r in rows]
        except Exception:
            try:
                db.session.rollback()
            except Exception:
                pass
            return []

    print("✅ Regulator routes registered successfully")

