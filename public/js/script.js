// ========================
// === GLOBAL VARIABLES ===
// ========================
const ACTIVE_DEVICE = window.location.pathname.includes('device-2') ? 'device2' : 'device1';
let allData = [];
let filteredData = [];
let currentPage = 1;
const rowsPerPage = 10;
let fillChart = null;
let isFetching = false;
let latestRecord = {};
let isSidebarActive = false;
let refreshInterval = null;

// Timeout configuration
const FETCH_TIMEOUT = 10000; // 10 detik

// ========================
// === DOM ELEMENTS ===
// ========================
const dataTable = document.getElementById('data-table');
const tableBody = dataTable?.querySelector('tbody');
const prevPageBtn = document.getElementById('prev-page');
const nextPageBtn = document.getElementById('next-page');
const currentPageSpan = document.getElementById('current-page');
const filterForm = document.getElementById('filter-form');
const searchInput = document.getElementById('search-input');
const statusFilter = document.getElementById('status-filter');
const dateRangeInput = document.getElementById('date-range');
const refreshBtn = document.getElementById('refresh-btn');
const exportBtn = document.getElementById('export-btn');
const deleteAllBtn = document.getElementById('delete-all-btn');
const pauseBtn = document.getElementById('pauseBtn');
const resumeBtn = document.getElementById('resumeBtn');
const sidebarToggle = document.getElementById('sidebarToggle');
const sidebar = document.getElementById('sidebar');
const currentYear = document.getElementById('currentYear');

// ========================
// === UTILITY FUNCTIONS ===
// ========================

/**
 * Fetch dengan timeout
 */
async function fetchWithTimeout(resource, options = {}) {
  const { timeout = FETCH_TIMEOUT } = options;
  
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  const response = await fetch(resource, {
    ...options,
    signal: controller.signal  
  });
  
  clearTimeout(id);
  return response;
}

/**
 * Menampilkan loading indicator
 */
function showLoading(show) {
  const loader = document.getElementById('loading-indicator');
  if (loader) {
    loader.style.display = show ? 'flex' : 'none';
  }
  
  // Disable tombol saat loading
  const buttons = [refreshBtn, exportBtn, deleteAllBtn, pauseBtn, resumeBtn];
  buttons.forEach(btn => {
    if (btn) btn.disabled = show;
  });
}

/**
 * Menampilkan alert/pesan
 */
function showAlert(message, type = 'info') {
  const alertContainer = document.getElementById('alert-container');
  if (!alertContainer) return;
  
  // Hapus alert sebelumnya
  const existingAlerts = alertContainer.querySelectorAll('.alert');
  if (existingAlerts.length > 3) {
    existingAlerts[0].remove();
  }
  
  const alertDiv = document.createElement('div');
  alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
  alertDiv.setAttribute('role', 'alert');
  alertDiv.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;
  
  alertContainer.prepend(alertDiv);
  
  // Auto-hide setelah 5 detik
  setTimeout(() => {
    if (alertDiv.parentNode) {
      alertDiv.classList.remove('show');
      setTimeout(() => alertDiv.remove(), 150);
    }
  }, 5000);
}

/**
 * Format timestamp ke string yang readable
 */
function formatTimestamp(raw) {
  try {
    if (!raw) return '-';
    
    let date;
    if (typeof raw === 'string') {
      // Perbaiki timestamp yang tidak valid
      const fixedTimestamp = raw
        .replace(/(T\d{2}:\d{2}:\d{2})\d/, '$1')
        .replace(/Z?$/, '');
      
      date = new Date(fixedTimestamp);
      
      if (isNaN(date.getTime())) {
        date = new Date(raw);
      }
    } else {
      date = new Date(raw);
    }

    if (isNaN(date.getTime())) {
      console.warn('Invalid date:', raw);
      return '-';
    }

    // Format tanggal dan waktu dengan timezone Jakarta
    const dateStr = date.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'Asia/Jakarta'
    });
    
    const timeStr = date.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: 'Asia/Jakarta'
    }).replace(/\./g, ':');

    return `${dateStr} ${timeStr}`;
  } catch (e) {
    console.error('Error formatting timestamp:', e);
    return '-';
  }
}

/**
 * Format waktu singkat untuk chart
 */
function formatTimeForChart(raw) {
  try {
    if (!raw) return '';
    
    let date;
    if (typeof raw === 'string') {
      const fixedTimestamp = raw
        .replace(/(T\d{2}:\d{2}:\d{2})\d/, '$1')
        .replace(/Z?$/, '');
      date = new Date(fixedTimestamp);
      
      if (isNaN(date.getTime())) {
        date = new Date(raw);
      }
    } else {
      date = new Date(raw);
    }

    if (isNaN(date.getTime())) {
      return '';
    }

    return date.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Jakarta'
    }).replace(/\./g, ':');
  } catch (e) {
    return '';
  }
}

/**
 * Normalize status ke format standar
 */
