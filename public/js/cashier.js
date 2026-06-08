// public/js/cashier.js

document.addEventListener('DOMContentLoaded', () => {
    // Auth check
    const userStr = localStorage.getItem('canteen_user');
    if (!userStr) { window.location.replace('/login.html'); return; }
    const user = JSON.parse(userStr);
    if (user.role !== 'cashier') { window.location.replace('/login.html'); return; }

    // Nav lock
    history.pushState(null, null, location.href);
    window.addEventListener('popstate', () => {
        history.pushState(null, null, location.href);
        showToast('Use the Logout button to exit.', true);
    });

    // ---- DOM ----
    // ---- DOM ----
    const paymentsGrid = document.getElementById('paymentsGrid');
    const paymentsView = document.getElementById('paymentsView');

    // Tab switching (kept for future scale, just default for now)
    document.querySelectorAll('.cashier-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.cashier-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            paymentsView.style.display = 'block';
            fetchPendingPayments();
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

    // ---- Pending Payments ----
    async function fetchPendingPayments() {
        try {
            const res = await fetch('/api/orders/cashier/pending');
            if (res.ok) { renderPayments(await res.json()); }
        } catch (e) { console.error(e); }
    }

    function renderPayments(payments) {
        const pBadge = document.getElementById('pendingBadge');
        pBadge.textContent = payments.length;
        pBadge.style.display = payments.length > 0 ? 'inline-flex' : 'none';
        document.getElementById('statPending').textContent = payments.length;

        if (payments.length === 0) {
            paymentsGrid.innerHTML = '<div class="empty-state"><ion-icon name="checkmark-done-circle-outline"></ion-icon><p>All clear! No pending cash payments.</p></div>';
            return;
        }

        paymentsGrid.innerHTML = '';
        payments.forEach(payment => {
            if (!payment.order_id) return;
            const orderIdShort = payment.order_id._id.slice(-6).toUpperCase();
            const userEmail = payment.order_id.user_id ? payment.order_id.user_id.phone_email : 'Unknown';
            let total = 0;
            const itemsHTML = (payment.items || []).map(item => {
                const price = item.item_id ? item.item_id.price : 0;
                const sub = price * item.quantity;
                total += sub;
                return `
          <div class="pos-item-row">
            <span class="pos-item-name">${item.quantity}x ${item.item_id ? item.item_id.item_name : 'Item'}</span>
            <span class="pos-item-price">₹${sub}</span>
          </div>
        `;
            }).join('');

            const card = document.createElement('div');
            card.className = 'pos-card';
            card.innerHTML = `
        <div class="pos-card-header">
          <div>
            <div class="pos-card-id">#${orderIdShort}</div>
            <div class="pos-card-user"><ion-icon name="person-circle-outline"></ion-icon>${userEmail}</div>
          </div>
          <span class="pos-tag">Cash Due</span>
        </div>
        <div class="pos-card-items">${itemsHTML}</div>
        <div class="pos-total">
          <span>Total Amount</span>
          <strong>₹${total}</strong>
        </div>
        <div class="pos-card-footer">
          <button class="confirm-btn" id="confirm-${payment._id}" onclick="confirmPayment('${payment._id}', this)">
            <ion-icon name="checkmark-circle-outline"></ion-icon> Confirm Cash Received
          </button>
        </div>
      `;
            paymentsGrid.appendChild(card);
        });
    }

    window.confirmPayment = async function (paymentId, btn) {
        if (!confirm('Confirm that you have received the exact cash amount?')) return;
        btn.disabled = true;
        btn.innerHTML = '<ion-icon name="sync-outline" style="animation:spin 1s linear infinite;"></ion-icon> Confirming...';
        try {
            const res = await fetch(`/api/orders/cashier/confirm/${paymentId}`, { method: 'PUT' });
            if (res.ok) {
                showToast('Payment confirmed!');
                const confirmed = parseInt(document.getElementById('statConfirmed').textContent) + 1;
                document.getElementById('statConfirmed').textContent = confirmed;
                fetchPendingPayments();
            } else {
                showToast('Failed to confirm payment', true);
                btn.disabled = false;
                btn.innerHTML = '<ion-icon name="checkmark-circle-outline"></ion-icon> Confirm Cash Received';
            }
        } catch (e) {
            showToast('Connection error', true);
            btn.disabled = false;
        }
    };

    // ---- Init ----
    fetchPendingPayments();
    setInterval(() => {
        fetchPendingPayments();
    }, 10000);

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
