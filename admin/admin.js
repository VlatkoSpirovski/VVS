const state = {
  vehicles: [],
  images: [],
  editingId: null
};

const $ = (selector, scope = document) => scope.querySelector(selector);

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

function formatAdminKm(value) {
  if (!value) return "";
  return `${new Intl.NumberFormat("de-DE").format(Number(value))} km`;
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
  const [dashboard, vehicles] = await Promise.all([
    api("/api/admin/dashboard"),
    api("/api/admin/vehicles?lang=mk")
  ]);
  state.vehicles = vehicles.vehicles;
  renderDashboard(dashboard.stats);
  renderVehicles();
}

function renderDashboard(stats) {
  const cards = [
    ["Возила", stats.total],
    ["Објавени", stats.published],
    ["Нацрти", stats.drafts],
    ["Издвоени", stats.featured]
  ];
  $("#dashboard").innerHTML = cards.map(([label, value]) => `<article class="admin-card"><span>${label}</span><strong>${value}</strong></article>`).join("");
}

function renderVehicles() {
  $("#vehicleRows").innerHTML = state.vehicles
    .map(
      (vehicle) => `
        <tr>
          <td><img class="admin-thumb" src="${vehicle.coverUrl || "/assets/vvs-auto-logo.jpeg"}" alt="${vehicle.title}"></td>
          <td><strong>${vehicle.brand} ${vehicle.model}</strong><br><small>${vehicle.title || ""}</small></td>
          <td>${vehicle.year || ""}</td>
          <td>${vehicle.fuel || ""}</td>
          <td>${formatAdminKm(vehicle.mileage)}</td>
          <td>${vehicle.published ? "Да" : "Не"}</td>
          <td class="actions-cell">
            <div class="row-actions table-actions">
              <button type="button" data-action="edit" data-id="${vehicle.id}">Edit</button>
              <a href="/mk/vozila/${vehicle.slug}.html" target="_blank">View</a>
              <button type="button" data-action="duplicate" data-id="${vehicle.id}">Duplicate</button>
              <button type="button" data-action="publish" data-id="${vehicle.id}">${vehicle.published ? "Unpublish" : "Publish"}</button>
              <button class="danger" type="button" data-action="delete" data-id="${vehicle.id}">Delete</button>
            </div>
          </td>
        </tr>`
    )
    .join("");
}

function setField(id, value) {
  const node = $(`#${id}`);
  if (node) node.value = value ?? "";
}

function vehicleTitle(vehicle) {
  return [vehicle?.brand, vehicle?.model, vehicle?.year].filter(Boolean).join(" ");
}

