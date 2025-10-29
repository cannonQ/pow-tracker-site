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

        // Normalize the data structure (fixes kaspa and similar data issues)
        projectData = normalizeProjectData(projectData);

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
    const badge = getFairnessBadge(projectData, genesisData);
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
        const hasParity = hasMinersAchievedParity(data, genesisData);
        const bannerClass = hasParity ? 'warning-banner parity' : 'warning-banner';

        // Determine allocation type
        const hasEmission = genesisData && genesisData.has_emission_allocation;
        const allocationType = hasEmission ? 'emission allocation' : 'premine allocation';

        return `
            <div class="${bannerClass}">
                ⚠️ <strong>WARNING:</strong> ${formatPercent(preminePercent, 1)} ${allocationType}
                ${genesisData ? calculateParityWarning(data, genesisData, hasEmission) : ''}
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

function calculateParityWarning(data, genesis, hasEmission = false) {
    const dailyEmission = data.emission.daily_emission;
    const allocatedTokens = (genesis.total_genesis_allocation_pct / 100) * data.supply.max_supply;
    const daysToDate = daysSinceLaunch(data.launch_date);
    const minedToDate = dailyEmission * daysToDate;

    if (minedToDate >= allocatedTokens) {
        return ` | ✅ Miners achieved parity`;
    }

    const daysRemaining = Math.ceil((allocatedTokens - minedToDate) / dailyEmission);
    const yearsRemaining = (daysRemaining / 365).toFixed(1);

    return ` | Miner parity in ${yearsRemaining} years`;
}

function calculateMinedPercent(projectData, genesisData) {
    if (!projectData.supply?.current_supply || !projectData.supply?.max_supply) {
        return null;
    }

    const currentSupply = projectData.supply.current_supply;
    const maxSupply = projectData.supply.max_supply;
    const currentSupplyPct = (currentSupply / maxSupply) * 100;

    // For fair launches, % mined equals current supply %
    const hasAllocation = projectData.has_premine || (genesisData && (genesisData.has_premine || genesisData.has_emission_allocation));
    if (!hasAllocation || !genesisData) {
        return currentSupplyPct;
    }

    // Calculate % mined excluding premine/emission allocation
    const allocationPct = genesisData.total_genesis_allocation_pct || 0;
    const minedPct = currentSupplyPct - allocationPct;

    // Cap at 0% if allocation exceeds current supply (early stage projects)
    return Math.max(0, minedPct);
}

function renderKeyMetrics(data) {
    const supply = data.supply;
    const currentSupplyPct = supply && supply.current_supply && supply.max_supply
        ? (supply.current_supply / supply.max_supply) * 100
        : null;
    const minedPct = calculateMinedPercent(data, genesisData);

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
            <div class="metric-label">Current Supply %</div>
            <div class="metric-value">${formatPercent(currentSupplyPct, 1)}</div>
        </div>
        <div class="metric-box">
            <div class="metric-label">% Mined</div>
            <div class="metric-value highlight">${formatPercent(minedPct, 1)}</div>
        </div>
        <div class="metric-box">
            <div class="metric-label">Daily Emission</div>
            <div class="metric-value">${formatNumber(data.emission?.daily_emission, 0)}</div>
        </div>
    `;
}

