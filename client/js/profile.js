import { initTheme, initNavigation } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'register.html';
        return;
    }
    initTheme();
    initNavigation();
    loadProfile();
});

const GRAPHQL_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3000/graphql'
    : 'https://search-webapp.onrender.com/graphql';

const profileForm = document.getElementById('profile-form');
const usernameInput = document.getElementById('username');
const emailInput = document.getElementById('email');
const profileError = document.getElementById('error-message');
const favoritesDiv = document.querySelector('.favorites');
const downloadHistoryDiv = document.querySelector('.download-history');

async function loadProfile() {
    const query = `
        query {
            getUserProfile {
                id
                username
                email
                favorites {
                    id
                    urls { small }
                    alt_description
                    links { html }
                    user { name }
                }
            }
            getDownloadHistory {
                id
                url
                alt_description
                timestamp
            }
        }`;
    try {
        const res = await fetch(GRAPHQL_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
            },
            body: JSON.stringify({ query }),
        });
        const { data, errors } = await res.json();
        if (errors) {
            console.error('loadProfile errors:', JSON.stringify(errors, null, 2));
            throw new Error(errors[0].message);
        }
        usernameInput.value = data.getUserProfile.username || '';
        emailInput.value = data.getUserProfile.email;
        displayFavorites(data.getUserProfile.favorites);
        displayDownloadHistory(data.getDownloadHistory);
    } catch (error) {
        console.error('loadProfile failed:', error.message);
        profileError.textContent = `Failed to load profile: ${error.message}`;
    }
}

function displayFavorites(favorites) {
    favoritesDiv.innerHTML = '<h3>Favorites</h3>';
    if (!favorites || favorites.length === 0) {
        favoritesDiv.innerHTML += '<p>No favorites yet.</p>';
        return;
    }
    favorites.forEach(favorite => {
        const div = document.createElement('div');
        div.className = 'search-result';
        div.innerHTML = `
            <img src="${favorite.urls.small}" alt="${favorite.alt_description || 'Image'}" loading="lazy">
            <a href="${favorite.links.html}" target="_blank">${favorite.alt_description || 'View on Unsplash'}</a>
            <button class="remove-favorite-btn" data-id="${favorite.id}">Remove</button>
        `;
        favoritesDiv.appendChild(div);
    });

    document.querySelectorAll('.remove-favorite-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            await removeFavorite(btn.dataset.id);
        });
    });
}

function displayDownloadHistory(history) {
    downloadHistoryDiv.innerHTML = '<h3>Download History</h3>';
    if (!history || history.length === 0) {
        downloadHistoryDiv.innerHTML += '<p>No downloads yet.</p>';
        return;
    }
    history.forEach(download => {
        const div = document.createElement('div');
        div.className = 'search-result';
        div.innerHTML = `
            <img src="${download.url}" alt="${download.alt_description || 'Downloaded image'}" loading="lazy">
            <p>Description: ${download.alt_description || 'N/A'}</p>
            <p>Downloaded: ${new Date(download.timestamp).toLocaleString()}</p>
        `;
        downloadHistoryDiv.appendChild(div);
    });
}

async function removeFavorite(imageId) {
    const mutation = `
        mutation { removeFavorite(imageId: "${imageId}") { favorites { id } } }
    `;
    try {
        const res = await fetch(GRAPHQL_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
            },
            body: JSON.stringify({ query: mutation }),
        });
        const { data, errors } = await res.json();
        if (errors) {
            console.error('removeFavorite errors:', JSON.stringify(errors, null, 2));
            throw new Error(errors[0].message);
        }
        await loadProfile();
    } catch (error) {
        console.error('removeFavorite failed:', error.message);
        profileError.textContent = `Failed to remove favorite: ${error.message}`;
    }
}

if (profileForm) {
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = usernameInput.value.trim();
        const email = emailInput.value.trim();
        if (!username && !email) {
            profileError.textContent = 'Please provide a username or email.';
            return;
        }

        const mutation = `
            mutation { updateUserProfile(username: "${username}", email: "${email}") {
                id username email
            } }
        `;
        try {
            const res = await fetch(GRAPHQL_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                },
                body: JSON.stringify({ query: mutation }),
            });
            const { data, errors } = await res.json();
            if (errors) {
                console.error('updateUserProfile errors:', JSON.stringify(errors, null, 2));
                throw new Error(errors[0].message);
            }
            profileError.textContent = 'Profile updated successfully!';
            await loadProfile();
        } catch (error) {
            console.error('updateUserProfile failed:', error.message);
            profileError.textContent = `Failed to update profile: ${error.message}`;
        }
    });
}