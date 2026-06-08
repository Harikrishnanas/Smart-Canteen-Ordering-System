// public/js/login.js

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const roleCards = document.querySelectorAll('.role-card');
    const usernameField = document.getElementById('usernameField');
    const passwordField = document.getElementById('passwordField');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const errorMsg = document.getElementById('errorMsg');
    const loginBtn = document.getElementById('loginBtn');
    const togglePassword = document.getElementById('togglePassword');

    let currentRole = 'student'; // default to student

    // Role selection
    roleCards.forEach(card => {
        card.addEventListener('click', () => {
            roleCards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            currentRole = card.dataset.role;

            // Update UI based on role
            if (currentRole === 'student') {
                usernameField.style.display = 'flex';
                passwordField.style.display = 'none';
                usernameInput.placeholder = 'Phone Number or Email';
                usernameInput.required = true;
                passwordInput.required = false;
            } else {
                usernameField.style.display = 'none';
                passwordField.style.display = 'flex';
                usernameInput.placeholder = 'Username'; // Keep placeholder for non-user roles
                usernameInput.required = false;
                passwordInput.required = true;
            }

            // Clear errors on switch
            errorMsg.classList.remove('show');
        });
    });

    // Toggle password visibility
    togglePassword.addEventListener('click', () => {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        togglePassword.setAttribute('name', type === 'password' ? 'eye-outline' : 'eye-off-outline');
    });

    // Handle Form Submission
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        loginBtn.disabled = true;
        const originalText = loginBtn.querySelector('span').textContent;
        loginBtn.querySelector('span').textContent = 'Connecting...';
        errorMsg.classList.remove('show');

        const identifier = currentRole === 'student' ? usernameInput.value.trim() : currentRole;
        const password = passwordInput.value.trim();

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role: currentRole, identifier, password })
            });

            const data = await response.json();

            if (response.ok) {
                // Success Toast
                showToast('Login Successful! Redirecting...');

                // Save user to localStorage
                localStorage.setItem('canteen_user', JSON.stringify(data.user));

                // Redirect based on role
                setTimeout(() => {
                    if (data.user.role === 'admin') window.location.href = '/admin.html';
                    else if (data.user.role === 'cashier') window.location.href = '/cashier.html';
                    else window.location.href = '/user.html';
                }, 1200);
            } else {
                errorMsg.textContent = data.error || 'Invalid credentials. Please try again.';
                errorMsg.classList.add('show');
                loginBtn.disabled = false;
                loginBtn.querySelector('span').textContent = originalText;
            }
        } catch (err) {
            errorMsg.textContent = 'Server connection failed. Is the backend running?';
            errorMsg.classList.add('show');
            loginBtn.disabled = false;
            loginBtn.querySelector('span').textContent = originalText;
        }
    });

    // Helper: Toast Notification
    function showToast(msg, isError = false) {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${isError ? 'error' : ''}`;
        toast.innerHTML = `
      <div class="toast-icon">
        <ion-icon name="${isError ? 'alert-circle' : 'checkmark-circle'}"></ion-icon>
      </div>
      <div class="toast-content">
        <h4>${isError ? 'Login Error' : 'Success'}</h4>
        <p>${msg}</p>
      </div>
    `;
        container.appendChild(toast);

        // Animate in
        setTimeout(() => toast.classList.add('show'), 10);

        // Animate out
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 400);
        }, 3000);
    }
});
