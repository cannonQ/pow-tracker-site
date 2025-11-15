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

    // Calculate composition and border color
    const composition = calculateCirculatingComposition(project);
    const borderColor = getCardBorderColor(composition.allocationPctTotal);
    const badge = getLaunchBadgeV2(data, genesis);

    // Format launch info
    const launchAge = formatLaunchAge(data.launch_date);
    const launchText = `${formatDate(data.launch_date)} (${launchAge})`;

    // Market data
    const fdmc = data.market_data?.fdmc;
    // const price = data.market_data?.current_price_usd;  // Commented out for future use

    // Coin symbol fallback (first letter in yellow circle)
    const coinSymbol = data.ticker.charAt(0).toUpperCase();

    // Determine segment color classes based on allocation type
    const allocationSegmentClass = composition.isEmission ? 'composition-segment-emission' : 'composition-segment-premine';

    return `
        <div class="project-card" style="border-color: ${borderColor}">
            <div class="card-top-row">
                <div class="project-name-ticker">
                    <span class="card-project-name">${capitalize(data.project)}</span>
                    <span class="card-ticker">$${data.ticker}</span>
                </div>

                <div class="coin-symbol-fallback">
                    ${coinSymbol}
                </div>

                <div class="launch-badge ${badge.class}">
                    ${badge.icon} ${badge.text}
                </div>
            </div>

            <div class="composition-section">
                <div class="composition-label">Circulating Supply:</div>
                <div class="composition-bar">
                    ${composition.preminePct > 0 ? `
                        <div class="${allocationSegmentClass}" style="width: ${composition.preminePct}%">
                            ${composition.preminePct > 10 ? Math.round(composition.preminePct) + '%' : ''}
                        </div>
                    ` : ''}
                    <div class="composition-segment-mined" style="width: ${composition.minedPct}%">
                        ${composition.minedPct > 10 ? Math.round(composition.minedPct) + '%' : ''}
                    </div>
                </div>
                <div class="composition-legend">
                    ${composition.preminePct > 0 ? `<span>${composition.isEmission ? 'Emission' : 'Premine'}</span>` : ''}
                    <span ${composition.preminePct === 0 ? 'style="margin: 0 auto;"' : ''}>Mined</span>
                </div>
            </div>

            <div class="card-bottom-row">
                <div class="launch-info">${launchText}</div>
                <div class="fdmc-info">FDMC: ${formatCurrency(fdmc)}</div>
            </div>

            <a href="${buildProjectUrl(project.name)}" class="view-details">
                View Details →
            </a>
        </div>
    `;
}

// Capitalize first letter
function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}
