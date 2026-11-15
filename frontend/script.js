/* =====================================================
   CAREERSPHERE - COMPLETE FRONTEND JAVASCRIPT
   Updated: Admin Edit/Delete Jobs + Resume View/Download
===================================================== */

const API_BASE_URL = "http://127.0.0.1:8002";

/* =====================================================
   1. CENTRAL DASHBOARD ACCESS PROTECTION
===================================================== */

window.campusConnectAccessBlocked = false;

(function enforceDashboardAccess() {

    const currentPage = window.location.pathname
        .split("/")
        .pop()
        .toLowerCase();

    const requiredRoles = {
        "student-dashboard.html": "student",
        "recruiter-dashboard.html": "recruiter",
        "admin-dashboard.html": "admin"
    };

    const dashboardPages = {
        student: "student-dashboard.html",
        recruiter: "recruiter-dashboard.html",
        admin: "admin-dashboard.html"
    };

    const requiredRole = requiredRoles[currentPage];

    if (!requiredRole) return;

    let user = null;

    try {
        user = JSON.parse(
            sessionStorage.getItem("campusconnectUser") || "null"
        );
    } catch (error) {
        console.error("Session reading error:", error);
    }

    const userRole = String(user?.role || "")
        .trim()
        .toLowerCase();

    const userId = user?.user_id || user?.id || user?._id;

    if (user && userId && userRole === requiredRole) {
        return;
    }

    window.campusConnectAccessBlocked = true;

    let destination = "login.html";
    let title = "LOGIN REQUIRED";
    let message = "Please log in to access this dashboard.";

    if (user && userId && dashboardPages[userRole]) {

        title = "ACCESS DENIED!";

        message =
            "You do not have permission to access the " +
            requiredRole.toUpperCase() +
            " dashboard.";

        destination = dashboardPages[userRole];

    } else {

        sessionStorage.removeItem("campusconnectUser");
    }

    document.body.innerHTML = "";

    document.body.style.cssText = `
        margin: 0;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #f1f5f9;
        font-family: Arial, sans-serif;
        padding: 20px;
        box-sizing: border-box;
    `;

    const box = document.createElement("div");

    box.style.cssText = `
        width: 90%;
        max-width: 480px;
        padding: 40px 30px;
        text-align: center;
        background: white;
        border-radius: 16px;
        box-shadow: 0 10px 35px rgba(0,0,0,0.15);
    `;

    const icon = document.createElement("div");
    icon.textContent = "🔒";
    icon.style.cssText = `
        font-size: 55px;
        margin-bottom: 15px;
    `;

    const heading = document.createElement("h1");
    heading.textContent = title;
    heading.style.cssText = `
        color: #dc2626;
        font-size: 30px;
        margin-bottom: 15px;
    `;

    const description = document.createElement("p");
    description.textContent = message;
    description.style.cssText = `
        color: #475569;
        font-size: 16px;
        line-height: 1.6;
    `;

    const redirectMessage = document.createElement("p");
    redirectMessage.textContent =
        "Redirecting you to the correct page in 4 seconds...";
    redirectMessage.style.cssText = `
        color: #2563eb;
        font-weight: bold;
        margin-top: 25px;
    `;

    box.appendChild(icon);
    box.appendChild(heading);
    box.appendChild(description);
    box.appendChild(redirectMessage);

    document.body.appendChild(box);

    window.setTimeout(function () {
        window.location.replace(destination);
    }, 4000);

})();


/* =====================================================
   2. AUTHENTICATED API REQUEST HELPER
===================================================== */

function getCampusConnectUser() {

    try {
        return JSON.parse(
            sessionStorage.getItem("campusconnectUser") || "null"
        );
    } catch (error) {
        console.error("Unable to read user session:", error);
        return null;
    }
}

function getCampusConnectToken(user = getCampusConnectUser()) {

    if (!user) return null;

    return (
        user.access_token ||
        user.token ||
        user.accessToken ||
        user.jwt ||
        null
    );
}

async function apiFetch(url, options = {}) {

    const user = getCampusConnectUser();

    const headers = new Headers(options.headers || {});

    const token = getCampusConnectToken(user);

    if (token) {
        headers.set(
            "Authorization",
            `Bearer ${token}`
        );
    }

    return window.fetch(url, {
        ...options,
        headers: headers
    });
}


/* =====================================================
   3. COMMON LOGOUT FUNCTION
===================================================== */

function campusConnectLogout() {

    sessionStorage.removeItem("campusconnectUser");

    window.location.replace("login.html");
}

document.querySelectorAll("#logoutButton").forEach(function (button) {

    button.addEventListener("click", campusConnectLogout);

});


/* =====================================================
   4. LOGIN FORM
===================================================== */

const loginForm = document.getElementById("loginForm");

if (loginForm) {

    const emailInput = document.getElementById("email");
    const passwordInput = document.getElementById("password");
    const emailError = document.getElementById("emailError");
    const passwordError = document.getElementById("passwordError");
    const loginMessage = document.getElementById("loginMessage");
    const loginButton = document.getElementById("loginButton");
    const loginSpinner = document.getElementById("loginSpinner");
    const rememberMe = document.getElementById("rememberMe");
    const togglePassword = document.getElementById("togglePassword");

    const rememberedEmail = localStorage.getItem(
        "campusconnectRememberedEmail"
    );

    if (rememberedEmail && emailInput && rememberMe) {
        emailInput.value = rememberedEmail;
        rememberMe.checked = true;
    }

    if (togglePassword && passwordInput) {

        togglePassword.addEventListener("click", function () {

            const showing = passwordInput.type === "password";

            passwordInput.type = showing ? "text" : "password";

            togglePassword.textContent = showing ? "Hide" : "Show";

        });
    }

    function displayLoginMessage(message, type) {

        if (!loginMessage) return;

        loginMessage.textContent = message;
        loginMessage.className = "auth-message " + type;
        loginMessage.hidden = false;
    }

    loginForm.addEventListener("submit", async function (event) {

        event.preventDefault();

        if (emailError) emailError.textContent = "";
        if (passwordError) passwordError.textContent = "";
        if (loginMessage) loginMessage.hidden = true;

        const email = emailInput.value.trim();
        const password = passwordInput.value;

        let isValid = true;

        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!email) {

            if (emailError) {
                emailError.textContent =
                    "Please enter your email address.";
            }

            isValid = false;

        } else if (!emailPattern.test(email)) {

            if (emailError) {
                emailError.textContent =
                    "Please enter a valid email address.";
            }

            isValid = false;
        }

        if (!password) {

            if (passwordError) {
                passwordError.textContent =
                    "Please enter your password.";
            }

            isValid = false;
        }

        if (!isValid) return;

        if (loginButton) {
            loginButton.disabled = true;
            loginButton.textContent = "Signing in...";
        }

        if (loginSpinner) loginSpinner.hidden = false;

        try {

            const parameters = new URLSearchParams();

            parameters.append("email", email);
            parameters.append("password", password);

            const response = await apiFetch(
                `${API_BASE_URL}/login?${parameters.toString()}`,
                { method: "POST" }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(
                    result.detail || "Login failed. Check your details."
                );
            }

            const dashboardPages = {
                student: "student-dashboard.html",
                recruiter: "recruiter-dashboard.html",
                admin: "admin-dashboard.html"
            };

            const role = String(result.role || "")
                .trim()
                .toLowerCase();

            const destination = dashboardPages[role];

            if (!(result.user_id || result.id || result._id) || !destination) {
                throw new Error(
                    "Your account information or role is not recognized."
                );
            }

            result.role = role;

            if (rememberMe && rememberMe.checked) {

                localStorage.setItem(
                    "campusconnectRememberedEmail",
                    email
                );

            } else {

                localStorage.removeItem(
                    "campusconnectRememberedEmail"
                );
            }

            sessionStorage.setItem(
                "campusconnectUser",
                JSON.stringify(result)
            );

            displayLoginMessage(
                "Login successful! Opening your dashboard...",
                "success"
            );

            setTimeout(function () {
                window.location.replace(destination);
            }, 800);

        } catch (error) {

            displayLoginMessage(
                error.message || "Unable to connect to the server.",
                "error"
            );

        } finally {

            if (loginButton) {
                loginButton.disabled = false;
                loginButton.textContent = "Sign In";
            }

            if (loginSpinner) loginSpinner.hidden = true;
        }
    });
}


/* =====================================================
   5. HOMEPAGE NAVIGATION
===================================================== */

document.querySelectorAll('a[href^="#"]').forEach(function (link) {

    link.addEventListener("click", function (event) {

        const targetId = link.getAttribute("href");

        if (!targetId || targetId === "#") return;

        const target = document.querySelector(targetId);

        if (target) {

            event.preventDefault();

            target.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        }
    });
});


/* =====================================================
   6. REGISTRATION FORM
===================================================== */

const registerForm = document.getElementById("registerForm");

