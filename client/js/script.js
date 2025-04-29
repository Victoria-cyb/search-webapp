import { initTheme, updateHistory, initNavigation } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
    console.log('script.js: DOM fully loaded for', window.location.pathname);
    initTheme();
    initNavigation();
});

const formEl = document.querySelector('form');
const inputEl = document.getElementById('search-input');
const searchResults = document.querySelector('.search-results');
const showMore = document.getElementById('show-more-button');
const favoritesSection = document.querySelector('.favorites');
const downloadHistorySection = document.querySelector('.download-history');

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

    const GRAPHQL_URL = window.location.hostname === 'localhost'
        ? 'http://localhost:6000/graphql'
        : 'https://search-webapp.onrender.com/graphql';

    // Initialize filters for all users
    document.querySelector('.filters')?.classList.add('active');
    if (token) {
        displayFavorites();
        displayDownloadHistory();
    }

    // Google OAuth
    window.handleGoogleLogin = async (response) => {
        const googleToken = response.credential;
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
                document.querySelector('.filters')?.classList.add('active');
                displayFavorites();
                displayDownloadHistory();
                window.location.href = 'search.html';
            }
        } catch (error) {
            console.error('Google auth error:', JSON.stringify(error, null, 2));
            showNotification('Failed to authenticate with Google: ' + error.message);
        }
    };

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

    async function searchImages(newPage = page) {
        try {
            page = newPage;
            inputData = inputEl.value.trim();
            if (!inputData) {
                searchResults.innerHTML = '<p>Please enter a search query.</p>';
                showMore.style.display = 'none';
                return;
            }

            searchResults.innerHTML = '<div class="loading">Loading...</div>';
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
                },
                body: JSON.stringify({ query }),
            });
            const { data, errors } = await res.json();
            if (errors) {
                console.error('searchImages errors:', JSON.stringify(errors, null, 2));
                throw new Error(errors[0].message);
            }
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
                downloadBtn.disabled = !token;
                downloadBtn.addEventListener('click', async () => {
                    if (!token) {
                        showNotification('Please register to download images.');
                        return;
                    }
                    try {
                        const mutation = `
                            mutation { trackDownload(imageId: "${result.id}", url: "${result.urls.full}", alt_description: "${result.alt_description || ''}") { id url alt_description timestamp } }
                        `;
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
                            console.error('trackDownload errors:', JSON.stringify(errors, null, 2));
                            throw new Error(errors[0].message);
                        }
                        window.location.href = result.urls.full;
                        displayDownloadHistory();
                    } catch (error) {
                        console.error('Download error:', error.message);
                        showNotification('Failed to download image: ' + error.message);
                    }
                });
                const favoriteBtn = document.createElement('button');
                favoriteBtn.textContent = 'Favorite';
                favoriteBtn.disabled = !token;
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
                        displayFavorites();
                    } catch (error) {
                        console.error('Error adding favorite:', error.message);
                        showNotification('Failed to add favorite: ' + error.message);
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
            console.error('Error fetching images:', error.message);
            searchResults.innerHTML = '<p>Sorry, something went wrong: ' + error.message + '</p>';
            showMore.style.display = 'none';
        }
    }

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
                    <a href="${f.links.html}" target="_blank">${f.alt_description || 'View on Unsplash'}</a>
                    <button class="remove-favorite-btn">Remove</button>`;
                wrapper.querySelector('.remove-favorite-btn').addEventListener('click', async () => {
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
                        displayFavorites();
                    } catch (error) {
                        console.error('Error removing favorite:', error.message);
                        showNotification('Failed to remove favorite: ' + error.message);
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
            downloadHistorySection.innerHTML = '<h3>Download History</h3>';
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
            clearBtn.addEventListener('click', () => {
                localStorage.removeItem('downloadHistory');
                displayDownloadHistory();
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
            searchResults.innerHTML = '';
            showMore.style.display = 'none';
            history.pushState({}, '', window.location.pathname);
        });
    }

    function updateShareableLink() {
        const params = new URLSearchParams({ query: inputData, ...filters });
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