const state = {
  vehicles: [],
  images: [],
  editingId: null,
  dirty: false,
  uploading: 0
};

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
const esc = escapeHtml;

const STATUS_PILLS = {
  reserved: ["adm-pill--reserved", "Резервирано"],
  sold: ["adm-pill--sold", "Продадено"]
};

class ApiError extends Error {}

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  if (response.status === 401) {
    window.location.href = "/admin/login";
    throw new ApiError("Сесијата истече. Најавете се повторно.");
  }
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new ApiError(error.error || "Барањето не успеа. Обидете се повторно.");
  }
  return response.json();
}

let toastTimer;
function toast(message, { error = false } = {}) {
  const node = $("#toast");
  node.textContent = message;
  node.classList.toggle("is-error", error);
  node.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (node.hidden = true), error ? 6000 : 3000);
}

function formatAdminKm(value) {
  if (value === null || value === undefined || value === "") return "";
  return `${new Intl.NumberFormat("de-DE").format(Number(value))} km`;
}

function slugifyAdmin(value) {
  return value
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function fuelLabel(value) {
  return fuelLabels?.[value]?.mk || value || "";
}

async function loadAdmin() {
  const [dashboard, vehicles] = await Promise.all([api("/api/admin/dashboard"), api("/api/admin/vehicles?lang=mk")]);
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
  $("#dashboard").innerHTML = cards
    .map(([label, value]) => `<article class="adm-stat"><span>${esc(label)}</span><strong>${esc(value ?? 0)}</strong></article>`)
    .join("");
}

function matchesSearch(vehicle, term) {
  if (!term) return true;
  const haystack = [vehicle.brand, vehicle.model, vehicle.title, vehicle.year, vehicle.stockNumber, vehicle.fuel]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return term.split(/\s+/).every((part) => haystack.includes(part));
}

function publishedCell(vehicle) {
  const pills = [
    vehicle.published
      ? `<span class="adm-pill adm-pill--on">Да</span>`
      : `<span class="adm-pill adm-pill--off">Не</span>`
  ];
  const status = STATUS_PILLS[vehicle.status];
  if (status) pills.push(`<span class="adm-pill ${status[0]}">${status[1]}</span>`);
  return `<div class="adm-pill-stack">${pills.join("")}</div>`;
}

function renderVehicles() {
  const term = $("#vehicleSearch").value.trim().toLowerCase();
  const visible = state.vehicles.filter((vehicle) => matchesSearch(vehicle, term));
  const total = state.vehicles.length;

  $("#vehicleCount").textContent = term
    ? `${visible.length} од ${total} возила`
    : `${total} ${total === 1 ? "возило" : "возила"}`;

  $("#vehicleRows").innerHTML = visible
    .map((vehicle) => {
      const id = esc(vehicle.id);
      const name = `${vehicle.brand || ""} ${vehicle.model || ""}`.trim();
      return `
        <tr>
          <td class="adm-cell-photo"><img class="adm-thumb" src="${esc(vehicle.coverUrl || "/assets/vvs-auto-logo.jpeg")}" alt="" loading="lazy"></td>
          <td class="adm-vehicle" data-label="Возило"><strong>${esc(name)}</strong>${vehicle.title && vehicle.title !== name ? `<small>${esc(vehicle.title)}</small>` : ""}</td>
          <td data-label="Година">${esc(vehicle.year || "–")}</td>
          <td data-label="Гориво">${esc(fuelLabel(vehicle.fuel) || "–")}</td>
          <td data-label="Километража">${esc(formatAdminKm(vehicle.mileage) || "–")}</td>
          <td data-label="Објавено">${publishedCell(vehicle)}</td>
          <td class="adm-cell-actions">
            <div class="adm-actions">
              <button type="button" data-action="edit" data-id="${id}">Уреди</button>
              <a href="/mk/vozila/${encodeURIComponent(vehicle.slug || "")}" target="_blank" rel="noopener">Погледни</a>
              <button type="button" data-action="duplicate" data-id="${id}">Дуплирај</button>
              <button type="button" data-action="publish" data-id="${id}">${vehicle.published ? "Скриј" : "Објави"}</button>
              <button class="danger" type="button" data-action="delete" data-id="${id}">Избриши</button>
            </div>
          </td>
        </tr>`;
    })
    .join("");

  const empty = $("#vehicleEmpty");
  empty.hidden = visible.length > 0;
  empty.textContent = total ? "Нема возила што одговараат на пребарувањето." : "Сè уште нема возила. Додадете го првото.";
}

function setField(id, value) {
  const node = $(`#${id}`);
  if (node) node.value = value ?? "";
}

function selectDescriptionTab(id) {
  $$(".adm-tab").forEach((tab) => {
    const active = tab.dataset.tab === id;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", String(active));
    $(`#${tab.dataset.tab}`).hidden = !active;
  });
}

function markFilledTabs() {
  $$(".adm-tab").forEach((tab) => tab.classList.toggle("has-text", Boolean($(`#${tab.dataset.tab}`).value.trim())));
}

function openEditor(vehicle = null) {
  state.editingId = vehicle?.id || null;
  state.images = (vehicle?.images || []).map((image) => ({ ...image, isCover: Boolean(image.isCover) }));
  state.dirty = false;

  $("#editorEyebrow").textContent = vehicle ? "Уредување" : "Ново возило";
  $("#editorTitle").textContent = vehicle ? [vehicle.brand, vehicle.model, vehicle.year].filter(Boolean).join(" ") : "Додади возило";
  $("#formError").textContent = "";
  $("#uploadStatus").textContent = "";
  $$("[aria-invalid]").forEach((node) => node.removeAttribute("aria-invalid"));

  [
    "brand",
    "model",
    "slug",
    "stockNumber",
    "year",
    "mileage",
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
  $("#price").value = vehicle?.price ? vehicle.price : "";
  $("#currency").value = vehicle?.currency || "EUR";
  $("#status").value = STATUS_PILLS[vehicle?.status] ? vehicle.status : "published";
  $("#published").checked = vehicle ? Boolean(vehicle.published) : true;
  $("#featured").checked = Boolean(vehicle?.featured);
  $("#descriptionMk").value = vehicle?.translations?.mk?.description || vehicle?.description || "";
  $("#descriptionSq").value = vehicle?.translations?.sq?.description || "";
  $("#descriptionEn").value = vehicle?.translations?.en?.description || "";
  selectDescriptionTab("descriptionMk");
  markFilledTabs();

  renderPhotoPreview();
  $("#editorPanel").hidden = false;
  document.body.classList.add("has-drawer");
  $(".adm-editor__body").scrollTop = 0;
  $("#brand").focus();
}

function closeEditor({ force = false } = {}) {
  if (!force && state.uploading) {
    toast("Почекајте сликите да се прикачат.", { error: true });
    return;
  }
  if (!force && state.dirty && !confirm("Имате незачувани промени. Да се затвори без зачувување?")) return;
  $("#editorPanel").hidden = true;
  document.body.classList.remove("has-drawer");
  state.dirty = false;
}

function renderPhotoPreview() {
  $("#photoPreview").innerHTML = state.images
    .map(
      (image, index) => `
        <article class="adm-photo${image.isCover ? " is-cover" : ""}" draggable="true" data-photo-index="${index}">
          ${image.isCover ? `<span class="adm-photo__badge">Насловна</span>` : ""}
          <img src="${esc(image.url)}" alt="Слика ${index + 1}" loading="lazy">
          <div class="adm-photo__foot">
            <button type="button" data-photo-action="cover" data-index="${index}" ${image.isCover ? "disabled" : ""}>${image.isCover ? "Насловна" : "Постави насловна"}</button>
            <button class="danger" type="button" data-photo-action="delete" data-index="${index}" aria-label="Избриши слика ${index + 1}">Избриши</button>
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
    mileage: $("#mileage").value === "" ? null : Number($("#mileage").value),
    mileageUnit: "km",
    status: $("#status").value || "published",
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

function validateForm() {
  const problems = [];
  const thisYear = new Date().getFullYear();
  const check = (id, ok, message) => {
    if (ok) {
      $(`#${id}`).removeAttribute("aria-invalid");
    } else {
      $(`#${id}`).setAttribute("aria-invalid", "true");
      problems.push([id, message]);
    }
  };
  check("brand", Boolean($("#brand").value.trim()), "Внесете марка.");
  check("model", Boolean($("#model").value.trim()), "Внесете модел.");
  const year = $("#year").value;
  check("year", !year || (Number.isInteger(Number(year)) && year >= 1900 && year <= thisYear + 1), `Годината мора да е меѓу 1900 и ${thisYear + 1}.`);
  const mileage = $("#mileage").value;
  check("mileage", !mileage || (Number.isInteger(Number(mileage)) && mileage >= 0), "Километрите мора да се цел број.");
  const price = $("#price").value;
  check("price", !price || Number(price) >= 0, "Цената не може да е негативна.");
  if (problems.length) {
    $("#formError").textContent = problems[0][1];
    $(`#${problems[0][0]}`).focus();
    return false;
  }
  return true;
}

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

async function uploadFiles(fileList) {
  const files = [...fileList];
  const accepted = files.filter((file) => ALLOWED_IMAGE_TYPES.includes(file.type) && file.size <= MAX_IMAGE_BYTES);
  const skipped = files.length - accepted.length;
  if (!accepted.length) {
    toast("Дозволени се JPG, PNG, WEBP или AVIF слики до 10 MB.", { error: true });
    return;
  }

  let signature;
  try {
    signature = await api("/api/admin/uploads/signature", { method: "POST", body: "{}" });
  } catch (error) {
    toast(error.message || "Прикачувањето слики не е поставено.", { error: true });
    return;
  }

  state.uploading += 1;
  const status = $("#uploadStatus");
  let done = 0;
  let failed = 0;

  for (const file of accepted) {
    status.textContent = `Се прикачува ${done + failed + 1} од ${accepted.length}…`;
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("api_key", signature.apiKey);
      formData.append("timestamp", signature.timestamp);
      formData.append("folder", signature.folder);
      formData.append("signature", signature.signature);
      const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(signature.cloudName)}/image/upload`, {
        method: "POST",
        body: formData
      });
      const uploaded = await response.json();
      if (!response.ok || !uploaded.secure_url) throw new Error(uploaded.error?.message || "Upload failed");
      state.images.push({
        url: uploaded.secure_url,
        publicId: uploaded.public_id,
        width: uploaded.width,
        height: uploaded.height,
        isCover: state.images.length === 0
      });
      state.dirty = true;
      done += 1;
      renderPhotoPreview();
    } catch (error) {
      console.error(error);
      failed += 1;
    }
  }

  state.uploading -= 1;
  const parts = [`Прикачени ${done} од ${accepted.length}.`];
  if (failed) parts.push(`${failed} не успеаја.`);
  if (skipped) parts.push(`${skipped} прескокнати (тип или големина).`);
  status.textContent = parts.join(" ");
  if (failed) toast("Некои слики не се прикачија. Обидете се повторно.", { error: true });
}

async function runAction(button, work) {
  button.disabled = true;
  try {
    await work();
  } catch (error) {
    if (error instanceof ApiError) toast(error.message, { error: true });
    else {
      console.error(error);
      toast("Нешто тргна наопаку. Обидете се повторно.", { error: true });
    }
  } finally {
    button.disabled = false;
  }
}

$("#logoutButton").addEventListener("click", async () => {
  try {
    await api("/api/auth/logout", { method: "POST" });
  } finally {
    window.location.href = "/admin/login";
  }
});

$$("[data-open-editor]").forEach((button) => button.addEventListener("click", () => openEditor()));
$$("[data-close-editor]").forEach((node) => node.addEventListener("click", () => closeEditor()));

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !$("#editorPanel").hidden) closeEditor();
});

window.addEventListener("beforeunload", (event) => {
  if (!$("#editorPanel").hidden && (state.dirty || state.uploading)) event.preventDefault();
});

$("#vehicleForm").addEventListener("input", (event) => {
  state.dirty = true;
  if (event.target.hasAttribute("aria-invalid")) event.target.removeAttribute("aria-invalid");
  if (event.target.classList.contains("adm-textarea")) markFilledTabs();
});

$$(".adm-tab").forEach((tab) => tab.addEventListener("click", () => selectDescriptionTab(tab.dataset.tab)));

["brand", "model", "year"].forEach((id) => {
  $(`#${id}`).addEventListener("input", () => {
    if (!$("#vehicleId").value) $("#slug").value = slugifyAdmin(`${$("#brand").value}-${$("#model").value}-${$("#year").value}`);
  });
});

