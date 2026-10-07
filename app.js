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
  const slug = $("#vehicleDetail")?.dataset.slug;
  if (slug) return `${vehiclesPath(targetLang)}${slug}`;
  if (path.includes("/vehicles") || path.includes("/vozila")) return vehiclesPath(targetLang);
  if (path.includes("/about") || path.includes("/za-nas")) return `${publicBase(targetLang)}/${targetLang === "en" ? "about" : "za-nas"}/`;
  if (path.includes("/contact") || path.includes("/kontakt")) return `${publicBase(targetLang)}/${targetLang === "en" ? "contact" : "kontakt"}/`;
  return `${publicBase(targetLang)}/`;
}

function statusBadge(vehicle) {
  if (vehicle.status !== "reserved" && vehicle.status !== "sold") return "";
  return `<span class="status-pill status-pill--${vehicle.status}">${statusFor(vehicle, lang)}</span>`;
}

function vehicleCard(vehicle) {
  const title = escapeHtml(titleFor(vehicle, lang));
  const facts = [vehicle.year, vehicle.mileage ? formatKm(vehicle.mileage) : "", fuelFor(vehicle.fuel, lang), labelFor(vehicle.transmission, lang)]
    .filter(Boolean)
    .map((fact) => `<li>${escapeHtml(fact)}</li>`)
    .join("");
  return `
    <article class="vehicle-card reveal">
      <a href="${vehicleUrl(vehicle, lang)}" aria-label="${t.viewVehicle}: ${title}">
        <div class="vehicle-card__image">
          <img src="${escapeHtml(coverImage(vehicle))}" alt="${title}" loading="lazy">
          ${statusBadge(vehicle)}
        </div>
        <div class="vehicle-card__body">
          <p class="vehicle-card__brand">${escapeHtml(vehicle.brand || "")}</p>
          <h3>${title}</h3>
          <ul class="fact-list">${facts}</ul>
          <p class="price">${formatPrice(vehicle, lang)}</p>
        </div>
      </a>
    </article>
  `;
}

async function renderHome() {
  if (!$("#homePage")) return;
  const { vehicles } = await publicApi(`/api/public/vehicles?lang=${lang}`);
  const newestFirst = [...vehicles].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const listed = [...newestFirst.filter((vehicle) => vehicle.featured), ...newestFirst.filter((vehicle) => !vehicle.featured)].slice(0, 6);
  $("#featuredVehicles").innerHTML = listed.length ? listed.map(vehicleCard).join("") : `<p class="empty-state">${t.noVehicles}</p>`;

  const hero = listed[0];
  if (hero && coverImage(hero)) {
    $("#heroImage").src = coverImage(hero);
    $("#heroImage").alt = titleFor(hero, lang);
    $("#heroVehicle").href = vehicleUrl(hero, lang);
    $("#heroTag").innerHTML = `<strong>${escapeHtml(titleFor(hero, lang))}</strong><span>${formatPrice(hero, lang)}</span>`;
  }
}

async function initInventory() {
  const target = $("#inventoryGrid");
  if (!target) return;

  const search = $("#vehicleSearch");
  const brand = $("#brandFilter");
  const fuel = $("#fuelFilter");
  const status = $("#statusFilter") || document.createElement("select");
  const sort = $("#sortVehicles");
  const count = $("#vehicleCount");
  const { vehicles } = await publicApi(`/api/public/vehicles?lang=${lang}`);

  const populate = (select, values, label, formatter = (value) => value) => {
    select.innerHTML = `<option value="">${label}</option>${values.map((value) => `<option value="${value}">${formatter(value)}</option>`).join("")}`;
  };

  populate(brand, [...new Set(vehicles.map((vehicle) => vehicle.brand).filter(Boolean))].sort(), t.allBrands);
  populate(fuel, [...new Set(vehicles.map((vehicle) => vehicle.fuel).filter(Boolean))].sort(), t.allFuel, (value) => fuelFor(value, lang));
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
      if (sort.value === "price-asc") return (Number(a.price) || Infinity) - (Number(b.price) || Infinity);
      if (sort.value === "price-desc") return Number(b.price) - Number(a.price);
      if (sort.value === "mileage") return Number(a.mileage) - Number(b.mileage);
      if (sort.value === "year-desc") return Number(b.year) - Number(a.year);
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    count.textContent = `${filtered.length} ${filtered.length === 1 ? t.resultOne : t.resultMany}`;
    target.innerHTML = filtered.length ? filtered.map(vehicleCard).join("") : `<p class="empty-state">${t.noVehicles}</p>`;
    initReveal();
  };

  [search, brand, fuel, status, sort].forEach((control) => control.addEventListener("input", render));
  render();
}

function galleryFor(vehicle) {
  const images = vehicle.images?.length
    ? vehicle.images.map((image) => image.url)
    : vehicle.photos || [];
  const cover = coverImage(vehicle);
  const ordered = cover ? [cover, ...images.filter((url) => url !== cover)] : images;
  return ordered.filter(Boolean);
}

