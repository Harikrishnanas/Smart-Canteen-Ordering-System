// public/js/user.js

document.addEventListener('DOMContentLoaded', () => {
  // Auth check
  const userStr = localStorage.getItem('canteen_user');
  if (!userStr) { window.location.replace('/login.html'); return; }
  const user = JSON.parse(userStr);
  if (user.role !== 'user') { window.location.replace('/login.html'); return; }

  // Navigation lock
  history.pushState(null, null, location.href);
  window.addEventListener('popstate', () => {
    history.pushState(null, null, location.href);
    showToast('Use the Logout button to navigate away.', true);
  });
  setInterval(() => { if (localStorage.getItem('canteen_user')) history.pushState(null, null, location.href); }, 5000);

  // User display
  const initials = (user.phone_email || 'U').charAt(0).toUpperCase();
  document.getElementById('userInitial').textContent = initials;

  // ---- State ----
  let menuItems = [];
  let cart = [];             // {item, quantity}
  let activeCategory = 'All';
  let selectedPayment = 'cash';
  let serverOffset = 0;
  const activeIntervals = {};

  // r=60 for 140px svg (140/2 - 10px stroke padding)
  const circumference = 2 * Math.PI * 60;

  // ---- DOM ----
  const menuGrid = document.getElementById('menuGrid');
  const searchInput = document.getElementById('searchInput');
  const cartBadge = document.getElementById('cartBadge');
  const cartItemsEl = document.getElementById('cartItems');
  const subTotalEl = document.getElementById('subTotal');
  const cartTotalEl = document.getElementById('cartTotal');
  const placeOrderBtn = document.getElementById('placeOrderBtn');
  const trackersGrid = document.getElementById('trackersGrid');
  const historyList = document.getElementById('historyList');

  // Tab views
  const views = { menuView: document.getElementById('menuView'), ordersView: document.getElementById('ordersView'), historyView: document.getElementById('historyView') };
  const headerSearch = document.querySelector('.header-search');
  const headerActions = document.querySelector('.header-actions');
  const pageTitle = document.getElementById('pageTitle');

  // Initial Visibility
  headerSearch.style.display = 'flex';
  headerActions.style.display = 'flex';

  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      Object.keys(views).forEach(k => views[k].style.display = 'none');

      const targetTab = btn.dataset.tab;
      views[targetTab].style.display = 'block';

      // Hide Search and Cart if we aren't on Browse Menu
      if (targetTab === 'menuView') {
        headerSearch.style.display = 'flex';
        headerActions.style.display = 'flex';
        if (pageTitle) pageTitle.textContent = 'Browse Menu';
      } else {
        headerSearch.style.display = 'none';
        headerActions.style.display = 'none';
        if (pageTitle) {
          if (targetTab === 'ordersView') pageTitle.textContent = 'My Orders';
          else if (targetTab === 'historyView') pageTitle.textContent = 'Order History';
        }
      }

      if (targetTab === 'historyView' || targetTab === 'ordersView') fetchUserOrders();
    });
  });

  // Cart toggle
  const cartDrawer = document.getElementById('cartDrawer');
  const cartOverlay = document.getElementById('cartOverlay');
  function openCart() { cartDrawer.classList.add('open'); cartOverlay.classList.add('show'); }
  function closeCart() { cartDrawer.classList.remove('open'); cartOverlay.classList.remove('show'); }
  document.getElementById('cartToggleBtn').addEventListener('click', openCart);
  document.getElementById('closeCartBtn').addEventListener('click', closeCart);
  cartOverlay.addEventListener('click', closeCart);

  // Payment method selection
  document.querySelectorAll('.pay-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.pay-opt').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      selectedPayment = opt.dataset.pm;
    });
  });

  // Logout
  document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('canteen_user');
    window.location.replace('/login.html');
  });

  // Theme Toggle
  const themeToggle = document.getElementById('themeToggle');
  const body = document.body;
  const currentTheme = localStorage.getItem('theme') || 'dark';
  if (currentTheme === 'light') {
    body.classList.add('light-mode');
    themeToggle.querySelector('ion-icon').setAttribute('name', 'sunny-outline');
  }

  themeToggle.addEventListener('click', () => {
    body.classList.toggle('light-mode');
    const isLight = body.classList.contains('light-mode');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    themeToggle.querySelector('ion-icon').setAttribute('name', isLight ? 'sunny-outline' : 'moon-outline');
    showToast(`${isLight ? 'Light' : 'Dark'} mode enabled`);
  });

  // Category filter
  document.querySelectorAll('.cat-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      activeCategory = pill.dataset.cat;
      filterAndRenderMenu();
    });
  });

  // Search
  searchInput.addEventListener('input', filterAndRenderMenu);

  // ---- Init ----
  fetchMenu();
  fetchUserOrders();
  setInterval(fetchUserOrders, 10000);

  // ---- Menu ----
  async function fetchMenu() {
    try {
      const res = await fetch('/api/menu');
      if (res.ok) { menuItems = await res.json(); filterAndRenderMenu(); }
    } catch (e) { showToast('Failed to load menu', true); }
  }

  function filterAndRenderMenu() {
    const term = searchInput.value.toLowerCase();
    let filtered = menuItems;
    if (activeCategory !== 'All') filtered = filtered.filter(i => i.category === activeCategory);
    if (term) filtered = filtered.filter(i => i.item_name.toLowerCase().includes(term));
    renderMenu(filtered);
  }

  function renderMenu(items) {
    if (items.length === 0) {
      menuGrid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><ion-icon name="search-outline"></ion-icon><p>No items found.</p></div>';
      return;
    }
    menuGrid.innerHTML = items.map(item => `
      <div class="food-card">
        <div class="food-img">
          ${item.image_url ? `<img src="${item.image_url}" alt="${item.item_name}">` : '<div class="placeholder-img"><ion-icon name="fast-food"></ion-icon></div>'}
          <div class="price-tag">₹${item.price}</div>
          <div class="prep-chip"><ion-icon name="time-outline"></ion-icon> ${item.prep_time || 5}m</div>
        </div>
        <div class="food-info">
          <div class="food-info-text">
            <h3>${item.item_name}</h3>
            <span>${item.category || 'Food'}</span>
          </div>
          <button class="add-btn" onclick="addToCart('${item._id}')">
            <ion-icon name="add"></ion-icon>
          </button>
        </div>
      </div>
    `).join('');
  }

  // ---- Cart ----
  window.addToCart = function (itemId) {
    const item = menuItems.find(i => i._id === itemId);
    if (!item) return;
    const existing = cart.find(c => c.item._id === itemId);
    if (existing) existing.quantity++;
    else cart.push({ item, quantity: 1 });
    showToast(`${item.item_name} added to cart`);
    renderCart();
  };

  window.updateCartQty = function (itemId, delta) {
    const existing = cart.find(c => c.item._id === itemId);
    if (existing) {
      existing.quantity += delta;
      if (existing.quantity <= 0) cart = cart.filter(c => c.item._id !== itemId);
    }
    renderCart();
  };

  function renderCart() {
    let totalItems = 0, totalCost = 0;
    if (cart.length === 0) {
      cartItemsEl.innerHTML = '<div class="empty-state"><ion-icon name="cart-outline"></ion-icon><p>Your cart is empty!</p></div>';
      cartBadge.classList.remove('visible');
      subTotalEl.textContent = '0'; cartTotalEl.textContent = '0';
      placeOrderBtn.disabled = true;
      return;
    }
    totalItems = cart.reduce((s, c) => s + c.quantity, 0);
    totalCost = cart.reduce((s, c) => s + c.item.price * c.quantity, 0);
    cartBadge.textContent = totalItems;
    cartBadge.classList.add('visible');
    subTotalEl.textContent = totalCost;
    cartTotalEl.textContent = totalCost;
    placeOrderBtn.disabled = false;

    cartItemsEl.innerHTML = cart.map(c => `
      <div class="cart-item">
        <div class="cart-item-img">
          ${c.item.image_url ? `<img src="${c.item.image_url}">` : '<ion-icon name="fast-food"></ion-icon>'}
        </div>
        <div class="cart-item-info">
          <h4>${c.item.item_name}</h4>
          <span>₹${c.item.price * c.quantity}</span>
        </div>
        <div class="cart-qty">
          <div class="qty-btn" onclick="updateCartQty('${c.item._id}', -1)"><ion-icon name="remove"></ion-icon></div>
          <span class="qty-val">${c.quantity}</span>
          <div class="qty-btn" onclick="updateCartQty('${c.item._id}', 1)"><ion-icon name="add"></ion-icon></div>
        </div>
      </div>
    `).join('');
  }

  // ---- Place Order ----
  placeOrderBtn.addEventListener('click', async () => {
    if (cart.length === 0) return;
    placeOrderBtn.disabled = true;
    placeOrderBtn.innerHTML = '<ion-icon name="sync-outline" style="animation:spin 1s linear infinite;"></ion-icon> Placing...';

    const items = cart.map(c => ({ item_id: c.item._id, quantity: c.quantity }));
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user._id, items, payment_mode: selectedPayment })
      });
      const data = await res.json();
      if (res.ok) {
        if (data.serverTime) serverOffset = data.serverTime - Date.now();
        cart = [];
        renderCart();
        closeCart();
        fetchUserOrders();
        if (selectedPayment === 'online') {
          // Show online success modal
          document.getElementById('payModal').classList.add('show');
        } else {
          showToast('Order placed! Please pay the cashier.');
        }
      } else {
        showToast(data.error || 'Failed to place order', true);
        placeOrderBtn.disabled = false;
        placeOrderBtn.innerHTML = '<ion-icon name="checkmark-circle-outline"></ion-icon> Place Order';
      }
    } catch (e) {
      showToast('Connection error', true);
      placeOrderBtn.disabled = false;
      placeOrderBtn.innerHTML = '<ion-icon name="checkmark-circle-outline"></ion-icon> Place Order';
    }
  });

  // Online pay modal close
  document.getElementById('payModalClose').addEventListener('click', () => {
    document.getElementById('payModal').classList.remove('show');
    showToast('Order placed successfully!');
  });

  // ---- Orders/Tracking ----
  async function fetchUserOrders() {
    try {
      const res = await fetch(`/api/orders/user/${user._id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.serverTime) serverOffset = data.serverTime - Date.now();
        processOrders(data.orders || []);
      }
    } catch (e) { /* silent */ }
  }

  function processOrders(orders) {
    // Update stats
    const active = orders.filter(o => ['Pending', 'Preparing', 'Ready for Pickup'].includes(o.order_status));
    document.getElementById('statActive').textContent = active.length;
    document.getElementById('statTotal').textContent = orders.length;
    let spent = 0;
    orders.filter(o => o.order_status === 'Completed').forEach(o => {
      o.items.forEach(i => { spent += (i.item_id ? i.item_id.price : 0) * i.quantity; });
    });
    document.getElementById('statSpent').textContent = '₹' + spent;

    // Active trackers
    const activeOnes = orders.filter(o => ['Pending', 'Preparing', 'Ready for Pickup'].includes(o.order_status));
    if (activeOnes.length === 0) {
      trackersGrid.innerHTML = '<div class="empty-state"><ion-icon name="receipt-outline"></ion-icon><p>No active orders right now.</p></div>';
    } else {
      const currentIds = new Set(activeOnes.map(o => o._id));
      // Remove stale
      trackersGrid.querySelectorAll('.tracker-card').forEach(card => {
        const id = card.id.replace('tr-', '');
        if (!currentIds.has(id)) {
          if (activeIntervals[id]) { clearInterval(activeIntervals[id]); delete activeIntervals[id]; }
          card.remove();
        }
      });
      // Add or update
      activeOnes.forEach(order => {
        let card = document.getElementById(`tr-${order._id}`);
        if (!card) { renderTracker(order); }
        else { updateTracker(order, card); }
      });

      if (trackersGrid.querySelector('.empty-state')) trackersGrid.querySelector('.empty-state').remove();
    }

    renderHistory(orders);
  }

  function renderTracker(order) {
    const shortId = order._id.slice(-6).toUpperCase();
    const card = document.createElement('div');
    card.className = 'tracker-card';
    card.id = `tr-${order._id}`;

    const itemNames = (order.items || []).map(i => `${i.quantity}x ${i.item_id ? i.item_id.item_name : 'Item'}`).join(', ');

    card.innerHTML = `
      <div class="tracker-top">
        <span class="tracker-id">Order #${shortId}</span>
        <span class="badge tracker-badge"></span>
      </div>
      <div class="tracker-body-row">
        <div class="mini-timer">
          <svg viewBox="0 0 140 140">
            <circle class="ring-track" cx="70" cy="70" r="60"></circle>
            <circle class="ring-fill" cx="70" cy="70" r="60" stroke-dasharray="${circumference} ${circumference}" stroke-dashoffset="${circumference}"></circle>
          </svg>
          <div class="mini-timer-text">
            <span class="time-val">--:--</span>
            <span class="time-label">Wait</span>
          </div>
        </div>
        <div class="tracker-info">
          <h3 class="tracker-items-title"></h3>
          <div class="tracker-info-items">${itemNames}</div>
          <div class="tracker-actions"></div>
        </div>
      </div>
    `;
    trackersGrid.appendChild(card);
    updateTracker(order, card);
  }

  function updateTracker(order, card) {
    const badge = card.querySelector('.tracker-badge');
    const timeVal = card.querySelector('.time-val');
    const ringFill = card.querySelector('.ring-fill');
    const actionsEl = card.querySelector('.tracker-actions');

    // Badge
    badge.className = 'badge tracker-badge';
    badge.textContent = order.order_status;
    if (order.order_status === 'Pending') badge.classList.add('badge-pending');
    else if (order.order_status === 'Preparing') badge.classList.add('badge-preparing');
    else if (order.order_status === 'Ready for Pickup') badge.classList.add('badge-ready');

    // Actions
    actionsEl.innerHTML = '';
    if (order.order_status === 'Pending') {
      actionsEl.innerHTML = `<button class="btn btn-danger btn-sm" onclick="cancelOrder('${order._id}')">Cancel Order</button>`;
    } else if (order.order_status === 'Ready for Pickup') {
      actionsEl.innerHTML = `<p style="color:var(--primary);font-size:0.82rem;display:flex;align-items:center;gap:4px;"><ion-icon name="checkmark-circle"></ion-icon> Ready for pickup!</p>`;
    }

    // Timer
    if (order.order_status === 'Preparing') {
      if (!activeIntervals[order._id]) {
        const startTime = new Date(order.preparation_start_time || order.updatedAt).getTime();
        const durationMs = (order.estimated_waiting_time || 0) * 60 * 1000;
        const endTime = startTime + durationMs;
        ringFill.style.stroke = 'var(--primary)';
        activeIntervals[order._id] = setInterval(() => {
          const now = Date.now() + serverOffset;
          const remaining = endTime - now;
          if (remaining <= 0) {
            timeVal.textContent = '00:00';
            ringFill.style.strokeDashoffset = circumference;
            clearInterval(activeIntervals[order._id]);
            delete activeIntervals[order._id];
            return;
          }
          const progress = 1 - remaining / durationMs;
          ringFill.style.strokeDashoffset = circumference - progress * circumference;
          const m = Math.floor(remaining / 60000);
          const s = Math.floor((remaining % 60000) / 1000);
          timeVal.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        }, 1000);
      }
    } else if (order.order_status === 'Ready for Pickup') {
      if (activeIntervals[order._id]) { clearInterval(activeIntervals[order._id]); delete activeIntervals[order._id]; }
      timeVal.textContent = 'READY';
      ringFill.style.stroke = 'var(--primary)';
      ringFill.style.strokeDashoffset = '0';
    } else {
      // Pending: show estimate
      const waitMins = order.estimated_waiting_time || 0;
      timeVal.textContent = `${String(waitMins).padStart(2, '0')}:00`;
      ringFill.style.strokeDashoffset = circumference;
      ringFill.style.stroke = 'var(--text-muted)';
    }
  }

  window.cancelOrder = async function (orderId) {
    if (!confirm('Are you sure you want to cancel this order?')) return;
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Cancelled' })
      });
      if (res.ok) {
        showToast('Order cancelled. Collect refund from cashier if paid online.');
        fetchUserOrders();
      } else {
        const d = await res.json();
        showToast(d.error || 'Cannot cancel this order.', true);
      }
    } catch (e) { showToast('Connection error', true); }
  };

  // ---- History ----
  function renderHistory(orders) {
    if (orders.length === 0) {
      historyList.innerHTML = '<div class="empty-state"><ion-icon name="time-outline"></ion-icon><p>No past orders yet.</p></div>';
      return;
    }
    const sorted = [...orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    historyList.innerHTML = sorted.map(order => {
      let total = 0;
      const itemsStr = (order.items || []).map(i => {
        const p = i.item_id ? i.item_id.price : 0;
        total += p * i.quantity;
        return `${i.quantity}x ${i.item_id ? i.item_id.item_name : 'Item'}`;
      }).join(', ');

      const dateStr = new Date(order.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

      let badgeClass = 'badge-completed';
      let statusLabel = order.order_status;
      if (order.order_status === 'Pending' || order.order_status === 'Preparing') badgeClass = 'badge-preparing';
      else if (order.order_status === 'Ready for Pickup') badgeClass = 'badge-ready';
      else if (['Cancelled', 'Rejected'].includes(order.order_status)) {
        badgeClass = 'badge-cancelled';
        if (order.order_status === 'Cancelled') statusLabel = 'Cancelled — Refund at counter';
        if (order.order_status === 'Rejected') statusLabel = 'Rejected — Refund at counter';
      }

      return `
        <div class="history-item">
          <div class="history-left">
            <div class="history-date"><ion-icon name="calendar-outline"></ion-icon> ${dateStr}</div>
            <div class="history-items-str">${itemsStr}</div>
            <div class="history-id">#${order._id.slice(-10).toUpperCase()}</div>
          </div>
          <div class="history-right">
            <span class="history-amount">₹${total}</span>
            <span class="badge ${badgeClass}">${statusLabel}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  // ---- Toast ----
  function showToast(msg, isError = false) {
    const container = document.getElementById('toastContainer');
    const t = document.createElement('div');
    t.className = `toast${isError ? ' error' : ''}`;
    t.innerHTML = `
      <div class="toast-icon"><ion-icon name="${isError ? 'warning' : 'checkmark-circle'}"></ion-icon></div>
      <div class="toast-content"><h4>${isError ? 'Notice' : 'Success'}</h4><p>${msg}</p></div>
    `;
    container.appendChild(t);
    setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 3000);
  }
});
