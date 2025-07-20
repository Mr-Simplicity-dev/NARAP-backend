// Global state 
window.appState = {
    members: [],
    certificates: [],
    isAuthenticated: false
};


// Make sure this matches your server port
const backendUrl = window.location.origin.includes('localhost')
    ? 'http://localhost:3000'
    : window.location.origin;


    // Add after backendUrl declaration
function fetchWithTimeout(url, options = {}, timeout = 10000) {
    return new Promise((resolve, reject) => {
        const controller = new AbortController();
        options.signal = controller.signal;
        
        const timeoutId = setTimeout(() => {
            controller.abort();
            reject(new DOMException("Request timed out", "AbortError"));
        }, timeout);

        fetch(url, options)
            .then(response => {
                clearTimeout(timeoutId);
                resolve(response);
            })
            .catch(error => {
                clearTimeout(timeoutId);
                reject(error);
            });
    });
}

// Add this to verify the URL is correct
console.log('Admin panel initialized with backend URL:', backendUrl);

// Add this helper function for date formatting
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Invalid Date';
        
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } catch (error) {
        return 'Invalid Date';
    }
}



let selectedMembers = new Set();
let currentMembers = [];
let currentCertificates = [];

// Add these pagination variables near the top of your file
let currentPage = 1;
let membersPerPage = 25;
let totalMembers = 0;
let allMembers = []; // Store all members
let filteredMembers = []; // Store filtered members
let currentSearchTerm = '';


class NotificationManager {
    constructor() {
        this.container = null;
        this.createContainer();
    }
    
    createContainer() {
        try {
            // Wait for DOM to be ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.createContainer());
                return;
            }
            
            // Remove existing container if any
            const existing = document.getElementById('notification-container');
            if (existing) {
                existing.remove();
            }
            
// Debug missing functions
['loadTheme', 'fillAdminCredentials', 'switchTab'].forEach(fn => {
    if (typeof window[fn] !== 'function') {
        console.warn(`[NARAP] Required function "${fn}" is not defined.`);
    }
});
            // Create new container
            this.container = document.createElement('div');
            this.container.id = 'notification-container';
            this.container.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                pointer-events: none;
            `;
            
            // Safely append to body
            const body = document.body || document.getElementsByTagName('body')[0];
            if (body) {
                body.appendChild(this.container);
            } else {
                console.warn('Document body not available for notifications');
            }
        } catch (error) {
            console.error('Error creating notification container:', error);
        }
    }
    
    show(message, type = 'info', duration = 5000) {
        try {
            if (!this.container) {
                this.createContainer();
            }
            
            if (!this.container) {
                console.log(`${type.toUpperCase()}: ${message}`);
                return;
            }
            
            const notification = document.createElement('div');
            notification.style.cssText = `
                background: ${this.getBackgroundColor(type)};
                color: white;
                padding: 12px 20px;
                margin-bottom: 10px;
                border-radius: 4px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                pointer-events: auto;
                opacity: 0;
                transform: translateX(100%);
                transition: all 0.3s ease;
                max-width: 300px;
                word-wrap: break-word;
            `;
            notification.textContent = message;
            
            this.container.appendChild(notification);
            
            // Animate in
            setTimeout(() => {
                notification.style.opacity = '1';
                notification.style.transform = 'translateX(0)';
            }, 10);
            
            // Auto remove
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.style.opacity = '0';
                    notification.style.transform = 'translateX(100%)';
                    setTimeout(() => {
                        if (notification.parentNode) {
                            notification.remove();
                        }
                    }, 300);
                }
            }, duration);
            
        } catch (error) {
            console.error('Error showing notification:', error);
            console.log(`${type.toUpperCase()}: ${message}`);
        }
    }
    
    getBackgroundColor(type) {
        const colors = {
            success: '#28a745',
            error: '#dc3545',
            warning: '#ffc107',
            info: '#17a2b8'
        };
        return colors[type] || colors.info;
    }
}

function initializeNotificationManager() {
    // no-op
}

// Local storage keys
const LOCAL_MEMBERS_KEY = 'narap_local_members';
const LOCAL_CERTIFICATES_KEY = 'narap_local_certificates';
const PENDING_SYNC_KEY = 'narap_pending_sync';

// Local storage functions
function getLocalMembers() {
    try {
        const stored = localStorage.getItem(LOCAL_MEMBERS_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch (error) {
        console.error('Failed to get local members:', error);
        return [];
    }
}

function saveLocalMembers(members) {
    try {
        localStorage.setItem(LOCAL_MEMBERS_KEY, JSON.stringify(members));
    } catch (error) {
        console.error('Failed to save local members:', error);
    }
}

function getLocalCertificates() {
    try {
        const stored = localStorage.getItem(LOCAL_CERTIFICATES_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch (error) {
        console.error('Failed to get local certificates:', error);
        return [];
    }
}

function saveLocalCertificates(certificates) {
    try {
        localStorage.setItem(LOCAL_CERTIFICATES_KEY, JSON.stringify(certificates));
    } catch (error) {
        console.error('Failed to save local certificates:', error);
    }
}

function getPendingSync() {
    const defaultSync = {
        members: [],
        certificates: [],
        certificateUpdates: []
    };
    
    try {
        const stored = localStorage.getItem(PENDING_SYNC_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            return {
                members: parsed.members || [],
                certificates: parsed.certificates || [],
                certificateUpdates: parsed.certificateUpdates || []
            };
        }
    } catch (error) {
        console.error('Failed to parse pending sync data:', error);
    }
    
    return defaultSync;
}

function savePendingSync(syncData) {
    try {
        localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(syncData));
    } catch (error) {
        console.error('Failed to save pending sync data:', error);
    }
}

function generateLocalId() {
    return 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Toggle password visibility function
function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    const toggle = input.nextElementSibling;
    
    if (input.type === 'password') {
        input.type = 'text';
        toggle.textContent = 'Hide';
    } else {
        input.type = 'password';
        toggle.textContent = 'Show';
    }
}

// Auto-fill admin credentials function
function fillAdminCredentials() {
    document.getElementById('username').value = 'Admin@gmail.com';
    document.getElementById('password').value = 'Password';
}

// Clear login form
function clearLoginForm() {
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    document.getElementById('loginError').innerHTML = '';
}


// Enhanced showMessage function using notification manager
function showMessage(message, type = 'success') {
    console.log(`Message (${type}):`, message);
    
    // Use notification manager
    try {
        notificationManager.show(message, type);
    } catch (error) {
        console.error('Notification manager error:', error);
        // Fallback to basic message display
        fallbackShowMessage(message, type);
    }
    
    // Also update the legacy messages div if it exists
    const messagesDiv = document.getElementById('messages');
    if (messagesDiv) {
        messagesDiv.innerHTML = `<div class="${type}" style="padding: 10px; margin: 10px 0; border-radius: 4px; ${getMessageStyle(type)}">${message}</div>`;
        setTimeout(() => messagesDiv.innerHTML = '', 5000);
    }
}


function getMessageStyle(type) {
    switch(type) {
        case 'success':
            return 'background: #d4edda; color: #155724; border: 1px solid #c3e6cb;';
        case 'error':
            return 'background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb;';
        case 'warning':
            return 'background: #fff3cd; color: #856404; border: 1px solid #ffeaa7;';
        case 'info':
            return 'background: #d1ecf1; color: #0c5460; border: 1px solid #bee5eb;';
        default:
            return 'background: #f8f9fa; color: #333; border: 1px solid #dee2e6;';
    }
}

// Update your getAuthHeaders function
function getAuthHeaders() {
    const token = localStorage.getItem('authToken');
    return {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
    };
}

// Corrected login function
async function login(event) {
    if (event) event.preventDefault();
    
    const email = document.getElementById('username').value.trim(); // Changed from username to email for clarity
    const password = document.getElementById('password').value;
    const loginError = document.getElementById('loginError');
    
    loginError.innerHTML = '';
    
    if (!email || !password) {
        loginError.innerHTML = '<div class="error">Please enter both email and password</div>';
        return;
    }
    
    try {
        showMessage('Logging in...', 'info');
        
        // Add timeout handling
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch(`${backendUrl}/api/login`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                ...getAuthHeaders() // Preserve any existing auth headers
            },
            credentials: 'include',
            body: JSON.stringify({ email, password }),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId); // Clear timeout if request completes
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            // Store authentication (improved storage naming)
            localStorage.setItem('narap_token', data.token);
            localStorage.setItem('narap_user', JSON.stringify(data.user));
            
            showMessage('Login successful!', 'success');
            
            // UI transition
            document.getElementById('loginSection').style.display = 'none';
            document.getElementById('adminPanel').style.display = 'block';
            
            // Load critical data
            await Promise.all([
                loadDashboard(),
                loadUsers(), // Replaces loadMembers()
                loadCertificates()
            ]);
            
            // Clear cache and initialize
            dataCache.clear();
            initializeDashboard();
            
        } else {
            throw new Error(data.message || 'Login failed');
        }
        
    } catch (error) {
        console.error('Login error:', error);
        
        let errorMessage = 'Login failed. Please try again.';
        if (error.name === 'AbortError') {
            errorMessage = 'Request timed out. Please check your connection.';
        } else if (error.message.includes('HTTP')) {
            errorMessage = error.message;
        }
        
        loginError.innerHTML = `<div class="error">${errorMessage}</div>`;
        showMessage(errorMessage, 'error');
    }
}


// Logout function
function logout() {
    //Clear authentication data
    localStorage.removeItem('narap_token');
    localStorage.removeItem('narap_us');

    //Clear cached data
    localStorage.removeItem('narap_members');
     localStorage.removeItem('narap_certificates');
     dataCache.clear();

    //Reset global variables
    currentMembers = [];
    currentCertificates = [];
    
    document.getElementById('loginSection').style.display = 'block';
    document.getElementById('adminPanel').style.display = 'none';

     //Clear any forms
     const forms = document.querySelectorAll('form');
     forms.forEach(form => form.reset());
     showMessage('Logged out successfully', 'info');

}

// Add this to ensure everything is properly initialized
document.addEventListener('DOMContentLoaded', function() {
    // Initialize certificates when switching to certificates tab
    const certificatesTab = document.getElementById('btn-certificates');
    if (certificatesTab) {
        certificatesTab.addEventListener('click', function() {
            setTimeout(() => {
                loadCertificates();
            }, 100);
        });
    }
});

// Tab switching functionality
function switchTab(tabName) {
    // Hide all panels
    const panels = document.querySelectorAll('.panel');
    panels.forEach(panel => {
        panel.classList.remove('active');
        panel.style.display = 'none';
    });
    
    // Remove active class from all nav items
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.classList.remove('active');
    });
    
    // Show selected panel
    const selectedPanel = document.getElementById(`panel-${tabName}`);
    if (selectedPanel) {
        selectedPanel.classList.add('active');
        selectedPanel.style.display = 'block';
    }
    
    // Add active class to selected nav item
    const selectedNavItem = document.getElementById(`btn-${tabName}`);
    if (selectedNavItem) {
        selectedNavItem.classList.add('active');
    }
    
    // Update header title
    const headerTitle = document.getElementById('headerTitle');
    if (headerTitle) {
        headerTitle.textContent = tabName.charAt(0).toUpperCase() + tabName.slice(1);
    }
    
    // Close sidebar on mobile after tab switch
    if (window.innerWidth <= 768) {
        closeSidebar();
    }
    
    // Load data based on selected tab
    if (tabName === 'certificates') {
        loadCertificates();
    } else if (tabName === 'members') {
        // Load first page of members with current settings
        loadUsers(1, membersPerPage, currentSearchTerm || '');
    }
}


// Initialize dashboard on page load
document.addEventListener('DOMContentLoaded', function() {
    // Ensure only dashboard is visible initially
    switchTab('dashboard');
});


// Load dashboard data
async function loadDashboard() {
    try {
        console.log('Loading dashboard...');
        showMessage('Loading dashboard...', 'info');
        
        // Load data with timeout protection
        const [members, certificates] = await Promise.all([
            getMembers(),
            getCertificates()
        ]);
        
        // Update statistics
        const totalMembersEl = document.getElementById('totalMembers');
        const totalCertificatesEl = document.getElementById('totalCertificates');
        const newThisMonthEl = document.getElementById('newThisMonth');
        const systemUptimeEl = document.getElementById('systemUptime');
        
        if (totalMembersEl) totalMembersEl.textContent = members.length;
        if (totalCertificatesEl) totalCertificatesEl.textContent = certificates.length;
        
        // Calculate new members this month
        const thisMonth = new Date().getMonth();
        const thisYear = new Date().getFullYear();
        const newThisMonth = members.filter(member => {
            if (!member.createdAt && !member.dateAdded) return false;
            const memberDate = new Date(member.createdAt || member.dateAdded);
            return memberDate.getMonth() === thisMonth && memberDate.getFullYear() === thisYear;
        }).length;
        
        if (newThisMonthEl) newThisMonthEl.textContent = newThisMonth;
        
        // Calculate system uptime (placeholder)
        if (systemUptimeEl) {
            systemUptimeEl.textContent = Math.floor(Date.now() / (1000 * 60 * 60 * 24)) + 'd';
        }
        
        // Load recent activity
        try {
            loadRecentActivity(members, certificates);
        } catch (activityError) {
            console.error('Failed to load recent activity:', activityError);
            // Don't fail the entire dashboard for this
        }
        
        // Display members and certificates in their respective tables
        displayMembers(members);
        if (typeof displayCertificates === 'function') {
            displayCertificates(certificates);
        }
        
        console.log('✅ Dashboard loaded successfully');
        showMessage('Dashboard loaded successfully!', 'success');
        
    } catch (error) {
        console.error('❌ Dashboard load error:', error);
        
        let errorMessage = 'Failed to load dashboard data';
        
        if (error.name === 'AbortError') {
            errorMessage = 'Dashboard load timed out. Please try again.';
        } else if (error.message.includes('getMembers')) {
            errorMessage = 'Failed to load members data';
        } else if (error.message.includes('getCertificates')) {
            errorMessage = 'Failed to load certificates data';
        } else if (error.message) {
            errorMessage += ': ' + error.message;
        }
        
        showMessage(errorMessage, 'error');
        
        // Try to load partial data if possible
        try {
            console.log('Attempting to load partial dashboard data...');
            
            // Try to load members only
            const members = await getMembers();
            if (members.length > 0) {
                const totalMembersEl = document.getElementById('totalMembers');
                if (totalMembersEl) totalMembersEl.textContent = members.length;
                displayMembers(members);
                showMessage('Partial dashboard loaded (members only)', 'warning');
            }
        } catch (partialError) {
            console.error('Failed to load partial dashboard:', partialError);
            showMessage('Complete dashboard load failed', 'error');
        }
    }
}


// Recent activity function
function loadRecentActivity(members = [], certificates = []) {
    try {
        const activityDiv = document.getElementById('recentActivity');
        if (!activityDiv) {
            console.log('Recent activity element not found');
            return;
        }
        
        // Show loading state
        activityDiv.innerHTML = `
            <div class="activity-loading" style="padding: 20px; text-align: center; color: #666;">
                <i class="fas fa-spinner fa-spin" style="margin-right: 8px;"></i>
                Loading recent activity...
            </div>
        `;
        
        const activities = [];
        
        // Add recent members (last 3) with error handling
        try {
            const recentMembers = members
                .filter(m => m && (m.createdAt || m.dateAdded))
                .sort((a, b) => {
                    const dateA = new Date(a.createdAt || a.dateAdded);
                    const dateB = new Date(b.createdAt || b.dateAdded);
                    return dateB - dateA;
                })
                .slice(0, 3);
            
            recentMembers.forEach(member => {
                if (member && member.name) {
                    activities.push({
                        icon: 'fas fa-user-plus',
                        text: `New member registered: ${member.name}`,
                        time: formatTimeAgo(member.createdAt || member.dateAdded),
                        type: 'member',
                        date: new Date(member.createdAt || member.dateAdded),
                        details: `Code: ${member.code || 'N/A'}, State: ${member.state || 'N/A'}`
                    });
                }
            });
        } catch (memberError) {
            console.error('Error processing recent members:', memberError);
        }
        
        // Add recent certificates (last 2) with error handling
        try {
            const recentCertificates = certificates
                .filter(c => c && (c.createdAt || c.issueDate))
                .sort((a, b) => {
                    const dateA = new Date(a.createdAt || a.issueDate);
                    const dateB = new Date(b.createdAt || b.issueDate);
                    return dateB - dateA;
                })
                .slice(0, 2);
            
            recentCertificates.forEach(cert => {
                if (cert && cert.recipient) {
                    activities.push({
                        icon: 'fas fa-certificate',
                        text: `Certificate issued to: ${cert.recipient}`,
                        time: formatTimeAgo(cert.createdAt || cert.issueDate),
                        type: 'certificate',
                        date: new Date(cert.createdAt || cert.issueDate),
                        details: `Number: ${cert.number || 'N/A'}, Title: ${cert.title || 'N/A'}`
                    });
                }
            });
        } catch (certError) {
            console.error('Error processing recent certificates:', certError);
        }
        
        // Sort all activities by date (most recent first)
        activities.sort((a, b) => b.date - a.date);
        
        // Display activities or empty state
        if (activities.length === 0) {
            activityDiv.innerHTML = `
                <div class="activity-item" style="padding: 20px; text-align: center; color: #666;">
                    <i class="fas fa-info-circle" style="margin-right: 8px; font-size: 18px; color: #ccc;"></i>
                    <div style="margin-top: 8px;">No recent activity found</div>
                    <div style="font-size: 12px; color: #999; margin-top: 4px;">
                        Activity will appear here when members register or certificates are issued
                    </div>
                </div>
            `;
            return;
        }
        
        // Render activities with improved styling
        activityDiv.innerHTML = activities.map(activity => `
            <div class="activity-item" style="
                padding: 12px 20px; 
                border-bottom: 1px solid #eee; 
                display: flex; 
                align-items: center; 
                gap: 12px;
                transition: background-color 0.2s ease;
                cursor: pointer;
            " 
            onmouseover="this.style.backgroundColor='#f8f9fa'" 
            onmouseout="this.style.backgroundColor='transparent'"
            title="${activity.details}">
                <div class="activity-icon" style="
                    width: 32px; 
                    height: 32px; 
                    border-radius: 50%; 
                    display: flex; 
                    align-items: center; 
                    justify-content: center; 
                    ${activity.type === 'member' ? 
                        'background: #e3f2fd; color: #1976d2;' : 
                        'background: #fff3e0; color: #f57c00;'
                    }
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                ">
                    <i class="${activity.icon}" style="font-size: 14px;"></i>
                </div>
                <div class="activity-content" style="flex: 1; min-width: 0;">
                    <div class="activity-text" style="
                        font-size: 14px; 
                        color: #333; 
                        margin-bottom: 2px;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    ">${activity.text}</div>
                    <div class="activity-time" style="
                        font-size: 12px; 
                        color: #666;
                        display: flex;
                        align-items: center;
                        gap: 4px;
                    ">
                        <i class="fas fa-clock" style="font-size: 10px;"></i>
                        ${activity.time}
                    </div>
                </div>
                <div class="activity-badge" style="
                    padding: 2px 8px;
                    border-radius: 12px;
                    font-size: 10px;
                    font-weight: bold;
                    text-transform: uppercase;
                    ${activity.type === 'member' ? 
                        'background: #e3f2fd; color: #1976d2;' : 
                        'background: #fff3e0; color: #f57c00;'
                    }
                ">
                    ${activity.type}
                </div>
            </div>
        `).join('');
        
        console.log(`✅ Recent activity loaded: ${activities.length} items`);
        
    } catch (error) {
        console.error('❌ Load recent activity error:', error);
        
        const activityDiv = document.getElementById('recentActivity');
        if (activityDiv) {
            activityDiv.innerHTML = `
                <div class="activity-item" style="padding: 20px; text-align: center; color: #dc3545;">
                    <i class="fas fa-exclamation-triangle" style="margin-right: 8px; font-size: 18px;"></i>
                    <div style="margin-top: 8px;">Failed to load recent activity</div>
                    <div style="font-size: 12px; color: #666; margin-top: 4px;">
                        ${error.message || 'Unknown error occurred'}
                    </div>
                    <button onclick="loadDashboard()" style="
                        margin-top: 10px;
                        padding: 4px 12px;
                        background: #007bff;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        font-size: 12px;
                        cursor: pointer;
                    ">
                        Retry
                    </button>
                </div>
            `;
        }
        
        showMessage('Failed to load recent activity: ' + error.message, 'error');
    }
}


// Helper function to format time ago
function formatTimeAgo(dateString) {
    try {
        if (!dateString) return 'Unknown time';
        
        const date = new Date(dateString);
        
        // Validate date
        if (isNaN(date.getTime())) {
            console.warn('Invalid date string:', dateString);
            return 'Invalid date';
        }
        
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);
        
        // Handle future dates
        if (diffInSeconds < 0) {
            return 'In the future';
        }
        
        // Less than 1 minute
        if (diffInSeconds < 60) return 'Just now';
        
        // Less than 1 hour
        if (diffInSeconds < 3600) {
            const minutes = Math.floor(diffInSeconds / 60);
            return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
        }
        
        // Less than 1 day
        if (diffInSeconds < 86400) {
            const hours = Math.floor(diffInSeconds / 3600);
            return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
        }
        
        // Less than 30 days (1 month)
        if (diffInSeconds < 2592000) {
            const days = Math.floor(diffInSeconds / 86400);
            return `${days} day${days !== 1 ? 's' : ''} ago`;
        }
        
        // More than 30 days - use formatted date
        return formatDate(dateString);
        
    } catch (error) {
        console.error('Error in formatTimeAgo:', error, 'for date:', dateString);
        return 'Unknown time';
    }
}



// ✅ Optional: Add a more detailed date formatter
function formatDateTime(dateString) {
    try {
        if (!dateString) return 'Unknown date/time';
        
        const date = new Date(dateString);
        
        if (isNaN(date.getTime())) {
            return 'Invalid date/time';
        }
        
        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();
        const isYesterday = date.toDateString() === new Date(now.getTime() - 86400000).toDateString();
        
        const timeOptions = {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        };
        
        if (isToday) {
            return `Today at ${date.toLocaleTimeString('en-US', timeOptions)}`;
        } else if (isYesterday) {
            return `Yesterday at ${date.toLocaleTimeString('en-US', timeOptions)}`;
        } else {
            const dateOptions = {
                month: 'short',
                day: 'numeric',
                year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
            };
            
            return `${date.toLocaleDateString('en-US', dateOptions)} at ${date.toLocaleTimeString('en-US', timeOptions)}`;
        }
        
    } catch (error) {
        console.error('Error in formatDateTime:', error, 'for date:', dateString);
        return 'Unknown date/time';
    }
}

// ✅ Optional: Add relative date formatter for longer periods
function formatRelativeDate(dateString) {
    try {
        if (!dateString) return 'Unknown time';
        
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Invalid date';
        
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);
        
        if (diffInSeconds < 0) return 'In the future';
        if (diffInSeconds < 60) return 'Just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
        if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
        if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 604800)} weeks ago`;
        if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)} months ago`;
        
        const years = Math.floor(diffInSeconds / 31536000);
        return `${years} year${years !== 1 ? 's' : ''} ago`;
        
    } catch (error) {
        console.error('Error in formatRelativeDate:', error);
        return 'Unknown time';
    }
}

// Update the loadUsers function to handle the auto-loading better
async function loadUsers(page = 1, limit = membersPerPage, search = '') {
    try {
        console.log('🔄 Loading users...');
        showLoadingState('membersTableBody', 'Loading members...');
        
        // Only fetch from server if we don't have cached data or if it's a refresh
        if (allMembers.length === 0 || search !== currentSearchTerm) {
            const response = await fetch(`${backendUrl}/api/getUsers`, {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const users = await response.json();
            console.log(`✅ Loaded ${users.length} users`);
            
            // Store all users
            allMembers = users;
            
            // Save to localStorage for offline access
            localStorage.setItem('narap_members', JSON.stringify(users));
        }

        // Apply search filter if provided
        currentSearchTerm = search;
        if (search.trim()) {
            filteredMembers = allMembers.filter(member => 
                (member.name?.toLowerCase().includes(search.toLowerCase())) ||
                (member.email?.toLowerCase().includes(search.toLowerCase())) ||
                (member.memberCode?.toLowerCase().includes(search.toLowerCase())) ||
                (member.state?.toLowerCase().includes(search.toLowerCase())) ||
                (member.position?.toLowerCase().includes(search.toLowerCase()))
            );
        } else {
            filteredMembers = [...allMembers];
        }

        totalMembers = filteredMembers.length;
        
        // Calculate pagination
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedMembers = filteredMembers.slice(startIndex, endIndex);
        
        // Update current page state
        currentPage = page;
        membersPerPage = limit;
        currentMembers = paginatedMembers; // Keep your existing global variable
        
        // Update the display using your existing function
        displayMembers(paginatedMembers);
        
        // Update pagination controls
        updatePaginationControls();
        
        // Update members count
        updateMembersCount(startIndex, Math.min(endIndex, totalMembers), totalMembers);

        // Update member count in dashboard if element exists
        const memberCountElement = document.getElementById('totalMembers');
        if (memberCountElement) {
            memberCountElement.textContent = allMembers.length; // Show total, not paginated count
        }

        hideLoadingState('membersTableBody');
        return paginatedMembers;
        
    } catch (error) {
        console.error('❌ Load users error:', error);
        hideLoadingState('membersTableBody');
        
        // Try to load from localStorage as fallback
        const cachedUsers = localStorage.getItem('narap_members');
        if (cachedUsers) {
            try {
                const users = JSON.parse(cachedUsers);
                console.log('📱 Using cached users data');
                
                allMembers = users;
                
                // Apply search and pagination to cached data
                if (search.trim()) {
                    filteredMembers = users.filter(member => 
                        (member.name?.toLowerCase().includes(search.toLowerCase())) ||
                        (member.email?.toLowerCase().includes(search.toLowerCase())) ||
                        (member.memberCode?.toLowerCase().includes(search.toLowerCase())) ||
                        (member.state?.toLowerCase().includes(search.toLowerCase())) ||
                        (member.position?.toLowerCase().includes(search.toLowerCase()))
                    );
                } else {
                    filteredMembers = [...users];
                }
                
                totalMembers = filteredMembers.length;
                const startIndex = (page - 1) * limit;
                const endIndex = startIndex + limit;
                const paginatedMembers = filteredMembers.slice(startIndex, endIndex);
                
                currentMembers = paginatedMembers;
                displayMembers(paginatedMembers);
                updatePaginationControls();
                updateMembersCount(startIndex, Math.min(endIndex, totalMembers), totalMembers);
                
                showMessage('Loaded cached member data (offline mode)', 'warning');
                return paginatedMembers;
            } catch (parseError) {
                console.error('Failed to parse cached users:', parseError);
            }
        }
        
        showMessage('Failed to load members: ' + error.message, 'error');
        return [];
    }
}


// Alias function for loadDashboard compatibility
async function getMembers() {
    return await loadUsers();
}

// Update displayMembers function to handle missing passport photos better
function displayMembers(members) {
    const tbody = document.getElementById('membersTableBody');
    if (!tbody) {
        console.error('Members table body not found');
        return;
    }

    if (!members || members.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px;">No members found</td></tr>';
        return;
    }

    tbody.innerHTML = members.map(member => {
        // Handle passport photo with better fallback
        const passportPhoto = member.passportPhoto || member.passport;
        const photoSrc = passportPhoto && passportPhoto !== 'undefined' 
            ? (passportPhoto.startsWith('data:') ? passportPhoto : `${backendUrl}/${passportPhoto}`)
            : 'images/default-avatar.png';
        
        // Handle optional email
        const email = member.email || 'Not provided';
        
        return `
            <tr>
                <td>
                    <img src="${photoSrc}" 
                         alt="Passport" 
                         style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;"
                         onerror="this.src='images/default-avatar.png'">
                </td>
                <td>${escapeHtml(member.name)}</td>
                <td>${escapeHtml(email)}</td>
                <td>${escapeHtml(member.code)}</td>
                <td>${escapeHtml(member.position || 'MEMBER')}</td>
                <td>${escapeHtml(member.state)}</td>
                <td>${escapeHtml(member.zone)}</td>
                <td>
                    <button onclick="editMember('${member._id}')" class="btn btn-sm btn-primary" title="Edit Member">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="viewIdCard('${member._id}')" class="btn btn-sm btn-info" title="View ID Card">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button onclick="deleteMember('${member._id}')" class="btn btn-sm btn-danger" title="Delete Member">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// Update pagination controls
