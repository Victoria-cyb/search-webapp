import { initTheme, updateHistory } from './utils.js';

const formEl = document.querySelector('form');
const inputEl = document.getElementById('search-input');
const searchResults = document.querySelector('.search-results');
const showMore = document.getElementById('show-more-button');
const favoritesSection = document.querySelector('.favorites');
const downloadHistorySection = document.querySelector('.download-history');
const loginLink = document.getElementById('login-link');
const registerLink = document.getElementById('register-link');
const logoutLink = document.getElementById('logout-link');
const profileLink = document.getElementById('profile-link');

// Only initialize search if on search.html
if (formEl && inputEl && searchResults && showMore) {
    let inputData = '';
    let page = 1;
    let totalPages = 1;
    let token = localStorage.getItem('token') || null;
    let filters = {
        orientation: '',
        color: '',
        size: ''
    };

    const GRAPHQL_URL = 'http://localhost:4000/graphql'; // Update for production

    // Initialize theme and navigation
    initTheme();
    // Navigation initialized in HTML scripts

    // Check login status
    if (token) {
        loginLink.style.display = 'none';
        registerLink.style.display = 'none';
        logoutLink.style.display = 'inline';
        profileLink.style.display = 'inline';
        document.querySelector('.filters').classList.add('active');
        displayFavorites();
        displayDownloadHistory();
    }

    // Google OAuth (used for both login and registration)
    window.handleGoogleLogin = async (response) => {
        const googleToken = response.credential;
        // Try googleLogin first
        let query = `
            mutation {
                googleLogin(googleToken: "${googleToken}") {
                    token
                    user { id email username }
                }
            }`;
        try {
            let res = await fetch(GRAPHQL_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query }),
            });
            let { data, errors } = await res.json();
            if (errors && errors[0].message.includes('User not found')) {
                // User doesn't exist, try registering
                query = `
                    mutation {
                        googleRegister(googleToken: "${googleToken}") {
                            token
                            user { id email username }
                        }
                    }`;
                res = await fetch(GRAPHQL_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query }),
                });
                ({ data, errors } = await res.json());
            }
            if (errors) throw new Error(errors[0].message);
            if (data.googleLogin || data.googleRegister) {
                token = data.googleLogin?.token || data.googleRegister?.token;
                localStorage.setItem('token', token);
                loginLink.style.display = 'none';
                registerLink.style.display = 'none';
                logoutLink.style.display = 'inline';
                profileLink.style.display = 'inline';
                document.querySelector('.filters').classList.add('active');
                displayFavorites();
                displayDownloadHistory();
                window.location.href = 'search.html';
            }
        } catch (error) {
            console.error('Google auth error:', error);
            showNotification('Failed to authenticate with Google. Please try again.');
        }
    };

    // Logout
    logoutLink.addEventListener('click', () => {
        token = null;
        localStorage.removeItem('token');
        localStorage.removeItem('downloadHistory');
        loginLink.style.display = 'inline';
        registerLink.style.display = 'inline';
        logoutLink.style.display = 'none';
        profileLink.style.display = 'none';
        document.querySelector('.filters').classList.remove('active');
        favoritesSection.innerHTML = '';
        downloadHistorySection.innerHTML = '';
        window.location.href = 'landing.html';
    });

    // Show notification modal
    function showNotification(message) {
        const modal = document.createElement('div');
        modal.className = 'notification-modal';
        modal.innerHTML = `
            <div class="notification-content">
                <span class="close">×</span>
                <p>${message}</p>
                <button onclick="window.location.href='register.html'">Register</button>
                <button class="close-btn">Close</button>
            </div>`;
        document.body.appendChild(modal);
        const closeButtons = modal.querySelectorAll('.close, .close-btn');
        closeButtons.forEach(btn => {
            btn.addEventListener('click', () => modal.remove());
        });
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    }

    // Search images
    async function searchImages(newPage = page) {
        try {
            page = newPage;
            inputData = inputEl.value;
            if (!inputData) {
                searchResults.innerHTML = '<p>Please enter a search query.</p>';
                showMore.style.display = 'none';
                return;
            }

            searchResults.innerHTML = '<div class="loading">Loading...</div>';
            // Mock GraphQL query with filters
            const query = `
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
                    ...(token && { Authorization: `Bearer ${token}` }),
                },
                body: JSON.stringify({ query }),
            });
            const { data, errors } = await res.json();
            if (errors) throw new Error(errors[0].message);
            const { results, total_pages } = data.searchImages;

            if (page === 1) searchResults.innerHTML = '';
            if (results.length === 0) {
                searchResults.innerHTML = `<p>No results found for "${inputData}".</p>`;
                showMore.style.display = 'none';
                return;
            }

            results.forEach((result) => {
                const imageWrapper = document.createElement('div');
                imageWrapper.classList.add('search-result');
                const image = document.createElement('img');
                image.src = result.urls.small;
                image.alt = result.alt_description;
                image.loading = 'lazy';
                image.addEventListener('click', () => {
                    const modal = document.createElement('div');
                    modal.className = 'modal';
                    modal.innerHTML = `
                        <div class="modal-content">
                            <span class="close">×</span>
                            <img src="${result.urls.regular}" alt="${result.alt_description}">
                            <p>${result.alt_description || 'No description'}</p>
                            <p>By: ${result.user.name}</p>
                        </div>`;
                    document.body.appendChild(modal);
                    modal.querySelector('.close').addEventListener('click', () => modal.remove());
                    modal.addEventListener('click', (e) => {
                        if (e.target === modal) modal.remove();
                    });
                });
                const imageLink = document.createElement('a');
                imageLink.href = result.links.html;
                imageLink.target = '_blank';
                imageLink.textContent = result.alt_description || 'View on Unsplash';
                const downloadBtn = document.createElement('button');
                downloadBtn.textContent = 'Download';
                downloadBtn.addEventListener('click', async () => {
                    if (!token) {
                        showNotification('Please register to download images.');
                        return;
                    }
                    try {
                        const response = await fetch(result.urls.full);
                        const blob = await response.blob();
                        const url = window.URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = result.alt_description || 'image';
                        link.click();
                        window.URL.revokeObjectURL(url);
                        // Save to download history
                        saveDownloadHistory({
                            id: result.id,
                            url: result.urls.small,
                            alt_description: result.alt_description,
                            timestamp: new Date().toISOString()
                        });
                        displayDownloadHistory();
                    } catch (error) {
                        console.error('Download error:', error);
                        showNotification('Failed to download image. Try again later.');
                    }
                });
                const favoriteBtn = document.createElement('button');
                favoriteBtn.textContent = 'Favorite';
                favoriteBtn.addEventListener('click', async () => {
                    if (!token) {
                        showNotification('Please register to add favorites.');
                        return;
                    }
                    const mutation = `
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
                        await fetch(GRAPHQL_URL, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                Authorization: `Bearer ${token}`,
                            },
                            body: JSON.stringify({ query: mutation }),
                        });
                        displayFavorites();
                    } catch (error) {
                        console.error('Error adding favorite:', error);
                        showNotification('Failed to add favorite. Please try again.');
                    }
                });
                imageWrapper.appendChild(image);
                imageWrapper.appendChild(imageLink);
                imageWrapper.appendChild(downloadBtn);
                imageWrapper.appendChild(favoriteBtn);
                searchResults.appendChild(imageWrapper);
            });

            totalPages = total_pages;
            updatePagination();
            updateHistory(inputData, searchImages);
            updateShareableLink();
        } catch (error) {
            console.error('Error fetching images:', error);
            searchResults.innerHTML = '<p>Sorry, something went wrong. Please try again later.</p>';
            showMore.style.display = 'none';
        }
    }

    
    // Pagination
    function updatePagination() {
        showMore.innerHTML = '';
        if (page > 1) {
            const prevBtn = document.createElement('button');
            prevBtn.textContent = 'Previous';
            prevBtn.addEventListener('click', () => searchImages(page - 1));
            showMore.appendChild(prevBtn);
        }
        if (page < totalPages) {
            const nextBtn = document.createElement('button');
            nextBtn.textContent = 'Next';
            nextBtn.addEventListener('click', () => searchImages(page + 1));
            showMore.appendChild(nextBtn);
        }
        showMore.style.display = totalPages > 1 ? 'block' : 'none';
    }

    // Favorites
    async function displayFavorites(userFavorites = null) {
        if (!token) return;
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
                if (errors) throw new Error(errors[0].message);
                userFavorites = data.getFavorites;
            }
            favoritesSection.innerHTML = '<h3>Favorites</h3>';
            if (userFavorites.length === 0) {
                favoritesSection.innerHTML += '<p>No favorites yet.</p>';
                return;
            }
            userFavorites.forEach(f => {
                const wrapper = document.createElement('div');
                wrapper.className = 'search-result';
                wrapper.innerHTML = `
                    <img src="${f.urls.small}" alt="${f.alt_description}" loading="lazy">
                    <a href="${f.links.html}" target="_blank">${f.alt_description || 'View on Unsplash'}</a>
                    <button>Remove</button>`;
                wrapper.querySelector('button').addEventListener('click', async () => {
                    const mutation = `
                        mutation {
                            removeFavorite(imageId: "${f.id}") {
                                favorites { id }
                            }
                        }`;
                    try {
                        await fetch(GRAPHQL_URL, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                Authorization: `Bearer ${token}`,
                            },
                            body: JSON.stringify({ query: mutation }),
                        });
                        displayFavorites();
                    } catch (error) {
                        console.error('Error removing favorite:', error);
                        showNotification('Failed to remove favorite. Please try again.');
                    }
                });
                favoritesSection.appendChild(wrapper);
            });
        } catch (error) {
            console.error('Error fetching favorites:', error);
            favoritesSection.innerHTML = '<p>Failed to load favorites. Please try again.</p>';
        }
    }

    // Download history
    function saveDownloadHistory(image) {
        let history = JSON.parse(localStorage.getItem('downloadHistory')) || [];
        history.push(image);
        localStorage.setItem('downloadHistory', JSON.stringify(history));
    }

    function displayDownloadHistory() {
        if (!token) return;
        const history = JSON.parse(localStorage.getItem('downloadHistory')) || [];
        downloadHistorySection.innerHTML = '<h3>Download History</h3>';
        if (history.length === 0) {
            downloadHistorySection.innerHTML += '<p>No downloads yet.</p>';
            return;
        }
        history.forEach(item => {
            const wrapper = document.createElement('div');
            wrapper.className = 'search-result';
            wrapper.innerHTML = `
                <img src="${item.url}" alt="${item.alt_description}" loading="lazy">
                <p>${item.alt_description || 'No description'}</p>
                <p>Downloaded: ${new Date(item.timestamp).toLocaleString()}</p>`;
            downloadHistorySection.appendChild(wrapper);
        });
        const clearBtn = document.createElement('button');
        clearBtn.textContent = 'Clear History';
        clearBtn.addEventListener('click', () => {
            localStorage.removeItem('downloadHistory');
            displayDownloadHistory();
        });
        downloadHistorySection.appendChild(clearBtn);
    }

    // Filters
    const filterEls = document.querySelectorAll('.filters select');
    filterEls.forEach(el => {
        el.addEventListener('change', () => {
            filters[el.id] = el.value;
            page = 1;
            searchImages();
        });
    });

    // Category filters
    document.querySelectorAll('.categories button').forEach(btn => {
        btn.addEventListener('click', () => {
            inputEl.value = btn.dataset.category;
            page = 1;
            searchImages();
        });
    });

    // Clear search
    const clearSearchBtn = document.getElementById('clear-search');
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', () => {
            inputEl.value = '';
            filters = { orientation: '', color: '', size: '' };
            filterEls.forEach(el => (el.value = ''));
            searchResults.innerHTML = '';
            showMore.style.display = 'none';
            history.pushState({}, '', window.location.pathname);
        });
    }

    // Shareable links
    function updateShareableLink() {
        const params = new URLSearchParams({ query: inputData, ...filters });
        history.pushState({}, '', `?${params.toString()}`);
    }

    // Form submission
    formEl.addEventListener('submit', (event) => {
        event.preventDefault();
        page = 1;
        searchImages();
    });

    // Load query and filters from URL
    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('query');
    if (query) {
        inputEl.value = query;
        filters.orientation = urlParams.get('orientation') || '';
        filters.color = urlParams.get('color') || '';
        filters.size = urlParams.get('size') || '';
        filterEls.forEach(el => {
            if (filters[el.id]) el.value = filters[el.id];
        });
        searchImages();
    }

   
}