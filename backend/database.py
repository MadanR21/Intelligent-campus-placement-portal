
from pymongo import MongoClient

# MongoDB local connection
MONGO_URL = "mongodb://localhost:27017/"

# Connect to MongoDB
client = MongoClient(
    MONGO_URL,
    serverSelectionTimeoutMS=5000
)

# Select project database
database = client["intelligent_campus_placement"]

# Select collections
users_collection = database["users"]
jobs_collection = database["jobs"]
applications_collection = database["applications"]

# Create unique email index
users_collection.create_index("email", unique=True)

# Prevent duplicate applications
applications_collection.create_index(
    [("student_id", 1), ("job_id", 1)],
    unique=True
)

def check_database_connection():
    client.admin.command("ping")
    return True
