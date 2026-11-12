
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from pydantic import BaseModel, EmailStr
from typing import Optional

from bson import ObjectId
from pymongo.errors import DuplicateKeyError

from datetime import datetime, timezone, date, timedelta

import hashlib
import secrets

from jose import jwt, JWTError

from database import (
    users_collection,
    jobs_collection,
    applications_collection,
    check_database_connection
)


# =========================================
# JWT AUTHENTICATION CONFIGURATION
# =========================================

SECRET_KEY = "campusconnect_change_this_to_a_long_random_secret_key"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

security = HTTPBearer()


def create_access_token(data: dict):
    to_encode = data.copy()

    expire = datetime.now(timezone.utc) + timedelta(
        minutes=ACCESS_TOKEN_EXPIRE_MINUTES
    )

    to_encode.update({"exp": expire})

    return jwt.encode(
        to_encode,
        SECRET_KEY,
        algorithm=ALGORITHM
    )


# =========================================
# AUTHENTICATION
# =========================================

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    token = credentials.credentials

    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        user_id = payload.get("sub")

        if user_id is None or not ObjectId.is_valid(user_id):
            raise HTTPException(
                status_code=401,
                detail="Invalid authentication token."
            )

    except JWTError:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired authentication token."
        )

    user = users_collection.find_one({
        "_id": ObjectId(user_id)
    })

    if not user:
        raise HTTPException(
            status_code=401,
            detail="User account not found."
        )

    return {
        "user_id": str(user["_id"]),
        "name": user.get("full_name"),
        "email": user.get("email"),
        "role": user.get("role"),
        "department": user.get("department"),
        "graduation_year": user.get("graduation_year")
    }


def require_role(user: dict, allowed_roles: list):
    if user["role"] not in allowed_roles:
        raise HTTPException(
            status_code=403,
            detail="You are not authorized to access this resource."
        )

    return user


def verify_owner(current_user: dict, requested_id: str):
    if current_user["user_id"] != str(requested_id):
        raise HTTPException(
            status_code=403,
            detail="You are not authorized to access this account."
        )


# =========================================
# APPLICATION CONFIGURATION
# =========================================

app = FastAPI(
    title="Intelligent Campus Placement Portal",
    description="A centralized platform for campus recruitment and placement management.",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================
# HELPER FUNCTIONS
# =========================================

def hash_password(password: str):
    salt = secrets.token_hex(16)

    hashed = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode(),
        salt.encode(),
        100000
    ).hex()

    return f"{salt}${hashed}"


def verify_password(password: str, stored_password: str):
    try:
        salt, hashed = stored_password.split("$")

        new_hash = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode(),
            salt.encode(),
            100000
        ).hex()

        return secrets.compare_digest(new_hash, hashed)

    except ValueError:
        return False


def find_by_id(collection, record_id):
    if not ObjectId.is_valid(str(record_id)):
        return None

    return collection.find_one({
        "_id": ObjectId(str(record_id))
    })


def get_recruiter(recruiter_id: str):
    recruiter = find_by_id(users_collection, recruiter_id)

    if not recruiter or recruiter.get("role") != "recruiter":
        raise HTTPException(
            status_code=404,
            detail="Recruiter not found."
        )

    return recruiter


def get_application_date(application):
    applied_at = application.get("applied_at")

    if applied_at:
        return applied_at.isoformat()

    return application["_id"].generation_time.isoformat()


def get_job_recruiter_id(job):
    recruiter_id = job.get("recruiter_id")

    if isinstance(recruiter_id, ObjectId):
        return str(recruiter_id)

    return str(recruiter_id) if recruiter_id else None


def get_job_id_query(job_id: str):
    if not ObjectId.is_valid(job_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid job ID."
        )

    return {
        "_id": ObjectId(job_id)
    }


def get_application_id_query(application_id: str):
    if not ObjectId.is_valid(application_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid application ID."
        )

    return {
        "_id": ObjectId(application_id)
    }


