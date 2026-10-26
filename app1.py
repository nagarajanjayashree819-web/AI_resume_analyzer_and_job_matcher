

from flask import Flask, render_template, request, jsonify
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from PyPDF2 import PdfReader
from docx import Document
from pathlib import Path
import re
import io

BASE_DIR = Path(__file__).resolve().parent

# Use your existing directory and filenames
app = Flask(
    __name__,
    template_folder=str(BASE_DIR / "templates1"),
    static_folder=str(BASE_DIR / "static1"),
    static_url_path="/static"
)

app.config["MAX_CONTENT_LENGTH"] = 5 * 1024 * 1024

SKILLS = [
    "python", "java", "javascript", "html", "css", "sql", "mysql",
    "flask", "django", "react", "machine learning", "deep learning",
    "artificial intelligence", "data analysis", "pandas", "numpy",
    "scikit-learn", "excel", "power bi", "tableau", "statistics",
    "c", "c++", "git", "github", "aws", "docker", "tensorflow",
    "rest api", "api integration", "debugging", "testing",
    "responsive web design", "web development", "data visualization",
    "data cleaning", "azure", "cloud computing", "linux", "networking",
    "cybersecurity", "information security", "network security",
    "log analysis", "risk assessment", "incident response",
    "vulnerability assessment", "access control", "monitoring", "scripting",
    "figma", "wireframing", "prototyping", "user research",
    "usability testing", "design systems", "accessibility", "ui design",
    "ux design", "accounting", "bookkeeping", "financial reporting",
    "accounts payable", "accounts receivable", "bank reconciliation",
    "budgeting", "financial analysis", "taxation", "payroll",
    "customer service", "customer support", "customer relationship",
    "active listening", "conflict resolution", "product knowledge",
    "sales", "cash handling", "inventory management", "complaint handling",
    "ticket management", "email support", "seo", "sem", "content marketing",
    "social media marketing", "google analytics", "keyword research",
    "copywriting", "email marketing", "campaign reporting", "recruitment",
    "candidate screening", "interview scheduling", "onboarding",
    "employee records", "human resources", "documentation", "data entry",
    "android", "kotlin", "mobile app development", "sqlite", "teaching",
    "lesson planning", "classroom management", "curriculum development",
    "assessment", "operations management", "process improvement", "logistics",
    "scheduling", "communication", "leadership", "problem solving",
    "project management", "teamwork", "time management", "organization",
    "analytical skills", "attention to detail", "customer service",
    "financial statements", "Microsoft Excel"
]


def extract_resume(file):
    filename = file.filename.lower()
    content = file.read()

    if filename.endswith(".pdf"):
        reader = PdfReader(io.BytesIO(content))
        return "\n".join(
            page.extract_text() or "" for page in reader.pages
        )

    if filename.endswith(".docx"):
        document = Document(io.BytesIO(content))
        return "\n".join(p.text for p in document.paragraphs)

    if filename.endswith(".txt"):
        return content.decode("utf-8", errors="ignore")

    raise ValueError("Upload a PDF, DOCX, or TXT resume.")


def find_skills(text):
    found = []

    for skill in SKILLS:
        pattern = r"(?<!\w)" + re.escape(skill) + r"(?!\w)"
        if re.search(pattern, text, re.IGNORECASE):
            found.append(skill.title())

    return found


