const VVS_PHONE_PRIMARY = "+389 78 427 074";
const VVS_PHONE_SECONDARY = "+389 78 391 140";
const VVS_STORAGE_KEY = "vvs.vehicles.v2";
const VVS_AUTH_KEY = "vvs.admin.auth";

const phoneHref = (phone) => `tel:${phone.replace(/\s/g, "")}`;
const whatsAppHref = (phone, text = "Здраво VVS, заинтересиран сум за возило.") =>
  `https://wa.me/${phone.replace(/[^\d]/g, "")}?text=${encodeURIComponent(text)}`;

const i18n = {
  mk: {
    locale: "mk-MK",
    home: "Почетна",
    vehicles: "Возила",
    about: "За нас",
    contact: "Контакт",
    admin: "Админ",
    call: "Повикај",
    whatsapp: "WhatsApp",
    viewVehicle: "Погледнете возило",
    exploreVehicles: "Погледнете ги возилата",
    contactVvs: "Контактирајте не",
    heroEyebrow: "Авто плац · Гостивар",
    heroTitle: "Вашиот следен автомобил, тука.",
    heroText: "Проверени половни возила на нашиот плац во Гостивар — јасна цена, реални фотографии и директен контакт.",
    lotEyebrow: "Нашиот плац",
    lotTitle: "Дојдете и видете ги возилата во живо.",
    lotText: "ул. 101, Гостивар — гледање по договор.",
    featuredEyebrow: "Избрана понуда",
    featuredTitle: "Возила што вреди да се видат.",
    featuredText: "Избраните модели се прикажани со клучни спецификации, цена и брз контакт за следниот чекор.",
    showcaseEyebrow: "VVS селекција",
    showcaseTitle: "Перформанси со присуство.",
    showcaseText: "Голема фотографија, клучни бројки и јасен повик за контакт, како автомобилска кампања наместо обичен каталог.",
    whyEyebrow: "Зошто VVS",
    whyTitle: "Јасно, внимателно, директно.",
    whyText: "Фокусот е на доверба: прегледна спецификација, големи фотографии и едноставна комуникација.",
    ctaEyebrow: "Вашиот следен автомобил",
    ctaTitle: "Подготвени кога вистинското возило ќе се појави.",
    inventoryTitle: "Избрани возила.",
    inventoryEyebrow: "Понуда",
    search: "Пребарување",
    searchPlaceholder: "BMW, SUV, stock број",
    brand: "Марка",
    fuel: "Гориво",
    status: "Статус",
    allBrands: "Сите марки",
    allFuel: "Сите горива",
    allStatuses: "Сите статуси",
    sort: "Сортирање",
    newest: "Најнови",
    priceAsc: "Цена — најниска",
    priceDesc: "Цена — највисока",
    mileageAsc: "Најмала километража",
    yearDesc: "Година — најнова",
    resultOne: "возило",
    resultMany: "возила",
    overview: "Преглед на возило",
    specifications: "Спецификации",
    equipment: "Опрема",
    selectedSpec: "Избрана спецификација",
    priceOnRequest: "Цена по договор",
    keyFacts: "Клучни податоци",
    description: "Опис",
    allPhotos: "Сите фотографии",
    photos: "фотографии",
    close: "Затвори",
    previous: "Претходна",
    next: "Следна",
    backToVehicles: "Назад кон возилата",
    sendRequest: "Испрати барање",
    formSent: "Благодариме! Ќе ве контактираме наскоро.",
    formError: "Пораката не е испратена. Обидете се повторно или јавете се.",
    vehicleMessage: "Здраво, заинтересиран сум за ова возило.",
    noVehicles: "Нема возила што одговараат на филтрите.",
    interested: "Заинтересирани сте?",
    speak: "Разговарајте со VVS",
    speakText: "Побарајте детали, договорете гледање или испратете барање за конкретното возило.",
    aboutTitle: "Премиум, фокусирано, автомобилски.",
    aboutText: "VVS е модерна автомобилска продажна презентација изградена околу внимателно избрани автомобили, директна комуникација и јасно купувачко искуство.",
    contactTitle: "Разговарајте со VVS.",
    primaryPhone: "Примарен телефон",
    secondaryPhone: "Секундарен телефон",
    location: "Локација",
    appointment: "По договор",
    name: "Име",
    phone: "Телефон",
    email: "Е-пошта",
    message: "Порака",
    request: "Возило или барање",
    formTitle: "Кажете ни што барате.",
    available: "Достапно",
    reserved: "Резервирано",
    sold: "Продадено",
    draft: "Нацрт",
    hidden: "Скриено"
  },
  en: {
    locale: "en-US",
    home: "Home",
    vehicles: "Vehicles",
    about: "About",
    contact: "Contact",
    admin: "Admin",
    call: "Call",
    whatsapp: "WhatsApp",
    viewVehicle: "View vehicle",
    exploreVehicles: "Explore vehicles",
    contactVvs: "Contact VVS",
    heroEyebrow: "Auto lot · Gostivar",
    heroTitle: "Your next car is here.",
    heroText: "Checked used vehicles on our lot in Gostivar — clear pricing, real photos, and direct contact.",
    lotEyebrow: "Our lot",
    lotTitle: "Come see the cars in person.",
    lotText: "ul. 101, Gostivar — viewing by appointment.",
    featuredEyebrow: "Featured selection",
    featuredTitle: "Vehicles worth seeing.",
    featuredText: "Featured models are presented with key specifications, pricing, and a fast path to the next step.",
    showcaseEyebrow: "The VVS selection",
    showcaseTitle: "Performance with presence.",
    showcaseText: "Large photography, key numbers, and clear contact paths, presented like an automotive campaign rather than a catalogue.",
    whyEyebrow: "Why VVS",
    whyTitle: "Clear, careful, direct.",
    whyText: "The focus is trust: readable specifications, large photography, and simple communication.",
    ctaEyebrow: "Your next drive",
    ctaTitle: "Ready when the right vehicle appears.",
    inventoryTitle: "Selected vehicles.",
    inventoryEyebrow: "Inventory",
    search: "Search",
    searchPlaceholder: "BMW, SUV, stock number",
    brand: "Brand",
    fuel: "Fuel",
    status: "Status",
    allBrands: "All brands",
    allFuel: "All fuel types",
    allStatuses: "All statuses",
    sort: "Sort",
    newest: "Newest",
    priceAsc: "Price: Low to high",
    priceDesc: "Price: High to low",
    mileageAsc: "Lowest mileage",
    yearDesc: "Year: Newest",
    resultOne: "vehicle",
    resultMany: "vehicles",
    overview: "Vehicle overview",
    specifications: "Specifications",
    equipment: "Equipment",
    selectedSpec: "Selected specification",
    priceOnRequest: "Price on request",
    keyFacts: "Key facts",
    description: "Description",
    allPhotos: "All photos",
    photos: "photos",
    close: "Close",
    previous: "Previous",
    next: "Next",
    backToVehicles: "Back to vehicles",
    sendRequest: "Send request",
    formSent: "Thank you! We will contact you shortly.",
    formError: "The message was not sent. Please try again or call us.",
    vehicleMessage: "Hello, I am interested in this vehicle.",
    noVehicles: "No vehicles match these filters.",
    interested: "Interested?",
    speak: "Speak with VVS",
    speakText: "Get details, arrange a viewing, or send an inquiry for this vehicle.",
    aboutTitle: "Premium, focused, automotive.",
    aboutText: "VVS is a modern automotive sales presentation built around carefully selected cars, direct communication, and a clear buying experience.",
    contactTitle: "Speak with VVS.",
    primaryPhone: "Primary phone",
    secondaryPhone: "Secondary phone",
    location: "Location",
    appointment: "By appointment",
    name: "Name",
    phone: "Phone",
    email: "Email",
    message: "Message",
    request: "Vehicle or request",
    formTitle: "Tell us what you are looking for.",
    available: "Available",
    reserved: "Reserved",
    sold: "Sold",
    draft: "Draft",
    hidden: "Hidden"
  }
};

