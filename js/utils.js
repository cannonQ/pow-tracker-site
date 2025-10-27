// Utility functions for the PoW Tokenomics Tracker

// Format large numbers (e.g., 1500000000 -> 1.5B)
function formatNumber(num, decimals = 2) {
    if (num === null || num === undefined) return 'N/A';

    // If it's a string, check if it contains non-numeric characters like "~1200000"
    if (typeof num === 'string') {
        // If it starts with ~ or contains other non-numeric chars (except - and .), return as-is
        if (num.includes('~') || isNaN(parseFloat(num.replace(/[~,]/g, '')))) {
            return num;
        }
        // Try to convert to number
        num = parseFloat(num.replace(/[~,]/g, ''));
    }

    // Ensure we have a valid number
    if (isNaN(num)) return 'N/A';

    const absNum = Math.abs(num);

    if (absNum >= 1e12) {
        return (num / 1e12).toFixed(decimals) + 'T';
    } else if (absNum >= 1e9) {
        return (num / 1e9).toFixed(decimals) + 'B';
    } else if (absNum >= 1e6) {
        return (num / 1e6).toFixed(decimals) + 'M';
    } else if (absNum >= 1e3) {
        return (num / 1e3).toFixed(decimals) + 'K';
    }

    return num.toFixed(decimals);
}

// Format currency (e.g., 1500000000 -> $1.50B)
function formatCurrency(num, decimals = 2) {
    if (num === null || num === undefined) return 'N/A';
    return '$' + formatNumber(num, decimals);
}

// Format percentage
function formatPercent(num, decimals = 1) {
    if (num === null || num === undefined) return 'N/A';
    return num.toFixed(decimals) + '%';
}

// Format date
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// Calculate days between dates
function daysBetween(date1, date2) {
    const oneDay = 24 * 60 * 60 * 1000;
    const firstDate = new Date(date1);
    const secondDate = new Date(date2);
    return Math.round(Math.abs((firstDate - secondDate) / oneDay));
}

// Get days since launch
function daysSinceLaunch(launchDate) {
    return daysBetween(launchDate, new Date());
}

// Determine fairness badge
function getFairnessBadge(project, genesisData = null) {
    if (project.has_premine) {
        // Check if miners have achieved parity
        if (hasMinersAchievedParity(project, genesisData)) {
            return { class: 'badge-premine-parity', text: 'Premine' };
        }
        return { class: 'badge-premine', text: 'Premine' };
    }

    // Check for suspected insider mining
    if (project.launch_type === 'fair_with_suspicion') {
        return { class: 'badge-suspicious', text: 'Suspicious' };
    }

    if (project.launch_type === 'fair') {
        return { class: 'badge-fair', text: 'Fair Launch' };
    }

    return { class: 'badge-premine', text: project.launch_type };
}

// Get premine percentage (0 if fair launch)
function getPreminePercent(project, genesisData) {
    if (!project.has_premine || !genesisData) return 0;
    return genesisData.total_genesis_allocation_pct || 0;
}

// Check if miners have achieved parity with premine
function hasMinersAchievedParity(project, genesisData) {
    // Return false if no premine or missing required data
    if (!project.has_premine || !genesisData) return false;
    if (!project.emission?.daily_emission || !project.supply?.max_supply || !project.launch_date) return false;

    const dailyEmission = project.emission.daily_emission;
    const premineTokens = (genesisData.total_genesis_allocation_pct / 100) * project.supply.max_supply;
    const daysToDate = daysSinceLaunch(project.launch_date);
    const minedToDate = dailyEmission * daysToDate;

    return minedToDate >= premineTokens;
}

// Fetch JSON from GitHub using API (avoids CSP sandbox issues with raw.githubusercontent.com)
async function fetchFromGitHub(path) {
    // Use GitHub API instead of raw URLs to avoid CSP sandbox restrictions
    const apiUrl = `${CONFIG.API_BASE_URL}/${path}`;

    try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        // GitHub API returns base64 encoded content
        if (data.content) {
            const decoded = atob(data.content.replace(/\n/g, ''));
            return JSON.parse(decoded);
        }

        throw new Error('No content in response');
    } catch (error) {
        console.error(`Error fetching ${path}:`, error);
        return null;
    }
}

