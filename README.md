# PoW Tokenomics Tracker Website

A clean, DefiLlama-style website that displays PoW cryptocurrency tokenomics data directly from your GitHub repository.

## 🚀 Features

- **Real-time data** - Fetches JSON files directly from GitHub
- **No backend needed** - Pure HTML/CSS/JavaScript
- **Mobile responsive** - Works on all devices
- **Fast & lightweight** - Minimal dependencies
- **Easy to deploy** - Works on any static host

## 📦 What's Included

```
pow-tracker-website/
├── index.html              Landing page with project cards
├── css/
│   ├── styles.css         Main stylesheet (DefiLlama-inspired)
│   └── project.css        Project detail page styles
├── js/
│   ├── config.js          Configuration (EDIT THIS!)
│   ├── utils.js           Utility functions
│   ├── main.js            Landing page logic
│   └── project.js         Project detail page logic
└── pages/
    ├── project.html       Project deep dive page
    └── about.html         About page
```

## ⚙️ Setup (5 Minutes)

### Step 1: Update Configuration

Open `js/config.js` and replace the placeholder values:

```javascript
const CONFIG = {
    GITHUB_USER: 'YOUR-USERNAME',      // ← Replace with your GitHub username
    REPO_NAME: 'pow-tokenomics-tracker', // ← Your repo name
    BRANCH: 'main',                     // ← Your branch name
    ...
};
```

**Example:**
```javascript
const CONFIG = {
    GITHUB_USER: 'satoshi',
    REPO_NAME: 'pow-tokenomics-tracker',
    BRANCH: 'main',
    ...
};
```

### Step 2: Update GitHub Links

Search and replace `YOUR-USERNAME` with your actual GitHub username in:
- `index.html`
- `pages/project.html`
- `pages/about.html`

**Or use this command:**
```bash
# Mac/Linux
find . -type f -name "*.html" -exec sed -i '' 's/YOUR-USERNAME/your-actual-username/g' {} +

# Linux only
find . -type f -name "*.html" -exec sed -i 's/YOUR-USERNAME/your-actual-username/g' {} +
```

### Step 3: Deploy

Upload these files to any static hosting service:

**Option A: GitHub Pages (Free & Easy)**
1. Create a new repo called `pow-tokenomics-tracker-site`
2. Upload all website files
3. Go to Settings → Pages
4. Set source to `main` branch
5. Your site will be at: `https://YOUR-USERNAME.github.io/pow-tokenomics-tracker-site`

**Option B: Netlify (Free)**
1. Drag & drop the `pow-tracker-website` folder to netlify.com
2. Done! Auto-updates when you push changes

**Option C: Vercel (Free)**
1. `npm i -g vercel`
2. `cd pow-tracker-website`
3. `vercel`
4. Follow prompts

**Option D: Any Static Host**
- AWS S3 + CloudFront
- Cloudflare Pages
- Firebase Hosting
- Traditional web hosting

## 🎨 How It Works

### Data Flow

1. Website loads in user's browser
2. JavaScript fetches project list from GitHub API
3. For each project, fetches JSON from raw.githubusercontent.com
4. Displays data with filters, sorting, and search
5. Caches data for 5 minutes to reduce API calls

### File Structure Requirements

Your GitHub repo must have this structure:

```
your-repo/
├── data/
│   └── projects/
│       ├── bitcoin.json
│       ├── kaspa.json
│       └── ...
└── allocations/          (optional, only for premined projects)
    ├── project-name/
    │   └── genesis.json
    └── ...
```

The website will automatically:
- List all `.json` files in `data/projects/`
- Fetch corresponding genesis data if `has_premine: true`
- Display everything in a clean interface

## 🎯 Features

### Landing Page
- Project cards with key metrics
- Filter by: All, Fair Launch, Premine, Suspicious
- Sort by: Name, Market Cap, Launch Date, Premine %, % Mined
- Real-time search
- Hero stats (total projects, fair launches, premined)

### Project Detail Page
- Complete tokenomics breakdown
- Supply & emission metrics
- Mining economics & costs
- Genesis allocation charts (for premined projects)
- Investor details & vesting schedules
- Data sources with links

### Design
- Dark theme (DefiLlama-inspired)
- Clean, professional layout
- Mobile-responsive
- Fast loading
- Accessible

## 🔧 Customization

### Change Colors

Edit `css/styles.css`:

```css
:root {
    --primary: #2172E5;        /* Brand color */
    --success: #27AE60;        /* Green for positive */
    --warning: #F39C12;        /* Yellow for caution */
    --danger: #E74C3C;         /* Red for danger */
    --dark: #1C1C1E;          /* Background */
    --dark-secondary: #2C2C2E; /* Cards */
    ...
}
```

### Add Custom Metrics

Add new calculations in `js/utils.js` and use them in `js/main.js` or `js/project.js`.

### Change Cache Duration

Edit `js/config.js`:

```javascript
CACHE_DURATION: 5 * 60 * 1000, // 5 minutes (in milliseconds)
```

## 📊 Performance

- **Initial load:** ~500ms (depending on number of projects)
- **Subsequent loads:** <100ms (cached)
- **Data refresh:** Every 5 minutes (configurable)
- **Bundle size:** ~15KB (gzipped)

## 🐛 Troubleshooting

### "No projects found"

**Problem:** Website can't fetch data from GitHub

**Solutions:**
1. Check `js/config.js` - is your username correct?
2. Make sure your repo is **public**
3. Verify files are in `data/projects/` directory
4. Check browser console for errors

### "Failed to load project data"

**Problem:** JSON file has errors

**Solutions:**
1. Validate JSON syntax at jsonlint.com
2. Run the validation script: `python scripts/validate_submission.py project-name`
3. Check that all required fields are present

### Styling looks broken

**Problem:** CSS not loading

**Solutions:**
1. Check file paths - make sure `css/styles.css` exists
2. Clear browser cache
3. Check browser console for 404 errors

### GitHub rate limiting

**Problem:** Too many API requests

**Solution:** 
- GitHub allows 60 unauthenticated requests/hour
- The cache reduces requests
- For high traffic, use a GitHub token (requires backend)

## 🚀 Advanced Usage

### Add a Compare Page

Create `pages/compare.html` to show side-by-side project comparisons (not included in base template).

### Add Charts

Include Chart.js:

```html
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
```

Then create visualizations in the project detail page.

### Add Search Indexing

Create a `sitemap.xml` and `robots.txt` for better SEO.

### Custom Domain

Point your domain to your hosting:
- GitHub Pages: Add CNAME file
- Netlify: Configure in dashboard
- Vercel: Add domain in settings

## 📱 Mobile Support

Fully responsive design that works on:
- Desktop (1200px+)
- Tablet (768px - 1199px)
- Mobile (< 768px)

## 🔒 Security

- No user data collected
- No tracking scripts
- All data fetched from public GitHub
- No cookies or local storage (except cache)
- HTTPS recommended

## 📄 License

Open source - use freely for any purpose.

## 🤝 Contributing

Found a bug? Want to add a feature?

1. Open an issue on GitHub
2. Submit a pull request
3. Suggest improvements

## 💬 Support

- **Issues:** https://github.com/YOUR-USERNAME/pow-tokenomics-tracker/issues
- **Questions:** Open a discussion on GitHub
- **Updates:** Watch the repo for changes

## 🎉 Credits

- Design inspired by DefiLlama
- Data sourced by community contributors
- Built with vanilla JavaScript (no frameworks!)

---

**Ready to launch?** Just update `js/config.js` and deploy! 🚀
