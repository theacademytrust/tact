/*
  Google Apps Script backend for admin.html
  Deploy as: Web app
  - Execute as: Me
  - Who has access: Anyone

  Required Script Properties:
  - ADMIN_PIN = <admin pin>
  - GITHUB_TOKEN = <GitHub token with repo contents write access>
  - GITHUB_OWNER = <repo owner, for example theacademytrust>
  - GITHUB_REPO = <repo name, for example tact>

  Optional Script Properties:
  - GITHUB_BRANCH = main
  - GITHUB_EVENTS_ROOT = content/events
  - GITHUB_EVENT_PAGES_ROOT = events
*/

var DEFAULT_SETUP = {
  GITHUB_OWNER: "theacademytrust",
  GITHUB_REPO: "tact",
  GITHUB_BRANCH: "main",
  GITHUB_EVENTS_ROOT: "content/events",
  GITHUB_EVENT_PAGES_ROOT: "events",
  GITHUB_GALLERY_DATA_PATH: "data/gallery.json",
  GITHUB_GALLERY_IMAGES_ROOT: "images/gallery",
  ADMIN_PIN: "1234"
};

function doPost(e) {
  try {
    var payload = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    var action = String(payload.action || "");
    var pin = String(payload.pin || "");
    var oldPin = String(payload.oldPin || "");
    var newPin = String(payload.newPin || "");
    var eventObj = payload.event || {};
    var posterObj = payload.poster || {};

    var props = PropertiesService.getScriptProperties();
    var adminPin = String(props.getProperty("ADMIN_PIN") || "");

    if (action === "pinStatus") {
      return jsonOut({ ok: true, pinConfigured: !!adminPin }, 200);
    }
    if (action === "verifyPin") {
      if (!adminPin) return jsonOut({ ok: false, error: "PIN not set" }, 400);
      if (pin !== adminPin) return jsonOut({ ok: false, error: "Invalid PIN" }, 401);
      return jsonOut({ ok: true, pinConfigured: true }, 200);
    }
    if (action === "changePin") {
      if (!isValidPin(newPin)) {
        return jsonOut({ ok: false, error: "New PIN must be at least 4 digits." }, 400);
      }
      if (adminPin && oldPin !== adminPin) {
        return jsonOut({ ok: false, error: "Current PIN is incorrect." }, 401);
      }

      props.setProperty("ADMIN_PIN", newPin);
      return jsonOut({ ok: true, pinConfigured: true }, 200);
    }

    if (!adminPin) {
      return jsonOut({ ok: false, error: "PIN is not set. Set PIN first." }, 401);
    }
    if (pin !== adminPin) {
      return jsonOut({ ok: false, error: "Invalid PIN" }, 401);
    }

    if (action === "listEvents") {
      return jsonOut({ ok: true, events: listEventsFromGitHub(props) }, 200);
    }
    if (action === "getEventDetails") {
      return jsonOut({ ok: true, event: getEventDetailsFromGitHub(props, payload.slug), gallery: getGalleryEntryForEvent(props, payload.slug) }, 200);
    }
    if (action === "deleteEvent") {
      return jsonOut(deleteEventFromGitHub(props, payload.slug), 200);
    }
    if (action === "updateEvent") {
      return jsonOut(updateEventInGitHub(props, payload.event, payload.poster, payload.removePoster), 200);
    }
    if (action === "listGallery") {
      return jsonOut({ ok: true, galleries: listGalleryFromGitHub(props) }, 200);
    }
    if (action === "saveGallery") {
      return jsonOut(saveGalleryToGitHub(props, payload.gallery, payload.images), 200);
    }
    if (action === "deleteGalleryImage") {
      return jsonOut(deleteGalleryImageFromGitHub(props, payload.eventSlug, payload.imageUrl), 200);
    }

    var result = publishEventToGitHub(props, eventObj, posterObj);
    return jsonOut(result, 200);
  } catch (err) {
    return jsonOut({ ok: false, error: String(err && err.message ? err.message : err) }, 500);
  }
}

