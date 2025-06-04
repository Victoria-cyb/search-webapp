import { initTheme, updateHistory, initNavigation } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
    console.log('script.js: DOM fully loaded for', window.location.pathname);

    if (window.location.protocol === 'file:') {
        console.error('script.js: Google Sign-In not supported via file://. Serve files via http://localhost (e.g., VS Code Live Server on port 5500).');
        return;
    }

    initTheme();
    initNavigation();

    function initializeGoogleSignIn(attempt = 1, maxAttempts = 30) {
        if (attempt > maxAttempts) {
            console.error('script.js: Failed to initialize Google Sign-In after', maxAttempts, 'attempts.');
            return;
        }
        if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
            try {
                google.accounts.id.initialize({
                    client_id: '115641619754-kg6l8nsenfabli97eag3siompothqoqg.apps.googleusercontent.com',
                    callback: window.handleGoogleCredentialResponse,
                    auto_select: false,
                    context: window.location.pathname.includes('login') ? 'signin' : 'signup',
                });
                console.log('script.js: Google Sign-In initialized on attempt', attempt);
            } catch (error) {
                console.error('script.js: Google Sign-In initialization error on attempt', attempt, ':', error.message);
                setTimeout(() => initializeGoogleSignIn(attempt + 1, maxAttempts), 100);
            }
        } else {
            console.log('script.js: Google script not loaded, retrying attempt', attempt, 'of', maxAttempts);
            setTimeout(() => initializeGoogleSignIn(attempt + 1, maxAttempts), 100);
        }
    }
    initializeGoogleSignIn();
});

const formEl = document.querySelector('form');
const inputEl = document.getElementById('search-input');
const searchSourceEl = document.getElementById('search-source'); // New
const searchResults = document.querySelector('.search-results');
const showMore = document.getElementById('show-more-button');
const favoritesSection = document.querySelector('.favorites');
const downloadHistorySection = document.querySelector('.download-history');

