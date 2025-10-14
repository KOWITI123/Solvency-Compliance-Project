import openai
import json
import re
import logging
import os
from typing import Dict, Any, Optional, List
from datetime import datetime
import PyPDF2
import io
from dataclasses import dataclass
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class FinancialExtractionResult:
    """Data class to hold extracted financial information"""
    # Pillar 1: Quantitative & Solvency
    available_solvency_margin: Optional[float] = None
    required_solvency_margin: Optional[float] = None
    tier_1_capital: Optional[float] = None
    total_technical_provisions: Optional[float] = None
    unearned_premium_reserves: Optional[float] = None
    outstanding_claims_reserves: Optional[float] = None
    reported_solvency_ratio: Optional[float] = None
    
    # Pillar 2: Risk & Governance
    orsa_report_status: Optional[str] = None
    fit_and_proper_status: Optional[str] = None
    reinsurance_program_status: Optional[str] = None
    
    # Pillar 3: Transparency & Market Conduct
    claims_turnaround_time: Optional[float] = None
    reported_combined_ratio: Optional[float] = None
    complaint_ratio: Optional[float] = None
    compliance_audit_status: Optional[str] = None
    
    # Additional extracted data (for calculations elsewhere)
    earned_premium: Optional[float] = None
    incurred_losses: Optional[float] = None
    operating_expenses: Optional[float] = None
    
    # Extraction metadata
    extraction_confidence: Optional[float] = None
    missing_data_items: List[str] = None
    extraction_notes: List[str] = None