const statusLabels = {
  available: { mk: "Достапно", en: "Available" },
  published: { mk: "Објавено", en: "Published" },
  reserved: { mk: "Резервирано", en: "Reserved" },
  sold: { mk: "Продадено", en: "Sold" },
  draft: { mk: "Нацрт", en: "Draft" },
  hidden: { mk: "Скриено", en: "Hidden" }
};

const fuelLabels = {
  Petrol: { mk: "Бензин", en: "Petrol" },
  Diesel: { mk: "Дизел", en: "Diesel" },
  Hybrid: { mk: "Хибрид", en: "Hybrid" },
  Electric: { mk: "Електрично", en: "Electric" },
  petrol: { mk: "Бензин", en: "Petrol" },
  diesel: { mk: "Дизел", en: "Diesel" },
  hybrid: { mk: "Хибрид", en: "Hybrid" },
  electric: { mk: "Електрично", en: "Electric" }
};

const defaultVehicles = [
  {
    id: "bmw-m340i-xdrive",
    stockNumber: "VVS-2401",
    brand: "BMW",
    model: "M340i xDrive",
    variant: "M Sport",
    year: 2024,
    price: 54900,
    currency: "EUR",
    mileage: 18500,
    mileageUnit: "km",
    fuel: "Petrol",
    transmission: "Automatic",
    engine: "3.0L inline-six",
    power: "374 HP",
    drive: "xDrive",
    bodyType: "Sedan",
    exteriorColor: "Black Sapphire",
    interiorColor: "Black leather",
    location: "Gostivar",
    availability: "Immediate",
    status: "available",
    featured: true,
    published: true,
    createdAt: "2026-09-22",
    coverIndex: 0,
    photos: [
      "https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=1600&q=82",
      "https://images.unsplash.com/photo-1603584173870-7f23fdae1b7a?auto=format&fit=crop&w=1600&q=82",
      "https://images.unsplash.com/photo-1617814076367-b759c7d7e738?auto=format&fit=crop&w=1600&q=82"
    ],
    title: { mk: "BMW M340i xDrive", en: "BMW M340i xDrive" },
    description: {
      mk: "Модерен спортски седан со силни перформанси, мирна премиум кабина и спецификација за секојдневно возење.",
      en: "A precise, modern performance sedan with a calm premium cabin, strong specification, and everyday usability."
    },
    equipment: {
      mk: ["M Sport пакет", "Адаптивен темпомат", "Harman Kardon", "360° камера", "Head-Up Display", "Греачи на седишта"],
      en: ["M Sport package", "Adaptive cruise", "Harman Kardon", "360° camera", "Head-up display", "Heated seats"]
    }
  },
  {
    id: "mercedes-benz-gle-400d",
    stockNumber: "VVS-2309",
    brand: "Mercedes-Benz",
    model: "GLE 400d",
    variant: "4MATIC AMG Line",
    year: 2023,
    price: 78900,
    currency: "EUR",
    mileage: 29200,
    mileageUnit: "km",
    fuel: "Diesel",
    transmission: "Automatic",
    engine: "3.0L six-cylinder",
    power: "330 HP",
    drive: "4MATIC",
    bodyType: "SUV",
    exteriorColor: "Obsidian Black",
    interiorColor: "Beige leather",
    location: "Gostivar",
    availability: "Appointment",
    status: "available",
    featured: true,
    published: true,
    createdAt: "2026-09-12",
    coverIndex: 0,
    photos: [
      "https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?auto=format&fit=crop&w=1600&q=82",
      "https://images.unsplash.com/photo-1606016159991-dfe4f2746ad5?auto=format&fit=crop&w=1600&q=82"
    ],
    title: { mk: "Mercedes-Benz GLE 400d", en: "Mercedes-Benz GLE 400d" },
    description: {
      mk: "Луксузен SUV со тивка кабина, силно присуство на пат и комфор за долги релации.",
      en: "A confident luxury SUV with a quiet cabin, serious road presence, and long-distance comfort."
    },
    equipment: {
      mk: ["AMG екстериер", "Воздушна суспензија", "Панорамски покрив", "Burmester аудио", "Memory седишта", "Night пакет"],
      en: ["AMG exterior", "Air suspension", "Panoramic roof", "Burmester audio", "Memory seats", "Night package"]
    }
  },
  {
    id: "porsche-macan-s",
    stockNumber: "VVS-2214",
    brand: "Porsche",
    model: "Macan S",
    variant: "Sport Chrono",
    year: 2022,
    price: 66900,
    currency: "EUR",
    mileage: 34100,
    mileageUnit: "km",
    fuel: "Petrol",
    transmission: "PDK",
    engine: "2.9L V6",
    power: "380 HP",
    drive: "AWD",
    bodyType: "SUV",
    exteriorColor: "Dolomite Silver",
    interiorColor: "Black leather",
    location: "Gostivar",
    availability: "Reserved",
    status: "reserved",
    featured: true,
    published: true,
    createdAt: "2026-08-30",
    coverIndex: 0,
    photos: [
      "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1600&q=82",
      "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1600&q=82"
    ],
    title: { mk: "Porsche Macan S", en: "Porsche Macan S" },
    description: {
      mk: "Компактен Porsche SUV со спортски карактер, премиум комфор и фокусирано возачко чувство.",
      en: "Compact Porsche dynamics with premium comfort, clean history, and a focused driver-oriented feel."
    },
    equipment: {
      mk: ["Sport Chrono", "PDK менувач", "Sport exhaust", "Адаптивни седишта", "LED matrix светла", "Lane assist"],
      en: ["Sport Chrono", "PDK transmission", "Sport exhaust", "Adaptive seats", "LED matrix lights", "Lane assist"]
    }
  },
  {
    id: "audi-rs6-avant",
    stockNumber: "VVS-2411",
    brand: "Audi",
    model: "RS6 Avant",
    variant: "Performance",
    year: 2024,
    price: 119900,
    currency: "EUR",
    mileage: 8400,
    mileageUnit: "km",
    fuel: "Petrol",
    transmission: "Automatic",
    engine: "4.0L V8",
    power: "630 HP",
    drive: "quattro",
    bodyType: "Wagon",
    exteriorColor: "Nardo Grey",
    interiorColor: "Black leather",
    location: "Gostivar",
    availability: "Immediate",
    status: "available",
    featured: false,
    published: true,
    createdAt: "2026-09-28",
    coverIndex: 0,
    photos: ["https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?auto=format&fit=crop&w=1600&q=82"],
    title: { mk: "Audi RS6 Avant", en: "Audi RS6 Avant" },
    description: {
      mk: "Високоперформансен караван со суперспортска моќ, практичност и длабоко премиум чувство.",
      en: "A high-performance estate with supercar power, everyday practicality, and a deeply premium cabin."
    },
    equipment: {
      mk: ["RS dynamic пакет", "Carbon детали", "Matrix LED", "Вентилирани седишта", "Bang & Olufsen", "Керамички сопирачки"],
      en: ["RS dynamic package", "Carbon trim", "Matrix LED", "Ventilated seats", "Bang & Olufsen", "Ceramic brakes"]
    }
  },
  {
    id: "range-rover-sport-phev",
    stockNumber: "VVS-2410",
    brand: "Range Rover",
    model: "Sport PHEV",
    variant: "Dynamic SE",
    year: 2024,
    price: 102900,
    currency: "EUR",
    mileage: 12600,
    mileageUnit: "km",
    fuel: "Hybrid",
    transmission: "Automatic",
    engine: "3.0L PHEV",
    power: "460 HP",
    drive: "AWD",
    bodyType: "SUV",
    exteriorColor: "Santorini Black",
    interiorColor: "Ebony",
    location: "Gostivar",
    availability: "Immediate",
    status: "available",
    featured: false,
    published: true,
    createdAt: "2026-09-05",
    coverIndex: 0,
    photos: ["https://images.unsplash.com/photo-1606016159991-dfe4f2746ad5?auto=format&fit=crop&w=1600&q=82"],
    title: { mk: "Range Rover Sport PHEV", en: "Range Rover Sport PHEV" },
    description: {
      mk: "Рафиниран plug-in hybrid SUV со одличен комфор, дискретен дизајн и лесни перформанси.",
      en: "A refined plug-in hybrid SUV with excellent comfort, discreet design, and effortless performance."
    },
    equipment: {
      mk: ["PHEV погон", "Meridian звук", "Pixel LED", "Soft-close врати", "Terrain response", "Масажни седишта"],
      en: ["PHEV drivetrain", "Meridian sound", "Pixel LED", "Soft-close doors", "Terrain response", "Massage seats"]
    }
  },
  {
    id: "volkswagen-golf-r",
    stockNumber: "VVS-2306",
    brand: "Volkswagen",
    model: "Golf R",
    variant: "4Motion",
    year: 2023,
    price: 42900,
    currency: "EUR",
    mileage: 21700,
    mileageUnit: "km",
    fuel: "Petrol",
    transmission: "DSG",
    engine: "2.0L TSI",
    power: "320 HP",
    drive: "4Motion",
    bodyType: "Hatchback",
    exteriorColor: "Lapiz Blue",
    interiorColor: "Black",
    location: "Gostivar",
    availability: "Immediate",
    status: "available",
    featured: false,
    published: true,
    createdAt: "2026-08-18",
    coverIndex: 0,
    photos: ["https://images.unsplash.com/photo-1617814076367-b759c7d7e738?auto=format&fit=crop&w=1600&q=82"],
    title: { mk: "Volkswagen Golf R", en: "Volkswagen Golf R" },
    description: {
      mk: "Остар performance hatchback со погон на сите тркала, силна спецификација и секојдневен комфор.",
      en: "A sharp all-weather performance hatch with strong specification and daily comfort."
    },
    equipment: {
      mk: ["R Performance", "DSG", "Спортски издув", "Digital cockpit", "Адаптивни амортизери", "Keyless"],
      en: ["R Performance", "DSG", "Sport exhaust", "Digital cockpit", "Adaptive dampers", "Keyless entry"]
    }
  }
];