if (registerForm) {

    const fullNameInput = document.getElementById("fullName");
    const emailInput = document.getElementById("registerEmail");
    const roleInput = document.getElementById("accountRole");
    const departmentInput = document.getElementById("department");
    const graduationYearInput = document.getElementById("graduationYear");
    const passwordInput = document.getElementById("registerPassword");
    const confirmPasswordInput = document.getElementById("confirmPassword");
    const studentDetails = document.getElementById("studentDetails");
    const registerMessage = document.getElementById("registerMessage");
    const registerButton = document.getElementById("registerButton");
    const toggleRegisterPassword =
        document.getElementById("toggleRegisterPassword");

    if (roleInput && studentDetails) {

        roleInput.addEventListener("change", function () {

            studentDetails.hidden = roleInput.value !== "student";

        });
    }

    if (toggleRegisterPassword && passwordInput) {

        toggleRegisterPassword.addEventListener("click", function () {

            const showing = passwordInput.type === "password";

            passwordInput.type = showing ? "text" : "password";

            toggleRegisterPassword.textContent =
                showing ? "Hide" : "Show";

        });
    }

    function displayRegisterMessage(message, type) {

        if (!registerMessage) return;

        registerMessage.textContent = message;
        registerMessage.className = "auth-message " + type;
        registerMessage.hidden = false;
    }

    function setRegistrationError(id, message) {

        const element = document.getElementById(id);

        if (element) element.textContent = message;
    }

    function clearRegistrationErrors() {

        [
            "fullNameError",
            "registerEmailError",
            "accountRoleError",
            "departmentError",
            "graduationYearError",
            "registerPasswordError",
            "confirmPasswordError",
            "termsError"
        ].forEach(function (id) {

            setRegistrationError(id, "");

        });

        if (registerMessage) registerMessage.hidden = true;
    }

    registerForm.addEventListener("submit", async function (event) {

        event.preventDefault();

        clearRegistrationErrors();

        const fullName = fullNameInput.value.trim();
        const email = emailInput.value.trim();
        const role = roleInput.value;

        const department = departmentInput
            ? departmentInput.value
            : "";

        const graduationYear = graduationYearInput
            ? graduationYearInput.value
            : "";

        const password = passwordInput.value;
        const confirmPassword = confirmPasswordInput.value;

        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        let isValid = true;

        if (fullName.length < 3) {

            setRegistrationError(
                "fullNameError",
                "Enter your full name (at least 3 characters)."
            );

            isValid = false;
        }

        if (!emailPattern.test(email)) {

            setRegistrationError(
                "registerEmailError",
                "Enter a valid email address."
            );

            isValid = false;
        }

        if (!["student", "recruiter"].includes(role)) {

            setRegistrationError(
                "accountRoleError",
                "Please select Student or Recruiter."
            );

            isValid = false;
        }

        if (role === "student") {

            if (!department) {

                setRegistrationError(
                    "departmentError",
                    "Please select your department."
                );

                isValid = false;
            }

            if (!graduationYear) {

                setRegistrationError(
                    "graduationYearError",
                    "Please select your graduation year."
                );

                isValid = false;
            }
        }

        if (password.length < 8) {

            setRegistrationError(
                "registerPasswordError",
                "Password must contain at least 8 characters."
            );

            isValid = false;
        }

        if (password !== confirmPassword) {

            setRegistrationError(
                "confirmPasswordError",
                "Passwords do not match."
            );

            isValid = false;
        }

        const agreeTerms = document.getElementById("agreeTerms");

        if (!agreeTerms || !agreeTerms.checked) {

            setRegistrationError(
                "termsError",
                "Please accept the terms and conditions."
            );

            isValid = false;
        }

        if (!isValid) return;

        const registrationData = {
            full_name: fullName,
            email: email,
            password: password,
            role: role,
            department: role === "student" ? department : null,
            graduation_year: role === "student"
                ? Number(graduationYear)
                : null
        };

        if (registerButton) {
            registerButton.disabled = true;
            registerButton.textContent = "Creating Account...";
        }

        try {

            const response = await apiFetch(
                `${API_BASE_URL}/register`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(registrationData)
                }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(
                    result.detail || "Registration failed."
                );
            }

            displayRegisterMessage(
                "Account created successfully! You can now sign in.",
                "success"
            );

            registerForm.reset();

            if (studentDetails) studentDetails.hidden = true;

            setTimeout(function () {
                window.location.replace("login.html");
            }, 1800);

        } catch (error) {

            displayRegisterMessage(
                error.message || "Unable to connect to the server.",
                "error"
            );

        } finally {

            if (registerButton) {
                registerButton.disabled = false;
                registerButton.textContent = "Create Account";
            }
        }
    });
}


/* =====================================================
   7. STUDENT DASHBOARD
===================================================== */

