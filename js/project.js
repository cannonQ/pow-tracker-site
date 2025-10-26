// Project Detail Page JavaScript

let projectData = null;
let genesisData = null;

document.addEventListener('DOMContentLoaded', async () => {
    const params = getUrlParams();
    
    if (!params.project) {
        showError(document.getElementById('project-content'), 'No project specified');
        return;
    }
    
    await loadProjectData(params.project);
});

async function loadProjectData(projectName) {
    try {
        // Fetch project data
        projectData = await fetchFromGitHub(`${CONFIG.PROJECTS_PATH}/${projectName}.json`);
        
        if (!projectData) {
            showError(document.getElementById('project-content'), 'Project not found');
            return;
        }
        
        // Fetch genesis data if premine exists
        if (projectData.has_premine) {
            genesisData = await fetchFromGitHub(`${CONFIG.ALLOCATIONS_PATH}/${projectName}/genesis.json`);
        }
        
        renderProjectPage();
        
    } catch (error) {
        console.error('Error loading project:', error);
        showError(document.getElementById('project-content'), 'Failed to load project data');
    }
}

function renderProjectPage() {
    const container = document.getElementById('project-content');
    const badge = getFairnessBadge(projectData);
    const preminePercent = getPreminePercent(projectData, genesisData);
    
    let html = `
        <div class="project-hero">
            <div class="project-hero-header">
                <div class="project-hero-title">
                    <h1>${capitalize(projectData.project)}</h1>
                    <span class="ticker">$${projectData.ticker}</span>
                </div>
                <span class="fairness-badge ${badge.class}">${badge.text}</span>
            </div>
            
            ${renderWarningBanner(projectData, preminePercent)}
            
            <div class="key-metrics">
                ${renderKeyMetrics(projectData)}
            </div>
        </div>
        
        ${renderSupplySection(projectData)}
        ${renderEmissionSection(projectData)}
        ${renderMiningSection(projectData)}
        
        ${projectData.has_premine && genesisData ? renderGenesisSection(genesisData) : ''}
        
        ${renderMarketSection(projectData)}
        ${renderNotesSection(projectData)}
        ${renderSourcesSection(projectData)}
    `;
    
    container.innerHTML = html;
}

function renderWarningBanner(data, preminePercent) {
    if (preminePercent > 0) {
        return `
            <div class="warning-banner">
                ⚠️ <strong>WARNING:</strong> ${formatPercent(preminePercent, 1)} premine allocation
                ${genesisData ? calculateParityWarning(data, genesisData) : ''}
            </div>
        `;
    }
    
    if (data.launch_type === 'fair_with_suspicion') {
        return `
            <div class="warning-banner suspicious">
                ⚠️ <strong>CAUTION:</strong> Suspected insider mining activity
            </div>
        `;
    }
    
    return '';
}

function calculateParityWarning(data, genesis) {
    const dailyEmission = data.emission.daily_emission;
    const premineTokens = (genesis.total_genesis_allocation_pct / 100) * data.supply.max_supply;
    const daysToDate = daysSinceLaunch(data.launch_date);
    const minedToDate = dailyEmission * daysToDate;
    
    if (minedToDate >= premineTokens) {
        return ` | ✅ Miners achieved parity`;
    }
    
    const daysRemaining = Math.ceil((premineTokens - minedToDate) / dailyEmission);
    const yearsRemaining = (daysRemaining / 365).toFixed(1);
    
    return ` | Miner parity in ${yearsRemaining} years`;
}

function renderKeyMetrics(data) {
    return `
        <div class="metric-box">
            <div class="metric-label">Current Price</div>
            <div class="metric-value">${formatCurrency(data.market_data?.current_price_usd)}</div>
        </div>
        <div class="metric-box">
            <div class="metric-label">FDMC</div>
            <div class="metric-value">${formatCurrency(data.market_data?.fdmc)}</div>
        </div>
        <div class="metric-box">
            <div class="metric-label">% Mined</div>
            <div class="metric-value highlight">${formatPercent(data.supply?.pct_mined, 1)}</div>
        </div>
        <div class="metric-box">
            <div class="metric-label">Daily Emission</div>
            <div class="metric-value">${formatNumber(data.emission?.daily_emission, 0)}</div>
        </div>
    `;
}

