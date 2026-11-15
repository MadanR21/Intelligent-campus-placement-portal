
import os
from pymongo import MongoClient, ASCENDING, DESCENDING

# =========================================
# MONGODB CONFIGURATION
# =========================================

MONGO_URL = os.getenv(
    "MONGO_URL",
    "mongodb://localhost:27017/"
)

DATABASE_NAME = "intelligent_campus_placement"

client = MongoClient(
    MONGO_URL,
    serverSelectionTimeoutMS=5000
)

database = client[DATABASE_NAME]


# =========================================
# DATABASE COLLECTIONS
# =========================================

users_collection = database["users"]

jobs_collection = database["jobs"]

applications_collection = database["applications"]

resumes_collection = database["resumes"]

interviews_collection = database["interviews"]

notifications_collection = database["notifications"]


# =========================================
# DATABASE INDEXES
# =========================================

# Prevent duplicate user email addresses
users_collection.create_index(
    [("email", ASCENDING)],
    unique=True
)

# Prevent students from applying to the same job twice
applications_collection.create_index(
    [
        ("student_id", ASCENDING),
        ("job_id", ASCENDING)
    ],
    unique=True
)

# Improve job searching
jobs_collection.create_index(
    [("status", ASCENDING)]
)

jobs_collection.create_index(
    [("created_at", DESCENDING)]
)

# Improve application filtering
applications_collection.create_index(
    [("student_id", ASCENDING)]
)

applications_collection.create_index(
    [("job_id", ASCENDING)]
)

applications_collection.create_index(
    [("status", ASCENDING)]
)

# Resume lookup
resumes_collection.create_index(
    [("student_id", ASCENDING)]
)

# Interview lookup
interviews_collection.create_index(
    [("student_id", ASCENDING)]
)

interviews_collection.create_index(
    [("recruiter_id", ASCENDING)]
)

interviews_collection.create_index(
    [("scheduled_at", ASCENDING)]
)

# Notification lookup
notifications_collection.create_index(
    [
        ("user_id", ASCENDING),
        ("created_at", DESCENDING)
    ]
)


# =========================================
# DATABASE CONNECTION CHECK
# =========================================

def check_database_connection():
    try:
        client.admin.command("ping")
        return True

    except Exception as error:
        print("MongoDB connection failed:", error)
        return False
