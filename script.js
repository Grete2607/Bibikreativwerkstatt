const SHOP_EMAIL = "bibikreativwerkstatt@gmail.com";

const products = [
  {id:1,name:"Zitronenliebe",price:19.90,image:"zitronenliebe.webp",description:"Fröhliche Zitronen mit weißen Blüten.",badge:"Sommerliebling"},
  {id:2,name:"Rosé Blütenbogen",price:22.90,image:"bluetenbogen.webp",description:"Florales Design in warmem Rosé.",badge:"Handmade"},
  {id:3,name:"Blue Blossom",price:24.90,image:"blaues-bluemchen.webp",description:"Zarte Blütenoptik in Creme und Blau.",badge:"Unikat"},
  {id:4,name:"Golden Garden",price:24.90,image:"goldene-bluete.webp",description:"Florale Details mit goldfarbenem Stecker.",badge:"Elegant"}
];

let cart = JSON.parse(localStorage.getItem("bibiCart") || "[]");
const grid = document.getElementById("productGrid");
const cartDrawer = document.getElementById("cartDrawer");
const overlay = document.getElementById("overlay");
const cartItems = document.getElementById("cartItems");
const cartCount = document.getElementById("cartCount");
const cartTotal = document.getElementById("cartTotal");
const checkoutDialog = document.getElementById("checkoutDialog");

const money = v => new Intl.NumberFormat("de-AT",{style:"currency",currency:"EUR"}).format(v);

function renderProducts(){
  grid.innerHTML = products.map(p=>`
    <article class="product-card">
      <div class="product-img"><img src="${p.image}" alt="${p.name}"><span class="badge">${p.badge}</span></div>
      <div class="product-body">
        <h3>${p.name}</h3><p>${p.description}</p>
        <div class="product-bottom"><span class="price">${money(p.price)}</span><button class="add" data-id="${p.id}">+ Warenkorb</button></div>
      </div>
    </article>`).join("");
  document.querySelectorAll(".add").forEach(b=>b.onclick=()=>addToCart(+b.dataset.id));
}
function addToCart(id){
  const x=cart.find(i=>i.id===id); x?x.qty++:cart.push({id,qty:1}); save();renderCart();openCart();
}
function save(){localStorage.setItem("bibiCart",JSON.stringify(cart))}
function removeFromCart(id){cart=cart.filter(i=>i.id!==id);save();renderCart()}
function renderCart(){
  cartCount.textContent=cart.reduce((s,i)=>s+i.qty,0);
  if(!cart.length){cartItems.innerHTML='<div class="cart-empty">Dein Warenkorb ist noch leer.<br>Such dir dein Lieblingspaar aus ♡</div>';cartTotal.textContent=money(0);return;}
  cartItems.innerHTML=cart.map(i=>{
    const p=products.find(p=>p.id===i.id);
    return `<div class="cart-item"><img src="${p.image}"><div><h4>${p.name}</h4><small>${i.qty} × ${money(p.price)}</small></div><button class="remove" data-id="${p.id}">×</button></div>`;
  }).join("");
  document.querySelectorAll(".remove").forEach(b=>b.onclick=()=>removeFromCart(+b.dataset.id));
  cartTotal.textContent=money(cart.reduce((s,i)=>{const p=products.find(p=>p.id===i.id);return s+p.price*i.qty},0));
}
function openCart(){cartDrawer.classList.add("open");overlay.classList.add("open")}
function closeCart(){cartDrawer.classList.remove("open");overlay.classList.remove("open")}
document.getElementById("openCart").onclick=openCart;
document.getElementById("closeCart").onclick=closeCart;
overlay.onclick=closeCart;

document.getElementById("checkoutButton").onclick=()=>{
  if(!cart.length)return alert("Dein Warenkorb ist leer.");
  closeCart();checkoutDialog.showModal();
};
document.getElementById("closeCheckout").onclick=()=>checkoutDialog.close();

document.getElementById("checkoutForm").onsubmit=e=>{
  e.preventDefault();
  const d=Object.fromEntries(new FormData(e.target).entries());
  const lines=cart.map(i=>{const p=products.find(p=>p.id===i.id);return `- ${i.qty} × ${p.name} – ${money(p.price*i.qty)}`});
  const total=cart.reduce((s,i)=>{const p=products.find(p=>p.id===i.id);return s+p.price*i.qty},0);
  const body=[
    "Hallo Bibi Kreativwerkstatt,","",
    "ich möchte gerne folgende Ohrringe bestellen:",...lines,"",
    `Gesamt: ${money(total)}`,"","Meine Daten:",
    `${d.firstName} ${d.lastName}`,d.street,`${d.zip} ${d.city}`,`E-Mail: ${d.email}`,"",
    d.note?`Anmerkung: ${d.note}`:"","",
    "Bitte bestätigt mir die Verfügbarkeit und sendet mir die Zahlungsinformationen.","","Liebe Grüße"
  ].filter(Boolean).join("\n");
  location.href=`mailto:${SHOP_EMAIL}?subject=${encodeURIComponent("Bestellung – Bibi Kreativwerkstatt")}&body=${encodeURIComponent(body)}`;
};
document.getElementById("year").textContent=new Date().getFullYear();
renderProducts();renderCart();