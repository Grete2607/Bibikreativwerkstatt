
let siteContent = {};

function getByPath(obj, path){
  return path.split(".").reduce((acc, key) => acc && acc[key] !== undefined ? acc[key] : undefined, obj);
}

async function loadSiteContent(){
  try{
    const response = await fetch(`site.json?v=${Date.now()}`);
    if(!response.ok) throw new Error("site.json konnte nicht geladen werden");
    siteContent = await response.json();
    applySiteContent();
  }catch(error){
    console.error(error);
  }
}

function applySiteContent(){
  document.querySelectorAll("[data-site]").forEach(el => {
    const value = getByPath(siteContent, el.dataset.site);
    if(value !== undefined && value !== null) el.textContent = value;
  });

  document.querySelectorAll("[data-site-html]").forEach(el => {
    const value = getByPath(siteContent, el.dataset.siteHtml);
    if(typeof value === "string") el.innerHTML = escapeHtml(value).replaceAll("\\n","<br>");
  });

  document.querySelectorAll("[data-site-img]").forEach(el => {
    const value = getByPath(siteContent, el.dataset.siteImg);
    if(value) el.src = value;
  });

  document.querySelectorAll("[data-site-link]").forEach(el => {
    const value = getByPath(siteContent, el.dataset.siteLink);
    if(value) el.href = value;
  });

  document.querySelectorAll("[data-site-mail]").forEach(el => {
    const value = getByPath(siteContent, el.dataset.siteMail);
    if(value) el.href = `mailto:${value}`;
  });

  const benefitsGrid = document.getElementById("benefitsGrid");
  if(benefitsGrid && Array.isArray(siteContent.benefits)){
    benefitsGrid.innerHTML = siteContent.benefits.map(item => `
      <div>
        <span>${escapeHtml(item.icon || "♡")}</span>
        <strong>${escapeHtml(item.title || "")}</strong>
        <small>${escapeHtml(item.text || "")}</small>
      </div>`).join("");
  }
}

const SHOP_EMAIL = "bibikreativwerkstatt@gmail.com";
const ORDER_FORM_ENDPOINT = "https://formspree.io/f/xkjwqedp";
const STRIPE_CHECKOUT_ENDPOINT = "https://throbbing-breeze-6d1d.bibikreativwerkstatt.workers.dev";

let products = [];
let cart = JSON.parse(localStorage.getItem("bibiCart") || "[]");

const grid = document.getElementById("productGrid");
const cartDrawer = document.getElementById("cartDrawer");
const overlay = document.getElementById("overlay");
const cartItems = document.getElementById("cartItems");
const cartCount = document.getElementById("cartCount");
const cartTotal = document.getElementById("cartTotal");
const cartSubtotal = document.getElementById("cartSubtotal");
const discountSummary = document.getElementById("discountSummary");
const discountLabel = document.getElementById("discountLabel");
const discountAmount = document.getElementById("discountAmount");
const checkoutDialog = document.getElementById("checkoutDialog");

