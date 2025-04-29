export function initTheme() {
    const themeToggle = document.getElementById('theme-toggle');
    const body = document.body;

    if (localStorage.getItem('theme') === 'dark') {
        body.classList.add('dark-mode');
        if (themeToggle) themeToggle.textContent = 'Light Mode';
    }

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            body.classList.toggle('dark-mode');
            localStorage.setItem('theme', body.classList.contains('dark-mode') ? 'dark' : 'light');
            themeToggle.textContent = body.classList.contains('dark-mode') ? 'Light Mode' : 'Dark Mode';
        });
    } else {
        console.warn('Theme toggle button not found');
    }
}

export function updateHistory(query, searchImages) {
    const searchHistory = document.querySelector('.search-history');
    if (!searchHistory) return;

    let history = JSON.parse(localStorage.getItem('searchHistory')) || [];

    if (query && !history.includes(query)) {
        history.push(query);
        localStorage.setItem('searchHistory', JSON.stringify(history));
    }

    searchHistory.innerHTML = '<h3>Search History</h3>';
    history.forEach(item => {
        const button = document.createElement('button');
        button.textContent = item;
        button.addEventListener('click', () => {
            const searchInput = document.getElementById('search-input');
            if (searchInput) {
                searchInput.value = item;
                searchImages();
            }
        });
        searchHistory.appendChild(button);
    });
}

export function initNavigation() {
    console.log('initNavigation: Running for', window.location.pathname);
    const token = localStorage.getItem('token');
    const loginLink = document.getElementById('login-link');
    const landingLink = document.getElementById('landing-link');
    const indexLink = document.getElementById('index-link');
    const searchLink = document.getElementById('search-link');
    const aboutLink = document.getElementById('about-link');
    const contactLink = document.getElementById('contact-link');
    const registerLink = document.getElementById('register-link');
    const logoutLink = document.getElementById('logout-link');
    const profileLink = document.getElementById('profile-link');

    if (loginLink && registerLink && logoutLink && profileLink) {
        console.log('initNavigation: Nav links found, token:', !!token);
        if (token) {
            loginLink.style.display = 'none';
            registerLink.style.display = 'none';
            landingLink.style.display = 'none';
            indexLink.style.display = 'none';
            searchLink.style.display = 'none';
            aboutLink.style.display = 'none';
            contactLink.style.display = 'none';
            logoutLink.style.display = 'inline';
            profileLink.style.display = 'inline';
        } else {
            loginLink.style.display = 'inline';
            registerLink.style.display = 'inline';
            landingLink.style.display = 'inline';
            indexLink.style.display = 'inline';
            searchLink.style.display = 'inline';
            aboutLink.style.display = 'inline';
            contactLink.style.display = 'inline';
            logoutLink.style.display = 'none';
            profileLink.style.display = 'none';
        }
    } else {
        console.warn('initNavigation: Some nav links missing', {
            loginLink, registerLink, logoutLink, profileLink, landingLink, indexLink, searchLink, aboutLink, contactLink
        });
    }

    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');
    if (hamburger && navLinks) {
        console.log('initNavigation: Hamburger menu initialized');
        hamburger.addEventListener('click', () => {
            console.log('Hamburger clicked, toggling .open');
            navLinks.classList.toggle('open');
            hamburger.textContent = navLinks.classList.contains('open') ? '✕' : '☰';
        });
    } else {
        console.error('initNavigation: Hamburger or navLinks not found', {
            hamburger: !!hamburger,
            navLinks: !!navLinks,
            page: window.location.pathname
        });
    }
}
