// Project Detail Page JavaScript

let projectData = null;
let genesisData = null;
let vestingScheduleData = null;

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

            // Try to fetch vesting schedule if available
            try {
                vestingScheduleData = await fetchFromGitHub(`${CONFIG.ALLOCATIONS_PATH}/${projectName}/vesting-schedule.json`);
            } catch (error) {
                // Vesting schedule is optional, don't fail if not available
                console.log('No vesting schedule available for this project');
                vestingScheduleData = null;
            }
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

        ${/* Mining section commented out per requirements */'' /* ${renderMiningSection(projectData)} */}

        ${projectData.has_premine && genesisData ? renderInvestorDetailsSection(genesisData) : ''}
        ${projectData.has_premine && genesisData ? renderGenesisSection(genesisData) : ''}
        ${projectData.has_premine && genesisData ? renderDueDiligenceFindings(projectData, genesisData) : ''}

        ${renderKeyMetricsSummary(projectData, genesisData)}
        ${renderMarketSection(projectData)}
        ${renderNotesSection(projectData)}
        ${renderSourcesSection(projectData)}
        ${renderNavigationActions(projectData.project)}
    `;

    container.innerHTML = html;

    // Re-initialize Lucide icons for dynamically added content
    setTimeout(() => {
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }, 50);
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
                ${createIcon('alert-triangle', { size: '18', className: 'inline-icon' })} <strong>WARNING:</strong> ${formatPercent(preminePercent, 1)} ${allocationType}
                ${genesisData ? calculateParityWarning(data, genesisData, hasEmission) : ''}
            </div>
        `;
    }

    if (data.launch_type === 'fair_with_suspicion') {
        return `
            <div class="warning-banner suspicious">
                ${createIcon('alert-triangle', { size: '18', className: 'inline-icon' })} <strong>CAUTION:</strong> Suspected insider mining activity
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
        return ` | ${createIcon('check-circle', { size: '16', className: 'inline-icon' })} Miners achieved parity`;
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
            <h3 style="margin-bottom: 1rem; color: var(--text);">Genesis Allocation Breakdown</h3>
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
            <h3 style="margin-bottom: 1rem; color: var(--text);">${createIcon('scale', { size: '20', className: 'inline-icon' })} Path to Decentralization</h3>
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
        <h3 style="margin: 1.5rem 0 1rem 0; color: var(--text);">Current Supply Breakdown</h3>
        <div class="pie-chart-wrapper">
            <div class="pie-chart" style="background: ${conicGradient}"></div>
            <div class="pie-chart-legend">
                ${slices.map(slice => `
                    <div class="pie-legend-item">
                        <div class="pie-legend-color ${slice.class}"></div>
                        <span class="pie-legend-label">${slice.label}: ${formatPercent(slice.percent, 1)} (${formatTokensShort(slice.tokens)})</span>
                    </div>
                `).join('')}
            </div>
        </div>
        <p style="margin-top: 1rem; color: var(--text-secondary); font-size: 0.9rem;">
            Current supply distribution showing ${projectData.has_premine ? (genesisData?.has_emission_allocation ? 'emission allocations vs miner rewards' : 'premine allocations vs miner rewards') : 'mined tokens'} out of ${formatNumber(currentSupply, 0)} ${projectData.ticker} total.
        </p>
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
                <h2 class="section-title">${createIcon('bar-chart-2', { size: '24', className: 'inline-icon' })} Supply Metrics</h2>
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

            <div class="supply-progress-and-pie">
                <div class="supply-progress-left">
                    <h3 style="margin: 1.5rem 0 1rem 0; color: var(--text);">Supply Progress</h3>
                    <div class="supply-progress-items">
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

                ${projectData.has_premine && genesisData ? `
                <div class="supply-progress-right">
                    ${renderCurrentSupplyPieChart(projectData, genesisData)}
                </div>
                ` : ''}
            </div>

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
                <h2 class="section-title">${createIcon('clock', { size: '24', className: 'inline-icon' })} Emission Schedule</h2>
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

            ${hasHalvings ? renderEmissionTimelineChart(data) : ''}
            ${traditionalHalvings.length > 0 ? renderHalvingSchedule(traditionalHalvings, data.ticker) : ''}
            ${narrativeEvents.length > 0 ? renderEmissionMilestones(narrativeEvents, data.ticker) : ''}
            ${vestingScheduleData ? renderVestingSchedule(vestingScheduleData, data) : ''}
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
                    <strong>${createIcon('target', { size: '16', className: 'inline-icon' })} ${formattedEventName}</strong>
                    ${event.description ? `<div style="margin-top: 0.5rem; font-size: 0.9rem; opacity: 0.9;">${event.description}</div>` : ''}
                </div>
            </div>
        `;
    }).join('');

    return `
        <div class="vesting-timeline">
            <h3 style="margin-bottom: 1rem; color: var(--text);">${createIcon('map-pin', { size: '20', className: 'inline-icon' })} Emission Milestones</h3>
            ${rows}
        </div>
    `;
}

function renderVestingSchedule(vestingData, projectData) {
    if (!vestingData || !vestingData.monthly_schedule) return '';

    const now = new Date();
    const genesisDate = new Date(vestingData.genesis_date);
    const monthsSinceGenesis = Math.floor((now - genesisDate) / (1000 * 60 * 60 * 24 * 30.44));

    // Find current month in schedule
    let currentUnlocked = 0;
    let nextUnlockEvent = null;

    vestingData.monthly_schedule.forEach(monthData => {
        if (monthData.month <= monthsSinceGenesis) {
            currentUnlocked = monthData.total.cumulative_tokens;
        } else if (!nextUnlockEvent && monthData.total.unlock_tokens > 0) {
            nextUnlockEvent = monthData;
        }
    });

    const totalAllocation = vestingData.total_genesis_allocation_tokens;
    const remaining = totalAllocation - currentUnlocked;
    const progressPct = (currentUnlocked / totalAllocation) * 100;

    // Summary section
    const summaryHtml = `
        <div class="vesting-summary">
            <h3 style="margin-bottom: 1rem; color: var(--text);">${createIcon('unlock', { size: '20', className: 'inline-icon' })} Vesting Schedule Overview</h3>

            <div class="vesting-stats">
                <div class="vesting-stat-item">
                    <span class="vesting-stat-label">Vesting Progress</span>
                    <span class="vesting-stat-value">${formatPercent(progressPct, 1)} Complete</span>
                </div>
                <div class="vesting-stat-item">
                    <span class="vesting-stat-label">Tokens Unlocked</span>
                    <span class="vesting-stat-value">${formatNumber(currentUnlocked, 0)} ${projectData.ticker}</span>
                </div>
                <div class="vesting-stat-item">
                    <span class="vesting-stat-label">Tokens Remaining</span>
                    <span class="vesting-stat-value">${formatNumber(remaining, 0)} ${projectData.ticker}</span>
                </div>
                ${nextUnlockEvent ? `
                <div class="vesting-stat-item highlight">
                    <span class="vesting-stat-label">Next Unlock</span>
                    <span class="vesting-stat-value">${formatDate(nextUnlockEvent.date)} • ${formatNumber(nextUnlockEvent.total.unlock_tokens, 0)} ${projectData.ticker}</span>
                </div>
                ` : ''}
            </div>

            <div class="vesting-progress-bar">
                <div class="vesting-progress-fill" style="width: ${progressPct}%"></div>
            </div>
        </div>
    `;

    // Timeline section - group events intelligently
    const timelineHtml = renderVestingTimeline(vestingData, projectData, monthsSinceGenesis);

    // Tier summary table
    const tierSummaryHtml = renderVestingTierSummary(vestingData, projectData, monthsSinceGenesis);

    return `
        ${summaryHtml}
        ${renderVestingWaterfallChart(vestingData, projectData)}
        ${timelineHtml}
        ${tierSummaryHtml}
    `;
}