function specRows(vehicle) {
  const mk = lang === "mk";
  return [
    [mk ? "Година" : "Year", vehicle.year],
    [mk ? "Километража" : "Mileage", vehicle.mileage ? formatKm(vehicle.mileage) : ""],
    [t.fuel, fuelFor(vehicle.fuel, lang)],
    [mk ? "Менувач" : "Transmission", labelFor(vehicle.transmission, lang)],
    [mk ? "Сила на моторот" : "Power", vehicle.power],
    [mk ? "Мотор" : "Engine", vehicle.engine],
    [mk ? "Погон" : "Drive", labelFor(vehicle.drive, lang)],
    [mk ? "Каросерија" : "Body", labelFor(vehicle.bodyType, lang)],
    [mk ? "Боја" : "Colour", labelFor(vehicle.exteriorColor, lang)],
    [mk ? "Внатрешност" : "Interior", vehicle.interiorColor],
    [mk ? "Класа на емисија" : "Emission class", vehicle.emissionClass],
    [mk ? "Регистрација" : "Registration", vehicle.registration],
    [mk ? "Регистрирана до" : "Registered until", vehicle.registeredUntil],
    [mk ? "Шифра" : "Stock no.", vehicle.stockNumber]
  ].filter(([, value]) => value !== null && value !== undefined && value !== "");
}

function initGallery(root, photos, title) {
  if (!photos.length) return;
  let index = 0;
  const main = $(".gallery__main img", root);
  const counter = $(".gallery__counter", root);
  const thumbs = $$(".gallery__thumb", root);
  const lightbox = $("#lightbox");
  const lightboxImage = $("img", lightbox);
  const lightboxCounter = $(".lightbox__counter", lightbox);
  let lastFocus = null;

  const show = (next) => {
    index = (next + photos.length) % photos.length;
    main.src = photos[index];
    main.alt = `${title} – ${index + 1}/${photos.length}`;
    counter.textContent = `${index + 1} / ${photos.length}`;
    thumbs.forEach((thumb, i) => {
      thumb.classList.toggle("active", i === index);
      thumb.setAttribute("aria-current", i === index ? "true" : "false");
    });
    thumbs[index]?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
    if (lightbox.classList.contains("open")) {
      lightboxImage.src = photos[index];
      lightboxImage.alt = main.alt;
      lightboxCounter.textContent = counter.textContent;
    }
  };

  const open = () => {
    lastFocus = document.activeElement;
    lightbox.classList.add("open");
    lightbox.setAttribute("aria-hidden", "false");
    document.body.classList.add("lightbox-open");
    show(index);
    $(".lightbox__close", lightbox).focus();
  };

  const close = () => {
    lightbox.classList.remove("open");
    lightbox.setAttribute("aria-hidden", "true");
    document.body.classList.remove("lightbox-open");
    lastFocus?.focus();
  };

  const swipe = (element) => {
    let startX = null;
    element.addEventListener("touchstart", (event) => { startX = event.touches[0].clientX; }, { passive: true });
    element.addEventListener("touchend", (event) => {
      if (startX === null) return;
      const delta = event.changedTouches[0].clientX - startX;
      if (Math.abs(delta) > 40) show(index + (delta < 0 ? 1 : -1));
      startX = null;
    });
  };

  $(".gallery__prev", root).addEventListener("click", () => show(index - 1));
  $(".gallery__next", root).addEventListener("click", () => show(index + 1));
  $(".gallery__open", root).addEventListener("click", open);
  $(".gallery__main", root).addEventListener("click", (event) => {
    if (!event.target.closest("button")) open();
  });
  thumbs.forEach((thumb, i) => thumb.addEventListener("click", () => show(i)));
  $(".lightbox__prev", lightbox).addEventListener("click", () => show(index - 1));
  $(".lightbox__next", lightbox).addEventListener("click", () => show(index + 1));
  $(".lightbox__close", lightbox).addEventListener("click", close);
  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox || event.target.classList.contains("lightbox__stage")) close();
  });
  document.addEventListener("keydown", (event) => {
    if (!lightbox.classList.contains("open")) return;
    if (event.key === "Escape") close();
    if (event.key === "ArrowLeft") show(index - 1);
    if (event.key === "ArrowRight") show(index + 1);
  });
  swipe($(".gallery__main", root));
  swipe(lightbox);
  photos.slice(1, 3).forEach((url) => { const preload = new Image(); preload.src = url; });
  show(0);
}