function publishEventToGitHub(props, eventObj, posterObj) {
  var repo = getRepoConfig(props);
  var slug = sanitizeSlug(eventObj.slug || buildSlug(eventObj.date, eventObj.title));
  var title = String(eventObj.title || "").trim();
  var date = normalizeDate(eventObj.date);
  var time = String(eventObj.time || "").trim();
  var location = String(eventObj.location || "").trim();
  var status = normalizeStatus(eventObj.status);
  var teaser = String(eventObj.teaser || "").trim();
  var homepageMatter = String(eventObj.homepageMatter || "").trim();

  if (!slug || !title || !date || !time || !location) {
    throw new Error("Missing required event fields.");
  }
  if (!posterObj || !posterObj.data) {
    throw new Error("Poster image is required.");
  }

  var ext = inferPosterExtension(posterObj);
  var eventDir = joinPath(repo.eventsRoot, slug);
  var posterPath = joinPath(eventDir, "poster" + ext);
  var eventPath = joinPath(eventDir, "event.json");
  var preEventPath = joinPath(eventDir, "pre-event.txt");
  var postEventPath = joinPath(eventDir, "post-event.md");

  removeOtherPosterVariants(repo, eventDir, "poster" + ext);

  var eventContent = buildEventJson({
    slug: slug,
    title: title,
    date: date,
    time: time,
    location: location,
    teaser: teaser,
    homepageMatter: homepageMatter,
    status: status
  });

  putTextFile(repo, eventPath, eventContent, "Publish event metadata for " + slug);
  putIfMissing(repo, preEventPath, "Short pre-event note.\n", "Create pre-event note for " + slug);
  putIfMissing(
    repo,
    postEventPath,
    "# Post Event Notes\n\n- Speakers:\n- Highlights:\n- Attendance:\n- Outcomes:\n",
    "Create post-event notes for " + slug
  );
  putBinaryFile(repo, posterPath, String(posterObj.data || ""), "Publish event poster for " + slug);
  rebuildFeed(repo);

  return {
    ok: true,
    slug: slug,
    posterPath: posterPath,
    pagePath: buildEventPagePath(repo, slug, date, title),
    feedPath: joinPath(repo.eventsRoot, "events-feed.js")
  };
}

function updateEventInGitHub(props, eventObj, posterObj, removePosterValue) {
  var repo = getRepoConfig(props);
  var slug = sanitizeSlug(eventObj && eventObj.slug);
  var currentMeta = getEventMeta(repo, slug);
  if (!slug || !currentMeta) {
    throw new Error("Selected event could not be found.");
  }

  var title = String(eventObj.title || currentMeta.title).trim();
  var date = normalizeDate(eventObj.date || currentMeta.date);
  var time = String(eventObj.time || currentMeta.time).trim();
  var location = String(eventObj.location || currentMeta.location).trim();
  var teaser = String(eventObj.teaser || currentMeta.teaser).trim();
  var homepageMatter = String(eventObj.homepageMatter || currentMeta.homepageMatter).trim();
  var status = normalizeStatus(eventObj.status || currentMeta.status);
  var eventDir = joinPath(repo.eventsRoot, slug);
  var eventPath = joinPath(eventDir, "event.json");
  var removePoster = String(removePosterValue || "") === "true" || removePosterValue === true;
  var posterPath = "";

  if (!title || !date || !location) {
    throw new Error("Missing required event fields.");
  }

  putTextFile(repo, eventPath, buildEventJson({
    slug: slug,
    title: title,
    date: date,
    time: time,
    location: location,
    teaser: teaser,
    homepageMatter: homepageMatter,
    status: status
  }), "Update event metadata for " + slug);

  if (removePoster) {
    deletePosterFiles(repo, eventDir);
  }

  if (posterObj && posterObj.data) {
    var ext = inferPosterExtension(posterObj);
    posterPath = joinPath(eventDir, "poster" + ext);
    removeOtherPosterVariants(repo, eventDir, "poster" + ext);
    putBinaryFile(repo, posterPath, String(posterObj.data || ""), "Update event poster for " + slug);
  }

  rebuildFeed(repo);

  return {
    ok: true,
    slug: slug,
    posterPath: posterPath,
    pagePath: buildEventPagePath(repo, slug, date, title),
    feedPath: joinPath(repo.eventsRoot, "events-feed.js")
  };
}

function rebuildFeed(repo) {
  var feed = collectFeedEntries(repo);

  feed.sort(function (a, b) {
    return String(a.date || "").localeCompare(String(b.date || ""));
  });

  var content =
    "/* AUTO-GENERATED by Apps Script GitHub publish */\n\n" +
    "window.TACT_EVENT_FEED = " +
    JSON.stringify(feed, null, 2) +
    ";\n";

  putTextFile(repo, joinPath(repo.eventsRoot, "events-feed.js"), content, "Rebuild static event feed");
  rebuildEventPages(repo, feed);
}

