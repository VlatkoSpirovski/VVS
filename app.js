const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));
const lang = getLang();
const t = i18n[lang];

setLang(lang);

async function publicApi(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`API request failed: ${path}`);
  return response.json();
}

function initChrome() {
  const header = $(".site-header");
  const toggle = $(".menu-toggle");
  const mobileMenu = $(".mobile-menu");
  const updateHeader = () => header?.classList.toggle("scrolled", window.scrollY > 24);

  updateHeader();
  window.addEventListener("scroll", updateHeader, { passive: true });

  toggle?.addEventListener("click", () => {
    const open = !document.body.classList.contains("menu-open");
    document.body.classList.toggle("menu-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    mobileMenu?.setAttribute("aria-hidden", String(!open));
  });

  mobileMenu?.addEventListener("click", (event) => {
    if (event.target.matches("a")) {
      document.body.classList.remove("menu-open");
      toggle?.setAttribute("aria-expanded", "false");
      mobileMenu.setAttribute("aria-hidden", "true");
    }
  });
}

function initReveal() {
  const items = $$(".reveal");
  if (!items.length || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    items.forEach((item) => item.classList.add("visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.14 }
  );

  items.forEach((item) => observer.observe(item));
}

function localizeShell() {
  $$("[data-i18n]").forEach((node) => {
    const key = node.dataset.i18n;
    if (t[key]) node.textContent = t[key];
  });
  $$("[data-i18n-placeholder]").forEach((node) => {
    const key = node.dataset.i18nPlaceholder;
    if (t[key]) node.setAttribute("placeholder", t[key]);
  });
  $$("[data-href]").forEach((node) => {
    const key = node.dataset.href;
    if (key === "home") node.href = `${publicBase(lang)}/`;
    if (key === "vehicles") node.href = vehiclesPath(lang);
    if (key === "about") node.href = `${publicBase(lang)}/${lang === "en" ? "about" : "za-nas"}/`;
    if (key === "contact") node.href = `${publicBase(lang)}/${lang === "en" ? "contact" : "kontakt"}/`;
  });
  $$("[data-lang-switch]").forEach((node) => {
    const targetLang = node.dataset.langSwitch;
    node.href = switchLanguageUrl(targetLang);
    node.classList.toggle("active", targetLang === lang);
  });
}

function switchLanguageUrl(targetLang) {
  const path = window.location.pathname;
  const id = $("#vehicleDetail")?.dataset.vehicleId;
  if (id) return `${vehiclesPath(targetLang)}${id}.html`;
  if (path.includes("/vehicles") || path.includes("/vozila")) return vehiclesPath(targetLang);
  if (path.includes("/about") || path.includes("/za-nas")) return `${publicBase(targetLang)}/${targetLang === "en" ? "about" : "za-nas"}/`;
  if (path.includes("/contact") || path.includes("/kontakt")) return `${publicBase(targetLang)}/${targetLang === "en" ? "contact" : "kontakt"}/`;
  return `${publicBase(targetLang)}/`;
}

function vehicleCard(vehicle) {
  return `
    <article class="vehicle-card reveal" data-brand="${vehicle.brand}" data-fuel="${vehicle.fuel}" data-status="${vehicle.status}">
      <a href="${vehicleUrl(vehicle, lang)}" aria-label="${t.viewVehicle}: ${titleFor(vehicle, lang)}">
        <div class="vehicle-card__image">
          <img src="${coverImage(vehicle)}" alt="${titleFor(vehicle, lang)}" loading="lazy">
          <span class="status-pill">${statusFor(vehicle, lang)}</span>
        </div>
        <div class="vehicle-card__body">
          <div class="vehicle-card__kicker">${vehicle.brand} · ${vehicle.stockNumber || ""}</div>
          <h3>${titleFor(vehicle, lang)}</h3>
          <p class="price">${formatPrice(vehicle)}</p>
          <div class="meta">
            <span>${vehicle.year}</span>
            <span>${formatKm(vehicle.mileage)}</span>
            <span>${fuelFor(vehicle.fuel, lang)}</span>
            <span>${vehicle.transmission}</span>
          </div>
        </div>
      </a>
    </article>
  `;
}

async function renderHome() {
  if (!$("#homePage")) return;
  const { vehicles } = await publicApi(`/api/public/vehicles?lang=${lang}`);
  const featured = vehicles.filter((vehicle) => vehicle.featured).slice(0, 3);
  $("#featuredVehicles").innerHTML = featured.map(vehicleCard).join("");

  const showcaseVehicle = featured[0] || vehicles[0];
  if (showcaseVehicle) {
    $(".showcase-image").style.backgroundImage = `url("${coverImage(showcaseVehicle)}")`;
    $("#showcaseSpecs").innerHTML = `
      <div><strong>${showcaseVehicle.power || "-"}</strong><span>${lang === "mk" ? "Моќност" : "Output"}</span></div>
      <div><strong>${formatKm(showcaseVehicle.mileage).replace(" km", "")}</strong><span>${lang === "mk" ? "Километри" : "Kilometres"}</span></div>
      <div><strong>${showcaseVehicle.year}</strong><span>${lang === "mk" ? "Година" : "Model year"}</span></div>
    `;
    $("#showcaseLink").href = vehicleUrl(showcaseVehicle, lang);
  }
}

async function initInventory() {
  const target = $("#inventoryGrid");
  if (!target) return;

  const search = $("#vehicleSearch");
  const brand = $("#brandFilter");
  const fuel = $("#fuelFilter");
  const status = $("#statusFilter");
  const sort = $("#sortVehicles");
  const count = $("#vehicleCount");
  const { vehicles } = await publicApi(`/api/public/vehicles?lang=${lang}`);

  const populate = (select, values, label, formatter = (value) => value) => {
    select.innerHTML = `<option value="">${label}</option>${values.map((value) => `<option value="${value}">${formatter(value)}</option>`).join("")}`;
  };

  populate(brand, [...new Set(vehicles.map((vehicle) => vehicle.brand))].sort(), t.allBrands);
  populate(fuel, [...new Set(vehicles.map((vehicle) => vehicle.fuel))].sort(), t.allFuel, (value) => fuelFor(value, lang));
  status.innerHTML = `<option value="">${t.allStatuses}</option>${Object.keys(statusLabels)
    .map((value) => `<option value="${value}">${statusFor({ status: value }, lang)}</option>`)
    .join("")}`;

  const render = () => {
    const term = search.value.trim().toLowerCase();
    let filtered = vehicles.filter((vehicle) => {
      const haystack = `${vehicle.brand} ${vehicle.model} ${vehicle.variant} ${vehicle.stockNumber} ${titleFor(vehicle, lang)}`.toLowerCase();
      return (
        (!term || haystack.includes(term)) &&
        (!brand.value || vehicle.brand === brand.value) &&
        (!fuel.value || vehicle.fuel === fuel.value) &&
        (!status.value || vehicle.status === status.value)
      );
    });

    filtered = filtered.sort((a, b) => {
      if (sort.value === "price-asc") return Number(a.price) - Number(b.price);
      if (sort.value === "price-desc") return Number(b.price) - Number(a.price);
      if (sort.value === "mileage") return Number(a.mileage) - Number(b.mileage);
      if (sort.value === "year-desc") return Number(b.year) - Number(a.year);
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    count.textContent = `${filtered.length} ${filtered.length === 1 ? t.resultOne : t.resultMany}`;
    target.innerHTML = filtered.map(vehicleCard).join("");
    initReveal();
  };

  [search, brand, fuel, status, sort].forEach((control) => control.addEventListener("input", render));
  render();
}

async function initDetailPage() {
  const root = $("#vehicleDetail");
  if (!root) return;

  const slug = root.dataset.vehicleId || window.location.pathname.split("/").filter(Boolean).pop().replace(/\.html$/, "");
  const vehicle = await publicApi(`/api/public/vehicles/${slug}?lang=${lang}`)
    .then((result) => result.vehicle)
    .catch(() => null);
  if (!vehicle) {
    root.innerHTML = `<section class="page-hero"><div class="container"><h1>Vehicle not found</h1></div></section>`;
    return;
  }

  document.title = `VVS | ${titleFor(vehicle, lang)} ${vehicle.year}`;
  const meta = $('meta[name="description"]');
  if (meta) meta.setAttribute("content", `${titleFor(vehicle, lang)}. ${descriptionFor(vehicle, lang)}`);

  const specs = [
    [lang === "mk" ? "Година" : "Year", vehicle.year],
    [lang === "mk" ? "Километража" : "Mileage", formatKm(vehicle.mileage)],
    [t.fuel, fuelFor(vehicle.fuel, lang)],
    [lang === "mk" ? "Менувач" : "Transmission", vehicle.transmission],
    [lang === "mk" ? "Мотор" : "Engine", vehicle.engine],
    [lang === "mk" ? "Моќност" : "Power", vehicle.power],
    [lang === "mk" ? "Погон" : "Drive", vehicle.drive],
    [lang === "mk" ? "Каросерија" : "Body", vehicle.bodyType],
    [lang === "mk" ? "Боја" : "Color", vehicle.exteriorColor],
    ["Stock", vehicle.stockNumber]
  ].filter(([, value]) => value);
  const galleryImages = vehicle.images?.length
    ? vehicle.images
    : (vehicle.photos || []).map((url, index) => ({ url, isCover: index === (vehicle.coverIndex || 0) }));

  root.innerHTML = `
    <section class="detail-hero">
      <img id="detailHeroImage" src="${coverImage(vehicle)}" alt="${titleFor(vehicle, lang)}">
      <div class="container detail-content">
        <p class="eyebrow">${vehicle.brand} · ${statusFor(vehicle, lang)}</p>
        <h1>${titleFor(vehicle, lang)}</h1>
        <div class="detail-price">${formatPrice(vehicle)}</div>
        <div class="hero-actions">
          <a class="button" href="#inquiry">${t.inquire}</a>
          <a class="button ghost" href="${phoneHref(VVS_PHONE_PRIMARY)}">${t.call}</a>
          <a class="button ghost" href="${whatsAppHref(VVS_PHONE_PRIMARY, `${titleFor(vehicle, lang)} ${vehicle.stockNumber}`)}">${t.whatsapp}</a>
        </div>
      </div>
    </section>
    <section class="section tight">
      <div class="container gallery-strip">
        ${galleryImages
          .map(
            (photo, index) => `
              <button class="gallery-thumb ${photo.isCover ? "active" : ""}" type="button" data-photo="${photo.url}">
                <img src="${photo.url}" alt="${titleFor(vehicle, lang)} photo ${index + 1}" loading="lazy">
              </button>`
          )
          .join("")}
      </div>
    </section>
    <section class="section">
      <div class="container detail-grid">
        <main>
          <p class="eyebrow">${t.overview}</p>
          <h2>${vehicle.year} ${titleFor(vehicle, lang)} ${vehicle.variant || ""}</h2>
          <p>${descriptionFor(vehicle, lang)}</p>
          <div class="spec-grid">
            ${specs.map(([label, value]) => `<div class="spec-card"><span>${label}</span><strong>${value}</strong></div>`).join("")}
          </div>
          <section class="section tight">
            <p class="eyebrow">${t.equipment}</p>
            <h2>${t.selectedSpec}</h2>
            <ul class="equipment-grid">
              ${equipmentFor(vehicle, lang).map((item) => `<li>${item}</li>`).join("")}
            </ul>
          </section>
        </main>
        <aside class="contact-panel" id="inquiry">
          <p class="eyebrow">${t.interested}</p>
          <h2>${t.speak}</h2>
          <p>${t.speakText}</p>
          <div class="button-row">
            <a class="button" href="${phoneHref(VVS_PHONE_PRIMARY)}">${VVS_PHONE_PRIMARY}</a>
            <a class="button ghost" href="${whatsAppHref(VVS_PHONE_PRIMARY, `${titleFor(vehicle, lang)} ${vehicle.stockNumber}`)}">${t.whatsapp}</a>
            <a class="button ghost" href="${publicBase(lang)}/${lang === "en" ? "contact" : "kontakt"}/">${t.inquire}</a>
          </div>
        </aside>
      </div>
    </section>
    <nav class="sticky-mobile-cta" aria-label="Quick vehicle contact">
      <a class="button" href="${phoneHref(VVS_PHONE_PRIMARY)}">${t.call}</a>
      <a class="button ghost" href="${whatsAppHref(VVS_PHONE_PRIMARY)}">${t.whatsapp}</a>
    </nav>
  `;

  $$(".gallery-thumb").forEach((button) => {
    button.addEventListener("click", () => {
      $("#detailHeroImage").src = button.dataset.photo;
      $$(".gallery-thumb").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
    });
  });
}

function renderAboutContact() {
  const about = $("#aboutCopy");
  if (about) about.textContent = t.aboutText;
  const contactTitle = $("#contactTitle");
  if (contactTitle) contactTitle.textContent = t.contactTitle;
}

function initRedirectRoot() {
  if (document.body.dataset.page === "root") {
    window.location.replace(`${publicBase(lang)}/`);
  }
}

async function boot() {
  initRedirectRoot();
  initChrome();
  localizeShell();
  await renderHome();
  await initInventory();
  await initDetailPage();
  renderAboutContact();
  initReveal();
}

boot().catch((error) => {
  console.error(error);
  const main = $("main");
  if (main) {
    main.innerHTML = `<section class="page-hero"><div class="container"><p class="eyebrow">Database</p><h1>Database connection required.</h1><p>Add DATABASE_URL, run migrations and seed, then restart the server.</p></div></section>`;
  }
});