function updatePaginationControls() {
    const totalPages = Math.ceil(totalMembers / membersPerPage);
    
    // Update button states
    const firstBtn = document.getElementById('firstPage');
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');
    const lastBtn = document.getElementById('lastPage');
    
    if (firstBtn) firstBtn.disabled = currentPage === 1;
    if (prevBtn) prevBtn.disabled = currentPage === 1;
    if (nextBtn) nextBtn.disabled = currentPage === totalPages || totalPages === 0;
    if (lastBtn) lastBtn.disabled = currentPage === totalPages || totalPages === 0;
    
    // Update page numbers
    updatePageNumbers(totalPages);
}

// Update page numbers display
function updatePageNumbers(totalPages) {
    const pageNumbersContainer = document.getElementById('pageNumbers');
    if (!pageNumbersContainer) return;
    
    let pageNumbers = '';
    const maxVisiblePages = 5;
    
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    // Adjust start page if we're near the end
    if (endPage - startPage < maxVisiblePages - 1) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    // Add first page and ellipsis if needed
    if (startPage > 1) {
        pageNumbers += `<span class="page-number" onclick="goToPage(1)">1</span>`;
        if (startPage > 2) {
            pageNumbers += `<span class="page-ellipsis">...</span>`;
        }
    }
    
    // Add visible page numbers
    for (let i = startPage; i <= endPage; i++) {
        const activeClass = i === currentPage ? 'active' : '';
        pageNumbers += `<span class="page-number ${activeClass}" onclick="goToPage(${i})">${i}</span>`;
    }
    
    // Add last page and ellipsis if needed
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            pageNumbers += `<span class="page-ellipsis">...</span>`;
        }
        pageNumbers += `<span class="page-number" onclick="goToPage(${totalPages})">${totalPages}</span>`;
    }
    
    pageNumbersContainer.innerHTML = pageNumbers;
}

// Update members count display
function updateMembersCount(startIndex, endIndex, total) {
    const countElement = document.getElementById('membersCount');
    if (countElement) {
        const showing = Math.min(endIndex, total);
        countElement.textContent = `Showing ${startIndex + 1}-${showing} of ${total} members`;
    }
}

// Navigation functions
// AFTER (corrected)
function goToPage(page) {
    if (page !== currentPage) {
        loadMembers(page, membersPerPage, currentSearchTerm); // ✅
    }
}

function goToFirstPage() {
    goToPage(1);
}

function goToPrevPage() {
    if (currentPage > 1) {
        goToPage(currentPage - 1);
    }
}

function goToNextPage() {
    const totalPages = Math.ceil(totalMembers / membersPerPage);
    if (currentPage < totalPages) {
        goToPage(currentPage + 1);
    }
}

function goToLastPage() {
    const totalPages = Math.ceil(totalMembers / membersPerPage);
    goToPage(totalPages);
}

// Change items per page
function changeItemsPerPage(newLimit) {
    membersPerPage = parseInt(newLimit);
    goToPage(1); // Reset to first page
}

// Search function
function searchMembers(searchTerm) {
    currentPage = 1; // Reset to first page when searching
    loadUsers(1, membersPerPage, searchTerm);
}

// Refresh function
function refreshMembers() {
    allMembers = []; // Clear cache to force refresh
    loadUsers(currentPage, membersPerPage, currentSearchTerm);
}



// 1. Add this state management at the top of your file
const appState = {
    members: [],
    isInitialized: false
};

// 2. Modified loadMembers() with automatic loading support
async function loadMembers() {
    const tableBody = document.getElementById('membersTableBody');
    
    if (!tableBody) {
        console.error('Members table body not found');
        return [];
    }
    
    try {
        // Show loading state with improved message
        showMessage('Loading members...', 'info');
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="loading">
                    <div class="spinner"></div>
                    Loading members...
                </td>
            </tr>
        `;
        
        // Load members with authentication
        const members = await fetchMembers();
        appState.members = members; // Store in global state
        currentMembers = members; // Also store in currentMembers for compatibility
        
        // Use the new renderMembersTable function (without tableBody parameter)
        renderMembersTable(members);
        
        showMessage(`Loaded ${members.length} members successfully`, 'success');
        return members;
        
    } catch (error) {
        console.error('Load members error:', error);
        showMessage('Failed to load members', 'error');
        
        // Show empty table on error using the new function
        renderMembersTable([]);
        
        // Also handle load error with your existing function
        handleLoadError(tableBody, error);
        throw error; // Propagate the error
    }
}


// 3. New helper functions
async function fetchMembers() {
    try {
        // Use backendUrl if defined, otherwise use relative path
        const url = typeof backendUrl !== 'undefined' ? `${backendUrl}/api/members` : '/api/members';
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch members: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Fetched members:', data);
        
        // Return the members array
        return data.members || data || [];
        
    } catch (error) {
        console.error('Error fetching members:', error);
        throw error;
    }
}






function renderMembersTable(members) {
    console.log('Rendering members table with', members.length, 'members');
    
    const tableBody = document.getElementById('membersTableBody');
    if (!tableBody) {
        console.error('Members table body not found');
        return;
    }
    
    // Clear existing content
    tableBody.innerHTML = '';
    
    if (!members || members.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px; color: #666;">
                    <i class="fas fa-users" style="font-size: 48px; margin-bottom: 15px; opacity: 0.3;"></i>
                    <div>No members found</div>
                    <div style="font-size: 14px; margin-top: 10px;">Add your first member to get started</div>
                </td>
            </tr>
        `;
        return;
    }
    
    // Render each member
    members.forEach((member, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <input type="checkbox" class="member-checkbox" data-member-id="${member._id || member.id}">
            </td>
            <td>${escapeHtml(member.name || 'N/A')}</td>
            <td>${escapeHtml(member.email || 'N/A')}</td>
            <td>${escapeHtml(member.code || 'N/A')}</td>
            <td>${escapeHtml(member.state || 'N/A')}</td>
            <td>
                <div class="btn-group" role="group">
                    <button class="btn btn-sm btn-info view-member-btn" 
                            data-member-id="${member._id || member.id}"
                            title="View Member">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-warning edit-member-btn" 
                            data-member-id="${member._id || member.id}"
                            title="Edit Member">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger delete-member-btn" 
                            data-member-id="${member._id || member.id}"
                            title="Delete Member">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tableBody.appendChild(row);
    });
    
    // Setup event delegation for the newly created elements
    setupEventDelegation();
    
    // Update member count
    updateMemberCount(members.length);
}

// Helper function to update member count display
function updateMemberCount(count) {
    const countElement = document.getElementById('memberCount');
    if (countElement) {
        countElement.textContent = count;
    }
}


function handleLoadError(tableBody, error) {
    console.error('Load error:', error);
    tableBody.innerHTML = `
        <tr>
            <td colspan="7" class="error">
                Failed to load members. ${error.message}
            </td>
        </tr>
    `;
    showMessage('Failed to load members', 'error');
}

// 4. Automatic loading after login (integrate with your login function)
async function handleLoginSuccess() {
    // ... your existing login success code ...
    
    // Add these lines:
    document.getElementById('adminSection').style.display = 'block';
    await loadMembers(); // This will now automatically load and render
    
    // Initialize other components
    if (typeof loadRecentActivity === 'function') {
        loadRecentActivity(appState.members);
    }
}

// 5. Page load initialization
async function loadMembers() {
    const tableBody = document.getElementById('membersTableBody');

    if (!tableBody) {
        console.error('Members table body not found');
        return [];
    }

    try {
        // Show loading spinner
        showMessage('Loading members...', 'info');
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="loading">
                    <div class="spinner"></div>
                    Loading members...
                </td>
            </tr>
        `;

        // Immediately fetch members after login
        const members = await fetchMembers();

        // Update global state
        appState.members = members;
        allMembers = members;
        filteredMembers = [...members];
        totalMembers = members.length;
        currentPage = 1;

        // Paginate members immediately
        const paginatedMembers = members.slice(0, membersPerPage);
        currentMembers = paginatedMembers;

        // Render table immediately
        renderMembersTable(paginatedMembers);

        // Immediately display pagination and members count
        updatePaginationControls();
        updateMembersCount(0, Math.min(membersPerPage, totalMembers), totalMembers);

        // Log passport loading for debugging
        paginatedMembers.forEach(member => {
            console.log('Passport loaded for:', member.name, member.passportPhoto || member.passport);
        });

        showMessage(`Loaded ${members.length} members successfully`, 'success');
        return paginatedMembers;

    } catch (error) {
        console.error('Load members error:', error);
        showMessage('Failed to load members', 'error');

        // Clear table on error
        renderMembersTable([]);

        // Existing error handler
        handleLoadError(tableBody, error);

        throw error;
    }
}


// Add this pagination initialization function right after your DOMContentLoaded
function initializePagination() {
    console.log('🔧 Setting up pagination...');
    
    // Items per page change
    const perPageSelect = document.getElementById('membersPerPage');
    if (perPageSelect) {
        perPageSelect.addEventListener('change', function() {
            console.log('📄 Changing items per page to:', this.value);
            changeItemsPerPage(this.value);
        });
    }
    
    // Search functionality
    const searchInput = document.getElementById('memberSearch');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(function() {
            console.log('🔍 Searching members:', this.value);
            searchMembers(this.value);
        }, 300));
    }
    
    console.log('✅ Pagination initialized');
}




// Improved error handling for images
function handleImageError(img) {
    img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiNFNUU3RUIiLz4KPHBhdGggZD0iTTEyIDEyQzE0LjIwOTEgMTIgMTYgMTAuMjA5MSAxNiA4QzE2IDUuNzkwODYgMTQuMjA5MSA0IDEyIDRDOS43OTA4NiA0IDggNS43OTA4NiA4IDhDOCAxMC4yMDkxIDkuNzkwODYgMTIgMTIgMTJaIiBmaWxsPSIjOUM5Qzk3Ii8+CjxwYXRoIGQ9Ik0xMiAxNEM5LjMzIDEzLjk5IDcuMDEgMTUuNzMgNiAxOC4yNEM1Ljk5IDE4LjQ0IDYuMTEgMTguNjMgNi4yOSAxOC43MkM2LjY3IDE4Ljk2IDcuMDggMTkuMTYgNy41IDE5LjMxQzguOTIgMTkuODYgMTAuNDQgMjAgMTIgMjBDMTMuNTYgMjAgMTUuMDggMTkuODYgMTYuNSAxOS4zMUMxNi45MiAxOS4xNiAxNy4zMyAxOC45NiAxNy43MSAxOC43MkMxNy44OSAxOC42MyAxOC4wMSAxOC40NCAxOCAxOC4yNEMxNi45OSAxNS43MyAxNC42NyAxMy45OSAxMiAxNFoiIGZpbGw9IiM5QzlDOTciLz4KPC9zdmc+';
    img.onerror = null; // Prevent infinite loop
}

// Add hover effects for passport actions
function addPassportHoverEffects() {
    const memberPhotos = document.querySelectorAll('.member-photo');
    memberPhotos.forEach(photo => {
        const actions = photo.querySelector('.passport-actions');
        if (actions) {
            photo.addEventListener('mouseenter', () => {
                actions.style.display = 'block';
            });
            photo.addEventListener('mouseleave', () => {
                actions.style.display = 'none';
            });
        }
    });
}

// Function to handle passport upload
async function uploadPassport(memberId) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    
    input.onchange = async function(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            showMessage('File size must be less than 5MB', 'error');
            return;
        }
        
        // Validate file type
        if (!file.type.startsWith('image/')) {
            showMessage('Please select a valid image file', 'error');
            return;
        }
        
        // Show loading state
        const loadingMessage = showMessage('Uploading passport photo...', 'info');
        
        try {
            const formData = new FormData();
            formData.append('passport', file);
            formData.append('memberId', memberId);
            
            const response = await fetch('/api/upload-passport', {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (response.ok && result.success) {
                showMessage('Passport photo uploaded successfully!', 'success');
                // Reload the members table to show the new image
                await loadMembers();
            } else {
                throw new Error(result.message || 'Upload failed');
            }
            
        } catch (error) {
            console.error('Upload error:', error);
            showMessage('Failed to upload passport photo: ' + error.message, 'error');
        }
    };
    
    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
}

// Function to delete passport photo
async function deletePassport(memberId) {
    if (!confirm('Are you sure you want to delete this passport photo?')) {
        return;
    }
    
    try {
        showMessage('Deleting passport photo...', 'info');
        
        const response = await fetch(`/api/delete-passport/${memberId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            showMessage('Passport photo deleted successfully!', 'success');
            // Reload the members table
            await loadMembers();
        } else {
            throw new Error(result.message || 'Delete failed');
        }
        
    } catch (error) {
        console.error('Delete passport error:', error);
        showMessage('Failed to delete passport photo: ' + error.message, 'error');
    }
}

// Updated loadUsers function to work with MongoDB
async function loadUsers() {
    try {
        const response = await fetch('/api/members');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const members = await response.json();
        return members;
        
    } catch (error) {
        console.error('Error loading users:', error);
        throw error;
    }
}

// View member function
async function viewMember(memberId) {
    try {
        const member = currentMembers.find(m => (m._id || m.id) === memberId);
        if (!member) {
            showMessage('Member not found', 'error');
            return;
        }
        
        // You can reuse your existing viewIdCard function or create a simple view
        viewIdCard(memberId);
        
    } catch (error) {
        console.error('Error viewing member:', error);
        showMessage('Failed to view member details', 'error');
    }
}


// Enhanced member editing with passport support
async function editMember(memberId) {
    try {
        // Get member data
        const response = await fetch(`/api/members/${memberId}`);
        if (!response.ok) {
            throw new Error('Failed to fetch member data');
        }
        
        const member = await response.json();
        
        // Create edit form modal
        const modal = createEditMemberModal(member);
        document.body.appendChild(modal);
        
        // Show modal
        modal.style.display = 'block';
        
    } catch (error) {
        console.error('Edit member error:', error);
        showMessage('Failed to load member data: ' + error.message, 'error');
    }
}

// Create edit member modal with passport upload
function createEditMemberModal(member) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.cssText = `
        display: none;
        position: fixed;
        z-index: 1000;
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0,0,0,0.5);
    `;
    
    const passportImage = getPassportImagePath(member.passport);
    
    modal.innerHTML = `
        <div class="modal-content" style="background-color: #fefefe; margin: 5% auto; padding: 20px; border: 1px solid #888; width: 80%; max-width: 600px; border-radius: 8px;">
            <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2>Edit Member</h2>
                <span class="close" style="color: #aaa; font-size: 28px; font-weight: bold; cursor: pointer;">&times;</span>
            </div>
            
            <form id="editMemberForm">
                <div style="display: grid; grid-template-columns: 1fr 200px; gap: 20px;">
                    <div>
                        <div class="form-group" style="margin-bottom: 15px;">
                            <label>Name:</label>
                            <input type="text" id="editName" value="${member.name || ''}" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                        </div>
                        
                        <div class="form-group" style="margin-bottom: 15px;">
                            <label>Email:</label>
                            <input type="email" id="editEmail" value="${member.email || ''}" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                        </div>
                        
                        <div class="form-group" style="margin-bottom: 15px;">
                            <label>Code:</label>
                            <input type="text" id="editCode" value="${member.code || ''}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                        </div>
                        
                        <div class="form-group" style="margin-bottom: 15px;">
                            <label>Position:</label>
                            <select id="editPosition" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                                <option value="MEMBER" ${member.position === 'MEMBER' ? 'selected' : ''}>Member</option>
                                <option value="ADMIN" ${member.position === 'ADMIN' ? 'selected' : ''}>Admin</option>
                                <option value="MODERATOR" ${member.position === 'MODERATOR' ? 'selected' : ''}>Moderator</option>
                            </select>
                        </div>
                        
                        <div class="form-group" style="margin-bottom: 15px;">
                            <label>State:</label>
                            <input type="text" id="editState" value="${member.state || ''}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                        </div>
                    </div>
                    
                    <div>
                        <div class="passport-section" style="text-align: center;">
                            <label>Passport Photo:</label>
                            <div class="passport-preview" style="width: 150px; height: 150px; border: 2px dashed #ddd; border-radius: 8px; display: flex; align-items: center; justify-content: center; margin: 10px auto; position: relative; overflow: hidden;">
                                <img id="passportPreview" src="${passportImage}" alt="Passport" style="width: 100%; height: 100%; object-fit: cover;" onerror="handleImageError(this)">
                            </div>
                            <div style="margin-top: 10px;">
                                <button type="button" onclick="uploadPassportInModal('${member._id}')" class="btn btn-primary btn-sm" style="margin-right: 5px;">
                                    <i class="fas fa-upload"></i> Upload
                                </button>
                                ${member.passport ? `
                                    <button type="button" onclick="removePassportInModal('${member._id}')" class="btn btn-danger btn-sm">
                                        <i class="fas fa-trash"></i> Remove
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="form-actions" style="margin-top: 20px; text-align: right;">
                    <button type="button" class="btn btn-secondary" onclick="closeModal()" style="margin-right: 10px;">Cancel</button>
                    <button type="submit" class="btn btn-primary">Save Changes</button>
                </div>
            </form>
        </div>
    `;
    
    // Add event listeners
    const closeBtn = modal.querySelector('.close');
    closeBtn.onclick = () => closeModal();
    
    const form = modal.querySelector('#editMemberForm');
    form.onsubmit = (e) => handleEditMemberSubmit(e, member._id);
    
    // Close modal when clicking outside
    modal.onclick = (e) => {
        if (e.target === modal) {
            closeModal();
        }
    };
    
    return modal;
}

// Handle passport upload in modal
async function uploadPassportInModal(memberId) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    
    input.onchange = async function(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        // Validate file
        if (file.size > 5 * 1024 * 1024) {
            showMessage('File size must be less than 5MB', 'error');
            return;
        }
        
        if (!file.type.startsWith('image/')) {
            showMessage('Please select a valid image file', 'error');
            return;
        }
        
        try {
            showMessage('Uploading passport photo...', 'info');
            
            const formData = new FormData();
            formData.append('passport', file);
            formData.append('memberId', memberId);
            
            const response = await fetch('/api/upload-passport', {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (response.ok && result.success) {
                // Update preview image
                const preview = document.getElementById('passportPreview');
                if (preview) {
                    preview.src = result.passportPath + '?t=' + Date.now(); // Add timestamp to prevent caching
                }
                
                showMessage('Passport photo uploaded successfully!', 'success');
            } else {
                throw new Error(result.message || 'Upload failed');
            }
            
        } catch (error) {
            console.error('Upload error:', error);
            showMessage('Failed to upload passport photo: ' + error.message, 'error');
        }
    };
    
    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
}

// Handle passport removal in modal
async function removePassportInModal(memberId) {
    if (!confirm('Are you sure you want to remove this passport photo?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/delete-passport/${memberId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            // Update preview image
            const preview = document.getElementById('passportPreview');
            if (preview) {
                preview.src = 'images/default-avatar.png';
            }
            
            showMessage('Passport photo removed successfully!', 'success');
        } else {
            throw new Error(result.message || 'Remove failed');
        }
        
    } catch (error) {
        console.error('Remove passport error:', error);
        showMessage('Failed to remove passport photo: ' + error.message, 'error');
    }
}

// Handle edit member form submission
async function handleEditMemberSubmit(event, memberId) {
    event.preventDefault();
    
    const formData = {
        name: document.getElementById('editName').value,
        email: document.getElementById('editEmail').value,
        code: document.getElementById('editCode').value,
        position: document.getElementById('editPosition').value,
        state: document.getElementById('editState').value
    };
    
    try {
        showMessage('Updating member...', 'info');
        
        const response = await fetch(`/api/members/${memberId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            showMessage('Member updated successfully!', 'success');
            closeModal();
            await loadMembers(); // Reload the table
        } else {
            throw new Error(result.message || 'Update failed');
        }
        
    } catch (error) {
        console.error('Update member error:', error);
        showMessage('Failed to update member: ' + error.message, 'error');
    }
}

// Close modal function
function closeModal() {
    const modal = document.querySelector('.modal');
    if (modal) {
        modal.remove();
    }
}

// Enhanced escapeHtml function
function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}


// Helper function to get correct passport image path
const BACKEND_BASE_URL = 'https://narap-backend.onrender.com';

function getPassportImagePath(passport) {
    // 1. Handle empty case
    if (!passport) return `${BACKEND_BASE_URL}/images/default-avatar.png`;
    
    // 2. Preserve full URLs
    if (passport.startsWith('http') || passport.startsWith('data:')) return passport;
    
    // 3. Normalize paths (remove leading slashes)
    const normalizedPath = passport.startsWith('/') 
        ? passport.substring(1) 
        : passport;
    
    // 4. Handle different upload locations
    if (normalizedPath.startsWith('uploads/')) {
        return `${BACKEND_BASE_URL}/${normalizedPath}`;
    }
    
    // 5. Default to passports subfolder
    return `${BACKEND_BASE_URL}/uploads/passports/${normalizedPath}`;
}

// Improved error handling for images
function handleImageError(img) {
    img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiNFNUU3RUIiLz4KPHBhdGggZD0iTTEyIDEyQzE0LjIwOTEgMTIgMTYgMTAuMjA5MSAxNiA4QzE2IDUuNzkwODYgMTQuMjA5MSA0IDEyIDRDOS43OTA4NiA0IDggNS43OTA4NiA4IDhDOCAxMC4yMDkxIDkuNzkwODYgMTIgMTIgMTJaIiBmaWxsPSIjOUM5Qzk3Ii8+CjxwYXRoIGQ9Ik0xMiAxNEM5LjMzIDEzLjk5IDcuMDEgMTUuNzMgNiAxOC4yNEM1Ljk5IDE4LjQ0IDYuMTEgMTguNjMgNi4yOSAxOC43MkM2LjY3IDE4Ljk2IDcuMDggMTkuMTYgNy41IDE5LjMxQzguOTIgMTkuODYgMTAuNDQgMjAgMTIgMjBDMTMuNTYgMjAgMTUuMDggMTkuODYgMTYuNSAxOS4zMUMxNi45MiAxOS4xNiAxNy4zMyAxOC45NiAxNy43MSAxOC43MkMxNy44OSAxOC42MyAxOC4wMSAxOC40NCAxOCAxOC4yNEMxNi45OSAxNS43MyAxNC42NyAxMy45OSAxMiAxNFoiIGZpbGw9IiM5QzlDOTciLz4KPC9zdmc+';
    img.onerror = null; // Prevent infinite loop
}

// Function to handle passport upload
async function uploadPassport(memberId) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    
    input.onchange = async function(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            showMessage('File size must be less than 5MB', 'error');
            return;
        }
        
        // Validate file type
        if (!file.type.startsWith('image/')) {
            showMessage('Please select a valid image file', 'error');
            return;
        }
        
        try {
            showMessage('Uploading passport photo...', 'info');
            
            const formData = new FormData();
            formData.append('passport', file);
            formData.append('memberId', memberId);
            
            const response = await fetch('/api/upload-passport', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                showMessage('Passport photo uploaded successfully!', 'success');
                // Reload the members table to show the new image
                await loadMembers();
            } else {
                throw new Error(result.message || 'Upload failed');
            }
            
        } catch (error) {
            console.error('Upload error:', error);
            showMessage('Failed to upload passport photo: ' + error.message, 'error');
        }
    };
    
    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
}