function listEventsFromGitHub(props) {
  var repo = getRepoConfig(props);
  var feed = collectFeedEntries(repo);

  feed.sort(function (a, b) {
    return String(b.date || "").localeCompare(String(a.date || ""));
  });

  var summaries = [];
  for (var i = 0; i < feed.length; i++) {
    var item = feed[i] || {};
    summaries.push({
      slug: String(item.slug || ""),
      title: String(item.title || ""),
      date: normalizeDate(item.date),
      time: String(item.time || ""),
      location: String(item.location || ""),
      status: normalizeStatus(item.status)
    });
  }

  return summaries;
}

function getEventDetailsFromGitHub(props, slugValue) {
  var repo = getRepoConfig(props);
  var slug = sanitizeSlug(slugValue);
  if (!slug) {
    throw new Error("Missing event slug.");
  }

  var feed = collectFeedEntries(repo);
  for (var i = 0; i < feed.length; i++) {
    var item = feed[i] || {};
    if (String(item.slug || "") === slug) {
      return item;
    }
  }

  throw new Error("Selected event could not be found.");
}

function collectFeedEntries(repo) {
  var rootEntries = listDirectory(repo, repo.eventsRoot);
  var feed = [];

  for (var i = 0; i < rootEntries.length; i++) {
    var entry = rootEntries[i];
    if (!entry || entry.type !== "dir" || String(entry.name || "").charAt(0) === "_") continue;

    var dirPath = entry.path;
    var dirEntries = listDirectory(repo, dirPath);
    var eventJsonPath = "";
    var posterPath = "";
    var fallbackPosterPath = "";

    for (var j = 0; j < dirEntries.length; j++) {
      var child = dirEntries[j];
      var childName = String(child.name || "");
      if (child.type === "file" && childName === "event.json") {
        eventJsonPath = child.path;
      } else if (child.type === "file" && /^poster\.(jpg|jpeg|png|webp|svg)$/i.test(childName)) {
        posterPath = child.path;
      } else if (child.type === "dir" && childName === "gallery" && !fallbackPosterPath) {
        var galleryEntries = listDirectory(repo, child.path);
        for (var k = 0; k < galleryEntries.length; k++) {
          var image = galleryEntries[k];
          if (image.type === "file" && /\.(jpg|jpeg|png|webp|svg)$/i.test(String(image.name || ""))) {
            fallbackPosterPath = image.path;
            break;
          }
        }
      }
    }

    if (!eventJsonPath) continue;

    var meta = parseJsonFile(repo, eventJsonPath);
    var poster = posterPath || fallbackPosterPath;
    if (!meta || !meta.slug || !meta.title || !meta.date) continue;

    feed.push({
      slug: String(meta.slug || ""),
      title: String(meta.title || ""),
      date: normalizeDate(meta.date),
      time: String(meta.time || ""),
      location: String(meta.location || ""),
      status: normalizeStatus(meta.status),
      folder: dirPath,
      pageUrl: buildEventPagePath(repo, String(meta.slug || ""), normalizeDate(meta.date), String(meta.title || "")),
      poster: poster,
      teaser: String(meta.teaser || ""),
      homepageMatter: String(meta.homepageMatter || "")
    });
  }

  return feed;
}

function deleteEventFromGitHub(props, slugValue) {
  var repo = getRepoConfig(props);
  var slug = sanitizeSlug(slugValue);
  var currentMeta = getEventMeta(repo, slug);
  if (!slug) {
    throw new Error("Missing event slug.");
  }

  deleteDirectoryRecursive(repo, joinPath(repo.eventsRoot, slug));
  if (currentMeta) {
    deleteFileIfExists(
      repo,
      buildEventPagePath(repo, slug, currentMeta.date, currentMeta.title),
      "Delete generated event page for " + slug
    );
  }
  removeGalleryEntryForEvent(repo, slug);
  rebuildFeed(repo);

  return {
    ok: true,
    slug: slug,
    feedPath: joinPath(repo.eventsRoot, "events-feed.js")
  };
}

function deleteDirectoryRecursive(repo, path) {
  var entries = listDirectory(repo, path);

  for (var i = 0; i < entries.length; i++) {
    var entry = entries[i];
    if (entry.type === "dir") {
      deleteDirectoryRecursive(repo, entry.path);
      continue;
    }
    if (entry.type !== "file") continue;

    githubRequest(repo, "delete", "contents/" + encodePath(entry.path), {
      message: "Delete " + entry.path,
      sha: String(entry.sha || ""),
      branch: repo.branch
    });
  }
}