(async function initializeStudentDashboard() {

    if (window.campusConnectAccessBlocked) return;

    const currentPage = window.location.pathname.toLowerCase();

    if (!currentPage.endsWith("student-dashboard.html")) return;

    const jobsContainer = document.getElementById("jobsContainer");

    if (!jobsContainer) return;

    const jobsMessage = document.getElementById("jobsMessage");
    const studentName = document.getElementById("studentName");
    const welcomeName = document.getElementById("welcomeName");

    const totalJobs = document.getElementById("totalJobs");
    const totalApplications = document.getElementById("totalApplications");
    const studentDepartment = document.getElementById("studentDepartment");

    const refreshJobsButton = document.getElementById("refreshJobsButton");

    const applicationsMessage =
        document.getElementById("applicationsMessage");

    const applicationsContainer =
        document.getElementById("applicationsContainer");

    const refreshApplicationsButton =
        document.getElementById("refreshApplicationsButton");

    const pendingApplications =
        document.getElementById("pendingApplications");

    const shortlistedApplications =
        document.getElementById("shortlistedApplications");

    const selectedApplications =
        document.getElementById("selectedApplications");

    const rejectedApplications =
        document.getElementById("rejectedApplications");

    let student = getCampusConnectUser();
    let studentProfileForGuidance = {};

    if (!student || String(student.role).toLowerCase() !== "student") return;

    if (studentName) {
        studentName.textContent = student.name || "Student";
    }

    if (welcomeName) {
        welcomeName.textContent = student.name || "Student";
    }

    function escapeHTML(value) {

        return String(value ?? "").replace(/[&<>"']/g, function (character) {

            return {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#039;"
            }[character];

        });
    }

    function formatApplicationDate(value) {

        if (!value) return "Date unavailable";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "Date unavailable";
        }

        return date.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        });
    }

    async function loadStudentProfile() {

        try {

            const response = await apiFetch(
                `${API_BASE_URL}/students/me`
            );

            if (!response.ok) {
                throw new Error(
                    `Student profile API returned ${response.status}`
                );
            }

            const profile = await response.json();
            studentProfileForGuidance = profile || {};

            if (studentDepartment) {
                studentDepartment.textContent =
                    profile.department || "Not specified";
            }

        } catch (error) {

            console.error("Student profile request failed:", error);

            if (studentDepartment) {
                studentDepartment.textContent = "Unavailable";
            }
        }
    }

    function getJobPublishedDate(job) {
        const raw = job.published_at || job.created_at || job.posted_at || job.createdAt;
        if (!raw) return "Date not provided";
        const date = new Date(raw);
        return Number.isNaN(date.getTime()) ? "Date not provided" : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    }

    function normaliseSkillList(value) {
        if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean);
        return String(value || "").split(/[,;\n]/).map(v => v.trim()).filter(Boolean);
    }

    function buildSkillGuidance(job) {
        const required = normaliseSkillList(job.required_skills || job.skills);
        const studentSkills = normaliseSkillList(
            studentProfileForGuidance.skills || studentProfileForGuidance.technical_skills ||
            studentProfileForGuidance.skill_set || student.skills
        );
        if (!required.length) return '<div class="career-skill-guidance"><strong>Preparation tip:</strong> Review the job description and prepare examples of your strongest technical and communication skills.</div>';
        const hasProfileSkills = studentSkills.length > 0;
        const matched = required.filter(skill => studentSkills.some(own => own.toLowerCase() === skill.toLowerCase()));
        const gaps = hasProfileSkills ? required.filter(skill => !studentSkills.some(own => own.toLowerCase() === skill.toLowerCase())) : required;
        const advice = gaps.length
            ? `Focus your preparation on: ${gaps.join(", ")}. Build a small project and practise explaining it.`
            : "Your listed skills match the required skills. Practise technical questions and prepare project examples.";
        return `<div class="career-skill-guidance"><strong>Career preparation</strong><div class="small">${hasProfileSkills ? `Skill matches: ${matched.length}/${required.length}` : "Add your skills to your profile for a personalised gap check."}</div><div>${escapeHTML(advice)}</div></div>`;
    }

    async function loadJobs() {

        if (jobsMessage) {
            jobsMessage.hidden = false;
            jobsMessage.className = "alert alert-info";
            jobsMessage.textContent =
                "Loading placement opportunities...";
        }

        jobsContainer.innerHTML = "";

        try {

            const response = await apiFetch(
                `${API_BASE_URL}/jobs`
            );

            if (!response.ok) {
                throw new Error(`Jobs API returned ${response.status}`);
            }

            const jobs = await response.json();

            if (!Array.isArray(jobs)) {
                throw new Error("Unexpected response from jobs API.");
            }

            jobs.sort((a, b) => {
                const dateA = new Date(a.published_at || a.created_at || a.posted_at || 0).getTime() || 0;
                const dateB = new Date(b.published_at || b.created_at || b.posted_at || 0).getTime() || 0;
                return dateB - dateA;
            });

            if (totalJobs) {
                totalJobs.textContent = jobs.length;
            }

            if (jobs.length === 0) {

                if (jobsMessage) {
                    jobsMessage.className = "alert alert-warning";
                    jobsMessage.textContent =
                        "No placement opportunities are currently available.";
                }

                return;
            }

            if (jobsMessage) jobsMessage.hidden = true;

            jobs.forEach(function (job) {

                const jobCard = document.createElement("div");

                jobCard.className = "col-lg-4 col-md-6";

                jobCard.innerHTML = `
                    <article class="job-card">

                        <div class="job-company">
                            ${escapeHTML(job.company)}
                        </div>

                        <h3 class="job-title">
                            ${escapeHTML(job.title)}
                        </h3>

                        <p class="job-description">
                            ${escapeHTML(job.description)}
                        </p>

                        <p class="small text-muted job-published-date"><i class="bi bi-calendar3"></i> Published: ${escapeHTML(getJobPublishedDate(job))}</p>

                        ${buildSkillGuidance(job)}

                        <div class="job-details">

                            <span class="job-detail-tag">
                                <i class="bi bi-mortarboard"></i>
                                Minimum CGPA: ${escapeHTML(job.minimum_cgpa)}
                            </span>

                            <span class="job-detail-tag">
                                <i class="bi bi-building"></i>
                                ${escapeHTML(job.department || "All Departments")}
                            </span>

                            <span class="job-detail-tag">
                                <i class="bi bi-currency-rupee"></i>
                                ${escapeHTML(job.salary || "Not disclosed")}
                            </span>

                        </div>

                        <p class="job-skills">
                            <strong>Required Skills:</strong>
                            ${escapeHTML(job.skills || "Not specified")}
                        </p>

                        <button class="btn btn-primary w-100 apply-job-button" type="button">
                            <i class="bi bi-send"></i> Apply Now
                        </button>

                    </article>
                `;

                const applyButton =
                    jobCard.querySelector(".apply-job-button");

                applyButton.addEventListener("click", async function () {

                    const cgpa = prompt(
                        "Enter your current CGPA (out of 10):"
                    );

                    if (cgpa === null) return;

                    const studentCGPA = Number(cgpa);

                    if (
                        cgpa.trim() === "" ||
                        !Number.isFinite(studentCGPA) ||
                        studentCGPA < 0 ||
                        studentCGPA > 10
                    ) {
                        alert(
                            "Please enter a valid CGPA between 0 and 10."
                        );
                        return;
                    }

                    applyButton.disabled = true;
                    applyButton.textContent =
                        "Submitting Application...";

                    try {

                        const response = await apiFetch(
                            `${API_BASE_URL}/applications`,
                            {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json"
                                },
                                body: JSON.stringify({
                                    student_id: student.user_id,
                                    job_id: job.id,
                                    cgpa: studentCGPA
                                })
                            }
                        );

                        const result = await response.json();

                        if (!response.ok) {
                            throw new Error(
                                result.detail ||
                                "Unable to submit application."
                            );
                        }

                        alert("Application submitted successfully!");

                        await loadApplications();

                    } catch (error) {

                        alert(error.message);

                    } finally {

                        applyButton.disabled = false;

                        applyButton.innerHTML =
                            '<i class="bi bi-send"></i> Apply Now';
                    }
                });

                jobsContainer.appendChild(jobCard);
            });

        } catch (error) {

            console.error("Job loading failed:", error);

            if (jobsMessage) {
                jobsMessage.hidden = false;
                jobsMessage.className = "alert alert-danger";
                jobsMessage.textContent =
                    `Unable to load jobs: ${error.message}`;
            }

            if (totalJobs) totalJobs.textContent = "0";
        }
    }

    function updateApplicationStatistics(applications) {

        let pending = 0;
        let shortlisted = 0;
        let selected = 0;
        let rejected = 0;

        applications.forEach(function (application) {

            const status = String(
                application.status || "Pending"
            ).toLowerCase();

            if (status === "pending") pending++;
            else if (status === "shortlisted") shortlisted++;
            else if (status === "selected") selected++;
            else if (status === "rejected") rejected++;
        });

        if (pendingApplications) {
            pendingApplications.textContent = pending;
        }

        if (shortlistedApplications) {
            shortlistedApplications.textContent = shortlisted;
        }

        if (selectedApplications) {
            selectedApplications.textContent = selected;
        }

        if (rejectedApplications) {
            rejectedApplications.textContent = rejected;
        }

        if (totalApplications) {
            totalApplications.textContent = applications.length;
        }
    }

    function createApplicationCard(application) {

        const status = String(application.status || "Pending");

        const normalizedStatus = status.toLowerCase();

        const statusClass = {
            pending: "status-pending",
            shortlisted: "status-shortlisted",
            selected: "status-selected",
            rejected: "status-rejected"
        }[normalizedStatus] || "status-pending";

        const card = document.createElement("article");

        card.className = "application-card";

        card.innerHTML = `
            <div class="application-card-header">

                <div>

                    <div class="application-company">
                        <i class="bi bi-building"></i>
                        ${escapeHTML(application.company || "Company not available")}
                    </div>

                    <h3 class="application-title">
                        ${escapeHTML(application.title || "Position not available")}
                    </h3>

                </div>

                <span class="application-status ${statusClass}">
                    ${escapeHTML(status)}
                </span>

            </div>

            <div class="application-details">

                <div class="application-detail">
                    <span class="application-detail-label">
                        <i class="bi bi-calendar3"></i> Date Applied
                    </span>

                    <span class="application-detail-value">
                        ${escapeHTML(formatApplicationDate(application.date_applied))}
                    </span>
                </div>

                <div class="application-detail">
                    <span class="application-detail-label">
                        <i class="bi bi-mortarboard"></i> Your CGPA
                    </span>

                    <span class="application-detail-value">
                        ${escapeHTML(application.cgpa ?? "Not available")}
                    </span>
                </div>

                <div class="application-detail">
                    <span class="application-detail-label">
                        <i class="bi bi-info-circle"></i> Application Status
                    </span>

                    <span class="application-detail-value">
                        ${escapeHTML(status)}
                    </span>
                </div>

            </div>
        `;

        return card;
    }

    async function loadApplications() {

        if (!applicationsContainer || !applicationsMessage) return;

        applicationsMessage.hidden = false;
        applicationsMessage.className = "alert alert-info";
        applicationsMessage.textContent = "Loading your applications...";

        applicationsContainer.innerHTML = "";

        try {

            const response = await apiFetch(
                `${API_BASE_URL}/students/${student.user_id}/applications`
            );

            if (!response.ok) {
                throw new Error(
                    `Applications API returned ${response.status}`
                );
            }

            const applications = await response.json();

            if (!Array.isArray(applications)) {
                throw new Error(
                    "Unexpected response from applications API."
                );
            }

            updateApplicationStatistics(applications);

            if (applications.length === 0) {

                applicationsMessage.className = "alert alert-warning";

                applicationsMessage.textContent =
                    "You have not applied for any placement opportunities yet.";

                return;
            }

            applicationsMessage.hidden = true;

            applications.forEach(function (application) {

                applicationsContainer.appendChild(
                    createApplicationCard(application)
                );

            });

        } catch (error) {

            console.error("Applications request failed:", error);

            applicationsMessage.hidden = false;
            applicationsMessage.className = "alert alert-danger";

            applicationsMessage.textContent =
                `Unable to load applications: ${error.message}`;
        }
    }

    if (refreshJobsButton) {
        refreshJobsButton.addEventListener("click", loadJobs);
    }

    if (refreshApplicationsButton) {
        refreshApplicationsButton.addEventListener(
            "click",
            loadApplications
        );
    }

    await Promise.all([
        loadStudentProfile(),
        loadJobs(),
        loadApplications()
    ]);

})();


/* =====================================================
   8. RECRUITER DASHBOARD
===================================================== */