function escapeHtml(value = ""){
  return String(value)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

const money = v => new Intl.NumberFormat("de-AT", {style:"currency", currency:"EUR"}).format(v);

async function loadProducts(){
  try{
    const response = await fetch(`products.json?v=${Date.now()}`);
    if(!response.ok) throw new Error("products.json konnte nicht geladen werden");
    const data = await response.json();
    products = Array.isArray(data) ? data : Object.values(data);
    renderProducts();
    cleanupCart();
    renderCart();
  }catch(error){
    console.error(error);
    grid.innerHTML = '<div class="load-error">Die Produkte konnten gerade nicht geladen werden. Bitte die Seite neu laden.</div>';
  }
}

function renderProducts(){
  const visible = products.filter(p => p.visible !== false);
 grid.innerHTML = visible.map(p => {
  const productImages = [
    p.image,
    ...(Array.isArray(p.images) ? p.images : [])
  ].filter(Boolean);

  return `
    <article class="product-card ${p.available === false ? "sold-out" : ""}">
<div class="product-img product-gallery" data-gallery="${escapeHtml(p.id)}">
  <img
    src="${productImages[0]}"
    alt="${escapeHtml(p.name)}"
    class="gallery-image"
    data-index="0"
  >

  <span class="badge">
    ${p.available === false ? "Ausverkauft" : escapeHtml(p.badge || "Handmade")}
  </span>

  ${productImages.length > 1 ? `
    <button
      type="button"
      class="gallery-arrow gallery-prev"
      data-id="${escapeHtml(p.id)}"
      aria-label="Vorheriges Bild"
    >‹</button>

    <button
      type="button"
      class="gallery-arrow gallery-next"
      data-id="${escapeHtml(p.id)}"
      aria-label="Nächstes Bild"
    >›</button>

    <div class="gallery-dots">
      ${productImages.map((_, index) => `
        <span class="gallery-dot ${index === 0 ? "active" : ""}"></span>
      `).join("")}
    </div>
  ` : ""}
</div>
      <div class="product-body">
        <h3>${escapeHtml(p.name)}</h3>
        <p>${escapeHtml(p.description || "")}</p>
        <div class="product-bottom">
          <span class="price">${money(Number(p.price) || 0)}</span>
          ${p.available === false
            ? '<button class="add disabled" disabled>Ausverkauft</button>'
            : `<button class="add" data-id="${escapeHtml(p.id)}">+ Warenkorb</button>`}
        </div>
           </div>
    </article>
  `;
}).join("");

document.querySelectorAll(".add[data-id]").forEach(
  b => b.onclick = () => addToCart(b.dataset.id)
);

document.querySelectorAll(".gallery-arrow").forEach(button => {
  button.onclick = () => {
    const id = button.dataset.id;
    const product = products.find(p => p.id === id);

    if (!product) return;

    const productImages = [
      product.image,
      ...(Array.isArray(product.images) ? product.images : [])
    ].filter(Boolean);

    if (productImages.length <= 1) return;

    const gallery = document.querySelector(
      `.product-gallery[data-gallery="${CSS.escape(id)}"]`
    );

    if (!gallery) return;

    const image = gallery.querySelector(".gallery-image");
    const dots = gallery.querySelectorAll(".gallery-dot");

    let index = Number(image.dataset.index || 0);

    if (button.classList.contains("gallery-next")) {
      index = (index + 1) % productImages.length;
    } else {
      index =
        (index - 1 + productImages.length) %
        productImages.length;
    }

    image.src = productImages[index];
    image.dataset.index = String(index);

    dots.forEach((dot, dotIndex) => {
      dot.classList.toggle(
        "active",
        dotIndex === index
      );
    });
  };
});
  
}

function addToCart(id){
  const p = products.find(p => p.id === id);
  if(!p || p.available === false) return;
  const found = cart.find(i => i.id === id);
  found ? found.qty++ : cart.push({id, qty:1});
  save();
  renderCart();
  openCart();
}
function save(){localStorage.setItem("bibiCart", JSON.stringify(cart))}
function cleanupCart(){
  cart = cart.filter(i => {
    const p = products.find(p => p.id === i.id);
    return p && p.available !== false;
  });
  save();
}
function removeFromCart(id){cart = cart.filter(i => i.id !== id); save(); renderCart()}
function renderCart(){
  cartCount.textContent = cart.reduce((s,i)=>s+i.qty,0);
 if(!cart.length){
  cartItems.innerHTML =
    '<div class="cart-empty">Dein Warenkorb ist noch leer.<br>Such dir dein Lieblingspaar aus ♡</div>';

  cartSubtotal.textContent = money(0);
  cartTotal.textContent = money(0);

  discountSummary.hidden = true;
  discountLabel.textContent = "Rabatt";
  discountAmount.textContent = "− € 0,00";

  appliedDiscount = null;

  if (discountInput) {
    discountInput.value = "";
  }

  if (discountStatus) {
    discountStatus.textContent = "";
    discountStatus.className = "discount-status";
  }

  return;
}
  cartItems.innerHTML = cart.map(i => {
    const p = products.find(p=>p.id===i.id);
    if(!p) return "";
    return `<div class="cart-item"><img src="${p.image}" alt="${escapeHtml(p.name)}"><div><h4>${escapeHtml(p.name)}</h4><small>${i.qty} × ${money(Number(p.price)||0)}</small></div><button class="remove" data-id="${escapeHtml(p.id)}">×</button></div>`;
  }).join("");
  document.querySelectorAll(".remove").forEach(b=>b.onclick=()=>removeFromCart(b.dataset.id));
 const subtotal = cart.reduce((sum, item) => {
  const product = products.find(p => p.id === item.id);

  return product
    ? sum + (Number(product.price) || 0) * item.qty
    : sum;
}, 0);

const discountValue = appliedDiscount
  ? subtotal * (appliedDiscount.percent / 100)
  : 0;

const finalTotal = subtotal - discountValue;

cartSubtotal.textContent = money(subtotal);
cartTotal.textContent = money(finalTotal);

if (appliedDiscount) {
  discountSummary.hidden = false;
  discountLabel.textContent =
    `Rabatt ${appliedDiscount.code} (${appliedDiscount.percent} %)`;

  discountAmount.textContent =
    `− ${money(discountValue)}`;
} else {
  discountSummary.hidden = true;
  discountLabel.textContent = "Rabatt";
  discountAmount.textContent = "− € 0,00";
}
}

let appliedDiscount = null;

const discountInput = document.getElementById("discountCode");
const applyDiscountButton = document.getElementById("applyDiscount");
const removeDiscountButton = document.getElementById("removeDiscount");
const discountStatus = document.getElementById("discountStatus");

if (applyDiscountButton) {
  applyDiscountButton.onclick = async () => {
    const code = String(discountInput?.value || "")
      .trim()
      .toUpperCase();

    discountStatus.className = "discount-status";

    if (!code) {
      appliedDiscount = null;
      discountStatus.textContent = "Bitte gib einen Rabattcode ein.";
      discountStatus.classList.add("error");
      renderCart();
      return;
    }

    try {
      const response = await fetch(
        `discounts.json?v=${Date.now()}`
      );

      if (!response.ok) {
        throw new Error("Rabattcodes konnten nicht geladen werden.");
      }

      const data = await response.json();

      const discounts = Array.isArray(data)
        ? data
        : Object.values(data);

      const discount = discounts.find(
        item =>
          String(item.code || "")
            .trim()
            .toUpperCase() === code
      );

      if (!discount) {
        throw new Error("Dieser Rabattcode ist ungültig.");
      }

      if (discount.active !== true) {
        throw new Error("Dieser Rabattcode ist nicht aktiv.");
      }

      const today = new Intl.DateTimeFormat(
        "en-CA",
        {
          timeZone: "Europe/Vienna",
          year: "numeric",
          month: "2-digit",
          day: "2-digit"
        }
      ).format(new Date());

      if (
        discount.valid_from &&
        today < discount.valid_from
      ) {
        throw new Error("Dieser Rabattcode ist noch nicht gültig.");
      }

      if (
        discount.valid_until &&
        today > discount.valid_until
      ) {
        throw new Error("Dieser Rabattcode ist leider abgelaufen.");
      }

      const percent = Number(discount.percent);

      if (
        !Number.isFinite(percent) ||
        percent <= 0 ||
        percent > 100
      ) {
        throw new Error("Dieser Rabattcode ist ungültig.");
      }

      appliedDiscount = {
        code,
        percent
      };

      discountInput.value = code;
      removeDiscountButton.hidden = false;

      discountStatus.textContent =
        `${percent} % Rabatt wurden angewendet.`;

      discountStatus.classList.add("success");

      renderCart();

    } catch (error) {
      appliedDiscount = null;

      discountStatus.textContent =
        error?.message || "Rabattcode konnte nicht geprüft werden.";

      discountStatus.classList.add("error");

      renderCart();
    }
  };
}
if (removeDiscountButton) {
  removeDiscountButton.onclick = () => {
    appliedDiscount = null;

    if (discountInput) {
      discountInput.value = "";
    }

    if (discountStatus) {
      discountStatus.textContent = "";
      discountStatus.className = "discount-status";
    }

    removeDiscountButton.hidden = true;

    renderCart();
  };
}
function openCart(){cartDrawer.classList.add("open");overlay.classList.add("open")}
function closeCart(){cartDrawer.classList.remove("open");overlay.classList.remove("open")}
document.getElementById("openCart").onclick=openCart;
document.getElementById("closeCart").onclick=closeCart;
overlay.onclick=closeCart;

document.getElementById("checkoutButton").onclick=()=>{
  if(!cart.length) return alert("Dein Warenkorb ist leer.");
  closeCart(); checkoutDialog.showModal();
};
document.getElementById("closeCheckout").onclick=()=>checkoutDialog.close();

document.getElementById("checkoutForm").onsubmit = async e => {
  e.preventDefault();

  const status = document.getElementById("checkoutStatus");
  const submitButton = document.getElementById("submitOrderButton");
  status.className = "checkout-status";

  if(!STRIPE_CHECKOUT_ENDPOINT){
    status.textContent = "Stripe Checkout ist noch nicht eingerichtet.";
    status.classList.add("error");
    return;
  }

  const d = Object.fromEntries(new FormData(e.target).entries());

  const items = cart.map(item => ({
    id: item.id,
    qty: item.qty
  }));

  if(!items.length){
    status.textContent = "Dein Warenkorb ist leer.";
    status.classList.add("error");
    return;
  }

  const customer = {
    firstName: d.firstName || "",
    lastName: d.lastName || "",
    email: d.email || "",
    street: d.street || "",
    zip: d.zip || "",
    city: d.city || "",
    country: d.country || "",
    note: d.note || ""
  };

  submitButton.disabled = true;
  submitButton.textContent = "Stripe wird geöffnet …";
  status.textContent = "Sichere Zahlung wird vorbereitet …";

  try{
    const response = await fetch(STRIPE_CHECKOUT_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=UTF-8"
      },
     body: JSON.stringify({
  items,
  customer,
discountCode:
  appliedDiscount?.code || ""
})
    });

    const data = await response.json();

    if(!response.ok || !data.url){
      throw new Error(
        data?.error ||
        "Stripe Checkout konnte nicht erstellt werden."
      );
    }

    // Wichtig: Warenkorb noch NICHT leeren.
    // Er wird erst nach erfolgreicher Zahlung geleert.
    window.location.href = data.url;

  }catch(error){
    console.error(error);
    status.textContent =
      error?.message ||
      "Die Zahlung konnte nicht gestartet werden. Bitte versuche es erneut.";
    status.classList.add("error");
    submitButton.disabled = false;
    submitButton.textContent = "Zahlungspflichtig bestellen";
  }
};