def serialize_job(job):
    recruiter_id = get_job_recruiter_id(job)

    return {
        "id": str(job["_id"]),
        "company": job.get("company_name", job.get("company", "")),
        "title": job.get("job_title", job.get("title", "")),
        "company_name": job.get("company_name", job.get("company", "")),
        "job_title": job.get("job_title", job.get("title", "")),
        "description": job.get("description", ""),
        "minimum_cgpa": job.get("minimum_cgpa", 0.0),
        "department": job.get("eligible_department", job.get("department")),
        "eligible_department": job.get("eligible_department", job.get("department")),
        "skills": job.get("required_skills", job.get("skills", "")),
        "required_skills": job.get("required_skills", job.get("skills", "")),
        "salary": job.get("salary_package", job.get("salary", "")),
        "salary_package": job.get("salary_package", job.get("salary", "")),
        "graduation_year": job.get(
            "eligible_graduation_year",
            job.get("graduation_year")
        ),
        "eligible_graduation_year": job.get(
            "eligible_graduation_year",
            job.get("graduation_year")
        ),
        "location": job.get("job_location", job.get("location", "")),
        "job_location": job.get("job_location", job.get("location", "")),
        "application_deadline": job.get("application_deadline"),
        "recruiter_id": recruiter_id,
        "created_at": (
            job["created_at"].isoformat()
            if isinstance(job.get("created_at"), datetime)
            else job.get("created_at")
        )
    }


def serialize_application(application):
    student_id = application.get("student_id")
    job_id = application.get("job_id")

    student = find_by_id(users_collection, student_id)
    job = find_by_id(jobs_collection, job_id)

    return {
        "id": str(application["_id"]),
        "application_id": str(application["_id"]),
        "student_id": str(student_id),
        "student_name": (
            student.get("full_name", "")
            if student else application.get("student_name", "")
        ),
        "student_email": (
            student.get("email", "")
            if student else application.get("student_email", "")
        ),
        "department": (
            student.get("department")
            if student else application.get("department")
        ),
        "graduation_year": (
            student.get("graduation_year")
            if student else application.get("graduation_year")
        ),
        "job_id": str(job_id),
        "company": (
            job.get("company_name", job.get("company", ""))
            if job else application.get("company", "")
        ),
        "title": (
            job.get("job_title", job.get("title", ""))
            if job else application.get("title", "")
        ),
        "cgpa": application.get("cgpa"),
        "status": application.get("status", "Applied"),
        "applied_at": get_application_date(application)
    }


def validate_job_values(values: dict):
    if "minimum_cgpa" in values:
        cgpa = values["minimum_cgpa"]

        if cgpa is not None and not 0 <= cgpa <= 10:
            raise HTTPException(
                status_code=400,
                detail="Minimum CGPA must be between 0 and 10."
            )

    if "eligible_graduation_year" in values:
        year = values["eligible_graduation_year"]

        if year is not None and not 2020 <= year <= 2040:
            raise HTTPException(
                status_code=400,
                detail="Invalid eligible graduation year."
            )

    if values.get("application_deadline"):
        try:
            deadline = date.fromisoformat(
                values["application_deadline"]
            )
        except (ValueError, TypeError):
            raise HTTPException(
                status_code=400,
                detail="Invalid application deadline. Use YYYY-MM-DD."
            )

        if deadline < datetime.now(timezone.utc).date():
            raise HTTPException(
                status_code=400,
                detail="Application deadline cannot be in the past."
            )


def get_recruiter_jobs(recruiter_id: str):
    return list(jobs_collection.find({
        "recruiter_id": ObjectId(recruiter_id)
    }))


# =========================================
# REQUEST MODELS
# =========================================