// Get certificates function
async function getCertificates() {
    try {
        console.log('Fetching certificates from:', `${backendUrl}/api/certificates`);
        
        let backendCertificates = [];
        let localCertificates = getLocalCertificates();
        
        // Try to fetch from backend
        try {
            const res = await fetch(`${backendUrl}/api/certificates`, {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (res.ok) {
                backendCertificates = await res.json();
                backendCertificates = backendCertificates.map(cert => ({ ...cert, isFromBackend: true }));
            }
        } catch (error) {
            console.warn('Backend request failed, using local data only', error);
        }
        
        // Merge backend and local certificates
        const mergedCertificates = [...backendCertificates];
        
        // Add local certificates that don't exist in backend
        localCertificates.forEach(localCert => {
            const existsInBackend = backendCertificates.find(backendCert => 
                backendCert._id === localCert._id || 
                backendCert.number === localCert.number
            );
            
            if (!existsInBackend) {
                mergedCertificates.push({ ...localCert, isFromBackend: false });
            }
        });
        
        // Sort by creation date (newest first)
        mergedCertificates.sort((a, b) => {
            const dateA = new Date(a.createdAt || a.issueDate || 0);
            const dateB = new Date(b.createdAt || b.issueDate || 0);
            return dateB - dateA;
        });
        
        currentCertificates = mergedCertificates;
        return currentCertificates;
        
    } catch (error) {
        console.error('Get certificates error:', error);
        showMessage('Failed to load certificates: ' + error.message, 'error');
        
        // Fallback to local data only
        const localCertificates = getLocalCertificates();
        currentCertificates = localCertificates.map(cert => ({ ...cert, isFromBackend: false }));
        return currentCertificates;
    }
}

// Load certificates tab - FIXED
async function loadCertificates() {
    console.log('Loading certificates...');
    
    try {
        // Show loading state
        const tableBody = document.getElementById('certificatesTableBody');
        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="loading">Loading certificates...</td>
                </tr>
            `;
        }
        
        let allCertificates = [];
        
        // Load from backend if online
        if (navigator.onLine) {
            try {
                const response = await fetch(`${backendUrl}/api/certificates`, {
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                
                if (response.ok) {
                    const backendCertificates = await response.json();
                    allCertificates = backendCertificates.map(cert => ({
                        ...cert,
                        isFromBackend: true
                    }));
                    console.log('Loaded certificates from backend:', allCertificates.length);
                }
            } catch (error) {
                console.warn('Failed to load from backend:', error);
            }
        }
        
        // Load from local storage
        const localCertificates = getLocalCertificates();
        
        // Merge certificates (avoid duplicates)
        const mergedCertificates = [...allCertificates];
        localCertificates.forEach(localCert => {
            const exists = allCertificates.find(cert => 
                (cert._id || cert.id) === (localCert._id || localCert.id)
            );
            if (!exists) {
                mergedCertificates.push(localCert);
            }
        });
        
        // Update global variable
        currentCertificates = mergedCertificates;
        
        // Display certificates using the new function
        displayCertificates(currentCertificates);
        
        console.log('Total certificates loaded:', currentCertificates.length);
        
    } catch (error) {
        console.error('Error loading certificates:', error);
        showMessage('Error loading certificates: ' + error.message, 'error');
        
        // Fallback to local certificates only
        currentCertificates = getLocalCertificates();
        displayCertificates(currentCertificates);
    }
}

// Make sure loadCertificates is globally accessible
window.loadCertificates = loadCertificates;



// Add this alias function for loadDashboard compatibility
async function getCertificates() {
    try {
        console.log('Loading certificates...');
        const url = `${backendUrl}/api/certificates`;
        console.log('Fetching certificates from:', url);
        
        const response = await fetch(url, {
            method: 'GET',
            credentials: 'include',
            headers: getAuthHeaders()
        });

        // Handle token expiration
        if (response.status === 401) {
            console.log('🔐 Token expired, redirecting to login');
            localStorage.removeItem('authToken');
            document.getElementById('loginSection').style.display = 'block';
            document.getElementById('adminSection').style.display = 'none';
            showMessage('Session expired. Please login again.', 'warning');
            return [];
        }

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('✅ Certificates loaded successfully:', data.length, 'certificates');
        
        if (data.length === 0) {
            showMessage('No certificates found', 'info');
        }
        
        return Array.isArray(data) ? data : [];
    } catch (error) {
        console.error('Error fetching certificates:', error);
        showMessage('Failed to load certificates: ' + error.message, 'error');
        return [];
    }
}


// Enhanced displayCertificates function with state information
function displayCertificates(certificates) {
    const tableBody = document.getElementById('certificatesTableBody');
    if (!tableBody) {
        console.error('Certificates table body not found');
        return;
    }
    
    if (certificates.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px; color: #666;">
                    <i class="fas fa-certificate" style="font-size: 48px; margin-bottom: 15px; opacity: 0.3;"></i>
                    <div>No certificates found</div>
                    <div style="font-size: 14px; margin-top: 10px;">Issue your first certificate to get started</div>
                </td>
            </tr>
        `;
        return;
    }
    
    tableBody.innerHTML = certificates.map(certificate => {
        const issueDate = certificate.issueDate ? 
            new Date(certificate.issueDate).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            }) : 'N/A';
            
        const statusColor = {
            'active': '#28a745',
            'revoked': '#dc3545',
            'expired': '#ffc107'
        }[certificate.status] || '#6c757d';
        
        // Get certificate type for display
        const typeDisplay = {
            'membership': 'Membership',
            'achievement': 'Achievement',
            'training': 'Training',
            'recognition': 'Recognition',
            'service': 'Service'
        }[certificate.type] || 'Certificate';
        
        return `
            <tr>
                <td>
                    <span style="background: #667eea; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 600;">
                        ${certificate.number || 'N/A'}
                    </span>
                </td>
                <td>
                    <div style="font-weight: 600;">${certificate.recipient || 'N/A'}</div>
                    <div style="font-size: 12px; color: #666;">
                        ${certificate.email || 'N/A'}
                        ${certificate.state ? ` • ${certificate.state}` : ''}
                    </div>
                </td>
                <td>
                    <div style="font-weight: 500;">${certificate.title || 'N/A'}</div>
                    <div style="font-size: 12px; color: #666;">${typeDisplay}</div>
                </td>
                <td>${issueDate}</td>
                <td>
                    <span style="background: ${statusColor}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px;">
                        ${(certificate.status || 'active').toUpperCase()}
                    </span>
                </td>
                <td>
                    <div style="display: flex; gap: 5px; flex-wrap: wrap;">
                        <button onclick="viewCertificateDetails('${certificate._id || certificate.id}')" 
                                class="btn btn-sm" 
                                style="background: #17a2b8; color: white; padding: 4px 8px; font-size: 12px;" 
                                title="View Certificate">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button onclick="downloadCertificateById('${certificate._id || certificate.id}')" 
                                class="btn btn-sm" 
                                style="background: #28a745; color: white; padding: 4px 8px; font-size: 12px;" 
                                title="Download JPG">
                            <i class="fas fa-download"></i>
                        </button>
                        ${certificate.status === 'active' ? `
                            <button onclick="showRevokeCertificateModal('${certificate._id || certificate.id}')" 
                                    class="btn btn-sm" 
                                    style="background: #ffc107; color: #212529; padding: 4px 8px; font-size: 12px;" 
                                    title="Revoke Certificate">
                                <i class="fas fa-ban"></i>
                            </button>
                        ` : ''}
                        <button onclick="deleteCertificate('${certificate._id || certificate.id}')" 
                                class="btn btn-sm" 
                                style="background: #dc3545; color: white; padding: 4px 8px; font-size: 12px;" 
                                title="Delete Certificate">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}


// Function to show revoke certificate modal
window.showRevokeCertificateModal = function(certificateId) {
    const certificate = currentCertificates.find(c => (c._id || c.id) === certificateId);
    if (!certificate) {
        showMessage('Certificate not found', 'error');
        return;
    }
    
    // Create revoke modal HTML
    const modalHTML = `
        <div class="modal active" style="display: flex;">
            <div class="modal-backdrop" onclick="closeRevokeCertificateModal()"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h2 class="modal-title">Revoke Certificate</h2>
                    <button class="close-btn" onclick="closeRevokeCertificateModal()">&times;</button>
                </div>
                <div style="padding: 20px;">
                    <div class="certificate-info" style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                        <h4>Certificate Details:</h4>
                        <p><strong>Number:</strong> ${certificate.number}</p>
                        <p><strong>Recipient:</strong> ${certificate.recipient}</p>
                        <p><strong>Title:</strong> ${certificate.title}</p>
                        <p><strong>Issue Date:</strong> ${new Date(certificate.issueDate).toLocaleDateString()}</p>
                    </div>
                    
                    <div class="form-group">
                        <label for="revocationReason">Reason for Revocation *</label>
                        <select id="revocationReason" class="form-control" onchange="toggleCustomReason()">
                            <option value="">Select a reason</option>
                            <option value="Fraudulent Information">Fraudulent Information</option>
                            <option value="Duplicate Certificate">Duplicate Certificate</option>
                            <option value="Administrative Error">Administrative Error</option>
                            <option value="Member Misconduct">Member Misconduct</option>
                            <option value="Expired Membership">Expired Membership</option>
                            <option value="Other">Other (specify)</option>
                        </select>
                    </div>
                    
                    <div class="form-group" id="customReasonGroup" style="display: none;">
                        <label for="customReason">Custom Reason *</label>
                        <textarea id="customReason" class="form-control" rows="3" placeholder="Please specify the reason for revocation"></textarea>
                    </div>
                    
                    <div class="form-group">
                        <label for="revokedBy">Revoked By</label>
                        <input type="text" id="revokedBy" class="form-control" value="Admin" placeholder="Name of person revoking">
                    </div>
                    
                    <div class="form-group">
                        <label>
                            <input type="checkbox" id="confirmRevocation"> 
                            I confirm that I want to revoke this certificate. This action cannot be undone.
                        </label>
                    </div>
                </div>
                
                <div class="form-buttons">
                    <button onclick="confirmRevocation('${certificateId}')" class="btn btn-danger">
                        <i class="fas fa-ban"></i>
                        Revoke Certificate
                    </button>
                    <button onclick="closeRevokeCertificateModal()" class="btn btn-secondary">
                        <i class="fas fa-times"></i>
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Add modal to page
    document.body.insertAdjacentHTML('beforeend', modalHTML);
};

// Function to close revoke modal
window.closeRevokeCertificateModal = function() {
    const modal = document.querySelector('.modal');
    if (modal) {
        modal.remove();
    }
};

// Function to toggle custom reason field
window.toggleCustomReason = function() {
    const reasonSelect = document.getElementById('revocationReason');
    const customReasonGroup = document.getElementById('customReasonGroup');
    
    if (reasonSelect && customReasonGroup) {
        if (reasonSelect.value === 'Other') {
            customReasonGroup.style.display = 'block';
        } else {
            customReasonGroup.style.display = 'none';
        }
    }
};

// Function to view certificate details
window.viewCertificateDetails = function(certificateId) {
    const certificate = currentCertificates.find(c => (c._id || c.id) === certificateId);
    if (!certificate) {
        showMessage('Certificate not found', 'error');
        return;
    }
    
    // Generate certificate preview
    const certificateHTML = generateCertificateHTML(certificate);
    
    // Create view modal
    const modalHTML = `
        <div class="modal active" style="display: flex;">
            <div class="modal-backdrop" onclick="closeViewCertificateModal()"></div>
            <div class="modal-content" style="max-width: 800px;">
                <div class="modal-header">
                    <h2 class="modal-title">Certificate Details</h2>
                    <button class="close-btn" onclick="closeViewCertificateModal()">&times;</button>
                </div>
                <div style="padding: 20px;">
                    ${certificateHTML}
                </div>
                <div class="form-buttons">
                    <button onclick="downloadCertificateById('${certificateId}')" class="btn btn-success">
                        <i class="fas fa-download"></i>
                        Download JPG
                    </button>
                    <button onclick="closeViewCertificateModal()" class="btn btn-secondary">
                        <i class="fas fa-times"></i>
                        Close
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
};

// Function to close view certificate modal
window.closeViewCertificateModal = function() {
    const modal = document.querySelector('.modal');
    if (modal) {
        modal.remove();
    }
};

// Helper function to generate certificate HTML
function generateCertificateHTML(certificate) {
    const issueDate = certificate.issueDate ? 
        new Date(certificate.issueDate).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }) : 'N/A';
        
    const validUntil = certificate.validUntil ? 
        new Date(certificate.validUntil).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }) : 'Indefinite';
    
    return `
        <div class="certificate" style="border: 8px solid #667eea; padding: 40px; background: white; text-align: center;">
            <div class="certificate-header">
                <h1 style="color: #667eea; font-size: 24px; margin-bottom: 10px;">NIGERIAN ASSOCIATION OF REFRIGERATION<br>AND AIR CONDITIONING PRACTITIONERS</h1>
                <h2 style="color: #764ba2; font-size: 18px; margin-bottom: 20px;">CERTIFICATE OF ${(certificate.type || 'membership').toUpperCase()}</h2>
            </div>
            
            <div class="certificate-body">
                <h3 style="color: #333; font-size: 20px; margin-bottom: 20px;">${certificate.title}</h3>
                <p style="font-size: 16px; margin-bottom: 10px;">This is to certify that</p>
                <h2 style="color: #667eea; font-size: 28px; margin: 20px 0; text-decoration: underline;">${certificate.recipient}</h2>
                <p style="margin: 10px 0;"><strong>Email:</strong> ${certificate.email}</p>
                ${certificate.code ? `<p style="margin: 10px 0;"><strong>NARAP Code:</strong> ${certificate.code}</p>` : ''}
                ${certificate.position ? `<p style="margin: 10px 0;"><strong>Position:</strong> ${certificate.position}</p>` : ''}
                ${certificate.state ? `<p style="margin: 10px 0;"><strong>State:</strong> ${certificate.state}</p>` : ''}
                ${certificate.description ? `<p style="margin: 20px 0; font-style: italic;">${certificate.description}</p>` : ''}
                
                <div style="margin-top: 30px; border-top: 1px solid #ddd; padding-top: 20px;">
                    <p><strong>Certificate Number:</strong> ${certificate.number}</p>
                    ${certificate.serialNumber ? `<p><strong>Serial Number:</strong> ${certificate.serialNumber}</p>` : ''}
                    <p><strong>Issue Date:</strong> ${issueDate}</p>
                    <p><strong>Valid Until:</strong> ${validUntil}</p>
                    <p><strong>Status:</strong> <span style="color: ${certificate.status === 'active' ? '#28a745' : '#dc3545'};">${(certificate.status || 'active').toUpperCase()}</span></p>
                </div>
                
                ${certificate.status === 'revoked' ? `
                    <div style="margin-top: 20px; padding: 15px; background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 8px;">
                        <h4 style="color: #721c24; margin-bottom: 10px;">REVOCATION DETAILS</h4>
                        <p><strong>Revoked Date:</strong> ${new Date(certificate.revokedAt).toLocaleDateString()}</p>
                        <p><strong>Revoked By:</strong> ${certificate.revokedBy}</p>
                        <p><strong>Reason:</strong> ${certificate.revokedReason}</p>
                    </div>
                ` : ''}
                        </div>
            
            <div class="certificate-footer" style="display: flex; justify-content: space-between; align-items: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd;">
                <div class="signature-section">
                    <div style="width: 200px; border-bottom: 1px solid #333; margin-bottom: 5px;"></div>
                    <p style="font-size: 14px;">President, NARAP</p>
                </div>
                <div class="seal-section">
                    <div style="width: 80px; height: 80px; border: 2px solid #667eea; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; color: #667eea; text-align: center;">OFFICIAL<br>SEAL</div>
                </div>
            </div>
        </div>
    `;
}




// Helper function to get status colors
function getStatusColor(status) {
    switch(status.toLowerCase()) {
        case 'active':
            return 'background: #d4edda; color: #155724; border: 1px solid #c3e6cb;';
        case 'revoked':
            return 'background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb;';
        case 'expired':
            return 'background: #fff3cd; color: #856404; border: 1px solid #ffeaa7;';
                default:
            return 'background: #e2e3e5; color: #383d41; border: 1px solid #d6d8db;';
    }
}

// View revocation details function
function viewRevocationDetails(certificateId) {
    const certificate = currentCertificates.find(c => (c._id || c.id) === certificateId);
    if (!certificate) {
        showMessage('Certificate not found', 'error');
        return;
    }
    
    if (certificate.status !== 'revoked') {
        showMessage('This certificate is not revoked', 'error');
        return;
    }
    
    // Create modal for revocation details
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'block';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 600px; margin: 5% auto;">
            <div class="modal-header">
                <h3 style="color: #dc3545;">
                    <i class="fas fa-ban"></i> Certificate Revocation Details
                </h3>
                <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
            </div>
            <div class="modal-body">
                <div class="certificate-info" style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <h5>Certificate Information:</h5>
                    <div class="revocation-details">
                        <div class="detail-row" style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #dee2e6;">
                            <strong>Certificate Number:</strong>
                            <span>${escapeHtml(certificate.number)}</span>
                        </div>
                        <div class="detail-row" style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #dee2e6;">
                            <strong>Recipient:</strong>
                            <span>${escapeHtml(certificate.recipient)}</span>
                        </div>
                        <div class="detail-row" style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #dee2e6;">
                            <strong>Title:</strong>
                            <span>${escapeHtml(certificate.title)}</span>
                        </div>
                        <div class="detail-row" style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #dee2e6;">
                            <strong>Issue Date:</strong>
                            <span>${formatDate(certificate.issueDate)}</span>
                        </div>
                    </div>
                </div>
                
                <div class="revocation-info" style="background: #f8d7da; padding: 15px; border-radius: 8px; border: 1px solid #f5c6cb;">
                    <h5 style="color: #721c24; margin-bottom: 15px;">
                        <i class="fas fa-exclamation-triangle"></i> Revocation Information
                    </h5>
                    <div class="revocation-details">
                        <div class="detail-row" style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f5c6cb;">
                            <strong style="color: #721c24;">Revocation Date:</strong>
                            <span style="color: #721c24;">${formatDate(certificate.revokedAt)}</span>
                        </div>
                        ${certificate.revokedBy ? `
                            <div class="detail-row" style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f5c6cb;">
                                <strong style="color: #721c24;">Revoked By:</strong>
                                <span style="color: #721c24;">${escapeHtml(certificate.revokedBy)}</span>
                            </div>
                        ` : ''}
                        ${certificate.revokedReason ? `
                            <div class="detail-row" style="display: flex; flex-direction: column; padding: 8px 0;">
                                <strong style="color: #721c24; margin-bottom: 5px;">Reason for Revocation:</strong>
                                <span style="color: #721c24; font-style: italic; background: rgba(114, 28, 36, 0.1); padding: 10px; border-radius: 4px;">
                                    ${escapeHtml(certificate.revokedReason)}
                                </span>
                            </div>
                        ` : ''}
                    </div>
                </div>
                
                <div class="alert" style="background: #fff3cd; color: #856404; padding: 15px; border-radius: 4px; border: 1px solid #ffeaa7; margin-top: 20px;">
                    <i class="fas fa-info-circle"></i>
                    <strong>Note:</strong> This certificate has been permanently revoked and is no longer valid for any official purposes.
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">Close</button>
                <button type="button" class="btn btn-primary" onclick="printRevocationDetails('${certificateId}')">
                    <i class="fas fa-print"></i> Print Details
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Close modal when clicking outside
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('modal')) {
        e.target.style.display = 'none';
    }
});
}

// Print revocation details function
function printRevocationDetails(certificateId) {
    const certificate = currentCertificates.find(c => (c._id || c.id) === certificateId);
    if (!certificate) {
        showMessage('Certificate not found', 'error');
        return;
    }
    
    const printContent = `
        <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #dc3545; padding-bottom: 20px;">
                <h1 style="color: #dc3545; margin: 0;">CERTIFICATE REVOCATION NOTICE</h1>
                <p style="margin: 10px 0; color: #666;">Nigerian Association of Refrigeration And Air Conditioning Practitioners</p>
            </div>
            
            <div style="margin-bottom: 30px;">
                <h3 style="color: #333; border-bottom: 1px solid #ddd; padding-bottom: 10px;">Certificate Information</h3>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 8px; border: 1px solid #ddd; background: #f8f9fa; font-weight: bold;">Certificate Number:</td>
                        <td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(certificate.number)}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border: 1px solid #ddd; background: #f8f9fa; font-weight: bold;">Recipient:</td>
                        <td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(certificate.recipient)}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border: 1px solid #ddd; background: #f8f9fa; font-weight: bold;">Title:</td>
                        <td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(certificate.title)}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border: 1px solid #ddd; background: #f8f9fa; font-weight: bold;">Issue Date:</td>
                        <td style="padding: 8px; border: 1px solid #ddd;">${formatDate(certificate.issueDate)}</td>
                    </tr>
                </table>
            </div>
            
            <div style="margin-bottom: 30px; background: #f8d7da; padding: 20px; border: 2px solid #dc3545; border-radius: 8px;">
                <h3 style="color: #721c24; margin-top: 0;">REVOCATION DETAILS</h3>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 8px; border: 1px solid #f5c6cb; background: rgba(114, 28, 36, 0.1); font-weight: bold; color: #721c24;">Revocation Date:</td>
                        <td style="padding: 8px; border: 1px solid #f5c6cb; color: #721c24;">${formatDate(certificate.revokedAt)}</td>
                    </tr>
                    ${certificate.revokedBy ? `
                        <tr>
                            <td style="padding: 8px; border: 1px solid #f5c6cb; background: rgba(114, 28, 36, 0.1); font-weight: bold; color: #721c24;">Revoked By:</td>
                            <td style="padding: 8px; border: 1px solid #f5c6cb; color: #721c24;">${escapeHtml(certificate.revokedBy)}</td>
                        </tr>
                    ` : ''}
                    ${certificate.revokedReason ? `
                        <tr>
                            <td style="padding: 8px; border: 1px solid #f5c6cb; background: rgba(114, 28, 36, 0.1); font-weight: bold; color: #721c24;">Reason:</td>
                            <td style="padding: 8px; border: 1px solid #f5c6cb; color: #721c24;">${escapeHtml(certificate.revokedReason)}</td>
                        </tr>
                    ` : ''}
                </table>
            </div>
            
            <div style="background: #fff3cd; padding: 15px; border: 1px solid #ffeaa7; border-radius: 4px; margin-bottom: 30px;">
                <p style="margin: 0; color: #856404; font-weight: bold;">
                    ⚠️ IMPORTANT NOTICE: This certificate has been permanently revoked and is no longer valid for any official purposes.
                </p>
            </div>
            
            <div style="text-align: center; margin-top: 40px; border-top: 1px solid #ddd; padding-top: 20px;">
                <p style="margin: 0; color: #666; font-size: 12px;">
                    Generated on: ${formatDate(new Date())} | NARAP Administration
                </p>
            </div>
        </div>
    `;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
            <head>
                <title>Certificate Revocation Notice - ${certificate.number}</title>
                <style>
                    @media print {
                        body { margin: 0; }
                        .no-print { display: none; }
                    }
                </style>
            </head>
            <body>
                ${printContent}
            </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
}

// COMPLETELY FIXED revoke certificate function
async function revokeCertificate(certificateId) {
    try {
        // Find the certificate in current data
        const certificate = currentCertificates.find(c => c._id === certificateId);
        if (!certificate) {
            showMessage('Certificate not found', 'error');
            return;
        }
        
        console.log('🚫 Preparing to revoke certificate:', certificate);
        
        // Create modal for revocation
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'block';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px; margin: 5% auto;">
                <div class="modal-header">
                    <h3 style="color: #dc3545;">
                        <i class="fas fa-ban"></i> Revoke Certificate
                    </h3>
                    <span class="close" onclick="window.closeRevocationModal()">&times;</span>
                </div>
                <div class="modal-body">
                    <div class="certificate-info" style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                        <h5>Certificate Details:</h5>
                        <p><strong>Number:</strong> ${escapeHtml(certificate.number)}</p>
                        <p><strong>Recipient:</strong> ${escapeHtml(certificate.recipient)}</p>
                        <p><strong>Title:</strong> ${escapeHtml(certificate.title)}</p>
                        <p><strong>Issue Date:</strong> ${formatDate(certificate.issueDate)}</p>
                    </div>
                    
                    <div class="revocation-form">
                        <div class="form-group" style="margin-bottom: 15px;">
                            <label for="revocationReason" style="display: block; margin-bottom: 5px; font-weight: bold;">
                                Reason for Revocation: <span style="color: red;">*</span>
                            </label>
                            <select id="revocationReason" class="form-control" style="width: 100%; padding: 8px; margin-bottom: 10px;" onchange="toggleCustomReason(this.value)">
                                <option value="">Select a reason...</option>
                                <option value="Certificate issued in error">Certificate issued in error</option>
                                <option value="Information on certificate is incorrect">Information on certificate is incorrect</option>
                                <option value="Recipient no longer meets requirements">Recipient no longer meets requirements</option>
                                <option value="Fraudulent application">Fraudulent application</option>
                                <option value="Disciplinary action">Disciplinary action</option>
                                <option value="Certificate lost or stolen">Certificate lost or stolen</option>
                                <option value="Superseded by new certificate">Superseded by new certificate</option>
                                <option value="Other">Other (specify below)</option>
                            </select>
                            
                            <div id="customReasonDiv" style="display: none; margin-top: 10px;">
                                <label for="customReason" style="display: block; margin-bottom: 5px;">Custom Reason:</label>
                                <textarea id="customReason" class="form-control" rows="3" style="width: 100%; padding: 8px;" placeholder="Please specify the reason for revocation..."></textarea>
                            </div>
                        </div>
                        
                        <div class="form-group" style="margin-bottom: 15px;">
                            <label for="revokedBy" style="display: block; margin-bottom: 5px; font-weight: bold;">
                                Revoked By:
                            </label>
                            <input type="text" id="revokedBy" class="form-control" style="width: 100%; padding: 8px;" value="Admin" readonly>
                        </div>
                        
                        <div class="form-group" style="margin-bottom: 20px;">
                            <label style="display: flex; align-items: center; gap: 8px;">
                                <input type="checkbox" id="confirmRevocation" required>
                                <span>I confirm that I want to permanently revoke this certificate. This action cannot be undone.</span>
                            </label>
                        </div>
                    </div>
                    
                    <div class="alert" style="background: #f8d7da; color: #721c24; padding: 15px; border-radius: 4px; border: 1px solid #f5c6cb;">
                        <i class="fas fa-exclamation-triangle"></i>
                        <strong>Warning:</strong> Revoking this certificate will permanently invalidate it. The certificate holder will no longer be able to use it for any official purposes.
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="closeRevocationModal()">Cancel</button>
                    <button type="button" class="btn btn-danger" onclick="executeRevocation('${certificateId}')">
                        <i class="fas fa-ban"></i> Revoke Certificate
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Store modal reference globally for easy access
        window.currentRevocationModal = modal;
        
        // Close modal when clicking outside
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                closeRevocationModal();
            }
        });
        
    } catch (error) {
        console.error('Error creating revocation modal:', error);
        showMessage('Error opening revocation dialog: ' + error.message, 'error');
    }
}

// Helper function to close revocation modal
function closeRevocationModal() {
    try {
        if (window.currentRevocationModal) {
            window.currentRevocationModal.remove();
            window.currentRevocationModal = null;
        }
        
        // Fallback: remove any modal elements
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            if (modal.innerHTML.includes('Revoke Certificate')) {
                modal.remove();
            }
        });
    } catch (error) {
        console.error('Error closing modal:', error);
    }
}

// Helper function to toggle custom reason field
function toggleCustomReason(selectedValue) {
    try {
        const customReasonDiv = document.getElementById('customReasonDiv');
        if (customReasonDiv) {
            if (selectedValue === 'Other') {
                customReasonDiv.style.display = 'block';
                // Focus on the textarea
                setTimeout(() => {
                    const textarea = document.getElementById('customReason');
                    if (textarea) textarea.focus();
                }, 100);
            } else {
                customReasonDiv.style.display = 'none';
            }
        }
    } catch (error) {
        console.error('Error toggling custom reason:', error);
    }
}

// COMPLETELY REWRITTEN function to execute revocation
async function executeRevocation(certificateId) {
    let modal = null;
    
    try {
        console.log('🚫 Starting revocation process for certificate:', certificateId);
        
        // Get form elements safely
        const reasonSelect = document.getElementById('revocationReason');
        const customReasonTextarea = document.getElementById('customReason');
        const revokedByInput = document.getElementById('revokedBy');
        const confirmCheckbox = document.getElementById('confirmRevocation');
        
        // Validation with detailed error messages
        if (!reasonSelect) {
            throw new Error('Reason selection field not found');
        }
        
        if (!reasonSelect.value || reasonSelect.value.trim() === '') {
            showMessage('Please select a reason for revocation', 'error');
            reasonSelect.focus();
            return;
        }
        
        if (!confirmCheckbox) {
            throw new Error('Confirmation checkbox not found');
        }
        
        if (!confirmCheckbox.checked) {
            showMessage('Please confirm that you want to revoke this certificate', 'error');
            confirmCheckbox.focus();
            return;
        }
        
        // Get the final reason
        let finalReason = reasonSelect.value;
        if (reasonSelect.value === 'Other') {
            if (!customReasonTextarea || !customReasonTextarea.value.trim()) {
                showMessage('Please specify a custom reason for revocation', 'error');
                if (customReasonTextarea) customReasonTextarea.focus();
                return;
            }
            finalReason = customReasonTextarea.value.trim();
        }
        
        const revokedBy = (revokedByInput?.value || 'Admin').trim();
        
        console.log('🚫 Revocation details:', {
            certificateId,
            reason: finalReason,
            revokedBy
        });
        
        // Store modal reference before closing
        modal = window.currentRevocationModal;
        
        // Close the modal first
        closeRevocationModal();
        
        // Show loading message
        showMessage('Revoking certificate...', 'info');
        
        // Prepare request data
        const requestData = {
            reason: finalReason,
            revokedBy: revokedBy,
            revokedAt: new Date().toISOString()
        };
        
        console.log('📡 Sending revocation request:', requestData);
        
        // Make API call with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
        
        const response = await fetch(`${backendUrl}/api/certificates/${certificateId}/revoke`, {
            method: 'PUT',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Cache-Control': 'no-cache'
            },
            body: JSON.stringify(requestData),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        console.log('📡 Revocation response status:', response.status);
        console.log('📡 Revocation response headers:', Object.fromEntries(response.headers.entries()));
        
        // Handle response
        let responseData = null;
        const contentType = response.headers.get('content-type');
        
        try {
            if (contentType && contentType.includes('application/json')) {
                responseData = await response.json();
                console.log('📡 Revocation response data:', responseData);
            } else {
                const textResponse = await response.text();
                console.log('📡 Revocation text response:', textResponse);
                
                if (response.ok) {
                    // Server returned success but no JSON
                    responseData = { 
                        success: true, 
                        message: 'Certificate revoked successfully' 
                    };
                } else {
                    throw new Error(`Server returned non-JSON response: ${textResponse}`);
                }
            }
        } catch (parseError) {
            console.error('❌ Failed to parse response:', parseError);
            
            if (response.ok) {
                // If response is OK but we can't parse it, assume success
                responseData = { 
                    success: true, 
                    message: 'Certificate revoked successfully' 
                };
            } else {
                throw new Error(`Invalid server response (Status: ${response.status})`);
            }
        }
        
        // Check if operation was successful
        if (response.ok) {
            console.log('✅ Certificate revoked successfully');
            showMessage('Certificate revoked successfully!', 'success');
            
            // Update local data if possible
            const certIndex = currentCertificates.findIndex(c => c._id === certificateId);
            if (certIndex !== -1) {
                currentCertificates[certIndex].status = 'revoked';
                currentCertificates[certIndex].revokedAt = new Date();
                currentCertificates[certIndex].revokedBy = revokedBy;
                currentCertificates[certIndex].revokedReason = finalReason;
            }
            
            // Refresh the certificates list
            try {
                await loadCertificates();
                await loadDashboard(); // Update dashboard stats
                console.log('✅ Data refreshed successfully');
            } catch (refreshError) {
                console.error('⚠️ Failed to refresh data:', refreshError);
                showMessage('Certificate revoked successfully, but failed to refresh the list. Please refresh the page.', 'warning');
            }
        } else {
            // Handle error response
            const errorMessage = responseData?.message || 
                                responseData?.error || 
                                `Server error: ${response.status} ${response.statusText}`;
            
            console.error('❌ Revocation failed:', errorMessage);
            showMessage('Failed to revoke certificate: ' + errorMessage, 'error');
        }
        
    } catch (error) {
        console.error('❌ Revocation execution error:', error);
        
        // Determine error message
        let errorMessage = 'An unexpected error occurred while revoking the certificate';
        
        if (error.name === 'AbortError') {
            errorMessage = 'Request timeout: The server took too long to respond';
        } else if (error.message.includes('fetch')) {
            errorMessage = 'Cannot connect to server. Please check your internet connection.';
        } else if (error.message.includes('JSON') || error.message.includes('Invalid server response')) {
            errorMessage = 'Server response error. Please try again or contact support.';
        } else if (error.message) {
            errorMessage = error.message;
        }
        
        showMessage(errorMessage, 'error');
        
        // If modal is still open, keep it open so user can try again
        if (!window.currentRevocationModal && modal) {
            document.body.appendChild(modal);
            window.currentRevocationModal = modal;
        }
    }
}

// Add global error handler for revocation
window.addEventListener('error', function(event) {
    if (event.error && event.error.message && event.error.message.includes('revocation')) {
        console.error('Global revocation error:', event.error);
        showMessage('A critical error occurred during revocation. Please refresh the page and try again.', 'error');
    }
});

// Ensure the functions are available globally
window.revokeCertificate = revokeCertificate;
window.executeRevocation = executeRevocation;
window.closeRevocationModal = closeRevocationModal;



// Confirm revocation function
async function confirmRevocation(certificateId) {
    const reasonSelect = document.getElementById('revocationReason');
    const customReasonInput = document.getElementById('customReason');
    const confirmCheckbox = document.getElementById('confirmRevocation');
    const revokedByInput = document.getElementById('revokedBy');
    
    // Validation
    if (!reasonSelect.value) {
        showMessage('Please select a reason for revocation', 'error');
        return;
    }
    
    if (reasonSelect.value === 'Other' && !customReasonInput.value.trim()) {
        showMessage('Please specify the custom reason for revocation', 'error');
        return;
    }
    
    if (!confirmCheckbox.checked) {
        showMessage('Please confirm that you want to revoke this certificate', 'error');
        return;
    }
    
    const reason = reasonSelect.value === 'Other' ? customReasonInput.value.trim() : reasonSelect.value;
    const revokedBy = revokedByInput.value || 'Admin';
    
    try {
        showMessage('Revoking certificate...', 'success');
        
        const certificate = currentCertificates.find(c => (c._id || c.id) === certificateId);
        if (!certificate) {
            showMessage('Certificate not found', 'error');
            return;
        }
        
        // Update certificate with revocation info
        const updatedCertificate = {
            ...certificate,
            status: 'revoked',
            revokedAt: new Date().toISOString(),
            revokedBy: revokedBy,
            revokedReason: reason
        };
        
        // Try to update on backend first
        let backendSuccess = false;
        if (navigator.onLine && certificate.isFromBackend) {
            try {
                const res = await fetch(`${backendUrl}/api/certificates/${certificateId}`, {
                    method: 'PUT',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        status: 'revoked',
                        revokedAt: updatedCertificate.revokedAt,
                        revokedBy: revokedBy,
                        revokedReason: reason
                    })
                });
                
                if (res.ok) {
                    backendSuccess = true;
                } else {
                    console.warn('Backend update failed, will sync later');
                }
            } catch (error) {
                console.warn('Backend request failed, will sync later:', error);
            }
        }
        
        // Update local data
        const certificateIndex = currentCertificates.findIndex(c => (c._id || c.id) === certificateId);
        if (certificateIndex !== -1) {
            currentCertificates[certificateIndex] = updatedCertificate;
        }
        
        // Save to local storage
        const localCertificates = getLocalCertificates();
        const localIndex = localCertificates.findIndex(c => (c._id || c.id) === certificateId);
        if (localIndex !== -1) {
            localCertificates[localIndex] = updatedCertificate;
        } else {
            localCertificates.push(updatedCertificate);
        }
        saveLocalCertificates(localCertificates);
        
        // Add to pending sync if backend update failed
        if (!backendSuccess && certificate.isFromBackend) {
            const pendingSync = getPendingSync();
            pendingSync.certificateUpdates.push(updatedCertificate);
            savePendingSync(pendingSync);
        }
        
        // Close modal and refresh
        document.querySelector('.modal').remove();
        await loadCertificates();
        await loadDashboard();
        
        showMessage(`Certificate ${certificate.number} has been revoked successfully!`, 'success');
        
    } catch (error) {
        console.error('Revoke certificate error:', error);
        showMessage('Failed to revoke certificate: ' + error.message, 'error');
    }
}

// Enhanced delete certificate function
async function deleteCertificate(certificateId) {
    if (!confirm('Are you sure you want to delete this certificate?\n\nThis action cannot be undone!')) {
        return;
    }
    
    try {
        showMessage('Deleting certificate...', 'success');
        
        const certificate = currentCertificates.find(c => (c._id || c.id) === certificateId);
        if (!certificate) {
            showMessage('Certificate not found', 'error');
            return;
        }
        
        // Try to delete from backend if it's a backend certificate
        let backendSuccess = false;
        if (navigator.onLine && certificate.isFromBackend) {
            try {
                const res = await fetch(`${backendUrl}/api/certificates/${certificateId}`, {
                    method: 'DELETE',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                
                if (res.ok) {
                    backendSuccess = true;
                } else {
                    console.warn('Backend deletion failed');
                }
            } catch (error) {
                console.warn('Backend request failed:', error);
            }
        }
        
        // Remove from local data
        currentCertificates = currentCertificates.filter(c => (c._id || c.id) !== certificateId);
        
        // Remove from local storage
        const localCertificates = getLocalCertificates();
        const filteredLocal = localCertificates.filter(c => (c._id || c.id) !== certificateId);
        saveLocalCertificates(filteredLocal);
        
        await loadCertificates();
        await loadDashboard();
        
        showMessage('Certificate deleted successfully!', 'success');
        
    } catch (error) {
        console.error('Delete certificate error:', error);
        showMessage('Network error while deleting certificate', 'error');
    }
}

// Download certificate as JPG function
async function downloadCertificateById(certificateId) {
    try {
        const certificate = currentCertificates.find(c => (c._id || c.id) === certificateId);
        if (!certificate) {
            showMessage('Certificate not found', 'error');
            return;
        }

        // Create canvas for certificate design
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Set canvas size (standard certificate dimensions)
        canvas.width = 1200;
        canvas.height = 800;
        
        // Background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Border
        ctx.strokeStyle = '#2c3e50';
        ctx.lineWidth = 8;
        ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);
        
        // Inner border
        ctx.strokeStyle = '#3498db';
        ctx.lineWidth = 2;
        ctx.strokeRect(40, 40, canvas.width - 80, canvas.height - 80);
        
        // Header
        ctx.fillStyle = '#2c3e50';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('CERTIFICATE', canvas.width / 2, 120);
        
        // Certificate type/title
        ctx.font = 'bold 32px Arial';
        ctx.fillStyle = '#3498db';
        ctx.fillText(certificate.title || 'OF MEMBERSHIP', canvas.width / 2, 180);
        
        // "This is to certify that" text
        ctx.font = '24px Arial';
        ctx.fillStyle = '#2c3e50';
        ctx.fillText('This is to certify that', canvas.width / 2, 250);
        
        // Recipient name (larger, prominent)
        ctx.font = 'bold 42px Arial';
        ctx.fillStyle = '#e74c3c';
        ctx.fillText(certificate.recipient || 'N/A', canvas.width / 2, 320);
        
        // Description or achievement text
        ctx.font = '20px Arial';
        ctx.fillStyle = '#2c3e50';
        const description = certificate.description || 'has been awarded this certificate of membership';
        
        // Word wrap for description
        const words = description.split(' ');
        let line = '';
        let y = 380;
        const maxWidth = canvas.width - 200;
        
        for (let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + ' ';
            const metrics = ctx.measureText(testLine);
            const testWidth = metrics.width;
            
            if (testWidth > maxWidth && n > 0) {
                ctx.fillText(line, canvas.width / 2, y);
                line = words[n] + ' ';
                y += 30;
            } else {
                line = testLine;
            }
        }
        ctx.fillText(line, canvas.width / 2, y);
        
        // Certificate details section
        y += 80;
        ctx.font = '18px Arial';
        ctx.fillStyle = '#7f8c8d';
        
        // Certificate number
        ctx.textAlign = 'left';
        ctx.fillText(`Certificate No: ${certificate.number || 'N/A'}`, 100, y);
        
        // Issue date
        ctx.textAlign = 'right';
        const issueDate = certificate.issueDate ? new Date(certificate.issueDate).toLocaleDateString() : 'N/A';
        ctx.fillText(`Issue Date: ${issueDate}`, canvas.width - 100, y);
        
        // Status (if not active, show it)
        if (certificate.status && certificate.status !== 'active') {
            y += 30;
            ctx.textAlign = 'center';
            ctx.fillStyle = certificate.status === 'revoked' ? '#e74c3c' : '#f39c12';
            ctx.font = 'bold 20px Arial';
            ctx.fillText(`STATUS: ${certificate.status.toUpperCase()}`, canvas.width / 2, y);
            
            if (certificate.status === 'revoked' && certificate.revokedReason) {
                y += 25;
                ctx.font = '16px Arial';
                ctx.fillText(`Reason: ${certificate.revokedReason}`, canvas.width / 2, y);
            }
        }
        
        // Footer signature area
        const footerY = canvas.height - 120;
        ctx.strokeStyle = '#2c3e50';
        ctx.lineWidth = 1;
        
        // Signature line
        ctx.beginPath();
        ctx.moveTo(canvas.width - 300, footerY);
        ctx.lineTo(canvas.width - 100, footerY);
        ctx.stroke();
        
        ctx.fillStyle = '#2c3e50';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Authorized Signature', canvas.width - 200, footerY + 20);
        
        // Organization name/footer
        ctx.font = '14px Arial';
        ctx.fillStyle = '#7f8c8d';
        ctx.textAlign = 'center';
        ctx.fillText('NARAP - National Association', canvas.width / 2, canvas.height - 40);
        
        // Convert canvas to JPG blob
        canvas.toBlob((blob) => {
            if (!blob) {
                showMessage('Failed to generate certificate image', 'error');
                return;
            }
            
            // Create download link
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `certificate_${certificate.number}_${new Date().toISOString().split('T')[0]}.jpg`;
            link.click();
            
            // Clean up
            URL.revokeObjectURL(link.href);
            
            showMessage('Certificate downloaded successfully as JPG!', 'success');
            
        }, 'image/jpeg', 0.9); // JPG format with 90% quality
        
    } catch (error) {
        console.error('Download certificate error:', error);
        showMessage('Failed to download certificate: ' + error.message, 'error');
    }
}


// Enhanced view certificate function
function viewCertificate(certificateId) {
    const certificate = currentCertificates.find(c => (c._id || c.id) === certificateId);
    if (!certificate) {
        showMessage('Certificate not found', 'error');
        return;
    }
    
    // Generate certificate content for viewing
    const certificateContent = document.getElementById('viewCertificateContent');
    if (!certificateContent) {
        showMessage('Certificate view container not found', 'error');
        return;
    }
    
    // Add revoked watermark if certificate is revoked
    const revokedWatermark = certificate.status === 'revoked' ? `
        <div class="revoked-watermark" style="
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 72px;
            font-weight: bold;
            color: rgba(220, 53, 69, 0.3);
            z-index: 1;
            pointer-events: none;
            user-select: none;
        ">REVOKED</div>
    ` : '';
    
    certificateContent.innerHTML = `
        <div class="certificate-view" style="position: relative; border: 3px solid #DAA520; padding: 30px; text-align: center; background: white; margin: 10px 0; max-width: 600px;">
            ${revokedWatermark}
            <div class="certificate-header" style="margin-bottom: 30px; position: relative; z-index: 2;">
                <img src="images/narap-logo.jpg" alt="NARAP Logo" class="cert-logo" style="width: 80px; height: 80px; margin-bottom: 15px;">
                <h2 style="margin: 10px 0; color: #333; font-size: 24px;">NARAP</h2>
                <p style="font-size: 14px; color: #666; margin: 0;">Nigerian Association of Refrigeration And Air Conditioning Practitioners</p>
            </div>
            
            <div class="certificate-body" style="position: relative; z-index: 2;">
                <h1 style="color: #DAA520; margin: 20px 0; font-size: 28px;">${escapeHtml(certificate.title)}</h1>
                <p style="font-size: 18px; margin: 15px 0;">This is to certify that</p>
                <h3 style="color: #333; margin: 20px 0; font-size: 24px; text-decoration: underline;">${escapeHtml(certificate.recipient)}</h3>
                
                ${certificate.description ? `
                    <p style="font-size: 16px; margin: 20px 0; font-style: italic;">${escapeHtml(certificate.description)}</p>
                ` : ''}
                
                <p style="font-size: 16px; margin: 15px 0;">has been awarded this certificate</p>
                
                <div class="certificate-details" style="margin-top: 40px; display: flex; justify-content: space-between; text-align: left;">
                    <div style="flex: 1;">
                        <p style="font-size: 14px; margin: 5px 0;"><strong>Certificate No:</strong> ${escapeHtml(certificate.number)}</p>
                        <p style="font-size: 14px; margin: 5px 0;"><strong>Type:</strong> ${escapeHtml(certificate.type || 'membership')}</p>
                        <p style="font-size: 14px; margin: 5px 0;"><strong>Status:</strong> 
                            <span style="${getStatusColor(certificate.status || 'active')}">${certificate.status || 'active'}</span>
                        </p>
                    </div>
                    <div style="flex: 1; text-align: right;">
                        <p style="font-size: 14px; margin: 5px 0;"><strong>Date Issued:</strong> ${formatDate(certificate.issueDate)}</p>
                        ${certificate.validUntil ? `
                            <p style="font-size: 14px; margin: 5px 0;"><strong>Valid Until:</strong> ${formatDate(certificate.validUntil)}</p>
                        ` : ''}
                        <p style="font-size: 14px; margin: 5px 0;"><strong>Serial:</strong> ${escapeHtml(certificate.serialNumber || 'N/A')}</p>
                    </div>
                </div>
                
                ${certificate.status === 'revoked' && certificate.revokedAt ? `
                    <div class="revocation-info" style="margin-top: 20px; padding: 15px; background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 5px; position: relative; z-index: 2;">
                        <p style="color: #721c24; margin: 5px 0; font-weight: bold;">Certificate Revoked</p>
                        <p style="color: #721c24; margin: 5px 0; font-size: 12px;">Revoked on: ${formatDate(certificate.revokedAt)}</p>
                        ${certificate.revokedBy ? `<p style="color: #721c24; margin: 5px 0; font-size: 12px;">Revoked by: ${escapeHtml(certificate.revokedBy)}</p>` : ''}
                                                ${certificate.revokedReason ? `<p style="color: #721c24; margin: 5px 0; font-size: 12px;">Reason: ${escapeHtml(certificate.revokedReason)}</p>` : ''}
                    </div>
                ` : ''}
            </div>
            
            <div class="certificate-footer" style="margin-top: 40px; border-top: 1px solid #ddd; padding-top: 20px; position: relative; z-index: 2;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="text-align: left;">
                        <div style="border-bottom: 1px solid #333; width: 200px; margin-bottom: 5px;"></div>
                        <p style="font-size: 12px; margin: 0;">Authorized Signature</p>
                    </div>
                    <div style="text-align: right;">
                        <div style="border-bottom: 1px solid #333; width: 200px; margin-bottom: 5px;"></div>
                        <p style="font-size: 12px; margin: 0;">Official Seal</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('viewCertificateModal').style.display = 'block';
}