(async function initializeRecruiterDashboard() {

    if (window.campusConnectAccessBlocked) return;

    const currentPage = window.location.pathname.toLowerCase();

    if (!currentPage.endsWith("recruiter-dashboard.html")) return;

    const recruiterJobsContainer = document.getElementById(
        "recruiterJobsContainer"
    );

    if (!recruiterJobsContainer) return;

    const recruiterName =
        document.getElementById("recruiterName");

    const welcomeName =
        document.getElementById("welcomeName");

    const totalJobs =
        document.getElementById("recruiterTotalJobs");

    const totalApplicants =
        document.getElementById("recruiterTotalApplicants");

    const totalShortlisted =
        document.getElementById("recruiterTotalShortlisted");

    const totalSelected =
        document.getElementById("recruiterTotalSelected");

    const recruiterJobsMessage =
        document.getElementById("recruiterJobsMessage");

    const applicantsContainer =
        document.getElementById("applicantsContainer");

    const applicantsMessage =
        document.getElementById("applicantsMessage");

    const refreshJobsButton =
        document.getElementById("refreshRecruiterJobsButton");

    let recruiter = getCampusConnectUser();

    if (!recruiter || String(recruiter.role).toLowerCase() !== "recruiter") return;

    const recruiterId =
        recruiter.user_id || recruiter.id || recruiter._id;

    if (!recruiterId) return;

    if (recruiterName) {
        recruiterName.textContent = recruiter.name || "Recruiter";
    }

    if (welcomeName) {
        welcomeName.textContent = recruiter.name || "Recruiter";
    }

    function escapeRecruiterHTML(value) {

        return String(value ?? "").replace(/[&<>"']/g, function (character) {

            return {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#039;"
            }[character];

        });
    }

    function formatRecruiterDate(value) {

        if (!value) return "Date unavailable";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "Date unavailable";
        }

        return date.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        });
    }

    async function loadRecruiterStatistics() {

        try {

            const response = await apiFetch(
                `${API_BASE_URL}/recruiters/${recruiterId}/dashboard`
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(
                    result.detail ||
                    "Unable to load recruiter statistics."
                );
            }

            if (totalJobs) {
                totalJobs.textContent = result.total_jobs ?? 0;
            }

            if (totalApplicants) {
                totalApplicants.textContent =
                    result.total_applications ?? 0;
            }

            if (totalShortlisted) {
                totalShortlisted.textContent =
                    result.shortlisted ?? 0;
            }

            if (totalSelected) {
                totalSelected.textContent =
                    result.selected ?? 0;
            }

        } catch (error) {

            console.error("Recruiter statistics error:", error);
        }
    }

    async function loadRecruiterJobs() {

        if (recruiterJobsMessage) {
            recruiterJobsMessage.hidden = false;
            recruiterJobsMessage.className = "alert alert-info";
            recruiterJobsMessage.textContent =
                "Loading your job postings...";
        }

        recruiterJobsContainer.innerHTML = "";

        try {

            const response = await apiFetch(
                `${API_BASE_URL}/recruiters/${recruiterId}/jobs`
            );

            const jobs = await response.json();

            if (!response.ok) {
                throw new Error(
                    jobs.detail ||
                    "Unable to load your job postings."
                );
            }

            if (!Array.isArray(jobs)) {
                throw new Error("Unexpected response from jobs API.");
            }

            if (jobs.length === 0) {

                if (recruiterJobsMessage) {
                    recruiterJobsMessage.hidden = false;
                    recruiterJobsMessage.className =
                        "alert alert-warning";

                    recruiterJobsMessage.textContent =
                        "You have not posted any jobs yet.";
                }

                return;
            }

            if (recruiterJobsMessage) {
                recruiterJobsMessage.hidden = true;
            }

            jobs.forEach(function (job) {

                const jobCard = document.createElement("article");

                jobCard.className = "recruiter-job-card";

                jobCard.innerHTML = `
                    <div class="recruiter-job-company">
                        <i class="bi bi-building"></i>
                        ${escapeRecruiterHTML(job.company)}
                    </div>

                    <h3 class="recruiter-job-title">
                        ${escapeRecruiterHTML(job.title)}
                    </h3>

                    <p class="recruiter-job-description">
                        ${escapeRecruiterHTML(job.description)}
                    </p>

                    <div class="recruiter-job-meta">

                        <span>
                            <i class="bi bi-mortarboard"></i>
                            Minimum CGPA:
                            ${escapeRecruiterHTML(job.minimum_cgpa)}
                        </span>

                        <span>
                            <i class="bi bi-people"></i>
                            Applicants:
                            ${escapeRecruiterHTML(job.applicant_count)}
                        </span>

                        <span>
                            <i class="bi bi-building"></i>
                            ${escapeRecruiterHTML(job.department || "All Departments")}
                        </span>

                        <span>
                            <i class="bi bi-currency-rupee"></i>
                            ${escapeRecruiterHTML(job.salary || "Not disclosed")}
                        </span>

                    </div>

                    <div class="recruiter-job-actions">

                        <button type="button" class="btn btn-primary view-job-applicants">
                            <i class="bi bi-people"></i> View Applicants
                        </button>

                    </div>
                `;

                const viewButton =
                    jobCard.querySelector(".view-job-applicants");

                viewButton.addEventListener("click", function () {

                    if (!applicantsContainer) return;

                    const cards = applicantsContainer.querySelectorAll(
                        ".applicant-card"
                    );

                    let matches = 0;

                    cards.forEach(function (card) {

                        const isMatch =
                            card.dataset.jobId === String(job.id);

                        card.hidden = !isMatch;

                        if (isMatch) matches++;
                    });

                    if (applicantsMessage) {

                        applicantsMessage.hidden = matches > 0;

                        if (matches === 0) {
                            applicantsMessage.className =
                                "alert alert-warning";

                            applicantsMessage.textContent =
                                "No applicants have applied for this job yet.";
                        }
                    }

                    const section =
                        document.getElementById("applicantsSection");

                    if (section) {
                        section.scrollIntoView({
                            behavior: "smooth",
                            block: "start"
                        });
                    }
                });

                recruiterJobsContainer.appendChild(jobCard);
            });

        } catch (error) {

            console.error("Recruiter jobs loading error:", error);

            if (recruiterJobsMessage) {
                recruiterJobsMessage.hidden = false;
                recruiterJobsMessage.className = "alert alert-danger";

                recruiterJobsMessage.textContent =
                    `Unable to load jobs: ${error.message}`;
            }
        }
    }


    /* =================================================
       8A. RECRUITER VIEW AND DOWNLOAD STUDENT RESUME
    ================================================= */

    async function handleApplicantResume(
        applicationId,
        action,
        button
    ) {

        if (!applicationId) {
            alert("Application ID is missing. Cannot access resume.");
            return;
        }

        const originalHTML = button.innerHTML;

        button.disabled = true;
        button.textContent =
            action === "view" ? "Opening..." : "Downloading...";

        let previewWindow = null;

        try {

            if (action === "view") {
                previewWindow = window.open("about:blank", "_blank");

                if (!previewWindow) {
                    throw new Error(
                        "Your browser blocked the new tab. Please allow pop-ups and try again."
                    );
                }

                previewWindow.document.write(
                    "<p style='font-family:Arial;padding:20px'>Loading resume...</p>"
                );
            }

            const response = await apiFetch(
                `${API_BASE_URL}/recruiter/applications/${encodeURIComponent(applicationId)}/resume`
            );

            if (!response.ok) {

                let errorMessage = "Unable to access the resume.";

                try {

                    const errorData = await response.json();

                    errorMessage =
                        errorData.detail || errorMessage;

                } catch (error) {
                    // Keep the default error message.
                }

                throw new Error(errorMessage);
            }

            const blob = await response.blob();

            if (!blob || blob.size === 0) {
                throw new Error("The resume file is empty.");
            }

            const fileURL = URL.createObjectURL(blob);

            if (action === "view") {

                previewWindow.location.href = fileURL;

                setTimeout(function () {
                    URL.revokeObjectURL(fileURL);
                }, 60000);

            } else {

                const downloadLink = document.createElement("a");

                downloadLink.href = fileURL;

                downloadLink.download =
                    "student-resume-" + applicationId;

                document.body.appendChild(downloadLink);

                downloadLink.click();

                downloadLink.remove();

                setTimeout(function () {
                    URL.revokeObjectURL(fileURL);
                }, 10000);
            }

        } catch (error) {

            console.error("Resume access error:", error);

            if (previewWindow && !previewWindow.closed) {
                previewWindow.close();
            }

            alert(error.message || "Unable to access student resume.");

        } finally {

            button.disabled = false;
            button.innerHTML = originalHTML;
        }
    }


    /* =================================================
       8B. UPDATE APPLICANT STATUS
    ================================================= */

    async function updateApplicantStatus(
        applicationId,
        status,
        button
    ) {

        if (
            !confirm(
                `Are you sure you want to mark this application as ${status}?`
            )
        ) {
            return;
        }

        button.disabled = true;
        button.textContent = "Updating...";

        try {

            const parameters = new URLSearchParams();

            parameters.append("status", status);
            parameters.append("recruiter_id", recruiterId);

            const response = await apiFetch(
                `${API_BASE_URL}/applications/${applicationId}/status?${parameters.toString()}`,
                { method: "PUT" }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(
                    result.detail ||
                    "Unable to update application status."
                );
            }

            alert(`Application status updated to ${status}.`);

            await Promise.all([
                loadRecruiterStatistics(),
                loadRecruiterApplicants()
            ]);

        } catch (error) {

            alert(error.message);

            button.disabled = false;
            button.textContent = status;
        }
    }


    /* =================================================
       8C. LOAD RECRUITER APPLICANTS
    ================================================= */

    async function loadRecruiterApplicants() {

        if (!applicantsContainer || !applicantsMessage) return;

        applicantsMessage.hidden = false;
        applicantsMessage.className = "alert alert-info";
        applicantsMessage.textContent =
            "Loading applicant information...";

        applicantsContainer.innerHTML = "";

        try {

            const response = await apiFetch(
                `${API_BASE_URL}/recruiters/${recruiterId}/applicants`
            );

            const applicants = await response.json();

            if (!response.ok) {
                throw new Error(
                    applicants.detail ||
                    "Unable to load applicants."
                );
            }

            if (!Array.isArray(applicants)) {
                throw new Error(
                    "Unexpected response from applicants API."
                );
            }

            if (applicants.length === 0) {

                applicantsMessage.hidden = false;
                applicantsMessage.className = "alert alert-warning";

                applicantsMessage.textContent =
                    "No students have applied for your job postings yet.";

                return;
            }

            applicantsMessage.hidden = true;

            applicants.forEach(function (applicant) {

                const status = applicant.status || "Pending";

                const normalizedStatus = status.toLowerCase();

                const statusClass = {
                    pending: "status-pending",
                    shortlisted: "status-shortlisted",
                    selected: "status-selected",
                    rejected: "status-rejected"
                }[normalizedStatus] || "status-pending";

                const applicationId =
                    applicant.application_id || applicant.id;

                const card = document.createElement("article");

                card.className = "applicant-card";

                card.dataset.jobId = String(
                    applicant.job_id ?? ""
                );

                card.innerHTML = `
                    <div class="applicant-card-header">

                        <div>

                            <h3 class="applicant-name">
                                <i class="bi bi-person-circle"></i>
                                ${escapeRecruiterHTML(applicant.student_name)}
                            </h3>

                            <p class="applicant-email">
                                <i class="bi bi-envelope"></i>
                                ${escapeRecruiterHTML(applicant.student_email)}
                            </p>

                        </div>

                        <span class="applicant-status ${statusClass}">
                            ${escapeRecruiterHTML(status)}
                        </span>

                    </div>

                    <div class="applicant-details">

                        <div class="applicant-detail">
                            <span class="applicant-detail-label">Applied For</span>
                            <span class="applicant-detail-value">
                                ${escapeRecruiterHTML(applicant.job_title)}
                            </span>
                        </div>

                        <div class="applicant-detail">
                            <span class="applicant-detail-label">Department</span>
                            <span class="applicant-detail-value">
                                ${escapeRecruiterHTML(applicant.department || "Not specified")}
                            </span>
                        </div>

                        <div class="applicant-detail">
                            <span class="applicant-detail-label">CGPA</span>
                            <span class="applicant-detail-value">
                                ${escapeRecruiterHTML(applicant.cgpa ?? "Not available")}
                            </span>
                        </div>

                        <div class="applicant-detail">
                            <span class="applicant-detail-label">Graduation Year</span>
                            <span class="applicant-detail-value">
                                ${escapeRecruiterHTML(applicant.graduation_year || "Not specified")}
                            </span>
                        </div>

                        <div class="applicant-detail">
                            <span class="applicant-detail-label">Date Applied</span>
                            <span class="applicant-detail-value">
                                ${escapeRecruiterHTML(formatRecruiterDate(applicant.date_applied))}
                            </span>
                        </div>

                        <div class="applicant-detail">
                            <span class="applicant-detail-label">Company</span>
                            <span class="applicant-detail-value">
                                ${escapeRecruiterHTML(applicant.company)}
                            </span>
                        </div>

                    </div>

                    <div class="applicant-resume-actions">

                        <button
                            type="button"
                            class="btn btn-outline-primary view-applicant-resume"
                        >
                            <i class="bi bi-file-earmark-pdf"></i>
                            View Resume
                        </button>

                        <button
                            type="button"
                            class="btn btn-outline-success download-applicant-resume"
                        >
                            <i class="bi bi-download"></i>
                            Download Resume
                        </button>

                    </div>

                    <div class="applicant-actions">

                        <button type="button" class="btn btn-primary shortlist-applicant">
                            <i class="bi bi-check-circle"></i> Shortlist
                        </button>

                        <button type="button" class="btn btn-success select-applicant">
                            <i class="bi bi-award"></i> Select
                        </button>

                        <button type="button" class="btn btn-danger reject-applicant">
                            <i class="bi bi-x-circle"></i> Reject
                        </button>

                    </div>
                `;

                const viewResumeButton =
                    card.querySelector(".view-applicant-resume");

                const downloadResumeButton =
                    card.querySelector(".download-applicant-resume");

                const shortlistButton =
                    card.querySelector(".shortlist-applicant");

                const selectButton =
                    card.querySelector(".select-applicant");

                const rejectButton =
                    card.querySelector(".reject-applicant");

                viewResumeButton.addEventListener("click", function () {

                    handleApplicantResume(
                        applicationId,
                        "view",
                        viewResumeButton
                    );

                });

                downloadResumeButton.addEventListener("click", function () {

                    handleApplicantResume(
                        applicationId,
                        "download",
                        downloadResumeButton
                    );

                });

                shortlistButton.addEventListener("click", function () {

                    updateApplicantStatus(
                        applicationId,
                        "Shortlisted",
                        shortlistButton
                    );

                });

                selectButton.addEventListener("click", function () {

                    updateApplicantStatus(
                        applicationId,
                        "Selected",
                        selectButton
                    );

                });

                rejectButton.addEventListener("click", function () {

                    updateApplicantStatus(
                        applicationId,
                        "Rejected",
                        rejectButton
                    );

                });

                applicantsContainer.appendChild(card);
            });

        } catch (error) {

            console.error("Applicant loading error:", error);

            applicantsMessage.hidden = false;
            applicantsMessage.className = "alert alert-danger";

            applicantsMessage.textContent =
                `Unable to load applicants: ${error.message}`;
        }
    }

    if (refreshJobsButton) {

        refreshJobsButton.addEventListener("click", async function () {

            await Promise.all([
                loadRecruiterStatistics(),
                loadRecruiterJobs(),
                loadRecruiterApplicants()
            ]);

        });
    }

    await Promise.all([
        loadRecruiterStatistics(),
        loadRecruiterJobs(),
        loadRecruiterApplicants()
    ]);

})();