if (formEl && inputEl && searchResults && showMore) {
    let inputData = '';
    let page = 1;
    let totalPages = 1;
    let token = localStorage.getItem('token') || null;

    console.log('script.js: Initial token check:', token);
    if (token) {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            if (payload.exp * 1000 < Date.now()) {
                console.log('script.js: Token expired, clearing');
                localStorage.removeItem('token');
                token = null;
            }
        } catch (error) {
            console.log('script.js: Invalid token, clearing', error.message);
            localStorage.removeItem('token');
            token = null;
        }
    }
    console.log('script.js: Token after validation:', token);

    let filters = {
        orientation: '',
        color: '',
        size: ''
    };

    const GRAPHQL_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:4001/graphql'
        : 'https://search-webapp.onrender.com/graphql';

    const filtersSection = document.querySelector('.filters');
    if (token) {
        console.log('script.js: User logged in, showing filters');
        filtersSection?.classList.add('active');
        displayFavorites();
        displayDownloadHistory();
    } else {
        console.log('script.js: No user logged in, hiding filters');
        filtersSection?.classList.remove('active');
    }

    const urlParamsForToken = new URLSearchParams(window.location.search);
    const urlToken = urlParamsForToken.get('token');
    if (urlToken) {
        localStorage.setItem('token', urlToken);
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    window.showNotification = function(message, showRegister = true, type = 'info') {
        console.log('showNotification called:', { message, showRegister, type });
        try {
            document.querySelectorAll('.notification-modal').forEach(m => m.remove());
            const modal = document.createElement('div');
            modal.className = `notification-modal ${type}`;
            modal.innerHTML = `
                <div class="notification-content">
                    <p>${message}</p>
                    <div class="notification-buttons">
                        ${showRegister ? '<button class="register-btn">Register</button>' : ''}
                        <button class="close-btn">Close</button>
                    </div>
                </div>`;
            document.body.appendChild(modal);
            modal.style.display = 'flex';
            modal.style.position = 'fixed';
            modal.style.top = '20px';
            modal.style.left = '50%';
            modal.style.transform = 'translateX(-50%)';
            modal.style.zIndex = '1002';
            modal.style.opacity = '1';
            modal.style.visibility = 'visible';

            const registerBtn = modal.querySelector('.register-btn');
            if (registerBtn) {
                registerBtn.addEventListener('click', () => {
                    console.log('Register button clicked, navigating to register.html');
                    window.location.href = 'register.html';
                });
            }

            const closeBtn = modal.querySelector('.close-btn');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    console.log('Close button clicked');
                    modal.remove();
                });
            }

            const autoCloseTimeout = setTimeout(() => {
                if (modal.isConnected) {
                    console.log('Auto-removing notification');
                    modal.remove();
                }
            }, 5000);
            closeBtn?.addEventListener('click', () => clearTimeout(autoCloseTimeout));
        } catch (error) {
            console.error('showNotification error:', error.message);
            alert(message + (showRegister ? ' Please register at register.html.' : ''));
        }
    };

    async function searchImages(newPage = page) {
        console.log('searchImages called:', { inputData, page: newPage, filters, source: searchSourceEl.value });
        try {
            page = newPage;
            inputData = inputEl.value.trim();
            if (!inputData) {
                searchResults.innerHTML = '<p>Please enter a search query.</p>';
                showMore.style.display = 'none';
                return;
            }

            searchResults.innerHTML = '<div class="loading">Loading...</div>';
            let query;
            let results = [];
            let total_pages = 1;

            if (searchSourceEl.value === 'pinterest') {
                // Restrict Pinterest search to logged-in users (optional)
                if (!token) {
                    showNotification('Please log in to search Pinterest images.', true, 'info');
                    searchResults.innerHTML = '';
                    showMore.style.display = 'none';
                    return;
                }
                query = `
                    mutation {
                        scrapePinterestImages(query: "${inputData}", limit: 30) {
                            message
                            images {
                                id
                                src
                                alt
                                query
                                timestamp
                            }
                        }
                    }`;
                const res = await fetch(GRAPHQL_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ query }),
                });
                const { data, errors } = await res.json();
                if (errors) {
                    console.error('scrapePinterestImages errors:', JSON.stringify(errors, null, 2));
                    throw new Error(errors[0].message);
                }
                results = data.scrapePinterestImages.images;
                total_pages = 1; // Pinterest results are limited to 30, no pagination
            } else {
                query = `
                    query {
                        searchImages(query: "${inputData}", page: ${page}, orientation: "${filters.orientation}", color: "${filters.color}", size: "${filters.size}") {
                            results { id urls { small regular full } alt_description links { html } user { name } }
                            total_pages
                        }
                    }`;
                const res = await fetch(GRAPHQL_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ query }),
                });
                const { data, errors } = await res.json();
                if (errors) {
                    console.error('searchImages errors:', JSON.stringify(errors, null, 2));
                    throw new Error(errors[0].message);
                }
                results = data.searchImages.results;
                total_pages = data.searchImages.total_pages;
            }

            if (page === 1) searchResults.innerHTML = '';
            if (results.length === 0) {
                searchResults.innerHTML = `<p>No results found for "${inputData}".</p>`;
                showMore.style.display = 'none';
                return;
            }

            console.log('searchImages: Rendering', results.length, 'results');
            results.forEach((result, index) => {
                const imageWrapper = document.createElement('div');
                imageWrapper.classList.add('search-result');
                const image = document.createElement('img');
                image.src = searchSourceEl.value === 'pinterest' ? result.src : result.urls.small;
                image.alt = searchSourceEl.value === 'pinterest' ? result.alt || 'Pinterest image' : result.alt_description;
                image.loading = 'lazy';
                image.addEventListener('click', () => {
                    console.log('Image clicked:', result.id);
                    const modal = document.createElement('div');
                    modal.className = 'modal';
                    modal.innerHTML = `
                        <div class="modal-content">
                            <span class="close">×</span>
                            <img src="${searchSourceEl.value === 'pinterest' ? result.src : result.urls.regular}" alt="${image.alt}">
                            <p>By: ${searchSourceEl.value === 'pinterest' ? 'Pinterest' : result.user.name}</p>
                        </div>`;
                    document.body.appendChild(modal);
                    modal.querySelector('.close').addEventListener('click', () => modal.remove());
                    modal.addEventListener('click', (e) => {
                        if (e.target === modal) modal.remove();
                    });
                });
                const imageLink = document.createElement('a');
                imageLink.href = searchSourceEl.value === 'pinterest' ? result.src : result.links.html;
                imageLink.target = '_blank';
                imageLink.textContent = searchSourceEl.value === 'pinterest' ? 'View on Pinterest' : result.alt_description || 'View on Unsplash';
                const downloadBtn = document.createElement('button');
                downloadBtn.textContent = 'Download';
                downloadBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    console.log('Download button clicked, token:', token, 'result:', result.id);
                    if (!token) {
                        showNotification('Please register and log in to download images.', true, 'info');
                        return;
                    }
                    try {
                        const payload = JSON.parse(atob(token.split('.')[1]));
                        if (payload.exp * 1000 < Date.now()) {
                            console.log('Token expired during download, clearing');
                            localStorage.removeItem('token');
                            token = null;
                            showNotification('Session expired. Please log in again.', true, 'error');
                            return;
                        }
                    } catch (error) {
                        console.log('Invalid token during download, clearing', error.message);
                        localStorage.removeItem('token');
                        token = null;
                        showNotification('Invalid session. Please log in again.', true, 'error');
                        return;
                    }
                    showNotification('Download started...', false, 'ongoing');
                    try {
                        let downloadUrl;
                        if (searchSourceEl.value === 'pinterest') {
                            const response = await fetch(result.src);
                            if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
                            const blob = await response.blob();
                            downloadUrl = window.URL.createObjectURL(blob);
                        } else {
                            const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                            if (isMobile) {
                                const downloadResponse = await fetch(GRAPHQL_URL, {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        Authorization: `Bearer ${token}`,
                                    },
                                    body: JSON.stringify({
                                        query: `query { downloadImage(url: "${result.urls.full}") }`,
                                    }),
                                });
                                const { data, errors } = await downloadResponse.json();
                                if (errors) throw new Error(errors[0].message);
                                downloadUrl = data.downloadImage;
                            } else {
                                const response = await fetch(result.urls.full);
                                if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
                                const blob = await response.blob();
                                downloadUrl = window.URL.createObjectURL(blob);
                            }
                        }
                        const a = document.createElement('a');
                        a.href = downloadUrl;
                        a.download = `${result.id || 'image'}.jpg`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        if (searchSourceEl.value !== 'pinterest') {
                            const mutation = `
                                mutation { 
                                    trackDownload(
                                        imageId: "${result.id}", 
                                        url: "${result.urls.full}", 
                                        alt_description: "${result.alt_description || ''}"
                                    ) { 
                                        id url alt_description timestamp 
                                    } 
                                }`;
                            const trackResponse = await fetch(GRAPHQL_URL, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    Authorization: `Bearer ${token}`,
                                },
                                body: JSON.stringify({ query: mutation }),
                            });
                            const { data, errors } = await trackResponse.json();
                            if (errors) throw new Error(errors[0].message);
                        }
                        showNotification('Image downloaded successfully!', false, 'success');
                        if (searchSourceEl.value !== 'pinterest') displayDownloadHistory();
                    } catch (error) {
                        console.error('Download error:', error.message);
                        showNotification(`Failed to download image: ${error.message}`, false, 'error');
                    }
                });
                const favoriteBtn = document.createElement('button');
                favoriteBtn.textContent = 'Favorite';
                favoriteBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    console.log('Favorite button clicked, token:', token, 'result:', result.id);
                    if (!token) {
                        showNotification('Please register and log in to add favorites.', true, 'info');
                        return;
                    }
                    showNotification('Adding to favorites...', false, 'ongoing');
                    const mutation = searchSourceEl.value === 'pinterest'
                        ? `
                            mutation {
                                addFavorite(image: {
                                    id: "${result.id}"
                                    urls: { small: "${result.src}", regular: "${result.src}", full: "${result.src}" }
                                    alt_description: "${result.alt || ''}"
                                    links: { html: "${result.src}" }
                                    user: { name: "Pinterest" }
                                }) {
                                    favorites { id }
                                }
                            }`
                        : `
                            mutation {
                                addFavorite(image: {
                                    id: "${result.id}"
                                    urls: { small: "${result.urls.small}", regular: "${result.urls.regular}", full: "${result.urls.full}" }
                                    alt_description: "${result.alt_description || ''}"
                                    links: { html: "${result.links.html}" }
                                    user: { name: "${result.user.name}" }
                                }) {
                                    favorites { id }
                                }
                            }`;
                    try {
                        const res = await fetch(GRAPHQL_URL, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                Authorization: `Bearer ${token}`,
                            },
                            body: JSON.stringify({ query: mutation }),
                        });
                        const { data, errors } = await res.json();
                        if (errors) {
                            console.error('addFavorite errors:', JSON.stringify(errors, null, 2));
                            throw new Error(errors[0].message);
                        }
                        showNotification('Image added to favorites!', false, 'success');
                        displayFavorites();
                    } catch (error) {
                        console.error('Error adding favorite:', error.message);
                        showNotification('Failed to add favorite: ' + error.message, false, 'error');
                    }
                });
                imageWrapper.appendChild(image);
                imageWrapper.appendChild(imageLink);
                imageWrapper.appendChild(downloadBtn);
                imageWrapper.appendChild(favoriteBtn);
                searchResults.appendChild(imageWrapper);
                console.log('searchImages: Added result', index, 'to DOM');
            });

            totalPages = total_pages;
            updatePagination();
            updateHistory(inputData, searchImages);
            updateShareableLink();

            console.log('searchImages: Total buttons rendered:', document.querySelectorAll('.search-result button').length);
            setTimeout(() => {
                console.log('Buttons after 1s:', document.querySelectorAll('.search-result button').length);
                console.log('Download buttons:', document.querySelectorAll('.search-result button:first-of-type').length);
                console.log('Favorite buttons:', document.querySelectorAll('.search-result button:last-of-type').length);
            }, 1000);
        } catch (error) {
            console.error('Error fetching images:', error.message, error.stack);
            searchResults.innerHTML = '<p>Sorry, something went wrong: ' + error.message + '</p>';
            showMore.style.display = 'none';
        }
    }

    function updatePagination() {
        console.log('updatePagination called:', { page, totalPages });
        showMore.innerHTML = '';
        if (page > 1 && searchSourceEl.value !== 'pinterest') {
            const prevBtn = document.createElement('button');
            prevBtn.textContent = 'Previous';
            prevBtn.addEventListener('click', () => searchImages(page - 1));
            showMore.appendChild(prevBtn);
        }
        if (page < totalPages && searchSourceEl.value !== 'pinterest') {
            const nextBtn = document.createElement('button');
            nextBtn.textContent = 'Next';
            nextBtn.addEventListener('click', () => searchImages(page + 1));
            showMore.appendChild(nextBtn);
        }
        showMore.style.display = totalPages > 1 && searchSourceEl.value !== 'pinterest' ? 'block' : 'none';
    }

    async function displayFavorites(userFavorites = null) {
        if (!token) return;
        console.log('displayFavorites called');
        try {
            if (!userFavorites) {
                const query = `
                    query {
                        getFavorites {
                            id urls { small regular full } alt_description links { html } user { name }
                        }
                    }`;
                const res = await fetch(GRAPHQL_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ query }),
                });
                const { data, errors } = await res.json();
                if (errors) {
                    console.error('displayFavorites errors:', JSON.stringify(errors, null, 2));
                    throw new Error(errors[0].message);
                }
                userFavorites = data.getFavorites;
            }
            favoritesSection.innerHTML = '<h3>Favorites</h3>';
            if (!userFavorites || userFavorites.length === 0) {
                favoritesSection.innerHTML += '<p>No favorites yet.</p>';
                return;
            }
            favoritesSection.innerHTML = '<h3>Favorites</h3>';
            userFavorites.forEach(f => {
                const wrapper = document.createElement('div');
                wrapper.className = 'search-result';
                wrapper.innerHTML = `
                    <img src="${f.urls.small}" alt="${f.alt_description}" loading="lazy">
                    <a href="${f.links.html}" target="_blank">${f.alt_description || 'View on Source'}</a>
                    <button class="remove-favorite-btn">Remove</button>`;
                wrapper.querySelector('.remove-favorite-btn').addEventListener('click', async () => {
                    showNotification('Removing from favorites...', false, 'ongoing');
                    const mutation = `
                        mutation {
                            removeFavorite(imageId: "${f.id}") {
                                favorites { id }
                            }
                        }`;
                    try {
                        const res = await fetch(GRAPHQL_URL, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                Authorization: `Bearer ${token}`,
                            },
                            body: JSON.stringify({ query: mutation }),
                        });
                        const { data, errors } = await res.json();
                        if (errors) {
                            console.error('removeFavorite errors:', JSON.stringify(errors, null, 2));
                            throw new Error(errors[0].message);
                        }
                        showNotification('Image removed from favorites!', false, 'success');
                        displayFavorites();
                    } catch (error) {
                        console.error('Error removing favorite:', error.message);
                        showNotification('Failed to remove favorite: ' + error.message, false, 'error');
                    }
                });
                favoritesSection.appendChild(wrapper);
            });
        } catch (error) {
            console.error('Error fetching favorites:', error.message);
            favoritesSection.innerHTML = '<p>Failed to load favorites: ' + error.message + '</p>';
        }
    }

    async function displayDownloadHistory() {
        if (!token) return;
        console.log('displayDownloadHistory called');
        try {
            const query = `
                query {
                    getDownloadHistory {
                        id url alt_description timestamp
                    }
                }`;
            const res = await fetch(GRAPHQL_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ query }),
            });
            const { data, errors } = await res.json();
            if (errors) {
                console.error('displayDownloadHistory errors:', JSON.stringify(errors, null, 2));
                throw new Error(errors[0].message);
            }
            const history = data.getDownloadHistory;
            downloadHistorySection.innerHTML = '<h3>Download History</h3>';
            if (!history || history.length === 0) {
                downloadHistorySection.innerHTML += '<p>No downloads yet.</p>';
                return;
            }
            history.forEach(item => {
                const wrapper = document.createElement('div');
                wrapper.className = 'search-result';
                wrapper.innerHTML = `
                    <img src="${item.url}" alt="${item.alt_description || 'Downloaded image'}" loading="lazy">
                    <p>Description: ${item.alt_description || 'N/A'}</p>
                    <p>Downloaded: ${new Date(item.timestamp).toLocaleString()}</p>`;
                downloadHistorySection.appendChild(wrapper);
            });
            const clearBtn = document.createElement('button');
            clearBtn.textContent = 'Clear History';
            clearBtn.addEventListener('click', async () => {
                try {
                    const mutation = `
                        mutation {
                            clearDownloadHistory {
                                id url alt_description timestamp
                            }
                        }`;
                    const res = await fetch(GRAPHQL_URL, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${token}`,
                        },
                        body: JSON.stringify({ query: mutation }),
                    });
                    const { data, errors } = await res.json();
                    if (errors) {
                        throw new Error(errors[0].message);
                    }
                    if (data.clearDownloadHistory) {
                        showNotification('Download history cleared.', false, 'success');
                        displayDownloadHistory([]);
                    } else {
                        showNotification('Server did not confirm deletion.', false, 'error');
                    }
                } catch (error) {
                    console.error('Error clearing history:', error.message);
                    showNotification('Failed to clear download history: ' + error.message, false, 'error');
                }
            });
            downloadHistorySection.appendChild(clearBtn);
        } catch (error) {
            console.error('Error fetching download history:', error.message);
            downloadHistorySection.innerHTML = '<p>Failed to load download history: ' + error.message + '</p>';
        }
    }

    const filterEls = document.querySelectorAll('.filters select');
    filterEls.forEach(el => {
        el.addEventListener('change', () => {
            filters[el.id] = el.value;
            page = 1;
            searchImages();
        });
    });

    document.querySelectorAll('.categories button').forEach(btn => {
        btn.addEventListener('click', () => {
            inputEl.value = btn.dataset.category;
            page = 1;
            searchImages();
        });
    });

    const clearSearchBtn = document.getElementById('clear-search');
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', () => {
            inputEl.value = '';
            filters = { orientation: '', color: '', size: '' };
            filterEls.forEach(el => (el.value = ''));
            searchSourceEl.value = 'unsplash';
            searchResults.innerHTML = '';
            showMore.style.display = 'none';
            history.pushState({}, '', window.location.pathname);
        });
    }

    function updateShareableLink() {
        const params = new URLSearchParams({ query: inputData, source: searchSourceEl.value, ...filters });
        history.pushState({}, '', `?${params.toString()}`);
    }

    formEl.addEventListener('submit', (event) => {
        event.preventDefault();
        page = 1;
        searchImages();
    });

    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('query');
    if (query) {
        inputEl.value = query;
        searchSourceEl.value = urlParams.get('source') || 'unsplash';
        filters.orientation = urlParams.get('orientation') || '';
        filters.color = urlParams.get('color') || '';
        filters.size = urlParams.get('size') || '';
        filterEls.forEach(el => {
            if (filters[el.id]) el.value = filters[el.id];
        });
        searchImages();
    }
}

const logoutLink = document.getElementById('logout-link');
if (logoutLink) {
    logoutLink.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('script.js: Logout clicked');
        localStorage.removeItem('token');
        localStorage.removeItem('downloadHistory');
        window.location.href = 'landing.html';
    });
} else {
    console.warn('script.js: logout-link not found on', window.location.pathname);
}