// View ID Card function
function viewIdCard(memberId) {
    const member = currentMembers.find(m => m._id === memberId);
    if (!member) {
        showMessage('Member not found', 'error');
        return;
    }
    
    // Generate ID card content
    const idCardContent = document.getElementById('viewIdCardContent');
    if (!idCardContent) {
        showMessage('ID card view container not found', 'error');
        return;
    }
    
    idCardContent.innerHTML = `
        <div class="id-card" style="border: 2px solid #333; padding: 20px; max-width: 400px; margin: 0 auto; background: white;">
            <div class="id-card-header" style="text-align: center; margin-bottom: 20px; border-bottom: 1px solid #ddd; padding-bottom: 15px;">
                <img src="images/narap-logo.jpg" alt="NARAP Logo" class="id-logo" style="width: 60px; height: 60px; margin-bottom: 10px;">
                <div class="id-title">
                    <h3 style="margin: 5px 0; color: #333;">NARAP</h3>
                    <p style="font-size: 12px; color: #666; margin: 0;">Nigerian Association of Refrigeration<br>And Air Conditioning Practitioners</p>
                </div>
            </div>
            <div class="id-card-body" style="display: flex; gap: 15px; align-items: flex-start;">
                <div class="id-photo" style="flex-shrink: 0;">
                    <img src="${member.passport || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiBmaWxsPSIjRjBGMEYwIi8+Cjx0ZXh0IHg9IjUwIiB5PSI1NSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiBmaWxsPSIjOTk5IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5QaG90bzwvdGV4dD4KPC9zdmc+'}" 
                         alt="Photo" 
                         style="width: 80px; height: 100px; object-fit: cover; border: 1px solid #ddd;">
                </div>
                <div class="id-details" style="flex: 1;">
                    <h4 style="margin: 0 0 10px 0; color: #333; font-size: 16px;">${escapeHtml(member.name)}</h4>
                    <p style="margin: 5px 0; font-size: 12px;"><strong>Code:</strong> ${escapeHtml(member.code || 'N/A')}</p>
                    <p style="margin: 5px 0; font-size: 12px;"><strong>Position:</strong> ${escapeHtml(member.position || 'MEMBER')}</p>
                    <p style="margin: 5px 0; font-size: 12px;"><strong>State:</strong> ${escapeHtml(member.state || 'N/A')}</p>
                    <p style="margin: 5px 0; font-size: 12px;"><strong>Zone:</strong> ${escapeHtml(member.zone || 'N/A')}</p>
                    <p style="margin: 5px 0; font-size: 12px;"><strong>Email:</strong> ${escapeHtml(member.email || 'N/A')}</p>
                </div>
            </div>
            <div class="id-card-footer" style="margin-top: 20px; border-top: 1px solid #ddd; padding-top: 15px;">
                <div class="signature-area" style="text-align: center;">
                    ${member.signature ? `<img src="${member.signature}" alt="Signature" class="signature" style="width: 100px; height: 40px; object-fit: contain;">` : '<div style="height: 40px; border-bottom: 1px solid #999; width: 150px; margin: 0 auto;"></div>'}
                    <p style="font-size: 10px; color: #666; margin: 5px 0 0 0;">Member Signature</p>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('viewIdCardModal').style.display = 'block';
}

// Load analytics tab
function loadAnalytics() {
    showMessage('Analytics data loaded', 'success');
}

// Load system info
function loadSystemInfo() {
    const elements = {
        'dbSize': '15.2 MB',
        'lastBackup': 'Never',
        'lastSync': formatDate(new Date()),
        'serverStatus': 'Online'
    };
    
    Object.entries(elements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    });
    
    const logsDiv = document.getElementById('systemLogs');
    if (logsDiv) {
        logsDiv.innerHTML = `
            <div class="log-item" style="padding: 10px; border-bottom: 1px solid #eee;">
                <span class="log-time" style="color: #666; font-size: 12px;">${formatDate(new Date())}</span>
                <span class="log-level info" style="background: #e3f2fd; padding: 2px 8px; border-radius: 4px; font-size: 12px; margin: 0 10px;">INFO</span>
                <span class="log-message">System initialized successfully</span>
            </div>
            <div class="log-item" style="padding: 10px; border-bottom: 1px solid #eee;">
                <span class="log-time" style="color: #666; font-size: 12px;">${formatDate(new Date(Date.now() - 3600000))}</span>
                <span class="log-level success" style="background: #e8f5e8; padding: 2px 8px; border-radius: 4px; font-size: 12px; margin: 0 10px;">SUCCESS</span>
                <span class="log-message">Database connection established</span>
            </div>
        `;
    }
}

// Modal functions
function showAddMemberModal() {
    document.getElementById('addMemberModal').style.display = 'block';
}

function closeAddMemberModal() {
    document.getElementById('addMemberModal').style.display = 'none';
    document.getElementById('addMemberForm').reset();
    const strengthDiv = document.getElementById('passwordStrength');
    if (strengthDiv) strengthDiv.innerHTML = '';
}

function showEditMemberModal() {
    document.getElementById('editMemberModal').style.display = 'block';
}

function closeEditMemberModal() {
    document.getElementById('editMemberModal').style.display = 'none';
    document.getElementById('editMemberForm').reset();
}

function showIssueCertificateModal() {
    const certNumber = 'NARAP-' + Date.now();
    document.getElementById('certificateNumber').value = certNumber;
    document.getElementById('certificateIssueDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('issueCertificateModal').style.display = 'block';
}

function closeIssueCertificateModal() {
    document.getElementById('issueCertificateModal').style.display = 'none';
    document.getElementById('issueCertificateForm').reset();
}

function showImportModal() {
    document.getElementById('importModal').style.display = 'block';
}

function closeImportModal() {
    document.getElementById('importModal').style.display = 'none';
}

function showRestoreModal() {
    document.getElementById('restoreModal').style.display = 'block';
}

function closeRestoreModal() {
    document.getElementById('restoreModal').style.display = 'none';
}

function closeViewIdCardModal() {
    document.getElementById('viewIdCardModal').style.display = 'none';
}

function closeViewCertificateModal() {
    document.getElementById('viewCertificateModal').style.display = 'none';
}

function closeConfirmModal() {
    document.getElementById('confirmModal').style.display = 'none';
}

// Member management functions
// Update the addMember function to handle optional email
async function addMember() {
    try {
        const validation = validateMemberForm();
        if (!validation.isValid) {
            showMessage('Please fix the following errors:\n' + validation.errors.join('\n'), 'error');
            return;
        }
        
        const memberData = {
            name: document.getElementById('memberName').value.trim(),
            code: document.getElementById('memberCode').value.trim(),
            password: document.getElementById('memberPassword').value,
            position: document.getElementById('memberPosition').value,
            state: document.getElementById('memberState').value.trim(),
            zone: document.getElementById('memberZone').value.trim(),
            passportPhoto: document.getElementById('passportPreview')?.src || '',
            signature: document.getElementById('signaturePreview')?.src || ''
        };
        
        // Only add email if provided
        const email = document.getElementById('memberEmail').value.trim();
        if (email) {
            memberData.email = email;
        }
        
        showMessage('Adding member...', 'info');
        
        const response = await fetch(`${backendUrl}/api/addUser`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(memberData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showMessage('Member added successfully!', 'success');
            
            // Clear the form
            document.getElementById('addMemberForm').reset();
            clearImagePreviews();
            
            // Reload members to show the new addition
            await loadUsers();
            
            // Close modal if it exists
            const modal = document.getElementById('addMemberModal');
            if (modal) {
                modal.style.display = 'none';
            }
            
        } else {
            showMessage(result.message || 'Failed to add member', 'error');
        }
        
    } catch (error) {
        console.error('Add member error:', error);
        showMessage('Failed to add member: ' + error.message, 'error');
    }
}

// Make sure the function is globally accessible
window.addMember = addMember;



async function updateMember(event) {
    event.preventDefault();
    
    const memberId = document.getElementById('editMemberId').value;
    const formData = {
        name: document.getElementById('editMemberName').value.trim(),
        email: document.getElementById('editMemberEmail').value.trim(),
        code: document.getElementById('editMemberCode').value.trim(),
        position: document.getElementById('editMemberPosition').value,
        state: document.getElementById('editMemberState').value.trim(),
        zone: document.getElementById('editMemberZone').value.trim()
    };
    
    try {
        showMessage('Updating member...', 'success');
        
        const res = await fetch(`${backendUrl}/api/updateUser/${memberId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(formData)
        });
        
        if (res.ok) {
            showMessage('Member updated successfully!', 'success');
            closeEditMemberModal();
            await loadMembers();
        } else {
            const errorData = await res.json().catch(() => ({}));
            showMessage('Failed to update member: ' + (errorData.message || 'Unknown error'), 'error');
        }
    } catch (error) {
        console.error('Update member error:', error);
        showMessage('Network error while updating member', 'error');
    }
}

