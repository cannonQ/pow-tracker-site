// Configuration for fetching data from GitHub
const CONFIG = {
    // Replace with your GitHub username and repo name
    GITHUB_USER: 'cannonQ',
    REPO_NAME: 'pow-tokenomics-tracker/pow-tokenomics-tracker',
    BRANCH: 'main',
    
    // Constructed URLs
    get RAW_BASE_URL() {
        return `https://raw.githubusercontent.com/${this.GITHUB_USER}/${this.REPO_NAME}/${this.BRANCH}`;
    },
    
    get API_BASE_URL() {
        return `https://api.github.com/repos/${this.GITHUB_USER}/${this.REPO_NAME}/contents`;
    },
    
    // Data paths
    PROJECTS_PATH: 'data/projects',
    ALLOCATIONS_PATH: 'allocations',
    
    // Cache duration (5 minutes)
    CACHE_DURATION: 5 * 60 * 1000,
    
    // Formatting options
    DECIMAL_PLACES: 2,
    LARGE_NUMBER_FORMAT: 'compact' // 'compact' or 'full'
};

// Setup instructions
console.log(`
🔧 Setup Required:
1. Open js/config.js
2. Replace YOUR-USERNAME with your GitHub username
3. Replace pow-tokenomics-tracker with your repo name (if different)
4. Save and refresh!

Current config:
- User: ${CONFIG.GITHUB_USER}
- Repo: ${CONFIG.REPO_NAME}
- Branch: ${CONFIG.BRANCH}
`);