$("#vehicleSearch").addEventListener("input", renderVehicles);

$("#vehicleRows").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const id = button.dataset.id;
  const action = button.dataset.action;
  const vehicle = state.vehicles.find((item) => item.id === id);
  const name = vehicle ? `${vehicle.brand} ${vehicle.model}` : "возилото";

  runAction(button, async () => {
    if (action === "edit") {
      const { vehicle: full } = await api(`/api/admin/vehicles/${encodeURIComponent(id)}?lang=mk`);
      openEditor(full);
    }
    if (action === "duplicate") {
      await api(`/api/admin/vehicles/${encodeURIComponent(id)}/duplicate`, { method: "POST" });
      await loadAdmin();
      toast(`${name} е дуплирано како нацрт.`);
    }
    if (action === "publish") {
      const { vehicle: updated } = await api(`/api/admin/vehicles/${encodeURIComponent(id)}/publish`, { method: "PATCH" });
      await loadAdmin();
      toast(updated?.published ? `${name} е објавено.` : `${name} е скриено од веб.`);
    }
    if (action === "delete") {
      if (!confirm(`Да се избрише ${name}? Ова не може да се врати.`)) return;
      await api(`/api/admin/vehicles/${encodeURIComponent(id)}`, { method: "DELETE" });
      await loadAdmin();
      toast(`${name} е избришано.`);
    }
  });
});