function renderSupplySection(data) {
    const supply = data.supply;
    
    return `
        <div class="section">
            <div class="section-header">
                <h2 class="section-title">📊 Supply Metrics</h2>
            </div>
            <div class="data-grid">
                <div class="data-item">
                    <span class="data-label">Max Supply</span>
                    <span class="data-value">${formatNumber(supply.max_supply, 0)}</span>
                </div>
                <div class="data-item">
                    <span class="data-label">Current Supply</span>
                    <span class="data-value">${formatNumber(supply.current_supply, 0)}</span>
                </div>
                <div class="data-item">
                    <span class="data-label">% Mined</span>
                    <span class="data-value text-primary">${formatPercent(supply.pct_mined, 2)}</span>
                </div>
                <div class="data-item">
                    <span class="data-label">Remaining Emission</span>
                    <span class="data-value">${formatNumber(supply.emission_remaining, 0)}</span>
                </div>
            </div>
        </div>
    `;
}

function renderEmissionSection(data) {
    const emission = data.emission;
    const hasHalvings = emission.halving_schedule && emission.halving_schedule.length > 0;
    
    return `
        <div class="section">
            <div class="section-header">
                <h2 class="section-title">⏱️ Emission Schedule</h2>
            </div>
            <div class="data-grid">
                <div class="data-item">
                    <span class="data-label">Block Reward</span>
                    <span class="data-value">${emission.current_block_reward} ${data.ticker}</span>
                </div>
                <div class="data-item">
                    <span class="data-label">Block Time</span>
                    <span class="data-value">${emission.block_time_seconds}s</span>
                </div>
                <div class="data-item">
                    <span class="data-label">Daily Emission</span>
                    <span class="data-value">${formatNumber(emission.daily_emission, 0)} ${data.ticker}</span>
                </div>
                <div class="data-item">
                    <span class="data-label">Annual Inflation</span>
                    <span class="data-value">${formatPercent(emission.annual_inflation_pct, 2)}</span>
                </div>
            </div>
            
            ${hasHalvings ? renderHalvingSchedule(emission.halving_schedule, data.ticker) : ''}
        </div>
    `;
}

function renderHalvingSchedule(schedule, ticker) {
    const now = new Date();
    
    const rows = schedule.slice(0, 5).map(event => {
        const eventDate = new Date(event.date || event.date_est);
        const isPast = eventDate < now;
        const statusClass = isPast ? 'passed' : '';
        
        return `
            <div class="timeline-event ${statusClass}">
                <div class="timeline-date">${formatDate(event.date || event.date_est)}</div>
                <div class="timeline-amount">${event.reward_before} → ${event.reward_after} ${ticker}</div>
                <div class="timeline-description">Halving #${event.event} at block ${formatNumber(event.height, 0)}</div>
            </div>
        `;
    }).join('');
    
    return `
        <div class="vesting-timeline">
            <h3 style="margin-bottom: 1rem; color: var(--text);">Halving Events</h3>
            ${rows}
        </div>
    `;
}

function renderMiningSection(data) {
    const mining = data.mining;
    
    return `
        <div class="section">
            <div class="section-header">
                <h2 class="section-title">⛏️ Mining Economics</h2>
            </div>
            <div class="data-grid">
                <div class="data-item">
                    <span class="data-label">Current Hashrate</span>
                    <span class="data-value">${formatNumber(mining.current_hashrate_th)} TH/s</span>
                </div>
                <div class="data-item">
                    <span class="data-label">Difficulty</span>
                    <span class="data-value">${formatNumber(mining.current_difficulty)}</span>
                </div>
                <div class="data-item">
                    <span class="data-label">ASIC Resistant</span>
                    <span class="data-value">${mining.asic_resistant ? 'Yes' : 'No'}</span>
                </div>
                <div class="data-item">
                    <span class="data-label">Dominant Hardware</span>
                    <span class="data-value">${mining.dominant_hardware}</span>
                </div>
            </div>
            
            ${mining.cost_to_mine_one_unit ? renderMiningCosts(mining.cost_to_mine_one_unit, data.ticker) : ''}
            ${mining.decentralization ? renderDecentralization(mining.decentralization) : ''}
        </div>
    `;
}

function renderMiningCosts(costs, ticker) {
    return `
        <div style="margin-top: 1.5rem;">
            <h3 style="margin-bottom: 1rem; color: var(--text);">Cost to Mine 1 ${ticker}</h3>
            <div class="data-grid">
                <div class="data-item">
                    <span class="data-label">Electricity</span>
                    <span class="data-value">${formatCurrency(costs.electricity_usd)}</span>
                </div>
                <div class="data-item">
                    <span class="data-label">Hardware Amortization</span>
                    <span class="data-value">${formatCurrency(costs.hardware_amortization_usd)}</span>
                </div>
                <div class="data-item">
                    <span class="data-label">Total Cost</span>
                    <span class="data-value text-danger font-bold">${formatCurrency(costs.total_cost_usd)}</span>
                </div>
            </div>
        </div>
    `;
}

