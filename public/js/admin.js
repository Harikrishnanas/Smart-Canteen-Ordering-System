// public/js/admin.js

document.addEventListener('DOMContentLoaded', () => {
    // Auth check
    const userStr = localStorage.getItem('canteen_user');
    if (!userStr) { window.location.replace('/login.html'); return; }
    const user = JSON.parse(userStr);
    if (user.role !== 'admin') { window.location.replace('/login.html'); return; }

    // Nav lock
    history.pushState(null, null, location.href);
    window.addEventListener('popstate', () => {
        history.pushState(null, null, location.href);
        showToast('Use the Logout button to exit.', true);
    });

    // ---- State ----
    let activeFilter = 'pending';
    let allOrders = [];
    const adminTimers = {}; // orderId -> intervalId
    let revenueResetTime = localStorage.getItem('admin_revenue_reset_time') || 0;

    // ---- DOM ----
    const dashboardView = document.getElementById('dashboardView');
    const ordersView = document.getElementById('ordersView');
    const menuView = document.getElementById('menuView');
    const historyView = document.getElementById('historyView');
    const ordersGrid = document.getElementById('ordersGrid');
    const menuCards = document.getElementById('menuCards');
    const addItemCard = document.getElementById('addItemCard');
    const itemForm = document.getElementById('itemForm');
    const formError = document.getElementById('formError');

    const dbPending = document.getElementById('db-pending');
    const dbActive = document.getElementById('db-active');
    const dbCompleted = document.getElementById('db-completed');
    const dbRevenue = document.getElementById('db-revenue');
    const btnRefreshRevenue = document.getElementById('btnRefreshRevenue');

    // ---- Navigation ----
    function showView(viewName) {
        ordersView.style.display = 'none';
        menuView.style.display = 'none';
        historyView.style.display = 'none';
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        document.getElementById('addItemBtn').style.display = 'none';

        if (viewName === 'orders') {
            ordersView.style.display = 'block';
            document.getElementById('nav-orders').classList.add('active');
            document.getElementById('pageTitle').textContent = 'Live Orders';
            document.getElementById('pageSubtitle').textContent = 'Manage incoming tickets in real-time';
            fetchOrders();
        } else if (viewName === 'menu') {
            menuView.style.display = 'block';
            document.getElementById('nav-menu').classList.add('active');
            document.getElementById('pageTitle').textContent = 'Manage Menu';
            document.getElementById('pageSubtitle').textContent = 'Add, edit, and configure your culinary offerings';
            document.getElementById('addItemBtn').style.display = 'flex';
            fetchMenu();
        } else if (viewName === 'history') {
            historyView.style.display = 'block';
            document.getElementById('nav-history').classList.add('active');
            document.getElementById('pageTitle').textContent = 'Order History';
            document.getElementById('pageSubtitle').textContent = 'Review all completed and cancelled orders';
            fetchHistory();
        }
    }

    document.getElementById('nav-orders').addEventListener('click', () => showView('orders'));
    document.getElementById('nav-menu').addEventListener('click', () => showView('menu'));
    document.getElementById('nav-history').addEventListener('click', () => showView('history'));
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

    // ---- Filter chips removed (Kanban layout) ----
    // ---- Orders ----
    async function fetchOrders() {
        try {
            const res = await fetch('/api/orders/admin');
            if (res.ok) {
                allOrders = await res.json();
                updateCounts();
                renderOrders();
            }
        } catch (e) { console.error('Fetch orders error', e); }
    }

    function updateCounts() {
        document.getElementById('cntPending').textContent = allOrders.filter(o => o.order_status === 'Pending').length;
        document.getElementById('cntPreparing').textContent = allOrders.filter(o => o.order_status === 'Preparing').length;
        document.getElementById('cntReady').textContent = allOrders.filter(o => o.order_status === 'Ready for Pickup').length;

        // Dashboard Stats Update
        const pendingCount = allOrders.filter(o => o.order_status === 'Pending').length;
        const preparingCount = allOrders.filter(o => o.order_status === 'Preparing').length;
        const readyCount = allOrders.filter(o => o.order_status === 'Ready for Pickup').length;
        const completedCount = allOrders.filter(o => o.order_status === 'Completed').length;

        dbPending.textContent = pendingCount;
        dbActive.textContent = preparingCount + readyCount;
        dbCompleted.textContent = completedCount;

        // Calculate Revenue
        let revenue = 0;
        allOrders.forEach(o => {
            if (['Preparing', 'Ready for Pickup', 'Completed'].includes(o.order_status)) {
                const orderTime = new Date(o.createdAt || o.order_time).getTime();
                if (orderTime > revenueResetTime) {
                    (o.items || []).forEach(i => {
                        const price = i.item_id ? i.item_id.price : 0;
                        revenue += price * i.quantity;
                    });
                }
            }
        });
        dbRevenue.textContent = '₹' + revenue;
    }

    // Refresh Revenue logic
    btnRefreshRevenue.addEventListener('click', () => {
        if (confirm('Are you sure you want to reset session revenue to 0?')) {
            revenueResetTime = Date.now();
            localStorage.setItem('admin_revenue_reset_time', revenueResetTime);
            updateCounts();
            showToast('Revenue session reset successfully');
        }
    });

    function renderOrders() {
        const pending = allOrders.filter(o => o.order_status === 'Pending');
        const preparing = allOrders.filter(o => o.order_status === 'Preparing');
        const ready = allOrders.filter(o => o.order_status === 'Ready for Pickup');

        renderColumn('colPending', pending, 'Pending');
        renderColumn('colPreparing', preparing, 'Preparing');
        renderColumn('colReady', ready, 'Ready for Pickup');

        // Start admin prep timers
        preparing.forEach(order => {
            if (!adminTimers[order._id]) {
                const startTime = new Date(order.preparation_start_time || order.updatedAt).getTime();
                const durationMs = (order.estimated_waiting_time || 0) * 60000;
                const endTime = startTime + durationMs;
                adminTimers[order._id] = setInterval(() => {
                    const el = document.getElementById(`admin-timer-${order._id}`);
                    if (!el) { clearInterval(adminTimers[order._id]); delete adminTimers[order._id]; return; }
                    const remaining = Math.max(0, endTime - Date.now());
                    if (remaining === 0) { el.textContent = '00:00'; clearInterval(adminTimers[order._id]); delete adminTimers[order._id]; return; }
                    el.textContent = `${String(Math.floor(remaining / 60000)).padStart(2, '0')}:${String(Math.floor((remaining % 60000) / 1000)).padStart(2, '0')}`;
                }, 1000);
            }
        });
    }

    function renderColumn(colId, ordersList, statusName) {
        const col = document.getElementById(colId);
        if (ordersList.length === 0) {
            let msg = 'No new orders';
            if (statusName === 'Preparing') msg = 'No preparing orders';
            if (statusName === 'Ready for Pickup') msg = 'No ready orders';
            col.innerHTML = `<div class="empty-kanban-state">${msg}</div>`;
            return;
        }

        col.innerHTML = ordersList.map(order => {
            const shortId = order._id.slice(-6).toUpperCase();
            const payment = order.payment || { payment_mode: 'unknown', payment_status: 'unknown' };
            const isCash = payment.payment_mode === 'cash';
            const dateStr = new Date(order.order_time || order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            const itemsHTML = (order.items || []).map(i => `<li>${i.quantity}x ${i.item_id ? i.item_id.item_name : 'Item'}</li>`).join('');

            let actionsHTML = '';
            if (order.order_status === 'Pending') {
                const disableAccept = isCash && payment.payment_status !== 'success';
                const acceptText = disableAccept ? 'Awaiting Cash' : 'Accept';
                const acceptProps = disableAccept
                    ? 'disabled style="flex:1; opacity:0.6; cursor:not-allowed;"'
                    : `style="flex:1" onclick="updateStatus('${order._id}','Preparing')"`;

                actionsHTML = `
          <button class="btn btn-danger btn-sm" style="flex:1" onclick="updateStatus('${order._id}','Rejected')">Reject</button>
          <button class="btn btn-primary btn-sm" ${acceptProps}>${acceptText}</button>
        `;
            } else if (order.order_status === 'Preparing') {
                // Prep timer display
                const startTime = order.preparation_start_time ? new Date(order.preparation_start_time).getTime() : Date.now();
                const durationMs = (order.estimated_waiting_time || 0) * 60000;
                const endTime = startTime + durationMs;
                const now = Date.now();
                const remaining = Math.max(0, endTime - now);
                const m = String(Math.floor(remaining / 60000)).padStart(2, '0');
                const s = String(Math.floor((remaining % 60000) / 1000)).padStart(2, '0');
                actionsHTML = `
          <div class="oc-mini-timer" style="margin-bottom:10px;">
            <ion-icon name="time-outline" style="font-size:1.3rem;color:var(--accent);"></ion-icon>
            <div class="oc-timer-info">
              <label>Time Remaining</label>
              <span id="admin-timer-${order._id}">${m}:${s}</span>
            </div>
          </div>
          <button class="btn btn-success btn-full" onclick="updateStatus('${order._id}','Ready for Pickup')">Mark Ready</button>
        `;
            } else if (order.order_status === 'Ready for Pickup') {
                actionsHTML = `<button class="btn btn-primary btn-full" onclick="updateStatus('${order._id}','Completed')">Complete Order</button>`;
            }

            return `
        <div class="order-card">
          <div class="oc-top">
            <span class="oc-id">#${shortId}</span>
            <span class="oc-time">${dateStr}</span>
          </div>
          <div class="oc-body">
            <div class="oc-user"><ion-icon name="person-circle-outline"></ion-icon>${order.user_id ? order.user_id.phone_email : 'Unknown'}</div>
            <div class="oc-items"><ul>${itemsHTML}</ul></div>
            <div class="oc-payment">
              <div class="oc-payment-mode">
                <ion-icon name="${isCash ? 'cash-outline' : 'card-outline'}"></ion-icon>
                ${isCash ? 'Cash' : 'Online'}
              </div>
              <span class="oc-payment-status ${payment.payment_status === 'success' ? 'status-paid' : 'status-pending-pay'}">
                ${payment.payment_status.toUpperCase()}
              </span>
            </div>
          </div>
          <div class="oc-footer" style="flex-direction:column;gap:8px;">
            ${actionsHTML}
          </div>
        </div>
      `;
        }).join('');
    }

    window.updateStatus = async function (orderId, status) {
        try {
            const res = await fetch(`/api/orders/${orderId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            });
            if (res.ok) {
                showToast(`Order ${status}`);
                fetchOrders();
            } else {
                showToast('Failed to update order', true);
            }
        } catch (e) { showToast('Connection error', true); }
    };

    // ---- Menu Management ----
    async function fetchMenu() {
        try {
            const res = await fetch('/api/menu/admin');
            if (res.ok) { renderMenuCards(await res.json()); }
        } catch (e) { console.error('Fetch menu error', e); }
    }

    function renderMenuCards(items) {
        if (items.length === 0) {
            menuCards.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><ion-icon name="fast-food-outline"></ion-icon><p>No items yet. Click "Add Item" to start.</p></div>';
            return;
        }
        menuCards.innerHTML = items.map(item => {
            const isAvail = item.availability_status === 'available';
            return `
        <div class="menu-mgmt-card">
          <div class="mmc-img">
            ${item.image_url ? `<img src="${item.image_url}" alt="${item.item_name}">` : '<ion-icon name="fast-food"></ion-icon>'}
          </div>
          <div class="mmc-body">
            <div class="mmc-name">${item.item_name}</div>
            <div class="mmc-meta">
              <span><ion-icon name="logo-usd"></ion-icon>₹${item.price}</span>
              <span><ion-icon name="time-outline"></ion-icon>${item.prep_time || 5}m</span>
              <span>${item.category || 'Main Course'}</span>
            </div>
          </div>
          <div class="mmc-footer">
            <div class="mmc-toggle">
              <label class="toggle">
                <input type="checkbox" ${isAvail ? 'checked' : ''} onchange="toggleAvail('${item._id}', this.checked)">
                <div class="toggle-track"></div>
              </label>
              <span style="font-size:0.78rem;color:${isAvail ? 'var(--primary)' : 'var(--text-muted)'};">${isAvail ? 'Available' : 'Unavailable'}</span>
            </div>
            <div class="mmc-btns">
              <button class="icon-btn edit" onclick='editItem(${JSON.stringify(item).replace(/'/g, "&#39;")})' title="Edit">
                <ion-icon name="create-outline"></ion-icon>
              </button>
              <button class="icon-btn delete" onclick="deleteItem('${item._id}')" title="Delete">
                <ion-icon name="trash-outline"></ion-icon>
              </button>
            </div>
          </div>
        </div>
      `;
        }).join('');
    }

    window.toggleAvail = async function (itemId, checked) {
        const newStatus = checked ? 'available' : 'unavailable';
        try {
            const res = await fetch(`/api/menu/admin/${itemId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ availability_status: newStatus })
            });
            if (res.ok) { showToast(`Item marked ${newStatus}`); fetchMenu(); }
        } catch (e) { showToast('Error', true); }
    };

    window.editItem = function (item) {
        document.getElementById('editItemId').value = item._id;
        document.getElementById('formTitle').textContent = 'Edit Item';
        document.getElementById('f-name').value = item.item_name;
        document.getElementById('f-category').value = item.category || 'Main Course';
        document.getElementById('f-price').value = item.price;
        document.getElementById('f-prep').value = item.prep_time || 5;
        document.getElementById('f-avail').value = item.availability_status;
        if (item.image_url) {
            document.getElementById('imgPreview').src = item.image_url;
            document.getElementById('imgPreview').style.display = 'block';
            document.getElementById('uploadLabel').style.display = 'none';
        }
        document.getElementById('saveItemBtn').innerHTML = '<ion-icon name="save-outline"></ion-icon> Save Changes';
        addItemCard.classList.add('show');
        addItemCard.scrollIntoView({ behavior: 'smooth' });
    };

    window.deleteItem = async function (itemId) {
        if (!confirm('Delete this menu item? This cannot be undone.')) return;
        try {
            const res = await fetch(`/api/menu/admin/${itemId}`, { method: 'DELETE' });
            if (res.ok) { showToast('Item deleted'); fetchMenu(); }
            else showToast('Failed to delete', true);
        } catch (e) { showToast('Connection error', true); }
    };

    // Add item button
    document.getElementById('addItemBtn').addEventListener('click', () => {
        document.getElementById('editItemId').value = '';
        document.getElementById('formTitle').textContent = 'Add New Item';
        itemForm.reset();
        document.getElementById('imgPreview').style.display = 'none';
        document.getElementById('uploadLabel').style.display = 'block';
        document.getElementById('saveItemBtn').innerHTML = '<ion-icon name="save-outline"></ion-icon> Save Item';
        formError.textContent = '';
        addItemCard.classList.add('show');
        addItemCard.scrollIntoView({ behavior: 'smooth' });
    });

    document.getElementById('cancelFormBtn').addEventListener('click', () => {
        addItemCard.classList.remove('show');
        itemForm.reset();
        formError.textContent = '';
    });

    // Image preview
    document.getElementById('imageInput').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                document.getElementById('imgPreview').src = ev.target.result;
                document.getElementById('imgPreview').style.display = 'block';
                document.getElementById('uploadLabel').style.display = 'none';
            };
            reader.readAsDataURL(file);
        }
    });

    // Form submit
    itemForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const saveBtn = document.getElementById('saveItemBtn');
        saveBtn.disabled = true;
        formError.textContent = '';
        const editId = document.getElementById('editItemId').value;
        const formData = new FormData(itemForm);
        const endpoint = editId ? `/api/menu/admin/update/${editId}` : '/api/menu/admin';
        const method = editId ? 'PUT' : 'POST';
        try {
            const res = await fetch(endpoint, { method, body: formData });
            const data = await res.json();
            if (res.ok) {
                showToast(editId ? 'Item updated!' : 'Item added!');
                addItemCard.classList.remove('show');
                itemForm.reset();
                document.getElementById('imgPreview').style.display = 'none';
                document.getElementById('uploadLabel').style.display = 'block';
                fetchMenu();
            } else {
                formError.textContent = data.error || 'Failed to save';
            }
        } catch (e) {
            formError.textContent = 'Connection error';
        } finally {
            saveBtn.disabled = false;
        }
    });

    // ---- History ----
    async function fetchHistory() {
        try {
            const res = await fetch('/api/orders/admin');
            if (res.ok) { renderHistory(await res.json()); }
        } catch (e) { console.error(e); }
    }

    function renderHistory(orders) {
        const historyBody = document.getElementById('historyBody');
        const done = orders.filter(o => ['Completed', 'Cancelled', 'Rejected'].includes(o.order_status));
        if (done.length === 0) {
            historyBody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-muted);">No history yet.</td></tr>';
            return;
        }
        historyBody.innerHTML = done.map(order => {
            let total = 0;
            const itemsStr = (order.items || []).map(i => {
                const p = i.item_id ? i.item_id.price : 0;
                total += p * i.quantity;
                return `${i.quantity}x ${i.item_id ? i.item_id.item_name : 'Item'}`;
            }).join(', ');
            const dateStr = new Date(order.order_time || order.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
            let badgeClass = 'badge-completed', label = order.order_status;
            if (['Cancelled', 'Rejected'].includes(order.order_status)) {
                badgeClass = 'badge-cancelled';
                label = order.order_status === 'Cancelled' ? 'Cancelled — Refund at counter' : 'Rejected — Refund at counter';
            }
            return `
        <tr>
          <td>#${order._id.slice(-6).toUpperCase()}</td>
          <td>${dateStr}</td>
          <td>${order.user_id ? order.user_id.phone_email : 'Unknown'}</td>
          <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${itemsStr}">${itemsStr}</td>
          <td style="color:var(--primary);font-weight:700;">₹${total}</td>
          <td><span class="badge ${badgeClass}">${label}</span></td>
        </tr>
      `;
        }).join('');
    }

    // ---- Init ----
    showView('orders');
    setInterval(fetchOrders, 15000);

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
