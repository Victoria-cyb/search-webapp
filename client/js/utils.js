export function initTheme() {
    const themeToggle = document.getElementById('theme-toggle');
    const body = document.body;

    // Check for saved theme
    if (localStorage.getItem('theme') === 'dark') {
        body.classList.add('dark-mode');
    }

    // Toggle theme
    themeToggle.addEventListener('click', () => {
        body.classList.toggle('dark-mode');
        localStorage.setItem('theme', body.classList.contains('dark-mode') ? 'dark' : 'light');
    });
}

export function updateHistory(query, searchImages) {
    const searchHistory = document.querySelector('.search-history');
    let history = JSON.parse(localStorage.getItem('searchHistory')) || [];

    // Add new query to history
    if (query && !history.includes(query)) {
        history.push(query);
        localStorage.setItem('searchHistory', JSON.stringify(history));
    }

    // Display history
    searchHistory.innerHTML = '<h3>Search History</h3>';
    history.forEach(item => {
        const button = document.createElement('button');
        button.textContent = item;
        button.addEventListener('click', () => {
            document.getElementById('search-input').value = item;
            searchImages();
        });
        searchHistory.appendChild(button);
    });
}

export function initNavigation() {
    const token = localStorage.getItem('token');
    const loginLink = document.getElementById('login-link');
    const registerLink = document.getElementById('register-link');
    const logoutLink = document.getElementById('logout-link');
    const profileLink = document.getElementById('profile-link');

    // Ensure elements exist before modifying
    if (loginLink && registerLink && logoutLink && profileLink) {
        if (token) {
            loginLink.style.display = 'none';
            registerLink.style.display = 'none';
            logoutLink.style.display = 'inline';
            profileLink.style.display = 'inline';
        } else {
            loginLink.style.display = 'inline';
            registerLink.style.display = 'inline';
            logoutLink.style.display = 'none';
            profileLink.style.display = 'none';
        }
    }

    // Hamburger menu
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');
    if (hamburger && navLinks) {
        hamburger.addEventListener('click', () => {
            navLinks.classList.toggle('open');
        });
    }
}