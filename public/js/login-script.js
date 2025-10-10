import { loadEnv } from './env-loader.js';

document.addEventListener('DOMContentLoaded', async function() {
  const env = await loadEnv();
  const loginForm = document.getElementById('loginForm');
  const toast = new bootstrap.Toast(document.getElementById('loginToast'));
  
  loginForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    
    // Autentikasi berdasarkan .env
    if (username === env.ADMIN_USERNAME && password === env.ADMIN_PASSWORD) {
      localStorage.setItem('userRole', 'admin');
      localStorage.setItem('username', username);
      window.location.href = '/device-1';
    } else if (username === env.USER1_USERNAME && password === env.USER1_PASSWORD) {
      localStorage.setItem('userRole', 'user1');
      localStorage.setItem('username', username);
      window.location.href = '/device-1';
    } else if (username === env.USER2_USERNAME && password === env.USER2_PASSWORD) {
      localStorage.setItem('userRole', 'user2');
      localStorage.setItem('username', username);
      window.location.href = '/device-2';
    } else {
      document.getElementById('toastMessage').textContent = 'Username atau password salah!';
      toast.show();
    }
  });
});