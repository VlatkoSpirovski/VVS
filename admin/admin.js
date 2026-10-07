const state = {
  vehicles: [],
  features: [],
  selectedFeatureIds: new Set(),
  images: [],
  editingId: null
};

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  if (response.status === 401) {
    window.location.href = "/admin/login";
    return null;
  }
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || "Request failed");
  }
  return response.json();
}

function formatAdminPrice(vehicle) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: vehicle.currency || "EUR",
    maximumFractionDigits: 0
  }).format(Number(vehicle.price || 0));
}

function formatAdminKm(value) {
  return `${new Intl.NumberFormat("de-DE").format(Number(value || 0))} km`;
}

function slugifyAdmin(value) {
  return value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function loadAdmin() {
  const [dashboard, vehicles, features, inquiries] = await Promise.all([
    api("/api/admin/dashboard"),
    api("/api/admin/vehicles?lang=mk"),
    api("/api/admin/features"),
    api("/api/admin/inquiries")
  ]);
  state.vehicles = vehicles.vehicles;
  state.features = features.features;
  renderDashboard(dashboard.stats);
  renderVehicles();
  renderFeatures();
  renderInquiries(inquiries.inquiries);
}

function renderDashboard(stats) {
  const cards = [
    ["Возила", stats.total],
    ["Објавени", stats.published],
    ["Нацрти", stats.drafts],
    ["Продадени", stats.sold],
    ["Барања", stats.inquiries]
  ];
  $("#dashboard").innerHTML = cards.map(([label, value]) => `<article class="admin-card"><span>${label}</span><strong>${value}</strong></article>`).join("");
}

function renderVehicles() {
  $("#vehicleRows").innerHTML = state.vehicles
    .map(
      (vehicle) => `
        <tr>
          <td><img class="admin-thumb" src="${vehicle.coverUrl || "/assets/vvs-auto-logo.jpeg"}" alt="${vehicle.title}"></td>
          <td><strong>${vehicle.title}</strong><br><small>${vehicle.brand} ${vehicle.model} · ${vehicle.stockNumber || ""}</small></td>
          <td>${vehicle.year || ""}</td>
          <td>${formatAdminPrice(vehicle)}</td>
          <td>${formatAdminKm(vehicle.mileage)}</td>
          <td>${vehicle.status}</td>
          <td>${vehicle.featured ? "Да" : "Не"}</td>
          <td>${vehicle.published ? "Да" : "Не"}</td>
          <td class="row-actions">
            <button type="button" data-action="edit" data-id="${vehicle.id}">Edit</button>
            <a href="/mk/vozila/${vehicle.slug}.html" target="_blank">View</a>
            <button type="button" data-action="duplicate" data-id="${vehicle.id}">Duplicate</button>
            <button type="button" data-action="publish" data-id="${vehicle.id}">${vehicle.published ? "Unpublish" : "Publish"}</button>
            <button type="button" data-action="delete" data-id="${vehicle.id}">Delete</button>
          </td>
        </tr>`
    )
    .join("");
}

function renderFeatures() {
  $("#featureGrid").innerHTML = state.features
    .map(
      (feature) => `
        <label class="feature-chip">
          <input type="checkbox" value="${feature.id}" ${state.selectedFeatureIds.has(feature.id) ? "checked" : ""}>
          <span>${feature.name_mk}<small>${feature.name_en}</small></span>
        </label>`
    )
    .join("");
}

function renderInquiries(inquiries) {
  $("#inquiryRows").innerHTML =
    inquiries
      .map(
        (inquiry) => `
          <article class="inquiry-card">
            <div><strong>${inquiry.name}</strong><br><small>${inquiry.phone}${inquiry.email ? ` · ${inquiry.email}` : ""}</small></div>
            <p>${inquiry.message || ""}</p>
            <small>${inquiry.brand || ""} ${inquiry.model || ""} · ${new Date(inquiry.created_at).toLocaleString()}</small>
          </article>`
      )
      .join("") || "<p>No inquiries yet.</p>";
}

function setActiveTab(tab) {
  $$(".admin-tab").forEach((button) => button.classList.toggle("active", button.dataset.tab === tab));
  $$(".admin-tab-panel").forEach((panel) => panel.classList.toggle("active", panel.dataset.panel === tab));
}

function setField(id, value) {
  const node = $(`#${id}`);
  if (node) node.value = value ?? "";
}

function openEditor(vehicle = null) {
  state.editingId = vehicle?.id || null;
  state.selectedFeatureIds = new Set((vehicle?.features || []).map((feature) => feature.id));
  state.images = (vehicle?.images || []).map((image) => ({ ...image, isCover: Boolean(image.isCover) }));

  $("#editorTitle").textContent = vehicle ? "Edit vehicle" : "Додади возило";
  $("#editorPanel").hidden = false;
  setActiveTab("basic");

  const fields = [
    "brand",
    "model",
    "variant",
    "slug",
    "stockNumber",
    "year",
    "price",
    "currency",
    "mileage",
    "status",
    "fuel",
    "transmission",
    "drive",
    "engine",
    "engineSize",
    "power",
    "torque",
    "bodyType",
    "doors",
    "seats",
    "exteriorColor",
    "interiorColor",
    "firstRegistration",
    "location",
    "availability"
  ];

  fields.forEach((field) => setField(field, vehicle?.[field]));
  $("#vehicleId").value = vehicle?.id || "";
  $("#published").checked = Boolean(vehicle?.published);
  $("#featured").checked = Boolean(vehicle?.featured);
  $("#titleMk").value = vehicle?.translations?.mk?.title || vehicle?.title || "";
  $("#titleEn").value = vehicle?.translations?.en?.title || vehicle?.title || "";
  $("#descriptionMk").value = vehicle?.translations?.mk?.description || "";
  $("#descriptionEn").value = vehicle?.translations?.en?.description || "";
  $("#photoInput").value = state.images.map((image) => image.url).join("\n");

  renderFeatures();
  renderPhotoPreview();
  $("#editorPanel").scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderPhotoPreview() {
  $("#photoPreview").innerHTML = state.images
    .map(
      (image, index) => `
        <article class="photo-admin-card">
          <img src="${image.url}" alt="Vehicle image">
          <label><input type="radio" name="coverImage" data-photo-action="cover" data-index="${index}" ${image.isCover ? "checked" : ""}> Cover</label>
          <div class="row-actions">
            <button type="button" data-photo-action="up" data-index="${index}">Up</button>
            <button type="button" data-photo-action="down" data-index="${index}">Down</button>
            <button type="button" data-photo-action="delete" data-index="${index}">Delete</button>
          </div>
        </article>`
    )
    .join("");
}

function syncPhotosFromTextarea() {
  const urls = $("#photoInput").value.split("\n").map((url) => url.trim()).filter(Boolean);
  state.images = urls.map((url, index) => ({
    url,
    isCover: state.images[index]?.isCover || index === 0
  }));
  if (!state.images.some((image) => image.isCover) && state.images[0]) state.images[0].isCover = true;
  renderPhotoPreview();
}

function collectVehicle() {
  const brand = $("#brand").value.trim();
  const model = $("#model").value.trim();
  const slug = $("#slug").value.trim() || slugifyAdmin(`${brand}-${model}`);

  return {
    slug,
    brand,
    model,
    variant: $("#variant").value.trim(),
    stockNumber: $("#stockNumber").value.trim(),
    year: Number($("#year").value) || null,
    price: Number($("#price").value) || 0,
    currency: $("#currency").value,
    mileage: Number($("#mileage").value) || null,
    mileageUnit: "km",
    status: $("#status").value,
    published: $("#published").checked,
    featured: $("#featured").checked,
    fuel: $("#fuel").value.trim(),
    transmission: $("#transmission").value.trim(),
    drive: $("#drive").value.trim(),
    engine: $("#engine").value.trim(),
    engineSize: $("#engineSize").value.trim(),
    power: $("#power").value.trim(),
    torque: $("#torque").value.trim(),
    bodyType: $("#bodyType").value.trim(),
    doors: Number($("#doors").value) || null,
    seats: Number($("#seats").value) || null,
    exteriorColor: $("#exteriorColor").value.trim(),
    interiorColor: $("#interiorColor").value.trim(),
    firstRegistration: $("#firstRegistration").value.trim(),
    location: $("#location").value.trim(),
    availability: $("#availability").value.trim(),
    translations: {
      mk: { title: $("#titleMk").value.trim() || `${brand} ${model}`, description: $("#descriptionMk").value.trim() },
      en: { title: $("#titleEn").value.trim() || `${brand} ${model}`, description: $("#descriptionEn").value.trim() }
    },
    images: state.images,
    featureIds: [...state.selectedFeatureIds]
  };
}

async function uploadFiles(files) {
  let signature;
  try {
    signature = await api("/api/admin/uploads/signature", {
      method: "POST",
      body: JSON.stringify({ folder: "vvs/vehicles" })
    });
  } catch (error) {
    alert("Cloudinary is not configured yet. Paste image URLs for now, then add Cloudinary env vars.");
    return;
  }

  for (const file of files) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("api_key", signature.apiKey);
    formData.append("timestamp", signature.timestamp);
    formData.append("folder", signature.folder);
    formData.append("signature", signature.signature);
    const response = await fetch(`https://api.cloudinary.com/v1_1/${signature.cloudName}/image/upload`, {
      method: "POST",
      body: formData
    });
    const uploaded = await response.json();
    if (uploaded.secure_url) {
      state.images.push({
        url: uploaded.secure_url,
        publicId: uploaded.public_id,
        width: uploaded.width,
        height: uploaded.height,
        isCover: state.images.length === 0
      });
    }
  }
  $("#photoInput").value = state.images.map((image) => image.url).join("\n");
  renderPhotoPreview();
}

$("#logoutButton").addEventListener("click", async () => {
  await api("/api/auth/logout", { method: "POST" });
  window.location.href = "/admin/login";
});

$("#addVehicleButton").addEventListener("click", () => openEditor());
$("#cancelEditButton").addEventListener("click", () => ($("#editorPanel").hidden = true));

$("#brand").addEventListener("input", () => {
  if (!$("#vehicleId").value) $("#slug").value = slugifyAdmin(`${$("#brand").value}-${$("#model").value}`);
});
$("#model").addEventListener("input", () => {
  if (!$("#vehicleId").value) $("#slug").value = slugifyAdmin(`${$("#brand").value}-${$("#model").value}`);
});

$(".admin-tabs").addEventListener("click", (event) => {
  const button = event.target.closest("[data-tab]");
  if (button) setActiveTab(button.dataset.tab);
});

$("#vehicleRows").addEventListener("click", async (event) => {
  const action = event.target.closest("[data-action]");
  if (!action) return;
  const id = action.dataset.id;

  if (action.dataset.action === "edit") {
    const { vehicle } = await api(`/api/admin/vehicles/${id}?lang=mk`);
    openEditor(vehicle);
  }

  if (action.dataset.action === "duplicate") {
    await api(`/api/admin/vehicles/${id}/duplicate`, { method: "POST" });
    await loadAdmin();
  }

  if (action.dataset.action === "publish") {
    await api(`/api/admin/vehicles/${id}/publish`, { method: "PATCH" });
    await loadAdmin();
  }

  if (action.dataset.action === "delete") {
    await api(`/api/admin/vehicles/${id}`, { method: "DELETE" });
    await loadAdmin();
  }
});

$("#featureGrid").addEventListener("change", (event) => {
  const input = event.target.closest("input[type='checkbox']");
  if (!input) return;
  if (input.checked) state.selectedFeatureIds.add(input.value);
  else state.selectedFeatureIds.delete(input.value);
});

$("#addFeatureButton").addEventListener("click", async () => {
  const nameMk = $("#newFeatureMk").value.trim();
  const nameEn = $("#newFeatureEn").value.trim();
  if (!nameMk || !nameEn) return;
  const { feature } = await api("/api/admin/features", {
    method: "POST",
    body: JSON.stringify({ nameMk, nameEn })
  });
  state.features.push(feature);
  state.selectedFeatureIds.add(feature.id);
  $("#newFeatureMk").value = "";
  $("#newFeatureEn").value = "";
  renderFeatures();
});

$("#syncPhotosButton").addEventListener("click", syncPhotosFromTextarea);
$("#photoUpload").addEventListener("change", (event) => uploadFiles(event.target.files));

$("#photoPreview").addEventListener("click", (event) => {
  const control = event.target.closest("[data-photo-action]");
  if (!control) return;
  const index = Number(control.dataset.index);
  const action = control.dataset.photoAction;
  if (action === "cover") state.images.forEach((image, i) => (image.isCover = i === index));
  if (action === "delete") state.images.splice(index, 1);
  if (action === "up" && index > 0) [state.images[index - 1], state.images[index]] = [state.images[index], state.images[index - 1]];
  if (action === "down" && index < state.images.length - 1) [state.images[index], state.images[index + 1]] = [state.images[index + 1], state.images[index]];
  if (!state.images.some((image) => image.isCover) && state.images[0]) state.images[0].isCover = true;
  $("#photoInput").value = state.images.map((image) => image.url).join("\n");
  renderPhotoPreview();
});

$("#vehicleForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  syncPhotosFromTextarea();
  const body = collectVehicle();
  const id = $("#vehicleId").value;
  await api(id ? `/api/admin/vehicles/${id}` : "/api/admin/vehicles", {
    method: id ? "PUT" : "POST",
    body: JSON.stringify(body)
  });
  $("#editorPanel").hidden = true;
  await loadAdmin();
});

loadAdmin().catch((error) => {
  console.error(error);
  alert(error.message);
});
