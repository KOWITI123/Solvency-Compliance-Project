from flask import Flask
from flask_cors import CORS
from database.db_connection import db, connect_database
from routes.submit_data import register_submission_routes
from routes.regulator_routes import register_regulator_routes

app = Flask(__name__)

# CORS configuration
CORS(app, 
     origins=["http://localhost:3000", "http://localhost:5173"],
     methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
     allow_headers=['Content-Type', 'Authorization'],
     supports_credentials=False)

# Connect database
connect_database(app)

# Import models AFTER database is connected
from database.models import *

# Register routes
register_submission_routes(app)
register_regulator_routes(app)

@app.route('/health', methods=['GET'])
def health_check():
    return {'status': 'healthy', 'message': 'Solvency Compliance API is running'}, 200

@app.route('/debug/routes', methods=['GET'])
def debug_routes():
    """Debug endpoint to see all registered routes"""
    routes = []
    for rule in app.url_map.iter_rules():
        routes.append({
            'endpoint': rule.endpoint,
            'methods': list(rule.methods),
            'path': str(rule)
        })
    return {'routes': routes}, 200

if __name__ == '__main__':
    print("🚀 Starting Solvency Compliance Server...")
    
    # Print all registered routes for debugging
    print("\n📍 Registered Routes:")
    with app.app_context():
        for rule in app.url_map.iter_rules():
            print(f"  {rule.methods} {rule}")
    
    app.run(debug=True, host='0.0.0.0', port=5000)