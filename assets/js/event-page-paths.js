(function () {
  function normalizeDate(value) {
    var raw = String(value || "").trim();
    if (!raw) return "";

    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      return raw;
    }

    var parsed = new Date(raw);
    if (isNaN(parsed.getTime())) {
      return raw;
    }

    var year = parsed.getFullYear();
    var month = String(parsed.getMonth() + 1).padStart(2, "0");
    var day = String(parsed.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
  }

  function sanitizeSlug(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function buildEventPageFileSlug(item) {
    var row = item || {};
    var date = normalizeDate(row.date);
    var title = String(row.title || "").trim();
    var fallbackSlug = String(row.slug || "").trim();
    var parts = date.split("-");
    var formattedDate = parts.length === 3 ? [parts[2], parts[1], parts[0]].join("-") : date;
    return sanitizeSlug(formattedDate + "-" + title) || sanitizeSlug(fallbackSlug);
  }

  function buildEventPageUrl(item) {
    return "events/" + buildEventPageFileSlug(item) + ".html";
  }

  window.TACT_EVENT_PAGES = {
    normalizeDate: normalizeDate,
    sanitizeSlug: sanitizeSlug,
    buildEventPageFileSlug: buildEventPageFileSlug,
    buildEventPageUrl: buildEventPageUrl
  };
})();