/* =====================================================
   9. RECRUITER JOB POSTING
===================================================== */

(function initializeJobPosting() {

    if (window.campusConnectAccessBlocked) return;

    const postJobForm = document.getElementById("postJobForm");

    if (!postJobForm) return;

    const postJobMessage =
        document.getElementById("postJobMessage");

    const postJobButton =
        document.getElementById("postJobButton");

    let recruiter = getCampusConnectUser();

    function showPostJobMessage(message, type) {

        if (!postJobMessage) return;

        postJobMessage.textContent = message;
        postJobMessage.className = `alert alert-${type}`;
        postJobMessage.classList.remove("d-none");
    }

    function formatJobError(detail) {

        if (Array.isArray(detail)) {

            return detail.map(function (error) {

                const field = Array.isArray(error.loc)
                    ? error.loc.slice(1).join(" → ")
                    : "Field";

                return `${field}: ${error.msg}`;

            }).join(" | ");
        }

        if (typeof detail === "string") return detail;

        return "Unable to publish the job. Check the entered details.";
    }

    postJobForm.addEventListener("submit", async function (event) {

        event.preventDefault();

        const recruiterId =
            recruiter?.user_id || recruiter?.id || recruiter?._id;

        if (
            !recruiter ||
            String(recruiter.role).toLowerCase() !== "recruiter" ||
            !recruiterId
        ) {

            showPostJobMessage(
                "Recruiter session not found. Please log in again.",
                "danger"
            );

            return;
        }

        const value = function (id) {

            const element = document.getElementById(id);

            return element ? element.value.trim() : "";
        };

        const jobData = {

            job_title: value("jobTitle"),

            company_name: value("companyName"),

            description: value("jobDescription"),

            eligible_department: value("jobDepartment"),

            required_skills: value("requiredSkills"),

            minimum_cgpa: Number(value("minimumCgpa")),

            eligible_graduation_year:
                Number(value("graduationYear")),

            job_location: value("jobLocation"),

            salary_package: String(value("salaryPackage")),

            application_deadline: value("applicationDeadline"),

            recruiter_id: recruiterId
        };

        if (
            !jobData.job_title ||
            !jobData.company_name ||
            !jobData.description ||
            !jobData.eligible_department ||
            !jobData.required_skills ||
            !jobData.job_location ||
            !jobData.application_deadline
        ) {

            showPostJobMessage(
                "Please complete all required fields.",
                "warning"
            );

            return;
        }

        if (
            !Number.isFinite(jobData.minimum_cgpa) ||
            jobData.minimum_cgpa < 0 ||
            jobData.minimum_cgpa > 10
        ) {

            showPostJobMessage(
                "Minimum CGPA must be between 0 and 10.",
                "warning"
            );

            return;
        }

        if (
            !Number.isInteger(jobData.eligible_graduation_year) ||
            jobData.eligible_graduation_year < 2020 ||
            jobData.eligible_graduation_year > 2040
        ) {

            showPostJobMessage(
                "Please enter a valid graduation year.",
                "warning"
            );

            return;
        }

        const salary = Number(jobData.salary_package);

        if (!Number.isFinite(salary) || salary <= 0) {

            showPostJobMessage(
                "Please enter a valid salary package greater than zero.",
                "warning"
            );

            return;
        }

        const today = new Date();

        today.setHours(0, 0, 0, 0);

        const deadline = new Date(
            jobData.application_deadline + "T00:00:00"
        );

        if (
            Number.isNaN(deadline.getTime()) ||
            deadline < today
        ) {

            showPostJobMessage(
                "Select a valid application deadline that is today or later.",
                "warning"
            );

            return;
        }

        if (postJobButton) {

            postJobButton.disabled = true;

            postJobButton.innerHTML =
                '<span class="spinner-border spinner-border-sm me-2"></span>Publishing...';
        }

        try {

            const response = await apiFetch(
                `${API_BASE_URL}/jobs`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify(jobData)
                }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(formatJobError(result.detail));
            }

            showPostJobMessage(
                "Job opportunity published successfully!",
                "success"
            );

            postJobForm.reset();

            const refreshButton = document.getElementById(
                "refreshRecruiterJobsButton"
            );

            if (refreshButton) refreshButton.click();

        } catch (error) {

            console.error("Job Posting Error:", error);

            showPostJobMessage(
                error.message ||
                "Something went wrong while publishing the job.",
                "danger"
            );

        } finally {

            if (postJobButton) {

                postJobButton.disabled = false;

                postJobButton.innerHTML =
                    '<i class="bi bi-send-fill"></i> Post Job';
            }
        }
    });

})();


/* =====================================================
   10. ADMIN DASHBOARD STATISTICS
===================================================== */

if (!window.campusConnectAccessBlocked) {

    const adminTotalStudents =
        document.getElementById("adminTotalStudents");

    if (adminTotalStudents) {

        async function loadAdminDashboard() {

            try {

                const response = await apiFetch(
                    `${API_BASE_URL}/admin/dashboard`
                );

                if (!response.ok) {
                    throw new Error(
                        "Unable to load admin dashboard statistics."
                    );
                }

                const data = await response.json();

                const setText = function (id, value) {

                    const element = document.getElementById(id);

                    if (element) {
                        element.textContent = value ?? 0;
                    }
                };

                setText(
                    "adminTotalStudents",
                    data.total_students
                );

                setText(
                    "adminTotalRecruiters",
                    data.total_recruiters
                );

                setText(
                    "adminTotalJobs",
                    data.total_jobs
                );

                setText(
                    "adminTotalApplications",
                    data.total_applications
                );

                const pending = Math.max(
                    0,
                    (data.total_applications ?? 0) -
                    (data.shortlisted ?? 0) -
                    (data.selected ?? 0)
                );

                setText(
                    "adminPendingApplications",
                    pending
                );

                setText(
                    "adminShortlistedApplications",
                    data.shortlisted
                );

                setText(
                    "adminSelectedApplications",
                    data.selected
                );

            } catch (error) {

                console.error("Admin Dashboard Error:", error);
            }
        }

        loadAdminDashboard();
    }
}