function renderVestingTimeline(vestingData, projectData, currentMonth) {
    const now = new Date();
    const schedule = vestingData.monthly_schedule;

    // Identify key events to display
    const keyEvents = [];

    // Always include month 0 (genesis)
    keyEvents.push(schedule[0]);

    // Add significant unlock events (>5% of total or completion milestones)
    const totalAllocation = vestingData.total_genesis_allocation_tokens;
    const threshold = totalAllocation * 0.05;

    schedule.forEach((monthData, index) => {
        if (index === 0) return; // Already added genesis

        const isSignificant = monthData.total.unlock_tokens > threshold;
        const isCompletionEvent = monthData.buckets.some(bucket =>
            bucket.notes && (bucket.notes.toLowerCase().includes('complete') || bucket.cumulative_pct_of_bucket >= 99.9)
        );

        if (isSignificant || isCompletionEvent) {
            keyEvents.push(monthData);
        }
    });

    // Add yearly checkpoints if we don't have enough events
    if (keyEvents.length < 8) {
        [12, 24, 36, 48, 60, 72, 84, 96, 108, 120].forEach(month => {
            const monthData = schedule.find(m => m.month === month);
            if (monthData && !keyEvents.includes(monthData)) {
                keyEvents.push(monthData);
            }
        });
    }

    // Sort by month
    keyEvents.sort((a, b) => a.month - b.month);

    // Split into past and future
    const pastEvents = keyEvents.filter(e => e.month <= currentMonth);
    const futureEvents = keyEvents.filter(e => e.month > currentMonth);

    const pastHtml = pastEvents.length > 0 ? `
        <h4 style="margin-top: 1.5rem; margin-bottom: 0.5rem; color: var(--text-secondary);">Past Unlock Events</h4>
        ${pastEvents.map(event => renderVestingTimelineEvent(event, projectData, true)).join('')}
    ` : '';

    const futureHtml = futureEvents.length > 0 ? `
        <h4 style="margin-top: 1.5rem; margin-bottom: 0.5rem; color: var(--text-secondary);">Upcoming Unlock Events</h4>
        ${futureEvents.slice(0, 5).map(event => renderVestingTimelineEvent(event, projectData, false)).join('')}
    ` : '';

    return `
        <div class="vesting-timeline">
            <h3 style="margin-bottom: 1rem; color: var(--text);">Unlock Timeline</h3>
            ${pastHtml}
            ${futureHtml}
        </div>
    `;
}

function renderVestingTimelineEvent(monthData, projectData, isPast) {
    const statusClass = isPast ? 'passed' : '';

    // Group buckets by tier
    const tier1Buckets = monthData.buckets.filter(b => b.tier === 'tier_1_profit_seeking');
    const tier2Buckets = monthData.buckets.filter(b => b.tier === 'tier_2_entity_controlled');
    const tier3Buckets = monthData.buckets.filter(b => b.tier === 'tier_3_community');

    const tier1Total = tier1Buckets.reduce((sum, b) => sum + b.unlock_tokens, 0);
    const tier2Total = tier2Buckets.reduce((sum, b) => sum + b.unlock_tokens, 0);
    const tier3Total = tier3Buckets.reduce((sum, b) => sum + b.unlock_tokens, 0);

    let description = '';
    if (tier1Total > 0) {
        const bucketNames = tier1Buckets.map(b => b.bucket_name).join(', ');
        description += `<div class="vesting-tier-line tier-1-text">Tier 1: ${bucketNames} - ${formatNumber(tier1Total, 0)} ${projectData.ticker}</div>`;
    }
    if (tier2Total > 0) {
        const bucketNames = tier2Buckets.map(b => b.bucket_name).join(', ');
        description += `<div class="vesting-tier-line tier-2-text">Tier 2: ${bucketNames} - ${formatNumber(tier2Total, 0)} ${projectData.ticker}</div>`;
    }
    if (tier3Total > 0) {
        const bucketNames = tier3Buckets.map(b => b.bucket_name).join(', ');
        description += `<div class="vesting-tier-line tier-3-text">Tier 3: ${bucketNames} - ${formatNumber(tier3Total, 0)} ${projectData.ticker}</div>`;
    }

    // Add completion notes if any
    const completions = monthData.buckets.filter(b =>
        b.notes && (b.notes.toLowerCase().includes('complete') || b.cumulative_pct_of_bucket >= 99.9)
    );
    if (completions.length > 0) {
        description += `<div style="margin-top: 0.5rem; font-style: italic; color: var(--success);">✓ ${completions.map(c => c.bucket_name).join(', ')} vesting complete</div>`;
    }

    return `
        <div class="timeline-event vesting-event ${statusClass}">
            <div class="timeline-date">
                <div style="font-weight: 600;">${formatDate(monthData.date)}</div>
                <div style="font-size: 0.8rem; opacity: 0.8;">Month ${monthData.month}</div>
            </div>
            <div class="timeline-amount">${formatNumber(monthData.total.unlock_tokens, 0)} ${projectData.ticker}</div>
            <div class="timeline-description">
                ${description}
                <div style="margin-top: 0.5rem; font-size: 0.85rem; opacity: 0.7;">
                    Cumulative: ${formatNumber(monthData.total.cumulative_tokens, 0)} ${projectData.ticker}
                    (${formatPercent(monthData.total.cumulative_pct_of_genesis, 1)} of allocation)
                </div>
            </div>
        </div>
    `;
}