class UserCreate(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    role: str
    department: Optional[str] = None
    graduation_year: Optional[int] = None


class JobCreate(BaseModel):
    company_name: str
    job_title: str
    description: str
    minimum_cgpa: float = 0.0
    eligible_department: Optional[str] = None
    required_skills: Optional[str] = None
    salary_package: Optional[str] = None
    eligible_graduation_year: Optional[int] = None
    job_location: Optional[str] = None
    application_deadline: Optional[str] = None
    recruiter_id: str


class JobUpdate(BaseModel):
    company_name: Optional[str] = None
    job_title: Optional[str] = None
    description: Optional[str] = None
    minimum_cgpa: Optional[float] = None
    eligible_department: Optional[str] = None
    required_skills: Optional[str] = None
    salary_package: Optional[str] = None
    eligible_graduation_year: Optional[int] = None
    job_location: Optional[str] = None
    application_deadline: Optional[str] = None


class ApplicationCreate(BaseModel):
    student_id: str
    job_id: str
    cgpa: float


class ApplicationStatusUpdate(BaseModel):
    status: str


# =========================================
# HOME AND HEALTH CHECK
# =========================================

@app.get("/")
def home():
    return {
        "message": "Welcome to Intelligent Campus Placement Portal",
        "status": "Running",
        "version": "2.0.0"
    }


@app.get("/health")
def health_check():
    try:
        check_database_connection()

        return {
            "status": "healthy",
            "database": "connected"
        }

    except Exception:
        raise HTTPException(
            status_code=503,
            detail="Database connection failed"
        )


# =========================================
# USER REGISTRATION
# =========================================

@app.post("/register")
def register_user(user: UserCreate):

    if user.role not in ["student", "recruiter"]:
        raise HTTPException(
            status_code=400,
            detail="Public registration is available only for students and recruiters."
        )

    if not user.full_name.strip() or len(user.password) < 8:
        raise HTTPException(
            status_code=400,
            detail="Enter a name and a password containing at least 8 characters."
        )

    if user.role == "student":
        if not user.department or user.graduation_year is None:
            raise HTTPException(
                status_code=400,
                detail="Students must provide their department and graduation year."
            )

    existing_user = users_collection.find_one({
        "email": str(user.email).lower()
    })

    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Email already registered."
        )

    new_user = {
        "full_name": user.full_name.strip(),
        "email": str(user.email).lower(),
        "password": hash_password(user.password),
        "role": user.role,
        "department": user.department,
        "graduation_year": user.graduation_year
    }

    try:
        result = users_collection.insert_one(new_user)

    except DuplicateKeyError:
        raise HTTPException(
            status_code=400,
            detail="Email already registered."
        )

    return {
        "message": "Registration successful",
        "user_id": str(result.inserted_id),
        "name": user.full_name,
        "email": str(user.email).lower(),
        "role": user.role
    }


# =========================================
# USER LOGIN
# =========================================

@app.post("/login")
def login_user(email: EmailStr, password: str):

    user = users_collection.find_one({
        "email": str(email).lower()
    })

    if not user or not verify_password(
        password,
        user["password"]
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password."
        )

    access_token = create_access_token({
        "sub": str(user["_id"])
    })

    return {
        "message": "Login successful",
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": str(user["_id"]),
        "name": user["full_name"],
        "email": user["email"],
        "role": user["role"],
        "department": user.get("department"),
        "graduation_year": user.get("graduation_year")
    }


# =========================================
# LOGGED-IN USER PROFILE
# =========================================

@app.get("/auth/me")
def get_logged_in_user(
    current_user: dict = Depends(get_current_user)
):
    return {
        "message": "Authentication successful",
        "user": current_user
    }


# =========================================
# STUDENT'S OWN PROFILE
# =========================================

@app.get("/students/me")
def get_student_profile(
    current_user: dict = Depends(get_current_user)
):
    require_role(current_user, ["student"])

    return {
        "id": current_user["user_id"],
        "name": current_user["name"],
        "email": current_user["email"],
        "role": current_user["role"],
        "department": current_user["department"],
        "graduation_year": current_user["graduation_year"]
    }


# =========================================
# VIEW ALL USERS - ADMIN ONLY
# =========================================

@app.get("/users")
def get_users(
    current_user: dict = Depends(get_current_user)
):
    require_role(current_user, ["admin"])

    users = users_collection.find()

    return [
        {
            "id": str(user["_id"]),
            "name": user["full_name"],
            "email": user["email"],
            "role": user["role"],
            "department": user.get("department"),
            "graduation_year": user.get("graduation_year")
        }
        for user in users
    ]