/* =====================================================
   11. ADMIN USER MANAGEMENT
===================================================== */

if (!window.campusConnectAccessBlocked) {

    const adminUsersContainer =
        document.getElementById("adminUsersContainer");

    if (adminUsersContainer) {

        const adminUsersMessage =
            document.getElementById("adminUsersMessage");

        function escapeAdminUserHTML(value) {

            return String(value ?? "").replace(/[&<>"']/g, character => ({

                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#039;"

            })[character]);
        }

        async function loadAdminUsers() {

            adminUsersContainer.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center py-4">
                        Loading users...
                    </td>
                </tr>
            `;

            if (adminUsersMessage) {
                adminUsersMessage.textContent = "";
            }

            try {

                const response = await apiFetch(
                    `${API_BASE_URL}/users`
                );

                if (!response.ok) {
                    throw new Error("Unable to retrieve users.");
                }

                const users = await response.json();

                if (!Array.isArray(users) || users.length === 0) {

                    adminUsersContainer.innerHTML = `
                        <tr>
                            <td colspan="5" class="text-center py-4">
                                No registered users found.
                            </td>
                        </tr>
                    `;

                    return;
                }

                adminUsersContainer.innerHTML = users.map(user => `

                    <tr>

                        <td class="fw-semibold">
                            ${escapeAdminUserHTML(user.name || "Not available")}
                        </td>

                        <td>
                            ${escapeAdminUserHTML(user.email || "Not available")}
                        </td>

                        <td>

                            <span class="badge ${
                                user.role === "student"
                                    ? "bg-primary"
                                    : user.role === "recruiter"
                                        ? "bg-success"
                                        : "bg-secondary"
                            }">

                                ${escapeAdminUserHTML(user.role || "Unknown")}

                            </span>

                        </td>

                        <td>
                            ${escapeAdminUserHTML(user.department || "—")}
                        </td>

                        <td>
                            ${escapeAdminUserHTML(user.graduation_year || "—")}
                        </td>

                    </tr>

                `).join("");

                if (adminUsersMessage) {

                    adminUsersMessage.innerHTML = `
                        <div class="text-success small">
                            <i class="bi bi-check-circle-fill me-1"></i>
                            Successfully loaded ${users.length} registered users.
                        </div>
                    `;
                }

            } catch (error) {

                console.error("Admin User Management Error:", error);

                adminUsersContainer.innerHTML = `
                    <tr>
                        <td colspan="5" class="text-center text-danger py-4">
                            Failed to load users. Please try again.
                        </td>
                    </tr>
                `;

                if (adminUsersMessage) {
                    adminUsersMessage.textContent = error.message;
                }
            }
        }

        const refreshUsersButton =
            document.getElementById("refreshUsersButton");

        if (refreshUsersButton) {
            refreshUsersButton.addEventListener(
                "click",
                loadAdminUsers
            );
        }

        loadAdminUsers();
    }
}

/* =====================================================
   12. ADMIN JOB MANAGEMENT
   UPDATED: EDIT AND DELETE JOBS
   Uses the existing adminEditJobModal in admin-dashboard.html
===================================================== */

if (!window.campusConnectAccessBlocked) {

    const adminJobsContainer =
        document.getElementById("adminJobsContainer");

    if (adminJobsContainer) {

        const adminJobsMessage =
            document.getElementById("adminJobsMessage");

        let latestAdminJobs = [];

        /* ---------------------------------------------
           COMMON HELPERS
        --------------------------------------------- */

        function escapeAdminJobHTML(value) {
            return String(value ?? "—").replace(
                /[&<>"']/g,
                character => ({
                    "&": "&amp;",
                    "<": "&lt;",
                    ">": "&gt;",
                    '"': "&quot;",
                    "'": "&#039;"
                })[character]
            );
        }

        function showAdminJobMessage(message, type = "info") {

            if (!adminJobsMessage) return;

            adminJobsMessage.className = `alert alert-${type}`;
            adminJobsMessage.textContent = message;
            adminJobsMessage.hidden = false;
        }

        function clearAdminJobMessage() {

            if (!adminJobsMessage) return;

            adminJobsMessage.textContent = "";
            adminJobsMessage.hidden = true;
        }

        function getAdminJobField(id) {
            return document.getElementById(id);
        }

        function getAdminJobValue(id) {

            const element = getAdminJobField(id);

            return element ? element.value.trim() : "";
        }

        function setAdminJobValue(id, value) {

            const element = getAdminJobField(id);

            if (element) {
                element.value = value ?? "";
            }
        }

        function getJobId(job) {
            return job.id || job._id || job.job_id || "";
        }


        /* ---------------------------------------------
           EXISTING EDIT MODAL
        --------------------------------------------- */

        function getAdminEditModal() {

            return document.getElementById("adminEditJobModal");
        }

        function showAdminEditModal() {

            const modalElement = getAdminEditModal();

            if (!modalElement) {
                alert("Edit Job modal was not found in admin-dashboard.html.");
                return;
            }

            if (window.bootstrap && window.bootstrap.Modal) {

                const modal = window.bootstrap.Modal.getOrCreateInstance(
                    modalElement
                );

                modal.show();

            } else {

                modalElement.style.display = "block";
                modalElement.classList.add("show");
                modalElement.removeAttribute("aria-hidden");
                document.body.classList.add("modal-open");
            }
        }

        function hideAdminEditModal() {

            const modalElement = getAdminEditModal();

            if (!modalElement) return;

            if (window.bootstrap && window.bootstrap.Modal) {

                const modal = window.bootstrap.Modal.getOrCreateInstance(
                    modalElement
                );

                modal.hide();

            } else {

                modalElement.style.display = "none";
                modalElement.classList.remove("show");
                modalElement.setAttribute("aria-hidden", "true");
                document.body.classList.remove("modal-open");
            }
        }


        /* ---------------------------------------------
           OPEN EDIT JOB
        --------------------------------------------- */

        function openAdminJobEditModal(job) {

            const jobId = getJobId(job);

            if (!jobId) {
                alert("Job ID is missing. Cannot edit this job.");
                return;
            }

            setAdminJobValue("adminEditJobId", jobId);

            setAdminJobValue(
                "adminEditCompany",
                job.company_name || job.company
            );

            setAdminJobValue(
                "adminEditTitle",
                job.job_title || job.title
            );

            setAdminJobValue(
                "adminEditDescription",
                job.description
            );

            setAdminJobValue(
                "adminEditCGPA",
                job.minimum_cgpa
            );

            setAdminJobValue(
                "adminEditDepartment",
                job.eligible_department || job.department
            );

            setAdminJobValue(
                "adminEditGraduationYear",
                job.eligible_graduation_year ??
                job.graduation_year ??
                ""
            );

            setAdminJobValue(
                "adminEditSalary",
                job.salary_package || job.salary
            );

            setAdminJobValue(
                "adminEditLocation",
                job.job_location || job.location
            );

            let skills = job.required_skills || job.skills || "";

            if (Array.isArray(skills)) {
                skills = skills.join(", ");
            }

            setAdminJobValue(
                "adminEditSkills",
                skills
            );

            setAdminJobValue(
                "adminEditDeadline",
                job.application_deadline
                    ? String(job.application_deadline).substring(0, 10)
                    : ""
            );

            const message = getAdminJobField("adminEditJobMessage");

            if (message) {
                message.textContent = "";
                message.hidden = true;
                message.className = "alert";
            }

            showAdminEditModal();
        }


        /* ---------------------------------------------
           SAVE EDITED JOB
        --------------------------------------------- */

        async function saveAdminJobChanges(event) {

            event.preventDefault();

            const jobId = getAdminJobValue("adminEditJobId");

            const saveButton =
                getAdminJobField("adminSaveJobButton");

            const message =
                getAdminJobField("adminEditJobMessage");

            function showEditMessage(text, type = "danger") {

                if (!message) {
                    alert(text);
                    return;
                }

                message.textContent = text;
                message.className = `alert alert-${type}`;
                message.hidden = false;
            }

            if (!jobId) {
                showEditMessage("Job ID is missing. Please close and reopen Edit Job.");
                return;
            }

            const companyName =
                getAdminJobValue("adminEditCompany");

            const jobTitle =
                getAdminJobValue("adminEditTitle");

            const description =
                getAdminJobValue("adminEditDescription");

            const department =
                getAdminJobValue("adminEditDepartment");

            const cgpaValue =
                getAdminJobValue("adminEditCGPA");

            const graduationYearValue =
                getAdminJobValue("adminEditGraduationYear");

            const minimumCGPA = Number(cgpaValue);

            const graduationYear = graduationYearValue === ""
                ? null
                : Number(graduationYearValue);

            /* Validate required fields */

            if (!companyName || !jobTitle || !description) {

                showEditMessage(
                    "Please enter the company name, job title and job description."
                );

                return;
            }

            /* Validate CGPA */

            if (
                cgpaValue === "" ||
                !Number.isFinite(minimumCGPA) ||
                minimumCGPA < 0 ||
                minimumCGPA > 10
            ) {

                showEditMessage(
                    "Minimum CGPA must be between 0 and 10."
                );

                return;
            }

            /* Validate graduation year only when entered */

            if (
                graduationYear !== null &&
                (
                    !Number.isInteger(graduationYear) ||
                    graduationYear < 2020 ||
                    graduationYear > 2040
                )
            ) {

                showEditMessage(
                    "Enter a valid graduation year between 2020 and 2040, or leave it blank."
                );

                return;
            }

            /* Validate application deadline only when entered */

            const deadline =
                getAdminJobValue("adminEditDeadline");

            if (deadline) {

                const deadlineDate = new Date(
                    deadline + "T00:00:00"
                );

                const today = new Date();

                today.setHours(0, 0, 0, 0);

                if (
                    Number.isNaN(deadlineDate.getTime()) ||
                    deadlineDate < today
                ) {

                    showEditMessage(
                        "Application deadline must be today or a future date."
                    );

                    return;
                }
            }

            /*
               Send the field names expected by the FastAPI
               JobUpdate model in main.py.
            */

            const updatedJob = {

                company_name: companyName,

                job_title: jobTitle,

                description: description,

                minimum_cgpa: minimumCGPA,

                eligible_department: department || null,

                required_skills:
                    getAdminJobValue("adminEditSkills") || null,

                salary_package:
                    getAdminJobValue("adminEditSalary") || null,

                eligible_graduation_year: graduationYear,

                job_location:
                    getAdminJobValue("adminEditLocation") || null,

                application_deadline: deadline || null
            };

            const originalButtonHTML = saveButton
                ? saveButton.innerHTML
                : "Save Changes";

            if (saveButton) {
                saveButton.disabled = true;
                saveButton.textContent = "Saving...";
            }

            if (message) {
                message.hidden = true;
            }

            try {

                const response = await apiFetch(
                    `${API_BASE_URL}/jobs/${encodeURIComponent(jobId)}`,
                    {
                        method: "PUT",

                        headers: {
                            "Content-Type": "application/json"
                        },

                        body: JSON.stringify(updatedJob)
                    }
                );

                let result = {};

                try {
                    result = await response.json();
                } catch (error) {
                    result = {};
                }

                if (!response.ok) {

                    let errorMessage =
                        result.detail ||
                        result.message ||
                        `Unable to update job. Server returned ${response.status}.`;

                    if (Array.isArray(errorMessage)) {

                        errorMessage = errorMessage
                            .map(item => {

                                const field = Array.isArray(item.loc)
                                    ? item.loc.slice(1).join(" → ")
                                    : "Field";

                                return `${field}: ${item.msg || "Invalid value"}`;

                            })
                            .join(" | ");
                    }

                    throw new Error(errorMessage);
                }

                hideAdminEditModal();

                showAdminJobMessage(
                    "Job opportunity updated successfully.",
                    "success"
                );

                /* Refresh job table */

                await loadAdminJobs();

                /* Refresh total job count */

                await refreshAdminJobStatistics();

            } catch (error) {

                console.error(
                    "Admin Job Update Error:",
                    error
                );

                showEditMessage(
                    error.message || "Unable to update job."
                );

            } finally {

                if (saveButton) {
                    saveButton.disabled = false;
                    saveButton.innerHTML = originalButtonHTML;
                }
            }
        }


        /* ---------------------------------------------
           CONNECT EXISTING EDIT FORM
        --------------------------------------------- */

        const adminEditJobForm =
            document.getElementById("adminEditJobForm");

        if (adminEditJobForm) {

            /*
               Prevent duplicate submit listeners if this
               section is initialized more than once.
            */

            if (adminEditJobForm.dataset.adminEditBound !== "true") {

                adminEditJobForm.addEventListener(
                    "submit",
                    saveAdminJobChanges
                );

                adminEditJobForm.dataset.adminEditBound = "true";
            }

        } else {

            console.error(
                "adminEditJobForm was not found. Check admin-dashboard.html."
            );
        }


        /* ---------------------------------------------
           DELETE JOB
        --------------------------------------------- */

        async function deleteAdminJob(jobId, jobTitle, button) {

            if (!jobId) {
                alert("Job ID is missing. Cannot delete this job.");
                return;
            }

            const confirmed = confirm(
                `Are you sure you want to delete "${jobTitle}"?\n\nThis action cannot be undone.`
            );

            if (!confirmed) return;

            const originalButtonHTML = button.innerHTML;

            button.disabled = true;
            button.textContent = "Deleting...";

            try {

                const response = await apiFetch(
                    `${API_BASE_URL}/jobs/${encodeURIComponent(jobId)}`,
                    {
                        method: "DELETE"
                    }
                );

                let result = {};

                try {
                    result = await response.json();
                } catch (error) {
                    result = {};
                }

                if (!response.ok) {

                    throw new Error(
                        result.detail ||
                        result.message ||
                        `Unable to delete job. Server returned ${response.status}.`
                    );
                }

                showAdminJobMessage(
                    "Job opportunity deleted successfully.",
                    "success"
                );

                await loadAdminJobs();

                await refreshAdminJobStatistics();

            } catch (error) {

                console.error(
                    "Admin Job Delete Error:",
                    error
                );

                alert(error.message);

                button.disabled = false;
                button.innerHTML = originalButtonHTML;
            }
        }


        /* ---------------------------------------------
           LOAD ADMIN JOBS
        --------------------------------------------- */

        async function loadAdminJobs() {

            adminJobsContainer.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-4">
                        Loading job opportunities...
                    </td>
                </tr>
            `;

            clearAdminJobMessage();

            try {

                const response = await apiFetch(
                    `${API_BASE_URL}/jobs`
                );

                if (!response.ok) {

                    throw new Error(
                        `Unable to retrieve jobs. Server returned ${response.status}.`
                    );
                }

                const jobs = await response.json();

                if (!Array.isArray(jobs)) {

                    throw new Error(
                        "Unexpected response from jobs API."
                    );
                }

                jobs.sort((a, b) => {

                    const dateA = new Date(
                        a.published_at || a.created_at || a.posted_at || 0
                    ).getTime() || 0;

                    const dateB = new Date(
                        b.published_at || b.created_at || b.posted_at || 0
                    ).getTime() || 0;

                    return dateB - dateA;
                });

                latestAdminJobs = jobs;

                if (jobs.length === 0) {

                    adminJobsContainer.innerHTML = `
                        <tr>
                            <td colspan="7" class="text-center py-4">
                                No job opportunities found.
                            </td>
                        </tr>
                    `;

                    return;
                }

                adminJobsContainer.innerHTML = jobs.map(job => {

                    const jobId = getJobId(job);

                    return `
                        <tr>

                            <td class="fw-semibold">
                                ${escapeAdminJobHTML(job.title || job.job_title)}
                            </td>

                            <td>
                                ${escapeAdminJobHTML(job.company || job.company_name)}
                            </td>

                            <td>
                                ${escapeAdminJobHTML(job.department || job.eligible_department)}
                            </td>

                            <td>
                                ${escapeAdminJobHTML(job.minimum_cgpa)}
                            </td>

                            <td>
                                ${escapeAdminJobHTML(
                                    job.graduation_year ??
                                    job.eligible_graduation_year ??
                                    "Not specified"
                                )}
                            </td>

                            <td>
                                ${escapeAdminJobHTML(job.location || job.job_location)}
                            </td>

                            <td class="text-center">

                                <div class="d-flex justify-content-center gap-2 flex-wrap">

                                    <button
                                        type="button"
                                        class="btn btn-sm btn-outline-primary admin-edit-job"
                                        data-job-id="${escapeAdminJobHTML(jobId)}"
                                    >
                                        <i class="bi bi-pencil-square"></i>
                                        Edit
                                    </button>

                                    <button
                                        type="button"
                                        class="btn btn-sm btn-outline-danger admin-delete-job"
                                        data-job-id="${escapeAdminJobHTML(jobId)}"
                                    >
                                        <i class="bi bi-trash"></i>
                                        Delete
                                    </button>

                                </div>

                            </td>

                        </tr>
                    `;

                }).join("");


                /* Attach Edit buttons */

                adminJobsContainer
                    .querySelectorAll(".admin-edit-job")
                    .forEach(button => {

                        button.addEventListener("click", function () {

                            const jobId = this.dataset.jobId;

                            const selectedJob = latestAdminJobs.find(
                                job => String(getJobId(job)) === String(jobId)
                            );

                            if (!selectedJob) {

                                alert(
                                    "Unable to find the selected job. Please refresh the job list."
                                );

                                return;
                            }

                            openAdminJobEditModal(selectedJob);
                        });
                    });


                /* Attach Delete buttons */

                adminJobsContainer
                    .querySelectorAll(".admin-delete-job")
                    .forEach(button => {

                        button.addEventListener("click", function () {

                            const jobId = this.dataset.jobId;

                            const selectedJob = latestAdminJobs.find(
                                job => String(getJobId(job)) === String(jobId)
                            );

                            if (!selectedJob) {

                                alert("Unable to find the selected job.");
                                return;
                            }

                            deleteAdminJob(
                                jobId,
                                selectedJob.title ||
                                selectedJob.job_title ||
                                "this job",
                                this
                            );
                        });
                    });


                if (adminJobsMessage) {

                    adminJobsMessage.innerHTML = `
                        <div class="text-success small">
                            <i class="bi bi-check-circle-fill me-1"></i>
                            Successfully loaded ${jobs.length} job opportunities.
                        </div>
                    `;

                    adminJobsMessage.hidden = false;
                }

            } catch (error) {

                console.error(
                    "Admin Job Management Error:",
                    error
                );

                adminJobsContainer.innerHTML = `
                    <tr>
                        <td colspan="7" class="text-center text-danger py-4">
                            Failed to load job opportunities.
                        </td>
                    </tr>
                `;

                showAdminJobMessage(
                    error.message,
                    "danger"
                );
            }
        }


        /* ---------------------------------------------
           REFRESH ADMIN JOB STATISTICS
        --------------------------------------------- */

        async function refreshAdminJobStatistics() {

            try {

                const response = await apiFetch(
                    `${API_BASE_URL}/admin/dashboard`
                );

                if (!response.ok) return;

                const data = await response.json();

                const totalJobsElement =
                    document.getElementById("adminTotalJobs");

                if (totalJobsElement) {

                    totalJobsElement.textContent =
                        data.total_jobs ?? 0;
                }

            } catch (error) {

                console.error(
                    "Unable to refresh admin job statistics:",
                    error
                );
            }
        }


        /* ---------------------------------------------
           REFRESH JOBS BUTTON
        --------------------------------------------- */

        const refreshAdminJobsButton =
            document.getElementById("refreshAdminJobsButton");

        if (refreshAdminJobsButton) {

            refreshAdminJobsButton.addEventListener(
                "click",
                loadAdminJobs
            );
        }


        /* ---------------------------------------------
           INITIAL LOAD
        --------------------------------------------- */

        loadAdminJobs();
    }
}

