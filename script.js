const TAX_RATE = 0.10;
const initialProducts = ["Beras","Plastik sampah","Soklin lantai","Kerupuk","Gelas cup","Kertas","Gula","Kopi","Kertas nasi"].map(name => ({name, stock: 50}));

function readStorage(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch (error) {
    console.warn("Data lokal tidak dapat dibaca:", key, error);
    return fallback;
  }
}
let products = readStorage("kasir_products", initialProducts).map(product =>
  typeof product === "string" ? {name: product, stock: 50} : {name: product.name, stock: Number(product.stock ?? 0)}
);
let transactions = readStorage("kasir_transactions", []);
let cart = [];

const $ = id => document.getElementById(id);
const rupiah = n => new Intl.NumberFormat("id-ID", {
  style: "currency", currency: "IDR", maximumFractionDigits: 0
}).format(Number(n) || 0);
const todayISO = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({
  "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
}[char]));

function saveData() {
  try {
    localStorage.setItem("kasir_products", JSON.stringify(products));
    localStorage.setItem("kasir_transactions", JSON.stringify(transactions));
    return true;
  } catch (error) {
    alert("Penyimpanan browser penuh atau tidak tersedia. Ekspor data lama terlebih dahulu.");
    return false;
  }
}
function showPage(page) {
  document.querySelectorAll(".page").forEach(section => section.classList.toggle("active", section.id === `page-${page}`));
  document.querySelectorAll(".nav-btn").forEach(button => button.classList.toggle("active", button.dataset.page === page));
  const titles = {dashboard:"Dashboard", transaksi:"Transaksi Baru", barang:"Data Produk", riwayat:"Riwayat Transaksi", laporan:"Laporan Harian"};
  $("page-title").textContent = titles[page] || "Dashboard";
  if (page === "laporan") renderReport();
}
document.querySelectorAll(".nav-btn").forEach(button => button.addEventListener("click", () => showPage(button.dataset.page)));
document.querySelectorAll("[data-go]").forEach(button => button.addEventListener("click", () => showPage(button.dataset.go)));

$("today").textContent = new Date().toLocaleDateString("id-ID", {weekday:"long", day:"numeric", month:"long", year:"numeric"});
$("transaction-date").value = todayISO();
$("report-date").value = todayISO();