function normalizeStatus(status) {
  if (!status) return 'UNKNOWN';
  
  const statusStr = String(status).toUpperCase().trim();
  
  if (statusStr === 'EMPTY' || statusStr === 'KOSONG' || statusStr === '0%') return 'KOSONG';
  if (statusStr === 'MEDIUM' || statusStr === 'SEDANG' || statusStr === '50%') return 'SEDANG';
  if (statusStr === 'FULL' || statusStr === 'PENUH' || statusStr === '100%') return 'PENUH';
  
  return 'UNKNOWN';
}

/**
 * Mendapatkan class CSS untuk status
 */
function getStatusClass(status) {
  const normalized = normalizeStatus(status);
  switch(normalized) {
    case 'KOSONG': return 'bg-success';
    case 'SEDANG': return 'bg-warning';
    case 'PENUH': return 'bg-danger';
    default: return 'bg-secondary';
  }
}

/**
 * Mendapatkan class badge untuk status
 */
function getStatusBadgeClass(status) {
  const normalized = normalizeStatus(status);
  return `status-${normalized}`;
}

/**
 * Menghitung fill level berdasarkan jarak
 */
function calculateFillLevel(distance) {
  const maxHeight = 20; // Tinggi maksimal tempat sampah
  distance = Math.min(distance, maxHeight);
  const fillLevel = ((maxHeight - distance) / maxHeight) * 100;
  return Math.min(100, Math.max(0, Math.round(fillLevel)));
}

/**
 * Mendapatkan status baterai berdasarkan voltage
 */
function getBatteryStatus(voltage) {
  if (voltage >= 3.7) return { 
    icon: 'bi-battery-full text-success', 
    status: 'Normal',
    class: 'text-success'
  };
  if (voltage >= 3.3) return { 
    icon: 'bi-battery-half text-warning', 
    status: 'Rendah',
    class: 'text-warning'
  };
  return { 
    icon: 'bi-battery text-danger', 
    status: 'Kritis',
    class: 'text-danger'
  };
}

/**
 * Deteksi apakah device offline
 */
function isDeviceOffline() {
  if (!latestRecord || !latestRecord.timestamp) return true;
  
  const now = new Date();
  const lastDataTime = new Date(latestRecord.timestamp);
  const timeDifference = (now.getTime() - lastDataTime.getTime()) / 1000;
  
  return timeDifference > 120; // Offline jika > 2 menit
}

/**
 * Inisialisasi chart
 */
function initChart() {
  const ctx = document.getElementById('fill-chart');
  if (!ctx) return;
  
  // Destroy existing chart
  if (fillChart) {
    fillChart.destroy();
  }
  
  const chartConfig = {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'Fill Level (%)',
        data: [],
        borderColor: 'rgba(46, 125, 50, 1)',
        backgroundColor: 'rgba(46, 125, 50, 0.1)',
        borderWidth: 2,
        tension: 0.1,
        fill: true,
        pointBackgroundColor: 'rgba(46, 125, 50, 1)',
        pointRadius: 4,
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            color: '#333',
            font: {
              size: 12
            }
          }
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          titleColor: '#fff',
          bodyColor: '#fff',
          padding: 10,
          cornerRadius: 4
        }
      },
      scales: {
        x: {
          grid: {
            color: 'rgba(0, 0, 0, 0.05)'
          },
          ticks: {
            color: '#666',
            maxRotation: 45
          }
        },
        y: {
          beginAtZero: true,
          max: 100,
          grid: {
            color: 'rgba(0, 0, 0, 0.05)'
          },
          ticks: {
            color: '#666',
            callback: function(value) {
              return value + '%';
            }
          }
        }
      },
      interaction: {
        intersect: false,
        mode: 'index'
      },
      animation: {
        duration: 750,
        easing: 'easeInOutQuart'
      }
    }
  };
  
  fillChart = new Chart(ctx, chartConfig);
}

/**
 * Update chart dengan data baru
 */
function updateChart(data) {
  if (!fillChart) return;
  
  if (!data || data.length === 0) {
    // Clear chart jika tidak ada data
    fillChart.data.labels = [];
    fillChart.data.datasets[0].data = [];
    fillChart.update();
    return;
  }
  
  // Ambil 20 data terbaru
  const chartData = data.slice(0, 20);
  
  // Reverse untuk urutan waktu yang benar (lama ke baru)
  const reversedData = [...chartData].reverse();
  
  fillChart.data.labels = reversedData.map(item => formatTimeForChart(item.timestamp));
  fillChart.data.datasets[0].data = reversedData.map(item => calculateFillLevel(item.distance));
  fillChart.update();
}

/**
 * Render tabel dengan pagination
 */
