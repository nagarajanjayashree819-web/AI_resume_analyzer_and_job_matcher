
from flask import Flask, render_template, request, jsonify
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from PyPDF2 import PdfReader
from docx import Document
from pathlib import Path
import re
import io

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 5 * 1024 * 1024  # 5 MB
    
SKILLS = [
    # Programming and web development
    "python", "java", "javascript", "html", "css", "sql", "mysql",
    "flask", "django", "react", "c", "c++", "git", "github",
    "rest api", "api integration", "debugging", "testing",
    "responsive web design", "web development",

    # AI, machine learning and data
    "machine learning", "deep learning", "artificial intelligence",
    "data analysis", "data visualization", "pandas", "numpy",
    "scikit-learn", "tensorflow", "statistics", "excel",
    "power bi", "tableau", "data cleaning",

    # Cloud and cybersecurity
    "aws", "azure", "docker", "cloud computing", "linux",
    "networking", "cybersecurity", "information security",
    "network security", "log analysis", "risk assessment",
    "incident response", "vulnerability assessment",
    "access control", "monitoring", "scripting",

    # UI/UX design
    "figma", "wireframing", "prototyping", "user research",
    "usability testing", "design systems", "accessibility",
    "ui design", "ux design",

    # Accounting and finance
    "accounting", "bookkeeping", "financial reporting",
    "accounts payable", "accounts receivable", "bank reconciliation",
    "budgeting", "financial analysis", "taxation", "payroll",

    # Retail and customer support
    "customer service", "customer support", "customer relationship",
    "active listening", "conflict resolution", "product knowledge",
    "sales", "cash handling", "inventory management",
    "complaint handling", "ticket management", "email support",

    # Digital marketing
    "seo", "sem", "content marketing", "social media marketing",
    "google analytics", "keyword research", "copywriting",
    "email marketing", "campaign reporting",

    # HR and administration
    "recruitment", "candidate screening", "interview scheduling",
    "onboarding", "employee records", "human resources",
    "documentation", "data entry",

    # Mobile app development
    "android", "kotlin", "mobile app development", "sqlite",

    # Teaching and education
    "teaching", "lesson planning", "classroom management",
    "curriculum development", "assessment",

    # Operations and general skills
    "operations management", "process improvement", "logistics",
    "scheduling", "problem solving", "communication", "leadership",
    "project management", "teamwork", "time management",
    "organization", "analytical skills", "attention to detail"
]



def extract_resume(file):
    name = file.filename.lower()
    content = file.read()

    if name.endswith(".pdf"):
        reader = PdfReader(io.BytesIO(content))
        return "\n".join(
            page.extract_text() or "" for page in reader.pages
        )

    if name.endswith(".docx"):
        doc = Document(io.BytesIO(content))
        return "\n".join(p.text for p in doc.paragraphs)

    if name.endswith(".txt"):
        return content.decode("utf-8", errors="ignore")

    raise ValueError("Upload a PDF, DOCX, or TXT resume.")


def find_skills(text):
    text = text.lower()
    found = []

    for skill in SKILLS:
        pattern = r"(?<!\w)" + re.escape(skill) + r"(?!\w)"
        if re.search(pattern, text):
            found.append(skill.title())

    return found


def calculate_match(resume_text, job_text):
    vectorizer = TfidfVectorizer(
        stop_words="english",
        ngram_range=(1, 2)
    )
    matrix = vectorizer.fit_transform([resume_text, job_text])
    score = cosine_similarity(matrix[0:1], matrix[1:2])[0][0]
    return round(float(score) * 100, 2)


@app.route("/")
def home():
    return render_template("index1.html")


@app.route("/analyze", methods=["POST"])
def analyze():
    try:
        resume = request.files.get("resume")
        jobs_text = request.form.get("jobs", "").strip()

        if not resume or not resume.filename:
            return jsonify({"error": "Please upload your resume."}), 400

        if not resume.filename.lower().endswith(
            (".pdf", ".docx", ".txt")
        ):
            return jsonify({
                "error": "Only PDF, DOCX, and TXT files are supported."
            }), 400

        resume_text = extract_resume(resume).strip()

        if len(resume_text) < 30:
            return jsonify({
                "error": "Could not read enough text. Try a text-based PDF or DOCX."
            }), 400

        if not jobs_text:
            return jsonify({
                "error": "Please enter at least one job description."
            }), 400

        # Separate job descriptions using a line containing ---
        job_descriptions = [
            job.strip()
            for job in re.split(r"(?m)^\s*---\s*$", jobs_text)
            if job.strip()
        ]

        resume_skills = find_skills(resume_text)
        results = []

        for index, job in enumerate(job_descriptions, start=1):
            job_skills = find_skills(job)
            matched = [
                skill for skill in resume_skills
                if skill.lower() in {s.lower() for s in job_skills}
            ]
            missing = [
                skill for skill in job_skills
                if skill.lower() not in {s.lower() for s in resume_skills}
            ]

            score = calculate_match(resume_text, job)

            results.append({
                "job_number": index,
                "score": score,
                "matched_skills": matched,
                "missing_skills": missing,
                "job_skills": job_skills
            })

        results.sort(key=lambda item: item["score"], reverse=True)

        return jsonify({
            "resume_skills": resume_skills,
            "results": results
        })

    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    except Exception:
        app.logger.exception("Resume analysis failed")
        return jsonify({
            "error": "Analysis failed. Please check the uploaded file and try again."
        }), 500


@app.errorhandler(413)
def file_too_large(error):
    return jsonify({"error": "File is too large. Maximum size is 5 MB."}), 413


if __name__ == "__main__":
    app.run(debug=True)