function getRepoConfig(props) {
  var token = String(props.getProperty("GITHUB_TOKEN") || "");
  var owner = String(props.getProperty("GITHUB_OWNER") || "");
  var repo = String(props.getProperty("GITHUB_REPO") || "");
  var branch = String(props.getProperty("GITHUB_BRANCH") || "main");
  var eventsRoot = String(props.getProperty("GITHUB_EVENTS_ROOT") || "content/events");
  var eventPagesRoot = String(props.getProperty("GITHUB_EVENT_PAGES_ROOT") || "events");
  var galleryDataPath = String(props.getProperty("GITHUB_GALLERY_DATA_PATH") || "data/gallery.json");
  var galleryImagesRoot = String(props.getProperty("GITHUB_GALLERY_IMAGES_ROOT") || "images/gallery");

  if (!token || !owner || !repo) {
    throw new Error("Missing GitHub script properties.");
  }

  return {
    token: token,
    owner: owner,
    repo: repo,
    branch: branch,
    eventsRoot: trimSlashes(eventsRoot),
    eventPagesRoot: trimSlashes(eventPagesRoot),
    galleryDataPath: trimSlashes(galleryDataPath),
    galleryImagesRoot: trimSlashes(galleryImagesRoot)
  };
}

function listGalleryFromGitHub(props) {
  var repo = getRepoConfig(props);
  return readGalleryEntries(repo);
}

function getGalleryEntryForEvent(props, slugValue) {
  var repo = getRepoConfig(props);
  var slug = sanitizeSlug(slugValue);
  if (!slug) return null;

  var entries = readGalleryEntries(repo);
  for (var i = 0; i < entries.length; i++) {
    var item = entries[i] || {};
    if (String(item.eventSlug || item.slug || "") === slug) {
      return item;
    }
  }

  return null;
}

function saveGalleryToGitHub(props, galleryObj, imageList) {
  var repo = getRepoConfig(props);
  var gallery = galleryObj || {};
  var images = Array.isArray(imageList) ? imageList : [];
  var eventSlug = sanitizeSlug(gallery.eventSlug || gallery.slug);
  var eventMeta = getEventMeta(repo, eventSlug);
  var galleryEntries = readGalleryEntries(repo);
  var currentEntry = null;

  if (!eventSlug) {
    throw new Error("Select an event first.");
  }
  if (!eventMeta) {
    throw new Error("Selected event could not be found.");
  }
  if (!images.length) {
    throw new Error("At least one gallery image is required.");
  }

  for (var existingIndex = 0; existingIndex < galleryEntries.length; existingIndex++) {
    var existingEntry = galleryEntries[existingIndex] || {};
    if (String(existingEntry.eventSlug || existingEntry.slug || "") === eventSlug) {
      currentEntry = existingEntry;
      break;
    }
  }

  var existingImages = currentEntry && Array.isArray(currentEntry.images) ? currentEntry.images.slice() : [];
  var galleryDir = joinPath(joinPath(repo.eventsRoot, eventSlug), "gallery");
  var nextIndex = existingImages.length;

  var uploadedImages = [];
  for (var i = 0; i < images.length; i++) {
    var imageObj = images[i] || {};
    var description = String(imageObj.description || "").trim();
    if (!imageObj.data || !description) {
      throw new Error("Each gallery image needs a file and description.");
    }

    var ext = inferPosterExtension(imageObj);
    var imagePath = joinPath(galleryDir, "image-" + padNumber(nextIndex + i + 1) + ext);
    putBinaryFile(repo, imagePath, String(imageObj.data || ""), "Publish gallery image " + (nextIndex + i + 1) + " for " + eventSlug);
    uploadedImages.push({
      url: imagePath,
      description: description
    });
  }

  var nextEntry = {
    slug: eventSlug,
    eventSlug: eventSlug,
    pageUrl: buildEventPagePath(repo, eventSlug, eventMeta.date, eventMeta.title),
    title: String(eventMeta.title || ""),
    date: normalizeDate(eventMeta.date),
    location: String(eventMeta.location || ""),
    images: existingImages.concat(uploadedImages)
  };
  var replaced = false;

  for (var j = 0; j < galleryEntries.length; j++) {
    if (String(galleryEntries[j].eventSlug || galleryEntries[j].slug || "") === eventSlug) {
      galleryEntries[j] = nextEntry;
      replaced = true;
      break;
    }
  }
  if (!replaced) {
    galleryEntries.push(nextEntry);
  }

  galleryEntries.sort(function (left, right) {
    return String(right.date || "").localeCompare(String(left.date || ""));
  });

  putTextFile(
    repo,
    repo.galleryDataPath,
    buildGalleryJson(galleryEntries),
    (replaced ? "Update" : "Create") + " gallery entry for " + eventSlug
  );
  rebuildFeed(repo);

  return {
    ok: true,
    slug: eventSlug,
    galleryPath: repo.galleryDataPath,
    imageCount: uploadedImages.length,
    totalImageCount: nextEntry.images.length
  };
}

