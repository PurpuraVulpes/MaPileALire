// ===== DONNÉES =====
let books = JSON.parse(localStorage.getItem('myBookPile')) || [];
let currentFilter = 'all';
let ratingBookId = null;
let selectedRating = 0;

// ===== SETTINGS =====
let settings = JSON.parse(localStorage.getItem('myBookPileSettings')) || {
    theme: 'purple',
    particles: true,
    animations: true
};

// ===== INITIALISATION =====
document.addEventListener('DOMContentLoaded', () => {
    applySettings();
    createParticles();
    renderBooks();
    updateStats();
    updateRandomGenreFilter();

    document.getElementById('addBookForm').addEventListener('submit', addBook);
});

// ===== APPLIQUER SETTINGS =====
function applySettings() {
    // Thème
    document.documentElement.setAttribute('data-theme', settings.theme);
    updateActiveThemeCard();

    // Particules
    document.getElementById('toggleParticles').checked = settings.particles;
    const particlesEl = document.getElementById('particles');
    if (settings.particles) {
        particlesEl.classList.remove('hidden');
    } else {
        particlesEl.classList.add('hidden');
    }

    // Animations
    document.getElementById('toggleAnimations').checked = settings.animations;
    if (settings.animations) {
        document.body.classList.remove('no-animations');
    } else {
        document.body.classList.add('no-animations');
    }
}

function saveSettings() {
    localStorage.setItem('myBookPileSettings', JSON.stringify(settings));
}

// ===== NAVIGATION ONGLETS =====
function switchTab(tab, btn) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

    document.getElementById('page-' + tab).classList.add('active');
    btn.classList.add('active');
}

// ===== THÈMES =====
function setTheme(theme) {
    settings.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    updateActiveThemeCard();
    saveSettings();
    showToast(`🎨 Thème "${theme}" appliqué !`);
}

function updateActiveThemeCard() {
    document.querySelectorAll('.theme-card').forEach(card => {
        card.classList.remove('active');
        if (card.getAttribute('data-theme-btn') === settings.theme) {
            card.classList.add('active');
        }
    });
}

// ===== TOGGLES =====
function toggleParticles() {
    settings.particles = document.getElementById('toggleParticles').checked;
    const particlesEl = document.getElementById('particles');
    if (settings.particles) {
        particlesEl.classList.remove('hidden');
    } else {
        particlesEl.classList.add('hidden');
    }
    saveSettings();
}

function toggleAnimations() {
    settings.animations = document.getElementById('toggleAnimations').checked;
    if (settings.animations) {
        document.body.classList.remove('no-animations');
    } else {
        document.body.classList.add('no-animations');
    }
    saveSettings();
}

