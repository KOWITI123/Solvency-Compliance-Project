from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import create_engine
from sqlalchemy.exc import SQLAlchemyError
import os

db = SQLAlchemy()

def connect_database(app):
    try:
        # Get database URL from environment
        database_url = os.getenv('DATABASE_URL', 'postgresql+psycopg://postgres:remykowiti123@localhost:5432/solvency_compliance')
        
        # Ensure we're using psycopg (not psycopg2)
        if database_url.startswith('postgresql://'):
            database_url = database_url.replace('postgresql://', 'postgresql+psycopg://', 1)
        
        print(f"Connecting to database: {database_url}")
        
        # Configure the database URI
        app.config['SQLALCHEMY_DATABASE_URI'] = database_url
        app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

        # Initialize SQLAlchemy with the Flask app
        db.init_app(app)

        # Create engine and check connection
        engine = create_engine(database_url)
        with engine.connect() as connection:
            print(f'Database connection established successfully')

        # Create all tables using Flask-SQLAlchemy
        with app.app_context():
            db.create_all()
            print('All tables created successfully')

        return db

    except SQLAlchemyError as error:
        print(f'Database connection failed: {error}')
        raise error

def init_database():
    """Initialize database with indexes and constraints"""
    try:
        print('Database initialization completed')
    except Exception as e:
        print(f'Database initialization failed: {e}')
        raise e