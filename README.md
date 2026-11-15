
# Intelligent Campus Placement Portal

A web-based campus placement management system that connects students, recruiters, and administrators through a centralized platform.

## 1. Project Overview

The Intelligent Campus Placement Portal simplifies the campus recruitment process by providing separate dashboards and functionalities for students, recruiters, and administrators.

## 2. Main Features

### Student
- Student registration and login
- Student dashboard
- View available job opportunities
- Apply for jobs
- Upload and manage resumes
- Track application status
- View notifications and interview details

### Recruiter
- Recruiter registration and login
- Recruiter dashboard
- Post and manage job opportunities
- View applicants
- View and download student resumes
- Shortlist, reject, and select applicants
- Manage interview details

### Administrator
- Admin login and dashboard
- Manage users
- View and manage job postings
- Edit and delete job postings
- Monitor applications
- View placement statistics

## 3. Technologies Used

| Component | Technology |
|---|---|
| Frontend | HTML, CSS, JavaScript |
| Backend | Python, FastAPI |
| Database | MongoDB |
| Database Management | MongoDB Compass |
| API | REST API |
| Containerization | Docker |
| Container Orchestration | Docker Compose |
| Testing | Pytest |
| Version Control | Git and GitHub |
| CI/CD | GitHub Actions |

## 4. Project Structure

```text
Intelligent-campus-placement-portal/
│
├── backend/
│   ├── main.py
│   ├── database.py
│   ├── features.py
│   ├── email_service.py
│   └── requirements.txt
│
├── frontend/
│   ├── index.html
│   ├── login.html
│   ├── register.html
│   ├── student-dashboard.html
│   ├── recruiter-dashboard.html
│   ├── admin-dashboard.html
│   ├── script.js
│   ├── features-ui.js
│   ├── recruiter-job-edit.js
│   ├── style.css
│   ├── auth.css
│   └── dashboard.css
│
├── tests/
├── .github/
│   └── workflows/
├── Dockerfile
├── docker-compose.yml
├── .dockerignore
├── .gitignore
├── test_main.py
├── test_features.py
└── README.md
```

## 5. Software Requirements

Install the following before running the project:

- Python 3.11 or compatible version
- Docker Desktop with WSL 2
- Git
- Web browser

## 6. Running the Project Using Docker

### Step 1: Clone the repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
cd Intelligent-campus-placement-portal
```

Replace the URL with the actual GitHub repository URL.

### Step 2: Start MongoDB and FastAPI

```bash
docker compose up -d --build
```

### Step 3: Verify containers

```bash
docker compose ps
```

### Step 4: Open the backend

API documentation:

http://127.0.0.1:8002/docs

Health check:

http://127.0.0.1:8002/health

## 7. Running the Frontend

Open another terminal.

Navigate to the frontend directory:

```bash
cd frontend
```

Start the frontend server:

```bash
python -m http.server 5500
```

Open the application:

http://127.0.0.1:5500

The frontend communicates with the backend running on port 8002.

## 8. MongoDB Configuration

The project uses MongoDB with the database name:

```text
intelligent_campus_placement
```

Docker Compose uses a persistent named volume for MongoDB data.

Each team member's local Docker database is separate by default. To share test data, use an agreed, sanitized database backup and restore procedure.

Do not upload real student information, passwords, resumes, or private database backups to a public repository.

## 9. Running Automated Tests

Install the backend dependencies in your Python environment, then run from the project root:

```bash
python -m pip install -r backend/requirements.txt
python -m pytest -v
```

## 10. Stopping Docker Containers

```bash
docker compose down
```

MongoDB data remains in its named volume.

Do not use `docker compose down -v` unless you intentionally want to delete that volume and its database data.

## 11. Team Collaboration

The project can be maintained collaboratively using Git and GitHub.

Suggested responsibilities:

- Member 1: Student module
- Member 2: Recruiter module
- Member 3: Administrator module
- Member 4: Backend and database
- Member 5: Testing, Docker and CI/CD

Use separate Git branches for individual development and merge tested changes into the main branch.

## 12. Project Objective

To develop an intelligent and centralized campus placement platform that improves communication between students, recruiters, and placement administrators while simplifying recruitment activities.