function renderDecentralization(decentr) {
    return `
        <div style="margin-top: 1.5rem;">
            <h3 style="margin-bottom: 1rem; color: var(--text);">Decentralization Metrics</h3>
            <div class="data-grid">
                <div class="data-item">
                    <span class="data-label">Active Pools</span>
                    <span class="data-value">${decentr.active_pools}</span>
                </div>
                <div class="data-item">
                    <span class="data-label">Top 5 Pools Control</span>
                    <span class="data-value ${decentr.top_5_pools_pct > 50 ? 'text-danger' : 'text-success'}">${formatPercent(decentr.top_5_pools_pct, 1)}</span>
                </div>
                <div class="data-item">
                    <span class="data-label">Largest Pool</span>
                    <span class="data-value">${decentr.largest_pool.name} (${formatPercent(decentr.largest_pool.pct, 1)})</span>
                </div>
                <div class="data-item">
                    <span class="data-label">Nakamoto Coefficient</span>
                    <span class="data-value">${decentr.nakamoto_coefficient}</span>
                </div>
            </div>
        </div>
    `;
}

function renderGenesisSection(genesis) {
    return `
        <div class="section">
            <div class="section-header">
                <h2 class="section-title">🎯 Genesis Allocation</h2>
                <span class="section-subtitle">${formatPercent(genesis.total_genesis_allocation_pct, 1)} premined</span>
            </div>
            
            ${renderAllocationChart(genesis)}
            ${renderInvestorDetails(genesis)}
            ${genesis.vesting_waterfall ? renderVestingWaterfall(genesis.vesting_waterfall) : ''}
        </div>
    `;
}

function renderAllocationChart(genesis) {
    const tiers = genesis.allocation_tiers;
    const mining = genesis.available_for_mining_genesis_pct;
    
    const tier1 = tiers.tier_1_profit_seeking?.total_pct || 0;
    const tier2 = tiers.tier_2_entity_controlled?.total_pct || 0;
    const tier3 = tiers.tier_3_community?.total_pct || 0;
    const tier4 = tiers.tier_4_liquidity?.total_pct || 0;
    
    return `
        <div class="allocation-chart">
            <div class="allocation-bar">
                ${tier1 > 0 ? `<div class="allocation-segment tier-1" style="width: ${tier1}%">${tier1 > 5 ? formatPercent(tier1, 1) : ''}</div>` : ''}
                ${tier2 > 0 ? `<div class="allocation-segment tier-2" style="width: ${tier2}%">${tier2 > 5 ? formatPercent(tier2, 1) : ''}</div>` : ''}
                ${tier3 > 0 ? `<div class="allocation-segment tier-3" style="width: ${tier3}%">${tier3 > 5 ? formatPercent(tier3, 1) : ''}</div>` : ''}
                ${tier4 > 0 ? `<div class="allocation-segment tier-4" style="width: ${tier4}%">${tier4 > 5 ? formatPercent(tier4, 1) : ''}</div>` : ''}
                ${mining > 0 ? `<div class="allocation-segment mining" style="width: ${mining}%">${mining > 5 ? formatPercent(mining, 1) : ''}</div>` : ''}
            </div>
            
            <div class="allocation-legend">
                ${tier1 > 0 ? `
                <div class="legend-item">
                    <div class="legend-color tier-1"></div>
                    <span class="legend-text">Profit-Seeking (VCs/Team)</span>
                    <span class="legend-percent">${formatPercent(tier1, 1)}</span>
                </div>` : ''}
                ${tier2 > 0 ? `
                <div class="legend-item">
                    <div class="legend-color tier-2"></div>
                    <span class="legend-text">Entity Controlled (Foundation)</span>
                    <span class="legend-percent">${formatPercent(tier2, 1)}</span>
                </div>` : ''}
                ${tier3 > 0 ? `
                <div class="legend-item">
                    <div class="legend-color tier-3"></div>
                    <span class="legend-text">Community</span>
                    <span class="legend-percent">${formatPercent(tier3, 1)}</span>
                </div>` : ''}
                ${tier4 > 0 ? `
                <div class="legend-item">
                    <div class="legend-color tier-4"></div>
                    <span class="legend-text">Liquidity</span>
                    <span class="legend-percent">${formatPercent(tier4, 1)}</span>
                </div>` : ''}
                <div class="legend-item">
                    <div class="legend-color mining"></div>
                    <span class="legend-text">Available for Mining</span>
                    <span class="legend-percent">${formatPercent(mining, 1)}</span>
                </div>
            </div>
        </div>
    `;
}