/* =====================================================
   13. ADMIN APPLICATION MONITORING
===================================================== */

if (!window.campusConnectAccessBlocked) {

    const adminApplicationsContainer =
        document.getElementById("adminApplicationsContainer");

    if (adminApplicationsContainer) {

        const adminApplicationsMessage =
            document.getElementById("adminApplicationsMessage");

        function escapeAdminApplicationHTML(value) {

            return String(value ?? "Not available").replace(
                /[&<>"']/g,
                character => ({

                    "&": "&amp;",
                    "<": "&lt;",
                    ">": "&gt;",
                    '"': "&quot;",
                    "'": "&#039;"

                })[character]
            );
        }

        function getApplicationStatusClass(status) {

            const statusClasses = {

                Pending: "bg-warning text-dark",
                Shortlisted: "bg-info text-dark",
                Selected: "bg-success",
                Rejected: "bg-danger"

            };

            return statusClasses[status] || "bg-secondary";
        }

        async function loadAdminApplications() {

            adminApplicationsContainer.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-4">
                        Loading applications...
                    </td>
                </tr>
            `;

            if (adminApplicationsMessage) {
                adminApplicationsMessage.textContent = "";
            }

            try {

                const response = await apiFetch(
                    `${API_BASE_URL}/applications`
                );

                if (!response.ok) {
                    throw new Error(
                        "Unable to retrieve applications."
                    );
                }

                const applications = await response.json();

                if (
                    !Array.isArray(applications) ||
                    applications.length === 0
                ) {

                    adminApplicationsContainer.innerHTML = `
                        <tr>
                            <td colspan="7" class="text-center py-4">
                                No applications found.
                            </td>
                        </tr>
                    `;

                    return;
                }

                adminApplicationsContainer.innerHTML =
                    applications.map(application => {

                        const status =
                            application.status || "Pending";

                        const formattedDate = application.applied_at
                            ? new Date(
                                application.applied_at
                            ).toLocaleDateString(
                                "en-IN",
                                {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric"
                                }
                            )
                            : "Not available";

                        return `

                            <tr>

                                <td class="fw-semibold">

                                    ${escapeAdminApplicationHTML(application.student_name)}

                                    <div class="small text-muted">
                                        ${escapeAdminApplicationHTML(application.student_email)}
                                    </div>

                                </td>

                                <td>
                                    ${escapeAdminApplicationHTML(application.department)}
                                </td>

                                <td>

                                    ${escapeAdminApplicationHTML(application.company)}

                                    <div class="small text-muted">
                                        ${escapeAdminApplicationHTML(application.job_title)}
                                    </div>

                                </td>

                                <td>
                                    ${application.cgpa ?? "—"}
                                </td>

                                <td>
                                    ${application.graduation_year ?? "—"}
                                </td>

                                <td>

                                    <span class="badge ${getApplicationStatusClass(status)}">
                                        ${escapeAdminApplicationHTML(status)}
                                    </span>

                                </td>

                                <td>
                                    ${escapeAdminApplicationHTML(formattedDate)}
                                </td>

                            </tr>

                        `;

                    }).join("");

                if (adminApplicationsMessage) {

                    adminApplicationsMessage.innerHTML = `
                        <div class="text-success small">
                            <i class="bi bi-check-circle-fill me-1"></i>
                            Successfully loaded ${applications.length} applications.
                        </div>
                    `;
                }

            } catch (error) {

                console.error(
                    "Admin Application Monitoring Error:",
                    error
                );

                adminApplicationsContainer.innerHTML = `
                    <tr>
                        <td colspan="7" class="text-center text-danger py-4">
                            Failed to load applications. Please try again.
                        </td>
                    </tr>
                `;

                if (adminApplicationsMessage) {
                    adminApplicationsMessage.textContent = error.message;
                }
            }
        }

        const refreshAdminApplicationsButton =
            document.getElementById("refreshAdminApplicationsButton");

        if (refreshAdminApplicationsButton) {

            refreshAdminApplicationsButton.addEventListener(
                "click",
                loadAdminApplications
            );
        }

        loadAdminApplications();
    }
}


/* =====================================================
   14. END OF CAREERSPHERE FRONTEND JAVASCRIPT
===================================================== */

/* =====================================================
   15. CAREERSPHERE PRESENTATION + PLACEMENT HISTORY
   Uses the existing backend; no fabricated placement figures.
===================================================== */
(function initialiseCareerSphereEnhancements() {
    const style = document.createElement("style");
    style.textContent = `
      .job-published-date{margin:10px 0 12px;font-size:.82rem}
      .career-skill-guidance{margin:12px 0;padding:12px 14px;border:1px solid #dbeafe;border-left:4px solid #2563eb;border-radius:10px;background:#f8fbff;color:#1e293b;font-size:.88rem;line-height:1.5}
      .career-skill-guidance strong{display:block;margin-bottom:4px;color:#1d4ed8}
      .career-placement-panel{margin:28px 0;padding:22px;border:1px solid #e2e8f0;border-radius:16px;background:#fff;box-shadow:0 8px 24px rgba(15,23,42,.06)}
      .career-placement-panel h3{margin:0 0 6px;font-size:1.2rem;font-weight:700;color:#0f172a}
      .career-placement-panel p{color:#64748b;font-size:.9rem}
      .career-placement-canvas{display:block;width:100%;height:260px}
    `;
    document.head.appendChild(style);

    const page = window.location.pathname.toLowerCase();
    if (!page.endsWith("student-dashboard.html")) return;
    const jobsContainer = document.getElementById("jobsContainer");
    if (!jobsContainer) return;

    const panel = document.createElement("section");
    panel.className = "career-placement-panel";
    panel.innerHTML = `<h3><i class="bi bi-graph-up-arrow"></i> Placement History</h3><p>Previous-year placement statistics from your portal records.</p><div id="careerPlacementStatus" class="small text-muted">Loading placement history...</div><canvas id="careerPlacementChart" class="career-placement-canvas" role="img" aria-label="Year-wise placement history chart"></canvas>`;
    jobsContainer.parentElement.insertAdjacentElement("afterend", panel);

    async function loadPlacementHistory() {
      const status = document.getElementById("careerPlacementStatus");
      const canvas = document.getElementById("careerPlacementChart");
      try {
        const response = await apiFetch(`${API_BASE_URL}/analytics/placement-history`);
        if (!response.ok) throw new Error(`Placement history endpoint returned ${response.status}`);
        const payload = await response.json();
        const rows = Array.isArray(payload) ? payload : (payload.data || payload.history || payload.placements || []);
        const values = rows.map(row => ({ year: String(row.year || row.academic_year || ""), count: Number(row.placed ?? row.placed_students ?? row.placements ?? row.total_placed) })).filter(row => row.year && Number.isFinite(row.count));
        if (!values.length) throw new Error("No historical placement records are available yet.");
        values.sort((a,b) => a.year.localeCompare(b.year));
        status.textContent = values.map(v => `${v.year}: ${v.count} placed`).join("  •  ");
        const dpr = window.devicePixelRatio || 1;
        const width = Math.max(320, canvas.clientWidth);
        const height = 260;
        canvas.width = width * dpr; canvas.height = height * dpr;
        const ctx = canvas.getContext("2d"); ctx.scale(dpr,dpr);
        const pad = {left:42,right:18,top:18,bottom:42};
        const plotW = width-pad.left-pad.right, plotH = height-pad.top-pad.bottom;
        const max = Math.max(1,...values.map(v=>v.count));
        ctx.clearRect(0,0,width,height); ctx.font = "12px Arial"; ctx.fillStyle="#64748b"; ctx.strokeStyle="#e2e8f0";
        for(let i=0;i<=4;i++){ const y=pad.top+plotH-(plotH*i/4); ctx.beginPath();ctx.moveTo(pad.left,y);ctx.lineTo(width-pad.right,y);ctx.stroke();ctx.fillText(String(Math.round(max*i/4)),5,y+4); }
        const slot=plotW/values.length, barW=Math.min(54,slot*.58);
        values.forEach((v,i)=>{const h=(v.count/max)*plotH;const x=pad.left+i*slot+(slot-barW)/2;const y=pad.top+plotH-h;ctx.fillStyle="#2563eb";ctx.beginPath();ctx.roundRect(x,y,barW,h,5);ctx.fill();ctx.fillStyle="#334155";ctx.textAlign="center";ctx.fillText(String(v.count),x+barW/2,Math.max(12,y-7));ctx.fillStyle="#64748b";ctx.fillText(v.year,x+barW/2,height-14);});
      } catch(error) {
        console.info("Placement history unavailable:",error.message);
        status.textContent = "Historical placement data is not available yet. Add year-wise placement records to the backend to display this graph.";
        canvas.hidden = true;
      }
    }
    loadPlacementHistory();
  })();