class FinancialStatementAI:
    """AI Agent for extracting financial information from insurance statements"""
    
    def __init__(self, api_key: Optional[str] = None):
        # Get API key from environment if not provided
        if api_key is None:
            api_key = os.getenv('OPENAI_API_KEY')
        
        if not api_key:
            raise ValueError("OpenAI API key not found. Please set OPENAI_API_KEY in your .env file")
        
        self.client = openai.OpenAI(api_key=api_key)
        # Note: GPT-5 isn't available yet, using GPT-4 Turbo
        self.model = "gpt-4-turbo-preview"
        logger.info(f"🤖 Initialized AI Assistant with model: {self.model}")
        
    def extract_text_from_pdf(self, pdf_file) -> str:
        """Extract text content from uploaded PDF file"""
        try:
            if hasattr(pdf_file, 'read'):
                pdf_content = pdf_file.read()
            else:
                pdf_content = pdf_file
                
            pdf_reader = PyPDF2.PdfReader(io.BytesIO(pdf_content))
            text_content = ""
            
            for page_num in range(len(pdf_reader.pages)):
                page = pdf_reader.pages[page_num]
                text_content += page.extract_text() + "\n"
                
            logger.info(f"📄 Extracted {len(text_content)} characters from PDF")
            return text_content
            
        except Exception as e:
            logger.error(f"❌ Error extracting PDF text: {str(e)}")
            return ""
    
    def create_extraction_prompt(self, document_text: str) -> str:
        """Create a comprehensive prompt for GPT to extract financial data"""
        return f"""
You are an expert financial analyst specializing in insurance regulatory compliance. 
Your task is to EXTRACT ONLY the specific information from the financial statement document. 
DO NOT calculate, validate, or derive any values - only extract what is explicitly stated.

DOCUMENT TEXT:
{document_text}

EXTRACTION REQUIREMENTS:

**PILLAR 1: QUANTITATIVE & SOLVENCY DATA**
Extract the following numerical values EXACTLY as reported (in KES or convert to KES if currency is specified):

1. Available Solvency Margin (ASM) / Own Funds - The reported value of assets minus liabilities
2. Required Solvency Margin (RSM) / Solvency Capital Requirement - Minimum required capital as stated
3. Tier 1 Capital - Core capital as reported (common equity, retained earnings)
4. Total Technical Provisions - Total reserves as stated
5. Unearned Premium Reserves - Reserves for future coverage as reported
6. Outstanding Claims Reserves - Reserves for unpaid claims as stated
7. Reported Solvency Ratio - If explicitly stated as a percentage
8. Earned Premium - Premium revenue as reported
9. Incurred Losses - Total claims and claim expenses as stated
10. Operating Expenses - Administrative costs as reported
11. Reported Combined Ratio - If explicitly stated as a percentage

**PILLAR 2: RISK & GOVERNANCE STATUS**
Extract status information EXACTLY as stated:

1. ORSA Report Status - Look for "Own Risk and Solvency Assessment" status mentions
2. Fit & Proper Status - Key personnel compliance declarations
3. Reinsurance Program Status - Reinsurance arrangements status

**PILLAR 3: TRANSPARENCY & MARKET CONDUCT**
Extract EXACTLY as reported:

1. Claims Turnaround Time (TAT) - Average days/time to process claims if stated
2. Complaint Ratio - Customer complaints ratio if reported
3. Compliance Audit Status - Audit results or compliance status

**IMPORTANT EXTRACTION RULES:**
- Extract ONLY values that are explicitly stated in the document
- Do NOT calculate or derive any ratios or percentages
- Do NOT validate consistency between numbers
- If a value is not found, mark as null
- Include the exact terminology used in the document
- Note any currency conversions applied

**OUTPUT FORMAT:**
Respond with a valid JSON object containing ONLY the extracted data:

{{
    "pillar_1": {{
        "available_solvency_margin": <exact_number_or_null>,
        "required_solvency_margin": <exact_number_or_null>,
        "tier_1_capital": <exact_number_or_null>,
        "total_technical_provisions": <exact_number_or_null>,
        "unearned_premium_reserves": <exact_number_or_null>,
        "outstanding_claims_reserves": <exact_number_or_null>,
        "reported_solvency_ratio": <exact_percentage_or_null>,
        "earned_premium": <exact_number_or_null>,
        "incurred_losses": <exact_number_or_null>,
        "operating_expenses": <exact_number_or_null>,
        "reported_combined_ratio": <exact_percentage_or_null>
    }},
    "pillar_2": {{
        "orsa_report_status": "<exact_status_or_null>",
        "fit_and_proper_status": "<exact_status_or_null>",
        "reinsurance_program_status": "<exact_status_or_null>"
    }},
    "pillar_3": {{
        "claims_turnaround_time_days": <exact_number_or_null>,
        "complaint_ratio": <exact_number_or_null>,
        "compliance_audit_status": "<exact_status_or_null>"
    }},
    "extraction_metadata": {{
        "confidence_score": <0-100>,
        "currency_detected": "<currency_code>",
        "period_covered": "<reporting_period_if_found>",
        "extraction_notes": ["<terminology_variations_found>"],
        "missing_data_items": ["<items_not_found_in_document>"]
    }}
}}

Remember: Your role is EXTRACTION ONLY. Do not calculate, validate, or interpret the data.
"""

    def extract_financial_data(self, document_text: str) -> FinancialExtractionResult:
        """Main method to extract financial data using GPT"""
        try:
            logger.info("🤖 Starting AI extraction process...")
            
            # Create extraction prompt
            prompt = self.create_extraction_prompt(document_text)
            
            # Call GPT API
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are a data extraction specialist. Extract ONLY the information explicitly stated in documents. Do not calculate, validate, or derive any values."
                    },
                    {
                        "role": "user", 
                        "content": prompt
                    }
                ],
                temperature=0.1,  # Low temperature for consistency
                max_tokens=2000,
                response_format={"type": "json_object"}
            )
            
            # Parse response
            response_text = response.choices[0].message.content
            logger.info(f"📤 GPT Response: {response_text[:200]}...")
            
            extracted_data = json.loads(response_text)
            
            # Convert to FinancialExtractionResult
            result = self._convert_to_result_object(extracted_data)
            
            logger.info(f"✅ Extraction completed with {result.extraction_confidence}% confidence")
            return result
            
        except json.JSONDecodeError as e:
            logger.error(f"❌ JSON parsing error: {str(e)}")
            return FinancialExtractionResult(missing_data_items=[f"JSON parsing error: {str(e)}"])
            
        except Exception as e:
            logger.error(f"❌ AI extraction error: {str(e)}")
            return FinancialExtractionResult(missing_data_items=[f"AI extraction error: {str(e)}"])
    
    def _convert_to_result_object(self, extracted_data: Dict[str, Any]) -> FinancialExtractionResult:
        """Convert extracted JSON data to FinancialExtractionResult object"""
        try:
            pillar_1 = extracted_data.get('pillar_1', {})
            pillar_2 = extracted_data.get('pillar_2', {})
            pillar_3 = extracted_data.get('pillar_3', {})
            metadata = extracted_data.get('extraction_metadata', {})
            
            return FinancialExtractionResult(
                # Pillar 1 - Extracted values only
                available_solvency_margin=pillar_1.get('available_solvency_margin'),
                required_solvency_margin=pillar_1.get('required_solvency_margin'),
                tier_1_capital=pillar_1.get('tier_1_capital'),
                total_technical_provisions=pillar_1.get('total_technical_provisions'),
                unearned_premium_reserves=pillar_1.get('unearned_premium_reserves'),
                outstanding_claims_reserves=pillar_1.get('outstanding_claims_reserves'),
                reported_solvency_ratio=pillar_1.get('reported_solvency_ratio'),
                
                # Pillar 2 - Status information only
                orsa_report_status=pillar_2.get('orsa_report_status'),
                fit_and_proper_status=pillar_2.get('fit_and_proper_status'),
                reinsurance_program_status=pillar_2.get('reinsurance_program_status'),
                
                # Pillar 3 - Market conduct data only
                claims_turnaround_time=pillar_3.get('claims_turnaround_time_days'),
                reported_combined_ratio=pillar_3.get('reported_combined_ratio'),
                complaint_ratio=pillar_3.get('complaint_ratio'),
                compliance_audit_status=pillar_3.get('compliance_audit_status'),
                
                # Raw data for calculations elsewhere in the system
                earned_premium=pillar_1.get('earned_premium'),
                incurred_losses=pillar_1.get('incurred_losses'),
                operating_expenses=pillar_1.get('operating_expenses'),
                
                # Extraction metadata
                extraction_confidence=metadata.get('confidence_score', 0),
                missing_data_items=metadata.get('missing_data_items', []),
                extraction_notes=metadata.get('extraction_notes', [])
            )
            
        except Exception as e:
            logger.error(f"❌ Error converting extraction data: {str(e)}")
            return FinancialExtractionResult(missing_data_items=[f"Data conversion error: {str(e)}"])
    
    def process_financial_statement(self, pdf_file) -> FinancialExtractionResult:
        """Main public method to process a financial statement PDF"""
        try:
            logger.info("🚀 Starting financial statement processing...")
            
            # Extract text from PDF
            document_text = self.extract_text_from_pdf(pdf_file)
            
            if not document_text.strip():
                return FinancialExtractionResult(missing_data_items=["Could not extract text from PDF"])
            
            # Extract financial data using AI - NO CALCULATIONS OR VALIDATION
            result = self.extract_financial_data(document_text)
            
            logger.info("✅ Financial statement processing completed")
            return result
            
        except Exception as e:
            logger.error(f"❌ Error processing financial statement: {str(e)}")
            return FinancialExtractionResult(missing_data_items=[f"Processing error: {str(e)}"])