function getLang() {
  const path = window.location.pathname;
  if (path.startsWith("/en")) return "en";
  if (path.startsWith("/mk")) return "mk";
  return localStorage.getItem("vvs.lang") || "mk";
}

function setLang(lang) {
  localStorage.setItem("vvs.lang", lang);
}

function publicBase(lang = getLang()) {
  return lang === "en" ? "/en" : "/mk";
}

function vehiclesPath(lang = getLang()) {
  return lang === "en" ? "/en/vehicles/" : "/mk/vozila/";
}

function vehicleUrl(vehicle, lang = getLang()) {
  return `${vehiclesPath(lang)}${vehicle.slug || vehicle.id}`;
}

function getVehicles({ includeDrafts = false } = {}) {
  const stored = localStorage.getItem(VVS_STORAGE_KEY);
  const source = stored ? JSON.parse(stored) : defaultVehicles;
  return includeDrafts ? source : source.filter((vehicle) => vehicle.published && vehicle.status !== "hidden");
}

function saveVehicles(nextVehicles) {
  localStorage.setItem(VVS_STORAGE_KEY, JSON.stringify(nextVehicles));
}

function resetVehicles() {
  localStorage.removeItem(VVS_STORAGE_KEY);
}

function coverImage(vehicle) {
  if (vehicle.coverUrl) return vehicle.coverUrl;
  if (vehicle.images?.length) return vehicle.images.find((image) => image.isCover)?.url || vehicle.images[0].url;
  return vehicle.photos?.[vehicle.coverIndex || 0] || vehicle.photos?.[0] || "";
}

