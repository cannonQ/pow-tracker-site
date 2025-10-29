// Main JavaScript for PoW Tokenomics Tracker Landing Page

let allProjects = [];
let currentFilter = 'all';
let currentSort = 'name';
let currentSearch = '';

// DOM elements
const projectsGrid = document.getElementById('projects-grid');
const emptyState = document.getElementById('empty-state');
const filterButtons = document.querySelectorAll('.filter-btn');
const sortSelect = document.getElementById('sort-select');
const searchInput = document.getElementById('search-input');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    setupEventListeners();
    await loadProjects();
});

// Setup event listeners
function setupEventListeners() {
    // Filter buttons
    filterButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            filterButtons.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentFilter = e.target.dataset.filter;
            renderProjects();
        });
    });
    
    // Sort dropdown
    sortSelect.addEventListener('change', (e) => {
        currentSort = e.target.value;
        renderProjects();
    });
    
    // Search input
    searchInput.addEventListener('input', (e) => {
        currentSearch = e.target.value;
        renderProjects();
    });
}

// Load projects from GitHub
async function loadProjects() {
    try {
        // Try to get from cache first
        const cached = getCachedData('projects');
        if (cached) {
            allProjects = cached;
            renderProjects();
            updateStats();
            // Refresh in background
            fetchAndCacheProjects();
            return;
        }
        
        // Fetch fresh data
        await fetchAndCacheProjects();
        
    } catch (error) {
        console.error('Error loading projects:', error);
        showError(projectsGrid, 'Failed to load projects. Please check your configuration.');
    }
}

// Fetch projects and cache them
async function fetchAndCacheProjects() {
    allProjects = await fetchAllProjects();
    
    if (allProjects.length === 0) {
        showError(projectsGrid, 'No projects found in the repository.');
        return;
    }
    
    setCachedData('projects', allProjects);
    renderProjects();
    updateStats();
}

// Update hero stats
function updateStats() {
    const totalProjects = allProjects.length;

    // Categorize projects based on allocation type
    const emission = allProjects.filter(p => p.genesis && p.genesis.has_emission_allocation).length;
    const premined = allProjects.filter(p => {
        const hasEmission = p.genesis && p.genesis.has_emission_allocation;
        const hasPremine = p.data.has_premine || (p.genesis && p.genesis.has_premine);
        return hasPremine && !hasEmission;
    }).length;
    const fairLaunches = allProjects.filter(p => {
        const hasEmission = p.genesis && p.genesis.has_emission_allocation;
        const hasPremine = p.data.has_premine || (p.genesis && p.genesis.has_premine);
        return !hasPremine && !hasEmission && p.data.launch_type === 'fair';
    }).length;
    const suspicious = allProjects.filter(p => p.data.launch_type === 'fair_with_suspicion').length;

    document.getElementById('total-projects').textContent = totalProjects;
    document.getElementById('fair-launches').textContent = fairLaunches;
    document.getElementById('premined').textContent = premined;
    document.getElementById('emission').textContent = emission;
    document.getElementById('suspicious').textContent = suspicious;
}

// Render projects
function renderProjects() {
    // Filter and sort
    let projects = filterProjects(allProjects, currentFilter, currentSearch);
    projects = sortProjects(projects, currentSort);
    
    // Show/hide empty state
    if (projects.length === 0) {
        projectsGrid.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }
    
    projectsGrid.style.display = 'grid';
    emptyState.style.display = 'none';
    
    // Render cards
    projectsGrid.innerHTML = projects.map(project => createProjectCard(project)).join('');
    
    // Add click handlers
    document.querySelectorAll('.project-card').forEach((card, index) => {
        card.addEventListener('click', () => {
            window.location.href = buildProjectUrl(projects[index].name);
        });
    });
}

// Create project card HTML
function createProjectCard(project) {
    const data = project.data;
    const genesis = project.genesis;
    const badge = getFairnessBadge(data, genesis);
    const preminePercent = getPreminePercent(data, genesis);
    
    // Mining progress
    const pctMined = data.supply?.pct_mined || 0;
    
    // Market data
    const fdmc = data.market_data?.fdmc;
    const price = data.market_data?.current_price_usd;
    
    // Build allocation warning if needed
    let premineWarning = '';
    if (preminePercent > 0) {
        const hasParity = hasMinersAchievedParity(data, genesis);
        const warningClass = hasParity ? 'premine-warning-parity' : 'premine-warning';
        const parityText = hasParity ? ` (${createIcon('check-circle', { size: '14', className: 'inline-icon' })} miner parity)` : '';

        // Determine allocation type
        const hasEmission = genesis && genesis.has_emission_allocation;
        const allocationType = hasEmission ? 'emission allocation' : 'premine';

        premineWarning = `
            <div class="${warningClass}">
                ${createIcon('alert-triangle', { size: '14', className: 'inline-icon' })} ${formatPercent(preminePercent, 1)} ${allocationType}${parityText}
            </div>
        `;
    }

    // Suspicious flag
    let suspiciousNote = '';
    if (data.launch_type === 'fair_with_suspicion') {
        suspiciousNote = `
            <div class="premine-warning">
                ${createIcon('alert-triangle', { size: '14', className: 'inline-icon' })} Suspected insider mining
            </div>
        `;
    }
    
    return `
        <div class="project-card">
            <div class="project-header">
                <div class="project-title">
                    <h3>${capitalize(data.project)}</h3>
                    <span class="project-ticker">$${data.ticker}</span>
                </div>
                <span class="fairness-badge ${badge.class}">${badge.text}</span>
            </div>
            
            <div class="project-stats">
                <div class="stat-row">
                    <span>Consensus</span>
                    <span>${data.consensus} (${data.algorithm})</span>
                </div>
                <div class="stat-row">
                    <span>Launch Date</span>
                    <span>${formatDate(data.launch_date)}</span>
                </div>
                <div class="stat-row">
                    <span>Price</span>
                    <span>${formatCurrency(price)}</span>
                </div>
                <div class="stat-row">
                    <span>FDMC</span>
                    <span>${formatCurrency(fdmc)}</span>
                </div>
                <div class="stat-row">
                    <span>% of Max Supply</span>
                    <span class="text-primary font-bold">${formatPercent(pctMined, 1)}</span>
                </div>
            </div>
            
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${pctMined}%"></div>
            </div>
            
            ${premineWarning}
            ${suspiciousNote}
            
            <div class="project-meta">
                <span>Updated ${formatDate(data.last_updated)}</span>
                <span>${daysSinceLaunch(data.launch_date)} days old</span>
            </div>
            
            <a href="${buildProjectUrl(project.name)}" class="view-details">
                View Deep Dive →
            </a>
        </div>
    `;
}

// Capitalize first letter
function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}