async function deleteMember(id) {
    if (!confirm('Are you sure you want to delete this member? This will also delete their passport photo.')) return;
    
    try {
        showMessage('Deleting member...', 'info');
        
        const res = await fetchWithTimeout(`${backendUrl}/api/deleteUser/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
            credentials: 'include'
        }, 10000);
        
        const data = await res.json();
        
        if (res.ok) {
            showMessage('Member deleted successfully!', 'success');
            await loadMembers(); // Refresh the members table
            await loadDashboard(); // Refresh the dashboard if needed
        } else {
            showMessage(data.message || 'Failed to delete member', 'error');
        }
        
    } catch (error) {
        console.error('Delete member error:', error);
        
        let errorMessage = 'Failed to delete member: ' + error.message;
        if (error.name === 'AbortError') {
            errorMessage = 'Request timed out while deleting member. Please try again.';
        }
        
        showMessage(errorMessage, 'error');
    }
}





function filterMembers() {
    const searchValue = document.getElementById('memberSearch')?.value?.toLowerCase().trim() || '';
    const positionFilter = document.getElementById('positionFilter')?.value || '';
    const stateFilter = document.getElementById('stateFilter')?.value || '';
    const rows = document.querySelectorAll('#membersTableBody tr');
    
    let visibleCount = 0;
    let totalCount = 0;
    
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        
        // Skip if it's a loading row or doesn't have enough cells
        if (cells.length < 6) {
            return;
        }
        
        totalCount++;
        
        // Get text content from cells (removing extra whitespace and HTML tags)
        const name = cells[1].textContent.trim();
        const email = cells[2].textContent.trim();
        const code = cells[3].textContent.trim();
        const position = cells[4].textContent.trim();
        const state = cells[5].textContent.trim();
        
        let showRow = true;
        
        // Search filter (check name, email, and code)
        if (searchValue) {
            const matchesSearch = 
                name.toLowerCase().includes(searchValue) ||
                email.toLowerCase().includes(searchValue) ||
                code.toLowerCase().includes(searchValue);
            
            if (!matchesSearch) {
                showRow = false;
            }
        }
        
        // Position filter
        if (positionFilter && position !== positionFilter) {
            showRow = false;
        }
        
        // State filter
        if (stateFilter && state !== stateFilter) {
            showRow = false;
        }
        
        // Show/hide the row
        row.style.display = showRow ? '' : 'none';
        
        if (showRow) {
            visibleCount++;
        }
    });
    
    // Show filter results message
    if (searchValue || positionFilter || stateFilter) {
        showMessage(`Showing ${visibleCount} of ${totalCount} members`, 'info');
    }
    
    // Handle empty results
    if (visibleCount === 0 && totalCount > 0) {
        // Check if there's already a "no results" row
        const existingNoResults = document.querySelector('#membersTableBody .no-results-row');
        if (!existingNoResults) {
            const noResultsRow = document.createElement('tr');
            noResultsRow.className = 'no-results-row';
            noResultsRow.innerHTML = `
                <td colspan="7" style="text-align: center; padding: 40px; color: #666;">
                    <i class="fas fa-search" style="font-size: 48px; margin-bottom: 15px; opacity: 0.3;"></i>
                    <div>No members found matching your criteria</div>
                    <div style="font-size: 14px; margin-top: 10px;">Try adjusting your search or filter options</div>
                </td>
            `;
            document.getElementById('membersTableBody').appendChild(noResultsRow);
        }
    } else {
        // Remove "no results" row if it exists
        const existingNoResults = document.querySelector('#membersTableBody .no-results-row');
        if (existingNoResults) {
            existingNoResults.remove();
        }
    }
}

// Enhanced search function that works with your existing filter
function searchMembers(searchValue) {
    const searchInput = document.getElementById('memberSearch');
    if (searchInput) {
        searchInput.value = searchValue;
    }
    filterMembers();
}

// Clear all filters function
function clearMemberFilters() {
    const searchInput = document.getElementById('memberSearch');
    const positionFilter = document.getElementById('positionFilter');
    const stateFilter = document.getElementById('stateFilter');
    
    if (searchInput) searchInput.value = '';
    if (positionFilter) positionFilter.value = '';
    if (stateFilter) stateFilter.value = '';
    
    filterMembers();
    showMessage('All filters cleared', 'info');
}

// Make functions globally accessible
window.filterMembers = filterMembers;
window.searchMembers = searchMembers;
window.clearMemberFilters = clearMemberFilters;

// Enhanced filter function with visual feedback
function filterCertificates() {
    const searchInput = document.getElementById('certificateSearch');
    const statusFilter = document.getElementById('certificateStatusFilter');
    const typeFilter = document.getElementById('certificateTypeFilter');
    const stateFilter = document.getElementById('certificateStateFilter');
    
    const searchValue = searchInput?.value?.toLowerCase().trim() || '';
    const statusValue = statusFilter?.value?.toLowerCase() || '';
    const typeValue = typeFilter?.value?.toLowerCase() || '';
    const stateValue = stateFilter?.value || '';
    
    // Add visual feedback for active filters
    [searchInput, statusFilter, typeFilter, stateFilter].forEach(element => {
        if (element) {
            if (element.value) {
                element.classList.add('filter-active');
            } else {
                element.classList.remove('filter-active');
            }
        }
    });
    
    const rows = document.querySelectorAll('#certificatesTableBody tr');
    let visibleCount = 0;
    let totalCount = 0;
    
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        
        // Skip if it's a loading row or doesn't have enough cells
        if (cells.length < 6) {
            return;
        }
        
        totalCount++;
        
        // Get text content from cells
        const certificateNumber = cells[0].textContent.trim();
        const recipientCell = cells[1];
        const recipient = recipientCell.textContent.trim();
        const title = cells[2].textContent.trim();
        const issueDate = cells[3].textContent.trim();
        const status = cells[4].textContent.trim().toLowerCase();
        
        // Extract state from recipient info
        let recipientState = '';
        const recipientHTML = recipientCell.innerHTML;
        const stateMatch = recipientHTML.match(/•\s*([^<]+)/);
        if (stateMatch) {
            recipientState = stateMatch[1].trim();
        }
        
        // Extract type from title
        let certificateType = '';
        const titleLower = title.toLowerCase();
        if (titleLower.includes('membership')) certificateType = 'membership';
        else if (titleLower.includes('achievement')) certificateType = 'achievement';
        else if (titleLower.includes('training')) certificateType = 'training';
        else if (titleLower.includes('recognition')) certificateType = 'recognition';
        else if (titleLower.includes('service')) certificateType = 'service';
        
        let showRow = true;
        
        // Search filter
        if (searchValue) {
            const matchesSearch = 
                certificateNumber.toLowerCase().includes(searchValue) ||
                recipient.toLowerCase().includes(searchValue) ||
                title.toLowerCase().includes(searchValue);
            
            if (!matchesSearch) {
                showRow = false;
            }
        }
        
        // Status filter
        if (statusValue && !status.includes(statusValue)) {
            showRow = false;
        }
        
        // Type filter
        if (typeValue && certificateType !== typeValue) {
            showRow = false;
        }
        
        // State filter
        if (stateValue && recipientState !== stateValue) {
            showRow = false;
        }
        
        // Show/hide the row
        row.style.display = showRow ? '' : 'none';
        
        if (showRow) {
            visibleCount++;
        }
    });
    
    // Update filter results counter
    updateFilterCounter(visibleCount, totalCount, searchValue, statusValue, typeValue, stateValue);
    
    // Handle empty results
    handleEmptyResults(visibleCount, totalCount, 'certificatesTableBody');
}

// Function to update filter counter with more details
function updateFilterCounter(visibleCount, totalCount, searchValue, statusValue, typeValue, stateValue) {
    const activeFilters = [];
    if (searchValue) activeFilters.push(`search: "${searchValue}"`);
    if (statusValue) activeFilters.push(`status: ${statusValue}`);
    if (typeValue) activeFilters.push(`type: ${typeValue}`);
    if (stateValue) activeFilters.push(`state: ${stateValue}`);
    
    if (activeFilters.length > 0) {
        const filterText = activeFilters.join(', ');
        showMessage(`Showing ${visibleCount} of ${totalCount} certificates (${filterText})`, 'info');
    }
}

// Enhanced clear filters with animation
function clearCertificateFilters() {
    const elements = [
        document.getElementById('certificateSearch'),
        document.getElementById('certificateStatusFilter'),
        document.getElementById('certificateTypeFilter'),
        document.getElementById('certificateStateFilter')
    ];
    
    elements.forEach(element => {
        if (element) {
            element.value = '';
            element.classList.remove('filter-active');
            
            // Add a subtle animation
            element.style.transform = 'scale(0.95)';
            setTimeout(() => {
                element.style.transform = 'scale(1)';
            }, 150);
        }
    });
    
    filterCertificates();
    showMessage('All certificate filters cleared', 'success');
}


// Enhanced search function (for backward compatibility)
function searchCertificates(searchTerm) {
    const searchInput = document.getElementById('certificateSearch');
    if (searchInput) {
        searchInput.value = searchTerm;
    }
    filterCertificates();
}


// Helper function to handle empty results
function handleEmptyResults(visibleCount, totalCount, tableBodyId) {
    const tableBody = document.getElementById(tableBodyId);
    if (!tableBody) return;
    
    // Remove existing "no results" row
    const existingNoResults = tableBody.querySelector('.no-results-row');
    if (existingNoResults) {
        existingNoResults.remove();
    }
    
    // Add "no results" row if needed
    if (visibleCount === 0 && totalCount > 0) {
        const noResultsRow = document.createElement('tr');
        noResultsRow.className = 'no-results-row';
        noResultsRow.innerHTML = `
            <td colspan="6" style="text-align: center; padding: 40px; color: #666;">
                <i class="fas fa-search" style="font-size: 48px; margin-bottom: 15px; opacity: 0.3;"></i>
                <div>No certificates found matching your criteria</div>
                <div style="font-size: 14px; margin-top: 10px;">Try adjusting your search or filter options</div>
            </td>
        `;
        tableBody.appendChild(noResultsRow);
    }
}

// Make functions globally accessible
window.filterCertificates = filterCertificates;
window.searchCertificates = searchCertificates;
window.clearCertificateFilters = clearCertificateFilters;


// Make functions globally accessible
window.confirmRevocation = confirmRevocation;
window.deleteCertificate = deleteCertificate;
window.downloadCertificateById = downloadCertificateById;
window.revokeCertificate = revokeCertificate; // If you have this function
window.viewCertificate = viewCertificate; // If you have this function


// Enhanced issue certificate function

async function issueCertificate(event) {
    event.preventDefault();
    
    const formData = {
        number: document.getElementById('certificateNumber').value.trim(),
        serialNumber: document.getElementById('certificateSerialNumber').value.trim(), // Manual serial number
        recipient: document.getElementById('certificateRecipient').value.trim(),
        email: document.getElementById('certificateEmail').value.trim(),
        title: document.getElementById('certificateTitle').value.trim(),
        type: document.getElementById('certificateType').value,
        issueDate: document.getElementById('certificateIssueDate').value,
        validUntil: document.getElementById('certificateValidUntil').value || null,
        description: document.getElementById('certificateDescription').value.trim(),
        position: document.getElementById('certificatePosition').value.trim(),
        code: document.getElementById('certificateCode').value.trim(),
        state: document.getElementById('certificateState').value.trim()
    };
    
    console.log('Issue certificate form data:', formData);
    
    // Validation - now includes serial number
    if (!formData.number || !formData.serialNumber || !formData.recipient || !formData.email || !formData.title || !formData.type || !formData.issueDate) {
        const missingFields = [];
        if (!formData.number) missingFields.push('Certificate Number');
        if (!formData.serialNumber) missingFields.push('Serial Number');
        if (!formData.recipient) missingFields.push('Recipient Name');
        if (!formData.email) missingFields.push('Recipient Email');
        if (!formData.title) missingFields.push('Certificate Title');
        if (!formData.type) missingFields.push('Certificate Type');
        if (!formData.issueDate) missingFields.push('Issue Date');
        
        showMessage(`Please fill in all required fields: ${missingFields.join(', ')}`, 'error');
        return;
    }
    
    // Email validation
    if (!validateEmail(formData.email)) {
        showMessage('Please enter a valid email address', 'error');
        return;
    }
    
    try {
        showMessage('Issuing certificate...', 'info');
        
        // Create certificate data - use manual serial number instead of generating
        const certificateData = {
            ...formData,
            status: 'active',
            createdAt: new Date().toISOString(),
            id: generateCertificateId(),
            recipientCode: formData.code || 'N/A',
            recipientPosition: formData.position || 'Member',
            recipientState: formData.state || 'N/A'
        };
        
        console.log('Certificate data to save:', certificateData);
        
        // Try to save to backend first
        let backendSuccess = false;
        if (navigator.onLine && window.backendUrl) {
            try {
                const res = await fetch(`${window.backendUrl}/api/certificates`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...getAuthHeaders()
                    },
                    credentials: 'include',
                    body: JSON.stringify(certificateData)
                });
                
                if (res.ok) {
                    const result = await res.json();
                    certificateData._id = result._id || result.id;
                    certificateData.isFromBackend = true;
                    backendSuccess = true;
                    console.log('Certificate saved to backend successfully');
                } else {
                    console.warn('Backend save failed, saving locally');
                }
            } catch (error) {
                console.warn('Backend request failed, saving locally:', error);
            }
        }
        
        // Save to local storage
        const localCertificates = getLocalCertificates();
        localCertificates.push({
            ...certificateData,
            isFromBackend: backendSuccess
        });
        saveLocalCertificates(localCertificates);
        
        // Add to pending sync if backend failed
        if (!backendSuccess) {
            const pendingSync = getPendingSync();
            if (!pendingSync.certificateCreations) {
                pendingSync.certificateCreations = [];
            }
            pendingSync.certificateCreations.push(certificateData);
            savePendingSync(pendingSync);
        }
        
        showMessage('Certificate issued successfully!', 'success');
        closeIssueCertificateModal();
        
        // Clear form
        document.getElementById('issueCertificateForm').reset();
        document.getElementById('certificatePreview').classList.add('hidden');
        
        // Set default issue date to today for next use
        const issueDateField = document.getElementById('certificateIssueDate');
        if (issueDateField) {
            issueDateField.value = new Date().toISOString().split('T')[0];
        }
        
        if (typeof loadCertificates === 'function') {
            await loadCertificates();
        }
        if (typeof refreshCertificates === 'function') {
            refreshCertificates();
        }
        if (typeof loadDashboard === 'function') {
            await loadDashboard();
        }
        
    } catch (error) {
        console.error('Issue certificate error:', error);
        showMessage('Error issuing certificate: ' + error.message, 'error');
    }
}


// Make sure it's globally accessible
window.issueCertificate = issueCertificate;


// Helper functions for certificate management
function generateSerialNumber() {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `SN${timestamp.slice(-8)}${random}`;
}

function generateCertificateId() {
    return 'cert_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Add these new helper functions to your JavaScript file

// Enhanced member lookup function
window.findMemberByEmail = function(email) {
    try {
        const members = JSON.parse(localStorage.getItem('narap_members') || '[]');
        console.log('Looking for email:', email);
        console.log('Available members:', members.map(m => ({ name: m.name, email: m.email })));
        
        if (!email || !email.trim()) {
            console.log('No email provided');
            return null;
        }
        
        const searchEmail = email.trim().toLowerCase();
        
        // Try exact match first
        let member = members.find(m => m.email && m.email.trim().toLowerCase() === searchEmail);
        
        if (!member) {
            // Try partial match
            member = members.find(m => m.email && m.email.trim().toLowerCase().includes(searchEmail));
        }
        
        if (!member) {
            // Try reverse partial match
            member = members.find(m => m.email && searchEmail.includes(m.email.trim().toLowerCase()));
        }
        
        console.log('Found member:', member);
        return member;
    } catch (error) {
        console.error('Error finding member:', error);
        return null;
    }
};

// Enhanced certificate preview function

window.generateCertificatePreview = function() {
    console.log('Generate certificate preview called');
    
    try {
        // Get form values including manual serial number
        const certificateNumber = document.getElementById('certificateNumber')?.value?.trim();
        const certificateSerialNumber = document.getElementById('certificateSerialNumber')?.value?.trim();
        const certificateRecipient = document.getElementById('certificateRecipient')?.value?.trim();
        const certificateEmail = document.getElementById('certificateEmail')?.value?.trim();
        const certificateTitle = document.getElementById('certificateTitle')?.value?.trim();
        const certificateType = document.getElementById('certificateType')?.value?.trim();
        const certificateIssueDate = document.getElementById('certificateIssueDate')?.value;
        const certificateValidUntil = document.getElementById('certificateValidUntil')?.value;
        const certificateDescription = document.getElementById('certificateDescription')?.value?.trim();
        const certificatePosition = document.getElementById('certificatePosition')?.value?.trim();
        const certificateCode = document.getElementById('certificateCode')?.value?.trim();
        const certificateState = document.getElementById('certificateState')?.value?.trim();
        
        console.log('Form values:', {
            certificateNumber,
            certificateSerialNumber,
            certificateRecipient,
            certificateEmail,
            certificateTitle,
            certificateType,
            certificateIssueDate
        });
        
        // Validate required fields including serial number
        if (!certificateNumber || !certificateSerialNumber || !certificateRecipient || !certificateEmail || !certificateTitle || !certificateType || !certificateIssueDate) {
            const missingFields = [];
            if (!certificateNumber) missingFields.push('Certificate Number');
            if (!certificateSerialNumber) missingFields.push('Serial Number');
            if (!certificateRecipient) missingFields.push('Recipient Name');
            if (!certificateEmail) missingFields.push('Recipient Email');
            if (!certificateTitle) missingFields.push('Certificate Title');
            if (!certificateType) missingFields.push('Certificate Type');
            if (!certificateIssueDate) missingFields.push('Issue Date');
            
            showMessage(`Please fill in all required fields: ${missingFields.join(', ')}`, 'error');
            return;
        }
        
        // Validate email format
        if (!validateEmail(certificateEmail)) {
            showMessage('Please enter a valid email address', 'error');
            return;
        }
        
        // Format dates
        const issueDate = new Date(certificateIssueDate).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        const validUntilFormatted = certificateValidUntil ? 
            new Date(certificateValidUntil).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }) : 'Indefinite';
        
        // Generate certificate HTML with serial number
        const certificateHTML = `
            <div class="certificate">
                <div class="certificate-header">
                    <h1 style="color: #667eea; font-size: 24px; margin-bottom: 10px; text-align: center;">NIGERIAN ASSOCIATION OF REFRIGERATION<br>AND AIR CONDITIONING PRACTITIONERS</h1>
                    <h2 style="color: #764ba2; font-size: 18px; margin-bottom: 20px; text-align: center;">CERTIFICATE OF ${certificateType.toUpperCase()}</h2>
                </div>
                
                <div class="certificate-body" style="text-align: center; padding: 20px;">
                    <div class="certificate-title">
                        <h3 style="color: #333; font-size: 20px; margin-bottom: 20px;">${certificateTitle}</h3>
                    </div>
                    
                                        <div class="certificate-content">
                        <p style="font-size: 16px; margin-bottom: 10px;">This is to certify that</p>
                        <h2 class="recipient-name" style="color: #667eea; font-size: 28px; margin: 20px 0; text-decoration: underline;">${certificateRecipient}</h2>
                        <p style="margin: 10px 0;"><strong>Email:</strong> ${certificateEmail}</p>
                        ${certificateCode ? `<p style="margin: 10px 0;"><strong>NARAP Code:</strong> ${certificateCode}</p>` : ''}
                        ${certificatePosition ? `<p style="margin: 10px 0;"><strong>Position:</strong> ${certificatePosition}</p>` : ''}
                        ${certificateState ? `<p style="margin: 10px 0;"><strong>State:</strong> ${certificateState}</p>` : ''}
                        
                        ${certificateDescription ? `<p class="description" style="margin: 20px 0; font-style: italic;">${certificateDescription}</p>` : ''}
                        
                        <div class="certificate-details" style="margin-top: 30px; border-top: 1px solid #ddd; padding-top: 20px;">
                            <p style="margin: 5px 0;"><strong>Certificate Number:</strong> ${certificateNumber}</p>
                            <p style="margin: 5px 0;"><strong>Serial Number:</strong> ${certificateSerialNumber}</p>
                                                        <p style="margin: 5px 0;"><strong>Serial Number:</strong> ${certificateSerialNumber}</p>
                            <p style="margin: 5px 0;"><strong>Issue Date:</strong> ${issueDate}</p>
                            <p style="margin: 5px 0;"><strong>Valid Until:</strong> ${validUntilFormatted}</p>
                        </div>
                    </div>
                </div>
                
                <div class="certificate-footer" style="display: flex; justify-content: space-between; align-items: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd;">
                    <div class="signature-section">
                        <div class="signature-line" style="width: 200px; border-bottom: 1px solid #333; margin-bottom: 5px;"></div>
                        <p style="font-size: 14px;">President, NARAP</p>
                    </div>
                    <div class="seal-section">
                        <div class="official-seal" style="width: 80px; height: 80px; border: 2px solid #667eea; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; color: #667eea; text-align: center;">OFFICIAL<br>SEAL</div>
                    </div>
                </div>
            </div>
        `;
        
        // Show preview
        const previewContainer = document.getElementById('certificatePreview');
        const generatedCertificate = document.getElementById('generatedCertificate');
        
        if (previewContainer && generatedCertificate) {
            generatedCertificate.innerHTML = certificateHTML;
            previewContainer.classList.remove('hidden');
            showMessage('Certificate preview generated successfully', 'success');
        } else {
            console.error('Preview containers not found');
            showMessage('Error: Preview containers not found', 'error');
        }
        
    } catch (error) {
        console.error('Error generating certificate preview:', error);
        showMessage('Error generating certificate preview: ' + error.message, 'error');
    }
};

// Updated issueCertificate function with manual serial number input
async function issueCertificate(event) {
    event.preventDefault();
    
    const formData = {
        number: document.getElementById('certificateNumber').value.trim(),
        serialNumber: document.getElementById('certificateSerialNumber').value.trim(), // Manual serial number
        recipient: document.getElementById('certificateRecipient').value.trim(),
        email: document.getElementById('certificateEmail').value.trim(),
        title: document.getElementById('certificateTitle').value.trim(),
        type: document.getElementById('certificateType').value,
        issueDate: document.getElementById('certificateIssueDate').value,
        validUntil: document.getElementById('certificateValidUntil').value || null,
        description: document.getElementById('certificateDescription').value.trim(),
        position: document.getElementById('certificatePosition').value.trim(),
        code: document.getElementById('certificateCode').value.trim(),
        state: document.getElementById('certificateState').value.trim()
    };
    
    console.log('Issue certificate form data:', formData);
    
    // Validation - now includes serial number
    if (!formData.number || !formData.serialNumber || !formData.recipient || !formData.email || !formData.title || !formData.type || !formData.issueDate) {
        const missingFields = [];
        if (!formData.number) missingFields.push('Certificate Number');
        if (!formData.serialNumber) missingFields.push('Serial Number');
        if (!formData.recipient) missingFields.push('Recipient Name');
        if (!formData.email) missingFields.push('Recipient Email');
        if (!formData.title) missingFields.push('Certificate Title');
        if (!formData.type) missingFields.push('Certificate Type');
        if (!formData.issueDate) missingFields.push('Issue Date');
        
        showMessage(`Please fill in all required fields: ${missingFields.join(', ')}`, 'error');
        return;
    }
    
    // Email validation
    if (!validateEmail(formData.email)) {
        showMessage('Please enter a valid email address', 'error');
        return;
    }
    
    try {
        showMessage('Issuing certificate...', 'info');
        
        // Create certificate data - use manual serial number instead of generating
        const certificateData = {
            ...formData,
            status: 'active',
            createdAt: new Date().toISOString(),
            id: generateCertificateId(),
            recipientCode: formData.code || 'N/A',
            recipientPosition: formData.position || 'Member',
            recipientState: formData.state || 'N/A'
        };
        
        console.log('Certificate data to save:', certificateData);
        
        // Try to save to backend first
        let backendSuccess = false;
        if (navigator.onLine && window.backendUrl) {
            try {
                const res = await fetch(`${window.backendUrl}/api/certificates`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...getAuthHeaders()
                    },
                    credentials: 'include',
                    body: JSON.stringify(certificateData)
                });
                
                if (res.ok) {
                    const result = await res.json();
                    certificateData._id = result._id || result.id;
                    certificateData.isFromBackend = true;
                    backendSuccess = true;
                    console.log('Certificate saved to backend successfully');
                } else {
                    console.warn('Backend save failed, saving locally');
                }
            } catch (error) {
                console.warn('Backend request failed, saving locally:', error);
            }
        }
        
        // Save to local storage
        const localCertificates = getLocalCertificates();
        localCertificates.push({
            ...certificateData,
            isFromBackend: backendSuccess
        });
        saveLocalCertificates(localCertificates);
        
        // Add to pending sync if backend failed
        if (!backendSuccess) {
            const pendingSync = getPendingSync();
            if (!pendingSync.certificateCreations) {
                pendingSync.certificateCreations = [];
            }
            pendingSync.certificateCreations.push(certificateData);
            savePendingSync(pendingSync);
        }
        
        showMessage('Certificate issued successfully!', 'success');
        closeIssueCertificateModal();
        
        // Clear form
        document.getElementById('issueCertificateForm').reset();
        document.getElementById('certificatePreview').classList.add('hidden');
        
        // Set default issue date to today for next use
        const issueDateField = document.getElementById('certificateIssueDate');
        if (issueDateField) {
            issueDateField.value = new Date().toISOString().split('T')[0];
        }
        
        if (typeof loadCertificates === 'function') {
            await loadCertificates();
        }
        if (typeof refreshCertificates === 'function') {
            refreshCertificates();
        }
        if (typeof loadDashboard === 'function') {
            await loadDashboard();
        }
        
    } catch (error) {
        console.error('Issue certificate error:', error);
        showMessage('Error issuing certificate: ' + error.message, 'error');
    }
}

// Make sure it's globally accessible
window.issueCertificate = issueCertificate;




// Debugging helper functions
window.listAllMembers = function() {
    const members = JSON.parse(localStorage.getItem('narap_members') || '[]');
    console.log('All members in database:');
    members.forEach((member, index) => {
        console.log(`${index + 1}. Name: ${member.name}, Email: ${member.email}, Code: ${member.code}`);
    });
    return members;
};

window.suggestMemberEmails = function(partialEmail) {
    const members = JSON.parse(localStorage.getItem('narap_members') || '[]');
    const suggestions = members
        .filter(m => m.email && m.email.toLowerCase().includes(partialEmail.toLowerCase()))
        .map(m => ({ name: m.name, email: m.email }));
    
    console.log('Email suggestions for "' + partialEmail + '":', suggestions);
    return suggestions;
};





// Pending sync management

function savePendingSync(pendingSync) {
    try {
        localStorage.setItem('narap_pending_sync', JSON.stringify(pendingSync));
    } catch (error) {
        console.error('Error saving pending sync:', error);
    }
}

// Sync pending changes with backend
 async function syncPendingChanges() {
    if (!navigator.onLine) {
        showMessage('Cannot sync while offline', 'error');
        return;
    }
    
    const pendingSync = getPendingSync();
    const totalPending = pendingSync.certificateCreations.length + 
                         pendingSync.certificateUpdates.length + 
                         pendingSync.certificateDeletions.length;
    
    if (totalPending === 0) {
        showMessage('No pending changes to sync', 'info'); // Changed from error to info
        return;
    }
    
    let syncCount = 0;
    let errorCount = 0;
    
    try {
        showMessage('Syncing pending changes...', 'success');

        
        // Sync certificate creations
        for (const cert of pendingSync.certificateCreations) {
            try {
                const res = await fetch(`${backendUrl}/api/certificates`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(cert)
                });
                
                if (res.ok) {
                    syncCount++;
                } else {
                    errorCount++;
                }
            } catch (error) {
                errorCount++;
            }
        }
        
        // Sync certificate updates
        for (const cert of pendingSync.certificateUpdates) {
            try {
                const res = await fetch(`${backendUrl}/api/certificates/${cert._id || cert.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(cert)
                });
                
                if (res.ok) {
                    syncCount++;
                } else {
                    errorCount++;
                }
            } catch (error) {
                errorCount++;
            }
        }
        
        // Clear synced items
        if (syncCount > 0) {
            savePendingSync({
                certificateCreations: [],
                certificateUpdates: [],
                certificateDeletions: []
            });
        }
        
        // Change the message type based on results
        let messageType = 'success';
        if (errorCount > 0) {
            messageType = syncCount > 0 ? 'warning' : 'error';
        }
        
        showMessage(`Sync completed: ${syncCount} synced, ${errorCount} failed`, messageType);
        
    } catch (error) {
        console.error('Sync error:', error);
        showMessage('Sync failed: ' + error.message, 'error');
    }
}

// Auto-fill certificate fields when email matches existing member
window.autoFillCertificateFields = function() {
    const emailField = document.getElementById('certificateEmail');
    const recipientField = document.getElementById('certificateRecipient');
    const positionField = document.getElementById('certificatePosition');
    const codeField = document.getElementById('certificateCode');
    const stateField = document.getElementById('certificateState');
    
    if (!emailField || !recipientField) return;
    
    const email = emailField.value.trim();
    if (!email) return;
    
    // Try to find member by email
    const members = JSON.parse(localStorage.getItem('narap_members') || '[]');
    const member = members.find(m => m.email && m.email.toLowerCase() === email.toLowerCase());
    
    if (member) {
        // Auto-fill fields with member data
        if (recipientField && !recipientField.value) {
            recipientField.value = member.name;
        }
        if (positionField && !positionField.value) {
            positionField.value = member.position;
        }
        if (codeField && !codeField.value) {
            codeField.value = member.code;
        }
        if (stateField && !stateField.value) {
            stateField.value = member.state;
        }
        
        showMessage('Auto-filled fields from existing member data', 'info');
    }
};