function titleFor(vehicle, lang = getLang()) {
  if (typeof vehicle.title === "string") return vehicle.title;
  return vehicle.title?.[lang] || vehicle.title?.en || `${vehicle.brand} ${vehicle.model}`;
}

function descriptionFor(vehicle, lang = getLang()) {
  if (typeof vehicle.description === "string") return vehicle.description;
  return vehicle.description?.[lang] || vehicle.description?.en || "";
}

function equipmentFor(vehicle, lang = getLang()) {
  if (vehicle.features?.length) return vehicle.features.map((feature) => feature[lang] || feature.name_mk || feature.name_en || feature.en).filter(Boolean);
  return vehicle.equipment?.[lang] || vehicle.equipment?.en || [];
}

function statusFor(vehicle, lang = getLang()) {
  return statusLabels[vehicle.status]?.[lang] || vehicle.status;
}

function fuelFor(value, lang = getLang()) {
  return fuelLabels[value]?.[lang] || value;
}

function formatPrice(vehicle, lang = getLang()) {
  if (!Number(vehicle.price)) return i18n[lang].priceOnRequest;
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: vehicle.currency || "EUR",
    maximumFractionDigits: 0
  }).format(Number(vehicle.price || 0));
}

function formatKm(km) {
  return `${new Intl.NumberFormat("de-DE").format(Number(km || 0))} km`;
}