function renderProducts() {
  $("products-body").innerHTML = products.length ? products.map((product, index) => `
    <tr><td>${index + 1}</td><td>${escapeHtml(product.name)}</td><td>${product.stock}</td>
    <td><span class="status">${product.stock > 0 ? "Tersedia" : "Habis"}</span></td>
    <td class="action-cell"><button class="small-btn edit" data-edit="${index}">Edit</button><button class="small-btn delete" data-delete="${index}">Hapus</button></td></tr>`).join("")
    : `<tr><td colspan="5" class="empty">Belum ada produk.</td></tr>`;
  $("stat-items").textContent = products.length;
  document.querySelectorAll("[data-edit]").forEach(button => button.addEventListener("click", () => editProduct(Number(button.dataset.edit))));
  document.querySelectorAll("[data-delete]").forEach(button => button.addEventListener("click", () => deleteProduct(Number(button.dataset.delete))));
}
function renderTransactionSlots() {
  const host = $("transaction-slots");
  host.innerHTML = Array.from({length:10}, (_, i) => `
    <div class="transaction-slot">
      <span class="slot-number">${String(i+1).padStart(2,"0")}</span>
      <label class="slot-product">Nama barang
        <select class="slot-select" data-slot="${i}">
          <option value="">Pilih produk...</option>
          ${products.map((product, index) => `<option value="${index}">${escapeHtml(product.name)} — stok ${product.stock}</option>`).join("")}
        </select>
      </label>
      <label class="slot-qty">Jumlah
        <input class="slot-quantity" data-slot="${i}" type="number" min="1" step="1" value="1">
      </label>
      <label class="slot-price">Harga satuan (Rp)
        <input class="slot-unit-price" data-slot="${i}" type="number" min="0" step="1" placeholder="0">
      </label>
      <button class="primary slot-add" type="button" data-add-slot="${i}">＋ Tambah</button>
    </div>`).join("");
  host.querySelectorAll("[data-add-slot]").forEach(button =>
    button.addEventListener("click", () => addSlotToCart(Number(button.dataset.addSlot))));
}
function addSlotToCart(slot) {
  const select = document.querySelector(`.slot-select[data-slot="${slot}"]`);
  const qtyInput = document.querySelector(`.slot-quantity[data-slot="${slot}"]`);
  const priceInput = document.querySelector(`.slot-unit-price[data-slot="${slot}"]`);
  const selected = products[Number(select.value)];
  const qty = Number(qtyInput.value);
  const priceText = priceInput.value;
  const price = Number(priceText);
  if (!selected || !Number.isInteger(qty) || qty < 1 || priceText === "" || !Number.isFinite(price) || price < 0) {
    return alert("Pilih barang, isi jumlah minimal 1, dan masukkan harga yang benar.");
  }
  if (qty > selected.stock) return alert(`Stok ${selected.name} hanya tersisa ${selected.stock}.`);
  const alreadyInCart = cart.filter(item => item.name === selected.name).reduce((sum, item) => sum + item.qty, 0);
  if (alreadyInCart + qty > selected.stock) return alert(`Jumlah melebihi stok ${selected.name} yang tersedia (${selected.stock}).`);
  const existing = cart.find(item => item.name === selected.name && item.price === price);
  if (existing) existing.qty += qty;
  else cart.push({name:selected.name, qty, price});
  renderCart();
  select.value = "";
  qtyInput.value = 1;
  priceInput.value = "";
}
function editProduct(index) {
  const product = products[index];
  const oldName = product.name;
  const newName = prompt("Ubah nama produk:", product.name);
  if (newName === null) return;
  const clean = newName.trim();
  if (!clean) return alert("Nama produk tidak boleh kosong.");
  const newStock = prompt("Ubah jumlah stok:", product.stock);
  if (newStock === null) return;
  const stock = Number(newStock);
  if (!Number.isInteger(stock) || stock < 0) return alert("Stok harus berupa bilangan bulat 0 atau lebih.");
  if (products.some((p, i) => i !== index && p.name.toLowerCase() === clean.toLowerCase())) return alert("Nama produk sudah terdaftar.");
  product.name = clean; product.stock = stock;
  cart.forEach(item => { if (item.name === oldName) item.name = clean; });
  saveData(); renderAll();
}
function deleteProduct(index) {
  const name = products[index].name;
  if (!confirm(`Hapus produk "${name}" dari daftar? Riwayat transaksi tidak akan diubah.`)) return;
  products.splice(index, 1);
  saveData(); renderAll();
}
function cartTotals() {
  const subtotal = cart.reduce((sum, item) => sum + item.qty * item.price, 0);
  const tax = Math.round(subtotal * TAX_RATE);
  return {subtotal, tax, total:subtotal + tax};
}
function renderCart() {
  $("cart-body").innerHTML = cart.length ? cart.map((item, index) => `
    <tr><td>${escapeHtml(item.name)}</td><td>${item.qty}</td><td>${rupiah(item.price)}</td>
    <td>${rupiah(item.qty * item.price)}</td><td><button class="remove" data-remove="${index}">Hapus</button></td></tr>`).join("")
    : `<tr><td colspan="5" class="empty">Belum ada produk ditambahkan.</td></tr>`;
  const totals = cartTotals();
  $("cart-subtotal").textContent = rupiah(totals.subtotal);
  $("cart-tax").textContent = rupiah(totals.tax);
  $("cart-total").textContent = rupiah(totals.total);
  document.querySelectorAll("[data-remove]").forEach(button => button.addEventListener("click", () => {
    cart.splice(Number(button.dataset.remove), 1); renderCart();
  }));
  updateChange();
}
$("clear-cart").addEventListener("click", () => {
  if (cart.length && !confirm("Kosongkan semua produk dari transaksi ini?")) return;
  cart = []; renderCart();
});

$("payment-method").addEventListener("change", () => {
  const isCash = $("payment-method").value === "Tunai";
  $("cash-label").hidden = !isCash;
  $("payment-hint").textContent = isCash ? "Masukkan uang yang diterima dari pelanggan." : "Pembayaran debit dianggap sesuai total transaksi.";
  updateChange();
});
$("cash-received").addEventListener("input", updateChange);
function updateChange() {
  const total = cartTotals().total;
  const cash = Number($("cash-received").value) || 0;
  const isCash = $("payment-method").value === "Tunai";
  $("change-due").textContent = rupiah(isCash ? Math.max(0, cash - total) : 0);
}

