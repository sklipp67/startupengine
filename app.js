document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("startupForm");
  const generateButton = document.getElementById("generateButton");
  const copyButton = document.getElementById("copyButton");
  const downloadPdfButton = document.getElementById("downloadPdfButton");
  const spinner = document.getElementById("spinner");
  const errorMessage = document.getElementById("errorMessage");
  const planOutput = document.getElementById("planOutput");
  const printTitleEl = document.getElementById("printTitle");
  const timelineSelect = document.getElementById("timeline");
  const customTimelineField = document.getElementById("customTimelineField");
  const customTimelineInput = document.getElementById("customTimeline");
  const supportFilesInput = document.getElementById("supportFiles");
  const supportFilesSummary = document.getElementById("supportFilesSummary");

  let lastPlanMarkdown = "";
  let lastPlanTitle = "";
  let extraNotesText = "";

  // Helper: capitalize first letter of the business idea
  function capitalizeFirst(str) {
    if (!str) return "";
    const trimmed = str.trim();
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  }

  // Helper: convert markdown to cleaner plain text for clipboard
  function markdownToPlain(md) {
    if (!md) return "";

    let text = md;

    // Remove markdown headings like "# ", "## ", "### "
    text = text.replace(/^#{1,6}\s*/gm, "");

    // Remove bold/italic markers like **text** or *text*
    text = text.replace(/\*\*(.*?)\*\*/g, "$1");
    text = text.replace(/\*(.*?)\*/g, "$1");

    // Remove inline code markers `code`
    text = text.replace(/`([^`]+)`/g, "$1");

    // Simplify table pipes (just remove them, keep text)
    text = text.replace(/^\|/gm, "");
    text = text.replace(/\|$/gm, "");
    text = text.replace(/\s*\|\s*/g, "  ");

    // Collapse 3+ blank lines into 2
    text = text.replace(/\n{3,}/g, "\n\n");

    return text.trim();
  }

  // Helper: wrap "Important Disclaimer" section in a styled box
  function styleDisclaimer(rootEl) {
    if (!rootEl) return;

    const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_ELEMENT, null);
    let startNode = null;

    while (walker.nextNode()) {
      const el = walker.currentNode;
      const text = (el.textContent || "").trim();
      if (/^Important Disclaimer\b/i.test(text)) {
        startNode = el;
        break;
      }
    }

    if (!startNode || !startNode.parentNode) return;

    const box = document.createElement("div");
    box.className = "disclaimer-box";

    const parent = startNode.parentNode;
    parent.insertBefore(box, startNode);

    let current = startNode;
    while (current) {
      const next = current.nextSibling;
      box.appendChild(current);
      current = next;
    }
  }

  // Handle supporting files upload (client-side text read)
  if (supportFilesInput) {
    supportFilesInput.addEventListener("change", () => {
      extraNotesText = "";
      if (supportFilesSummary) supportFilesSummary.textContent = "";

      const files = Array.from(supportFilesInput.files || []);
      if (!files.length) return;

      const textFiles = files.filter((file) => {
        return (
          /^text\//.test(file.type) ||
          /\.(txt|md|csv|json)$/i.test(file.name)
        );
      });

      if (!textFiles.length) {
        if (supportFilesSummary) {
          supportFilesSummary.textContent =
            "Selected files are not text-based. For now, please upload .txt, .md, .csv, or .json files.";
        }
        return;
      }

      let loadedCount = 0;
      textFiles.forEach((file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result || "";
          extraNotesText += `\n\n--- File: ${file.name} ---\n${content}`;
          loadedCount += 1;
          if (loadedCount === textFiles.length && supportFilesSummary) {
            const label =
              textFiles.length === 1
                ? "1 supporting file loaded."
                : `${textFiles.length} supporting files loaded.`;
            supportFilesSummary.textContent = label;
          }
        };
        reader.onerror = () => {
          loadedCount += 1;
        };
        reader.readAsText(file);
      });
    });
  }

  // Show / hide custom timeline input based on dropdown
  timelineSelect.addEventListener("change", () => {
    if (timelineSelect.value === "custom") {
      customTimelineField.style.display = "block";
    } else {
      customTimelineField.style.display = "none";
      customTimelineInput.value = "";
    }
  });

  // Handle form submit
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorMessage.textContent = "";
    lastPlanMarkdown = "";
    lastPlanTitle = "";
    copyButton.disabled = true;
    downloadPdfButton.disabled = true;

    const userType = document.getElementById("userType").value;
    const experienceLevel = document.getElementById("experienceLevel").value;
    const businessIdea = document.getElementById("businessIdea").value.trim();
    const location = document.getElementById("location").value.trim();
    const budget = document.getElementById("budget").value.trim();
    const timeline = timelineSelect.value;
    const customTimeline = customTimelineInput.value.trim();
    const goals = document.getElementById("goals").value.trim();
    const targetCustomer = document.getElementById("targetCustomer").value.trim();
    const challenges = document.getElementById("challenges").value.trim();
    const skills = document.getElementById("skills").value.trim();
    const uniqueValue = document.getElementById("uniqueValue").value.trim();
    const vision = document.getElementById("vision").value.trim();

    // Collect sales channel checkboxes
    const salesChannelNodes = document.querySelectorAll("input[name='salesChannels']:checked");
    const salesChannels = Array.from(salesChannelNodes).map((node) => node.value);

    if (!businessIdea) {
      errorMessage.textContent = "Please describe your business idea before generating a plan.";
      return;
    }

    const payload = {
      user_type: userType,
      experience_level: experienceLevel,
      business_idea: businessIdea,
      location,
      budget,
      timeline,
      custom_timeline: customTimeline,
      goals,
      target_customer: targetCustomer,
      challenges,
      skills,
      unique_value: uniqueValue,
      vision,
      preferredSalesChannels: salesChannels,
      extra_notes_text: extraNotesText.trim(), // new field from uploaded files
    };

    // UI: show spinner, disable button
    spinner.classList.remove("hidden");
    generateButton.disabled = true;
    generateButton.textContent = "Generating…";

    try {
      const response = await fetch("/api/startup-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Request failed");
      }

      const data = await response.json();

      lastPlanMarkdown = data.plan_markdown || data.plan || "";

      if (!lastPlanMarkdown) {
        throw new Error("No plan returned from the server.");
      }

      // Build a nice dynamic title based on the business idea
      const normalizedIdea = capitalizeFirst(businessIdea || "");
      if (normalizedIdea) {
        lastPlanTitle = `${normalizedIdea} – Startup plan`;
      } else {
        lastPlanTitle = "Startup Engine – Startup plan";
      }

      // Update browser tab title and print heading
      document.title = lastPlanTitle;
      if (printTitleEl) {
        printTitleEl.textContent = lastPlanTitle;
      }

      // Render as Markdown if marked is available
      if (window.marked && typeof window.marked.parse === "function") {
        planOutput.innerHTML = window.marked.parse(lastPlanMarkdown);
        styleDisclaimer(planOutput);
      } else {
        planOutput.textContent = lastPlanMarkdown;
      }

      copyButton.disabled = false;
      downloadPdfButton.disabled = false;
    } catch (err) {
      console.error("Error generating plan:", err);
      errorMessage.textContent = "Something went wrong while generating your plan. Please try again.";
    } finally {
      spinner.classList.add("hidden");
      generateButton.disabled = false;
      generateButton.textContent = "Generate startup plan";
    }
  });

  // Copy to clipboard handler (clean text)
  copyButton.addEventListener("click", async () => {
    if (!lastPlanMarkdown) return;

    const planTitle = lastPlanTitle || "Startup Engine – Startup plan";
    const plainBody = markdownToPlain(lastPlanMarkdown);

    const textToCopy = `${planTitle}\n\n${plainBody}`;

    try {
      await navigator.clipboard.writeText(textToCopy);
      const originalText = copyButton.textContent;
      copyButton.textContent = "Copied!";
      setTimeout(() => {
        copyButton.textContent = originalText;
      }, 1400);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  });

  // Download as PDF (via print dialog)
  downloadPdfButton.addEventListener("click", () => {
    if (!lastPlanMarkdown) return;
    window.print();
  });
});