function slugify(value) {
  return value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const valueLabels = {
  manual: { mk: "Рачен", en: "Manual" },
  automatic: { mk: "Автоматски", en: "Automatic" },
  "semi-automatic": { mk: "Полуавтоматски", en: "Semi-automatic" },
  black: { mk: "Црна", en: "Black" },
  white: { mk: "Бела", en: "White" },
  silver: { mk: "Сребрена", en: "Silver" },
  grey: { mk: "Сива", en: "Grey" },
  gray: { mk: "Сива", en: "Grey" },
  blue: { mk: "Сина", en: "Blue" },
  red: { mk: "Црвена", en: "Red" },
  green: { mk: "Зелена", en: "Green" },
  brown: { mk: "Кафеава", en: "Brown" },
  beige: { mk: "Беж", en: "Beige" },
  yellow: { mk: "Жолта", en: "Yellow" },
  orange: { mk: "Портокалова", en: "Orange" },
  sedan: { mk: "Седан", en: "Sedan" },
  hatchback: { mk: "Хечбек", en: "Hatchback" },
  estate: { mk: "Караван", en: "Estate" },
  wagon: { mk: "Караван", en: "Estate" },
  coupe: { mk: "Купе", en: "Coupe" },
  convertible: { mk: "Кабриолет", en: "Convertible" },
  van: { mk: "Комбе", en: "Van" },
  fwd: { mk: "Преден погон", en: "Front-wheel drive" },
  rwd: { mk: "Заден погон", en: "Rear-wheel drive" },
  awd: { mk: "4x4", en: "All-wheel drive" },
  "4x4": { mk: "4x4", en: "4x4" }
};

function labelFor(value, lang = getLang()) {
  if (value === null || value === undefined || value === "") return "";
  return valueLabels[String(value).trim().toLowerCase()]?.[lang] || value;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
