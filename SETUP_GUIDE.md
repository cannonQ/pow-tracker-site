# 🌐 Website Setup Guide

Complete guide to deploying your PoW Tokenomics Tracker website.

---

## 📋 What You Have

A complete, functional website with:
- **Landing page** - Grid view of all projects with filters
- **Project detail pages** - Deep dive into tokenomics
- **About page** - Project information
- **Responsive design** - Works on mobile & desktop
- **GitHub integration** - Reads data directly from your repo

---

## 🚀 Quick Deploy (GitHub Pages)

### Step 1: Add Website Files to Your Repo

You need to add these website files to your existing `pow-tokenomics-tracker` GitHub repo.

**Option A: Via GitHub Web Interface**

1. Go to your repo: `https://github.com/YOUR-USERNAME/pow-tokenomics-tracker`
2. Click **"Add file"** → **"Upload files"**
3. Upload all files from this website folder:
   - `index.html`
   - `project.html`
   - `about.html`
   - `compare.html`
   - `css/` folder (with styles.css)
   - `js/` folder (with all JS files)
4. Commit with message: "Add website"

**Option B: Via Command Line**

```bash
# Navigate to your local repo
cd pow-tokenomics-tracker

# Copy website files into root directory
# (Copy the contents of the website folder you downloaded)

# Add and commit
git add index.html project.html about.html compare.html css/ js/
git commit -m "Add website"
git push origin main
```

### Step 2: Configure GitHub Username

**IMPORTANT:** Update `js/config.js` with your actual GitHub info:

```javascript
const CONFIG = {
    githubUser: 'YOUR-ACTUAL-USERNAME',  // ← Change this!
    githubRepo: 'pow-tokenomics-tracker',
    githubBranch: 'main'
};
```

Commit this change:
```bash
git add js/config.js
git commit -m "Update GitHub configuration"
git push
```

### Step 3: Enable GitHub Pages

1. Go to your repo **Settings** → **Pages**
2. Under "Source":
   - Branch: `main`
   - Folder: `/ (root)`
3. Click **"Save"**
4. Wait 1-2 minutes for deployment

### Step 4: Visit Your Website! 🎉

Your site will be live at:
```
https://YOUR-USERNAME.github.io/pow-tokenomics-tracker/
```

---

## 📁 Repository Structure

After setup, your repo should look like this:

```
pow-tokenomics-tracker/
│
├── Website Files (in root)
│   ├── index.html              ← Landing page
│   ├── project.html            ← Project detail page
│   ├── about.html              ← About page
│   ├── compare.html            ← Compare page (coming soon)
│   ├── css/
│   │   └── styles.css          ← All styling
│   └── js/
│       ├── config.js           ← GitHub configuration
│       ├── utils.js            ← Utility functions
│       ├── main.js             ← Landing page logic
│       └── project.js          ← Project page logic
│
├── Data Files
│   ├── data/
│   │   └── projects/
│   │       ├── bitcoin.json
│   │       └── ...
│   └── allocations/
│       └── [project]/
│           └── genesis.json
│
├── Templates & Examples
│   ├── templates/
│   ├── examples/
│   └── scripts/
│
└── Documentation
    ├── README.md
    ├── CONTRIBUTING.md
    └── ...
```

---

## 🔧 Configuration

### Update Links in HTML Files

Replace `YOUR-USERNAME` in these files:
- `index.html` (line 23 and footer)
- `project.html` (footer)
- `about.html` (lines 23, 111, 129, 136, 149)
- `compare.html` (line 23)

**Quick Find & Replace:**
```bash
# In your repo directory
find . -name "*.html" -type f -exec sed -i 's/YOUR-USERNAME/your-actual-username/g' {} +
```

### Test Configuration

After updating config.js, test by visiting:
```
https://YOUR-USERNAME.github.io/pow-tokenomics-tracker/
```

If you see "GitHub configuration not set" error:
1. Check `js/config.js` is updated
2. Make sure you pushed the changes
3. Wait a minute for GitHub Pages to rebuild

---

## 📊 Adding Your First Project

The website needs data to display! Add Bitcoin as your first project:

```bash
# Copy example to data directory
cp examples/bitcoin-example.json data/projects/bitcoin.json

# Commit and push
git add data/projects/bitcoin.json
git commit -m "Add Bitcoin data"
git push
```

Wait 1-2 minutes, then refresh your website. Bitcoin should appear!

---

## 🎨 Customization

### Change Colors

Edit `css/styles.css` at the top:

```css
:root {
    --primary-blue: #2451ff;      /* Main accent color */
    --primary-dark: #0d1117;      /* Background */
    --secondary-dark: #161b22;    /* Card backgrounds */
    /* ... */
}
```

### Modify Branding