$("#photoUpload").addEventListener("change", async (event) => {
  await uploadFiles(event.target.files);
  event.target.value = "";
});

const uploadZone = $("#uploadZone");
uploadZone.addEventListener("dragover", (event) => {
  if (![...event.dataTransfer.types].includes("Files")) return;
  event.preventDefault();
  uploadZone.classList.add("is-dragging");
});
uploadZone.addEventListener("dragleave", () => uploadZone.classList.remove("is-dragging"));
uploadZone.addEventListener("drop", (event) => {
  if (!event.dataTransfer.files.length) return;
  event.preventDefault();
  uploadZone.classList.remove("is-dragging");
  uploadFiles(event.dataTransfer.files);
});

$("#photoPreview").addEventListener("click", (event) => {
  const control = event.target.closest("[data-photo-action]");
  if (!control) return;
  const index = Number(control.dataset.index);
  const action = control.dataset.photoAction;
  if (action === "cover") state.images.forEach((image, i) => (image.isCover = i === index));
  if (action === "delete") state.images.splice(index, 1);
  if (!state.images.some((image) => image.isCover) && state.images[0]) state.images[0].isCover = true;
  state.dirty = true;
  renderPhotoPreview();
});

$("#photoPreview").addEventListener("dragstart", (event) => {
  const card = event.target.closest(".adm-photo");
  if (!card) return;
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", card.dataset.photoIndex);
  card.classList.add("dragging");
});