// Export functions
async function exportMembers(format = 'csv') {
    try {
        const members = currentMembers.length > 0 ? currentMembers : await loadUsers();
        
        if (format === 'csv') {
            const csvContent = convertToCSV(members);
            downloadFile(csvContent, `narap_members_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
        } else {
            const jsonContent = JSON.stringify(members, null, 2);
            downloadFile(jsonContent, `narap_members_${new Date().toISOString().split('T')[0]}.json`, 'application/json');
        }
        
        showMessage('Members exported successfully!', 'success');
    } catch (error) {
        console.error('Export error:', error);
        showMessage('Failed to export members', 'error');
    }
}

async function exportCertificates() {
    try {
        const certificates = currentCertificates.length > 0 ? currentCertificates : await getCertificates();
        
        if (certificates.length === 0) {
            showMessage('No certificates to export', 'info');
            return;
        }
        
        // Define CSV headers
        const headers = [
            'Certificate Number',
            'Recipient Name',
            'Email',
            'Title',
            'Type',
            'Description',
            'Issue Date',
            'Valid Until',
            'Status',
            'Created At',
            'Revoked At',
            'Revoked By',
            'Revoked Reason',
            'Issued By',
            'User ID',
            'Source'
        ];
        
        // Convert certificates to CSV rows
        const csvRows = certificates.map(cert => {
            return [
                escapeCSVField(cert.number || ''),
                escapeCSVField(cert.recipient || ''),
                escapeCSVField(cert.email || ''),
                escapeCSVField(cert.title || ''),
                escapeCSVField(cert.type || ''),
                escapeCSVField(cert.description || ''),
                formatDateForCSV(cert.issueDate),
                formatDateForCSV(cert.validUntil),
                escapeCSVField(cert.status || 'active'),
                formatDateForCSV(cert.createdAt),
                formatDateForCSV(cert.revokedAt),
                escapeCSVField(cert.revokedBy || ''),
                escapeCSVField(cert.revokedReason || ''),
                escapeCSVField(cert.issuedBy || ''),
                escapeCSVField(cert.userId || ''),
                cert.isFromBackend ? 'Backend' : 'Local'
            ].join(',');
        });
        
        // Combine headers and rows
        const csvContent = [headers.join(','), ...csvRows].join('\n');
        
        // Create and download CSV file
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `narap_certificates_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        
        // Clean up
        URL.revokeObjectURL(link.href);
        
        showMessage(`${certificates.length} certificates exported successfully as CSV!`, 'success');
        
    } catch (error) {
        console.error('Export certificates error:', error);
        showMessage('Failed to export certificates: ' + error.message, 'error');
    }
}

// Helper function to escape CSV fields (handle commas, quotes, newlines)
function escapeCSVField(field) {
    if (field === null || field === undefined) {
        return '';
    }
    
    const stringField = String(field);
    
    // If field contains comma, quote, or newline, wrap in quotes and escape internal quotes
    if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n') || stringField.includes('\r')) {
        return '"' + stringField.replace(/"/g, '""') + '"';
    }
    
    return stringField;
}

// Helper function to format dates for CSV
function formatDateForCSV(dateValue) {
    if (!dateValue) return '';
    
    try {
        const date = new Date(dateValue);
        if (isNaN(date.getTime())) return '';
        
        // Format as YYYY-MM-DD HH:MM:SS
        return date.toISOString().replace('T', ' ').substring(0, 19);
    } catch (error) {
        return '';
    }
}

// System functions
async function syncWithBackend() {
    try {
        showMessage('Syncing with backend...', 'success');
        await syncPendingChanges();
        await loadMembers();
        await loadCertificates();
        await loadDashboard();
        document.getElementById('lastSync').textContent = formatDate(new Date());
        showMessage('Sync completed successfully!', 'success');
    } catch (error) {
        console.error('Sync error:', error);
        showMessage('Sync failed', 'error');
    }
}

async function createBackup() {
    try {
        showMessage('Creating backup...', 'success');
        
        const members = currentMembers.length > 0 ? currentMembers : await loadUsers();
        const certificates = currentCertificates.length > 0 ? currentCertificates : await getCertificates();
        
        const backupData = {
            timestamp: new Date().toISOString(),
            version: '1.0',
            members: members,
            certificates: certificates,
            pendingSync: getPendingSync()
        };
        
        const backupContent = JSON.stringify(backupData, null, 2);
        downloadFile(backupContent, `narap_backup_${new Date().toISOString().split('T')[0]}.json`, 'application/json');
        
        document.getElementById('lastBackup').textContent = formatDate(new Date());
        showMessage('Backup created successfully!', 'success');
    } catch (error) {
        console.error('Backup error:', error);
        showMessage('Failed to create backup', 'error');
    }
}

async function exportAllData() {
    try {
        showMessage('Exporting all data...', 'success');
        
        const members = currentMembers.length > 0 ? currentMembers : await loadUsers();
        const certificates = currentCertificates.length > 0 ? currentCertificates : await getCertificates();
        
        const allData = {
            exportDate: new Date().toISOString(),
            members: members,
            certificates: certificates,
            statistics: {
                totalMembers: members.length,
                totalCertificates: certificates.length,
                activeCertificates: certificates.filter(c => c.status === 'active' || !c.status).length,
                revokedCertificates: certificates.filter(c => c.status === 'revoked').length
            }
        };
        
        const exportContent = JSON.stringify(allData, null, 2);
        downloadFile(exportContent, `narap_complete_export_${new Date().toISOString().split('T')[0]}.json`, 'application/json');
        
        showMessage('All data exported successfully!', 'success');
    } catch (error) {
        console.error('Export all error:', error);
        showMessage('Failed to export all data', 'error');
    }
}

function confirmClearAllData() {
    const confirmMessage = 'Are you sure you want to delete ALL data?\n\n⚠️ WARNING: This action cannot be undone!\n\nType "DELETE ALL" to confirm:';
    const userInput = prompt(confirmMessage);
    
    if (userInput !== 'DELETE ALL') {
        showMessage('Clear all operation cancelled', 'success');
        return;
    }
    
    clearAllData();
}

async function clearAllData() {
    try {
        showMessage('Clearing all data...', 'success');
        
        // Clear backend data
        const res = await fetch(`${backendUrl}/api/deleteAllUsers`, {
            method: 'DELETE',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        // Clear local data regardless of backend response
        localStorage.removeItem('narap_certificates');
        localStorage.removeItem('narap_pending_sync');
        currentMembers = [];
        currentCertificates = [];
        
        if (res.ok) {
            showMessage('All data cleared successfully!', 'success');
        } else {
            showMessage('Backend clear failed, but local data cleared', 'warning');
        }
        
        await loadMembers();
        await loadCertificates();
        await loadDashboard();
        
    } catch (error) {
        console.error('Clear all data error:', error);
        // Still clear local data
        localStorage.removeItem('narap_certificates');
        localStorage.removeItem('narap_pending_sync');
        currentMembers = [];
        currentCertificates = [];
        
        showMessage('Local data cleared, backend sync may be needed', 'warning');
        await loadMembers();
        await loadCertificates();
        await loadDashboard();
    }
}

// Refresh functions
async function refreshMembers() {
    showMessage('Refreshing members...', 'success');
    await loadMembers();
}

async function refreshCertificates() {
    showMessage('Refreshing certificates...', 'success');
    await loadCertificates();
}

// Print functions
function printIdCard() {
    const printContent = document.getElementById('viewIdCardContent').innerHTML;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
            <head>
                <title>NARAP ID Card</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    .id-card { border: 2px solid #333; padding: 20px; max-width: 400px; }
                    .id-card-header { text-align: center; margin-bottom: 20px; }
                    .id-logo { width: 50px; height: 50px; }
                    .id-photo img { width: 100px; height: 100px; object-fit: cover; }
                    .signature { width: 100px; height: 50px; }
                    @media print {
                        body { margin: 0; }
                        .id-card { border: 2px solid #000; }
                    }
                </style>
            </head>
            <body>
                ${printContent}
            </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
}

function downloadIdCard() {
    showMessage('ID Card download feature coming soon', 'info');
}

function printCertificate() {
    const printContent = document.getElementById('viewCertificateContent').innerHTML;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
            <head>
                <title>NARAP Certificate</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    .certificate-view { border: 3px solid #DAA520; padding: 30px; text-align: center; }
                    .cert-logo { width: 80px; height: 80px; }
                    .revoked-watermark { 
                        position: absolute;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%) rotate(-45deg);
                        font-size: 72px;
                        font-weight: bold;
                        color: rgba(220, 53, 69, 0.3);
                        z-index: 1;
                        pointer-events: none;
                    }
                    @media print {
                        body { margin: 0; }
                        .certificate-view { border: 3px solid #000; }
                    }
                </style>
            </head>
            <body>
                ${printContent}
            </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
}

function downloadCertificate() {
    showMessage('Certificate download feature coming soon', 'info');
}

// File upload handler
function handleFileUpload(input, labelId) {
    const label = document.getElementById(labelId);
    if (input.files && input.files[0]) {
        const fileName = input.files[0].name;
        label.innerHTML = `<i class="fas fa-check"></i> ${fileName}`;
        label.style.color = '#28a745';
    }
}

// Password strength checker
function checkPasswordStrength(password) {
    const strengthDiv = document.getElementById('passwordStrength');
    if (!strengthDiv) return;
    
    const validation = validatePassword(password);
    strengthDiv.innerHTML = `
        <div class="password-strength ${validation.isValid ? 'strong' : 'weak'}" style="margin-top: 5px; padding: 5px; border-radius: 4px; font-size: 12px; ${validation.isValid ? 'background: #d4edda; color: #155724;' : 'background: #f8d7da; color: #721c24;'}">
            ${validation.message}
        </div>
    `;
}


// Add touch-friendly features for mobile devices
function addMobileSupport() {
    try {
        // Larger touch targets for mobile
        if (window.innerWidth <= 768) {
            const buttons = document.querySelectorAll('.btn-sm');
            buttons.forEach(btn => {
                if (btn) {
                    btn.style.minHeight = '44px';
                    btn.style.minWidth = '44px';
                    btn.style.padding = '8px 12px';
                }
            });
        }
        
        // Handle orientation change
        window.addEventListener('orientationchange', function() {
            setTimeout(() => {
                try {
                    const preview = document.getElementById('idCardPreview');
                    if (preview && !preview.classList.contains('hidden')) {
                        if (typeof generateIdCardPreview === 'function') {
                            generateIdCardPreview();
                        }
                    }
                } catch (error) {
                    console.log('Orientation change error:', error);
                }
            }, 100);
        });
        
    } catch (error) {
        console.log('Mobile support error:', error);
    }
}

// Safely add event listener
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addMobileSupport);
} else {
    addMobileSupport();
}

// Call mobile support when tables are loaded
const originalLoadCertificates = loadCertificates;
loadCertificates = function() {
    originalLoadCertificates.call(this);
    setTimeout(addMobileSupport, 100);
};


// Preview functions
function generateIdCardPreview() {
    const name = document.getElementById('memberName').value;
    const code = document.getElementById('memberCode').value;
    const position = document.getElementById('memberPosition').value;
    const state = document.getElementById('memberState').value;
    const zone = document.getElementById('memberZone').value;
    
    if (!name || !code) {
        showMessage('Please fill in name and code to generate preview', 'error');
        return;
    }
    
    const previewDiv = document.getElementById('idCardPreview');
    const cardDiv = document.getElementById('generatedIdCard');
    
    if (!previewDiv || !cardDiv) {
        showMessage('Preview containers not found', 'error');
        return;
    }
    
    // Get file inputs - try multiple possible IDs
    const passportInput = document.getElementById('passportPhoto') || 
                         document.getElementById('memberPassport') || 
                         document.querySelector('input[type="file"][name*="passport"]');
                         
    const signatureInput = document.getElementById('signature') || 
                          document.getElementById('memberSignature') || 
                          document.querySelector('input[type="file"][name*="signature"]');
    
    console.log('Passport input found:', passportInput);
    console.log('Signature input found:', signatureInput);
    
    // Default placeholder images
    const defaultPassportPhoto = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iMTAwIiB2aWV3Qm94PSIwIDAgODAgMTAwIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgo8cmVjdCB3aWR0aD0iODAiIGhlaWdodD0iMTAwIiBmaWxsPSIjRjBGMEYwIi8+Cjx0ZXh0IHg9IjQwIiB5PSI1NSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjEyIiBmaWxsPSIjOTk5IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5QaG90bzwvdGV4dD4KPHN2Zz4=";
    
    const defaultSignature = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjQwIiB2aWV3Qm94PSIwIDAgMTIwIDQwIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgo8cmVjdCB3aWR0aD0iMTIwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjRjBGMEYwIi8+Cjx0ZXh0IHg9IjYwIiB5PSIyNSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjEwIiBmaWxsPSIjOTk5IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5TaWduYXR1cmU8L3RleHQ+Cjwvc3ZnPg==";
    
    // Function to process image file
    function processImageFile(inputElement, defaultImage) {
        return new Promise((resolve) => {
            if (inputElement && inputElement.files && inputElement.files.length > 0) {
                const file = inputElement.files[0];
                console.log('Processing file:', file.name, file.type, file.size);
                
                // Check if it's an image file
                if (!file.type.startsWith('image/')) {
                    console.warn('Selected file is not an image:', file.type);
                    resolve(defaultImage);
                    return;
                }
                
                const reader = new FileReader();
                
                reader.onload = function(e) {
                    console.log('File read successfully');
                    resolve(e.target.result);
                };
                
                reader.onerror = function(e) {
                    console.error('Error reading file:', e);
                    resolve(defaultImage);
                };
                
                reader.readAsDataURL(file);
            } else {
                console.log('No file selected, using default');
                resolve(defaultImage);
            }
        });
    }
    
    // Process both images
    Promise.all([
        processImageFile(passportInput, defaultPassportPhoto),
        processImageFile(signatureInput, defaultSignature)
    ]).then(([passportSrc, signatureSrc]) => {
        
        console.log('Passport image source length:', passportSrc.length);
        console.log('Signature image source length:', signatureSrc.length);
        
        cardDiv.innerHTML = `
            <div class="id-card-preview" style="border: 2px solid #333; padding: 20px; max-width: 400px; background: white; margin: 10px 0; font-family: Arial, sans-serif;">
                <div class="id-card-header" style="text-align: center; margin-bottom: 15px;">
                    <img src="images/narap-logo.jpg" alt="NARAP Logo" class="id-logo" style="width: 50px; height: 50px;" onerror="this.style.display='none'">
                    <div class="id-title">
                        <h3 style="margin: 5px 0; color: #333;">NARAP</h3>
                        <p style="font-size: 10px; margin: 0; color: #666;">Nigerian Association of Refrigeration<br>And Air Conditioning Practitioners</p>
                    </div>
                </div>
                <div class="id-card-body" style="display: flex; gap: 15px; align-items: flex-start;">
                    <div class="id-photo">
                        <img src="${passportSrc}" 
                             alt="Passport Photo" 
                             style="width: 80px; height: 100px; border: 1px solid #ddd; object-fit: cover; display: block;"
                             onerror="console.error('Failed to load passport image')">
                    </div>
                    <div class="id-details" style="flex: 1;">
                        <h4 style="margin: 0 0 10px 0; font-size: 14px; color: #333;">${escapeHtml(name)}</h4>
                        <p style="margin: 3px 0; font-size: 11px; color: #555;"><strong>Code:</strong> ${escapeHtml(code)}</p>
                        <p style="margin: 3px 0; font-size: 11px; color: #555;"><strong>Position:</strong> ${escapeHtml(position)}</p>
                        <p style="margin: 3px 0; font-size: 11px; color: #555;"><strong>State:</strong> ${escapeHtml(state)}</p>
                        <p style="margin: 3px 0; font-size: 11px; color: #555;"><strong>Zone:</strong> ${escapeHtml(zone)}</p>
                    </div>
                </div>
                <div class="id-card-footer" style="margin-top: 15px; text-align: center; border-top: 1px solid #ddd; padding-top: 10px;">
                    <div class="signature-area">
                        <p style="font-size: 9px; margin: 0 0 5px 0; color: #666;">Member Signature:</p>
                        <img src="${signatureSrc}" 
                             alt="Signature" 
                             style="width: 120px; height: 40px; border: 1px solid #ddd; object-fit: contain; background: white; display: block; margin: 0 auto;"
                             onerror="console.error('Failed to load signature image')">
                    </div>
                </div>
            </div>
        `;
        
        previewDiv.classList.remove('hidden');
        previewDiv.style.display = 'block';
        
        showMessage('ID Card preview generated successfully!', 'success');
        
    }).catch(error => {
        console.error('Error generating preview:', error);
        showMessage('Error generating preview: ' + error.message, 'error');
    });
    }

    // Debug function to check file inputs
    function debugFileInputs() {
    console.log('=== DEBUG FILE INPUTS ===');
    
    // Check all possible file inputs
    const allFileInputs = document.querySelectorAll('input[type="file"]');
    console.log('All file inputs found:', allFileInputs.length);
    
    allFileInputs.forEach((input, index) => {
        console.log(`Input ${index}:`, {
            id: input.id,
            name: input.name,
            files: input.files ? input.files.length : 0
        });
    });
    
    // Specific checks
    const passportInput = document.getElementById('passportPhoto');
    const signatureInput = document.getElementById('signature');
    
    console.log('Passport input:', passportInput ? 'Found' : 'Not found');
    console.log('Signature input:', signatureInput ? 'Found' : 'Not found');
    
    if (passportInput && passportInput.files) {
        console.log('Passport files:', passportInput.files.length);
    }
    if (signatureInput && signatureInput.files) {
        console.log('Signature files:', signatureInput.files.length);
    }
}


// Optional: Add event listeners to auto-update preview when images are selected
function setupPreviewListeners() {
    const passportInput = document.getElementById('passportPhoto');
    const signatureInput = document.getElementById('signature');
    
    if (passportInput) {
        passportInput.addEventListener('change', function() {
            // Auto-update preview if form has data
            const name = document.getElementById('memberName').value;
            const code = document.getElementById('memberCode').value;
            if (name && code) {
                generateIdCardPreview();
            }
        });
    }
    
    if (signatureInput) {
        signatureInput.addEventListener('change', function() {
            // Auto-update preview if form has data
            const name = document.getElementById('memberName').value;
            const code = document.getElementById('memberCode').value;
            if (name && code) {
                generateIdCardPreview();
            }
        });
    }
}


function generateCertificatePreview() {
    const recipient = document.getElementById('certificateRecipient').value;
    const title = document.getElementById('certificateTitle').value;
    const number = document.getElementById('certificateNumber').value;
    const issueDate = document.getElementById('certificateIssueDate').value;
    
    if (!recipient || !title) {
        showMessage('Please fill in recipient and title to generate preview', 'error');
        return;
    }
    
    const previewDiv = document.getElementById('certificatePreview');
    const certDiv = document.getElementById('generatedCertificate');
    
    if (!previewDiv || !certDiv) {
        showMessage('Preview containers not found', 'error');
        return;
    }
    
    certDiv.innerHTML = `
        <div class="certificate-preview" style="border: 3px solid #DAA520; padding: 30px; text-align: center; background: white; margin: 10px 0;">
            <div class="certificate-header" style="margin-bottom: 30px;">
                <img src="images/narap-logo.jpg" alt="NARAP Logo" class="cert-logo" style="width: 80px; height: 80px; margin-bottom: 15px;">
                <h2 style="margin: 10px 0; color: #333;">NARAP</h2>
                <p style="font-size: 14px; color: #666; margin: 0;">Nigerian Association of Refrigeration And Air Conditioning Practitioners</p>
            </div>
            <div class="certificate-body">
                <h1 style="color: #DAA520; margin: 20px 0; font-size: 24px;">${escapeHtml(title)}</h1>
                <p style="font-size: 16px; margin: 15px 0;">This is to certify that</p>
                <h3 style="color: #333; margin: 20px 0; font-size: 20px; text-decoration: underline;">${escapeHtml(recipient)}</h3>
                <p style="font-size: 16px; margin: 15px 0;">has been awarded this certificate</p>
                <div class="certificate-details" style="margin-top: 30px;">
                    <p style="font-size: 12px; margin: 5px 0;"><strong>Certificate No:</strong> ${escapeHtml(number)}</p>
                    <p style="font-size: 12px; margin: 5px 0;"><strong>Date Issued:</strong> ${formatDate(issueDate)}</p>
                </div>
            </div>
        </div>
    `;
    
    previewDiv.classList.remove('hidden');
    previewDiv.style.display = 'block';
}

// Import/Export helper functions
function convertToCSV(data) {
    if (!data || data.length === 0) return '';
    
    const headers = ['Name', 'Email', 'Code', 'Position', 'State', 'Zone'];
    const csvRows = [headers.join(',')];
    
    data.forEach(item => {
        const row = [
            `"${(item.name || '').replace(/"/g, '""')}"`,
            `"${(item.email || '').replace(/"/g, '""')}"`,
            `"${(item.code || '').replace(/"/g, '""')}"`,
            `"${(item.position || '').replace(/"/g, '""')}"`,
            `"${(item.state || '').replace(/"/g, '""')}"`,
            `"${(item.zone || '').replace(/"/g, '""')}"`
        ];
        csvRows.push(row.join(','));
    });
    
    return csvRows.join('\n');
}

function downloadFile(content, filename, contentType) {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function downloadSampleCSV() {
    const sampleData = [
        ['Name', 'Email', 'Code', 'Position', 'State', 'Zone'],
        ['John Doe', 'john@example.com', 'NARAP001', 'MEMBER', 'Lagos', 'South West'],
        ['Jane Smith', 'jane@example.com', 'NARAP002', 'SECRETARY', 'Abuja', 'North Central']
    ];
    
    const csvContent = sampleData.map(row => row.join(',')).join('\n');
    downloadFile(csvContent, 'narap_sample_import.csv', 'text/csv');
    showMessage('Sample CSV downloaded', 'success');
}

// Import data function
async function importData() {
    const fileInput = document.getElementById('importFile');
    const statusDiv = document.getElementById('importStatus');
    
    if (!fileInput.files || !fileInput.files[0]) {
        showMessage('Please select a CSV file to import', 'error');
        return;
    }
    
    const file = fileInput.files[0];
    const reader = new FileReader();
    
    reader.onload = async function(e) {
        try {
            const csv = e.target.result;
            const lines = csv.split('\n').filter(line => line.trim());
            const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
            
            statusDiv.innerHTML = '<div class="loading" style="padding: 10px; background: #e3f2fd; border-radius: 4px;">Processing import...</div>';
            
            let successCount = 0;
            let errorCount = 0;
            const errors = [];
            
            for (let i = 1; i < lines.length; i++) {
                if (!lines[i].trim()) continue;
                
                const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
                const memberData = {
                    name: values[0] || '',
                    email: values[1] || '',
                    code: values[2] || '',
                    position: values[3] || 'MEMBER',
                    state: values[4] || '',
                    zone: values[5] || '',
                    password: values[6] || 'Password123'
                };
                
                // Validate required fields
                if (!memberData.name || !memberData.email || !memberData.code) {
                    errors.push(`Row ${i + 1}: Missing required fields`);
                    errorCount++;
                    continue;
                }
                
                try {
                    const res = await fetch(`${backendUrl}/api/addUser`, {
                        method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify(memberData)
                    });
                    
                    if (res.ok) {
                        successCount++;
                    } else {
                        const errorData = await res.json().catch(() => ({}));
                        errors.push(`Row ${i + 1}: ${errorData.message || 'Unknown error'}`);
                        errorCount++;
                    }
                } catch (error) {
                    errors.push(`Row ${i + 1}: Network error`);
                    errorCount++;
                }
            }
            
            statusDiv.innerHTML = `
                <div class="import-results" style="padding: 15px; background: #f8f9fa; border-radius: 4px; margin-top: 10px;">
                    <p><strong>Import completed:</strong></p>
                    <p style="color: #28a745;">✅ Successfully imported: ${successCount} members</p>
                    <p style="color: #dc3545;">❌ Failed to import: ${errorCount} members</p>
                    ${errors.length > 0 ? `<details style="margin-top: 10px;"><summary>View Errors</summary><ul style="margin: 10px 0; padding-left: 20px;">${errors.map(err => `<li style="font-size: 12px; color: #dc3545;">${err}</li>`).join('')}</ul></details>` : ''}
                </div>
            `;
            
            if (successCount > 0) {
                await loadMembers();
                await loadDashboard();
            }
            
            showMessage(`Import completed: ${successCount} success, ${errorCount} failed`, successCount > 0 ? 'success' : 'error');
            
        } catch (error) {
            console.error('Import error:', error);
            statusDiv.innerHTML = '<div class="error" style="padding: 10px; background: #f8d7da; color: #721c24; border-radius: 4px;">Import failed: Invalid CSV format</div>';
            showMessage('Import failed: Invalid CSV format', 'error');
        }
    };
    
    reader.readAsText(file);
}

// Restore backup function
async function restoreBackup() {
    const fileInput = document.getElementById('restoreFile');
    const replaceExisting = document.getElementById('replaceExisting').checked;
    const statusDiv = document.getElementById('restoreStatus');
    
    if (!fileInput.files || !fileInput.files[0]) {
        showMessage('Please select a backup file to restore', 'error');
        return;
    }
    
    if (!confirm('Are you sure you want to restore this backup? This action cannot be undone.')) {
        return;
    }
    
    const file = fileInput.files[0];
    const reader = new FileReader();
    
    reader.onload = async function(e) {
        try {
            const backupData = JSON.parse(e.target.result);
            statusDiv.innerHTML = '<div class="loading" style="padding: 10px; background: #fff3cd; border-radius: 4px;">Restoring backup...</div>';
            
            if (replaceExisting) {
                await clearAllData();
            }
            
            let successCount = 0;
            let errorCount = 0;
            
            // Restore members
            if (backupData.members && Array.isArray(backupData.members)) {
                for (const member of backupData.members) {
                    try {
                        const res = await fetch(`${backendUrl}/api/addUser`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify(member)
                        });
                        
                        if (res.ok) {
                            successCount++;
                        } else {
                            errorCount++;
                        }
                    } catch (error) {
                        errorCount++;
                    }
                }
            }
            
            // Restore certificates
            if (backupData.certificates && Array.isArray(backupData.certificates)) {
                const localCertificates = getLocalCertificates();
                backupData.certificates.forEach(cert => {
                    if (!localCertificates.find(c => (c._id || c.id) === (cert._id || cert.id))) {
                        localCertificates.push(cert);
                        successCount++;
                    }
                });
                saveLocalCertificates(localCertificates);
            }
            
            // Restore pending sync if available
            if (backupData.pendingSync) {
                savePendingSync(backupData.pendingSync);
            }
            
            statusDiv.innerHTML = `
                <div class="restore-results" style="padding: 15px; background: #f8f9fa; border-radius: 4px; margin-top: 10px;">
                    <p><strong>Restore completed:</strong></p>
                    <p style="color: #28a745;">✅ Successfully restored: ${successCount} items</p>
                    <p style="color: #dc3545;">❌ Failed to restore: ${errorCount} items</p>
                </div>
            `;
            
            if (successCount > 0) {
                await loadMembers();
                await loadCertificates();
                await loadDashboard();
            }
            
            showMessage(`Restore completed: ${successCount} success, ${errorCount} failed`, successCount > 0 ? 'success' : 'error');
            
        } catch (error) {
            console.error('Restore error:', error);
            statusDiv.innerHTML = '<div class="error" style="padding: 10px; background: #f8d7da; color: #721c24; border-radius: 4px;">Restore failed: Invalid backup file</div>';
            showMessage('Restore failed: Invalid backup file', 'error');
        }
    };
    
    reader.readAsText(file);
}

// Theme toggle function
function toggleTheme() {
    const body = document.body;
    const currentTheme = body.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    body.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    const themeIcon = document.querySelector('#themeToggle i');
    if (themeIcon) {
        themeIcon.className = newTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }
    
    showMessage(`Switched to ${newTheme} theme`, 'success');
}

// Load saved theme
function loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.body.setAttribute('data-theme', savedTheme);
    
    const themeIcon = document.querySelector('#themeToggle i');
    if (themeIcon) {
        themeIcon.className = savedTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }
}


function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function validatePassword(password) {
    const minLength = 6;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    
    return {
        isValid: password.length >= minLength && hasUpperCase && hasLowerCase && hasNumbers,
        message: password.length < minLength ? 'Password must be at least 6 characters long' :
                !hasUpperCase ? 'Password must contain at least one uppercase letter' :
                !hasLowerCase ? 'Password must contain at least one lowercase letter' :
                !hasNumbers ? 'Password must contain at least one number' : 'Password is strong'
    };
}

// Connection status monitoring
function updateConnectionStatus() {
    const indicators = document.querySelectorAll('.connection-indicator');
    const texts = document.querySelectorAll('#connectionText, #footerConnectionText');
    
    if (navigator.onLine) {
        indicators.forEach(indicator => {
            indicator.style.backgroundColor = '#28a745';
        });
        texts.forEach(text => {
            text.textContent = 'Online';
        });
    } else {
        indicators.forEach(indicator => {
            indicator.style.backgroundColor = '#dc3545';
        });
        texts.forEach(text => {
            text.textContent = 'Offline';
        });
    }
}

// Populate state filter dropdown
function populateStateFilter() {
    const stateFilter = document.getElementById('stateFilter');
    if (!stateFilter) return;
    
    const nigerianStates = [
        'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
        'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT', 'Gombe', 'Imo',
        'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa',
        'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba',
        'Yobe', 'Zamfara'
    ];
    
    nigerianStates.forEach(state => {
        const option = document.createElement('option');
        option.value = state;
        option.textContent = state;
        stateFilter.appendChild(option);
    });
}

// Auto-refresh functionality
let autoRefreshInterval;

function startAutoRefresh(intervalMinutes = 5) {
    stopAutoRefresh();
    
    autoRefreshInterval = setInterval(async () => {
        if (document.getElementById('adminSection').style.display === 'block') {
            const activeTab = document.querySelector('.tab-content.active');
            if (activeTab) {
                const tabId = activeTab.id.replace('Tab', '');
                console.log(`Auto-refreshing ${tabId}...`);
                
                switch(tabId) {
                    case 'dashboard':
                        await loadDashboard();
                        break;
                    case 'members':
                        await loadMembers();
                        break;
                    case 'certificates':
                        await loadCertificates();
                        break;
                }
            }
        }
    }, intervalMinutes * 60 * 1000);
    
    showMessage(`Auto-refresh enabled (every ${intervalMinutes} minutes)`, 'success');
}

function stopAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
        showMessage('Auto-refresh disabled', 'success');
    }
}

// Additional utility functions for certificate management
function generateMemberCode() {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `NARAP${timestamp}${random}`;
}

// Quick actions for dashboard
function quickAddMember() {
    switchTab('members');
    setTimeout(() => showAddMemberModal(), 100);
}

function quickIssueCertificate() {
    switchTab('certificates');
    setTimeout(() => showIssueCertificateModal(), 100);
}


// Robust checkSystemHealth: fetches JSON health data and updates UI
async function checkSystemHealth() {
    try {
        const res = await fetch(`${backendUrl}/api/health`, {
            credentials: 'include'
        });
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        const health = await res.json();
        const serverStatusElement = document.getElementById('serverStatus');
        const systemLoadElement = document.getElementById('systemLoad');
        if (serverStatusElement) {
            serverStatusElement.textContent = health.status === 'healthy' ? 'Healthy' : 'Unhealthy';
        }
        if (systemLoadElement) {
            systemLoadElement.textContent = health.load || '0%';
        }
    } catch (err) {
        console.error('Health check failed:', err);
        showMessage(`Health check failed: ${err.message}`, 'error');
        const serverStatusElement = document.getElementById('serverStatus');
        if (serverStatusElement) {
            serverStatusElement.textContent = 'Error';
        }
    }
}

// Certificate verification function
async function verifyCertificate(certificateNumber) {
    try {
        // First check local certificates
        const localCert = currentCertificates.find(c => c.number === certificateNumber);
        if (localCert) {
            showMessage(`Certificate ${certificateNumber} found locally - Status: ${localCert.status || 'active'}`, 'success');
            return localCert;
        }
        
        // Then check backend if online
        if (navigator.onLine) {
            const res = await fetch(`${backendUrl}/api/verifyCertificate/${certificateNumber}`, {
                method: 'GET',
                credentials: 'include'
            });
            
            if (res.ok) {
                const certificate = await res.json();
                showMessage(`Certificate ${certificateNumber} is valid and belongs to ${certificate.recipient}`, 'success');
                return certificate;
            }
        }
        
        showMessage(`Certificate ${certificateNumber} not found`, 'error');
        return null;
        
    } catch (error) {
        console.error('Verify certificate error:', error);
        showMessage('Network error while verifying certificate', 'error');
        return null;
    }
}



// ======================
// MODAL SYSTEM (Combined Approach)
// ======================

// 1. MODAL INITIALIZATION (Pre-load frequent modals)
// MODAL SYSTEM ==============================================
window.initModals = function() {
    if (typeof bootstrap?.Modal !== 'function') {
        console.error('Bootstrap Modal not loaded!');
        return;
    }

    const modals = {
        memberModal: '#memberModal',
        editMemberModal: '#editMemberModal',
        addCertificateModal: '#addCertificateModal',
        viewCertificateModal: '#viewCertificateModal'
    };

    Object.keys(modals).forEach(key => {
        const el = document.querySelector(modals[key]);
        if (el) {
            try {
                window[key] = new bootstrap.Modal(el);
            } catch (e) {
                console.error(`Modal init failed for ${key}:`, e);
            }
        }
    });
};

window.handleModalTrigger = function(modalId) {
    const modalEl = document.getElementById(modalId);
    if (!modalEl) {
        if (process.env.NODE_ENV !== 'production') {
            console.warn(`[NARAP] Modal #${modalId} not found. Check:
            - Element exists in DOM
            - ID spelling matches
            - Bootstrap JS is loaded`);
        }
        return;
    }

    try {
        window[modalId] = window[modalId] || new bootstrap.Modal(modalEl);
        window[modalId].show();
    } catch (error) {
        console.error(`Modal ${modalId} failed:`, error);
    }
};

    
// Login form functions (make sure these are global)
window.login = function(event) {
    event.preventDefault();
    console.log('Login function called');
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    // Add your login logic here
    console.log('Login attempt:', username);
    
    // Example login logic (replace with your actual logic)
    if (username && password) {
        // Hide login section and show admin section
        document.getElementById('loginSection').style.display = 'none';
        document.getElementById('adminSection').classList.add('active');
        console.log('Login successful');
    } else {
        console.log('Login failed - missing credentials');
        // Show error message
        const errorDiv = document.getElementById('loginError');
        if (errorDiv) {
            errorDiv.innerHTML = '<div class="error">Please enter both username and password</div>';
        }
    }
};

window.fillAdminCredentials = function() {
    console.log('Fill admin credentials called');
    
    const usernameField = document.getElementById('username');
    const passwordField = document.getElementById('password');
    
    if (usernameField && passwordField) {
        usernameField.value = 'admin@narap.org'; // Replace with your admin email
        passwordField.value = 'admin123'; // Replace with your admin password
        console.log('Admin credentials filled');
    } else {
        console.error('Username or password field not found');
    }
};

window.clearLoginForm = function() {
    console.log('Clear login form called');
    
    const usernameField = document.getElementById('username');
    const passwordField = document.getElementById('password');
    const errorDiv = document.getElementById('loginError');
    
    if (usernameField) usernameField.value = '';
    if (passwordField) passwordField.value = '';
    if (errorDiv) errorDiv.innerHTML = '';
    
    console.log('Login form cleared');
};

// Tab switching function
window.switchTab = function(tabName) {
    console.log('Switching to tab:', tabName);
    
    // Hide all panels
    const panels = document.querySelectorAll('.panel');
    panels.forEach(panel => {
        panel.classList.remove('active');
    });
    
    // Remove active class from all nav items
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.classList.remove('active');
    });
    
    // Show selected panel
    const selectedPanel = document.getElementById('panel-' + tabName);
    if (selectedPanel) {
        selectedPanel.classList.add('active');
    }
    
    // Add active class to selected nav item
    const selectedNavItem = document.getElementById('btn-' + tabName);
    if (selectedNavItem) {
        selectedNavItem.classList.add('active');
    }
    
    // Update header title
    const headerTitle = document.getElementById('headerTitle');
    if (headerTitle) {
        headerTitle.textContent = tabName.charAt(0).toUpperCase() + tabName.slice(1);
    }
    
    console.log('Tab switched to:', tabName);
};

