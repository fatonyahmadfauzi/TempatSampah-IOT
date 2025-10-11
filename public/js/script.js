const ACTIVE_DEVICE = window.location.pathname.includes('device-2') ? 'device2' : 'device1';
// const API_BASE_URL = 'https://...'; // TIDAK DIPERLUKAN LAGI

// Sample data - in a real app, this would come from an API
let allData = [];
let filteredData = [];
let currentPage = 1;
const rowsPerPage = 10;
let fillChart = null;
let isFetching = false; // Tambahkan ini

// DOM Elements
const dataTable = document.getElementById('data-table');
const tableBody = dataTable.querySelector('tbody');
const prevPageBtn = document.getElementById('prev-page');
const nextPageBtn = document.getElementById('next-page');
const currentPageSpan = document.getElementById('current-page');
const filterForm = document.getElementById('filter-form');
const searchInput = document.getElementById('search-input');
const statusFilter = document.getElementById('status-filter');
const dateRangeInput = document.getElementById('date-range');
const refreshBtn = document.getElementById('refresh-btn');
const exportBtn = document.getElementById('export-btn');

// Tambahkan fungsi ini di bagian utility functions
function getStatusClass(status) {
    const normalized = status ? status.toUpperCase() : 'UNKNOWN';
    switch(normalized) {
        case 'KOSONG': return 'bg-success';
        case 'SEDANG': return 'bg-warning';
        case 'PENUH': return 'bg-danger';
        default: return 'bg-secondary';
    }
}

// Initialize date range picker
flatpickr(dateRangeInput, {
    mode: "range",
    dateFormat: "Y-m-d"
});

// Initialize the chart
// Initialize the chart
function initChart() {
    const ctx = document.getElementById('fill-chart').getContext('2d');
    
    // Destroy existing chart if it exists
    if (fillChart) {
        fillChart.destroy();
    }
    
    fillChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Fill Level (%)',
                data: [],
                borderColor: 'rgba(75, 192, 192, 1)',
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                tension: 0.1,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100
                }
            }
        }
    });
}

// Update chart with new data
function updateChart(data) {
    if (!fillChart) return;
    
    // Ambil 20 data terbaru (sudah terurut dari baru ke lama)
    const chartData = data.slice(0, 20);

    fillChart.data.labels = chartData.map(item => {
        try {
            // Gunakan logika parsing yang sama dengan formatTimestamp
            let date;
            if (typeof item.timestamp === 'string') {
                const fixedTimestamp = item.timestamp
                    .replace(/(T\d{2}:\d{2}:\d{2})\d/, '$1')
                    .replace(/Z?$/, '');
                date = new Date(fixedTimestamp);
                
                if (isNaN(date.getTime())) {
                    date = new Date(item.timestamp);
                }
            } else {
                date = new Date(item.timestamp);
            }

            if (isNaN(date.getTime())) {
                console.warn('Invalid date:', item.timestamp);
                return 'Invalid Time';
            }

            // Hanya ambil bagian waktu saja seperti di formatTimestamp
            return date.toLocaleTimeString('id-ID', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
                timeZone: 'Asia/Jakarta'
            }).replace(/\./g, ':');
        } catch (e) {
            console.error('Error formatting timestamp:', e, 'Raw value:', item.timestamp);
            return 'Invalid Time';
        }
    });

    fillChart.data.datasets[0].data = chartData.map(item => calculateFillLevel(item.distance));
    fillChart.update();
}

// Format timestamp to readable string with DD/MM/YYYY HH:MM:SS format
function formatTimestamp(raw) {
    try {
        // Pastikan timestamp valid
        let date;
        if (typeof raw === 'string') {
            // Perbaiki timestamp yang tidak valid dan normalisasi
            const fixedTimestamp = raw
                .replace(/(T\d{2}:\d{2}:\d{2})\d/, '$1') // Perbaiki digit tambahan
                .replace(/Z?$/, ''); // Hapus Z jika ada
            
            date = new Date(fixedTimestamp);
            
            // Jika parsing gagal, coba format lain
            if (isNaN(date.getTime())) {
                date = new Date(raw);
            }
        } else {
            date = new Date(raw);
        }

        if (isNaN(date.getTime())) {
            console.warn('Invalid date:', raw);
            return 'Invalid Time';
        }

        // Format tanggal dan waktu
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
        console.error('Error formatting timestamp:', e, 'Raw value:', raw);
        return 'Invalid Time';
    }
}