function renderVestingTierSummary(vestingData, projectData, currentMonth) {
    if (!vestingData.tier_totals) return '';

    const schedule = vestingData.monthly_schedule;
    const lastScheduleMonth = schedule[schedule.length - 1];

    const tiers = [];

    // Build tier summary
    if (vestingData.tier_totals.tier_1_profit_seeking) {
        const tier = vestingData.tier_totals.tier_1_profit_seeking;
        const currentData = schedule.find(m => m.month === currentMonth);
        const tier1Current = currentData?.tier_aggregates?.tier_1_profit_seeking?.cumulative_tokens || 0;
        const progressPct = (tier1Current / tier.tokens) * 100;

        // Find completion month
        const completionMonth = schedule.find(m =>
            m.tier_aggregates?.tier_1_profit_seeking?.cumulative_tokens >= tier.tokens * 0.999
        );

        tiers.push({
            name: 'Tier 1: Profit-Seeking',
            tokens: tier.tokens,
            pct: tier.pct_of_genesis,
            completionDate: completionMonth ? completionMonth.date : lastScheduleMonth.date,
            progress: progressPct,
            complete: progressPct >= 99,
            colorClass: 'tier-1'
        });
    }

    if (vestingData.tier_totals.tier_2_entity_controlled) {
        const tier = vestingData.tier_totals.tier_2_entity_controlled;
        const currentData = schedule.find(m => m.month === currentMonth);
        const tier2Current = currentData?.tier_aggregates?.tier_2_entity_controlled?.cumulative_tokens || 0;
        const progressPct = (tier2Current / tier.tokens) * 100;

        const completionMonth = schedule.find(m =>
            m.tier_aggregates?.tier_2_entity_controlled?.cumulative_tokens >= tier.tokens * 0.999
        );

        tiers.push({
            name: 'Tier 2: Entity Controlled',
            tokens: tier.tokens,
            pct: tier.pct_of_genesis,
            completionDate: completionMonth ? completionMonth.date : lastScheduleMonth.date,
            progress: progressPct,
            complete: progressPct >= 99,
            colorClass: 'tier-2'
        });
    }

    if (tiers.length === 0) return '';

    return `
        <div style="margin-top: 2rem;">
            <h3 style="margin-bottom: 1rem; color: var(--text);">Tier Breakdown Summary</h3>
            <div class="vesting-tier-summary">
                ${tiers.map(tier => `
                    <div class="vesting-tier-summary-row">
                        <div class="vesting-tier-summary-header">
                            <span class="vesting-tier-name ${tier.colorClass}-text">${tier.name}</span>
                            <span class="vesting-tier-allocation">${formatNumber(tier.tokens, 0)} ${projectData.ticker} (${formatPercent(tier.pct, 1)})</span>
                        </div>
                        <div class="vesting-tier-summary-details">
                            <span>Fully Vested: ${formatDate(tier.completionDate)}</span>
                            <span class="${tier.complete ? 'text-success' : 'text-primary'}">
                                ${tier.complete ? '✓ 100% Complete' : `${formatPercent(tier.progress, 1)} Complete`}
                            </span>
                        </div>
                    </div>
                `).join('')}
            </div>
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
                <h2 class="section-title">${createIcon('pickaxe', { size: '24', className: 'inline-icon' })} Mining Economics</h2>
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
                <h2 class="section-title">${createIcon('target', { size: '24', className: 'inline-icon' })} Genesis Allocation</h2>
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
                    <h2 class="section-title">${createIcon('dollar-sign', { size: '24', className: 'inline-icon' })} Market Data</h2>
                </div>
                <p style="color: var(--text-secondary); padding: 1rem;">Market data not available</p>
            </div>
        `;
    }

    return `
        <div class="section">
            <div class="section-header">
                <h2 class="section-title">${createIcon('dollar-sign', { size: '24', className: 'inline-icon' })} Market Data</h2>
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
                <h2 class="section-title">${createIcon('file-text', { size: '24', className: 'inline-icon' })} Notes & Context</h2>
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
        return `<a href="${url}" target="_blank" rel="noopener" class="source-link">${domain}</a>`;
    }).join('');

    // Verification status
    const hasBlockExplorer = (sources.block_explorer || []).length > 0;
    const hasOfficialDocs = (sources.official_docs || []).length > 0;
    const hasMarketData = (sources.market_data || []).length > 0;

    // Data confidence based on source availability
    let confidence = 'Medium';
    let confidenceClass = 'status-warning';

    const sourceCount = [hasBlockExplorer, hasOfficialDocs, hasMarketData].filter(Boolean).length;
    if (sourceCount >= 3) {
        confidence = 'High';
        confidenceClass = 'status-success';
    } else if (sourceCount <= 1) {
        confidence = 'Low';
        confidenceClass = 'status-danger';
    }

    return `
        <div class="section">
            <div class="section-header">
                <h2 class="section-title">${createIcon('link', { size: '24', className: 'inline-icon' })} Data Sources & Verification</h2>
            </div>

            <h3 style="margin-bottom: 1rem; color: var(--text);">Primary Sources</h3>
            <div class="source-links">
                ${links}
            </div>

            <h3 style="margin: 2rem 0 1rem 0; color: var(--text);">Verification Status</h3>
            <div class="data-grid">
                <div class="data-item">
                    <span class="data-label">On-chain Verified</span>
                    <span class="data-value"><span class="status-badge ${hasBlockExplorer ? 'status-success' : 'status-danger'}">${hasBlockExplorer ? 'Yes' : 'No'}</span></span>
                </div>
                <div class="data-item">
                    <span class="data-label">Official Documentation</span>
                    <span class="data-value"><span class="status-badge ${hasOfficialDocs ? 'status-success' : 'status-danger'}">${hasOfficialDocs ? 'Yes' : 'No'}</span></span>
                </div>
                <div class="data-item">
                    <span class="data-label">Market Data Available</span>
                    <span class="data-value"><span class="status-badge ${hasMarketData ? 'status-success' : 'status-warning'}">${hasMarketData ? 'Yes' : 'Limited'}</span></span>
                </div>
                <div class="data-item">
                    <span class="data-label">Data Confidence</span>
                    <span class="data-value"><span class="status-badge ${confidenceClass}">${confidence}</span></span>
                </div>
            </div>

            <p style="margin-top: 1.5rem; color: var(--text-secondary); font-size: 0.9rem;">
                ${createIcon('info', { size: '16', className: 'inline-icon' })}
                All data is community-sourced and verifiable through linked sources. Last updated: ${formatDate(data.last_updated)}
            </p>
        </div>
    `;
}

// ========================================
// NEW SECTIONS - Distribution & Analysis
// ========================================

function renderInvestorDetailsSection(genesis) {
    if (!genesis) return '';

    return `
        <div class="section">
            <div class="section-header">
                <h2 class="section-title">${createIcon('briefcase', { size: '24', className: 'inline-icon' })} Investor & Insider Details</h2>
            </div>

            ${renderInvestorTable(genesis)}
            ${renderTransparencyAssessment(genesis)}
        </div>
    `;
}

function renderDistributionProgressBar(data, genesis) {
    const maxSupply = data.supply.max_supply;
    const currentSupply = data.supply.current_supply;
    const emissionRemaining = data.supply.emission_remaining;

    let premineUnlocked = 0;
    let premineVesting = 0;
    let minedToDate = 0;
    let unmined = 0;

    if (data.has_premine && genesis && vestingScheduleData) {
        // Calculate current month since genesis
        const genesisDate = new Date(vestingScheduleData.genesis_date);
        const now = new Date();
        const monthsSinceGenesis = Math.floor((now - genesisDate) / (1000 * 60 * 60 * 24 * 30.44));

        // Find current vested amount from schedule
        const currentMonth = vestingScheduleData.monthly_schedule.find(m => m.month === monthsSinceGenesis) ||
                           vestingScheduleData.monthly_schedule[vestingScheduleData.monthly_schedule.length - 1];

        const totalAllocation = vestingScheduleData.total_genesis_allocation_tokens;
        premineUnlocked = currentMonth ? currentMonth.total.cumulative_tokens : 0;
        premineVesting = totalAllocation - premineUnlocked;
        minedToDate = currentSupply - totalAllocation;
        unmined = emissionRemaining;
    } else if (data.has_premine && genesis) {
        // Fallback if no vesting schedule: assume all premine is unlocked
        const totalAllocation = (genesis.total_genesis_allocation_pct / 100) * maxSupply;
        premineUnlocked = totalAllocation;
        premineVesting = 0;
        minedToDate = currentSupply - totalAllocation;
        unmined = emissionRemaining;
    } else {
        // Fair launch: all is mined
        minedToDate = currentSupply;
        unmined = emissionRemaining;
    }

    // Calculate percentages of max supply
    const premineUnlockedPct = (premineUnlocked / maxSupply) * 100;
    const premineVestingPct = (premineVesting / maxSupply) * 100;
    const minedPct = (minedToDate / maxSupply) * 100;
    const unminedPct = (unmined / maxSupply) * 100;

    // Circulating supply boundary (premine unlocked + mined)
    const circulatingPct = premineUnlockedPct + minedPct;

    return `
        <div class="section">
            <div class="section-header">
                <h2 class="section-title">${createIcon('bar-chart-3', { size: '24', className: 'inline-icon' })} Distribution Progress</h2>
                <span class="section-subtitle">${formatPercent(circulatingPct, 1)} Circulating</span>
            </div>

            <div class="distribution-progress-container">
                <div class="distribution-bar">
                    ${premineUnlockedPct > 0 ? `
                        <div class="distribution-segment premine-unlocked" style="width: ${premineUnlockedPct}%">
                            ${premineUnlockedPct > 5 ? '<span>' + formatPercent(premineUnlockedPct, 1) + '</span>' : ''}
                        </div>
                    ` : ''}
                    ${premineVestingPct > 0 ? `
                        <div class="distribution-segment premine-vesting" style="width: ${premineVestingPct}%">
                            ${premineVestingPct > 5 ? '<span>' + formatPercent(premineVestingPct, 1) + '</span>' : ''}
                        </div>
                    ` : ''}
                    ${minedPct > 0 ? `
                        <div class="distribution-segment mined" style="width: ${minedPct}%">
                            ${minedPct > 5 ? '<span>' + formatPercent(minedPct, 1) + '</span>' : ''}
                        </div>
                    ` : ''}
                    ${unminedPct > 0 ? `
                        <div class="distribution-segment unmined" style="width: ${unminedPct}%">
                            ${unminedPct > 5 ? '<span>' + formatPercent(unminedPct, 1) + '</span>' : ''}
                        </div>
                    ` : ''}
                    ${circulatingPct < 100 ? `
                        <div class="circulating-marker" style="left: ${circulatingPct}%"></div>
                    ` : ''}
                </div>

                <div class="distribution-legend">
                    ${premineUnlockedPct > 0 ? `
                        <div class="legend-item">
                            <div class="legend-color premine-unlocked"></div>
                            <span class="legend-text">Premine Unlocked (Liquid)</span>
                            <span class="legend-percent">${formatPercent(premineUnlockedPct, 1)} (${formatNumber(premineUnlocked, 0)})</span>
                        </div>
                    ` : ''}
                    ${premineVestingPct > 0 ? `
                        <div class="legend-item">
                            <div class="legend-color premine-vesting"></div>
                            <span class="legend-text">Premine Vesting (Locked)</span>
                            <span class="legend-percent">${formatPercent(premineVestingPct, 1)} (${formatNumber(premineVesting, 0)})</span>
                        </div>
                    ` : ''}
                    <div class="legend-item">
                        <div class="legend-color mined"></div>
                        <span class="legend-text">Mined to Date</span>
                        <span class="legend-percent">${formatPercent(minedPct, 1)} (${formatNumber(minedToDate, 0)})</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-color unmined"></div>
                        <span class="legend-text">Unmined (Future Emissions)</span>
                        <span class="legend-percent">${formatPercent(unminedPct, 1)} (${formatNumber(unmined, 0)})</span>
                    </div>
                </div>

                <p style="margin-top: 1rem; color: var(--text-secondary); font-size: 0.9rem;">
                    ${createIcon('info', { size: '16', className: 'inline-icon' })}
                    Vertical marker shows circulating supply boundary (${formatPercent(circulatingPct, 1)} of max supply).
                    ${premineVestingPct > 0 ? `${formatNumber(premineVesting, 0)} tokens remain locked in vesting schedules.` : ''}
                </p>
            </div>
        </div>
    `;
}

function renderEmissionTimelineChart(data) {
    if (!data.emission || !data.emission.halving_schedule) return '';

    const chartId = 'emission-timeline-chart-' + Math.random().toString(36).substr(2, 9);

    // Calculate emission over time
    const launchDate = new Date(data.launch_date);
    const currentDate = new Date();
    const yearsFromLaunch = (currentDate - launchDate) / (1000 * 60 * 60 * 24 * 365.25);
    const maxYears = Math.max(20, Math.ceil(yearsFromLaunch) + 10);

    const labels = [];
    const emissionData = [];

    // Build timeline data
    let currentReward = data.emission.halving_schedule[0]?.reward_before || data.emission.current_block_reward;
    const blockTime = data.emission.block_time_seconds;
    const blocksPerYear = (365.25 * 24 * 60 * 60) / blockTime;

    const halvings = data.emission.halving_schedule.map(h => ({
        year: (new Date(h.date) - launchDate) / (1000 * 60 * 60 * 24 * 365.25),
        reward: h.reward_after,
        height: h.height
    }));

    for (let year = 0; year <= maxYears; year++) {
        labels.push(year);

        // Find if there's a halving at this year
        const halving = halvings.find(h => Math.abs(h.year - year) < 0.5);
        if (halving) {
            currentReward = halving.reward;
        }

        const annualEmission = currentReward * blocksPerYear;
        emissionData.push(annualEmission);
    }

    // Render chart after DOM is ready
    setTimeout(() => {
        const canvas = document.getElementById(chartId);
        if (!canvas) return;

        new Chart(canvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Annual Emission (' + data.ticker + ')',
                    data: emissionData,
                    borderColor: '#3B82F6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        labels: {
                            color: '#E5E7EB'
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return formatNumber(context.parsed.y, 0) + ' ' + data.ticker;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Years from Launch',
                            color: '#9CA3AF'
                        },
                        ticks: {
                            color: '#9CA3AF'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Annual Emission',
                            color: '#9CA3AF'
                        },
                        ticks: {
                            color: '#9CA3AF',
                            callback: function(value) {
                                return formatNumber(value, 0);
                            }
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)'
                        }
                    }
                }
            }
        });
    }, 100);

    return `
        <div style="margin-top: 2rem;">
            <h3 style="margin-bottom: 1rem; color: var(--text);">Emission Timeline</h3>
            <div class="chart-container">
                <canvas id="${chartId}"></canvas>
            </div>
            <p style="margin-top: 1rem; color: var(--text-secondary); font-size: 0.9rem;">
                ${createIcon('trending-down', { size: '16', className: 'inline-icon' })}
                Chart shows annual emission decay over time. Drops represent halving events.
            </p>
        </div>
    `;
}

function renderVestingWaterfallChart(vestingData, projectData) {
    if (!vestingData || !vestingData.monthly_schedule) return '';

    const chartId = 'vesting-waterfall-chart-' + Math.random().toString(36).substr(2, 9);

    // Prepare data for chart (first 60 months or until completion)
    const schedule = vestingData.monthly_schedule.slice(0, 60);

    // Create labels with actual dates in MMM 'YY format
    const genesisDate = new Date(vestingData.genesis_date);
    const labels = schedule.map(m => {
        const date = new Date(genesisDate);
        date.setMonth(date.getMonth() + m.month);
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthName = monthNames[date.getMonth()];
        const year = String(date.getFullYear()).slice(-2);
        return `${monthName} '${year}`;
    });

    // Prepare tier datasets
    const tier1Data = [];
    const tier2Data = [];
    const tier3Data = [];

    schedule.forEach(monthData => {
        const tier1 = monthData.tier_aggregates?.tier_1_profit_seeking?.unlock_tokens || 0;
        const tier2 = monthData.tier_aggregates?.tier_2_entity_controlled?.unlock_tokens || 0;
        const tier3 = monthData.tier_aggregates?.tier_3_community?.unlock_tokens || 0;

        tier1Data.push(tier1);
        tier2Data.push(tier2);
        tier3Data.push(tier3);
    });

    setTimeout(() => {
        const canvas = document.getElementById(chartId);
        if (!canvas) return;

        new Chart(canvas, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Tier 1: Profit-Seeking',
                        data: tier1Data,
                        backgroundColor: '#E74C3C'
                    },
                    {
                        label: 'Tier 2: Entity Controlled',
                        data: tier2Data,
                        backgroundColor: '#F39C12'
                    },
                    {
                        label: 'Tier 3: Community',
                        data: tier3Data,
                        backgroundColor: '#3498DB'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        labels: {
                            color: '#E5E7EB'
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ': ' + formatNumber(context.parsed.y, 0) + ' ' + projectData.ticker;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        stacked: true,
                        title: {
                            display: true,
                            text: 'Unlock Date',
                            color: '#9CA3AF'
                        },
                        ticks: {
                            color: '#9CA3AF',
                            maxRotation: 45,
                            minRotation: 45
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)'
                        }
                    },
                    y: {
                        stacked: true,
                        title: {
                            display: true,
                            text: 'Tokens Unlocking',
                            color: '#9CA3AF'
                        },
                        ticks: {
                            color: '#9CA3AF',
                            callback: function(value) {
                                return formatNumber(value, 0);
                            }
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)'
                        }
                    }
                }
            }
        });
    }, 100);

    return `
        <div style="margin-top: 2rem;">
            <h3 style="margin-bottom: 1rem; color: var(--text);">Vesting Waterfall</h3>
            <div class="chart-container">
                <canvas id="${chartId}"></canvas>
            </div>
            <p style="margin-top: 1rem; color: var(--text-secondary); font-size: 0.9rem;">
                ${createIcon('bar-chart-2', { size: '16', className: 'inline-icon' })}
                Monthly unlock schedule by tier. Stacked bars show total tokens vesting each month.
            </p>
        </div>
    `;
}

