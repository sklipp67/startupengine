import os
import textwrap
from flask import Flask, request, jsonify, send_from_directory
from dotenv import load_dotenv
from openai import OpenAI

# Load environment variables from .env
load_dotenv()
api_key = os.getenv("OPENAI_API_KEY")

if not api_key:
    raise RuntimeError("OPENAI_API_KEY is not set in the environment (.env file).")

client = OpenAI(api_key=api_key)

app = Flask(__name__, static_folder=".", static_url_path="")

STARTUP_ENGINE_INSTRUCTIONS = """
You are Startup Engine, a practical, encouraging startup-planning assistant.

Your job is to turn the user’s inputs into a clear, realistic, and well-structured
startup plan, written in Markdown, suitable for printing or saving as a PDF.

Always:
- Use clear headings and subheadings.
- Use bullet points and short paragraphs.
- Be specific and practical, not fluffy or motivational.
- Tailor the language to the user’s experience level (beginner vs advanced).
- Base estimates and examples on typical patterns, and clearly label them as estimates.
- Respect any numbers or constraints provided by the user or uploaded notes as the primary source,
  unless they are obviously unrealistic.

STRUCTURE YOUR RESPONSE LIKE THIS (Markdown):

# Startup plan for: {business_idea}

## 1. Snapshot: Business overview
- Short description of the business in plain language.
- What problem it solves, for whom.
- Why this idea makes sense in the user’s context (location, budget, goals, experience).

## 2. Target market
- Describe the ideal customers using the inputs (target customer description, goals, location).
- Segment them into 2–4 clear groups when helpful.
- Highlight one “early adopter” segment to focus on first.

## 3. Local market & competition
Based on the location (city / state / ZIP / region) and business type, provide:
- A short snapshot of local context (e.g., urban vs rural, tourism, cost of living, typical demand).
- Typical competitor types (for example: traditional shops, online competitors, larger chains).
- 3–5 bullet points on how this business can stand out locally (positioning, price, quality, niche).
- Clearly state that this is an estimate based on general patterns and not a formal market study.

## 4. Business model & offer
- Core services or products offered.
- How value is created for the customer.
- How the business makes money (revenue streams).
- Any packages, tiers, or recurring offers that make sense.

## 5. Operations & setup
- Key startup steps in order, tailored to the user’s timeline.
- Lean setup options for low budget.
- Notes on tools, software, and simple systems.
- Any licenses/permits or local compliance items to research (high-level, not legal advice).

## 6. Marketing & sales plan
- 3–6 specific channels (online and/or offline) that fit the business and user.
- Concrete action examples (e.g., “post X per week on Y,” “visit Z locations,” “run a simple offer”).
- How to leverage the user’s skills, unique value, and preferred sales channels.
- Simple first-funnel: how people hear about it → how they inquire → how they buy.

## 7. Financial snapshot (estimates)
- Use any pricing, volume, or cost details from the user or uploaded notes AS PRIMARY.
- If the user gives numbers (e.g., “$175 per job, 6 jobs per weekend”), build around those.
- Provide:
  - Simple revenue scenarios (conservative / moderate / stretch).
  - Rough estimate of key costs (supplies, marketing, software, etc.).
  - A simple break-even or “how many sales to cover basic monthly costs” estimate.
- Always label numbers as rough, example estimates, not guarantees.

## 8. Risks, constraints, and mitigation
- List the top 3–7 risks or constraints (from user challenges, budget, location, weather, etc.).
- Provide practical, simple mitigation ideas for each.
- Be honest but encouraging.

## 9. 30–90 day action roadmap
- Give a timeline based on the user’s selected timeframe (30, 60, 90 days, 6 months, 1 year, or custom).
- Break into phases (for example: Weeks 1–2, Weeks 3–4, Months 2–3).
- For each phase, list 3–7 specific, doable tasks.

## 10. Integration of uploaded notes (if provided)
If the user has uploaded supporting notes or prior plans:
- Briefly summarize those notes in 3–7 bullet points.
- Pull in only the relevant items into the above sections.
- If there is a conflict between the uploaded notes and your assumptions:
  - Prefer the uploaded data when it seems realistic.
  - Otherwise, explain the conflict in one sentence and choose a conservative path.

At the end of the plan, append exactly this section (verbatim, in Markdown):

---
_Important Disclaimer_

This startup plan is generated using AI based on the information you provided and general public patterns.
It is for brainstorming and educational purposes only and is **not** legal, financial, or tax advice.

Local regulations, licensing, taxes, and market conditions may change, so please:
- Verify key details with up-to-date local sources.
- Consult qualified professionals (legal, tax, financial) before making major commitments.
- Treat financial forecasts as rough estimates, not guarantees.
"""