function renderSupplyAllocation(data, genesis) {
    if (!genesis || !genesis.allocation_tiers) return '';

    const tiers = genesis.allocation_tiers;
    const mining = genesis.available_for_mining_genesis_pct;

    const tier1 = tiers.tier_1_profit_seeking?.total_pct || 0;
    const tier2 = tiers.tier_2_entity_controlled?.total_pct || 0;
    const tier3 = tiers.tier_3_community?.total_pct || 0;
    const tier4 = tiers.tier_4_liquidity?.total_pct || 0;

    // Calculate absolute tokens
    const maxSupply = data.supply.max_supply;
    const tier1Tokens = (tier1 / 100) * maxSupply;
    const tier2Tokens = (tier2 / 100) * maxSupply;
    const tier3Tokens = (tier3 / 100) * maxSupply;
    const tier4Tokens = (tier4 / 100) * maxSupply;
    const miningTokens = (mining / 100) * maxSupply;

    return `
        <div style="margin-top: 2rem;">
            <h3 style="margin-bottom: 1rem; color: var(--text);">Allocation Breakdown</h3>
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
                        <span class="legend-text">Tier 1: Profit-Seeking</span>
                        <span class="legend-percent">${formatPercent(tier1, 1)} (${formatNumber(tier1Tokens, 0)})</span>
                    </div>` : ''}
                    ${tier2 > 0 ? `
                    <div class="legend-item">
                        <div class="legend-color tier-2"></div>
                        <span class="legend-text">Tier 2: Entity Controlled</span>
                        <span class="legend-percent">${formatPercent(tier2, 1)} (${formatNumber(tier2Tokens, 0)})</span>
                    </div>` : ''}
                    ${tier3 > 0 ? `
                    <div class="legend-item">
                        <div class="legend-color tier-3"></div>
                        <span class="legend-text">Tier 3: Community</span>
                        <span class="legend-percent">${formatPercent(tier3, 1)} (${formatNumber(tier3Tokens, 0)})</span>
                    </div>` : ''}
                    ${tier4 > 0 ? `
                    <div class="legend-item">
                        <div class="legend-color tier-4"></div>
                        <span class="legend-text">Tier 4: Liquidity</span>
                        <span class="legend-percent">${formatPercent(tier4, 1)} (${formatNumber(tier4Tokens, 0)})</span>
                    </div>` : ''}
                    <div class="legend-item">
                        <div class="legend-color mining"></div>
                        <span class="legend-text">Available for Mining</span>
                        <span class="legend-percent">${formatPercent(mining, 1)} (${formatNumber(miningTokens, 0)})</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderDecentralizationPath(data, genesis) {
    if (!genesis || !genesis.miner_parity_analysis) return '';

    const parity = genesis.miner_parity_analysis;
    const genesisTotal = parity.genesis_allocation_total || (genesis.total_genesis_allocation_pct / 100) * data.supply.max_supply;
    const minedToDate = parity.cumulative_mined_to_date || data.supply.current_supply - genesisTotal;
    const pctTowardParity = parity.pct_toward_parity || ((minedToDate / genesisTotal) * 100);
    const dailyEmission = parity.daily_emission_current || data.emission.daily_emission;

    // Find parity date from timeline
    const parityEvent = parity.parity_timeline?.find(event =>
        event.event && event.event.includes('PARITY')
    );
    const parityDate = parityEvent ? parityEvent.date : 'TBD';
    const daysFromNow = parityEvent?.days_from_oct_2025;

    return `
        <div style="margin-top: 2rem;">
            <h3 style="margin-bottom: 1rem; color: var(--text);">⚖️ Path to Decentralization</h3>
            <div class="data-grid">
                <div class="data-item">
                    <span class="data-label">Genesis Allocation</span>
                    <span class="data-value">${formatNumber(genesisTotal, 0)} ${data.ticker}</span>
                </div>
                <div class="data-item">
                    <span class="data-label">Mined to Date</span>
                    <span class="data-value">${formatNumber(minedToDate, 0)} ${data.ticker}</span>
                </div>
                <div class="data-item">
                    <span class="data-label">Progress to Parity</span>
                    <span class="data-value text-primary">${formatPercent(pctTowardParity, 1)}</span>
                </div>
                <div class="data-item">
                    <span class="data-label">Miner Parity Date</span>
                    <span class="data-value">${parityDate !== 'TBD' ? formatDate(parityDate) : 'TBD'}</span>
                </div>
            </div>
            <p style="margin-top: 1rem; color: var(--text-secondary); font-size: 0.9rem;">
                At current emission rate of ${formatNumber(dailyEmission, 0)} ${data.ticker}/day, miners will match genesis allocation ${parityDate !== 'TBD' ? 'by ' + formatDate(parityDate) : ''}.
            </p>
        </div>
    `;
}