function deleteGalleryImageFromGitHub(props, eventSlugValue, imageUrlValue) {
  var repo = getRepoConfig(props);
  var eventSlug = sanitizeSlug(eventSlugValue);
  var imageUrl = trimSlashes(imageUrlValue || "");
  if (!eventSlug || !imageUrl) {
    throw new Error("Missing gallery image details.");
  }

  var entries = readGalleryEntries(repo);
  var changed = false;
  var nextEntries = [];
  var totalImages = 0;

  for (var i = 0; i < entries.length; i++) {
    var entry = entries[i] || {};
    if (String(entry.eventSlug || entry.slug || "") !== eventSlug) {
      nextEntries.push(entry);
      continue;
    }

    var keptImages = [];
    var rowImages = Array.isArray(entry.images) ? entry.images : [];
    for (var j = 0; j < rowImages.length; j++) {
      var image = rowImages[j] || {};
      if (String(image.url || "") === imageUrl) {
        changed = true;
        continue;
      }
      keptImages.push(image);
    }

    if (keptImages.length) {
      entry.images = keptImages;
      totalImages = keptImages.length;
      nextEntries.push(entry);
    }
  }

  if (!changed) {
    throw new Error("Gallery image could not be found.");
  }

  deleteFileIfExists(repo, imageUrl, "Delete gallery image " + imageUrl);
  putTextFile(repo, repo.galleryDataPath, buildGalleryJson(nextEntries), "Update gallery after image delete for " + eventSlug);
  rebuildFeed(repo);

  return {
    ok: true,
    slug: eventSlug,
    imageUrl: imageUrl,
    totalImageCount: totalImages
  };
}

function readGalleryEntries(repo) {
  var file = getFile(repo, repo.galleryDataPath);
  if (!file.exists) return [];

  var text = String(file.content || "").replace(/^\uFEFF/, "").trim();
  if (!text) return [];

  var parsed = JSON.parse(text);
  var rows = Array.isArray(parsed) ? parsed : Array.isArray(parsed && parsed.galleries) ? parsed.galleries : [];
  var list = [];

  for (var i = 0; i < rows.length; i++) {
    var item = rows[i] || {};
    var title = String(item.title || "").trim();
    var date = normalizeDate(item.date);
    var location = String(item.location || "").trim();
    var slug = sanitizeSlug(item.slug || buildSlug(date, title));
    var eventSlug = sanitizeSlug(item.eventSlug || slug);
    var pageUrl = String(item.pageUrl || buildEventPagePath(repo, eventSlug, date, title)).trim();
    var images = Array.isArray(item.images) ? item.images : [];
    var normalizedImages = [];

    for (var j = 0; j < images.length; j++) {
      var image = images[j] || {};
      var url = trimSlashes(image.url || "");
      var description = String(image.description || "").trim();
      if (!url || !description) continue;
      normalizedImages.push({
        url: url,
        description: description
      });
    }

    if (!title || !date || !location || !normalizedImages.length) continue;

    list.push({
      slug: slug,
      eventSlug: eventSlug || slug,
      pageUrl: pageUrl,
      title: title,
      date: date,
      location: location,
      images: normalizedImages
    });
  }

  list.sort(function (left, right) {
    return String(right.date || "").localeCompare(String(left.date || ""));
  });

  return list;
}

function buildGalleryJson(entries) {
  return JSON.stringify(Array.isArray(entries) ? entries : [], null, 2) + "\n";
}

function buildEventPagePath(repo, slug, date, title) {
  var fileSlug = buildEventPageSlug(date, title, slug);
  return joinPath(repo.eventPagesRoot, fileSlug + ".html");
}