function normalizeStatus(status) {
    if (!status) return 'UNKNOWN';
    
    const statusStr = String(status).toUpperCase().trim();
    
    // Handle berbagai kemungkinan penulisan status
    if (statusStr === 'EMPTY' || statusStr === 'KOSONG' || statusStr === '0%') return 'KOSONG';
    if (statusStr === 'MEDIUM' || statusStr === 'SEDANG' || statusStr === '50%') return 'SEDANG';
    if (statusStr === 'FULL' || statusStr === 'PENUH' || statusStr === '100%') return 'PENUH';
    
    return 'UNKNOWN';
}

// Render table rows with pagination
function renderTableRows(data, page) {
    console.log("📄 Rendering table with rows:", data.length);

    tableBody.innerHTML = '';
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const paginatedData = data.slice(start, end);

    if (paginatedData.length === 0) {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td colspan="6" class="text-center py-4">No data available</td>`;
        tableBody.appendChild(tr);
        return;
    }

        paginatedData.forEach(item => {
        const tr = document.createElement("tr");
        const fillLevel = calculateFillLevel(item.distance);
        const batteryStatus = getBatteryStatus(item.batteryVoltage);
        
        tr.innerHTML = `
        <td>${formatTimestamp(item.timestamp)}</td>
        <td>${item.distance?.toFixed?.(1) || '0.0'}</td>
        <td>
            <div class="progress" style="height: 20px;">
                <div class="progress-bar ${getStatusClass(item.status)}" 
                    role="progressbar" style="width: ${fillLevel}%" 
                    aria-valuenow="${fillLevel}" aria-valuemin="0" aria-valuemax="100">
                    ${fillLevel}%
                </div>
            </div>
        </td>
        <td><span class="badge ${getStatusClass(item.status)}">${item.status || 'UNKNOWN'}</span></td>
        <td>
            <div class="d-flex align-items-center">
                <i class="bi bi-battery ${batteryStatus.icon} me-2"></i>
                ${item.batteryVoltage?.toFixed?.(2) || '0.00'}V
            </div>
        </td>
        `;
        tableBody.appendChild(tr);
    });
}

// Update pagination controls
function updatePagination(data) {
    const totalPages = Math.max(1, Math.ceil(data.length / rowsPerPage));
    currentPage = Math.min(currentPage, totalPages);
    
    prevPageBtn.parentElement.classList.toggle('disabled', currentPage <= 1);
    nextPageBtn.parentElement.classList.toggle('disabled', currentPage >= totalPages);
    currentPageSpan.textContent = currentPage;
}

// Filter data based on search and filters
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
            // Pastikan item memiliki struktur yang benar
            if (!item || typeof item !== 'object') return false;
            
            // Validasi field penting
            const validItem = {
                timestamp: item.timestamp || '',
                distance: item.distance ?? 0,
                status: item.status || 'UNKNOWN',
                notes: item.notes || ''
            };

            // Filter pencarian
            const matchesSearch = 
                String(validItem.timestamp).toLowerCase().includes(searchTerm) ||
                String(validItem.distance).includes(searchTerm) ||
                validItem.status.toLowerCase().includes(searchTerm) ||
                validItem.notes.toLowerCase().includes(searchTerm);

            // Filter status
            const matchesStatus = status === '' || validItem.status === status;

            // Filter tanggal
            let matchesDate = true;
            if (dateRange) {
                try {
                    const [start, end] = dateRange.split(' to ');
                    const itemDate = new Date(validItem.timestamp);
                    const startDate = new Date(start);
                    const endDate = new Date(end);
                    
                    matchesDate = itemDate >= startDate && itemDate <= endDate;
                } catch (e) {
                    console.error('Error filtering date:', e);
                }
            }

            return matchesSearch && matchesStatus && matchesDate;
        });

        // Pertahankan urutan descending berdasarkan timestamp
        filteredData.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        currentPage = 1;
        renderTableRows(filteredData, currentPage);
        updatePagination(filteredData);
        updateChart(filteredData);
        updateSummaryCards();
    } catch (error) {
        console.error('Error filtering data:', error);
    }
}

// Tambahkan fungsi baru untuk status baterai
function getBatteryStatus(voltage) {
    if (voltage >= 3.7) return { icon: 'bi-battery-full text-success', status: 'Normal' };
    if (voltage >= 3.3) return { icon: 'bi-battery-half text-warning', status: 'Rendah' };
    return { icon: 'bi-battery text-danger', status: 'Kritis' };
}

// Update summary cards with latest data
// Di bagian atas file, tambahkan:
let latestRecord = {};

// Modifikasi fungsi updateSummaryCards():
function updateSummaryCards() {
    const deviceStatusElement = document.getElementById('device-status');
    const deviceIconElement = document.getElementById('device-icon');

    if (!filteredData.length) {
        // Tampilkan data default jika tidak ada data sama sekali
        document.getElementById('current-status-badge').textContent = 'NO DATA';
        document.getElementById('current-status-badge').className = 'status-badge bg-secondary';
        document.getElementById('current-distance').textContent = '0.0 cm';
        document.getElementById('fill-progress').style.width = '0%';
        document.getElementById('last-update').textContent = 'N/A';
        document.getElementById('today-count').textContent = '0';
        document.getElementById('last-status').textContent = 'NO DATA';
        document.getElementById('status-distribution').innerHTML = `<div class="text-muted">No data available</div>`;
        
        // Set status device ke OFFLINE jika tidak ada data
        deviceStatusElement.textContent = 'OFFLINE';
        deviceStatusElement.className = 'text-muted fw-bold';
        deviceIconElement.className = 'bi bi-wifi-off fs-1 text-muted';
        return;
    }

    latestRecord = filteredData[0] || {};
    const fillLevel = calculateFillLevel(latestRecord.distance || 0);

    // --- LOGIKA BARU UNTUK DETEKSI OFFLINE ---
    const now = new Date();
    const lastDataTime = new Date(latestRecord.timestamp || 0);
    const timeDifference = (now.getTime() - lastDataTime.getTime()) / 1000; // Selisih dalam detik

    const isPaused = pauseBtn.classList.contains("disabled");

    // Tentukan status device: OFFLINE, PAUSED, atau STREAMING
    if (timeDifference > 120) { // Jika data terakhir lebih dari 2 menit yang lalu
        deviceStatusElement.textContent = 'OFFLINE';
        deviceStatusElement.className = 'text-muted fw-bold';
        deviceIconElement.className = 'bi bi-wifi-off fs-1 text-muted';
    } else if (isPaused) {
        deviceStatusElement.textContent = 'PAUSED';
        deviceStatusElement.className = 'text-danger fw-bold';
        deviceIconElement.className = 'bi bi-pause-circle fs-1 text-danger';
    } else {
        deviceStatusElement.textContent = 'STREAMING';
        deviceStatusElement.className = 'text-success fw-bold';
        deviceIconElement.className = 'bi bi-play-circle fs-1 text-success';
    }
    // --- AKHIR LOGIKA BARU ---

    // Update kartu lainnya seperti biasa (semua fungsi lama tetap ada)
    document.getElementById('current-status-badge').textContent = latestRecord.status || 'UNKNOWN';
    document.getElementById('current-status-badge').className = `status-badge ${getStatusClass(latestRecord.status)}`;
    document.getElementById('current-distance').textContent = `${(latestRecord.distance || 0).toFixed(1)} cm`;
    
    const progressBar = document.getElementById('fill-progress');
    progressBar.style.width = `${fillLevel}%`;
    progressBar.setAttribute('aria-valuenow', fillLevel);
    progressBar.className = `progress-bar ${getStatusClass(latestRecord.status)}`;
    
    document.getElementById('last-update').textContent = formatTimestamp(latestRecord.timestamp || new Date().toISOString());

    const todayData = filteredData.filter(item => {
        if (!item.timestamp) return false;
        const itemDateStr = new Date(item.timestamp).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' }).split(',')[0];
        const todayStr = new Date().toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' }).split(',')[0];
        return itemDateStr === todayStr;
    });
    
    document.getElementById('today-count').textContent = todayData.length;
    document.getElementById('last-status').textContent = latestRecord.status || 'UNKNOWN';

    const statusCounts = { KOSONG: 0, SEDANG: 0, PENUH: 0 };
    todayData.forEach(item => {
        const status = normalizeStatus(item.status);
        if (status in statusCounts) statusCounts[status]++;
    });

    const total = todayData.length;
    let distributionHTML = '';
    Object.entries(statusCounts).forEach(([status, count]) => {
        const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
        const statusClass = getStatusClass(status).replace('bg-', 'text-');
        distributionHTML += `
            <div class="d-flex justify-content-between align-items-center mb-1">
                <span>${status}</span>
                <span class="${statusClass}">${count} (${percentage}%)</span>
            </div>
            <div class="progress mb-2" style="height: 5px;">
                <div class="progress-bar ${getStatusClass(status)}" role="progressbar" style="width: ${percentage}%"></div>
            </div>`;
    });
    document.getElementById('status-distribution').innerHTML = distributionHTML || `<div class="text-muted">No data available for today</div>`;

    const batteryInfo = getBatteryStatus(latestRecord.batteryVoltage || 0);
    document.getElementById('battery-status').className = `bi ${batteryInfo.icon} fs-1`;
    document.getElementById('battery-voltage').textContent = `${(latestRecord.batteryVoltage || 0).toFixed(2)}V`;
    document.getElementById('power-source').textContent = latestRecord.powerSource || 'Battery';
    document.getElementById('battery-last-reading').textContent = `Last reading: ${formatTimestamp(latestRecord.timestamp || new Date().toISOString())}`;
    document.getElementById('device-id').textContent = latestRecord.device || 'ESP32';
}

// Fungsi untuk mengirim notifikasi ke Telegram melalui server
async function sendTelegramNotification(message, device = ACTIVE_DEVICE) {
  try {
    const res = await fetch(`/api/telegram-notify`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        message,
        device // Tambahkan parameter device
      })
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

// Di dalam public/js/script.js

async function fetchData() {
  try {
    showLoading(true);
    const response = await fetch(`/api/trash-data?device=${ACTIVE_DEVICE}`);

    // Jika respons TIDAK ok (seperti 404, 502, dll.)
    if (!response.ok) {
      // Lemparkan error dengan status dari server
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    if (result?.success) {
      // Cek jika data yang diterima adalah array dan tidak kosong
      if (Array.isArray(result.data) && result.data.length > 0) {
        allData = result.data; // Gunakan data langsung karena sudah diproses di backend
      } else {
        // Handle jika data kosong dari API
        console.warn('API returned empty or invalid data');
        allData = []; // Tampilkan tabel kosong
      }
    } else {
      // Handle jika API mengembalikan success: false
      throw new Error(result.error || 'API returned an error');
    }

  } catch (error) {
    // BLOK CATCH YANG DIPERBAIKI
    console.error('Fetch error:', error);
    showAlert(`Gagal memuat data dari server: ${error.message}`, 'danger');
    allData = []; // Tampilkan tabel kosong, BUKAN data acak
  } finally {
    // Apapun yang terjadi, jalankan ini
    filterData(); // Ini akan me-render tabel (meskipun kosong)
    showLoading(false);
  }
}

// Tambahkan fungsi baru
function updateDeviceHeader(deviceId) {
    const header = document.querySelector('h2.fw-bold');
    if (header) {
        header.textContent = `DEVICE ${deviceId.toUpperCase().replace('DEVICE', '')} - TEMPAT SAMPAH PINTAR KU`;
    }
    
    const deviceIdElement = document.getElementById('device-id');
    if (deviceIdElement) {
        deviceIdElement.textContent = deviceId.toUpperCase();
    }
}

function calculateFillLevel(distance) {
  const maxHeight = 20; // atau tinggi maksimal sesuai desain kamu
  distance = Math.min(distance, maxHeight);
  const fillLevel = ((maxHeight - distance) / maxHeight) * 100;
  return Math.min(100, Math.max(0, Math.round(fillLevel)));
}

// Fungsi terpisah untuk proses data
function processData(data) {
  if (!data) return [];
  
  // Handle both array and object formats
  if (Array.isArray(data)) {
    return data.map(item => ({
      timestamp: item.timestamp || new Date().toISOString(),
      distance: parseFloat(item.distance) || 0,
      status: item.status || 'UNKNOWN',
      batteryVoltage: parseFloat(item.batteryVoltage) || 0,
      powerSource: item.powerSource || 'Battery',
      device: item.device || 'Unknown',
      fillLevel: calculateFillLevel(item.distance || 0)
    }));
  }

  // Handle object format
  return Object.entries(data).map(([timestampKey, item]) => {
    // Convert numeric timestamps to proper dates
    let timestamp;
    if (!isNaN(timestampKey)) {
      const tsNum = parseInt(timestampKey);
      timestamp = new Date(tsNum > 1e12 ? tsNum : tsNum * 1000).toISOString();
    } else {
      timestamp = item.timestamp || new Date().toISOString();
    }
    
    return {
      timestamp: timestamp,
      distance: parseFloat(item.distance) || 0,
      status: item.status || 'UNKNOWN',
      batteryVoltage: parseFloat(item.batteryVoltage) || 0,
      powerSource: item.powerSource || 'Battery',
      device: item.device || 'Unknown',
      fillLevel: calculateFillLevel(item.distance || 0)
    };
  });
}

// Generate realistic fallback data
function generateFallbackData(deviceId = 'device1') {
    const data = [];
    const now = new Date();
    const statuses = ['KOSONG', 'SEDANG', 'PENUH'];
    
    for (let i = 0; i < 24; i++) {
        const timestamp = new Date(now);
        timestamp.setHours(now.getHours() - i);
        
        const status = statuses[i % 3];
        const distance = status === 'KOSONG' ? 2 + Math.random() * 3 :
                        status === 'SEDANG' ? 8 + Math.random() * 4 :
                        15 + Math.random() * 5;
        
        data.push({
            timestamp: timestamp.toISOString(),
            distance: parseFloat(distance.toFixed(1)),
            status: status,
            batteryVoltage: parseFloat((3.3 + Math.random() * 0.7).toFixed(2)),
            powerSource: 'Battery',
            device: deviceId,
            fillLevel: calculateFillLevel(distance)
        });
    }
    
    return data;
}

// Export data to CSV
function exportToCSV() {
    if (!filteredData.length) {
        document.getElementById('today-count').textContent = '0';
        document.getElementById('last-status').textContent = 'NO DATA';
        document.getElementById('status-distribution').innerHTML = `
            <div class="text-muted">No data available for today</div>
        `;
        return;
    }

    try {
        // Header dengan informasi lengkap termasuk yang tidak ditampilkan di tabel
        const headers = [
            'Timestamp', 
            'Distance (cm)', 
            'Fill Level (%)', 
            'Status',
            'Battery (V)',
            'Power Source',  // Ditambahkan
            'Device'        // Ditambahkan
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
                item.powerSource || 'Unknown',  // Ditambahkan
                item.device || 'Unknown'       // Ditambahkan
            ];
            csvRows.push(row.join(','));
        });

        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `trash_monitoring_${new Date().toISOString().slice(0, 10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (error) {
        console.error('Error exporting to CSV:', error);
        showAlert('Failed to export data', 'danger');
    }
}

// Show loading indicator
function showLoading(show) {
    const loader = document.getElementById('loading-indicator');
    if (loader) {
        loader.style.display = show ? 'block' : 'none';
    }
}

// Show error message
function showError(message) {
    showAlert(message, 'danger');
}

// Show alert message
function showAlert(message, type = 'info') {
    const alertContainer = document.getElementById('alert-container');
    if (!alertContainer) return;
    
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    alertContainer.prepend(alertDiv);
    
    setTimeout(() => {
        alertDiv.classList.remove('show');
        setTimeout(() => alertDiv.remove(), 150);
    }, 5000);
}

// Event Listeners
filterForm.addEventListener('submit', e => {
    e.preventDefault();
    filterData();
});

filterForm.addEventListener('reset', () => {
    setTimeout(() => {
        searchInput.value = '';
        statusFilter.value = '';
        dateRangeInput._flatpickr.clear();
        filterData();
    }, 0);
});

prevPageBtn.addEventListener('click', e => {
    e.preventDefault();
    if (currentPage > 1) {
        currentPage--;
        renderTableRows(filteredData, currentPage);
        updatePagination(filteredData);
    }
});

nextPageBtn.addEventListener('click', e => {
    e.preventDefault();
    const totalPages = Math.ceil(filteredData.length / rowsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        renderTableRows(filteredData, currentPage);
        updatePagination(filteredData);
    }
});

refreshBtn.addEventListener('click', fetchData);
exportBtn.addEventListener('click', exportToCSV);

// Fungsi untuk mengirim data ke server
async function sendDataToServer(distance, status, notes = '') {
    try {
        const response = await fetch('/api/trash-data', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                distance,
                status,
                notes
            })
        });

        const result = await response.json();
        if (result.success) {
            const fillLevel = calculateFillLevel(distance);
            let message = `📤 <b>Data Baru Dikirim</b> 📤\n`;
            message += `Status: ${status}\n`;
            message += `Jarak: ${distance.toFixed(1)} cm\n`;
            message += `Level: ${fillLevel}%\n`;
            message += `Catatan: ${notes || '-'}`;
            
            await sendTelegramNotification(message);
        } else {
            console.error('Failed to send data to server');
        }
    } catch (error) {
        console.error('Error sending data:', error);
    }
}

