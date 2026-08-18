
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
const STRIPE_CHECKOUT_ENDPOINT = "https://throbbing-breeze-6cf1.bibikreativwerkstatt.workers.dev";

let products = [];
let cart = JSON.parse(localStorage.getItem("bibiCart") || "[]");

const grid = document.getElementById("productGrid");
const cartDrawer = document.getElementById("cartDrawer");
const overlay = document.getElementById("overlay");
const cartItems = document.getElementById("cartItems");
const cartCount = document.getElementById("cartCount");
const cartTotal = document.getElementById("cartTotal");
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
  grid.innerHTML = visible.map(p => `
    <article class="product-card ${p.available === false ? "sold-out" : ""}">
      <div class="product-img">
        <img src="${p.image}" alt="${escapeHtml(p.name)}">
        <span class="badge">${p.available === false ? "Ausverkauft" : escapeHtml(p.badge || "Handmade")}</span>
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
    </article>`).join("");

  document.querySelectorAll(".add[data-id]").forEach(b => b.onclick = () => addToCart(b.dataset.id));
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
    cartItems.innerHTML='<div class="cart-empty">Dein Warenkorb ist noch leer.<br>Such dir dein Lieblingspaar aus ♡</div>';
    cartTotal.textContent=money(0); return;
  }
  cartItems.innerHTML = cart.map(i => {
    const p = products.find(p=>p.id===i.id);
    if(!p) return "";
    return `<div class="cart-item"><img src="${p.image}" alt="${escapeHtml(p.name)}"><div><h4>${escapeHtml(p.name)}</h4><small>${i.qty} × ${money(Number(p.price)||0)}</small></div><button class="remove" data-id="${escapeHtml(p.id)}">×</button></div>`;
  }).join("");
  document.querySelectorAll(".remove").forEach(b=>b.onclick=()=>removeFromCart(b.dataset.id));
  cartTotal.textContent = money(cart.reduce((s,i)=>{
    const p=products.find(p=>p.id===i.id);
    return p ? s+(Number(p.price)||0)*i.qty : s;
  },0));
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
        customer
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
    submitButton.textContent = "Bestellung absenden";
  }
};

function createOrderNumber(){
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,"0")}${String(now.getDate()).padStart(2,"0")}`;
  const random = Math.floor(1000 + Math.random()*9000);
  return `BIBI-${date}-${random}`;
}

document.getElementById("closeSuccess").onclick = () => document.getElementById("successDialog").close();


function handleStripeReturn(){
  const params = new URLSearchParams(window.location.search);
  const result = params.get("checkout");

  if(result === "success"){
    cart = [];
    save();
    renderCart();

    const successDialog = document.getElementById("successDialog");
    const successOrderNumber = document.getElementById("successOrderNumber");

    if(successOrderNumber){
      successOrderNumber.textContent = "Zahlung erfolgreich";
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

handleStripeReturn();