// Logout function
window.logout = function() {
    console.log('Logout called');
    
    // Hide admin section and show login section
    document.getElementById('adminSection').classList.remove('active');
    document.getElementById('loginSection').style.display = 'flex';
    
    // Clear login form
    clearLoginForm();
    
    console.log('Logged out successfully');
};



// Debug function
window.toggleSidebar = function() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    const hamburger = document.querySelector('.hamburger-btn');
    
    console.log('toggleSidebar called');
    
    if (sidebar) {
        sidebar.classList.toggle('active');  // ✅ This is the exact toggle for visibility
    }
    
    if (overlay) {
        overlay.classList.toggle('active');
    }
    
    if (hamburger) {
        hamburger.classList.toggle('active');
    }
};
// Enhanced toggle function with better error handling
window.toggleSidebarEnhanced = function() {
    try {
        const sidebar = document.querySelector('.sidebar');
        const overlay = document.querySelector('.sidebar-overlay');
        
        if (!sidebar) {
            console.error('Sidebar element not found');
            return;
        }
        
        const isOpen = sidebar.classList.contains('mobile-open');
        
        if (isOpen) {
            window.closeSidebar();
            console.log('Sidebar closed');
        } else {
            window.openSidebar();
            console.log('Sidebar opened');
        }
        
    } catch (error) {
        console.error('Error in toggleSidebarEnhanced:', error);
    }
};


// Ensure functions are available immediately
window.addEventListener('load', function() {
    console.log('Window loaded, ensuring all functions are available');
    
    // Double-check that all functions exist
    const requiredFunctions = ['login', 'fillAdminCredentials', 'clearLoginForm', 'toggleSidebar', 'switchTab', 'logout'];
    
    requiredFunctions.forEach(funcName => {
        if (typeof window[funcName] !== 'function') {
            console.error(`Function ${funcName} is not available`);
        } else {
            console.log(`Function ${funcName} is available`);
        }
    });
});


// Additional global functions that might be needed

// Function to check if device is mobile
window.isMobile = function() {
    return window.innerWidth <= 768;
};

// Function to close sidebar (can be called from anywhere)



// Fallback for older browsers or if main function fails
window.addEventListener('load', function() {
    // Double-check that toggle function exists
    if (typeof window.toggleSidebar !== 'function') {
        console.warn('Main toggleSidebar function not found, creating fallback');
        window.toggleSidebar = function() {
            const sidebar = document.querySelector('.sidebar');
            const overlay = document.querySelector('.sidebar-overlay');
            
            if (sidebar) sidebar.classList.toggle('active');
            if (overlay) overlay.classList.toggle('active');
        };
    }
});


// Debug function to check sidebar state
window.debugSidebar = function() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    const hamburgerBtns = document.querySelectorAll('.hamburger-btn');
    
    console.log('=== SIDEBAR DEBUG INFO ===');
    console.log('Sidebar element:', sidebar);
    console.log('Sidebar classes:', sidebar ? sidebar.className : 'Not found');
    console.log('Overlay element:', overlay);
    console.log('Hamburger buttons found:', hamburgerBtns.length);
    console.log('Window width:', window.innerWidth);
    console.log('toggleSidebar function exists:', typeof window.toggleSidebar === 'function');
    console.log('========================');
};



// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    // Escape key to close modals
    if (e.key === 'Escape') {
        const openModals = document.querySelectorAll('.modal[style*="block"]');
        openModals.forEach(modal => {
            modal.style.display = 'none';
        });
    }
    
    // Ctrl+N or Cmd+N to add new member (when in members tab)
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        const activeTab = document.querySelector('.tab-content.active');
        if (activeTab && activeTab.id === 'membersTab') {
            e.preventDefault();
            showAddMemberModal();
        }
    }
    
    // Ctrl+I or Cmd+I to issue certificate (when in certificates tab)
    if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
        const activeTab = document.querySelector('.tab-content.active');
        if (activeTab && activeTab.id === 'certificatesTab') {
            e.preventDefault();
            showIssueCertificateModal();
        }
    }
    
    // Ctrl+R or Cmd+R to refresh current tab
    if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        const activeTab = document.querySelector('.tab-content.active');
        if (activeTab && document.getElementById('adminSection').style.display === 'block') {
            e.preventDefault();
            const tabId = activeTab.id.replace('Tab', '');
            switchTab(tabId);
        }
    }
    
    // Ctrl+S or Cmd+S to sync with backend
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        if (document.getElementById('adminSection').style.display === 'block') {
            e.preventDefault();
            syncWithBackend();
        }
    }
});

// Global error handlers
window.addEventListener('error', function(e) {
    console.error('Global error:', e.error);
    showMessage('An unexpected error occurred', 'error');
});

window.addEventListener('unhandledrejection', function(e) {
    console.error('Unhandled promise rejection:', e.reason);
    showMessage('Network or server error occurred', 'error');
});

// Cleanup on page unload
window.addEventListener('beforeunload', function() {
    stopAutoRefresh();
});

// Export main functions for global access
window.narapAdmin = {
    // Authentication
    login,
    logout,
    
    // Navigation
    switchTab,
    
    // Data loading
    loadDashboard,
    loadMembers,
    loadCertificates,
    loadAnalytics,
    loadSystemInfo,
    
    // Member management
    addMember,
    editMember,
    updateMember,
    deleteMember,
    viewIdCard,
    
    // Certificate management
    getCertificates,
    issueCertificate,
    viewCertificate,
    revokeCertificate,
    deleteCertificate,
    downloadCertificateById,
    verifyCertificate,
    
    // Import/Export
    exportMembers,
    exportCertificates,
    importData,
    exportAllData,
    downloadSampleCSV,
    
    // System functions
    syncWithBackend,
    syncPendingChanges,
    createBackup,
    restoreBackup,
    clearAllData,
    checkSystemHealth,
    
    // Utilities
    toggleTheme,
    startAutoRefresh,
    stopAutoRefresh,
    generateMemberCode,
    generateCertificatePreview,
    generateIdCardPreview,
    
    // Modal management
    showAddMemberModal,
    closeAddMemberModal,
    showEditMemberModal,
    closeEditMemberModal,
    showIssueCertificateModal,
    closeIssueCertificateModal,
    showImportModal,
    closeImportModal,
    showRestoreModal,
    closeRestoreModal,
    closeViewIdCardModal,
    closeViewCertificateModal,
    
    // Quick actions
    quickAddMember,
    quickIssueCertificate,
    
    // Print functions
    printIdCard,
    printCertificate,
    downloadIdCard,
    downloadCertificate,
    
    // Search and filter
    searchMembers,
    searchCertificates,
    filterMembers,
    filterCertificates,
    
    // Refresh functions
    refreshMembers,
    refreshCertificates
};

// Enhanced offline support
function handleOfflineMode() {
    if (!navigator.onLine) {
        showMessage('You are currently offline. Some features may be limited.', 'warning');
        
        // Load data from local storage
        const localCertificates = getLocalCertificates();
        if (localCertificates.length > 0) {
            currentCertificates = localCertificates;
            console.log('Loaded certificates from local storage:', localCertificates.length);
        }
        
        // Show pending sync count
        const pendingSync = getPendingSync();
        const pendingCount = pendingSync.certificateCreations.length + 
                           pendingSync.certificateUpdates.length + 
                           pendingSync.certificateDeletions.length;
        
        if (pendingCount > 0) {
            showMessage(`${pendingCount} changes pending sync when online`, 'info');
        }
    }
}

// Call offline handler on load
window.addEventListener('load', handleOfflineMode);

// Handle online/offline events
window.addEventListener('online', function() {
    showMessage('Connection restored. Syncing pending changes...', 'success');
    syncPendingChanges();
});

window.addEventListener('offline', function() {
    showMessage('Connection lost. Working in offline mode.', 'warning');
    handleOfflineMode();
});

// Enhanced certificate status management
function updateCertificateStatus(certificateId, newStatus, reason = '') {
    const certificate = currentCertificates.find(c => (c._id || c.id) === certificateId);
    if (!certificate) {
        showMessage('Certificate not found', 'error');
        return;
    }
    
    // Update local certificate
    certificate.status = newStatus;
    certificate.statusUpdatedAt = new Date().toISOString();
    
    if (newStatus === 'revoked') {
        certificate.revokedAt = new Date().toISOString();
        certificate.revokedReason = reason;
        certificate.revokedBy = 'Admin';
    }
    
    // Save to local storage
    const localCertificates = getLocalCertificates();
    const localIndex = localCertificates.findIndex(c => (c._id || c.id) === certificateId);
    if (localIndex !== -1) {
        localCertificates[localIndex] = certificate;
        saveLocalCertificates(localCertificates);
    }
    
    // Add to pending sync
    const pendingSync = getPendingSync();
    pendingSync.certificateUpdates.push(certificate);
    savePendingSync(pendingSync);
    
    // Try to sync immediately if online
    if (navigator.onLine) {
        syncPendingChanges();
    }
}

// Batch operations
function selectAllMembers() {
    const checkboxes = document.querySelectorAll('#membersTableBody input[type="checkbox"]');
    const selectAllCheckbox = document.getElementById('selectAllMembers');
    
    checkboxes.forEach(checkbox => {
        checkbox.checked = selectAllCheckbox.checked;
        const memberId = checkbox.value;
        if (selectAllCheckbox.checked) {
            selectedMembers.add(memberId);
        } else {
            selectedMembers.delete(memberId);
        }
    });
    
    updateBatchActions();
}

function updateBatchActions() {
    const batchActionsDiv = document.getElementById('batchActions');
    const selectedCount = selectedMembers.size;
    
    if (batchActionsDiv) {
        if (selectedCount > 0) {
            batchActionsDiv.style.display = 'block';
            batchActionsDiv.innerHTML = `
                <div class="batch-actions-bar" style="background: #f8f9fa; padding: 10px; border-radius: 4px; margin: 10px 0;">
                    <span>${selectedCount} member${selectedCount > 1 ? 's' : ''} selected</span>
                    <div class="batch-buttons" style="float: right;">
                        <button onclick="batchExportMembers()" class="btn btn-info btn-sm">Export Selected</button>
                        <button onclick="batchDeleteMembers()" class="btn btn-danger btn-sm">Delete Selected</button>
                        <button onclick="clearSelection()" class="btn btn-secondary btn-sm">Clear Selection</button>
                    </div>
                </div>
            `;
        } else {
            batchActionsDiv.style.display = 'none';
        }
    }
}

function clearSelection() {
    selectedMembers.clear();
    const checkboxes = document.querySelectorAll('#membersTableBody input[type="checkbox"]');
    checkboxes.forEach(checkbox => checkbox.checked = false);
    const selectAllCheckbox = document.getElementById('selectAllMembers');
    if (selectAllCheckbox) selectAllCheckbox.checked = false;
    updateBatchActions();
}

async function batchDeleteMembers() {
    if (selectedMembers.size === 0) {
        showMessage('No members selected', 'error');
        return;
    }
    
    if (!confirm(`Are you sure you want to delete ${selectedMembers.size} selected member${selectedMembers.size > 1 ? 's' : ''}?\n\nThis action cannot be undone!`)) {
        return;
    }
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const memberId of selectedMembers) {
        try {
            const res = await fetch(`${backendUrl}/api/deleteUser/${memberId}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            
            if (res.ok) {
                successCount++;
            } else {
                errorCount++;
            }
        } catch (error) {
            errorCount++;
        }
    }
    
    showMessage(`Batch delete completed: ${successCount} success, ${errorCount} failed`, successCount > 0 ? 'success' : 'error');
    clearSelection();
    await loadMembers();
    await loadDashboard();
}

function batchExportMembers() {
    if (selectedMembers.size === 0) {
        showMessage('No members selected', 'error');
        return;
    }
    
    const selectedMemberData = currentMembers.filter(member => selectedMembers.has(member._id));
    const csvContent = convertToCSV(selectedMemberData);
    downloadFile(csvContent, `narap_selected_members_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
    showMessage(`Exported ${selectedMemberData.length} selected members`, 'success');
}

// Advanced search functionality
function advancedSearch() {
    const searchModal = document.getElementById('advancedSearchModal');
    if (searchModal) {
        searchModal.style.display = 'block';
    }
}

function performAdvancedSearch() {
    const searchCriteria = {
        name: document.getElementById('searchName').value.toLowerCase(),
        email: document.getElementById('searchEmail').value.toLowerCase(),
        code: document.getElementById('searchCode').value.toLowerCase(),
        position: document.getElementById('searchPosition').value,
        state: document.getElementById('searchState').value,
        dateFrom: document.getElementById('searchDateFrom').value,
        dateTo: document.getElementById('searchDateTo').value
    };
    
    const rows = document.querySelectorAll('#membersTableBody tr');
    let visibleCount = 0;
    
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length < 6) return;
        
        const memberData = {
            name: cells[1].textContent.toLowerCase(),
            email: cells[2].textContent.toLowerCase(),
            code: cells[3].textContent.toLowerCase(),
            position: cells[4].textContent,
            state: cells[5].textContent
        };
        
        let matches = true;
        
        // Check each search criteria
        if (searchCriteria.name && !memberData.name.includes(searchCriteria.name)) matches = false;
        if (searchCriteria.email && !memberData.email.includes(searchCriteria.email)) matches = false;
        if (searchCriteria.code && !memberData.code.includes(searchCriteria.code)) matches = false;
        if (searchCriteria.position && memberData.position !== searchCriteria.position) matches = false;
        if (searchCriteria.state && memberData.state !== searchCriteria.state) matches = false;
        
        if (matches) {
            row.style.display = '';
            visibleCount++;
        } else {
            row.style.display = 'none';
        }
    });
    
    showMessage(`Advanced search completed: ${visibleCount} members found`, 'success');
    document.getElementById('advancedSearchModal').style.display = 'none';
}

function clearAdvancedSearch() {
    // Clear all search fields
    document.getElementById('searchName').value = '';
    document.getElementById('searchEmail').value = '';
    document.getElementById('searchCode').value = '';
    document.getElementById('searchPosition').value = '';
    document.getElementById('searchState').value = '';
    document.getElementById('searchDateFrom').value = '';
    document.getElementById('searchDateTo').value = '';
    
    // Show all rows
    const rows = document.querySelectorAll('#membersTableBody tr');
    rows.forEach(row => row.style.display = '');
    
    showMessage('Search filters cleared', 'success');
    document.getElementById('advancedSearchModal').style.display = 'none';
}

// Certificate analytics
function generateCertificateAnalytics() {
    const certificates = currentCertificates;
    
    const analytics = {
        total: certificates.length,
        active: certificates.filter(c => c.status === 'active' || !c.status).length,
        revoked: certificates.filter(c => c.status === 'revoked').length,
        expired: certificates.filter(c => c.status === 'expired').length,
        thisMonth: 0,
        thisYear: 0,
        byType: {},
        byMonth: {}
    };
    
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    certificates.forEach(cert => {
        const issueDate = new Date(cert.issueDate || cert.createdAt);
        
        // Count this month and year
        if (issueDate.getMonth() === currentMonth && issueDate.getFullYear() === currentYear) {
            analytics.thisMonth++;
        }
        if (issueDate.getFullYear() === currentYear) {
            analytics.thisYear++;
        }
        
        // Count by type
        const type = cert.type || 'membership';
        analytics.byType[type] = (analytics.byType[type] || 0) + 1;
        
        // Count by month
        const monthKey = `${issueDate.getFullYear()}-${String(issueDate.getMonth() + 1).padStart(2, '0')}`;
        analytics.byMonth[monthKey] = (analytics.byMonth[monthKey] || 0) + 1;
    });
    
    return analytics;
}