@app.route("/")
def index():
    return send_from_directory(".", "index.html")

@app.route("/app.js")
def app_js():
    return send_from_directory(".", "app.js")

@app.route("/app.css")
def app_css():
    return send_from_directory(".", "app.css")


@app.route("/api/startup-plan", methods=["POST"])
def generate_startup_plan():
    try:
        data = request.get_json(silent=True) or {}

        user_type = data.get("user_type", "adult")
        experience_level = data.get("experience_level", "beginner")
        business_idea = (data.get("business_idea") or "").strip()
        location = (data.get("location") or "").strip()
        budget = (data.get("budget") or "").strip()
        timeline = (data.get("timeline") or "").strip()
        custom_timeline = (data.get("custom_timeline") or "").strip()
        goals = (data.get("goals") or "").strip()
        target_customer = (data.get("target_customer") or "").strip()
        challenges = (data.get("challenges") or "").strip()
        skills = (data.get("skills") or "").strip()
        unique_value = (data.get("unique_value") or "").strip()
        vision = (data.get("vision") or "").strip()
        preferred_sales_channels = data.get("preferredSalesChannels") or []
        extra_notes_text = (data.get("extra_notes_text") or "").strip()

        if not business_idea:
            return jsonify({"error": "Business idea is required."}), 400

        # Timeline text for context
        if timeline == "custom" and custom_timeline:
            timeline_text = f"Custom timeline: {custom_timeline}"
        elif timeline:
            timeline_text = f"Timeline: {timeline}"
        else:
            timeline_text = "Timeline: not specified"

        channels_text = ", ".join(preferred_sales_channels) if preferred_sales_channels else "Not specified"

        # Build user context for the model
        user_context = f"""
User profile:
- User type: {user_type}
- Experience level: {experience_level}
- Location (ZIP / city / state as given): {location or "Not specified"}
- Budget: {budget or "Not specified"}
- {timeline_text}

Business idea:
{business_idea or "Not provided."}

Vision for the business (how they picture it, why it is attractive):
{vision or "Not provided."}

Target customer (from form):
{target_customer or "Not provided."}

Perceived challenges:
{challenges or "Not provided."}

Skills and strengths:
{skills or "Not provided."}

Unique value or differentiator:
{unique_value or "Not provided."}

Preferred sales channels:
{channels_text}

Important:
- Use plain, clear language suitable for the user's experience level.
- When in doubt on specific numbers, prefer conservative estimates.
""".strip()

        # Add uploaded notes, if any
        if extra_notes_text:
            user_context += textwrap.dedent(f"""

            Additional supporting notes uploaded by the user
            (may include prior plans, research, financials, or other context):

            {extra_notes_text[:8000]}

            Please:
            - Summarize these notes in 3–7 bullet points.
            - Integrate only the relevant details into the plan (business model, pricing, operations, risk, etc.).
            - If any numbers in the notes conflict with your defaults, prefer the notes when they seem realistic.
            - Ignore or briefly mention anything clearly off-topic, outdated, or speculative.
            """)

        # Call OpenAI Responses API
        response = client.responses.create(
            model="gpt-4.1-mini",
            instructions=STARTUP_ENGINE_INSTRUCTIONS,
            input=user_context,
        )

        # Safely extract text
        plan_text = getattr(response, "output_text", None)
        if not plan_text:
            # Fallback in case SDK format changes
            plan_text = str(response)

        return jsonify({"plan_markdown": plan_text})

    except Exception as e:
        print("Error calling OpenAI:", repr(e), flush=True)
        return jsonify({"error": "Failed to generate plan. Please try again later."}), 500


if __name__ == "__main__":
    # Local development only; Render will use gunicorn with `server:app`
    app.run(debug=True)