# =========================================
# CREATE JOB - RECRUITER ONLY
# =========================================

@app.post("/jobs")
def create_job(
    job: JobCreate,
    current_user: dict = Depends(get_current_user)
):
    require_role(current_user, ["recruiter"])

    verify_owner(current_user, job.recruiter_id)
    get_recruiter(current_user["user_id"])

    validate_job_values({
        "minimum_cgpa": job.minimum_cgpa,
        "eligible_graduation_year": job.eligible_graduation_year,
        "application_deadline": job.application_deadline
    })

    if not job.company_name.strip() or not job.job_title.strip():
        raise HTTPException(
            status_code=400,
            detail="Company name and job title are required."
        )

    new_job = job.model_dump()

    # Always use the authenticated recruiter's ID.
    new_job["recruiter_id"] = ObjectId(current_user["user_id"])
    new_job["created_at"] = datetime.now(timezone.utc)

    result = jobs_collection.insert_one(new_job)

    return {
        "message": "Job posted successfully",
        "job_id": str(result.inserted_id)
    }


# =========================================
# VIEW ALL JOBS - PUBLIC
# =========================================

@app.get("/jobs")
def get_all_jobs():
    jobs = jobs_collection.find().sort("created_at", -1)

    return [
        serialize_job(job)
        for job in jobs
    ]


# =========================================
# UPDATE JOB - RECRUITER ONLY
# =========================================

@app.put("/jobs/{job_id}")
def update_job(
    job_id: str,
    job_update: JobUpdate,
    current_user: dict = Depends(get_current_user)
):
    require_role(current_user, ["recruiter"])

    existing_job = jobs_collection.find_one(
        get_job_id_query(job_id)
    )

    if not existing_job:
        raise HTTPException(
            status_code=404,
            detail="Job not found."
        )

    if get_job_recruiter_id(existing_job) != current_user["user_id"]:
        raise HTTPException(
            status_code=403,
            detail="You can update only your own job postings."
        )

    update_data = job_update.model_dump(exclude_unset=True)

    if not update_data:
        raise HTTPException(
            status_code=400,
            detail="No job details were provided for update."
        )

    for field in ["company_name", "job_title", "description"]:
        if field in update_data:
            value = update_data[field]

            if value is None or not value.strip():
                raise HTTPException(
                    status_code=400,
                    detail=f"{field} cannot be empty."
                )

    validate_job_values(update_data)

    jobs_collection.update_one(
        {"_id": ObjectId(job_id)},
        {"$set": update_data}
    )

    updated_job = jobs_collection.find_one({
        "_id": ObjectId(job_id)
    })

    return {
        "message": "Job updated successfully",
        "job": serialize_job(updated_job)
    }


# =========================================
# DELETE JOB - RECRUITER ONLY
# =========================================

@app.delete("/jobs/{job_id}")
def delete_job(
    job_id: str,
    current_user: dict = Depends(get_current_user)
):
    require_role(current_user, ["recruiter"])

    existing_job = jobs_collection.find_one(
        get_job_id_query(job_id)
    )

    if not existing_job:
        raise HTTPException(
            status_code=404,
            detail="Job not found."
        )

    if get_job_recruiter_id(existing_job) != current_user["user_id"]:
        raise HTTPException(
            status_code=403,
            detail="You can delete only your own job postings."
        )

    application_exists = applications_collection.find_one({
        "job_id": ObjectId(job_id)
    })

    if application_exists:
        raise HTTPException(
            status_code=400,
            detail="This job cannot be deleted because applications already exist."
        )

    jobs_collection.delete_one({
        "_id": ObjectId(job_id)
    })

    return {
        "message": "Job deleted successfully",
        "job_id": job_id
    }


# =========================================
# RECRUITER DASHBOARD
# =========================================