function renderTableRows(data, page) {
  if (!tableBody) return;
  
  // Sembunyikan initial loading
  const initialLoading = document.getElementById('initial-loading');
  if (initialLoading) {
    initialLoading.style.display = 'none';
  }
  
  tableBody.innerHTML = '';
  const start = (page - 1) * rowsPerPage;
  const end = start + rowsPerPage;
  const paginatedData = data.slice(start, end);

  if (paginatedData.length === 0) {
    const tr = document.createElement("tr");
    tr.className = 'empty-state-row';
    tr.innerHTML = `
      <td colspan="5" class="text-center py-5">
        <div class="empty-state">
          <i class="bi bi-database-slash fs-1 text-muted"></i>
          <h5 class="text-muted">Tidak Ada Data</h5>
          <p class="small text-muted mb-3">Belum ada data yang tersimpan di database</p>
          <button id="refresh-manual" class="btn btn-sm btn-outline-success">
            <i class="bi bi-arrow-clockwise"></i> Muat Ulang Data
          </button>
        </div>
      </td>
    `;
    tableBody.appendChild(tr);
    
    // Add event listener untuk refresh manual
    setTimeout(() => {
      document.getElementById('refresh-manual')?.addEventListener('click', fetchData);
    }, 100);
    
    return;
  }

  paginatedData.forEach((item, index) => {
    const tr = document.createElement("tr");
    tr.className = 'fade-in';
    
    const fillLevel = calculateFillLevel(item.distance);
    const batteryStatus = getBatteryStatus(item.batteryVoltage);
    const statusClass = getStatusClass(item.status);
    const statusText = item.status || 'UNKNOWN';
    
    tr.innerHTML = `
      <td>${formatTimestamp(item.timestamp)}</td>
      <td>${item.distance?.toFixed?.(1) || '0.0'} cm</td>
      <td>
        <div class="progress" style="height: 20px;" role="progressbar" 
             aria-valuenow="${fillLevel}" aria-valuemin="0" aria-valuemax="100">
          <div class="progress-bar ${statusClass}" 
               style="width: ${fillLevel}%">
            ${fillLevel}%
          </div>
        </div>
      </td>
      <td>
        <span class="badge ${statusClass}">${statusText}</span>
      </td>
      <td>
        <div class="d-flex align-items-center">
          <i class="bi ${batteryStatus.icon} me-2"></i>
          <span class="${batteryStatus.class} fw-bold">
            ${item.batteryVoltage?.toFixed?.(2) || '0.00'}V
          </span>
        </div>
      </td>
    `;
    tableBody.appendChild(tr);
  });
}

/**
 * Update pagination controls
 */
function updatePagination(data) {
  if (!prevPageBtn || !nextPageBtn || !currentPageSpan) return;
  
  const totalPages = Math.max(1, Math.ceil(data.length / rowsPerPage));
  currentPage = Math.min(currentPage, totalPages);
  
  prevPageBtn.parentElement.classList.toggle('disabled', currentPage <= 1);
  nextPageBtn.parentElement.classList.toggle('disabled', currentPage >= totalPages);
  currentPageSpan.textContent = currentPage;
  
  // Update aria labels
  prevPageBtn.setAttribute('aria-label', `Previous page, current page ${currentPage} of ${totalPages}`);
  nextPageBtn.setAttribute('aria-label', `Next page, current page ${currentPage} of ${totalPages}`);
  currentPageSpan.setAttribute('aria-label', `Page ${currentPage} of ${totalPages}`);
}

/**
 * Filter data berdasarkan search dan filters
 */
function filterData() {
  try {
    if (!Array.isArray(allData)) {
      console.error('Data tidak valid:', allData);
      allData = [];
    }

    const searchTerm = searchInput.value.toLowerCase();
    const status = statusFilter.value;
    const dateRange = dateRangeInput.value;

    filteredData = allData.filter(item => {
      if (!item || typeof item !== 'object') return false;
      
      const validItem = {
        timestamp: item.timestamp || '',
        distance: item.distance ?? 0,
        status: normalizeStatus(item.status),
        batteryVoltage: item.batteryVoltage || 0,
        powerSource: item.powerSource || 'Battery',
        device: item.device || ''
      };

      // Filter pencarian
      const matchesSearch = searchTerm === '' || 
        String(validItem.timestamp).toLowerCase().includes(searchTerm) ||
        String(validItem.distance).includes(searchTerm) ||
        validItem.status.toLowerCase().includes(searchTerm) ||
        validItem.device.toLowerCase().includes(searchTerm);

      // Filter status
      const matchesStatus = status === '' || validItem.status === status;

      // Filter tanggal
      let matchesDate = true;
      if (dateRange) {
        try {
          const dates = dateRange.split(' to ');
          if (dates.length === 2) {
            const [start, end] = dates;
            const itemDate = new Date(validItem.timestamp);
            const startDate = new Date(start);
            const endDate = new Date(end);
            
            // Set waktu untuk end date ke akhir hari
            endDate.setHours(23, 59, 59, 999);
            
            matchesDate = itemDate >= startDate && itemDate <= endDate;
          }
        } catch (e) {
          console.error('Error filtering date:', e);
        }
      }

      return matchesSearch && matchesStatus && matchesDate;
    });

    // Urutkan descending berdasarkan timestamp (terbaru dulu)
    filteredData.sort((a, b) => {
      const dateA = new Date(a.timestamp || 0);
      const dateB = new Date(b.timestamp || 0);
      return dateB - dateA;
    });
    
    // Update latest record
    latestRecord = filteredData[0] || {};
    
    currentPage = 1;
    renderTableRows(filteredData, currentPage);
    updatePagination(filteredData);
    updateChart(filteredData);
    updateSummaryCards();
  } catch (error) {
    console.error('Error filtering data:', error);
    showAlert('Terjadi kesalahan saat memfilter data', 'danger');
  }
}