// Add this near your other DOM element declarations
const pauseBtn = document.getElementById("pauseBtn");
const resumeBtn = document.getElementById("resumeBtn");

// Update checkPauseStatus function
async function checkPauseStatus() {
  try {
    const res = await fetch(`/api/get-pause-status?device=${ACTIVE_DEVICE}`);
    
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
    showAlert("Failed to check pause status", "danger");
  }
}

const telegramUsers = [
  {
    chatId: '5080707943',
    name: 'Fatony Ahmad Fauzi'
  },
  {
    chatId: '5869060700',
    name: 'Ahmad Rifai'
  }
];

// Ambil status per user dari Firebase
async function fetchTelegramUserStatuses() {
  try {
    const container = document.getElementById('telegram-users');
    container.innerHTML = '<div>Loading...</div>';

    const endpoint = ACTIVE_DEVICE === 'device1'
      ? '/api/telegram-users-status/device1'
      : '/api/telegram-users-status/device2';

    const response = await fetch(endpoint); // `endpoint` sudah mengandung /api/...
    const results = await response.json();

    if (!response.ok) {
      throw new Error(results.error || 'Failed to fetch user statuses');
    }

    container.innerHTML = '';
    results.forEach((user) => {
      const div = document.createElement('div');
      div.className = 'user-info';
      div.innerHTML = `
        <span class="user-name">${user.name}</span>
        <span class="badge ${user.isPaused ? 'bg-danger' : 'bg-success'} user-status">
          ${user.isPaused ? 'PAUSED' : 'ACTIVE'}
        </span>
      `;
      container.appendChild(div);
    });
  } catch (err) {
    console.error('Gagal ambil status telegram user:', err);
    document.getElementById('telegram-users').innerHTML = 
      '<div class="text-danger">Failed to load status</div>';
  }
}