Edit the header in each HTML file:

```html
<h1>⛏️ PoW Tokenomics Tracker</h1>
<p class="tagline">Show the data. Let users judge fairness.</p>
```

### Add Analytics

Add Google Analytics or Plausible to track visits:

```html
<!-- Add before </head> in each HTML file -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
```

---

## 🐛 Troubleshooting

### Website Shows "Failed to load projects"

**Cause:** Configuration not set or no data files exist

**Fix:**
1. Check `js/config.js` has your correct GitHub username
2. Make sure `data/projects/` directory exists with at least one .json file
3. Check browser console for specific errors (F12 → Console tab)

### Projects Not Displaying

**Cause:** JSON syntax errors in project files

**Fix:**
1. Run the validator: `python scripts/validate_submission.py bitcoin`
2. Check for typos in JSON files
3. Ensure no trailing commas in JSON

### GitHub Pages Not Building

**Cause:** Build errors or incorrect settings

**Fix:**
1. Check **Settings → Pages** for error messages
2. Ensure branch is set to `main` and folder to `/ (root)`
3. Check that HTML files are in the root directory (not in a subfolder)

### Styling Looks Broken

**Cause:** CSS file path incorrect

**Fix:**
1. Make sure `css/styles.css` exists
2. Check HTML files link to: `<link rel="stylesheet" href="css/styles.css">`
3. Check browser console for 404 errors

---

## 🔒 Security & Performance

### CORS and GitHub API

The website fetches data via:
- **GitHub Raw Content URL** (no rate limits for public repos)
- **GitHub API** (60 requests/hour limit for unauthenticated)

If you hit rate limits, consider:
1. Using GitHub Pages to serve JSON directly
2. Caching responses in localStorage
3. Using a GitHub Personal Access Token (advanced)

### HTTPS

GitHub Pages automatically provides HTTPS. All your data is secure!

---

## 🚀 Going Further

### Custom Domain

Want `tokenomics.yoursite.com` instead of GitHub Pages URL?

1. Buy a domain (Namecheap, Google Domains, etc.)
2. In repo Settings → Pages → Custom domain
3. Add your domain and verify
4. Update DNS records (GitHub provides instructions)

### Advanced Features

**Want to add more features?**
- Multi-select comparison table
- Historical data charts (price, hashrate)
- Search functionality
- Export to CSV/JSON
- Email alerts for new projects

These would require additional JavaScript but the foundation is here!

### Self-Hosting

Want to host elsewhere (not GitHub Pages)?

The website is pure HTML/CSS/JS - works anywhere:
- Netlify (drag & drop)
- Vercel (one-click deploy)
- Traditional web hosting (upload via FTP)
- IPFS (decentralized hosting)

Just make sure `js/config.js` points to your GitHub repo!

---

## 📱 Mobile Optimization

The website is already responsive! Test on:
- Mobile devices (iPhone, Android)
- Tablets (iPad)
- Different browsers (Chrome, Firefox, Safari)

If something looks off, adjust breakpoints in `css/styles.css`:

```css
@media (max-width: 768px) {
    /* Mobile styles */
}
```

---

## 🎯 Success Checklist

After setup, verify:

- [ ] Website loads at your GitHub Pages URL
- [ ] No console errors (F12 → Console)
- [ ] Bitcoin (or first project) displays correctly
- [ ] Clicking a project shows detail page
- [ ] Filters work on landing page
- [ ] Links to GitHub repo work
- [ ] Mobile view looks good
- [ ] All pages accessible (About, Compare)

---

## 💡 Tips

1. **Start with one project** - Bitcoin is the perfect reference
2. **Test locally** - Open `index.html` in browser before pushing (requires a local server for CORS)
3. **Use browser DevTools** - F12 to debug issues
4. **Keep data fresh** - Update project data monthly
5. **Encourage community** - Share the contribute link!

---

## 🆘 Need Help?

1. Check browser console for errors (F12)
2. Verify file paths and names match exactly
3. Ensure GitHub repo is public
4. Try clearing browser cache
5. Open an issue on GitHub with:
   - What you tried
   - Error messages
   - Screenshots

---

## 🎉 You're All Set!

Your PoW Tokenomics Tracker website is now live and pulling data from GitHub!

**Next steps:**
1. Add more projects (Bitcoin, Kaspa, etc.)
2. Share with the community
3. Accept contributions via Pull Requests
4. Keep data updated

**Your site will automatically update when you merge new data!** 🚀

---

**Website URL:** `https://YOUR-USERNAME.github.io/pow-tokenomics-tracker/`

**Data Repo:** `https://github.com/YOUR-USERNAME/pow-tokenomics-tracker`

**Now go make PoW tokenomics transparent!** ✨