@app.get("/recruiters/{recruiter_id}/dashboard")
def recruiter_dashboard(
    recruiter_id: str,
    current_user: dict = Depends(get_current_user)
):
    require_role(current_user, ["recruiter"])
    verify_owner(current_user, recruiter_id)

    recruiter_jobs = get_recruiter_jobs(recruiter_id)

    job_ids = [job["_id"] for job in recruiter_jobs]

    applications = list(
        applications_collection.find({
            "job_id": {"$in": job_ids}
        })
    )

    return {
        "total_jobs": len(recruiter_jobs),
        "total_applications": len(applications),
        "shortlisted": sum(
            1 for application in applications
            if application.get("status") == "Shortlisted"
        ),
        "selected": sum(
            1 for application in applications
            if application.get("status") == "Selected"
        )
    }


# =========================================
# VIEW RECRUITER'S JOBS
# =========================================

@app.get("/recruiters/{recruiter_id}/jobs")
def get_recruiter_job_list(
    recruiter_id: str,
    current_user: dict = Depends(get_current_user)
):
    require_role(current_user, ["recruiter"])
    verify_owner(current_user, recruiter_id)

    jobs = jobs_collection.find({
        "recruiter_id": ObjectId(recruiter_id)
    }).sort("created_at", -1)

    return [
        serialize_job(job)
        for job in jobs
    ]


# =========================================
# VIEW RECRUITER'S APPLICANTS
# =========================================

@app.get("/recruiters/{recruiter_id}/applicants")
def get_recruiter_applicants(
    recruiter_id: str,
    current_user: dict = Depends(get_current_user)
):
    require_role(current_user, ["recruiter"])
    verify_owner(current_user, recruiter_id)

    recruiter_jobs = get_recruiter_jobs(recruiter_id)

    job_ids = [job["_id"] for job in recruiter_jobs]

    applications = applications_collection.find({
        "job_id": {"$in": job_ids}
    }).sort("applied_at", -1)

    return [
        serialize_application(application)
        for application in applications
    ]


# =========================================
# APPLY FOR JOB - STUDENT ONLY
# =========================================

@app.post("/applications")
def apply_for_job(
    application: ApplicationCreate,
    current_user: dict = Depends(get_current_user)
):
    require_role(current_user, ["student"])

    verify_owner(current_user, application.student_id)

    if not ObjectId.is_valid(application.student_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid student ID."
        )

    if not ObjectId.is_valid(application.job_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid job ID."
        )

    if not 0 <= application.cgpa <= 10:
        raise HTTPException(
            status_code=400,
            detail="CGPA must be between 0 and 10."
        )

    student_id = ObjectId(current_user["user_id"])
    job_id = ObjectId(application.job_id)

    student = users_collection.find_one({
        "_id": student_id
    })

    job = jobs_collection.find_one({
        "_id": job_id
    })

    if not job:
        raise HTTPException(
            status_code=404,
            detail="Job not found."
        )

    if job.get("application_deadline"):
        try:
            deadline = date.fromisoformat(
                job["application_deadline"]
            )
        except (ValueError, TypeError):
            raise HTTPException(
                status_code=400,
                detail="The job has an invalid application deadline."
            )

        if deadline < datetime.now(timezone.utc).date():
            raise HTTPException(
                status_code=400,
                detail="The application deadline has passed."
            )

    minimum_cgpa = job.get("minimum_cgpa", 0)

    if application.cgpa < minimum_cgpa:
        raise HTTPException(
            status_code=400,
            detail="Your CGPA does not meet the minimum requirement."
        )

    eligible_department = job.get(
        "eligible_department",
        job.get("department")
    )

    if eligible_department:
        if eligible_department.lower() != (
            student.get("department") or ""
        ).lower():
            raise HTTPException(
                status_code=400,
                detail="Your department is not eligible for this job."
            )

    eligible_year = job.get(
        "eligible_graduation_year",
        job.get("graduation_year")
    )

    if eligible_year is not None:
        if student.get("graduation_year") != eligible_year:
            raise HTTPException(
                status_code=400,
                detail="Your graduation year is not eligible for this job."
            )

    existing_application = applications_collection.find_one({
        "student_id": student_id,
        "job_id": job_id
    })

    if existing_application:
        raise HTTPException(
            status_code=400,
            detail="You have already applied for this job."
        )

    new_application = {
        "student_id": student_id,
        "job_id": job_id,
        "cgpa": application.cgpa,
        "status": "Applied",
        "applied_at": datetime.now(timezone.utc)
    }

    try:
        result = applications_collection.insert_one(
            new_application
        )

    except DuplicateKeyError:
        raise HTTPException(
            status_code=400,
            detail="You have already applied for this job."
        )

    return {
        "message": "Application submitted successfully",
        "application_id": str(result.inserted_id),
        "status": "Applied"
    }