function buildEventPageSlug(date, title, fallbackSlug) {
  var normalizedDate = normalizeDate(date);
  var parts = String(normalizedDate || "").split("-");
  var formattedDate = parts.length === 3 ? [parts[2], parts[1], parts[0]].join("-") : String(normalizedDate || "");
  var fromMeta = sanitizeSlug(formattedDate + "-" + String(title || ""));
  if (fromMeta) return fromMeta;
  return sanitizeSlug(fallbackSlug);
}

function rebuildEventPages(repo, feed) {
  var items = Array.isArray(feed) ? feed : [];
  var keepMap = {};
  for (var i = 0; i < items.length; i++) {
    var item = items[i] || {};
    if (!item.slug) continue;
    var pagePath = buildEventPagePath(repo, item.slug, item.date, item.title);
    keepMap[pagePath] = true;
    putTextFile(
      repo,
      pagePath,
      buildEventDetailPageHtml(item),
      "Rebuild event page for " + item.slug
    );
  }
  deleteObsoleteEventPages(repo, keepMap);
}

function getEventMeta(repo, slug) {
  var cleanSlug = sanitizeSlug(slug);
  if (!cleanSlug) return null;
  var path = joinPath(joinPath(repo.eventsRoot, cleanSlug), "event.json");
  var meta = parseJsonFile(repo, path);
  if (!meta) return null;
  return {
    slug: cleanSlug,
    title: String(meta.title || "").trim(),
    date: normalizeDate(meta.date),
    time: String(meta.time || "").trim(),
    location: String(meta.location || "").trim(),
    teaser: String(meta.teaser || "").trim(),
    homepageMatter: String(meta.homepageMatter || "").trim(),
    status: normalizeStatus(meta.status)
  };
}

function removeGalleryEntryForEvent(repo, slug) {
  var cleanSlug = sanitizeSlug(slug);
  if (!cleanSlug) return;

  var list = readGalleryEntries(repo);
  var next = [];
  var changed = false;

  for (var i = 0; i < list.length; i++) {
    var item = list[i] || {};
    if (String(item.eventSlug || item.slug || "") === cleanSlug) {
      changed = true;
      continue;
    }
    next.push(item);
  }

  if (!changed) return;

  putTextFile(
    repo,
    repo.galleryDataPath,
    buildGalleryJson(next),
    "Remove gallery entry for deleted event " + cleanSlug
  );
}

function deleteFileIfExists(repo, path, message) {
  var file = getFile(repo, path);
  if (!file.exists || !file.sha) return;

  githubRequest(repo, "delete", "contents/" + encodePath(path), {
    message: String(message || "Delete " + path),
    sha: String(file.sha || ""),
    branch: repo.branch
  });
}

function deleteObsoleteEventPages(repo, keepMap) {
  var entries = [];
  try {
    entries = listDirectory(repo, repo.eventPagesRoot);
  } catch (err) {
    if (String(err && err.message || "").indexOf("404") >= 0) return;
    throw err;
  }

  for (var i = 0; i < entries.length; i++) {
    var entry = entries[i];
    if (!entry || entry.type !== "file") continue;
    if (!/\.html$/i.test(String(entry.name || ""))) continue;
    if (keepMap[String(entry.path || "")]) continue;

    githubRequest(repo, "delete", "contents/" + encodePath(entry.path), {
      message: "Remove obsolete generated event page " + entry.name,
      sha: String(entry.sha || ""),
      branch: repo.branch
    });
  }
}