$("#photoPreview").addEventListener("dragover", (event) => {
  const card = event.target.closest(".adm-photo");
  if (!card) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
  $$(".adm-photo.drag-over").forEach((node) => node.classList.remove("drag-over"));
  card.classList.add("drag-over");
});

$("#photoPreview").addEventListener("dragleave", (event) => {
  const card = event.target.closest(".adm-photo");
  if (card) card.classList.remove("drag-over");
});

$("#photoPreview").addEventListener("drop", (event) => {
  const card = event.target.closest(".adm-photo");
  if (!card) return;
  event.preventDefault();
  event.stopPropagation();
  const from = Number(event.dataTransfer.getData("text/plain"));
  const to = Number(card.dataset.photoIndex);
  if (Number.isNaN(from) || Number.isNaN(to) || from === to) return;
  const [moved] = state.images.splice(from, 1);
  state.images.splice(to, 0, moved);
  state.dirty = true;
  renderPhotoPreview();
});

$("#photoPreview").addEventListener("dragend", () => {
  $$(".adm-photo.dragging, .adm-photo.drag-over").forEach((node) => node.classList.remove("dragging", "drag-over"));
});

$("#vehicleForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  $("#formError").textContent = "";
  if (state.uploading) {
    $("#formError").textContent = "Почекајте сликите да се прикачат.";
    return;
  }
  if (!validateForm()) return;

  const saveButton = $("#saveButton");
  saveButton.disabled = true;
  saveButton.textContent = "Се зачувува…";
  try {
    const body = collectVehicle();
    const id = $("#vehicleId").value;
    await api(id ? `/api/admin/vehicles/${encodeURIComponent(id)}` : "/api/admin/vehicles", {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(body)
    });
    closeEditor({ force: true });
    await loadAdmin();
    toast(id ? "Промените се зачувани." : "Возилото е додадено.");
  } catch (error) {
    $("#formError").textContent = error instanceof ApiError ? error.message : "Зачувувањето не успеа. Обидете се повторно.";
    if (!(error instanceof ApiError)) console.error(error);
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = "Зачувај";
  }
});

const navLinks = $$(".adm-nav a[href^='#']");
navLinks.forEach((link) =>
  link.addEventListener("click", () => {
    navLinks.forEach((other) => other.classList.toggle("is-active", other === link));
  })
);

api("/api/auth/me")
  .then(({ user }) => ($("#accountEmail").textContent = user.email || ""))
  .catch(() => {});

loadAdmin().catch((error) => {
  console.error(error);
  $("#vehicleCount").textContent = "";
  toast(error instanceof ApiError ? error.message : "Податоците не можат да се вчитаат. Освежете ја страницата.", { error: true });
});