def calculate_match(resume_text, job_text):
    vectorizer = TfidfVectorizer(
        stop_words="english",
        ngram_range=(1, 2)
    )

    matrix = vectorizer.fit_transform([resume_text, job_text])
    similarity = cosine_similarity(matrix[0:1], matrix[1:2])[0][0]

    return round(float(similarity) * 100, 2)


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
                "error": "Not enough readable text in the resume."
            }), 400

        if not jobs_text:
            return jsonify({
                "error": "Enter at least one job description."
            }), 400

        descriptions = [
            item.strip()
            for item in re.split(r"(?m)^\s*---\s*$", jobs_text)
            if item.strip()
        ]

        resume_skills = find_skills(resume_text)
        results = []

        for number, job in enumerate(descriptions, start=1):
            job_skills = find_skills(job)

            resume_set = {s.lower() for s in resume_skills}
            job_set = {s.lower() for s in job_skills}

            matched = [
                s for s in resume_skills if s.lower() in job_set
            ]
            missing = [
                s for s in job_skills if s.lower() not in resume_set
            ]

            score = calculate_match(resume_text, job)
            coverage = round((len(matched) / len(job_skills)) * 100, 1) if job_skills else 0
            first_line = next((line.strip() for line in job.splitlines() if line.strip()), "")
            job_title = first_line[:70] if first_line else f"Job {number}"
            results.append({
                "job_number": number,
                "job_title": job_title,
                "score": score,
                "keyword_coverage": coverage,
                "matched_skills": matched,
                "missing_skills": missing,
                "job_skills": job_skills
            })

        results.sort(key=lambda item: item["score"], reverse=True)

        # A transparent heuristic indicator, not an official ATS score.
        resume_lower = resume_text.lower()
        section_terms = ["experience", "education", "skills", "projects"]
        section_count = sum(1 for term in section_terms if term in resume_lower)
        contact_bonus = 10 if re.search(r"\\b[\\w.+-]+@[\\w.-]+\\.[A-Za-z]{2,}\\b", resume_text) else 0
        ats_score = min(100, round(min(len(resume_skills) / 12, 1) * 60 + (section_count / 4) * 30 + contact_bonus))
        best_coverage = max((item["keyword_coverage"] for item in results), default=0)
        return jsonify({
            "resume_skills": resume_skills,
            "results": results,
            "ats_score": ats_score,
            "keyword_coverage": best_coverage,
            "resume_text_length": len(resume_text),
            "resume_text": resume_text,
            "sections_detected": section_count
        })

    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    except Exception:
        app.logger.exception("Resume analysis failed")
        return jsonify({
            "error": "Analysis failed. Check the resume and try again."
        }), 500



@app.route("/download-report", methods=["POST"])
def download_report():
    """Create a downloadable PDF report from the latest browser analysis."""
    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.pdfgen import canvas

        data = request.get_json(silent=True) or {}
        buffer = io.BytesIO()
        pdf = canvas.Canvas(buffer, pagesize=letter)
        width, height = letter
        y = height - 55

        def line(text, font="Helvetica", size=10, gap=16):
            nonlocal y
            if y < 55:
                pdf.showPage()
                y = height - 55
            pdf.setFont(font, size)
            safe = str(text).encode("latin-1", "replace").decode("latin-1")
            pdf.drawString(48, y, safe[:110])
            y -= gap

        line("Resume Analysis Report", "Helvetica-Bold", 20, 28)
        line("ATS-style indicator: " + str(data.get("ats_score", "N/A")) + "/100")
        line("Keyword coverage: " + str(data.get("keyword_coverage", "N/A")) + "%")
        line("Skills detected: " + str(len(data.get("resume_skills", []))))
        line("")
        line("Detected resume skills", "Helvetica-Bold", 13)
        for skill in data.get("resume_skills", [])[:70]:
            line("- " + skill, gap=13)
        line("")
        line("Job match rankings", "Helvetica-Bold", 13)
        for job in data.get("results", [])[:20]:
            line(f'{job.get("job_title", "Job")} — Match {job.get("score", 0)}%')
            line("Matched: " + (", ".join(job.get("matched_skills", [])) or "None detected"))
            line("Skills to develop: " + (", ".join(job.get("missing_skills", [])) or "None detected"))
            line("")
        line("Note: Match scores measure text similarity and are not hiring probabilities.")
        pdf.save()
        buffer.seek(0)
        from flask import send_file
        return send_file(buffer, mimetype="application/pdf", as_attachment=True,
                         download_name="resume_analysis_report.pdf")
    except Exception:
        app.logger.exception("Could not create PDF report")
        return jsonify({"error": "PDF report could not be generated. Check report dependencies."}), 500

@app.errorhandler(413)
def file_too_large(error):
    return jsonify({
        "error": "Resume must be 5 MB or smaller."
    }), 413


if __name__ == "__main__":
    app.run(debug=True)
