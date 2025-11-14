document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("startup-form");
  const outputDiv = document.getElementById("output");
  const generateBtn = document.getElementById("generate-btn");
  const copyBtn = document.getElementById("copy-btn");

  let lastPlanMarkdown = ""; // store raw markdown for copying

  function getSelectedChannels() {
    const checkboxes = document.querySelectorAll('input[name="channels"]:checked');
    return Array.from(checkboxes).map(cb => cb.value);
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const payload = {
      user_type: document.getElementById("user_type").value,
      business_idea: document.getElementById("business_idea").value,
      budget: document.getElementById("budget").value,
      location: document.getElementById("location").value,
      experience_level: document.getElementById("experience_level").value,
      timeline: document.getElementById("timeline").value,
      goals: document.getElementById("goals").value,
      target_customer: document.getElementById("target_customer").value,
      challenges: document.getElementById("challenges").value,
      vision: document.getElementById("vision").value,
      skills: document.getElementById("skills").value
        .split(",")
        .map(s => s.trim())
        .filter(Boolean),
      unique_value: document.getElementById("unique_value").value,
      preferred_sales_channels: getSelectedChannels(),
    };

    // basic front-end validation
    if (!payload.business_idea.trim()) {
      alert("Please enter your business idea.");
      return;
    }

    generateBtn.disabled = true;
    generateBtn.textContent = "Generating...";
    outputDiv.innerHTML = "<p class='placeholder-text'>Thinking through your startup plan...</p>";

    try {
      const response = await fetch("/api/startup-plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        lastPlanMarkdown = data.output || "";
        const html = marked.parse(lastPlanMarkdown);
        outputDiv.innerHTML = html;
        copyBtn.disabled = !lastPlanMarkdown;
      } else {
        outputDiv.textContent = "Error: " + (data.error || "Something went wrong.");
        lastPlanMarkdown = "";
        copyBtn.disabled = true;
      }
    } catch (err) {
      console.error(err);
      outputDiv.textContent = "Error talking to Startup Engine. Please try again.";
      lastPlanMarkdown = "";
      copyBtn.disabled = true;
    } finally {
      generateBtn.disabled = false;
      generateBtn.textContent = "Generate Startup Plan";
    }
  });

  copyBtn.addEventListener("click", async () => {
    if (!lastPlanMarkdown) return;

    try {
      await navigator.clipboard.writeText(lastPlanMarkdown);
      copyBtn.textContent = "Copied!";
      setTimeout(() => {
        copyBtn.textContent = "Copy plan";
      }, 1500);
    } catch (err) {
      console.error(err);
      alert("Could not copy to clipboard. You can still select and copy manually.");
    }
  });

  // Disable copy on first load
  copyBtn.disabled = true;
});