function buildEventDetailPageHtml(item) {
  var title = String(item && item.title || "Event");
  var slug = sanitizeSlug(item && item.slug || "");
  var description = String(item && (item.homepageMatter || item.teaser) || "").trim() || "Event details from The Academy Trust (tAcT).";
  return (
    "<!doctype html>\n" +
    '<html lang="en">\n' +
    "<head>\n" +
    '  <meta charset="utf-8">\n' +
    '  <meta name="viewport" content="width=1240">\n' +
    "  <title>" + escapeHtmlHtml(title) + " - The Academy Trust (tAcT)</title>\n" +
    '  <meta name="description" content="' + escapeHtmlAttribute(description) + '">\n' +
    '  <link rel="stylesheet" href="../shared-ribbon.css">\n' +
    '  <link rel="stylesheet" href="../assets/css/public-site.css">\n' +
    '  <link rel="stylesheet" href="../assets/css/gallery.css">\n' +
    '  <link rel="stylesheet" href="../assets/css/event-detail.css">\n' +
    "</head>\n" +
    '<body data-page="event-detail" data-site-root="../" data-event-slug="' + escapeHtmlAttribute(slug) + '">\n' +
    '  <div class="wrap">\n' +
    '    <div id="site-header-root"></div>\n' +
    '    <main id="main">\n' +
    '      <section class="surface"><p class="event-detail-empty">Loading event details…</p></section>\n' +
    "    </main>\n" +
    '    <div id="site-footer-root"></div>\n' +
    "  </div>\n" +
    '  <div id="gallery-modal" class="gallery-modal" hidden>\n' +
    '    <div class="gallery-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="gallery-modal-title">\n' +
    '      <button id="gallery-modal-close" class="gallery-modal-close" type="button" aria-label="Close gallery modal" data-modal-dismiss>&times;</button>\n' +
    '      <div class="gallery-modal-media">\n' +
    '        <img id="gallery-modal-image" src="" alt="">\n' +
    "      </div>\n" +
    '      <div class="gallery-modal-copy">\n' +
    '        <h2 id="gallery-modal-title"></h2>\n' +
    '        <div class="gallery-modal-meta">\n' +
    '          <span id="gallery-modal-date"></span>\n' +
    '          <span id="gallery-modal-location"></span>\n' +
    "        </div>\n" +
    '        <p id="gallery-modal-description"></p>\n' +
    "      </div>\n" +
    "    </div>\n" +
    "  </div>\n" +
    '  <script src="../assets/js/site-chrome.js"></script>\n' +
    '  <script src="../content/events/events-feed.js"></script>\n' +
    '  <script src="../assets/js/gallery-data.js"></script>\n' +
    '  <script src="../assets/js/event-detail-page.js"></script>\n' +
    "</body>\n" +
    "</html>\n"
  );
}

function padNumber(value) {
  return String(Number(value || 0)).padStart(2, "0");
}

function listDirectory(repo, path) {
  var data = githubRequest(repo, "get", "contents/" + encodePath(path) + "?ref=" + encodeURIComponent(repo.branch));
  return Array.isArray(data) ? data : [];
}

function getFile(repo, path) {
  try {
    var data = githubRequest(repo, "get", "contents/" + encodePath(path) + "?ref=" + encodeURIComponent(repo.branch));
    return {
      exists: true,
      sha: String(data.sha || ""),
      content: decodeBase64Content(data.content),
      encoding: String(data.encoding || "")
    };
  } catch (err) {
    if (String(err && err.message || "").indexOf("404") >= 0) {
      return { exists: false, sha: "", content: "" };
    }
    throw err;
  }
}

function parseJsonFile(repo, path) {
  var file = getFile(repo, path);
  if (!file.exists) return null;
  // Some repo JSON files were saved with a UTF-8 BOM; strip it before parsing.
  var text = String(file.content || "").replace(/^\uFEFF/, "");
  return JSON.parse(text || "{}");
}

function putIfMissing(repo, path, text, message) {
  var file = getFile(repo, path);
  if (file.exists) return;
  putTextFile(repo, path, text, message);
}

function putTextFile(repo, path, text, message) {
  var file = getFile(repo, path);
  var payload = {
    message: message,
    content: Utilities.base64Encode(Utilities.newBlob(String(text || ""), "text/plain").getBytes()),
    branch: repo.branch
  };
  if (file.exists && file.sha) payload.sha = file.sha;
  githubRequest(repo, "put", "contents/" + encodePath(path), payload);
}

function putBinaryFile(repo, path, base64Content, message) {
  var file = getFile(repo, path);
  var payload = {
    message: message,
    content: String(base64Content || "").replace(/\s+/g, ""),
    branch: repo.branch
  };
  if (file.exists && file.sha) payload.sha = file.sha;
  githubRequest(repo, "put", "contents/" + encodePath(path), payload);
}

function deletePosterFiles(repo, eventDir) {
  var entries = [];
  try {
    entries = listDirectory(repo, eventDir);
  } catch (err) {
    if (String(err && err.message || "").indexOf("404") >= 0) return;
    throw err;
  }

  for (var i = 0; i < entries.length; i++) {
    var entry = entries[i];
    if (!entry || entry.type !== "file") continue;
    if (!/^poster\.(jpg|jpeg|png|webp|svg)$/i.test(String(entry.name || ""))) continue;

    githubRequest(repo, "delete", "contents/" + encodePath(entry.path), {
      message: "Delete poster " + entry.name,
      sha: String(entry.sha || ""),
      branch: repo.branch
    });
  }
}