function displayCertificateAnalytics() {
    const analytics = generateCertificateAnalytics();
    const analyticsDiv = document.getElementById('certificateAnalytics');
    
    if (!analyticsDiv) return;
    
    analyticsDiv.innerHTML = `
        <div class="analytics-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0;">
            <div class="analytics-card" style="background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center;">
                <h4 style="margin: 0 0 10px 0; color: #333;">Total Certificates</h4>
                <div style="font-size: 24px; font-weight: bold; color: #007bff;">${analytics.total}</div>
            </div>
            <div class="analytics-card" style="background: #d4edda; padding: 15px; border-radius: 8px; text-align: center;">
                <h4 style="margin: 0 0 10px 0; color: #155724;">Active</h4>
                <div style="font-size: 24px; font-weight: bold; color: #28a745;">${analytics.active}</div>
            </div>
            <div class="analytics-card" style="background: #f8d7da; padding: 15px; border-radius: 8px; text-align: center;">
                <h4 style="margin: 0 0 10px 0; color: #721c24;">Revoked</h4>
                <div style="font-size: 24px; font-weight: bold; color: #dc3545;">${analytics.revoked}</div>
            </div>
            <div class="analytics-card" style="background: #fff3cd; padding: 15px; border-radius: 8px; text-align: center;">
                <h4 style="margin: 0 0 10px 0; color: #856404;">This Month</h4>
                <div style="font-size: 24px; font-weight: bold; color: #ffc107;">${analytics.thisMonth}</div>
            </div>
        </div>
        
        <div class="analytics-details" style="margin-top: 20px;">
            <h5>Certificate Types</h5>
            <div class="type-breakdown" style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
                ${Object.entries(analytics.byType).map(([type, count]) => `
                    <div style="display: flex; justify-content: space-between; margin: 5px 0;">
                        <span>${type.charAt(0).toUpperCase() + type.slice(1)}</span>
                        <strong>${count}</strong>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

// Member analytics
function generateMemberAnalytics() {
    const members = currentMembers;
    
    const analytics = {
        total: members.length,
        thisMonth: 0,
        thisYear: 0,
        byPosition: {},
        byState: {},
        byZone: {}
    };
    
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    members.forEach(member => {
        const joinDate = new Date(member.createdAt || member.dateAdded || Date.now());
        
        // Count this month and year
        if (joinDate.getMonth() === currentMonth && joinDate.getFullYear() === currentYear) {
            analytics.thisMonth++;
        }
        if (joinDate.getFullYear() === currentYear) {
            analytics.thisYear++;
        }
        
        // Count by position
        const position = member.position || 'MEMBER';
        analytics.byPosition[position] = (analytics.byPosition[position] || 0) + 1;
        
        // Count by state
        const state = member.state || 'Unknown';
        analytics.byState[state] = (analytics.byState[state] || 0) + 1;
        
        // Count by zone
        const zone = member.zone || 'Unknown';
        analytics.byZone[zone] = (analytics.byZone[zone] || 0) + 1;
    });
    
    return analytics;
}

function displayMemberAnalytics() {
    const analytics = generateMemberAnalytics();
    const analyticsDiv = document.getElementById('memberAnalytics');
    
    if (!analyticsDiv) return;
    
    analyticsDiv.innerHTML = `
        <div class="analytics-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0;">
            <div class="analytics-card" style="background: #e3f2fd; padding: 15px; border-radius: 8px; text-align: center;">
                <h4 style="margin: 0 0 10px 0; color: #1565c0;">Total Members</h4>
                <div style="font-size: 24px; font-weight: bold; color: #1976d2;">${analytics.total}</div>
            </div>
            <div class="analytics-card" style="background: #f3e5f5; padding: 15px; border-radius: 8px; text-align: center;">
                <h4 style="margin: 0 0 10px 0; color: #7b1fa2;">This Month</h4>
                <div style="font-size: 24px; font-weight: bold; color: #9c27b0;">${analytics.thisMonth}</div>
            </div>
            <div class="analytics-card" style="background: #e8f5e8; padding: 15px; border-radius: 8px; text-align: center;">
                <h4 style="margin: 0 0 10px 0; color: #2e7d32;">This Year</h4>
                <div style="font-size: 24px; font-weight: bold; color: #4caf50;">${analytics.thisYear}</div>
            </div>
        </div>
        
        <div class="analytics-breakdown" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-top: 20px;">
            <div class="breakdown-section">
                <h5>By Position</h5>
                <div class="breakdown-content" style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
                    ${Object.entries(analytics.byPosition).map(([position, count]) => `
                        <div style="display: flex; justify-content: space-between; margin: 5px 0;">
                            <span>${position}</span>
                            <strong>${count}</strong>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div class="breakdown-section">
                <h5>Top States</h5>
                <div class="breakdown-content" style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
                    ${Object.entries(analytics.byState)
                        .sort(([,a], [,b]) => b - a)
                        .slice(0, 5)
                        .map(([state, count]) => `
                            <div style="display: flex; justify-content: space-between; margin: 5px 0;">
                                <span>${state}</span>
                                <strong>${count}</strong>
                            </div>
                        `).join('')}
                </div>
            </div>
        </div>
    `;
}

// Enhanced analytics loading
async function loadAnalytics() {
    try {
        showMessage('Loading analytics...', 'success');
        
        // Ensure we have current data
        if (currentMembers.length === 0) await loadUsers();
        if (currentCertificates.length === 0) await getCertificates();
        
        // Display analytics
        displayMemberAnalytics();
        displayCertificateAnalytics();
        
        // Generate charts if chart library is available
        if (typeof Chart !== 'undefined') {
            generateCharts();
        }
        
        showMessage('Analytics loaded successfully', 'success');
        
    } catch (error) {
        console.error('Analytics load error:', error);
        showMessage('Failed to load analytics', 'error');
    }
}

// Chart generation (requires Chart.js)
function generateCharts() {
    // Member registration trend chart
    const memberChart = document.getElementById('memberTrendChart');
    if (memberChart) {
        const ctx = memberChart.getContext('2d');
        const memberAnalytics = generateMemberAnalytics();
        
        // Generate last 12 months data
        const months = [];
        const memberCounts = [];
        const now = new Date();
        
        for (let i = 11; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            months.push(date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }));
            
            const count = currentMembers.filter(member => {
                const memberDate = new Date(member.createdAt || member.dateAdded || Date.now());
                return memberDate.getMonth() === date.getMonth() && 
                       memberDate.getFullYear() === date.getFullYear();
            }).length;
            
            memberCounts.push(count);
        }
        
        new Chart(ctx, {
    type: 'line',
    data: {
        labels: months,
        datasets: [{
            label: 'New Members',
            data: memberCounts,
            borderColor: '#007bff',
            backgroundColor: 'rgba(0, 123, 255, 0.1)',
            tension: 0.4
        }]
    },
    options: {
        responsive: true,
        scales: {
            y: {
                beginAtZero: true, // Add proper configuration
                title: {
                    display: true,
                    text: 'Number of Members'
                }
            },
            x: {
                title: {
                    display: true,
                    text: 'Month'
                }
            }
        }
    }
});
}
    
    // Certificate status pie chart
    const certChart = document.getElementById('certificateStatusChart');
    if (certChart) {
        const ctx = certChart.getContext('2d');
        const certAnalytics = generateCertificateAnalytics();
        
        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Active', 'Revoked', 'Expired'],
                datasets: [{
                    data: [certAnalytics.active, certAnalytics.revoked, certAnalytics.expired],
                    backgroundColor: ['#28a745', '#dc3545', '#ffc107']
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }
}

// Data validation and cleanup
async function exportData(type, format = 'json') {
    try {
        let data, filename;
        
        switch(type) {
            case 'members':
                data = currentMembers.length > 0 ? currentMembers : await loadUsers();
                filename = `narap_members_${new Date().toISOString().split('T')[0]}`;
                break;
                
            case 'certificates':
                data = currentCertificates.length > 0 ? currentCertificates : await getCertificates();
                filename = `narap_certificates_${new Date().toISOString().split('T')[0]}`;
                break;
                
            case 'all':
                const members = currentMembers.length > 0 ? currentMembers : await loadUsers();
                const certificates = currentCertificates.length > 0 ? currentCertificates : await getCertificates();
                data = { members, certificates, exportDate: new Date().toISOString() };
                filename = `narap_complete_export_${new Date().toISOString().split('T')[0]}`;
                break;
                
            default:
                throw new Error('Invalid export type');
        }
        
        let content, contentType, fileExtension;
        
        switch(format) {
            case 'csv':
                if (type === 'all') {
                    throw new Error('CSV format not supported for complete export');
                }
                content = convertToCSV(data);
                contentType = 'text/csv';
                fileExtension = 'csv';
                break;
                
            case 'xml':
                content = convertToXML(data, type);
                contentType = 'application/xml';
                fileExtension = 'xml';
                break;
                
            case 'json':
            default:
                content = JSON.stringify(data, null, 2);
                contentType = 'application/json';
                fileExtension = 'json';
                break;
        }
        
        downloadFile(content, `${filename}.${fileExtension}`, contentType);
        showMessage(`${type.charAt(0).toUpperCase() + type.slice(1)} exported successfully as ${format.toUpperCase()}!`, 'success');
        
    } catch (error) {
        console.error('Export error:', error);
        showMessage(`Failed to export ${type}: ${error.message}`, 'error');
    }
}

function convertToXML(data, type) {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += `<${type}>\n`;
    
    if (Array.isArray(data)) {
        data.forEach(item => {
            xml += `  <${type.slice(0, -1)}>\n`;
            Object.entries(item).forEach(([key, value]) => {
                xml += `    <${key}>${escapeXml(value || '')}</${key}>\n`;
            });
            xml += `  </${type.slice(0, -1)}>\n`;
        });
    } else {
        Object.entries(data).forEach(([key, value]) => {
            if (Array.isArray(value)) {
                xml += `  <${key}>\n`;
                value.forEach(item => {
                    xml += `    <item>\n`;
                    Object.entries(item).forEach(([itemKey, itemValue]) => {
                        xml += `      <${itemKey}>${escapeXml(itemValue || '')}</${itemKey}>\n`;
                    });
                    xml += `    </item>\n`;
                });
                xml += `  </${key}>\n`;
            } else {
                xml += `  <${key}>${escapeXml(value || '')}</${key}>\n`;
            }
        });
    }
    
    xml += `</${type}>`;
    return xml;
}

function escapeXml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}


// Initialize notification manager
const notificationManager = new NotificationManager();

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    .field-error {
        animation: shake 0.5s ease-in-out;
    }
    
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-5px); }
        75% { transform: translateX(5px); }
    }
    
    .loading-spinner {
        border: 2px solid #f3f3f3;
        border-top: 2px solid #007bff;
        border-radius: 50%;
        width: 20px;
        height: 20px;
        animation: spin 1s linear infinite;
        display: inline-block;
        margin-right: 8px;
    }
    
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);



// Fallback message function
function fallbackShowMessage(message, type) {
    const messagesDiv = document.getElementById('messages');
    if (messagesDiv) {
        messagesDiv.innerHTML = `<div class="${type}" style="padding: 10px; margin: 10px 0; border-radius: 4px; ${getMessageStyle(type)}">${message}</div>`;
        setTimeout(() => messagesDiv.innerHTML = '', 5000);
    } else {
        // Create a temporary message div
        const tempDiv = document.createElement('div');
        tempDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            padding: 10px;
            border-radius: 4px;
            ${getMessageStyle(type)}
        `;
        tempDiv.textContent = message;
        document.body.appendChild(tempDiv);
        
        setTimeout(() => {
            if (tempDiv.parentElement) {
                tempDiv.parentElement.removeChild(tempDiv);
            }
        }, 5000);
    }
}

function getMessageStyle(type) {
    switch(type) {
        case 'success':
            return 'background: #d4edda; color: #155724; border: 1px solid #c3e6cb;';
        case 'error':
            return 'background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb;';
        case 'warning':
            return 'background: #fff3cd; color: #856404; border: 1px solid #ffeaa7;';
        case 'info':
            return 'background: #d1ecf1; color: #0c5460; border: 1px solid #bee5eb;';
        default:
            return 'background: #f8f9fa; color: #333; border: 1px solid #dee2e6;';
    }
}





// Revoke certificate function
async function revokeCertificate(certificateId) {
    const reason = prompt('Please enter the reason for revoking this certificate:');
    if (!reason) {
        showMessage('Revocation cancelled', 'info');
        return;
    }
    
    if (!confirm('Are you sure you want to revoke this certificate?')) {
        return;
    }
    
    try {
        showMessage('Revoking certificate...', 'info');
        
        // Update certificate status
        const certificate = currentCertificates.find(c => c._id === certificateId || c.id === certificateId);
        if (certificate) {
            certificate.status = 'revoked';
            certificate.revokedAt = new Date().toISOString();
            certificate.revokedReason = reason;
            certificate.revokedBy = 'Admin'; // You might want to get actual admin name
            
            // Save to local storage
            saveLocalCertificates(currentCertificates);
            
            // Try to sync with backend
            if (navigator.onLine) {
                try {
                    await fetch(`${backendUrl}/api/certificates/${certificateId}/revoke`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ reason, revokedBy: 'Admin' })
                    });
                } catch (error) {
                    console.warn('Backend sync failed for revocation:', error);
                }
            }
            
            showMessage('Certificate revoked successfully!', 'success');
            await loadCertificates();
        }
    } catch (error) {
        console.error('Revoke certificate error:', error);
        showMessage('Failed to revoke certificate', 'error');
    }
}

// Restore certificate function
async function restoreCertificate(certificateId) {
    if (!confirm('Are you sure you want to restore this certificate?')) {
        return;
    }
    
    try {
        showMessage('Restoring certificate...', 'info');
        
        const certificate = currentCertificates.find(c => c._id === certificateId || c.id === certificateId);
        if (certificate) {
            certificate.status = 'active';
            delete certificate.revokedAt;
            delete certificate.revokedReason;
            delete certificate.revokedBy;
            
            // Save to local storage
            saveLocalCertificates(currentCertificates);
            
            // Try to sync with backend
            if (navigator.onLine) {
                try {
                    await fetch(`${backendUrl}/api/certificates/${certificateId}/restore`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include'
                    });
                } catch (error) {
                    console.warn('Backend sync failed for restoration:', error);
                }
            }
            
            showMessage('Certificate restored successfully!', 'success');
            await loadCertificates();
        }
    } catch (error) {
        console.error('Restore certificate error:', error);
        showMessage('Failed to restore certificate', 'error');
    }
}


// Add this class definition RIGHT BEFORE your existing line
class PerformanceMonitor {
    constructor() {
        this.startTime = Date.now();
        this.metrics = {};
    }
    
    start(label = 'default') {
        this.metrics[label] = Date.now();
        return this;
    }
    
    end(label = 'default') {
        if (this.metrics[label]) {
            return Date.now() - this.metrics[label];
        }
        return 0;
    }
    
    log(message, label = 'default') {
        const duration = this.end(label);
        console.log(`⏱️ Performance: ${message} - ${duration}ms`);
        return duration;
    }
    
    reset() {
        this.metrics = {};
        this.startTime = Date.now();
    }
}

// Enhanced API call wrapper with performance monitoring
async function apiCall(endpoint, options = {}) {
    const startTime = performance.now();
    let success = false;
    
    try {
        performanceMonitor.startTimer(`API: ${endpoint}`);
        
        const response = await fetch(`${backendUrl}${endpoint}`, {
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });
        
        const duration = performance.now() - startTime;
        success = response.ok;
        
        performanceMonitor.recordApiCall(endpoint, duration, success);
        performanceMonitor.endTimer(`API: ${endpoint}`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return response;
        
    } catch (error) {
        const duration = performance.now() - startTime;
        performanceMonitor.recordApiCall(endpoint, duration, false);
        performanceMonitor.recordError(error, `API call to ${endpoint}`);
        throw error;
    }
}

// Enhanced loading states
function showLoadingState(element, message = 'Loading...') {
    if (typeof element === 'string') {
        element = document.getElementById(element);
    }
    
    if (element) {
        element.innerHTML = `
            <div class="loading-state" style="display: flex; align-items: center; justify-content: center; padding: 20px;">
                <div class="loading-spinner"></div>
                <span>${message}</span>
            </div>
        `;
    }
}

function hideLoadingState(element) {
    if (typeof element === 'string') {
        element = document.getElementById(element);
    }
    
    if (element) {
        const loadingState = element.querySelector('.loading-state');
        if (loadingState) {
            loadingState.remove();
        }
    }
}

// Enhanced error handling
function handleError(error, context = 'Unknown') {
    console.error(`Error in ${context}:`, error);
    performanceMonitor.recordError(error, context);
    
    let userMessage = 'An unexpected error occurred';
    
    if (error.message.includes('fetch')) {
        userMessage = 'Network error - please check your connection';
    } else if (error.message.includes('401')) {
        userMessage = 'Authentication required - please login again';
        logout();
    } else if (error.message.includes('403')) {
        userMessage = 'Access denied - insufficient permissions';
    } else if (error.message.includes('404')) {
        userMessage = 'Resource not found';
    } else if (error.message.includes('500')) {
        userMessage = 'Server error - please try again later';
    }
    
    showMessage(userMessage, 'error');
}

// Data caching system
class DataCache {
    constructor() {
        this.cache = new Map();
        this.expiry = new Map();
        this.defaultTTL = 5 * 60 * 1000; // 5 minutes
    }
    
    set(key, data, ttl = this.defaultTTL) {
        this.cache.set(key, data);
        this.expiry.set(key, Date.now() + ttl);
    }
    
    get(key) {
        if (this.has(key)) {
            return this.cache.get(key);
        }
        return null;
    }
    
    has(key) {
        if (!this.cache.has(key)) return false;
        
        const expiryTime = this.expiry.get(key);
        if (Date.now() > expiryTime) {
            this.delete(key);
            return false;
        }
        
        return true;
    }
    
    delete(key) {
        this.cache.delete(key);
        this.expiry.delete(key);
    }
    
    clear() {
        this.cache.clear();
        this.expiry.clear();
    }
    
    size() {
        return this.cache.size;
    }
}

// Initialize data cache
const dataCache = new DataCache();

// Enhanced data loading with caching
async function getCachedMembers(forceRefresh = false) {
    const cacheKey = 'members';
    
    if (!forceRefresh && dataCache.has(cacheKey)) {
        console.log('Loading members from cache');
        return dataCache.get(cacheKey);
    }
    
    try {
        const members = await loadUsers();
        dataCache.set(cacheKey, members);
        return members;
    } catch (error) {
        // Return cached data if available, even if expired
        const cachedData = dataCache.get(cacheKey);
        if (cachedData) {
            console.log('Using expired cache due to error');
            return cachedData;
        }
        throw error;
    }
}

async function getCachedCertificates(forceRefresh = false) {
    const cacheKey = 'certificates';
    
    if (!forceRefresh && dataCache.has(cacheKey)) {
        console.log('Loading certificates from cache');
        return dataCache.get(cacheKey);
    }
    
    try {
        const certificates = await getCertificates();
        dataCache.set(cacheKey, certificates);
        return certificates;
    } catch (error) {
        // Return cached data if available, even if expired
        const cachedData = dataCache.get(cacheKey);
        if (cachedData) {
            console.log('Using expired cache due to error');
            return cachedData;
        }
        throw error;
    }
}

// Enhanced system monitoring
function startSystemMonitoring() {
    // Monitor memory usage
    setInterval(() => {
        if (performance.memory) {
            const memoryInfo = {
                used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
                total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
                limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
            };
            
            console.log('Memory usage:', memoryInfo);
            
            // Update UI if elements exist
            const memoryElement = document.getElementById('memoryUsage');
            if (memoryElement) {
                memoryElement.textContent = `${memoryInfo.used}MB / ${memoryInfo.total}MB`;
            }
        }
    }, 30000); // Every 30 seconds
    
    // Monitor cache size
    setInterval(() => {
        const cacheSize = dataCache.size();
        console.log('Cache entries:', cacheSize);
        
        const cacheElement = document.getElementById('cacheSize');
        if (cacheElement) {
            cacheElement.textContent = `${cacheSize} entries`;
        }
    }, 60000); // Every minute
}

// Accessibility enhancements
function enhanceAccessibility() {
    // Add ARIA labels to buttons without text
    document.querySelectorAll('button i.fas').forEach(button => {
        const parent = button.parentElement;
        if (!parent.getAttribute('aria-label') && !parent.textContent.trim()) {
            const iconClass = button.className;
            let label = 'Button';
            
            if (iconClass.includes('fa-edit')) label = 'Edit';
            else if (iconClass.includes('fa-trash')) label = 'Delete';
            else if (iconClass.includes('fa-eye')) label = 'View';
            else if (iconClass.includes('fa-download')) label = 'Download';
            else if (iconClass.includes('fa-print')) label = 'Print';
            
            parent.setAttribute('aria-label', label);
        }
    });
    
    // Add keyboard navigation to tables
    document.querySelectorAll('table tbody tr').forEach((row, index) => {
        row.setAttribute('tabindex', '0');
        row.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                const firstButton = this.querySelector('button');
                if (firstButton) {
                    firstButton.click();
                }
            }
        });
    });
    
    // Enhance modal accessibility
    document.querySelectorAll('.modal').forEach(modal => {
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        
        // Focus management
        modal.addEventListener('shown', function() {
            const firstInput = this.querySelector('input, select, textarea, button');
            if (firstInput) {
                firstInput.focus();
            }
        });
    });
}

// Final initialization and cleanup
function finalizeInitialization() {
    console.log('Finalizing NARAP Admin Panel initialization...');
    
    // Setup form validation
    setupFormValidation();
    
    // Enhance accessibility
    enhanceAccessibility();
    
    // Start system monitoring
    startSystemMonitoring();
    
    // Setup periodic cache cleanup
    setInterval(() => {
        console.log('Performing cache cleanup...');
        // Cache cleanup is automatic via expiry checking
    }, 10 * 60 * 1000); // Every 10 minutes
    
    // Setup auto-save for forms
    setupAutoSave();
    
    // Initialize tooltips if library is available
    if (typeof bootstrap !== 'undefined' && bootstrap.Tooltip) {
        const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
        tooltipTriggerList.map(function (tooltipTriggerEl) {
            return new bootstrap.Tooltip(tooltipTriggerEl);
        });
    }
    
    console.log('NARAP Admin Panel fully initialized and ready!');
    console.log('Performance report:', performanceMonitor.getReport());
}

// Auto-save functionality
function setupAutoSave() {
    const forms = ['addMemberForm', 'issueCertificateForm'];
    
    forms.forEach(formId => {
        const form = document.getElementById(formId);
        if (form) {
            const inputs = form.querySelectorAll('input, select, textarea');
            
            inputs.forEach(input => {
                input.addEventListener('input', debounce(() => {
                    saveFormData(formId);
                }, 1000));
            });
        }
    });
}

function saveFormData(formId) {
    const form = document.getElementById(formId);
    if (!form) return;
    
    const formData = new FormData(form);
    const data = {};
    
    for (let [key, value] of formData.entries()) {
        data[key] = value;
    }
    
    localStorage.setItem(`narap_autosave_${formId}`, JSON.stringify(data));
    console.log(`Auto-saved form data for ${formId}`);
}

function loadFormData(formId) {
    const savedData = localStorage.getItem(`narap_autosave_${formId}`);
    if (!savedData) return;
    
    try {
        const data = JSON.parse(savedData);
        const form = document.getElementById(formId);
        if (!form) return;
        
        Object.entries(data).forEach(([key, value]) => {
            const field = form.querySelector(`[name="${key}"]`);
            if (field && value) {
                field.value = value;
            }
        });
        
        showMessage('Form data restored from auto-save', 'info');
    } catch (error) {
        console.error('Failed to load auto-saved form data:', error);
    }
}

function clearFormData(formId) {
    localStorage.removeItem(`narap_autosave_${formId}`);
}

// Utility function for debouncing
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Update the main narapAdmin object with all new functions
window.narapAdmin = {
    ...window.narapAdmin,
    
    // Enhanced functions
    apiCall,
    getCachedMembers,
    getCachedCertificates,
    exportData,
    handleError,
    
    // Utility classes
    notificationManager,
    performanceMonitor,
    dataCache,
    
    // Form functions
    validateField,
    saveFormData,
    loadFormData,
    clearFormData,
    
    // System functions
    finalizeInitialization,
    enhanceAccessibility,
    startSystemMonitoring
};

// Export for module systems if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.narapAdmin;
}

console.log('NARAP Admin Panel JavaScript fully loaded');
console.log('Total functions available:', Object.keys(window.narapAdmin).length);
console.log('Ready for production use!');

// Update the member verification display to handle passport photos correctly
function displayMemberVerification(member) {
    const verificationResult = document.getElementById('verificationResult');
    if (!verificationResult) return;
    
    // Handle passport photo with better fallback
    const passportPhoto = member.passportPhoto || member.passport;
    const photoSrc = passportPhoto && passportPhoto !== 'undefined'
        ? (passportPhoto.startsWith('data:') ? passportPhoto : `${backendUrl}/${passportPhoto}`)
        : 'images/default-avatar.png';
    
    // Handle optional email
    const email = member.email || 'Not provided';
    
    verificationResult.innerHTML = `
        <div class="member-card">
            <div class="member-photo">
                <img src="${photoSrc}"
                     alt="Member Photo"
                     style="width: 100px; height: 100px; border-radius: 50%; object-fit: cover;"
                     onerror="this.src='images/default-avatar.png'">
            </div>
            <div class="member-details">
                <h3>${escapeHtml(member.name)}</h3>
                <p><strong>Code:</strong> ${escapeHtml(member.code)}</p>
                <p><strong>Email:</strong> ${escapeHtml(email)}</p>
                <p><strong>Position:</strong> ${escapeHtml(member.position || 'MEMBER')}</p>
                <p><strong>State:</strong> ${escapeHtml(member.state)}</p>
                <p><strong>Zone:</strong> ${escapeHtml(member.zone)}</p>
                <p><strong>Status:</strong> <span class="status-active">ACTIVE</span></p>
                <p><strong>Date Added:</strong> ${formatDate(member.dateAdded)}</p>
            </div>
        </div>
    `;
}


// Update form validation to make email optional
// Update form validation to make email optional
function validateMemberForm() {
    const name = document.getElementById('memberName')?.value?.trim();
    const email = document.getElementById('memberEmail')?.value?.trim();
    const code = document.getElementById('memberCode')?.value?.trim();
    const password = document.getElementById('memberPassword')?.value;
    const state = document.getElementById('memberState')?.value?.trim();
    const zone = document.getElementById('memberZone')?.value?.trim();
    
    const errors = [];
    
    if (!name || name.length < 2) {
        errors.push('Name must be at least 2 characters long');
    }
    
    // Email is now optional, but if provided, must be valid
    if (email && !validateEmail(email)) {
        errors.push('Please enter a valid email address');
    }
    
    if (!code || code.length < 3) {
        errors.push('Member code must be at least 3 characters long');
    }
    
    if (!password || password.length < 6) {
        errors.push('Password must be at least 6 characters long');
    }
    
    if (!state) {
        errors.push('State is required');
    }
    
    if (!zone) {
        errors.push('Zone is required');
    }
    
    return {
        isValid: errors.length === 0,
        errors: errors
    };
}


// Update certificate form validation to make email optional
function validateCertificateForm() {
    const number = document.getElementById('certificateNumber')?.value?.trim();
    const recipient = document.getElementById('certificateRecipient')?.value?.trim();
    const email = document.getElementById('certificateEmail')?.value?.trim();
    const title = document.getElementById('certificateTitle')?.value?.trim();
    
    const errors = [];
    
    if (!number || number.length < 3) {
        errors.push('Certificate number is required');
    }
    
    if (!recipient || recipient.length < 2) {
        errors.push('Recipient name is required');
    }
    
    // Email is now optional, but if provided, must be valid
    if (email && !validateEmail(email)) {
        errors.push('Please enter a valid email address');
    }
    
    if (!title || title.length < 3) {
        errors.push('Certificate title is required');
    }
    
    return {
        isValid: errors.length === 0,
        errors: errors
    };
}


// Add utility function to clear image previews
function clearImagePreviews() {
    const passportPreview = document.getElementById('passportPreview');
    const signaturePreview = document.getElementById('signaturePreview');
    
    if (passportPreview) {
        passportPreview.src = 'images/default-avatar.png';
    }
    
    if (signaturePreview) {
        signaturePreview.src = 'images/default-signature.png';
    }
}

// Initialize dashboard function
function initializeDashboard() {
    console.log('Initializing dashboard...');
    
    // Update navigation to show current section
    updateNavigation();
    
    // Load initial data
    if (typeof loadDashboardData === 'function') {
        loadDashboardData();
    }
    
    // Set up event listeners
    if (typeof setupEventListeners === 'function') {
        setupEventListeners();
    }
    
    // Show members section by default
    if (typeof showSection === 'function') {
        showSection('members');
    }
}

// Update navigation function
function updateNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const section = this.getAttribute('data-section');
            if (section && typeof showSection === 'function') {
                showSection(section);
            }
        });
    });
}

  // Update navigation to show current section
    updateNavigation();

    // Load initial data
    loadDashboardData();

    // Set up event listeners
    setupEventListeners();

    // Show members section by default
    showSection('members');


// ======================
// CORE FUNCTIONALITY
// ======================

// EVENT DELEGATION ==========================================
function setupEventDelegation() {
    document.body.addEventListener('click', function(event) {
        const target = event.target.closest('[data-action]');
        if (!target?.dataset?.id) return;

        const actions = {
            'delete': deleteMember,
            'edit': editMember,
            'view': viewIdCard
        };

        const handler = actions[target.dataset.action];
        if (handler) handler(target.dataset.id);
    });

    // Pagination handler
    document.addEventListener('click', function(e) {
        const pageBtn = e.target.closest('.page-number');
        if (pageBtn) {
            const page = parseInt(pageBtn.textContent.trim());
            if (!isNaN(page)) goToPage(page);
        }
    });
}


// ======================
// SIDEBAR SYSTEM
// ======================
function setupMobileMenu() {
    document.addEventListener('click', function(e) {
        const sidebar = document.querySelector('.sidebar');
        
        if (sidebar?.classList.contains('active')) {
            if (!sidebar.contains(e.target)) {
                window.toggleSidebar?.();
            }
        }
    });
}


window.toggleSidebar = function() {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;

    const isOpening = !sidebar.classList.contains('active');
    sidebar.classList.toggle('active');

    let overlay = document.querySelector('.sidebar-overlay');
    if (isOpening && !overlay) {
        overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay';
        overlay.onclick = window.closeSidebar;
        document.body.appendChild(overlay);
    }
    
    overlay?.classList.toggle('active');
    document.body.style.overflow = isOpening ? 'hidden' : '';
};

window.closeSidebar = function() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    if (sidebar) sidebar.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
    document.body.style.overflow = '';
};


// ======================
// MAIN INITIALIZATION
// ======================
document.addEventListener('DOMContentLoaded', function() {
    try {
        console.log('NARAP Admin Panel initializing...');
        
        // Core setup
        setupEventDelegation();
        setupMobileMenu(); // This will now use the hamburger-free version
        
        // Initialize sidebar functionality
        console.log('Admin.js loaded, toggleSidebar available:', typeof window.toggleSidebar === 'function');
        
        // Close sidebar when clicking overlay
        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('sidebar-overlay')) {
                window.toggleSidebar();
            }
        });
        
        // Initialize systems (your existing code)
        if (typeof loadTheme === 'function') loadTheme();
        if (typeof fillAdminCredentials === 'function') fillAdminCredentials();
        if (typeof switchTab === 'function') switchTab('dashboard');
        if (typeof initModals === 'function') initModals();
        if (typeof setupPreviewListeners === 'function') setupPreviewListeners();
        
        // Initialize pagination
        if (typeof initializePagination === 'function') {
            initializePagination();
        }
        
        // Load members
        setTimeout(() => {
            if (typeof loadMembers === 'function') {
                loadMembers().catch(console.error);
            }
        }, 1000);
        
        console.log('NARAP Admin Panel initialized successfully');
        
    } catch (error) {
        console.error('Error initializing admin panel:', error);
    }
});

// ===== Throttled Resize Handler =====
const throttleResize = (() => {
    let timeout;
    return (callback, delay = 100) => {
        clearTimeout(timeout);
        timeout = setTimeout(callback, delay);
    };
})();

window.addEventListener('resize', () => {
    throttleResize(() => {
        if (window.innerWidth >= 769) {
            if (typeof closeSidebar === 'function') {
                closeSidebar();
            }
        }
    });
});

// ======================
// PAGINATION
// ======================

document.addEventListener('click', function(e) {
    if (e.target.classList.contains('page-number')) {
        const page = parseInt(e.target.textContent.trim());
        if (!isNaN(page)) goToPage(page);
    }
});