
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

let products = [];
let cart = JSON.parse(localStorage.getItem("bibiCart") || "[]");

const grid = document.getElementById("productGrid");
const cartDrawer = document.getElementById("cartDrawer");
const overlay = document.getElementById("overlay");
const cartItems = document.getElementById("cartItems");
const cartCount = document.getElementById("cartCount");
const cartTotal = document.getElementById("cartTotal");
const checkoutDialog = document.getElementById("checkoutDialog");

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

  if(!ORDER_FORM_ENDPOINT || ORDER_FORM_ENDPOINT === "FORM_ENDPOINT_HIER_EINTRAGEN"){
    status.textContent = "Die automatische Bestellübermittlung ist noch nicht eingerichtet.";
    status.classList.add("error");
    return;
  }

  const d = Object.fromEntries(new FormData(e.target).entries());
  const orderNumber = createOrderNumber();

  const lines = cart.map(i => {
    const p = products.find(p => p.id === i.id);
    return p ? `${i.qty} × ${p.name} – ${money((Number(p.price)||0)*i.qty)}` : "";
  }).filter(Boolean);

  const total = cart.reduce((s,i) => {
    const p = products.find(p => p.id === i.id);
    return p ? s + (Number(p.price)||0) * i.qty : s;
  }, 0);

  const payload = new FormData();
  payload.append("Bestellnummer", orderNumber);
  payload.append("Vorname", d.firstName);
  payload.append("Nachname", d.lastName);
  payload.append("E-Mail", d.email);
  payload.append("Straße", d.street);
  payload.append("PLZ", d.zip);
  payload.append("Ort", d.city);
  payload.append("Land", d.country);
  payload.append("Anmerkung", d.note || "");
  payload.append("Produkte", lines.join("\n"));
  payload.append("Gesamt", money(total));
  payload.append("_subject", `Neue Bestellung ${orderNumber} – Bibi Kreativwerkstatt`);

  submitButton.disabled = true;
  submitButton.textContent = "Wird übermittelt …";
  status.textContent = "Bestellung wird gesendet …";

  try{
    const response = await fetch(ORDER_FORM_ENDPOINT, {
      method: "POST",
      body: payload,
      headers: {"Accept":"application/json"}
    });
    if(!response.ok) throw new Error("Übermittlung fehlgeschlagen");

    cart = [];
    save();
    renderCart();
    e.target.reset();
    checkoutDialog.close();

    document.getElementById("successOrderNumber").textContent = orderNumber;
    document.getElementById("successDialog").showModal();
  }catch(error){
    console.error(error);
    status.textContent = "Die Bestellung konnte nicht gesendet werden. Bitte versuche es erneut.";
    status.classList.add("error");
  }finally{
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

document.getElementById("year").textContent=new Date().getFullYear();
loadProducts();
loadSiteContent();