# =========================================
# VIEW STUDENT'S APPLICATIONS
# =========================================

@app.get("/students/{student_id}/applications")
def get_student_applications(
    student_id: str,
    current_user: dict = Depends(get_current_user)
):
    require_role(current_user, ["student"])
    verify_owner(current_user, student_id)

    if not ObjectId.is_valid(student_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid student ID."
        )

    applications = applications_collection.find({
        "student_id": ObjectId(student_id)
    }).sort("applied_at", -1)

    return [
        serialize_application(application)
        for application in applications
    ]


# =========================================
# VIEW ALL APPLICATIONS - ADMIN ONLY
# =========================================

@app.get("/applications")
def get_all_applications(
    current_user: dict = Depends(get_current_user)
):
    require_role(current_user, ["admin"])

    applications = applications_collection.find().sort(
        "applied_at",
        -1
    )

    return [
        serialize_application(application)
        for application in applications
    ]


# =========================================
# UPDATE APPLICATION STATUS - RECRUITER ONLY
# =========================================

@app.put("/applications/{application_id}/status")
def update_application_status(
    application_id: str,
    status_update: ApplicationStatusUpdate,
    current_user: dict = Depends(get_current_user)
):
    require_role(current_user, ["recruiter"])

    allowed_statuses = [
        "Applied",
        "Shortlisted",
        "Selected",
        "Rejected"
    ]

    if status_update.status not in allowed_statuses:
        raise HTTPException(
            status_code=400,
            detail="Invalid status. Choose Applied, Shortlisted, Selected or Rejected."
        )

    application = applications_collection.find_one(
        get_application_id_query(application_id)
    )

    if not application:
        raise HTTPException(
            status_code=404,
            detail="Application not found."
        )

    job = find_by_id(
        jobs_collection,
        application.get("job_id")
    )

    if not job:
        raise HTTPException(
            status_code=404,
            detail="The job associated with this application was not found."
        )

    if get_job_recruiter_id(job) != current_user["user_id"]:
        raise HTTPException(
            status_code=403,
            detail="You can update applications only for your own job postings."
        )

    applications_collection.update_one(
        {"_id": ObjectId(application_id)},
        {
            "$set": {
                "status": status_update.status,
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )

    return {
        "message": "Application status updated successfully",
        "application_id": application_id,
        "status": status_update.status
    }


# =========================================
# ADMIN DASHBOARD - ADMIN ONLY
# =========================================

@app.get("/admin/dashboard")
def admin_dashboard(
    current_user: dict = Depends(get_current_user)
):
    require_role(current_user, ["admin"])

    total_users = users_collection.count_documents({})
    total_students = users_collection.count_documents({
        "role": "student"
    })
    total_recruiters = users_collection.count_documents({
        "role": "recruiter"
    })

    total_jobs = jobs_collection.count_documents({})
    total_applications = applications_collection.count_documents({})

    shortlisted = applications_collection.count_documents({
        "status": "Shortlisted"
    })

    selected = applications_collection.count_documents({
        "status": "Selected"
    })

    return {
        "total_users": total_users,
        "total_students": total_students,
        "total_recruiters": total_recruiters,
        "total_jobs": total_jobs,
        "total_applications": total_applications,
        "shortlisted": shortlisted,
        "selected": selected
    }