function removeOtherPosterVariants(repo, eventDir, keepFilename) {
  var entries = [];
  try {
    entries = listDirectory(repo, eventDir);
  } catch (err) {
    if (String(err && err.message || "").indexOf("404") >= 0) return;
    throw err;
  }

  for (var i = 0; i < entries.length; i++) {
    var entry = entries[i];
    if (entry.type !== "file") continue;

    var name = String(entry.name || "");
    if (!/^poster\.(jpg|jpeg|png|webp|svg)$/i.test(name)) continue;
    if (name === keepFilename) continue;

    githubRequest(repo, "delete", "contents/" + encodePath(entry.path), {
      message: "Remove replaced poster " + name,
      sha: String(entry.sha || ""),
      branch: repo.branch
    });
  }
}

function githubRequest(repo, method, apiPath, payload) {
  var url = "https://api.github.com/repos/" + encodeURIComponent(repo.owner) + "/" + encodeURIComponent(repo.repo) + "/" + apiPath;
  var options = {
    method: String(method || "get").toUpperCase(),
    headers: {
      Authorization: "Bearer " + repo.token,
      Accept: "application/vnd.github+json"
    },
    muteHttpExceptions: true
  };

  if (payload) {
    options.contentType = "application/json";
    options.payload = JSON.stringify(payload);
  }

  var response = UrlFetchApp.fetch(url, options);
  var status = response.getResponseCode();
  var text = response.getContentText() || "";

  if (status < 200 || status >= 300) {
    throw new Error("GitHub API " + status + ": " + text);
  }

  return text ? JSON.parse(text) : {};
}

function buildEventJson(eventObj) {
  return (
    "{\n" +
    '  "slug": ' + jsonString(eventObj.slug) + ",\n" +
    '  "title": ' + jsonString(eventObj.title) + ",\n" +
    '  "date": ' + jsonString(eventObj.date) + ",\n" +
    '  "time": ' + jsonString(eventObj.time) + ",\n" +
    '  "location": ' + jsonString(eventObj.location) + ",\n" +
    '  "teaser": ' + jsonString(eventObj.teaser) + ",\n" +
    '  "homepageMatter": ' + jsonString(eventObj.homepageMatter) + ",\n" +
    '  "status": ' + jsonString(eventObj.status) + "\n" +
    "}\n"
  );
}

function jsonString(value) {
  return JSON.stringify(String(value || ""));
}

function escapeHtmlHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeHtmlAttribute(value) {
  return escapeHtmlHtml(value)
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function decodeBase64Content(value) {
  var clean = String(value || "").replace(/\s+/g, "");
  if (!clean) return "";
  return Utilities.newBlob(Utilities.base64Decode(clean)).getDataAsString("UTF-8");
}

function sanitizeSlug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildSlug(date, title) {
  return sanitizeSlug(String(date || "") + "--" + String(title || ""));
}

function normalizeDate(value) {
  var raw = String(value || "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return raw;
}

function normalizeStatus(value) {
  return String(value || "").toLowerCase() === "completed" ? "completed" : "scheduled";
}

function inferPosterExtension(posterObj) {
  var mime = String((posterObj && posterObj.mime) || "").toLowerCase();
  var name = String((posterObj && posterObj.name) || "").toLowerCase();
  if (mime.indexOf("svg") >= 0 || /\.svg$/.test(name)) return ".svg";
  if (mime.indexOf("webp") >= 0 || /\.webp$/.test(name)) return ".webp";
  if (mime.indexOf("png") >= 0 || /\.png$/.test(name)) return ".png";
  if (mime.indexOf("jpeg") >= 0 || mime.indexOf("jpg") >= 0 || /\.(jpe?g)$/.test(name)) return ".jpg";
  throw new Error("Unsupported poster type. Use JPG, PNG, WEBP, or SVG.");
}

function trimSlashes(value) {
  return String(value || "").replace(/^\/+|\/+$/g, "");
}

function joinPath(left, right) {
  return trimSlashes(left) + "/" + trimSlashes(right);
}

function encodePath(path) {
  var parts = String(path || "").split("/");
  var out = [];
  for (var i = 0; i < parts.length; i++) {
    out.push(encodeURIComponent(parts[i]));
  }
  return out.join("/");
}

function isValidPin(value) {
  return /^[0-9]{4,}$/.test(String(value || ""));
}

function jsonOut(obj, statusCode) {
  obj.statusCode = statusCode;
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}


function authorizeUrlFetch() {
    UrlFetchApp.fetch("https://api.github.com", { muteHttpExceptions: true });
}
