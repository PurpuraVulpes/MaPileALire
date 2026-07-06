// ===== DONNÉES =====
let books = JSON.parse(localStorage.getItem('myBookPile')) || [];
let wishlist = JSON.parse(localStorage.getItem('myBookWishlist')) || [];
let currentFilter = 'all';
let wishlistFilter = 'all';
let ratingBookId = null;
let selectedRating = 0;
let transferBookId = null;

let settings = JSON.parse(localStorage.getItem('myBookPileSettings')) || {
    theme: 'purple',
    particles: true,
    animations: true
};

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
    applySettings();
    createParticles();
    renderBooks();
    renderWishlist();
    updateStats();
    updateRandomGenreFilter();

    document.getElementById('addBookForm').addEventListener('submit', addBook);
    document.getElementById('addWishlistForm').addEventListener('submit', addWishlistItem);
});

// ===== SETTINGS =====
function applySettings() {
    document.documentElement.setAttribute('data-theme', settings.theme);
    updateActiveThemeCard();

    document.getElementById('toggleParticles').checked = settings.particles;
    const particlesEl = document.getElementById('particles');
    particlesEl.classList.toggle('hidden', !settings.particles);

    document.getElementById('toggleAnimations').checked = settings.animations;
    document.body.classList.toggle('no-animations', !settings.animations);
}

function saveSettings() {
    localStorage.setItem('myBookPileSettings', JSON.stringify(settings));
}

// ===== NAV =====
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
        card.classList.toggle('active', card.getAttribute('data-theme-btn') === settings.theme);
    });
}

// ===== TOGGLES =====
function toggleParticles() {
    settings.particles = document.getElementById('toggleParticles').checked;
    document.getElementById('particles').classList.toggle('hidden', !settings.particles);
    saveSettings();
}

function toggleAnimations() {
    settings.animations = document.getElementById('toggleAnimations').checked;
    document.body.classList.toggle('no-animations', !settings.animations);
    saveSettings();
}