/**
 * Update summary cards dengan data terbaru
 */
function updateSummaryCards() {
  const deviceStatusElement = document.getElementById('device-status');
  const deviceIconElement = document.getElementById('device-icon');
  const currentStatusBadge = document.getElementById('current-status-badge');
  const currentDistance = document.getElementById('current-distance');
  const fillProgress = document.getElementById('fill-progress');
  const lastUpdate = document.getElementById('last-update');
  const todayCount = document.getElementById('today-count');
  const lastStatus = document.getElementById('last-status');
  const statusDistribution = document.getElementById('status-distribution');
  const batteryStatusIcon = document.getElementById('battery-status');
  const batteryVoltage = document.getElementById('battery-voltage');
  const powerSource = document.getElementById('power-source');
  const batteryLastReading = document.getElementById('battery-last-reading');
  const deviceId = document.getElementById('device-id');

  if (!filteredData.length) {
    // Tampilkan UI "Tidak Ada Data"
    if (currentStatusBadge) {
      currentStatusBadge.textContent = 'NO DATA';
      currentStatusBadge.className = 'status-badge bg-secondary';
    }
    
    if (currentDistance) currentDistance.textContent = '- cm';
    if (fillProgress) {
      fillProgress.style.width = '0%';
      fillProgress.setAttribute('aria-valuenow', '0');
      fillProgress.textContent = '0%';
      fillProgress.className = 'progress-bar bg-secondary';
    }
    if (lastUpdate) lastUpdate.textContent = '-';
    if (todayCount) todayCount.textContent = '0';
    if (lastStatus) lastStatus.textContent = '-';
    if (statusDistribution) {
      statusDistribution.innerHTML = `
        <div class="text-center text-muted py-2">
          <i class="bi bi-database me-1"></i>
          Tidak ada data untuk ditampilkan
        </div>
      `;
    }
    
    // Set status device
    const isPaused = pauseBtn && pauseBtn.classList.contains("disabled");
    if (deviceStatusElement) {
      deviceStatusElement.textContent = isPaused ? 'PAUSED' : 'NO DATA';
      deviceStatusElement.className = isPaused ? 'text-danger fw-bold' : 'text-muted fw-bold';
    }
    if (deviceIconElement) {
      deviceIconElement.className = isPaused ? 
        'bi bi-pause-circle fs-1 text-danger' : 
        'bi bi-database fs-1 text-muted';
    }
    if (deviceId) deviceId.textContent = ACTIVE_DEVICE.toUpperCase();
    
    // Battery info
    if (batteryStatusIcon) batteryStatusIcon.className = 'bi bi-battery fs-1 text-muted';
    if (batteryVoltage) batteryVoltage.textContent = '0.00V';
    if (powerSource) powerSource.textContent = 'Unknown';
    if (batteryLastReading) batteryLastReading.textContent = 'Last reading: -';
    
    return;
  }

  // Ada data, update dengan data terbaru
  latestRecord = filteredData[0] || {};
  const fillLevel = calculateFillLevel(latestRecord.distance || 0);
  const currentStatus = normalizeStatus(latestRecord.status);

  // Deteksi status device
  const isOffline = isDeviceOffline();
  const isPaused = pauseBtn && pauseBtn.classList.contains("disabled");
  
  let deviceStatus = 'STREAMING';
  let deviceStatusClass = 'text-success fw-bold';
  let deviceIconClass = 'bi bi-play-circle fs-1 text-success';
  
  if (isOffline) {
    deviceStatus = 'OFFLINE';
    deviceStatusClass = 'text-danger fw-bold';
    deviceIconClass = 'bi bi-wifi-off fs-1 text-danger';
  } else if (isPaused) {
    deviceStatus = 'PAUSED';
    deviceStatusClass = 'text-warning fw-bold';
    deviceIconClass = 'bi bi-pause-circle fs-1 text-warning';
  }

  if (deviceStatusElement) {
    deviceStatusElement.textContent = deviceStatus;
    deviceStatusElement.className = deviceStatusClass;
  }
  if (deviceIconElement) deviceIconElement.className = deviceIconClass;

  // Update kartu lainnya
  if (currentStatusBadge) {
    currentStatusBadge.textContent = currentStatus;
    currentStatusBadge.className = `status-badge ${getStatusBadgeClass(currentStatus)}`;
  }
  
  if (currentDistance) currentDistance.textContent = `${(latestRecord.distance || 0).toFixed(1)} cm`;
  
  if (fillProgress) {
    const statusClass = getStatusClass(currentStatus);
    fillProgress.style.width = `${fillLevel}%`;
    fillProgress.setAttribute('aria-valuenow', fillLevel);
    fillProgress.className = `progress-bar ${statusClass}`;
    fillProgress.textContent = `${fillLevel}%`;
  }
  
  if (lastUpdate) lastUpdate.textContent = formatTimestamp(latestRecord.timestamp);

  // Hitung data hari ini
  const todayData = filteredData.filter(item => {
    if (!item.timestamp) return false;
    const itemDate = new Date(item.timestamp);
    const today = new Date();
    
    return itemDate.getDate() === today.getDate() &&
           itemDate.getMonth() === today.getMonth() &&
           itemDate.getFullYear() === today.getFullYear();
  });
  
  if (todayCount) todayCount.textContent = todayData.length;
  if (lastStatus) lastStatus.textContent = currentStatus;

  // Status distribution
  const statusCounts = { KOSONG: 0, SEDANG: 0, PENUH: 0 };
  todayData.forEach(item => {
    const status = normalizeStatus(item.status);
    if (status in statusCounts) statusCounts[status]++;
  });

  const total = todayData.length;
  let distributionHTML = '';
  
  if (total > 0) {
    Object.entries(statusCounts).forEach(([status, count]) => {
      const percentage = Math.round((count / total) * 100);
      const statusClass = getStatusClass(status);
      distributionHTML += `
        <div class="d-flex justify-content-between align-items-center mb-1">
          <span>${status}</span>
          <span class="${statusClass}">${count} (${percentage}%)</span>
        </div>
        <div class="progress mb-2" style="height: 5px;">
          <div class="progress-bar ${statusClass}" style="width: ${percentage}%"></div>
        </div>
      `;
    });
  } else {
    distributionHTML = `
      <div class="text-center text-muted py-2">
        <i class="bi bi-calendar-x me-1"></i>
        Tidak ada data untuk hari ini
      </div>
    `;
  }
  
  if (statusDistribution) {
    statusDistribution.innerHTML = distributionHTML;
  }

  // Battery info
  const batteryInfo = getBatteryStatus(latestRecord.batteryVoltage || 0);
  if (batteryStatusIcon) batteryStatusIcon.className = `bi ${batteryInfo.icon} fs-1`;
  if (batteryVoltage) batteryVoltage.textContent = `${(latestRecord.batteryVoltage || 0).toFixed(2)}V`;
  if (powerSource) powerSource.textContent = latestRecord.powerSource || 'Battery';
  if (batteryLastReading) {
    batteryLastReading.textContent = `Last reading: ${formatTimestamp(latestRecord.timestamp)}`;
  }
  
  if (deviceId) deviceId.textContent = latestRecord.device || ACTIVE_DEVICE.toUpperCase();
}