async function sendDiscordNotification(message, device = 'device1') {
  try {
    const res = await fetch(`/api/discord-notify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message, device })
    });

    const result = await res.json();
    return result.success;
  } catch (error) {
    console.error('Discord error:', error.message);
    return false;
  }
}

// Update your DOMContentLoaded event listener
document.addEventListener('DOMContentLoaded', () => {
  initChart();
  setTimeout(() => {
    fetchData();
    checkPauseStatus();
    fetchTelegramUserStatuses();

    const notificationMessage = '🌐 <b>Aplikasi Monitoring Dibuka</b> 🌐\nDashboard monitoring tempat sampah telah diakses';
    const discordMessage = notificationMessage.replace(/<b>/g, '**').replace(/<\/b>/g, '**');

    sendTelegramNotification(notificationMessage, ACTIVE_DEVICE);
    sendDiscordNotification(discordMessage, ACTIVE_DEVICE);
    
  }, 200);

  setInterval(fetchData, 30000);
  setInterval(checkPauseStatus, 10000);
  fetchTelegramUserStatuses();
  setInterval(fetchTelegramUserStatuses, 30000);
});

// Pada pauseBtn
pauseBtn.addEventListener("click", async () => {
  if (!confirm(`Pause pengiriman data dan notifikasi untuk ${ACTIVE_DEVICE}?`)) return;
  
  try {
    showLoading(true);
    const res = await fetch(`/api/set-pause-status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        pause: true,
        device: ACTIVE_DEVICE 
      })
    });
    
    const result = await res.json();
    
    if (result.success) {
      showAlert(`Data dan notifikasi untuk ${ACTIVE_DEVICE} berhasil dipause`, "success");
      await checkPauseStatus();
      updateSummaryCards();
    } else {
      showAlert(`Gagal mempause ${ACTIVE_DEVICE}: ` + (result.error || "Unknown error"), "danger");
    }
  } catch (error) {
    console.error("Error:", error);
    showAlert(`Terjadi kesalahan saat mempause ${ACTIVE_DEVICE}`, "danger");
  } finally {
    showLoading(false);
  }
});