// Fetch list of project files from GitHub API
async function fetchProjectList() {
    const url = `${CONFIG.API_BASE_URL}/${CONFIG.PROJECTS_PATH}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const files = await response.json();
        // Filter for JSON files only
        return files.filter(file => file.name.endsWith('.json')).map(file => file.name.replace('.json', ''));
    } catch (error) {
        console.error('Error fetching project list:', error);
        return [];
    }
}

// Normalize project data structure
// Fixes cases where market_data is incorrectly nested inside mining object
function normalizeProjectData(projectData) {
    if (!projectData) return null;

    // Check if market_data is incorrectly nested inside mining
    if (projectData.mining?.market_data && !projectData.market_data) {
        projectData.market_data = projectData.mining.market_data;
        delete projectData.mining.market_data;
    }

    // Check if data_sources is incorrectly nested inside mining
    if (projectData.mining?.data_sources && !projectData.data_sources) {
        projectData.data_sources = projectData.mining.data_sources;
        delete projectData.mining.data_sources;
    }

    // Check if notes is incorrectly nested inside mining
    if (projectData.mining?.notes && !projectData.notes) {
        projectData.notes = projectData.mining.notes;
        delete projectData.mining.notes;
    }

    // Check if last_updated is incorrectly nested inside mining
    if (projectData.mining?.last_updated && !projectData.last_updated) {
        projectData.last_updated = projectData.mining.last_updated;
        delete projectData.mining.last_updated;
    }

    return projectData;
}

// Fetch all project data
async function fetchAllProjects() {
    const projectNames = await fetchProjectList();

    if (projectNames.length === 0) {
        console.warn('No projects found. Make sure you have JSON files in data/projects/');
        return [];
    }

    const projects = [];

    for (const name of projectNames) {
        let projectData = await fetchFromGitHub(`${CONFIG.PROJECTS_PATH}/${name}.json`);

        if (projectData) {
            // Normalize the data structure
            projectData = normalizeProjectData(projectData);

            // Fetch genesis data if it exists
            let genesisData = null;
            if (projectData.has_premine) {
                genesisData = await fetchFromGitHub(`${CONFIG.ALLOCATIONS_PATH}/${name}/genesis.json`);
            }

            projects.push({
                name: name,
                data: projectData,
                genesis: genesisData
            });
        }
    }

    return projects;
}

// Local storage cache helpers
function getCachedData(key) {
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    
    const { data, timestamp } = JSON.parse(cached);
    const now = Date.now();
    
    // Check if cache is still valid
    if (now - timestamp < CONFIG.CACHE_DURATION) {
        return data;
    }
    
    // Cache expired
    localStorage.removeItem(key);
    return null;
}

function setCachedData(key, data) {
    const cacheObject = {
        data: data,
        timestamp: Date.now()
    };
    localStorage.setItem(key, JSON.stringify(cacheObject));
}

// Sort projects
function sortProjects(projects, sortBy) {
    const sorted = [...projects];
    
    switch(sortBy) {
        case 'name':
            sorted.sort((a, b) => a.data.project.localeCompare(b.data.project));
            break;
        case 'fdmc':
            sorted.sort((a, b) => (b.data.market_data?.fdmc || 0) - (a.data.market_data?.fdmc || 0));
            break;
        case 'launch':
            sorted.sort((a, b) => new Date(b.data.launch_date) - new Date(a.data.launch_date));
            break;
        case 'premine':
            sorted.sort((a, b) => {
                const aPremine = getPreminePercent(a.data, a.genesis);
                const bPremine = getPreminePercent(b.data, b.genesis);
                return bPremine - aPremine;
            });
            break;
        case 'mined':
            sorted.sort((a, b) => (b.data.supply?.pct_mined || 0) - (a.data.supply?.pct_mined || 0));
            break;
        default:
            // Default to name
            sorted.sort((a, b) => a.data.project.localeCompare(b.data.project));
    }
    
    return sorted;
}

// Filter projects
function filterProjects(projects, filterType, searchTerm = '') {
    let filtered = projects;
    
    // Apply filter
    if (filterType !== 'all') {
        filtered = filtered.filter(project => {
            switch(filterType) {
                case 'fair':
                    return !project.data.has_premine && project.data.launch_type === 'fair';
                case 'premine':
                    return project.data.has_premine;
                case 'suspicious':
                    return project.data.launch_type === 'fair_with_suspicion';
                default:
                    return true;
            }
        });
    }
    
    // Apply search
    if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filtered = filtered.filter(project => 
            project.data.project.toLowerCase().includes(term) ||
            project.data.ticker.toLowerCase().includes(term)
        );
    }
    
    return filtered;
}

// Get URL parameters
function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    return {
        project: params.get('project'),
        compare: params.get('compare')?.split(',') || []
    };
}

// Build project URL
function buildProjectUrl(projectName) {
    return `pages/project.html?project=${projectName}`;
}

// Show error message
function showError(container, message) {
    container.innerHTML = `
        <div style="text-align: center; padding: 3rem; color: var(--text-secondary);">
            <h3>⚠️ Error Loading Data</h3>
            <p>${message}</p>
            <p style="margin-top: 1rem;">
                Make sure you've updated <code>js/config.js</code> with your GitHub username and repo name.
            </p>
        </div>
    `;
}
