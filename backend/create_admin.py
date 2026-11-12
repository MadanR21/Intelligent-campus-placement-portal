
from getpass import getpass
from database import users_collection
from main import hash_password


print("\n================================")
print(" CAMPUSCONNECT ADMIN SETUP")
print("================================\n")

name = input("Enter admin name: ").strip()
email = input("Enter admin email: ").strip().lower()
password = getpass("Create admin password: ")
confirm_password = getpass("Confirm admin password: ")

if not name or not email or not password:
    print("\nAll fields are required.")
    raise SystemExit

if password != confirm_password:
    print("\nPasswords do not match.")
    raise SystemExit

if len(password) < 8:
    print("\nPassword must contain at least 8 characters.")
    raise SystemExit

existing_admin = users_collection.find_one({
    "email": email
})

if existing_admin:
    print("\nAn account with this email already exists.")
    raise SystemExit

admin = {
    "full_name": name,
    "email": email,
    "password": hash_password(password),
    "role": "admin",
    "department": None,
    "graduation_year": None
}

result = users_collection.insert_one(admin)

print("\nAdmin account created successfully!")
print("Admin ID:", result.inserted_id)
print("Admin Email:", email)