function renderCurrentSupplyPieChart(projectData, genesisData) {
    const supply = projectData.supply;
    const maxSupply = supply.max_supply;
    const currentSupply = supply.current_supply;

    // Calculate current supply percentage
    const currentSupplyPct = (currentSupply / maxSupply) * 100;

    let slices = [];

    const hasAllocation = projectData.has_premine || (genesisData && (genesisData.has_premine || genesisData.has_emission_allocation));

    if (!hasAllocation || !genesisData) {
        // Fair launch: 100% mined
        slices = [
            { label: 'Mined (Block Rewards)', percent: currentSupplyPct, class: 'mining', tokens: currentSupply }
        ];
    } else {
        // Premine or Emission: Calculate breakdown
        const tiers = genesisData.allocation_tiers;
        const tier1Pct = tiers.tier_1_profit_seeking?.total_pct || 0;
        const tier2Pct = tiers.tier_2_entity_controlled?.total_pct || 0;
        const tier3Pct = tiers.tier_3_community?.total_pct || 0;
        const tier4Pct = tiers.tier_4_liquidity?.total_pct || 0;
        const premineTotalPct = genesisData.total_genesis_allocation_pct || 0;
        const minedPct = Math.max(0, currentSupplyPct - premineTotalPct);

        // Calculate absolute token amounts
        const minedTokens = (minedPct / 100) * maxSupply;
        const tier1Tokens = (tier1Pct / 100) * maxSupply;
        const tier2Tokens = (tier2Pct / 100) * maxSupply;
        const tier3Tokens = (tier3Pct / 100) * maxSupply;
        const tier4Tokens = (tier4Pct / 100) * maxSupply;

        slices = [
            { label: 'Mined (Block Rewards)', percent: minedPct, class: 'mining', tokens: minedTokens },
            tier1Pct > 0 ? { label: 'Tier 1: Profit-Seeking', percent: tier1Pct, class: 'tier-1', tokens: tier1Tokens } : null,
            tier2Pct > 0 ? { label: 'Tier 2: Entity Controlled', percent: tier2Pct, class: 'tier-2', tokens: tier2Tokens } : null,
            tier3Pct > 0 ? { label: 'Tier 3: Community', percent: tier3Pct, class: 'tier-3', tokens: tier3Tokens } : null,
            tier4Pct > 0 ? { label: 'Tier 4: Liquidity', percent: tier4Pct, class: 'tier-4', tokens: tier4Tokens } : null,
        ].filter(Boolean);
    }

    // Normalize percentages to sum to 100% for pie chart display
    // (percentages above are % of max supply, need to convert to % of current supply)
    const totalPercent = slices.reduce((sum, slice) => sum + slice.percent, 0);
    slices = slices.map(slice => ({
        ...slice,
        percent: (slice.percent / totalPercent) * 100
    }));

    // Generate conic-gradient CSS
    let gradientStops = [];
    let cumulative = 0;

    slices.forEach(slice => {
        const startDeg = (cumulative / 100) * 360;
        const endDeg = ((cumulative + slice.percent) / 100) * 360;
        gradientStops.push(`var(--${slice.class}-color) ${startDeg}deg ${endDeg}deg`);
        cumulative += slice.percent;
    });

    const conicGradient = `conic-gradient(${gradientStops.join(', ')})`;

    return `
        <div class="supply-pie-chart-container">
            <h3 style="margin: 1.5rem 0 1rem 0; color: var(--text);">Current Supply Breakdown</h3>
            <div class="pie-chart-wrapper">
                <div class="pie-chart" style="background: ${conicGradient}"></div>
                <div class="pie-chart-legend">
                    ${slices.map(slice => `
                        <div class="pie-legend-item">
                            <div class="pie-legend-color ${slice.class}"></div>
                            <span class="pie-legend-label">${slice.label}</span>
                            <span class="pie-legend-value">${formatPercent(slice.percent, 1)}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
            <p style="margin-top: 1rem; color: var(--text-secondary); font-size: 0.9rem;">
                Current supply distribution showing ${projectData.has_premine ? (genesisData?.has_emission_allocation ? 'emission allocations vs miner rewards' : 'premine allocations vs miner rewards') : 'mined tokens'} out of ${formatNumber(currentSupply, 0)} ${projectData.ticker} total.
            </p>
        </div>
    `;
}

function renderSupplySection(data) {
    const supply = data.supply;
    const currentSupplyPct = supply && supply.current_supply && supply.max_supply
        ? (supply.current_supply / supply.max_supply) * 100
        : null;
    const minedPct = calculateMinedPercent(data, genesisData);

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
                    <span class="data-label">Remaining Emission</span>
                    <span class="data-value">${formatNumber(supply.emission_remaining, 0)}</span>
                </div>
            </div>

            <div class="supply-percentage-section">
                <h3 style="margin: 1.5rem 0 1rem 0; color: var(--text);">Supply Progress</h3>
                <div class="data-grid">
                    <div class="data-item-detailed">
                        <div class="data-item-header">
                            <span class="data-label">Current Supply %</span>
                            <span class="data-value">${formatPercent(currentSupplyPct, 2)}</span>
                        </div>
                        <div class="data-description">Total circulating supply as % of max supply</div>
                    </div>
                    <div class="data-item-detailed">
                        <div class="data-item-header">
                            <span class="data-label">% Mined</span>
                            <span class="data-value text-primary">${formatPercent(minedPct, 2)}</span>
                        </div>
                        <div class="data-description">Miner block rewards only (excludes ${data.has_premine ? (genesisData?.has_emission_allocation ? 'emission allocation' : 'premine') : 'any allocations'})</div>
                    </div>
                </div>
            </div>

            ${projectData.has_premine && genesisData ? renderCurrentSupplyPieChart(projectData, genesisData) : ''}
            ${projectData.has_premine && genesisData ? renderSupplyAllocation(projectData, genesisData) : ''}
            ${projectData.has_premine && genesisData ? renderDecentralizationPath(projectData, genesisData) : ''}
        </div>
    `;
}