/**
 * Kirim notifikasi Telegram
 */
async function sendTelegramNotification(message, device = ACTIVE_DEVICE) {
  try {
    const res = await fetchWithTimeout(`/api/telegram-notify`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        message,
        device
      }),
      timeout: 5000
    });
    
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    
    return await res.json();
  } catch (err) {
    console.error("Telegram notification error:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Kirim notifikasi Discord
 */
async function sendDiscordNotification(message, device = ACTIVE_DEVICE) {
  try {
    const res = await fetchWithTimeout(`/api/discord-notify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message, device }),
      timeout: 5000
    });

    const result = await res.json();
    return result.success;
  } catch (error) {
    console.error('Discord error:', error.message);
    return false;
  }
}

/**
 * Fetch data dari server
 */
async function fetchData() {
  if (isFetching) {
    console.log('⚠️ Fetch already in progress, skipping...');
    return;
  }
  
  try {
    isFetching = true;
    showLoading(true);
    
    console.log(`🔄 Fetching data for ${ACTIVE_DEVICE}...`);
    
    const response = await fetchWithTimeout(`/api/trash-data?device=${ACTIVE_DEVICE}`, {
      timeout: FETCH_TIMEOUT
    });
    
    if (!response.ok) {
      throw new Error(`Server error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    console.log('📦 API Response:', result);

    if (result?.success) {
      if (Array.isArray(result.data) && result.data.length > 0) {
        allData = result.data;
        console.log(`✅ Loaded ${allData.length} records from database`);
        
        // Start auto-refresh jika ada data
        startAutoRefresh();
      } else {
        console.log('📭 Database kosong - tidak ada data');
        allData = [];
        
        // Stop auto-refresh jika tidak ada data
        stopAutoRefresh();
        
        // Hanya tampilkan alert pertama kali
        if (filteredData.length > 0) {
          showAlert('Database sekarang kosong', 'info');
        }
      }
    } else {
      throw new Error(result?.error || 'Invalid response format from server');
    }

  } catch (error) {
    console.error('❌ Fetch error:', error);
    
    if (error.name === 'AbortError') {
      showAlert('⚠️ Timeout: Server tidak merespons dalam 10 detik', 'warning');
    } else if (error.message.includes('Failed to fetch')) {
      showAlert('🌐 Gagal terhubung ke server. Periksa koneksi internet.', 'danger');
    } else {
      showAlert(`❌ ${error.message}`, 'danger');
    }
    
    allData = [];
    stopAutoRefresh();
  } finally {
    // Sembunyikan initial loading di tabel
    const initialLoading = document.getElementById('initial-loading');
    if (initialLoading) {
      initialLoading.style.display = 'none';
    }
    
    filterData();
    showLoading(false);
    
    // Reset fetching flag dengan delay kecil
    setTimeout(() => {
      isFetching = false;
    }, 500);
  }
}

/**
 * Cek status pause dari server
 */
async function checkPauseStatus() {
  try {
    const res = await fetchWithTimeout(`/api/get-pause-status?device=${ACTIVE_DEVICE}`, {
      timeout: 5000
    });
    
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    
    const result = await res.json();
    
    if (result.success) {
      if (result.paused) {
        pauseBtn.classList.add("disabled");
        pauseBtn.setAttribute("disabled", true);
        resumeBtn.classList.remove("disabled");
        resumeBtn.removeAttribute("disabled");
      } else {
        resumeBtn.classList.add("disabled");
        resumeBtn.setAttribute("disabled", true);
        pauseBtn.classList.remove("disabled");
        pauseBtn.removeAttribute("disabled");
      }
      updateSummaryCards();
    }
  } catch (error) {
    console.error("Error checking pause status:", error);
  }
}

/**
 * Ambil status Telegram users dari Firebase
 */
async function fetchTelegramUserStatuses() {
  try {
    const container = document.getElementById('telegram-users');
    if (!container) return;
    
    const endpoint = ACTIVE_DEVICE === 'device1'
      ? '/api/telegram-users-status/device1'
      : '/api/telegram-users-status/device2';

    const response = await fetchWithTimeout(endpoint, { timeout: 5000 });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const results = await response.json();

    if (!Array.isArray(results) || results.length === 0) {
      container.innerHTML = '<div class="text-muted text-center py-2"><i class="bi bi-person-x me-1"></i>No Telegram users</div>';
      return;
    }
    
    let html = '';
    results.forEach((user) => {
      html += `
        <div class="user-info">
          <span class="user-name">${user.name || 'Unknown User'}</span>
          <span class="badge ${user.isPaused ? 'bg-danger' : 'bg-success'} user-status">
            ${user.isPaused ? 'PAUSED' : 'ACTIVE'}
          </span>
        </div>
      `;
    });
    
    container.innerHTML = html;
  } catch (err) {
    console.error('Gagal ambil status telegram user:', err);
    const container = document.getElementById('telegram-users');
    if (container) {
      container.innerHTML = '<div class="text-danger text-center py-2"><i class="bi bi-exclamation-triangle me-1"></i>Failed to load</div>';
    }
  }
}

/**
 * Export data ke CSV
 */
function exportToCSV() {
  if (!filteredData.length) {
    showAlert('Tidak ada data untuk di-export', 'warning');
    return;
  }

  try {
    // Header dengan informasi lengkap
    const headers = [
      'Timestamp', 
      'Distance (cm)', 
      'Fill Level (%)', 
      'Status',
      'Battery (V)',
      'Power Source',
      'Device'
    ];
    
    const csvRows = [headers.join(',')];

    filteredData.forEach(item => {
      const fillLevel = calculateFillLevel(item.distance);
      const row = [
        `"${formatTimestamp(item.timestamp)}"`,
        item.distance?.toFixed?.(1) || '0.0',
        fillLevel,
        item.status || 'UNKNOWN',
        item.batteryVoltage?.toFixed?.(2) || '0.00',
        item.powerSource || 'Unknown',
        item.device || 'Unknown'
      ];
      csvRows.push(row.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { 
      type: 'text/csv;charset=utf-8;' 
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `trash_monitoring_${ACTIVE_DEVICE}_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showAlert('Data berhasil di-export ke CSV', 'success');
  } catch (error) {
    console.error('Error exporting to CSV:', error);
    showAlert('Gagal mengexport data', 'danger');
  }
}

/**
 * Start auto-refresh interval
 */
function startAutoRefresh() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
  
  // Hanya start auto-refresh jika ada data
  if (allData.length > 0) {
    refreshInterval = setInterval(() => {
      if (document.visibilityState === 'visible' && !isFetching) {
        fetchData();
      }
    }, 30000); // 30 detik
    
    console.log('🔄 Auto-refresh started (30s interval)');
  }
}

/**
 * Stop auto-refresh interval
 */
function stopAutoRefresh() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
    console.log('⏹️ Auto-refresh stopped');
  }
}

// ========================
// === SIDEBAR MANAGEMENT ===
// ========================

/**
 * Inisialisasi sidebar
 */
function initSidebar() {
  if (!sidebar || !sidebarToggle) return;
  
  // Buat overlay element
  const overlay = document.createElement('div');
  overlay.id = 'sidebar-overlay';
  document.body.appendChild(overlay);
  
  // Toggle sidebar
  sidebarToggle.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    isSidebarActive = !isSidebarActive;
    sidebar.classList.toggle('active');
    overlay.style.display = isSidebarActive ? 'block' : 'none';
    sidebarToggle.setAttribute('aria-expanded', isSidebarActive);
    
    // Update icon
    const icon = sidebarToggle.querySelector('i');
    if (icon) {
      icon.className = isSidebarActive ? 'bi bi-x-lg' : 'bi bi-list';
    }
  });
  
  // Tutup sidebar saat overlay diklik
  overlay.addEventListener('click', () => {
    sidebar.classList.remove('active');
    overlay.style.display = 'none';
    isSidebarActive = false;
    sidebarToggle.setAttribute('aria-expanded', 'false');
    
    const icon = sidebarToggle.querySelector('i');
    if (icon) {
      icon.className = 'bi bi-list';
    }
  });
  
  // Tutup sidebar saat tekan ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isSidebarActive) {
      sidebar.classList.remove('active');
      overlay.style.display = 'none';
      isSidebarActive = false;
      sidebarToggle.setAttribute('aria-expanded', 'false');
      
      const icon = sidebarToggle.querySelector('i');
      if (icon) {
        icon.className = 'bi bi-list';
      }
    }
  });
  
  // Tutup sidebar saat resize ke desktop
  window.addEventListener('resize', () => {
    if (window.innerWidth >= 768) {
      sidebar.classList.remove('active');
      overlay.style.display = 'none';
      isSidebarActive = false;
      sidebarToggle.setAttribute('aria-expanded', 'false');
      
      const icon = sidebarToggle.querySelector('i');
      if (icon) {
        icon.className = 'bi bi-list';
      }
    }
  });
  
  // Highlight menu aktif
  const path = window.location.pathname;
  document.querySelectorAll('.device-link').forEach(link => {
    if (path.includes(link.getAttribute('href'))) {
      link.classList.add('active');
    }
  });
}

// ========================
// === EVENT LISTENERS ===
// ========================

/**
 * Setup semua event listeners
 */
function setupEventListeners() {
  // Filter form
  if (filterForm) {
    filterForm.addEventListener('submit', e => {
      e.preventDefault();
      filterData();
    });

    filterForm.addEventListener('reset', () => {
      setTimeout(() => {
        searchInput.value = '';
        statusFilter.value = '';
        if (dateRangeInput._flatpickr) {
          dateRangeInput._flatpickr.clear();
        }
        filterData();
      }, 0);
    });
  }

  // Pagination
  if (prevPageBtn) {
    prevPageBtn.addEventListener('click', e => {
      e.preventDefault();
      if (currentPage > 1) {
        currentPage--;
        renderTableRows(filteredData, currentPage);
        updatePagination(filteredData);
      }
    });
  }

  if (nextPageBtn) {
    nextPageBtn.addEventListener('click', e => {
      e.preventDefault();
      const totalPages = Math.ceil(filteredData.length / rowsPerPage);
      if (currentPage < totalPages) {
        currentPage++;
        renderTableRows(filteredData, currentPage);
        updatePagination(filteredData);
      }
    });
  }

  // Refresh button
  if (refreshBtn) {
    refreshBtn.addEventListener('click', fetchData);
  }

  // Export button
  if (exportBtn) {
    exportBtn.addEventListener('click', exportToCSV);
  }

  // Delete all button
  if (deleteAllBtn) {
    deleteAllBtn.addEventListener('click', async () => {
      if (!confirm(`Yakin ingin menghapus SEMUA data untuk ${ACTIVE_DEVICE}? Tindakan ini tidak dapat dibatalkan!`)) return;

      try {
        showLoading(true);
        const res = await fetchWithTimeout(`/api/delete-all-data?device=${ACTIVE_DEVICE}`, { 
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 10000
        });
        
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Gagal menghapus data');
        }

        showAlert(`✅ Semua data untuk ${ACTIVE_DEVICE} berhasil dihapus`, "success");
        
        // Reset UI
        allData = [];
        filteredData = [];
        renderTableRows([], 1);
        updatePagination([]);
        updateChart([]);
        updateSummaryCards();
        
        // Stop auto-refresh
        stopAutoRefresh();

      } catch (err) {
        console.error("Error deleting all data:", err);
        showAlert(`❌ Gagal menghapus data: ${err.message}`, "danger");
      } finally {
        showLoading(false);
      }
    });
  }

  // Pause button
  if (pauseBtn) {
    pauseBtn.addEventListener("click", async () => {
      if (!confirm(`Pause pengiriman data dan notifikasi untuk ${ACTIVE_DEVICE}?`)) return;
      
      try {
        showLoading(true);
        const res = await fetchWithTimeout(`/api/set-pause-status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            pause: true,
            device: ACTIVE_DEVICE 
          }),
          timeout: 5000
        });
        
        const result = await res.json();
        
        if (result.success) {
          showAlert(`⏸️ Data dan notifikasi untuk ${ACTIVE_DEVICE} berhasil dipause`, "success");
          await checkPauseStatus();
          updateSummaryCards();
        } else {
          showAlert(`❌ Gagal mempause ${ACTIVE_DEVICE}: ${result.error || "Unknown error"}`, "danger");
        }
      } catch (error) {
        console.error("Error:", error);
        showAlert(`❌ Terjadi kesalahan saat mempause ${ACTIVE_DEVICE}`, "danger");
      } finally {
        showLoading(false);
      }
    });
  }

  // Resume button
  if (resumeBtn) {
    resumeBtn.addEventListener("click", async () => {
      const isOffline = isDeviceOffline();
      
      if (isOffline && filteredData.length > 0) {
        const deviceName = ACTIVE_DEVICE.toUpperCase();
        const offlineMessage = `⚠️ Perintah Gagal: Perangkat ${deviceName} sedang OFFLINE.`;

        showAlert(offlineMessage, 'warning');

        const notificationMessage = `❗️ <b>Peringatan Sistem</b> ❗️\nAdmin mencoba me-resume perangkat ${deviceName} yang terdeteksi sedang offline.`;
        
        sendTelegramNotification(notificationMessage.replace(/\*\*/g, '<b>'), ACTIVE_DEVICE);
        sendDiscordNotification(notificationMessage, ACTIVE_DEVICE);
        
        return;
      }

      // Resume jika perangkat online atau tidak ada data
      try {
        showLoading(true);
        const res = await fetchWithTimeout(`/api/set-pause-status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            pause: false,
            device: ACTIVE_DEVICE 
          }),
          timeout: 5000
        });
        
        const result = await res.json();
        
        if (result.success) {
          showAlert(`▶️ Data dan notifikasi untuk ${ACTIVE_DEVICE} berhasil dilanjutkan`, "success");
          await checkPauseStatus();
          updateSummaryCards();
          
          // Trigger fetch data setelah resume
          setTimeout(fetchData, 1000);
        } else {
          showAlert(`❌ Gagal melanjutkan ${ACTIVE_DEVICE}: ${result.error || "Unknown error"}`, "danger");
        }
      } catch (error) {
        console.error("Error:", error);
        showAlert(`❌ Terjadi kesalahan saat melanjutkan ${ACTIVE_DEVICE}`, "danger");
      } finally {
        showLoading(false);
      }
    });
  }
}

// ========================
// === INITIALIZATION ===
// ========================

/**
 * Inisialisasi aplikasi
 */
function initApp() {
  console.log('🚀 Initializing Smart Trash Monitoring for', ACTIVE_DEVICE);
  
  // Set tahun di footer
  if (currentYear) {
    currentYear.textContent = new Date().getFullYear();
  }
  
  // Inisialisasi chart
  initChart();
  
  // Inisialisasi sidebar
  initSidebar();
  
  // Setup event listeners
  setupEventListeners();
  
  // Load initial data
  setTimeout(() => {
    fetchData();
    checkPauseStatus();
    fetchTelegramUserStatuses();
    
    // Kirim notifikasi aplikasi dibuka (hanya untuk admin)
    const userRole = localStorage.getItem('userRole');
    const username = localStorage.getItem('username');
    
    if (userRole === 'admin' && username) {
      const notificationMessage = `🌐 <b>Aplikasi Monitoring Dibuka</b> 🌐\nUser: ${username}\nDevice: ${ACTIVE_DEVICE}\nWaktu: ${new Date().toLocaleString('id-ID')}`;
      const discordMessage = notificationMessage.replace(/<b>/g, '**').replace(/<\/b>/g, '**');
      
      sendTelegramNotification(notificationMessage, ACTIVE_DEVICE);
      sendDiscordNotification(discordMessage, ACTIVE_DEVICE);
    }
    
  }, 500);
  
  // Setup interval untuk check pause status dan telegram users
  setInterval(checkPauseStatus, 15000); // 15 detik
  setInterval(fetchTelegramUserStatuses, 45000); // 45 detik
}

// ========================
// === START APPLICATION ===
// ========================

// Tunggu DOM siap sepenuhnya
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

// Handle page visibility untuk optimasi
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    // Refresh data saat tab aktif kembali
    fetchData();
    checkPauseStatus();
  } else {
    // Stop auto-refresh saat tab tidak aktif
    stopAutoRefresh();
  }
});

// Error handling global
window.addEventListener('error', function(event) {
  console.error('Global error:', event.error);
  showAlert(`Terjadi kesalahan: ${event.message}`, 'danger');
});

// Unhandled promise rejection
window.addEventListener('unhandledrejection', function(event) {
  console.error('Unhandled promise rejection:', event.reason);
  showAlert(`Terjadi kesalahan dalam operasi: ${event.reason}`, 'danger');
});

// Handle offline/online events
window.addEventListener('offline', () => {
  showAlert('⚠️ Anda sedang offline. Beberapa fitur mungkin tidak berfungsi.', 'warning');
});

window.addEventListener('online', () => {
  showAlert('✅ Koneksi internet kembali. Memuat data terbaru...', 'success');
  fetchData();
});

// Prevent leaving page with unsaved changes (if any)
window.addEventListener('beforeunload', (event) => {
  if (isFetching) {
    event.preventDefault();
    event.returnValue = 'Data sedang dimuat, yakin ingin meninggalkan halaman?';
  }
});