$("save-transaction").addEventListener("click", () => {
  if (!cart.length) return alert("Tambahkan minimal satu produk.");
  const totals = cartTotals();
  const method = $("payment-method").value;
  const cashReceived = method === "Tunai" ? Number($("cash-received").value) : totals.total;
  if (method === "Tunai" && (!Number.isFinite(cashReceived) || cashReceived < totals.total)) {
    return alert("Uang diterima belum mencukupi total pembayaran.");
  }
  const date = $("transaction-date").value;
  if (!date) return alert("Tanggal transaksi harus diisi.");
  const transaction = {
    id: "TRX-" + Date.now().toString().slice(-8),
    buyer: $("buyer").value.trim() || "Umum",
    date,
    items: cart.map(item => ({...item})),
    subtotal: totals.subtotal,
    tax: totals.tax,
    taxRate: TAX_RATE,
    total: totals.total,
    paymentMethod: method,
    cashReceived,
    change: method === "Tunai" ? cashReceived - totals.total : 0
  };
  const stockChanges = [];
  for (const item of cart) {
    const product = products.find(p => p.name === item.name);
    if (!product || product.stock < item.qty) return alert(`Stok ${item.name} tidak mencukupi.`);
    product.stock -= item.qty;
    stockChanges.push({product, qty:item.qty});
  }
  transactions.unshift(transaction);
  if (!saveData()) {
    transactions.shift();
    stockChanges.forEach(change => change.product.stock += change.qty);
    return;
  }
  renderAll();
  printTransaction(transaction);
  cart = [];
  renderCart();
  $("buyer").value = "";
  $("cash-received").value = "";
  $("payment-method").value = "Tunai";
  $("cash-label").hidden = false;
  $("payment-hint").textContent = "Masukkan uang yang diterima dari pelanggan.";
});

function receiptMarkup(tx) {
  return `<section class="receipt-paper">
    <h2>KASIRKU</h2><p class="center">NOTA PEMBELIAN</p><hr>
    <p>No: ${escapeHtml(tx.id)}<br>Tanggal: ${escapeHtml(tx.date)}<br>Pembeli: ${escapeHtml(tx.buyer)}</p><hr>
    <table><thead><tr><th>Produk</th><th>Qty</th><th>Jumlah</th></tr></thead><tbody>
    ${tx.items.map(item => `<tr><td>${escapeHtml(item.name)}<br>${rupiah(item.price)}</td><td>${item.qty}</td><td>${rupiah(item.qty * item.price)}</td></tr>`).join("")}
    </tbody></table><hr>
    <p>Subtotal: <b>${rupiah(tx.subtotal)}</b><br>PPN 10%: <b>${rupiah(tx.tax)}</b></p>
    <h3>TOTAL: ${rupiah(tx.total)}</h3>
    <p>Metode: ${escapeHtml(tx.paymentMethod)}<br>Diterima: ${rupiah(tx.cashReceived)}<br>Kembalian: ${rupiah(tx.change)}</p>
    <p class="center">Terima kasih atas kunjungan Anda.</p>
  </section>
  <section class="kitchen-paper">
    <h2>PESANAN DAPUR / BARISTA</h2><p>No: ${escapeHtml(tx.id)}<br>Tanggal: ${escapeHtml(tx.date)}<br>Pembeli: ${escapeHtml(tx.buyer)}</p><hr>
    <table><thead><tr><th>Produk</th><th>Jumlah</th></tr></thead><tbody>
    ${tx.items.map(item => `<tr><td>${escapeHtml(item.name)}</td><td>${item.qty}</td></tr>`).join("")}
    </tbody></table><hr><p class="center">Siapkan pesanan sesuai daftar.</p>
  </section>`;
}
function printTransaction(tx) {
  $("print-area").innerHTML = receiptMarkup(tx);
  window.print();
}
function printExisting(index) { printTransaction(transactions[index]); }

function renderHistory() {
  const query = ($("history-search").value || "").toLowerCase();
  const filtered = transactions.map((tx, index) => ({tx, index})).filter(({tx}) =>
    tx.id.toLowerCase().includes(query) || tx.buyer.toLowerCase().includes(query));
  $("history-list").innerHTML = filtered.length ? filtered.map(({tx, index}) => `
    <div class="history-item"><div><b>${escapeHtml(tx.id)}</b><small>${escapeHtml(tx.date)} · ${escapeHtml(tx.buyer)} · ${escapeHtml(tx.paymentMethod || "-")}</small></div>
    <div class="history-right"><strong>${rupiah(tx.total)}</strong><button class="secondary" data-print="${index}">Cetak ulang</button></div></div>`).join("")
    : `<div class="empty">Tidak ada transaksi yang cocok.</div>`;
  document.querySelectorAll("[data-print]").forEach(button => button.addEventListener("click", () => printExisting(Number(button.dataset.print))));
}
$("history-search").addEventListener("input", renderHistory);