async function initDetailPage() {
  const root = $("#vehicleDetail");
  if (!root) return;
  document.documentElement.lang = lang;

  const slug = decodeURIComponent(window.location.pathname.split("/").filter(Boolean).pop().replace(/\.html$/, ""));
  const vehicle = await publicApi(`/api/public/vehicles/${encodeURIComponent(slug)}?lang=${lang}`)
    .then((result) => result.vehicle)
    .catch(() => null);
  if (!vehicle) {
    root.innerHTML = `<section class="page-hero"><div class="container"><h1>${lang === "mk" ? "Возилото не е пронајдено" : "Vehicle not found"}</h1><a class="button" href="${vehiclesPath(lang)}">${t.backToVehicles}</a></div></section>`;
    return;
  }
  root.dataset.slug = vehicle.slug;
  localizeShell();

  const title = titleFor(vehicle, lang);
  const safeTitle = escapeHtml(title);
  document.title = `${title} | VVS Auto`;
  $('meta[name="description"]')?.setAttribute("content", `${title} – ${formatPrice(vehicle, lang)}. ${descriptionFor(vehicle, lang).slice(0, 140)}`);

  const photos = galleryFor(vehicle);
  const whatsappText = `${t.vehicleMessage} ${title}${vehicle.stockNumber ? ` (${vehicle.stockNumber})` : ""} – ${location.href}`;
  const quickFacts = [
    vehicle.year,
    vehicle.mileage ? formatKm(vehicle.mileage) : "",
    fuelFor(vehicle.fuel, lang),
    labelFor(vehicle.transmission, lang),
    vehicle.power
  ].filter(Boolean);
  const equipment = equipmentFor(vehicle, lang);
  const description = descriptionFor(vehicle, lang);

  root.innerHTML = `
    <div class="container detail">
      <nav class="breadcrumb" aria-label="Breadcrumb">
        <a href="${vehiclesPath(lang)}">${t.vehicles}</a><span aria-hidden="true">/</span><span>${safeTitle}</span>
      </nav>
      <div class="detail__top">
        <section class="gallery" aria-label="${t.allPhotos}">
          <div class="gallery__main">
            ${photos.length ? `<img src="${escapeHtml(photos[0])}" alt="${safeTitle}">` : `<div class="gallery__empty"></div>`}
            ${statusBadge(vehicle)}
            ${photos.length > 1 ? `
              <button class="gallery__nav gallery__prev" type="button" aria-label="${t.previous}"><span aria-hidden="true">‹</span></button>
              <button class="gallery__nav gallery__next" type="button" aria-label="${t.next}"><span aria-hidden="true">›</span></button>` : ""}
            <span class="gallery__counter">1 / ${photos.length}</span>
            <button class="gallery__open" type="button">${t.allPhotos} (${photos.length})</button>
          </div>
          ${photos.length > 1 ? `
            <div class="gallery__thumbs">
              ${photos.map((url, i) => `<button class="gallery__thumb" type="button" aria-label="${i + 1} / ${photos.length}"><img src="${escapeHtml(url)}" alt="" loading="lazy"></button>`).join("")}
            </div>` : ""}
        </section>
        <aside class="summary">
          <p class="summary__brand">${escapeHtml(vehicle.brand || "")}</p>
          <h1>${safeTitle}</h1>
          ${vehicle.variant ? `<p class="summary__variant">${escapeHtml(vehicle.variant)}</p>` : ""}
          <ul class="fact-list fact-list--large">${quickFacts.map((fact) => `<li>${escapeHtml(fact)}</li>`).join("")}</ul>
          <p class="summary__price">${formatPrice(vehicle, lang)}</p>
          <div class="summary__actions">
            <a class="button button--block" href="${phoneHref(VVS_PHONE_PRIMARY)}">${t.call} ${VVS_PHONE_PRIMARY}</a>
            <a class="button button--whatsapp button--block" href="${whatsAppHref(VVS_PHONE_PRIMARY, whatsappText)}" target="_blank" rel="noopener">${t.whatsapp}</a>
          </div>
          <p class="summary__note">${escapeHtml(vehicle.location || "Skopje")} · ${t.appointment}</p>
        </aside>
      </div>

      <div class="detail__body">
        <section class="detail__section">
          <h2>${t.keyFacts}</h2>
          <dl class="spec-table">
            ${specRows(vehicle).map(([label, value]) => `<div><dt>${label}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}
          </dl>
        </section>
        ${description ? `
        <section class="detail__section">
          <h2>${t.description}</h2>
          <p class="detail__description">${escapeHtml(description)}</p>
        </section>` : ""}
        ${equipment.length ? `
        <section class="detail__section">
          <h2>${t.equipment}</h2>
          <ul class="equipment-list">${equipment.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        </section>` : ""}
      </div>
    </div>

    <div class="lightbox" id="lightbox" role="dialog" aria-modal="true" aria-label="${t.allPhotos}" aria-hidden="true">
      <div class="lightbox__bar">
        <span class="lightbox__counter"></span>
        <button class="lightbox__close" type="button" aria-label="${t.close}">✕</button>
      </div>
      <div class="lightbox__stage"><img alt=""></div>
      <button class="lightbox__nav lightbox__prev" type="button" aria-label="${t.previous}"><span aria-hidden="true">‹</span></button>
      <button class="lightbox__nav lightbox__next" type="button" aria-label="${t.next}"><span aria-hidden="true">›</span></button>
    </div>

    <nav class="sticky-cta" aria-label="${t.contact}">
      <a class="button" href="${phoneHref(VVS_PHONE_PRIMARY)}">${t.call}</a>
      <a class="button button--whatsapp" href="${whatsAppHref(VVS_PHONE_PRIMARY, whatsappText)}" target="_blank" rel="noopener">${t.whatsapp}</a>
    </nav>
  `;

  initGallery(root, photos, title);
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