function renderInvestorDetails(genesis) {
    const tier1 = genesis.allocation_tiers.tier_1_profit_seeking;
    if (!tier1 || !tier1.buckets) return '';
    
    const buckets = tier1.buckets.map(bucket => {
        const knownInvestors = bucket.investors?.known || bucket.recipients?.known || [];
        const unknownCount = bucket.investors?.unknown_count || bucket.recipients?.unknown_count || 0;
        
        return `
            <div class="investor-item">
                <div class="investor-header">
                    <span class="investor-name">${bucket.name}</span>
                    <span class="investor-allocation">${formatPercent(bucket.pct, 1)}</span>
                </div>
                <div class="investor-details">
                    Cost: ${formatCurrency(bucket.cost_per_token_usd)} | 
                    Vesting: ${bucket.vesting_months}mo | 
                    Cliff: ${bucket.cliff_months}mo | 
                    TGE Unlock: ${formatPercent(bucket.tge_unlock_pct)}
                </div>
                ${knownInvestors.length > 0 ? `
                    <div class="investor-details" style="margin-top: 0.5rem;">
                        Known: ${knownInvestors.map(inv => inv.name).join(', ')}
                        ${unknownCount > 0 ? ` + ${unknownCount} undisclosed` : ''}
                    </div>
                ` : unknownCount > 0 ? `
                    <div class="investor-details" style="margin-top: 0.5rem;">
                        ${unknownCount} undisclosed investors
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
    
    return `
        <div class="investor-list">
            <h3 style="margin-bottom: 1rem; color: var(--text);">Investor Details</h3>
            ${buckets}
        </div>
    `;
}

function renderVestingWaterfall(waterfall) {
    const now = new Date();
    const genesis = new Date(genesisData.genesis_date);
    
    const events = waterfall.slice(0, 10).map(event => {
        const eventDate = new Date(genesis);
        eventDate.setMonth(eventDate.getMonth() + event.month);
        
        const isPast = eventDate < now;
        const statusClass = isPast ? 'passed' : '';
        
        return `
            <div class="timeline-event ${statusClass}">
                <div class="timeline-date">Month ${event.month}</div>
                <div class="timeline-amount">${formatNumber(event.unlock_tokens, 0)}</div>
                <div class="timeline-description">
                    ${formatPercent(event.pct_of_premine, 1)} of premine - ${event.source}
                </div>
            </div>
        `;
    }).join('');
    
    return `
        <div class="vesting-timeline">
            <h3 style="margin-bottom: 1rem; color: var(--text);">Vesting Schedule</h3>
            ${events}
        </div>
    `;
}

function renderMarketSection(data) {
    const market = data.market_data;
    
    return `
        <div class="section">
            <div class="section-header">
                <h2 class="section-title">💰 Market Data</h2>
            </div>
            <div class="data-grid">
                <div class="data-item">
                    <span class="data-label">Current Price</span>
                    <span class="data-value">${formatCurrency(market.current_price_usd)}</span>
                </div>
                <div class="data-item">
                    <span class="data-label">FDMC</span>
                    <span class="data-value">${formatCurrency(market.fdmc)}</span>
                </div>
                <div class="data-item">
                    <span class="data-label">Circulating MCap</span>
                    <span class="data-value">${formatCurrency(market.circulating_mcap)}</span>
                </div>
                <div class="data-item">
                    <span class="data-label">24h Volume</span>
                    <span class="data-value">${formatCurrency(market.daily_volume)}</span>
                </div>
                <div class="data-item">
                    <span class="data-label">Token Velocity</span>
                    <span class="data-value">${market.token_velocity ? market.token_velocity.toFixed(3) : 'N/A'}</span>
                </div>
            </div>
        </div>
    `;
}

function renderNotesSection(data) {
    if (!data.notes || data.notes.length === 0) return '';
    
    const notes = data.notes.map(note => `<li>${note}</li>`).join('');
    
    return `
        <div class="section">
            <div class="section-header">
                <h2 class="section-title">📝 Notes & Context</h2>
            </div>
            <ul class="notes-list">
                ${notes}
            </ul>
        </div>
    `;
}

function renderSourcesSection(data) {
    const sources = data.data_sources;
    if (!sources) return '';
    
    const allLinks = [
        ...(sources.official_docs || []),
        ...(sources.block_explorer || []),
        ...(sources.market_data || []),
        ...(sources.mining_data || [])
    ];
    
    const links = allLinks.map(url => {
        const domain = new URL(url).hostname.replace('www.', '');
        return `<a href="${url}" target="_blank" class="source-link">${domain}</a>`;
    }).join('');
    
    return `
        <div class="section">
            <div class="section-header">
                <h2 class="section-title">🔗 Data Sources</h2>
            </div>
            <div class="source-links">
                ${links}
            </div>
            <p style="margin-top: 1rem; color: var(--text-secondary); font-size: 0.9rem;">
                All data is community-sourced and verifiable. Last updated: ${formatDate(data.last_updated)}
            </p>
        </div>
    `;
}

function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}