// ===== EXPORT / IMPORT =====
function exportData() {
    const data = { books, wishlist, settings };
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
    reader.onload = function (e) {
        try {
            const data = JSON.parse(e.target.result);
            if (data.books && Array.isArray(data.books)) {
                books = data.books;
                saveBooks();
            }
            if (data.wishlist && Array.isArray(data.wishlist)) {
                wishlist = data.wishlist;
                saveWishlist();
            }
            if (data.settings) {
                settings = { ...settings, ...data.settings };
                saveSettings();
                applySettings();
            }
            renderBooks();
            renderWishlist();
            updateStats();
            updateRandomGenreFilter();
            showToast('📥 Données importées avec succès !');
        } catch (err) {
            showToast('❌ Fichier invalide !');
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

function clearAllData() {
    if (confirm('⚠️ Supprimer TOUS les livres ET la wishlist ? Cette action est irréversible.')) {
        books = [];
        wishlist = [];
        saveBooks();
        saveWishlist();
        renderBooks();
        renderWishlist();
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

// ============================================================
//  BIBLIOTHÈQUE
// ============================================================

function addBook(e) {
    e.preventDefault();
    const title = document.getElementById('bookTitle').value.trim();
    const author = document.getElementById('bookAuthor').value.trim();
    const genre = document.getElementById('bookGenre').value;
    if (!title || !author) return;

    books.push({
        id: Date.now(),
        title, author, genre,
        status: 'toRead',
        rating: 0,
        review: '',
        dateAdded: new Date().toLocaleDateString('fr-FR'),
        dateRead: null
    });

    saveBooks();
    renderBooks();
    updateStats();
    updateRandomGenreFilter();
    document.getElementById('addBookForm').reset();
    showToast(`📥 "${title}" ajouté à la pile !`);
}

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
            </div>`;
        return;
    }

    filtered.sort((a, b) => {
        if (a.status === 'toRead' && b.status === 'read') return -1;
        if (a.status === 'read' && b.status === 'toRead') return 1;
        if (a.status === 'read' && b.status === 'read') return b.rating - a.rating;
        return 0;
    });

    container.innerHTML = filtered.map(book => {
        const starsHtml = book.rating > 0 ? `<div class="stars">${'★'.repeat(book.rating)}${'☆'.repeat(5 - book.rating)}</div>` : '';
        const reviewHtml = book.review ? `<div class="review">"${book.review}"</div>` : '';
        const statusClass = book.status === 'read' ? 'read' : 'to-read';
        const statusLabel = book.status === 'read' ? '✅ Lu' : '📖 À lire';

        return `
            <div class="book-card ${statusClass}">
                <button class="delete-icon" onclick="deleteBook(${book.id})" title="Supprimer">🗑</button>
                <h3>${book.title}</h3>
                <p class="author">par ${book.author}</p>
                <span class="genre-tag">${book.genre}</span>
                <span class="status-badge ${statusClass}">${statusLabel}</span>
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
            </div>`;
    }).join('');
}

function filterBooks(filter, btn) {
    currentFilter = filter;
    document.querySelectorAll('#page-home .filter-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderBooks();
}

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

// ===== RATING MODAL =====
function openRatingModal(id) {
    ratingBookId = id;
    selectedRating = 0;
    const book = books.find(b => b.id === id);
    if (!book) return;
    document.getElementById('modalBookTitle').textContent = book.title;
    document.getElementById('bookReview').value = book.review || '';
    if (book.rating > 0) selectedRating = book.rating;
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
    document.querySelectorAll('#starsInput .star-btn').forEach((star, i) => {
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

// ===== RANDOM =====
function pickRandomBook() {
    const genreFilter = document.getElementById('randomGenreFilter').value;
    let candidates = books.filter(b => b.status === 'toRead');
    if (genreFilter !== 'all') candidates = candidates.filter(b => b.genre === genreFilter);

    const resultDiv = document.getElementById('randomResult');
    const btn = document.getElementById('randomBtn');

    if (candidates.length === 0) {
        resultDiv.innerHTML = `
            <div class="random-card">
                <h3>😅 Aucun livre à lire !</h3>
                <p class="author">Ajoute des livres à ta pile d'abord.</p>
            </div>`;
        return;
    }

    btn.disabled = true;
    btn.textContent = '🎰 Sélection en cours...';
    let spins = 0;
    const maxSpins = 15;

    const interval = setInterval(() => {
        const r = candidates[Math.floor(Math.random() * candidates.length)];
        resultDiv.innerHTML = `
            <div class="random-card spinning">
                <h3>${r.title}</h3>
                <p class="author">par ${r.author}</p>
            </div>`;
        spins++;

        if (spins >= maxSpins) {
            clearInterval(interval);
            const chosen = candidates[Math.floor(Math.random() * candidates.length)];
            resultDiv.innerHTML = `
                <div class="random-card">
                    <h3>🎉 ${chosen.title}</h3>
                    <p class="author">par ${chosen.author}</p>
                    <span class="genre-tag">${chosen.genre}</span>
                </div>`;
            btn.disabled = false;
            btn.textContent = '🎰 Choisir un livre au hasard';
            showToast(`🎲 "${chosen.title}" a été choisi !`);
        }
    }, 100);
}

function updateRandomGenreFilter() {
    const select = document.getElementById('randomGenreFilter');
    const genres = [...new Set(books.filter(b => b.status === 'toRead').map(b => b.genre))];
    select.innerHTML = '<option value="all">Tous les genres</option>';
    genres.forEach(g => { select.innerHTML += `<option value="${g}">${g}</option>`; });
}

// ============================================================
//  WISHLIST
// ============================================================

function addWishlistItem(e) {
    e.preventDefault();
    const title = document.getElementById('wishTitle').value.trim();
    const author = document.getElementById('wishAuthor').value.trim();
    const genre = document.getElementById('wishGenre').value;
    const price = parseFloat(document.getElementById('wishPrice').value) || 0;
    const priority = parseInt(document.getElementById('wishPriority').value);
    const notes = document.getElementById('wishNotes').value.trim();

    if (!title || !author) return;

    wishlist.push({
        id: Date.now(),
        title, author, genre, price, priority, notes,
        status: 'toBuy',
        dateAdded: new Date().toLocaleDateString('fr-FR'),
        dateBought: null
    });

    saveWishlist();
    renderWishlist();
    updateStats();
    document.getElementById('addWishlistForm').reset();
    showToast(`🛒 "${title}" ajouté à la liste d'achats !`);
}

function renderWishlist() {
    const container = document.getElementById('wishlistList');
    const searchQuery = document.getElementById('wishSearchInput').value.toLowerCase();

    let filtered = wishlist.filter(item => {
        const matchFilter = wishlistFilter === 'all' ||
            (wishlistFilter === 'toBuy' && item.status === 'toBuy') ||
            (wishlistFilter === 'bought' && item.status === 'bought');
        const matchSearch = item.title.toLowerCase().includes(searchQuery) ||
            item.author.toLowerCase().includes(searchQuery) ||
            item.genre.toLowerCase().includes(searchQuery);
        return matchFilter && matchSearch;
    });

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="emoji">🛒</span>
                <p>Aucun livre dans ta liste d'achats.<br>Ajoute ceux que tu veux acquérir !</p>
            </div>`;
        return;
    }

    // Tri : à acheter d'abord (priorité haute en premier), puis achetés
    filtered.sort((a, b) => {
        if (a.status === 'toBuy' && b.status === 'bought') return -1;
        if (a.status === 'bought' && b.status === 'toBuy') return 1;
        if (a.status === 'toBuy' && b.status === 'toBuy') return b.priority - a.priority;
        return 0;
    });

    container.innerHTML = filtered.map(item => {
        const statusClass = item.status === 'bought' ? 'wish-bought' : 'wish-to-buy';
        const statusLabel = item.status === 'bought' ? '✅ Acheté' : '📋 À acheter';

        const priorityLabels = { 3: '🔴 Haute', 2: '🟡 Moyenne', 1: '🟢 Basse' };
        const priorityClasses = { 3: 'high', 2: 'medium', 1: 'low' };

        const priceHtml = item.price > 0 ? `<span class="price-tag">${item.price.toFixed(2)} €</span>` : '';
        const notesHtml = item.notes ? `<p class="wish-notes">📝 ${item.notes}</p>` : '';

        return `
            <div class="book-card ${statusClass}">
                <button class="delete-icon" onclick="deleteWishlistItem(${item.id})" title="Supprimer">🗑</button>
                <h3>${item.title}</h3>
                <p class="author">par ${item.author}</p>
                <span class="genre-tag">${item.genre}</span>
                <span class="status-badge ${statusClass}">${statusLabel}</span>
                ${priceHtml}
                <span class="priority-tag ${priorityClasses[item.priority]}">${priorityLabels[item.priority]}</span>
                ${notesHtml}
                <div class="actions">
                    ${item.status === 'toBuy'
                ? `<button class="btn-bought" onclick="markAsBought(${item.id})">✅ Acheté</button>
                           <button class="btn-transfer" onclick="openTransferModal(${item.id})">📚 → Bibliothèque</button>`
                : `<button class="btn-unbuy" onclick="markAsUnbought(${item.id})">🛒 Remettre à acheter</button>
                           <button class="btn-transfer" onclick="openTransferModal(${item.id})">📚 → Bibliothèque</button>`
            }
                </div>
            </div>`;
    }).join('');
}

function filterWishlist(filter, btn) {
    wishlistFilter = filter;
    document.querySelectorAll('#page-wishlist .filter-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderWishlist();
}

function markAsBought(id) {
    const item = wishlist.find(i => i.id === id);
    if (item) {
        item.status = 'bought';
        item.dateBought = new Date().toLocaleDateString('fr-FR');
        saveWishlist();
        renderWishlist();
        updateStats();
        showToast(`✅ "${item.title}" marqué comme acheté !`);
    }
}

function markAsUnbought(id) {
    const item = wishlist.find(i => i.id === id);
    if (item) {
        item.status = 'toBuy';
        item.dateBought = null;
        saveWishlist();
        renderWishlist();
        updateStats();
        showToast(`🛒 "${item.title}" remis dans la liste !`);
    }
}

function deleteWishlistItem(id) {
    const item = wishlist.find(i => i.id === id);
    if (item && confirm(`Supprimer "${item.title}" de la liste d'achats ?`)) {
        wishlist = wishlist.filter(i => i.id !== id);
        saveWishlist();
        renderWishlist();
        updateStats();
        showToast(`🗑 "${item.title}" supprimé de la wishlist.`);
    }
}

// ===== TRANSFER MODAL =====
function openTransferModal(id) {
    transferBookId = id;
    const item = wishlist.find(i => i.id === id);
    if (!item) return;
    document.getElementById('transferBookTitle').textContent = `${item.title} — par ${item.author}`;
    document.getElementById('removeFromWishlist').checked = true;
    document.getElementById('transferModal').classList.add('active');
}

function closeTransferModal() {
    document.getElementById('transferModal').classList.remove('active');
    transferBookId = null;
}

function confirmTransfer() {
    const item = wishlist.find(i => i.id === transferBookId);
    if (!item) return;

    // Vérifier si le livre existe déjà dans la bibliothèque
    const exists = books.some(b =>
        b.title.toLowerCase() === item.title.toLowerCase() &&
        b.author.toLowerCase() === item.author.toLowerCase()
    );

    if (exists) {
        showToast(`⚠️ "${item.title}" est déjà dans ta bibliothèque !`);
        closeTransferModal();
        return;
    }

    // Ajouter à la bibliothèque
    books.push({
        id: Date.now(),
        title: item.title,
        author: item.author,
        genre: item.genre,
        status: 'toRead',
        rating: 0,
        review: '',
        dateAdded: new Date().toLocaleDateString('fr-FR'),
        dateRead: null
    });

    // Retirer de la wishlist si coché
    const removeFromWish = document.getElementById('removeFromWishlist').checked;
    if (removeFromWish) {
        wishlist = wishlist.filter(i => i.id !== transferBookId);
        saveWishlist();
        renderWishlist();
    } else {
        // Marquer comme acheté
        item.status = 'bought';
        item.dateBought = new Date().toLocaleDateString('fr-FR');
        saveWishlist();
        renderWishlist();
    }

    saveBooks();
    renderBooks();
    updateStats();
    updateRandomGenreFilter();
    showToast(`📚 "${item.title}" transféré à la bibliothèque !`);
    closeTransferModal();
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

    // Wishlist stats
    const wishTotal = wishlist.filter(i => i.status === 'toBuy').length;
    const wishBought = wishlist.filter(i => i.status === 'bought').length;
    const budget = wishlist.filter(i => i.status === 'toBuy').reduce((s, i) => s + i.price, 0);
    const spent = wishlist.filter(i => i.status === 'bought').reduce((s, i) => s + i.price, 0);

    document.getElementById('wishlistCount').textContent = wishTotal;
    document.getElementById('wishlistTotal').textContent = wishTotal;
    document.getElementById('wishlistBought').textContent = wishBought;
    document.getElementById('wishlistBudget').textContent = budget.toFixed(2) + ' €';
    document.getElementById('wishlistSpent').textContent = spent.toFixed(2) + ' €';
}

// ===== SAUVEGARDE =====
function saveBooks() {
    localStorage.setItem('myBookPile', JSON.stringify(books));
}

function saveWishlist() {
    localStorage.setItem('myBookWishlist', JSON.stringify(wishlist));
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