// ===== EXPORT / IMPORT =====
function exportData() {
    const data = {
        books: books,
        settings: settings
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ma-pile-a-livres.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('📤 Données exportées !');
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (data.books && Array.isArray(data.books)) {
                books = data.books;
                saveBooks();
                renderBooks();
                updateStats();
                updateRandomGenreFilter();
            }
            if (data.settings) {
                settings = { ...settings, ...data.settings };
                saveSettings();
                applySettings();
            }
            showToast('📥 Données importées avec succès !');
        } catch (err) {
            showToast('❌ Fichier invalide !');
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

function clearAllData() {
    if (confirm('⚠️ Supprimer TOUS les livres ? Cette action est irréversible.')) {
        books = [];
        saveBooks();
        renderBooks();
        updateStats();
        updateRandomGenreFilter();
        showToast('🗑️ Toutes les données ont été supprimées.');
    }
}

// ===== PARTICULES =====
function createParticles() {
    const container = document.getElementById('particles');
    for (let i = 0; i < 50; i++) {
        const particle = document.createElement('div');
        particle.classList.add('particle');
        const size = Math.random() * 6 + 2;
        particle.style.width = size + 'px';
        particle.style.height = size + 'px';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.animationDuration = (Math.random() * 15 + 10) + 's';
        particle.style.animationDelay = (Math.random() * 10) + 's';
        container.appendChild(particle);
    }
}

// ===== AJOUTER UN LIVRE =====
function addBook(e) {
    e.preventDefault();

    const title = document.getElementById('bookTitle').value.trim();
    const author = document.getElementById('bookAuthor').value.trim();
    const genre = document.getElementById('bookGenre').value;

    if (!title || !author) return;

    const book = {
        id: Date.now(),
        title,
        author,
        genre,
        status: 'toRead',
        rating: 0,
        review: '',
        dateAdded: new Date().toLocaleDateString('fr-FR'),
        dateRead: null
    };

    books.push(book);
    saveBooks();
    renderBooks();
    updateStats();
    updateRandomGenreFilter();

    document.getElementById('addBookForm').reset();
    showToast(`📥 "${title}" ajouté à la pile !`);
}

// ===== AFFICHER LES LIVRES =====
function renderBooks() {
    const container = document.getElementById('booksList');
    const searchQuery = document.getElementById('searchInput').value.toLowerCase();

    let filtered = books.filter(book => {
        const matchFilter = currentFilter === 'all' ||
            (currentFilter === 'toRead' && book.status === 'toRead') ||
            (currentFilter === 'read' && book.status === 'read');
        const matchSearch = book.title.toLowerCase().includes(searchQuery) ||
            book.author.toLowerCase().includes(searchQuery) ||
            book.genre.toLowerCase().includes(searchQuery);
        return matchFilter && matchSearch;
    });

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="emoji">📭</span>
                <p>Aucun livre trouvé.<br>Commence par en ajouter un !</p>
            </div>
        `;
        return;
    }

    filtered.sort((a, b) => {
        if (a.status === 'toRead' && b.status === 'read') return -1;
        if (a.status === 'read' && b.status === 'toRead') return 1;
        if (a.status === 'read' && b.status === 'read') return b.rating - a.rating;
        return 0;
    });

    container.innerHTML = filtered.map(book => {
        const starsHtml = book.rating > 0
            ? `<div class="stars">${'★'.repeat(book.rating)}${'☆'.repeat(5 - book.rating)}</div>`
            : '';

        const reviewHtml = book.review
            ? `<div class="review">"${book.review}"</div>`
            : '';

        const statusClass = book.status === 'read' ? 'read' : 'to-read';
        const statusLabel = book.status === 'read' ? '✅ Lu' : '📖 À lire';
        const statusBadgeClass = book.status === 'read' ? 'read' : 'to-read';

        return `
            <div class="book-card ${statusClass}">
                <button class="delete-icon" onclick="deleteBook(${book.id})" title="Supprimer">🗑</button>
                <h3>${book.title}</h3>
                <p class="author">par ${book.author}</p>
                <span class="genre-tag">${book.genre}</span>
                <span class="status-badge ${statusBadgeClass}">${statusLabel}</span>
                ${starsHtml}
                ${reviewHtml}
                <div class="actions">
                    ${book.status === 'toRead'
                        ? `<button class="btn-mark-read" onclick="markAsRead(${book.id})">✅ Marquer lu</button>`
                        : `<button class="btn-unread" onclick="markAsUnread(${book.id})">📖 Remettre à lire</button>`
                    }
                    ${book.status === 'read'
                        ? `<button class="btn-rate" onclick="openRatingModal(${book.id})">⭐ ${book.rating > 0 ? 'Modifier note' : 'Noter'}</button>`
                        : ''
                    }
                </div>
            </div>
        `;
    }).join('');
}

// ===== FILTRES =====
function filterBooks(filter, btn) {
    currentFilter = filter;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderBooks();
}

// ===== MARQUER COMME LU =====
function markAsRead(id) {
    const book = books.find(b => b.id === id);
    if (book) {
        book.status = 'read';
        book.dateRead = new Date().toLocaleDateString('fr-FR');
        saveBooks();
        renderBooks();
        updateStats();
        showToast(`✅ "${book.title}" marqué comme lu !`);
        setTimeout(() => openRatingModal(id), 400);
    }
}

// ===== REMETTRE À LIRE =====
function markAsUnread(id) {
    const book = books.find(b => b.id === id);
    if (book) {
        book.status = 'toRead';
        book.rating = 0;
        book.review = '';
        book.dateRead = null;
        saveBooks();
        renderBooks();
        updateStats();
        showToast(`📖 "${book.title}" remis dans la pile !`);
    }
}

// ===== SUPPRIMER =====
function deleteBook(id) {
    const book = books.find(b => b.id === id);
    if (book && confirm(`Supprimer "${book.title}" ?`)) {
        books = books.filter(b => b.id !== id);
        saveBooks();
        renderBooks();
        updateStats();
        updateRandomGenreFilter();
        showToast(`🗑 "${book.title}" supprimé.`);
    }
}

// ===== MODAL NOTATION =====
function openRatingModal(id) {
    ratingBookId = id;
    selectedRating = 0;
    const book = books.find(b => b.id === id);
    if (!book) return;

    document.getElementById('modalBookTitle').textContent = book.title;
    document.getElementById('bookReview').value = book.review || '';

    if (book.rating > 0) {
        selectedRating = book.rating;
    }
    updateStarsDisplay();
    document.getElementById('ratingModal').classList.add('active');
}

function closeRatingModal() {
    document.getElementById('ratingModal').classList.remove('active');
    ratingBookId = null;
    selectedRating = 0;
}

function setRating(n) {
    selectedRating = n;
    updateStarsDisplay();
}

function updateStarsDisplay() {
    const stars = document.querySelectorAll('.star-btn');
    stars.forEach((star, i) => {
        star.classList.toggle('active', i < selectedRating);
    });
}

function confirmRating() {
    if (selectedRating === 0) {
        showToast('⚠️ Sélectionne au moins 1 étoile !');
        return;
    }

    const book = books.find(b => b.id === ratingBookId);
    if (book) {
        book.rating = selectedRating;
        book.review = document.getElementById('bookReview').value.trim();
        saveBooks();
        renderBooks();
        updateStats();
        showToast(`⭐ "${book.title}" noté ${selectedRating}/5 !`);
    }
    closeRatingModal();
}

// ===== SÉLECTION ALÉATOIRE =====
function pickRandomBook() {
    const genreFilter = document.getElementById('randomGenreFilter').value;
    let candidates = books.filter(b => b.status === 'toRead');

    if (genreFilter !== 'all') {
        candidates = candidates.filter(b => b.genre === genreFilter);
    }

    const resultDiv = document.getElementById('randomResult');
    const btn = document.getElementById('randomBtn');

    if (candidates.length === 0) {
        resultDiv.innerHTML = `
            <div class="random-card">
                <h3>😅 Aucun livre à lire !</h3>
                <p class="author">Ajoute des livres à ta pile d'abord.</p>
            </div>
        `;
        return;
    }

    btn.disabled = true;
    btn.textContent = '🎰 Sélection en cours...';

    let spins = 0;
    const maxSpins = 15;
    const interval = setInterval(() => {
        const randomTemp = candidates[Math.floor(Math.random() * candidates.length)];
        resultDiv.innerHTML = `
            <div class="random-card spinning">
                <h3>${randomTemp.title}</h3>
                <p class="author">par ${randomTemp.author}</p>
            </div>
        `;
        spins++;

        if (spins >= maxSpins) {
            clearInterval(interval);
            const chosen = candidates[Math.floor(Math.random() * candidates.length)];
            resultDiv.innerHTML = `
                <div class="random-card">
                    <h3>🎉 ${chosen.title}</h3>
                    <p class="author">par ${chosen.author}</p>
                    <span class="genre-tag">${chosen.genre}</span>
                </div>
            `;
            btn.disabled = false;
            btn.textContent = '🎰 Choisir un livre au hasard';
            showToast(`🎲 "${chosen.title}" a été choisi !`);
        }
    }, 100);
}

// ===== GENRE FILTER (RANDOM) =====
function updateRandomGenreFilter() {
    const select = document.getElementById('randomGenreFilter');
    const genres = [...new Set(books.filter(b => b.status === 'toRead').map(b => b.genre))];
    select.innerHTML = '<option value="all">Tous les genres</option>';
    genres.forEach(g => {
        select.innerHTML += `<option value="${g}">${g}</option>`;
    });
}

// ===== STATS =====
function updateStats() {
    const total = books.length;
    const toRead = books.filter(b => b.status === 'toRead').length;
    const read = books.filter(b => b.status === 'read').length;
    const rated = books.filter(b => b.rating > 0);
    const avg = rated.length > 0
        ? (rated.reduce((s, b) => s + b.rating, 0) / rated.length).toFixed(1)
        : '-';

    document.getElementById('totalBooks').textContent = total;
    document.getElementById('toReadBooks').textContent = toRead;
    document.getElementById('readBooks').textContent = read;
    document.getElementById('avgRating').textContent = avg;
}

// ===== SAUVEGARDE =====
function saveBooks() {
    localStorage.setItem('myBookPile', JSON.stringify(books));
}

// ===== TOAST =====
function showToast(message) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.classList.add('toast');
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}
