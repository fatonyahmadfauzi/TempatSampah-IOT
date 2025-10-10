import { loadEnv } from './env-loader.js';

export async function checkAuth() {
  const env = await loadEnv();
  const userRole = localStorage.getItem('userRole');
  const username = localStorage.getItem('username');
  
  // Jika tidak ada role atau username (belum login), redirect ke login
  if (!userRole || !username) {
    window.location.href = 'login.html';
    return false;
  }
  
  // Validasi username dengan role
  const validCombinations = {
    [env.ADMIN_USERNAME]: 'admin',
    [env.USER1_USERNAME]: 'user1',
    [env.USER2_USERNAME]: 'user2'
  };
  
  if (validCombinations[username] !== userRole) {
    localStorage.removeItem('userRole');
    localStorage.removeItem('username');
    window.location.href = 'login.html';
    return false;
  }
  
  return true;
}

export function setupAuthUI() {
  const userRole = localStorage.getItem('userRole');
  const username = localStorage.getItem('username');
  const adminName = document.querySelector('.sidebar-inner strong');
  const deviceLinks = document.querySelectorAll('.device-link');
  const logoutBtn = document.querySelector('.btn-outline-danger');
  const deleteAllBtn = document.getElementById('delete-all-btn');
  const headerContainer = document.querySelector('.card-header .d-flex');
  
  // Set display name based on username
  adminName.textContent = `👤 ${username}`;
  
  // Add admin class only if user is admin
  if (userRole === 'admin' && headerContainer) {
      headerContainer.classList.add('admin-header');
  }

  // Hide devices based on role
  if (userRole === 'user1') {
    deviceLinks[1].parentElement.style.display = 'none';
    // Sembunyikan tombol hapus database untuk user1
    if (deleteAllBtn) deleteAllBtn.style.display = 'none';
  } else if (userRole === 'user2') {
    deviceLinks[0].parentElement.style.display = 'none';
    // Sembunyikan tombol hapus database untuk user2
    if (deleteAllBtn) deleteAllBtn.style.display = 'none';
  } else if (userRole === 'admin') {
    // Tampilkan tombol hapus database untuk admin
    if (deleteAllBtn) deleteAllBtn.style.display = 'inline-block';
  }
  
  // Logout functionality
  logoutBtn.addEventListener('click', function() {
    localStorage.removeItem('userRole');
    localStorage.removeItem('username');
    window.location.href = 'login.html';
  });
}