// Pada resumeBtn
resumeBtn.addEventListener("click", async () => {
  const now = new Date();
  const lastDataTime = new Date(latestRecord.timestamp || 0);
  const timeDifference = (now.getTime() - lastDataTime.getTime()) / 1000;

  if (timeDifference > 120) {
    const deviceName = ACTIVE_DEVICE.toUpperCase();
    const offlineMessage = `⚠️ Perintah Gagal: Perangkat ${deviceName} sedang OFFLINE.`;

    showAlert(offlineMessage, 'warning');

    // --- BAGIAN YANG DIPERBAIKI ---
    // Mengganti emoji ⚠️ dengan ❗️
    const notificationMessage = `❗️ **Peringatan Sistem** ❗️\nAdmin mencoba me-resume perangkat ${deviceName} yang terdeteksi sedang offline.`;
    
    // Memastikan kedua fungsi notifikasi dipanggil dengan DUA argumen
    sendTelegramNotification(notificationMessage.replace(/\*\*/g, '<b>'), ACTIVE_DEVICE);
    sendDiscordNotification(notificationMessage, ACTIVE_DEVICE);
    
    console.warn(offlineMessage);
    return;
  }

  // Logika resume jika perangkat online (tidak perlu diubah)
  try {
    showLoading(true);
    const res = await fetch(`/api/set-pause-status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        pause: false,
        device: ACTIVE_DEVICE 
      })
    });
    
    const result = await res.json();
    
    if (result.success) {
      showAlert(`Data dan notifikasi untuk ${ACTIVE_DEVICE} berhasil dilanjutkan`, "success");
      await checkPauseStatus();
      updateSummaryCards();
    } else {
      showAlert(`Gagal melanjutkan ${ACTIVE_DEVICE}: ` + (result.error || "Unknown error"), "danger");
    }
  } catch (error) {
    console.error("Error:", error);
    showAlert(`Terjadi kesalahan saat melanjutkan ${ACTIVE_DEVICE}`, "danger");
  } finally {
    showLoading(false);
  }
});

document.getElementById('delete-all-btn').addEventListener('click', async () => {
  if (!confirm("Yakin ingin menghapus SEMUA data di Firebase? Tindakan ini tidak dapat dibatalkan!")) return;

  try {
    showLoading(true);
    const res = await fetch(`/api/delete-all-data?device=${ACTIVE_DEVICE}`, { 
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Gagal menghapus data');
    }

    showAlert("✅ Semua data berhasil dihapus. Notifikasi telah dikirim ke Telegram & Discord.", "success");
    
    // Reset UI
    allData = [];
    filteredData = [];
    renderTableRows([], 1);
    updatePagination([]);
    updateChart([]);
    updateSummaryCards();

  } catch (err) {
    console.error("Error deleting all data:", err);
    showAlert(`❌ Gagal menghapus data: ${err.message}`, "danger");
  } finally {
    showLoading(false);
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const toggleBtn = document.getElementById('sidebarToggle');
  const sidebar = document.getElementById('sidebar');
  
  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const isExpanded = toggleBtn.getAttribute('aria-expanded') === 'true';
      toggleBtn.setAttribute('aria-expanded', !isExpanded);
      
      sidebar.classList.toggle('active');
      
      // Tambahkan overlay di mobile
      if (window.innerWidth <= 768) {
        const overlay = document.createElement('div');
        overlay.id = 'sidebar-overlay';
        overlay.style.position = 'fixed';
        overlay.style.top = '56px'; // Sesuaikan dengan tinggi navbar
        overlay.style.left = '0';
        overlay.style.right = '0';
        overlay.style.bottom = '0';
        overlay.style.backgroundColor = 'rgba(0,0,0,0.5)';
        overlay.style.zIndex = '999';
        overlay.addEventListener('click', () => {
          sidebar.classList.remove('active');
          overlay.remove();
        });
        
        if (sidebar.classList.contains('active')) {
          document.body.appendChild(overlay);
        } else {
          const existingOverlay = document.getElementById('sidebar-overlay');
          if (existingOverlay) existingOverlay.remove();
        }
      }
    });
    
    // Tutup sidebar saat resize ke desktop
    window.addEventListener('resize', () => {
      if (window.innerWidth >= 768) {
        sidebar.classList.remove('active');
        const overlay = document.getElementById('sidebar-overlay');
        if (overlay) overlay.remove();
      }
    });
  }

  // Kode yang sudah ada...
  const path = window.location.pathname;
  document.querySelectorAll('.device-link').forEach(link => {
    if (path.includes(link.getAttribute('href'))) {
      link.classList.add('active');
    }
  });
});

document.getElementById("currentYear").textContent = new Date().getFullYear();