function openEditor(vehicle = null) {
  state.editingId = vehicle?.id || null;
  state.images = (vehicle?.images || []).map((image) => ({ ...image, isCover: Boolean(image.isCover) }));

  $("#editorTitle").textContent = vehicle ? "Edit vehicle" : "Додади возило";
  $("#editorPanel").hidden = false;

  [
    "brand",
    "model",
    "slug",
    "stockNumber",
    "year",
    "price",
    "currency",
    "mileage",
    "status",
    "fuel",
    "transmission",
    "power",
    "bodyType",
    "exteriorColor",
    "registration",
    "registeredUntil",
    "emissionClass"
  ].forEach((field) => setField(field, vehicle?.[field]));

  $("#vehicleId").value = vehicle?.id || "";
  $("#currency").value = vehicle?.currency || "EUR";
  $("#status").value = vehicle?.status || "published";
  $("#published").checked = vehicle ? Boolean(vehicle.published) : true;
  $("#featured").checked = Boolean(vehicle?.featured);
  $("#descriptionMk").value = vehicle?.translations?.mk?.description || vehicle?.description || "";
  $("#descriptionSq").value = vehicle?.translations?.sq?.description || "";
  $("#descriptionEn").value = vehicle?.translations?.en?.description || "";

  renderPhotoPreview();
  $("#editorPanel").scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderPhotoPreview() {
  $("#photoPreview").innerHTML = state.images
    .map(
      (image, index) => `
        <article class="photo-admin-card" draggable="true" data-photo-index="${index}">
          <img src="${image.url}" alt="Vehicle image">
          <div class="photo-card-footer">
            <label class="cover-choice"><input type="radio" name="coverImage" data-photo-action="cover" data-index="${index}" ${image.isCover ? "checked" : ""}> Cover photo</label>
            <button class="danger" type="button" data-photo-action="delete" data-index="${index}">Delete</button>
          </div>
        </article>`
    )
    .join("");
}

function collectVehicle() {
  const brand = $("#brand").value.trim();
  const model = $("#model").value.trim();
  const year = Number($("#year").value) || null;
  const existingSlug = $("#vehicleId").value ? $("#slug").value.trim() : "";
  const slug = existingSlug || slugifyAdmin(`${brand}-${model}-${year || ""}-${Date.now().toString(36)}`);
  const title = [brand, model, year].filter(Boolean).join(" ");

  return {
    slug,
    brand,
    model,
    variant: "",
    stockNumber: $("#stockNumber").value.trim() || null,
    year,
    price: Number($("#price").value) || 0,
    currency: $("#currency").value || "EUR",
    mileage: Number($("#mileage").value) || null,
    mileageUnit: "km",
    status: $("#published").checked ? "published" : ($("#status").value || "draft"),
    published: $("#published").checked,
    featured: $("#featured").checked,
    fuel: $("#fuel").value.trim(),
    transmission: $("#transmission").value.trim(),
    drive: "",
    engine: "",
    engineSize: "",
    power: $("#power").value.trim(),
    torque: "",
    bodyType: $("#bodyType").value.trim(),
    doors: null,
    seats: null,
    exteriorColor: $("#exteriorColor").value.trim(),
    interiorColor: "",
    firstRegistration: "",
    registration: $("#registration").value.trim(),
    registeredUntil: $("#registeredUntil").value.trim(),
    emissionClass: $("#emissionClass").value.trim(),
    location: "",
    availability: "",
    translations: {
      mk: { title, description: $("#descriptionMk").value.trim() },
      sq: { title, description: $("#descriptionSq").value.trim() },
      en: { title, description: $("#descriptionEn").value.trim() }
    },
    images: state.images,
    featureIds: []
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
    alert("Cloudinary upload is not configured yet. Add the Cloudinary environment variables in Vercel.");
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
  renderPhotoPreview();
}

$("#logoutButton").addEventListener("click", async () => {
  await api("/api/auth/logout", { method: "POST" });
  window.location.href = "/admin/login";
});

$("#addVehicleButton").addEventListener("click", () => openEditor());
$("#cancelEditButton").addEventListener("click", () => ($("#editorPanel").hidden = true));

["brand", "model", "year"].forEach((id) => {
  $(`#${id}`).addEventListener("input", () => {
    if (!$("#vehicleId").value) $("#slug").value = slugifyAdmin(`${$("#brand").value}-${$("#model").value}-${$("#year").value}`);
  });
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
    if (!confirm("Delete this vehicle?")) return;
    await api(`/api/admin/vehicles/${id}`, { method: "DELETE" });
    await loadAdmin();
  }
});

$("#photoUpload").addEventListener("change", (event) => uploadFiles(event.target.files));

$("#photoPreview").addEventListener("click", (event) => {
  const control = event.target.closest("[data-photo-action]");
  if (!control) return;
  const index = Number(control.dataset.index);
  const action = control.dataset.photoAction;
  if (action === "cover") state.images.forEach((image, i) => (image.isCover = i === index));
  if (action === "delete") state.images.splice(index, 1);
  if (!state.images.some((image) => image.isCover) && state.images[0]) state.images[0].isCover = true;
  renderPhotoPreview();
});

$("#photoPreview").addEventListener("dragstart", (event) => {
  const card = event.target.closest(".photo-admin-card");
  if (!card) return;
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", card.dataset.photoIndex);
  card.classList.add("dragging");
});

$("#photoPreview").addEventListener("dragover", (event) => {
  const card = event.target.closest(".photo-admin-card");
  if (!card) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
  document.querySelectorAll(".photo-admin-card.drag-over").forEach((node) => node.classList.remove("drag-over"));
  card.classList.add("drag-over");
});

$("#photoPreview").addEventListener("dragleave", (event) => {
  const card = event.target.closest(".photo-admin-card");
  if (card) card.classList.remove("drag-over");
});

$("#photoPreview").addEventListener("drop", (event) => {
  const card = event.target.closest(".photo-admin-card");
  if (!card) return;
  event.preventDefault();
  const from = Number(event.dataTransfer.getData("text/plain"));
  const to = Number(card.dataset.photoIndex);
  if (Number.isNaN(from) || Number.isNaN(to) || from === to) return;
  const [moved] = state.images.splice(from, 1);
  state.images.splice(to, 0, moved);
  renderPhotoPreview();
});

$("#photoPreview").addEventListener("dragend", () => {
  document.querySelectorAll(".photo-admin-card.dragging, .photo-admin-card.drag-over").forEach((node) => {
    node.classList.remove("dragging", "drag-over");
  });
});

$("#vehicleForm").addEventListener("submit", async (event) => {
  event.preventDefault();
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