function getDateTransactions(date) { return transactions.filter(tx => tx.date === date); }
function renderDashboard() {
  const todays = getDateTransactions(todayISO());
  $("stat-count").textContent = todays.length;
  $("stat-total").textContent = rupiah(todays.reduce((sum, tx) => sum + tx.total, 0));
  $("dashboard-recent").innerHTML = transactions.length ? transactions.slice(0, 5).map(tx => `
    <div class="history-item"><div><b>${escapeHtml(tx.id)}</b><small>${escapeHtml(tx.date)} · ${escapeHtml(tx.buyer)}</small></div><strong>${rupiah(tx.total)}</strong></div>`).join("")
    : `<div class="empty">Belum ada transaksi. Mulai dari menu Transaksi Baru.</div>`;
  const cash = todays.filter(tx => tx.paymentMethod === "Tunai").reduce((sum, tx) => sum + tx.total, 0);
  const debit = todays.filter(tx => tx.paymentMethod === "Debit").reduce((sum, tx) => sum + tx.total, 0);
  $("payment-summary").innerHTML = `<div><span>Tunai</span><strong>${rupiah(cash)}</strong></div><div><span>Debit</span><strong>${rupiah(debit)}</strong></div>`;
}
function renderReport() {
  const date = $("report-date").value || todayISO();
  const rows = getDateTransactions(date);
  const total = rows.reduce((sum, tx) => sum + tx.total, 0);
  const tax = rows.reduce((sum, tx) => sum + (tx.tax ?? Math.round((tx.subtotal || tx.total) * TAX_RATE)), 0);
  $("report-count").textContent = rows.length;
  $("report-total").textContent = rupiah(total);
  $("report-tax").textContent = rupiah(tax);
  $("report-caption").textContent = `Tanggal ${date} · ${rows.length} transaksi`;
  $("report-list").innerHTML = rows.length ? `<div class="table-wrap"><table><thead><tr><th>No. Transaksi</th><th>Pembeli</th><th>Metode</th><th>Total</th></tr></thead><tbody>
    ${rows.map(tx => `<tr><td>${escapeHtml(tx.id)}</td><td>${escapeHtml(tx.buyer)}</td><td>${escapeHtml(tx.paymentMethod || "-")}</td><td>${rupiah(tx.total)}</td></tr>`).join("")}
    </tbody></table></div>` : `<div class="empty">Belum ada transaksi pada tanggal ini.</div>`;
}
$("report-date").addEventListener("change", renderReport);
$("print-report").addEventListener("click", () => {
  renderReport();
  const date = $("report-date").value || todayISO();
  const rows = getDateTransactions(date);
  const total = rows.reduce((sum, tx) => sum + tx.total, 0);
  const tax = rows.reduce((sum, tx) => sum + (tx.tax ?? 0), 0);
  $("print-area").innerHTML = `<section class="report-paper"><h2>LAPORAN PENJUALAN HARIAN</h2><p>Tanggal: ${escapeHtml(date)}</p><p>Jumlah transaksi: ${rows.length}</p><p>Total PPN: ${rupiah(tax)}</p><h3>Total penjualan: ${rupiah(total)}</h3><table><thead><tr><th>No. Transaksi</th><th>Pembeli</th><th>Metode</th><th>Total</th></tr></thead><tbody>${rows.map(tx => `<tr><td>${escapeHtml(tx.id)}</td><td>${escapeHtml(tx.buyer)}</td><td>${escapeHtml(tx.paymentMethod || "-")}</td><td>${rupiah(tx.total)}</td></tr>`).join("")}</tbody></table></section>`;
  window.print();
});

$("export-csv").addEventListener("click", () => {
  if (!transactions.length) return alert("Belum ada data transaksi untuk diekspor.");
  const rows = [["ID Transaksi","Tanggal","Pembeli","Metode","Subtotal","PPN","Total","Uang Diterima","Kembalian"]];
  transactions.forEach(tx => rows.push([tx.id, tx.date, tx.buyer, tx.paymentMethod || "-", tx.subtotal ?? tx.total, tx.tax ?? 0, tx.total, tx.cashReceived ?? tx.total, tx.change ?? 0]));
  const csv = rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const blob = new Blob(["\ufeff" + csv], {type:"text/csv;charset=utf-8;"});
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = `laporan-kasirku-${todayISO()}.csv`; link.click();
  URL.revokeObjectURL(url);
});

function renderAll() { renderProducts(); renderTransactionSlots(); renderHistory(); renderDashboard(); renderReport(); }
renderAll();

renderCart();