# Factory function to create AI assistant instance
def create_ai_assistant(api_key: Optional[str] = None) -> FinancialStatementAI:
    """Create and return a FinancialStatementAI instance"""
    return FinancialStatementAI(api_key)

# Example usage function
def test_ai_extraction():
    """Test function for development purposes"""
    try:
        ai_assistant = create_ai_assistant()
        
        # Test with sample text
        sample_text = """
        Financial Statement Extract:
        Available Own Funds: KES 500,000,000
        Solvency Capital Requirement: KES 400,000,000
        Tier 1 Capital: KES 450,000,000
        Technical Provisions: KES 300,000,000
        Solvency Ratio: 125%
        Claims Processing Time: Average 25 days
        Combined Ratio: 95%
        ORSA Report: Completed and approved by Board
        """
        
        result = ai_assistant.extract_financial_data(sample_text)
        
        print("🧪 Test Results (EXTRACTION ONLY):")
        print(f"Available Solvency Margin: KES {result.available_solvency_margin:,}" if result.available_solvency_margin else "ASM: Not found")
        print(f"Required Solvency Margin: KES {result.required_solvency_margin:,}" if result.required_solvency_margin else "RSM: Not found")
        print(f"Reported Solvency Ratio: {result.reported_solvency_ratio}%" if result.reported_solvency_ratio else "Solvency Ratio: Not reported")
        print(f"Claims TAT: {result.claims_turnaround_time} days" if result.claims_turnaround_time else "Claims TAT: Not found")
        print(f"ORSA Status: {result.orsa_report_status}" if result.orsa_report_status else "ORSA: Not found")
        print(f"Confidence: {result.extraction_confidence}%")
        print(f"Missing Items: {result.missing_data_items}")
        
    except ValueError as e:
        print(f"❌ Configuration Error: {str(e)}")
        print("Please ensure OPENAI_API_KEY is set in your .env file")
    except Exception as e:
        print(f"❌ Test Error: {str(e)}")

if __name__ == "__main__":
    test_ai_extraction()