function renderInvestorTable(genesis) {
    const tier1 = genesis.allocation_tiers.tier_1_profit_seeking;
    if (!tier1 || !tier1.buckets) return '';

    const rows = tier1.buckets.map(bucket => {
        const knownInvestors = bucket.investors?.known || bucket.recipients?.known || [];
        const unknownCount = bucket.investors?.unknown_count || bucket.recipients?.unknown_count || 0;

        const investorNames = knownInvestors.length > 0
            ? knownInvestors.map(inv => inv.name).join(', ')
            : unknownCount > 0
                ? `${unknownCount} undisclosed`
                : 'Not disclosed';

        const totalRaised = bucket.investors?.total_raised_usd || 0;

        return `
            <tr>
                <td>${bucket.name}</td>
                <td>${formatNumber(bucket.absolute_tokens, 0)}</td>
                <td>${formatPercent(bucket.pct, 1)}</td>
                <td>${formatCurrency(bucket.cost_per_token_usd, 2)}</td>
                <td>${investorNames}</td>
                <td>${bucket.vesting_months}mo linear${bucket.cliff_months > 0 ? ', ' + bucket.cliff_months + 'mo cliff' : ''}${bucket.tge_unlock_pct > 0 ? ', ' + formatPercent(bucket.tge_unlock_pct) + ' TGE' : ''}</td>
            </tr>
        `;
    }).join('');

    return `
        <div style="margin-top: 2rem;">
            <h3 style="margin-bottom: 1rem; color: var(--text);">${createIcon('users', { size: '20', className: 'inline-icon' })} Known Investors</h3>
            <div class="table-container">
                <table class="investor-table">
                    <thead>
                        <tr>
                            <th>Round</th>
                            <th>Amount</th>
                            <th>% of Supply</th>
                            <th>Cost/Token</th>
                            <th>Known Investors</th>
                            <th>Vesting</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function renderTransparencyAssessment(genesis) {
    if (!genesis) return '';

    const tier1 = genesis.allocation_tiers.tier_1_profit_seeking;
    if (!tier1 || !tier1.buckets) return '';

    let knownInvestorsCount = 0;
    let totalInvestorsCount = 0;
    let knownAllocations = 0;
    let totalAllocations = tier1.buckets.length;

    tier1.buckets.forEach(bucket => {
        const known = bucket.investors?.known || bucket.recipients?.known || [];
        const unknownCount = bucket.investors?.unknown_count || bucket.recipients?.unknown_count;

        knownInvestorsCount += known.length;

        if (typeof unknownCount === 'number') {
            totalInvestorsCount += known.length + unknownCount;
        } else if (known.length > 0) {
            knownAllocations++;
        }
    });

    const knownPct = totalInvestorsCount > 0 ? (knownInvestorsCount / totalInvestorsCount) * 100 : 0;
    const disclosedPct = totalAllocations > 0 ? (knownAllocations / totalAllocations) * 100 : 0;

    // Determine vesting contract status from notes
    const transparencyNotes = genesis.transparency_notes || [];
    let vestingStatus = 'Unknown';
    let vestingClass = 'status-unknown';

    if (transparencyNotes.some(note => note.toLowerCase().includes('on-chain'))) {
        vestingStatus = 'On-chain';
        vestingClass = 'status-success';
    } else if (transparencyNotes.some(note => note.toLowerCase().includes('off-chain'))) {
        vestingStatus = 'Off-chain';
        vestingClass = 'status-warning';
    }

    // Data confidence
    let confidence = 'Medium';
    let confidenceClass = 'status-warning';

    if (knownPct > 70 && disclosedPct > 70) {
        confidence = 'High';
        confidenceClass = 'status-success';
    } else if (knownPct < 30 || disclosedPct < 30) {
        confidence = 'Low';
        confidenceClass = 'status-danger';
    }

    return `
        <div style="margin-top: 2rem;">
            <h3 style="margin-bottom: 1rem; color: var(--text);">${createIcon('shield-check', { size: '20', className: 'inline-icon' })} Transparency Assessment</h3>
            <div class="data-grid">
                <div class="data-item">
                    <span class="data-label">Known Investors</span>
                    <span class="data-value">${knownInvestorsCount} out of ${totalInvestorsCount > 0 ? totalInvestorsCount : '?'} ${totalInvestorsCount > 0 ? '(' + formatPercent(knownPct, 0) + ')' : ''}</span>
                </div>
                <div class="data-item">
                    <span class="data-label">Disclosed Allocations</span>
                    <span class="data-value">${knownAllocations} out of ${totalAllocations} (${formatPercent(disclosedPct, 0)})</span>
                </div>
                <div class="data-item">
                    <span class="data-label">Vesting Contracts</span>
                    <span class="data-value"><span class="status-badge ${vestingClass}">${vestingStatus}</span></span>
                </div>
                <div class="data-item">
                    <span class="data-label">Data Confidence</span>
                    <span class="data-value"><span class="status-badge ${confidenceClass}">${confidence}</span></span>
                </div>
            </div>
        </div>
    `;
}

function renderDueDiligenceFindings(data, genesis) {
    if (!genesis) return '';

    const suspectedMining = genesis.suspected_insider_mining || {};
    const transparencyNotes = genesis.transparency_notes || [];
    const redFlags = genesis.red_flags || {};

    const criticalIssues = redFlags.critical_issues || [];
    const warnings = redFlags.warnings || [];
    const suspiciousTimeline = redFlags.suspicious_timeline || suspectedMining.evidence || [];

    // Build issues list
    let issuesHtml = '';

    // Critical issues
    criticalIssues.forEach(issue => {
        issuesHtml += `
            <div class="alert-box alert-critical">
                ${createIcon('alert-octagon', { size: '20', className: 'inline-icon' })}
                <strong>CRITICAL:</strong> ${issue.title || issue.description}
            </div>
        `;
    });

    // Warnings
    warnings.forEach(issue => {
        issuesHtml += `
            <div class="alert-box alert-warning">
                ${createIcon('alert-triangle', { size: '20', className: 'inline-icon' })}
                <strong>WARNING:</strong> ${issue.title || issue.description}
            </div>
        `;
    });

    // Suspected insider mining
    if (suspectedMining.enabled) {
        issuesHtml += `
            <div class="alert-box alert-high">
                ${createIcon('flag', { size: '20', className: 'inline-icon' })}
                <strong>HIGH:</strong> Suspected insider mining activity (${formatPercent(suspectedMining.estimated_pct_of_supply || 0, 1)} of supply)
            </div>
        `;
    }

    // Timeline
    let timelineHtml = '';
    if (suspiciousTimeline.length > 0) {
        timelineHtml = `
            <h3 style="margin: 2rem 0 1rem 0; color: var(--text);">${createIcon('clock', { size: '20', className: 'inline-icon' })} Timeline of Events</h3>
            <div class="findings-timeline">
                ${suspiciousTimeline.map(event => `
                    <div class="timeline-event-finding">
                        <div class="timeline-date">${formatDate(event.date)}</div>
                        <div class="timeline-description">
                            ${event.event || event.description}
                            ${event.evidence ? `<div style="margin-top: 0.5rem; font-size: 0.85rem; opacity: 0.7;">Evidence: ${event.evidence}</div>` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    // Transparency notes
    let notesHtml = '';
    if (transparencyNotes.length > 0) {
        notesHtml = `
            <h3 style="margin: 2rem 0 1rem 0; color: var(--text);">${createIcon('info', { size: '20', className: 'inline-icon' })} Data Quality Notes</h3>
            <ul class="findings-notes">
                ${transparencyNotes.map(note => `<li>${note}</li>`).join('')}
            </ul>
        `;
    }

    // If no findings, show positive message
    if (!issuesHtml && !timelineHtml && !notesHtml) {
        return `
            <div class="section">
                <div class="section-header">
                    <h2 class="section-title">${createIcon('clipboard-check', { size: '24', className: 'inline-icon' })} Due Diligence Findings</h2>
                </div>
                <div class="alert-box alert-success">
                    ${createIcon('check-circle', { size: '20', className: 'inline-icon' })}
                    <strong>No major issues identified.</strong> Standard due diligence checks passed.
                </div>
            </div>
        `;
    }

    return `
        <div class="section">
            <div class="section-header">
                <h2 class="section-title">${createIcon('clipboard-check', { size: '24', className: 'inline-icon' })} Due Diligence Findings</h2>
            </div>
            ${issuesHtml}
            ${timelineHtml}
            ${notesHtml}
        </div>
    `;
}

function renderKeyMetricsSummary(data, genesis) {
    const supply = data.supply;
    const market = data.market_data;

    // Calculate metrics

    // 1. Absolute token holdings by party
    let foundationTokens = 0;
    let teamTokens = 0;
    let investorTokens = 0;
    let minersTokens = supply.current_supply;

    if (genesis) {
        const tier2 = genesis.allocation_tiers.tier_2_entity_controlled;
        const tier1 = genesis.allocation_tiers.tier_1_profit_seeking;

        if (tier2) {
            foundationTokens = (tier2.total_pct / 100) * supply.max_supply;
            minersTokens -= foundationTokens;
        }
        if (tier1) {
            const totalTier1Tokens = (tier1.total_pct / 100) * supply.max_supply;
            tier1.buckets?.forEach(bucket => {
                if (bucket.name.toLowerCase().includes('team') || bucket.name.toLowerCase().includes('contributor')) {
                    teamTokens += bucket.absolute_tokens || 0;
                } else {
                    investorTokens += bucket.absolute_tokens || 0;
                }
            });
            minersTokens -= totalTier1Tokens;
        }
    }

    // 2. Effective control percentage
    const foundationControlPct = (foundationTokens / supply.current_supply) * 100;
    const insiderControlPct = ((foundationTokens + teamTokens + investorTokens) / supply.current_supply) * 100;

    // 3. Cumulative emissions
    const emittedPct = (supply.current_supply / supply.max_supply) * 100;
    const remainingPct = (supply.emission_remaining / supply.max_supply) * 100;

    // 4. Unlock cliff sizes
    let largestCliff = { tokens: 0, date: 'N/A' };
    let nextUnlock = { tokens: 0, date: 'N/A' };
    let vestingCompletion = 'N/A';

    if (vestingScheduleData) {
        const now = new Date();
        const genesisDate = new Date(vestingScheduleData.genesis_date);
        const monthsSinceGenesis = Math.floor((now - genesisDate) / (1000 * 60 * 60 * 24 * 30.44));

        // Find largest cliff
        vestingScheduleData.monthly_schedule.forEach(month => {
            if (month.total.unlock_tokens > largestCliff.tokens) {
                largestCliff = { tokens: month.total.unlock_tokens, date: month.date };
            }

            // Find next unlock
            if (month.month > monthsSinceGenesis && !nextUnlock.date && month.total.unlock_tokens > 0) {
                nextUnlock = { tokens: month.total.unlock_tokens, date: month.date };
            }
        });

        // Vesting completion
        const lastMonth = vestingScheduleData.monthly_schedule[vestingScheduleData.monthly_schedule.length - 1];
        vestingCompletion = lastMonth.date;
    }

    // 5. Presale/ICO total raised
    let totalRaised = 0;
    let numRounds = 0;
    let leadInvestors = [];

    if (genesis && genesis.allocation_tiers.tier_1_profit_seeking) {
        genesis.allocation_tiers.tier_1_profit_seeking.buckets?.forEach(bucket => {
            if (bucket.investors?.total_raised_usd) {
                totalRaised += bucket.investors.total_raised_usd;
                numRounds++;

                const known = bucket.investors.known || [];
                known.forEach(inv => {
                    if (!leadInvestors.includes(inv.name)) {
                        leadInvestors.push(inv.name);
                    }
                });
            }
        });
    }

    const avgEntryPrice = totalRaised > 0 && genesis
        ? totalRaised / ((genesis.allocation_tiers.tier_1_profit_seeking.total_pct / 100) * supply.max_supply)
        : 0;

    // 10. Inflation-adjusted ROI
    let nominalROI = 0;
    let inflationAdjustedROI = 0;

    if (avgEntryPrice > 0 && market?.current_price_usd) {
        nominalROI = ((market.current_price_usd - avgEntryPrice) / avgEntryPrice) * 100;

        // Simple inflation adjustment (assuming ~3% annual inflation)
        const launchDate = new Date(data.launch_date);
        const yearsElapsed = (new Date() - launchDate) / (1000 * 60 * 60 * 24 * 365.25);
        const inflationFactor = Math.pow(1.03, yearsElapsed);
        inflationAdjustedROI = ((market.current_price_usd / inflationFactor - avgEntryPrice) / avgEntryPrice) * 100;
    }

    return `
        <div class="section">
            <div class="section-header">
                <h2 class="section-title">${createIcon('list-ordered', { size: '24', className: 'inline-icon' })} Key Metrics Summary</h2>
            </div>

            <div class="metrics-summary-list">
                <div class="metric-summary-item">
                    <div class="metric-number">1</div>
                    <div class="metric-content">
                        <h4>Absolute token holdings by party</h4>
                        <ul>
                            <li>Foundation/Treasury: ${formatNumber(foundationTokens, 0)} ${data.ticker} (${formatCurrency(foundationTokens * (market?.current_price_usd || 0))} value)</li>
                            <li>Team/Contributors: ${formatNumber(teamTokens, 0)} ${data.ticker} (${formatCurrency(teamTokens * (market?.current_price_usd || 0))} value)</li>
                            <li>Investors: ${formatNumber(investorTokens, 0)} ${data.ticker} (${formatCurrency(investorTokens * (market?.current_price_usd || 0))} value)</li>
                            <li>Miners/Community: ${formatNumber(minersTokens, 0)} ${data.ticker} (${formatCurrency(minersTokens * (market?.current_price_usd || 0))} value)</li>
                        </ul>
                    </div>
                </div>

                <div class="metric-summary-item">
                    <div class="metric-number">2</div>
                    <div class="metric-content">
                        <h4>Effective control percentage</h4>
                        <ul>
                            <li>Foundation direct: ${formatPercent(foundationControlPct, 1)} of circulating</li>
                            <li>Combined insider control: ${formatPercent(insiderControlPct, 1)} of circulating</li>
                        </ul>
                    </div>
                </div>

                <div class="metric-summary-item">
                    <div class="metric-number">3</div>
                    <div class="metric-content">
                        <h4>Cumulative emissions vs projected</h4>
                        <ul>
                            <li>Emitted to date: ${formatNumber(supply.current_supply, 0)} tokens (${formatPercent(emittedPct, 1)} of max supply)</li>
                            <li>Remaining emissions: ${formatNumber(supply.emission_remaining, 0)} tokens (${formatPercent(remainingPct, 1)} of max supply)</li>
                            <li>Emission progress: ${formatPercent(emittedPct, 1)} complete</li>
                        </ul>
                    </div>
                </div>

                <div class="metric-summary-item">
                    <div class="metric-number">4</div>
                    <div class="metric-content">
                        <h4>Unlock cliff sizes and dates</h4>
                        <ul>
                            <li>Largest cliff: ${formatNumber(largestCliff.tokens, 0)} tokens on ${formatDate(largestCliff.date)}</li>
                            <li>Next major unlock: ${formatNumber(nextUnlock.tokens, 0)} tokens on ${formatDate(nextUnlock.date)}</li>
                            <li>Vesting completion: ${formatDate(vestingCompletion)} (all allocations fully vested)</li>
                        </ul>
                    </div>
                </div>

                <div class="metric-summary-item">
                    <div class="metric-number">5</div>
                    <div class="metric-content">
                        <h4>Presale/ICO total raised</h4>
                        <ul>
                            <li>Total USD raised: ${formatCurrency(totalRaised)}</li>
                            <li>Number of rounds: ${numRounds}</li>
                            <li>Average entry price: ${formatCurrency(avgEntryPrice, 2)} per token</li>
                            <li>Known lead investors: ${leadInvestors.slice(0, 5).join(', ') || 'Not disclosed'}</li>
                        </ul>
                    </div>
                </div>

                <div class="metric-summary-item">
                    <div class="metric-number">6</div>
                    <div class="metric-content">
                        <h4>Current Fully Diluted Market Cap</h4>
                        <ul>
                            <li>FDMC: ${formatCurrency(market?.fdmc)} (max supply × current price)</li>
                            <li>Date of calculation: ${formatDate(data.last_updated)}</li>
                        </ul>
                    </div>
                </div>

                <div class="metric-summary-item">
                    <div class="metric-number">7</div>
                    <div class="metric-content">
                        <h4>Circulating Market Cap</h4>
                        <ul>
                            <li>Circ. MC: ${formatCurrency(market?.circulating_mcap)} (circulating × current price)</li>
                            <li>Rank: ${market?.rank ? '#' + market.rank : 'Not tracked'}</li>
                        </ul>
                    </div>
                </div>

                <div class="metric-summary-item">
                    <div class="metric-number">8</div>
                    <div class="metric-content">
                        <h4>Token velocity</h4>
                        <ul>
                            <li>24h volume / circulating MC: ${market?.token_velocity ? formatPercent(market.token_velocity * 100, 2) : 'N/A'}</li>
                            <li>Interpretation: ${market?.token_velocity > 0.05 ? 'High' : market?.token_velocity > 0.02 ? 'Medium' : 'Low'} liquidity</li>
                        </ul>
                    </div>
                </div>

                <div class="metric-summary-item">
                    <div class="metric-number">9</div>
                    <div class="metric-content">
                        <h4>Concentration ratio</h4>
                        <ul>
                            <li>Top tier allocations: ${genesis ? formatPercent(genesis.total_genesis_allocation_pct, 1) : '0%'} of supply</li>
                            <li>Note: Blockchain-level rich list data unavailable for detailed holder analysis</li>
                        </ul>
                    </div>
                </div>

                <div class="metric-summary-item">
                    <div class="metric-number">10</div>
                    <div class="metric-content">
                        <h4>Inflation-adjusted ROI from presale</h4>
                        <ul>
                            <li>Nominal ROI: ${nominalROI > 0 ? '+' : ''}${formatPercent(nominalROI, 1)} (current price / ICO price)</li>
                            <li>Inflation-adjusted: ${inflationAdjustedROI > 0 ? '+' : ''}${formatPercent(inflationAdjustedROI, 1)} (accounting for ~3% annual USD inflation)</li>
                            <li>ATH ROI: Data not available</li>
                        </ul>
                    </div>
                </div>

                <div class="metric-summary-item">
                    <div class="metric-number">11</div>
                    <div class="metric-content">
                        <h4>Address obscuration ability</h4>
                        <ul>
                            <li>For PoW: Ability to obscure holdings via mixing/multiple addresses</li>
                            <li>Assessment: ${data.consensus === 'PoW' ? 'Moderate - standard PoW privacy considerations apply' : 'Varies by chain architecture'}</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderNavigationActions(projectName) {
    return `
        <div class="section">
            <div class="section-header">
                <h2 class="section-title">${createIcon('navigation', { size: '24', className: 'inline-icon' })} Navigation & Actions</h2>
            </div>

            <div class="action-buttons">
                <a href="../index.html" class="action-button">
                    ${createIcon('arrow-left', { size: '18', className: 'inline-icon' })} Back to Projects
                </a>
                <button class="action-button" onclick="alert('Comparison feature coming soon!')">
                    ${createIcon('git-compare', { size: '18', className: 'inline-icon' })} Add to Compare
                </button>
                <button class="action-button" onclick="downloadProjectData('${projectName}')">
                    ${createIcon('download', { size: '18', className: 'inline-icon' })} Download Data
                </button>
                <a href="https://github.com/cannonQ/pow-tokenomics-tracker/issues" target="_blank" class="action-button">
                    ${createIcon('message-circle', { size: '18', className: 'inline-icon' })} Report Issue
                </a>
            </div>
        </div>
    `;
}

function downloadProjectData(projectName) {
    const dataToExport = {
        project: projectData,
        genesis: genesisData,
        vesting_schedule: vestingScheduleData,
        exported_at: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName}-data-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function formatTokensShort(tokens) {
    if (!tokens || tokens === 0) return '0';

    if (tokens >= 1000000) {
        const millions = tokens / 1000000;
        // Format with 1 decimal if needed, otherwise no decimals
        return millions % 1 === 0 ? `${millions}M` : `${millions.toFixed(1)}M`;
    }

    if (tokens >= 1000) {
        const thousands = tokens / 1000;
        return thousands % 1 === 0 ? `${thousands}K` : `${thousands.toFixed(1)}K`;
    }

    return formatNumber(tokens, 0);
}

function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}