function createOrderNumber(){
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,"0")}${String(now.getDate()).padStart(2,"0")}`;
  const random = Math.floor(1000 + Math.random()*9000);
  return `BIBI-${date}-${random}`;
}

document.getElementById("closeSuccess").onclick = () => document.getElementById("successDialog").close();


async function handleStripeReturn(){
  const params = new URLSearchParams(window.location.search);
  const result = params.get("checkout");
  const sessionId = params.get("session_id");

  if(result === "success"){
    cart = [];
    save();
    renderCart();

    const successDialog = document.getElementById("successDialog");
const successOrderNumber = document.getElementById("successOrderNumber");

if (sessionId && successOrderNumber) {
  try {
    const response = await fetch(
      `${STRIPE_CHECKOUT_ENDPOINT}/session?session_id=${encodeURIComponent(sessionId)}`
    );

    const data = await response.json();

    if (response.ok && data.orderNumber) {
      successOrderNumber.textContent = data.orderNumber;
    } else {
      successOrderNumber.textContent = "Bestellung erfolgreich";
    }
  } catch (error) {
    console.error("Bestellnummer konnte nicht geladen werden:", error);
    successOrderNumber.textContent = "Bestellung erfolgreich";
  }
}

if(successDialog && typeof successDialog.showModal === "function"){
  
      successDialog.showModal();
    }else{
      alert("Vielen Dank! Die Zahlung war erfolgreich.");
    }

    // URL anschließend bereinigen, damit die Meldung bei F5 nicht erneut erscheint
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  if(result === "cancelled"){
    const status = document.getElementById("checkoutStatus");
    if(status){
      status.textContent = "Zahlung abgebrochen. Dein Warenkorb bleibt erhalten.";
      status.className = "checkout-status error";
    }
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

document.getElementById("year").textContent=new Date().getFullYear();
loadProducts();
loadSiteContent();

const withdrawalDialog =
  document.getElementById("withdrawalDialog");

const openWithdrawal =
  document.getElementById("openWithdrawal");

const closeWithdrawal =
  document.getElementById("closeWithdrawal");

if (openWithdrawal && withdrawalDialog) {
  openWithdrawal.onclick = () => {
    withdrawalDialog.showModal();
  };
}

if (closeWithdrawal && withdrawalDialog) {
  closeWithdrawal.onclick = () => {
    withdrawalDialog.close();
  };
}
const withdrawalForm =
  document.getElementById("withdrawalForm");

if (withdrawalForm) {
  withdrawalForm.onsubmit = async (event) => {
    event.preventDefault();

    const status =
      document.getElementById("withdrawalStatus");

    const submitButton =
      document.getElementById("submitWithdrawal");

    const formData =
      new FormData(withdrawalForm);

    const data = {
      name: formData.get("name") || "",
      email: formData.get("email") || "",
      orderNumber: formData.get("orderNumber") || "",
      products: formData.get("products") || "",
      orderedAt: formData.get("orderedAt") || "",
      receivedAt: formData.get("receivedAt") || ""
    };

    submitButton.disabled = true;
    submitButton.textContent = "Widerruf wird übermittelt …";

    status.textContent =
      "Dein Widerruf wird übermittelt …";

    status.className = "checkout-status";

    try {
      const response = await fetch(
        `${STRIPE_CHECKOUT_ENDPOINT}/withdrawal`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(data)
        }
      );

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(
          result?.error ||
          "Der Widerruf konnte nicht übermittelt werden."
        );
      }

      withdrawalForm.reset();

submitButton.disabled = false;
submitButton.textContent = "Widerruf absenden";

withdrawalDialog.close();

const withdrawalSuccessDialog =
  document.getElementById("withdrawalSuccessDialog");

if (
  withdrawalSuccessDialog &&
  typeof withdrawalSuccessDialog.showModal === "function"
) {
  withdrawalSuccessDialog.showModal();
}
    } catch (error) {
      console.error(
        "Widerruf konnte nicht übermittelt werden:",
        error
      );

      status.textContent =
        error?.message ||
        "Der Widerruf konnte nicht übermittelt werden. Bitte versuche es erneut.";

      status.className =
        "checkout-status error";

      submitButton.disabled = false;
      submitButton.textContent =
        "Widerruf absenden";
    }
  };
}

const closeWithdrawalSuccess =
  document.getElementById("closeWithdrawalSuccess");

const withdrawalSuccessDialog =
  document.getElementById("withdrawalSuccessDialog");

if (closeWithdrawalSuccess && withdrawalSuccessDialog) {
  closeWithdrawalSuccess.onclick = () => {
    withdrawalSuccessDialog.close();
  };
}

handleStripeReturn();

window.addEventListener("pageshow", () => {
  const submitButton =
    document.getElementById("submitOrderButton");

  const status =
    document.getElementById("checkoutStatus");

  if (submitButton) {
    submitButton.disabled = false;
    submitButton.textContent =
      "Zahlungspflichtig bestellen";
  }

  if (status) {
    status.textContent = "";
    status.className = "checkout-status";
  }
});