function renderEmissionSection(data) {
    const emission = data.emission;
    const hasHalvings = emission.halving_schedule && emission.halving_schedule.length > 0;

    // Split events into traditional halvings and narrative milestones
    let traditionalHalvings = [];
    let narrativeEvents = [];

    if (hasHalvings) {
        traditionalHalvings = emission.halving_schedule.filter(event =>
            event.reward_before && event.reward_after && event.height
        );

        narrativeEvents = emission.halving_schedule.filter(event =>
            !event.reward_before || !event.reward_after || !event.height
        );
    }

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

            ${traditionalHalvings.length > 0 ? renderHalvingSchedule(traditionalHalvings, data.ticker) : ''}
            ${narrativeEvents.length > 0 ? renderEmissionMilestones(narrativeEvents, data.ticker) : ''}
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

function renderEmissionMilestones(events, ticker) {
    const now = new Date();

    const rows = events.slice(0, 5).map(event => {
        // Check if event has a date
        const hasDate = event.date || event.date_est;
        const eventDate = hasDate ? new Date(event.date || event.date_est) : null;
        const isPast = eventDate && eventDate < now;
        const statusClass = isPast ? 'passed' : '';

        // Format the event name/title
        const eventName = event.event || event.name || 'Milestone';
        const formattedEventName = typeof eventName === 'string'
            ? eventName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
            : eventName;

        return `
            <div class="timeline-event milestone ${statusClass}">
                <div class="timeline-date">${hasDate ? formatDate(event.date || event.date_est) : 'TBD'}</div>
                <div class="timeline-description">
                    <strong>🎯 ${formattedEventName}</strong>
                    ${event.description ? `<div style="margin-top: 0.5rem; font-size: 0.9rem; opacity: 0.9;">${event.description}</div>` : ''}
                </div>
            </div>
        `;
    }).join('');

    return `
        <div class="vesting-timeline">
            <h3 style="margin-bottom: 1rem; color: var(--text);">📍 Emission Milestones</h3>
            ${rows}
        </div>
    `;
}

function formatHashrate(mining) {
    // Support multiple hashrate units with proper conversion
    if (mining.current_hashrate_eh) {
        return formatNumber(mining.current_hashrate_eh, 2) + ' EH/s';
    }
    if (mining.current_hashrate_ph) {
        // Convert PH to TH for display consistency
        const th = mining.current_hashrate_ph * 1000;
        return formatNumber(th, 2) + ' TH/s';
    }
    if (mining.current_hashrate_th) {
        return formatNumber(mining.current_hashrate_th, 2) + ' TH/s';
    }
    return 'N/A';
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
                    <span class="data-value">${formatHashrate(mining)}</span>
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
    // Handle both formats: largest_pool (legacy) or largest_pool_current (new format)
    const largestPool = decentr.largest_pool || decentr.largest_pool_current;

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
                ${largestPool ? `
                <div class="data-item">
                    <span class="data-label">Largest Pool</span>
                    <span class="data-value">${largestPool.name} (${formatPercent(largestPool.pct, 1)})</span>
                </div>
                ` : ''}
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
            ${renderDecentralizationPath(projectData, genesis)}
            ${renderInvestorDetails(genesis)}
            ${genesis.vesting_waterfall ? renderVestingWaterfall(genesis.vesting_waterfall) : ''}
        </div>
    `;
}

function renderTierRow(label, percent, className) {
    return `
        <div class="tier-row">
            <div class="tier-label">${label}</div>
            <div class="tier-bar-container">
                <div class="tier-bar ${className}" style="width: ${percent}%"></div>
                <span class="tier-percent">${formatPercent(percent, 1)}</span>
            </div>
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
        <div class="allocation-chart-stacked">
            ${tier1 > 0 ? renderTierRow('Tier 1: Profit-Seeking (VCs/Team)', tier1, 'tier-1') : ''}
            ${tier2 > 0 ? renderTierRow('Tier 2: Entity Controlled (Foundation)', tier2, 'tier-2') : ''}
            ${tier3 > 0 ? renderTierRow('Tier 3: Community', tier3, 'tier-3') : ''}
            ${tier4 > 0 ? renderTierRow('Tier 4: Liquidity', tier4, 'tier-4') : ''}
            ${renderTierRow('Available for Mining', mining, 'mining')}
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

    // Check if market data exists
    if (!market) {
        return `
            <div class="section">
                <div class="section-header">
                    <h2 class="section-title">💰 Market Data</h2>
                </div>
                <p style="color: var(--text-secondary); padding: 1rem;">Market data not available</p>
            </div>
        `;
    }

    return `
        <div class="section">
            <div class="section-header">
                <h2 class="section-title">💰 Market Data</h2>
            </div>
            <div class="data-grid">
                <div class="data-item">
                    <span class="data-label">Current Price</span>
                    <span class="data-value">${formatCurrency(market.current_price_usd, 4)}</span>
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

    // Filter and validate URLs before processing
    const validLinks = allLinks.filter(url => {
        if (typeof url !== 'string' || !url) return false;
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    });

    const links = validLinks.map(url => {
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
