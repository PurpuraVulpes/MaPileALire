// ============================================================
//  MA PILE À LIVRES — SCRIPT PRINCIPAL v11.2
//  Optimisé : événements délégués, bugs corrigés, performances
// ============================================================

(function () {
    'use strict';

    // ============================================================
    //  DONNÉES & ÉTAT
    // ============================================================
    var books = loadJSON('myBookPile', []);
    var wishlist = loadJSON('myBookWishlist', []);
    var external = loadJSON('myBookExternal', []);
    var sagasMeta = loadJSON('myBookSagasMeta', {});
    var settings = loadJSON('myBookPileSettings', {
        theme: 'purple', particles: true, animations: true, font: 'Poppins'
    });
    if (!settings.font) settings.font = 'Poppins';

    var state = {
        currentFilter: 'all',
        wishlistFilter: 'all',
        sagaFilter: 'all',
        extFilter: 'all',
        ratingBookId: null,
        selectedRating: 0,
        ratingExtBookId: null,
        selectedExtRating: 0,
        transferBookId: null,
        editSagaKey: null,
        editBookId: null,
        editWishId: null,
        editExtId: null,
        currentUser: null,
        syncTimeout: null
    };

    // ============================================================
    //  HELPERS
    // ============================================================
    function $(id) { return document.getElementById(id); }

    function setText(id, value) {
        var el = $(id);
        if (el) el.textContent = value;
    }

    function getVal(id) {
        var el = $(id);
        return el ? el.value.trim() : '';
    }

    function getRawVal(id) {
        var el = $(id);
        return el ? el.value : '';
    }

    function loadJSON(key, fallback) {
        try {
            var data = JSON.parse(localStorage.getItem(key));
            return data !== null ? data : fallback;
        } catch (e) {
            return fallback;
        }
    }

    function saveJSON(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch (e) {
            console.warn('Erreur localStorage:', e);
        }
    }

    function findById(arr, id) {
        for (var i = 0; i < arr.length; i++) {
            if (arr[i].id === id) return arr[i];
        }
        return null;
    }

    function removeById(arr, id) {
        var result = [];
        for (var i = 0; i < arr.length; i++) {
            if (arr[i].id !== id) result.push(arr[i]);
        }
        return result;
    }

    function escapeHTML(str) {
        if (!str) return '';
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    function nowDateStr() {
        return new Date().toLocaleDateString('fr-FR');
    }

    function nowTimestamp() {
        return Date.now();
    }

    // ============================================================
    //  SAUVEGARDE
    // ============================================================
    function saveBooks() { saveJSON('myBookPile', books); triggerAutoSync(); }
    function saveWishlist() { saveJSON('myBookWishlist', wishlist); triggerAutoSync(); }
    function saveExternal() { saveJSON('myBookExternal', external); triggerAutoSync(); }
    function saveSagasMeta() { saveJSON('myBookSagasMeta', sagasMeta); triggerAutoSync(); }
    function saveSettings() { saveJSON('myBookPileSettings', settings); }

    // ============================================================
    //  INITIALISATION
    // ============================================================
    document.addEventListener('DOMContentLoaded', function () {
        applySettings();
        createParticles();
        renderAll();
        bindEvents();
    });

    function renderAll() {
        renderBooks();
        renderExternal();
        renderSagas();
        renderAuthors();
        renderWishlist();
        updateStats();
        updateRandomGenreFilter();
        updateSeriesSuggestions();
        updateWishSeriesSuggestions();
    }

    // ============================================================
    //  BINDING D'ÉVÉNEMENTS
    // ============================================================
    function bindEvents() {
        // Navigation
        delegateClick('.main-nav', '.nav-btn', function (btn) {
            var tab = btn.getAttribute('data-tab');
            if (tab) switchTab(tab, btn);
        });

        // Filtres
        delegateClick(document.body, '.filter-btn[data-filter]', function (btn) {
            var filter = btn.getAttribute('data-filter');
            var target = btn.getAttribute('data-target');
            if (target === 'home') filterBooks(filter, btn);
            else if (target === 'external') filterExt(filter, btn);
            else if (target === 'sagas') filterSagas(filter, btn);
            else if (target === 'wishlist') filterWishlist(filter, btn);
        });

        // Thèmes
        delegateClick(document.body, '.theme-card[data-theme-btn]', function (btn) {
            setTheme(btn.getAttribute('data-theme-btn'));
        });

        // Polices
        delegateClick(document.body, '.font-card[data-font-btn]', function (btn) {
            setFont(btn.getAttribute('data-font-btn'));
        });

        // Étoiles
        delegateClick($('starsInput'), '.star-btn', function (btn) {
            var r = parseInt(btn.getAttribute('data-rating'));
            if (r) { state.selectedRating = r; updateStarsDisplay(); }
        });

        delegateClick($('starsExtInput'), '.star-btn', function (btn) {
            var r = parseInt(btn.getAttribute('data-rating'));
            if (r) { state.selectedExtRating = r; updateExtStarsDisplay(); }
        });

        // Auth tabs
        delegateClick(document.body, '.auth-tab[data-auth-tab]', function (btn) {
            showAuthTab(btn.getAttribute('data-auth-tab'), btn);
        });

        // Formulaires
        bindForm('addBookForm', addBook);
        bindForm('addExtForm', addExternal);
        bindForm('addWishlistForm', addWishlistItem);

        // Boutons par ID
        bindClick('randomBtn', pickRandomBook);
        bindClick('confirmRatingBtn', confirmRating);
        bindClick('confirmExtRatingBtn', confirmExtRating);
        bindClick('confirmTransferBtn', confirmTransfer);
        bindClick('confirmEditSagaBtn', confirmEditSaga);
        bindClick('confirmEditBookBtn', confirmEditBook);
        bindClick('confirmEditWishBtn', confirmEditWish);
        bindClick('confirmEditExtBtn', confirmEditExt);

        // Fermeture modales
        bindClick('closeRatingModal', function () { closeModal('ratingModal'); });
        bindClick('closeRatingExtModal', function () { closeModal('ratingExtModal'); });
        bindClick('closeTransferModal', function () { closeModal('transferModal'); });
        bindClick('closeEditSagaModal', function () { closeModal('editSagaModal'); state.editSagaKey = null; });
        bindClick('closeEditBookModal', function () { closeModal('editBookModal'); state.editBookId = null; });
        bindClick('closeEditWishModal', function () { closeModal('editWishModal'); state.editWishId = null; });
        bindClick('closeEditExtModal', function () { closeModal('editExtModal'); state.editExtId = null; });

        // Fermeture modale par clic sur overlay
        var overlays = document.querySelectorAll('.modal-overlay');
        for (var i = 0; i < overlays.length; i++) {
            overlays[i].addEventListener('click', function (e) {
                if (e.target === this) this.classList.remove('active');
            });
        }

        // Fermeture par Escape
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') {
                var modals = document.querySelectorAll('.modal-overlay.active');
                for (var i = 0; i < modals.length; i++) modals[i].classList.remove('active');
            }
        });

        // Paramètres
        bindClick('btnExport', exportData);
        bindClick('btnImportTrigger', function () { var f = $('importFile'); if (f) f.click(); });
        bindClick('btnClearAll', clearAllData);

        var importFile = $('importFile');
        if (importFile) importFile.addEventListener('change', importData);

        // Toggles
        bindChange('toggleParticles', toggleParticlesF);
        bindChange('toggleAnimations', toggleAnimationsF);

        // Tri & recherche
        bindChange('bookSortSelect', renderBooks);
        bindChange('extSortSelect', renderExternal);
        bindChange('authorSortSelect', renderAuthors);
        bindInput('searchInput', renderBooks);
        bindInput('extSearchInput', renderExternal);
        bindInput('sagaSearchInput', renderSagas);
        bindInput('authorSearchInput', renderAuthors);
        bindInput('wishSearchInput', renderWishlist);

        // Dates lecture
        bindChange('bookDateStart', function () { calcReadingDays('book'); });
        bindChange('bookDateEnd', function () { calcReadingDays('book'); });
        bindChange('extDateStart', function () { calcReadingDays('ext'); });
        bindChange('extDateEnd', function () { calcReadingDays('ext'); });

        // Suggestions séries
        bindInput('bookSeries', updateSeriesSuggestions);

        // Firebase
        bindClick('btnLogin', firebaseLogin);
        bindClick('btnRegister', firebaseRegister);
        bindClick('btnSync', firebaseSync);
        bindClick('btnPullData', firebasePullData);
        bindClick('btnLogout', firebaseLogout);

        // Délégation pour actions dynamiques
        delegateClick(document.body, '[data-action]', handleDynamicAction);
    }

    function bindClick(id, fn) {
        var el = $(id);
        if (el) el.addEventListener('click', fn);
    }

    function bindChange(id, fn) {
        var el = $(id);
        if (el) el.addEventListener('change', fn);
    }

    function bindInput(id, fn) {
        var el = $(id);
        if (el) el.addEventListener('input', fn);
    }

    function bindForm(id, fn) {
        var el = $(id);
        if (el) el.addEventListener('submit', fn);
    }

    function delegateClick(parent, selector, fn) {
        if (typeof parent === 'string') {
            parent = document.querySelector(parent);
        }
        if (!parent) return;
        parent.addEventListener('click', function (e) {
            var target = e.target.closest(selector);
            if (target && parent.contains(target)) fn(target, e);
        });
    }

    // ============================================================
    //  ACTIONS DYNAMIQUES
    // ============================================================
    function handleDynamicAction(btn) {
        var action = btn.getAttribute('data-action');
        var id = parseInt(btn.getAttribute('data-id'));
        var value = btn.getAttribute('data-value');

        switch (action) {
            case 'markRead':       markAsRead(id); break;
            case 'markUnread':     markAsUnread(id); break;
            case 'deleteBook':     deleteBook(id); break;
            case 'rateBook':       openRatingModal(id); break;
            case 'editBook':       openEditBookModal(id); break;

            case 'deleteExt':      deleteExternal(id); break;
            case 'rateExt':        openRatingExtModal(id); break;
            case 'editExt':        openEditExtModal(id); break;
            case 'changeExtStatus': changeExtStatus(id, value); break;
            case 'toggleExtBuy':   toggleExtWantBuy(id); break;

            case 'deleteWish':     deleteWishlistItem(id); break;
            case 'markBought':     markAsBought(id); break;
            case 'markUnbought':   markAsUnbought(id); break;
            case 'transferWish':   openTransferModal(id); break;
            case 'editWish':       openEditWishModal(id); break;

            case 'editSaga':       openEditSagaModal(value); break;

            case 'toggleAuthor':   toggleAuthorBooks(value, btn); break;
        }
    }

    // ============================================================
    //  PARAMÈTRES
    // ============================================================
    function applySettings() {
        document.documentElement.setAttribute('data-theme', settings.theme);
        document.documentElement.style.setProperty('--main-font', settings.font || 'Poppins');
        updateActiveThemeCard();
        updateActiveFontCard();

        var tp = $('toggleParticles');
        var ta = $('toggleAnimations');
        if (tp) tp.checked = settings.particles;
        if (ta) ta.checked = settings.animations;

        var p = $('particles');
        if (p) p.classList.toggle('hidden', !settings.particles);
        document.body.classList.toggle('no-animations', !settings.animations);
    }

    function switchTab(tab, btn) {
        var pages = document.querySelectorAll('.page');
        var btns = document.querySelectorAll('.nav-btn');
        for (var i = 0; i < pages.length; i++) pages[i].classList.remove('active');
        for (var j = 0; j < btns.length; j++) btns[j].classList.remove('active');

        var target = $('page-' + tab);
        if (target) target.classList.add('active');
        if (btn) btn.classList.add('active');

        if (tab === 'authors') renderAuthors();
        else if (tab === 'sagas') renderSagas();
        else if (tab === 'external') renderExternal();
        else if (tab === 'wishlist') renderWishlist();
    }

    function setTheme(t) {
        settings.theme = t;
        document.documentElement.setAttribute('data-theme', t);
        updateActiveThemeCard();
        saveSettings();
        showToast('🎨 Thème "' + t + '" appliqué !');
    }

    function updateActiveThemeCard() {
        var cards = document.querySelectorAll('.theme-card');
        for (var i = 0; i < cards.length; i++) {
            cards[i].classList.toggle('active', cards[i].getAttribute('data-theme-btn') === settings.theme);
        }
    }

    function setFont(f) {
        settings.font = f;
        document.documentElement.style.setProperty('--main-font', f);
        updateActiveFontCard();
        saveSettings();
        showToast('🔤 Police "' + f + '" appliquée !');
    }

    function updateActiveFontCard() {
        var cards = document.querySelectorAll('.font-card');
        for (var i = 0; i < cards.length; i++) {
            cards[i].classList.toggle('active', cards[i].getAttribute('data-font-btn') === settings.font);
        }
    }

    function toggleParticlesF() {
        var el = $('toggleParticles');
        if (!el) return;
        settings.particles = el.checked;
        var p = $('particles');
        if (p) p.classList.toggle('hidden', !settings.particles);
        saveSettings();
    }

    function toggleAnimationsF() {
        var el = $('toggleAnimations');
        if (!el) return;
        settings.animations = el.checked;
        document.body.classList.toggle('no-animations', !settings.animations);
        saveSettings();
    }

    function exportData() {
        var data = { books: books, wishlist: wishlist, external: external, sagasMeta: sagasMeta, settings: settings };
        var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'ma-pile-a-livres.json';
        a.click();
        URL.revokeObjectURL(a.href);
        showToast('📤 Données exportées !');
    }

    function importData(event) {
        var file = event.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function (e) {
            try {
                var data = JSON.parse(e.target.result);
                if (data.books && Array.isArray(data.books)) { books = data.books; saveJSON('myBookPile', books); }
                if (data.wishlist && Array.isArray(data.wishlist)) { wishlist = data.wishlist; saveJSON('myBookWishlist', wishlist); }
                if (data.external && Array.isArray(data.external)) { external = data.external; saveJSON('myBookExternal', external); }
                if (data.sagasMeta && typeof data.sagasMeta === 'object') { sagasMeta = data.sagasMeta; saveJSON('myBookSagasMeta', sagasMeta); }
                if (data.settings && typeof data.settings === 'object') {
                    settings = Object.assign({}, settings, data.settings);
                    saveSettings();
                    applySettings();
                }
                renderAll();
                triggerAutoSync();
                showToast('📥 Importé !');
            } catch (err) {
                showToast('❌ Fichier invalide !');
                console.error('Import error:', err);
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    }

    function clearAllData() {
        if (!confirm('⚠️ Tout supprimer ? Irréversible.')) return;
        books = []; wishlist = []; external = []; sagasMeta = {};
        saveJSON('myBookPile', []);
        saveJSON('myBookWishlist', []);
        saveJSON('myBookExternal', []);
        saveJSON('myBookSagasMeta', {});
        renderAll();
        triggerAutoSync();
        showToast('🗑️ Tout supprimé.');
    }

    // ============================================================
    //  UTILITAIRES DATE
    // ============================================================
    function calcReadingDays(type) {
        var prefix = type === 'ext' ? 'ext' : 'book';
        var startEl = $(prefix + 'DateStart');
        var endEl = $(prefix + 'DateEnd');
        var displayEl = $(prefix + 'ReadingDays');
        if (!startEl || !endEl || !displayEl) return;

        if (!startEl.value || !endEl.value) {
            displayEl.classList.remove('active');
            return;
        }

        var start = new Date(startEl.value);
        var end = new Date(endEl.value);
        var days = Math.floor((end - start) / 86400000);

        displayEl.classList.add('active');
        displayEl.classList.remove('warning');

        if (days < 0) {
            displayEl.textContent = '⚠️ La date de fin doit être après le début !';
            displayEl.classList.add('warning');
        } else {
            var total = days + 1;
            displayEl.textContent = total === 1
                ? '⚡ Lu en 1 jour !'
                : '📖 Lu en ' + total + ' jours';
        }
    }

    function getReadingDaysText(startDate, endDate) {
        if (!startDate || !endDate) return null;
        var days = Math.floor((new Date(endDate) - new Date(startDate)) / 86400000);
        return days >= 0 ? days + 1 : null;
    }

    function formatDate(dateStr) {
        if (!dateStr) return '';
        var d = new Date(dateStr);
        return String(d.getDate()).padStart(2, '0') + '/' +
               String(d.getMonth() + 1).padStart(2, '0') + '/' +
               d.getFullYear();
    }

    // ============================================================
    //  PARTICULES
    // ============================================================
    function createParticles() {
        var c = $('particles');
        if (!c) return;
        var frag = document.createDocumentFragment();
        for (var i = 0; i < 50; i++) {
            var p = document.createElement('div');
            p.className = 'particle';
            var s = Math.random() * 6 + 2;
            p.style.cssText = 'width:' + s + 'px;height:' + s + 'px;left:' +
                (Math.random() * 100) + '%;animation-duration:' +
                (Math.random() * 15 + 10) + 's;animation-delay:' +
                (Math.random() * 10) + 's';
            frag.appendChild(p);
        }
        c.appendChild(frag);
    }

    // ============================================================
    //  GESTION DES SÉRIES
    // ============================================================
    function getSeriesKey(name) { return name.trim().toLowerCase(); }

    function getAllSeries() {
        var seriesMap = {};
        for (var i = 0; i < books.length; i++) {
            var b = books[i];
            if (!b.series || !b.series.trim()) continue;

            var key = getSeriesKey(b.series);
            if (!seriesMap[key]) {
                seriesMap[key] = {
                    key: key, name: b.series.trim(), author: b.author,
                    genre: b.genre, books: []
                };
            }
            seriesMap[key].books.push(b);
        }

        var keys = Object.keys(seriesMap);
        for (var k = 0; k < keys.length; k++) {
            var key = keys[k];
            var s = seriesMap[key];
            var meta = sagasMeta[key] || {};

            s.books.sort(function (a, b) { return (a.tome || 999) - (b.tome || 999); });

            var readCount = 0;
            for (var j = 0; j < s.books.length; j++) {
                if (s.books[j].status === 'read') readCount++;
            }

            s.totalTomes = meta.totalTomes || s.books.length;
            s.readCount = readCount;
            s.ownedCount = s.books.length;
            s.progress = s.totalTomes > 0 ? Math.round((readCount / s.totalTomes) * 100) : 0;
            s.isCompleted = readCount >= s.totalTomes && s.totalTomes > 0;
            s.isStarted = readCount > 0;
        }
        return seriesMap;
    }

    function updateSeriesSuggestions() {
        var datalist = $('seriesSuggestions');
        if (!datalist) return;

        var allSeries = getAllSeries();
        var names = [];
        var values = Object.keys(allSeries);
        for (var i = 0; i < values.length; i++) {
            var n = allSeries[values[i]].name;
            if (names.indexOf(n) === -1) names.push(n);
        }

        var html = '';
        for (var j = 0; j < names.length; j++) {
            html += '<option value="' + escapeHTML(names[j]) + '">';
        }
        datalist.innerHTML = html;

        var input = $('bookSeries');
        if (input && input.value.trim()) {
            var key = getSeriesKey(input.value);
            var meta = sagasMeta[key];
            if (meta && meta.totalTomes) {
                var totInput = $('bookTotalTomes');
                if (totInput && !totInput.value) totInput.value = meta.totalTomes;
            }
        }
    }

    function updateWishSeriesSuggestions() {
        var datalist = $('wishSeriesSuggestions');
        if (!datalist) return;

        var allSeries = getAllSeries();
        var names = [];
        var values = Object.keys(allSeries);
        for (var i = 0; i < values.length; i++) {
            var n = allSeries[values[i]].name;
            if (names.indexOf(n) === -1) names.push(n);
        }
        for (var j = 0; j < wishlist.length; j++) {
            if (wishlist[j].series && names.indexOf(wishlist[j].series) === -1) {
                names.push(wishlist[j].series);
            }
        }

        var html = '';
        for (var k = 0; k < names.length; k++) {
            html += '<option value="' + escapeHTML(names[k]) + '">';
        }
        datalist.innerHTML = html;
    }

    // ============================================================
    //  FORMAT & SOURCE HELPERS
    // ============================================================
    var FORMAT_ICONS = { 'Broché': '📕', 'Poche': '📒', 'Collector': '✨', 'Relié': '📗', 'Audiobook': '🎧' };
    var SOURCE_ICONS = { 'Bibliothèque': '🏛️', 'Internet': '💻', 'École': '🎓', 'Ma collection': '📚' };

    function getFormatHtml(format) {
        if (!format) return '';
        var icon = FORMAT_ICONS[format] || '📕';
        var cls = format.toLowerCase().replace(/[éè]/g, 'e').replace(/\s/g, '-');
        return '<span class="format-tag format-' + cls + '">' + icon + ' ' + escapeHTML(format) + '</span>';
    }

    function buildReadingHtml(item) {
        var readDays = getReadingDaysText(item.dateStart, item.dateEnd);
        if (!readDays) return '';
        var html = '<span class="reading-info">📖 Lu en ' + readDays + ' jour' + (readDays > 1 ? 's' : '') + '</span>';
        if (item.dateStart && item.dateEnd) {
            html += '<p class="reading-dates">📅 Du ' + formatDate(item.dateStart) + ' au ' + formatDate(item.dateEnd) + '</p>';
        }
        return html;
    }

    function buildStarsHtml(rating) {
        if (!rating || rating <= 0) return '';
        return '<div class="stars">' + '★'.repeat(rating) + '☆'.repeat(5 - rating) + '</div>';
    }

    function buildReviewHtml(review) {
        if (!review) return '';
        return '<div class="review">"' + escapeHTML(review) + '"</div>';
    }

    // ============================================================
    //  MODALE HELPERS
    // ============================================================
    function openModal(id) {
        var m = $(id);
        if (m) m.classList.add('active');
    }

    function closeModal(id) {
        var m = $(id);
        if (m) m.classList.remove('active');
    }

    // ============================================================
    //  BIBLIOTHÈQUE — AJOUT
    // ============================================================
    function addBook(e) {
        e.preventDefault();
        var title = getVal('bookTitle');
        var author = getVal('bookAuthor');
        var genre = getRawVal('bookGenre');
        var format = getRawVal('bookFormat');
        var series = getVal('bookSeries');
        var tome = parseInt(getRawVal('bookTome')) || null;
        var totalTomes = parseInt(getRawVal('bookTotalTomes')) || null;

        if (!title || !author) { showToast('⚠️ Titre et auteur requis !'); return; }

        books.push({
            id: nowTimestamp(), title: title, author: author, genre: genre, format: format,
            series: series || null, tome: tome,
            status: 'toRead', rating: 0, review: '',
            dateAdded: nowDateStr(), dateRead: null,
            dateStart: null, dateEnd: null
        });

        if (series) {
            var key = getSeriesKey(series);
            if (!sagasMeta[key]) sagasMeta[key] = {};
            if (totalTomes && totalTomes > 0) sagasMeta[key].totalTomes = totalTomes;
            saveSagasMeta();
        }

        saveBooks();
        renderAll();
        var form = $('addBookForm');
        if (form) form.reset();
        showToast('📥 "' + title + '" ajouté !');
    }

    // ============================================================
    //  BIBLIOTHÈQUE — RENDU
    // ============================================================
    function renderBooks() {
        var container = $('booksList');
        if (!container) return;

        var query = getVal('searchInput').toLowerCase();
        var sortBy = getRawVal('bookSortSelect') || 'default';
        var filter = state.currentFilter;

        var filtered = [];
        for (var i = 0; i < books.length; i++) {
            var b = books[i];

            var matchFilter = filter === 'all'
                || (filter === 'toRead' && b.status === 'toRead')
                || (filter === 'read' && b.status === 'read')
                || (filter === 'oneShot' && (!b.series || !b.series.trim()))
                || (filter === 'series' && b.series && b.series.trim());

            var matchSearch = !query
                || b.title.toLowerCase().indexOf(query) !== -1
                || b.author.toLowerCase().indexOf(query) !== -1
                || (b.genre && b.genre.toLowerCase().indexOf(query) !== -1)
                || (b.series && b.series.toLowerCase().indexOf(query) !== -1)
                || (b.format && b.format.toLowerCase().indexOf(query) !== -1);

            if (matchFilter && matchSearch) filtered.push(b);
        }

        filtered.sort(function (a, b) {
            switch (sortBy) {
                case 'title':     return a.title.localeCompare(b.title);
                case 'author':    return a.author.localeCompare(b.author);
                case 'rating':    return b.rating - a.rating;
                case 'series':
                    var sA = a.series || '\uffff', sB = b.series || '\uffff';
                    if (sA !== sB) return sA.localeCompare(sB);
                    return (a.tome || 999) - (b.tome || 999);
                case 'dateAdded': return b.id - a.id;
                default:
                    if (a.status !== b.status) {
                        return a.status === 'toRead' ? -1 : 1;
                    }
                    return b.rating - a.rating;
            }
        });

        if (!filtered.length) {
            container.innerHTML = '<div class="empty-state"><span class="emoji">📭</span><p>Aucun livre trouvé.</p></div>';
            return;
        }

        var parts = [];
        for (var j = 0; j < filtered.length; j++) {
            var bk = filtered[j];
            var sc = bk.status === 'read' ? 'read' : 'to-read';
            var sl = bk.status === 'read' ? '✅ Lu' : '📖 À lire';
            var sagaH = bk.series ? '<span class="saga-tag">📖 ' + escapeHTML(bk.series) + '</span>' : '';
            var tomeH = bk.tome ? '<span class="tome-tag">Tome ' + bk.tome + '</span>' : '';
            var readingH = (bk.status === 'read') ? buildReadingHtml(bk) : '';

            parts.push(
                '<div class="book-card ' + sc + '">' +
                '<button class="delete-icon" data-action="deleteBook" data-id="' + bk.id + '" type="button" aria-label="Supprimer">🗑</button>' +
                '<h3>' + escapeHTML(bk.title) + '</h3>' +
                '<p class="author">par ' + escapeHTML(bk.author) + '</p>' +
                '<span class="genre-tag">' + escapeHTML(bk.genre || 'Roman') + '</span>' +
                '<span class="status-badge ' + sc + '">' + sl + '</span>' +
                getFormatHtml(bk.format) + tomeH + sagaH + readingH +
                buildStarsHtml(bk.rating) + buildReviewHtml(bk.review) +
                '<div class="actions">' +
                (bk.status === 'toRead'
                    ? '<button data-action="markRead" data-id="' + bk.id + '" class="btn-mark-read" type="button">✅ Lu</button>'
                    : '<button data-action="markUnread" data-id="' + bk.id + '" class="btn-unread" type="button">📖 À lire</button>') +
                (bk.status === 'read'
                    ? '<button data-action="rateBook" data-id="' + bk.id + '" class="btn-rate" type="button">⭐ ' + (bk.rating > 0 ? 'Modifier note' : 'Noter') + '</button>'
                    : '') +
                '<button data-action="editBook" data-id="' + bk.id + '" class="btn-edit" type="button">✏️ Modifier</button>' +
                '</div></div>'
            );
        }
        container.innerHTML = parts.join('');
    }

    function filterBooks(f, btn) {
        state.currentFilter = f;
        var btns = document.querySelectorAll('#page-home .filter-btn');
        for (var i = 0; i < btns.length; i++) btns[i].classList.remove('active');
        if (btn) btn.classList.add('active');
        renderBooks();
    }

    function markAsRead(id) {
        var b = findById(books, id);
        if (!b) return;
        b.status = 'read';
        b.dateRead = nowDateStr();
        saveBooks();
        renderAll();
        showToast('✅ Lu !');
        setTimeout(function () { openRatingModal(id); }, 400);
    }

    function markAsUnread(id) {
        var b = findById(books, id);
        if (!b) return;
        b.status = 'toRead';
        b.rating = 0;
        b.review = '';
        b.dateRead = null;
        b.dateStart = null;
        b.dateEnd = null;
        saveBooks();
        renderAll();
        showToast('📖 Remis à lire !');
    }

    function deleteBook(id) {
        var book = findById(books, id);
        if (!book || !confirm('Supprimer "' + book.title + '" ?')) return;

        books = removeById(books, id);

        if (book.series) {
            var key = getSeriesKey(book.series);
            var hasOthers = false;
            for (var i = 0; i < books.length; i++) {
                if (books[i].series && getSeriesKey(books[i].series) === key) {
                    hasOthers = true;
                    break;
                }
            }
            if (!hasOthers) delete sagasMeta[key];
            saveSagasMeta();
        }

        saveBooks();
        renderAll();
        showToast('🗑 Supprimé.');
    }

    // ============================================================
    //  MODALE NOTATION (BIBLIO)
    // ============================================================
    function openRatingModal(id) {
        state.ratingBookId = id;
        state.selectedRating = 0;
        var b = findById(books, id);
        if (!b) return;

        setText('modalBookTitle', b.title);
        var rv = $('bookReview'); if (rv) rv.value = b.review || '';
        var ds = $('bookDateStart'); if (ds) ds.value = b.dateStart || '';
        var de = $('bookDateEnd'); if (de) de.value = b.dateEnd || '';

        if (b.rating > 0) state.selectedRating = b.rating;
        updateStarsDisplay();
        calcReadingDays('book');
        openModal('ratingModal');
    }

    function updateStarsDisplay() {
        var stars = document.querySelectorAll('#starsInput .star-btn');
        for (var i = 0; i < stars.length; i++) {
            stars[i].classList.toggle('active', i < state.selectedRating);
        }
    }

    function confirmRating() {
        if (!state.selectedRating) { showToast('⚠️ Sélectionne au moins 1 étoile !'); return; }

        var b = findById(books, state.ratingBookId);
        if (!b) return;

        b.rating = state.selectedRating;
        b.review = getVal('bookReview');
        b.dateStart = getRawVal('bookDateStart') || null;
        b.dateEnd = getRawVal('bookDateEnd') || null;

        saveBooks();
        renderAll();
        showToast('⭐ Noté ' + state.selectedRating + '/5 !');
        closeModal('ratingModal');
    }

    // ============================================================
    //  RANDOM BOOK
    // ============================================================
    function pickRandomBook() {
        var gf = getRawVal('randomGenreFilter');
        var cands = [];
        for (var i = 0; i < books.length; i++) {
            if (books[i].status === 'toRead' && (gf === 'all' || books[i].genre === gf)) {
                cands.push(books[i]);
            }
        }

        var rd = $('randomResult');
        var btn = $('randomBtn');
        if (!rd || !btn) return;

        if (!cands.length) {
            rd.innerHTML = '<div class="random-card"><h3>😅 Aucun livre à lire !</h3></div>';
            return;
        }

        btn.disabled = true;
        btn.textContent = '🎰 Sélection...';
        var spins = 0;

        var iv = setInterval(function () {
            var r = cands[Math.floor(Math.random() * cands.length)];
            rd.innerHTML = '<div class="random-card spinning"><h3>' + escapeHTML(r.title) + '</h3><p class="author">par ' + escapeHTML(r.author) + '</p></div>';
            spins++;

            if (spins >= 15) {
                clearInterval(iv);
                var ch = cands[Math.floor(Math.random() * cands.length)];
                rd.innerHTML =
                    '<div class="random-card">' +
                    '<h3>🎉 ' + escapeHTML(ch.title) + '</h3>' +
                    '<p class="author">par ' + escapeHTML(ch.author) + '</p>' +
                    '<span class="genre-tag">' + escapeHTML(ch.genre) + '</span>' +
                    (ch.series ? '<br><span class="saga-tag">📖 ' + escapeHTML(ch.series) + (ch.tome ? ' - T' + ch.tome : '') + '</span>' : '') +
                    '</div>';
                btn.disabled = false;
                btn.textContent = '🎰 Choisir au hasard';
                showToast('🎲 "' + ch.title + '" choisi !');
            }
        }, 100);
    }

    function updateRandomGenreFilter() {
        var s = $('randomGenreFilter');
        if (!s) return;
        var genres = [];
        for (var i = 0; i < books.length; i++) {
            if (books[i].status === 'toRead' && genres.indexOf(books[i].genre) === -1) {
                genres.push(books[i].genre);
            }
        }
        var html = '<option value="all">Tous</option>';
        for (var j = 0; j < genres.length; j++) {
            html += '<option value="' + escapeHTML(genres[j]) + '">' + escapeHTML(genres[j]) + '</option>';
        }
        s.innerHTML = html;
    }

    // ============================================================
    //  LIVRES EXTERNES
    // ============================================================
    function addExternal(e) {
        e.preventDefault();
        var title = getVal('extTitle');
        var author = getVal('extAuthor');
        if (!title || !author) { showToast('⚠️ Titre et auteur requis !'); return; }

        var genre = getRawVal('extGenre');
        var source = getRawVal('extSource');
        var series = getVal('extSeries');
        var tome = parseInt(getRawVal('extTome')) || null;
        var totalTomes = parseInt(getRawVal('extTotalTomes')) || null;
        var status = getRawVal('extStatus');
        var notes = getVal('extNotes');
        var wtb = $('extWantToBuy');
        var wantToBuy = wtb ? wtb.checked : false;

        var extId = nowTimestamp();
        external.push({
            id: extId, title: title, author: author, genre: genre, source: source,
            series: series || null, tome: tome, totalTomes: totalTomes,
            status: status, notes: notes,
            wantToBuy: wantToBuy, rating: 0, review: '',
            dateAdded: nowDateStr(), dateStart: null, dateEnd: null
        });

        if (wantToBuy) {
            addToWishlistFromExternal(extId, title, author, genre, series, tome, notes);
        }

        saveExternal();
        renderAll();
        var form = $('addExtForm');
        if (form) form.reset();
        showToast(wantToBuy ? '📖 "' + title + '" ajouté + 🛒 wishlist !' : '📖 "' + title + '" ajouté !');
    }

    function addToWishlistFromExternal(extId, title, author, genre, series, tome, notes) {
        for (var i = 0; i < wishlist.length; i++) {
            if (wishlist[i].title.toLowerCase() === title.toLowerCase() &&
                wishlist[i].author.toLowerCase() === author.toLowerCase()) {
                return;
            }
        }
        wishlist.push({
            id: nowTimestamp() + 1, title: title, author: author, genre: genre,
            format: 'Broché', price: 0, priority: 2,
            notes: notes ? ('Vient de "empruntés" : ' + notes) : 'Vient de "empruntés"',
            series: series || null, tome: tome, status: 'toBuy',
            dateAdded: nowDateStr(), dateBought: null,
            fromExternal: extId
        });
        saveWishlist();
    }

    function renderExternal() {
        var container = $('externalList');
        if (!container) return;

        var query = getVal('extSearchInput').toLowerCase();
        var sortBy = getRawVal('extSortSelect') || 'default';
        var filter = state.extFilter;

        var filtered = [];
        for (var i = 0; i < external.length; i++) {
            var e = external[i];
            var matchFilter = filter === 'all'
                || (filter === 'returned' && e.status === 'returned')
                || (filter === 'given' && e.status === 'given')
                || (filter === 'kept' && e.status === 'kept')
                || (filter === 'wantToBuy' && e.wantToBuy);

            var matchSearch = !query
                || e.title.toLowerCase().indexOf(query) !== -1
                || e.author.toLowerCase().indexOf(query) !== -1
                || (e.genre && e.genre.toLowerCase().indexOf(query) !== -1)
                || (e.series && e.series.toLowerCase().indexOf(query) !== -1)
                || (e.source && e.source.toLowerCase().indexOf(query) !== -1);

            if (matchFilter && matchSearch) filtered.push(e);
        }

        filtered.sort(function (a, b) {
            switch (sortBy) {
                case 'title':     return a.title.localeCompare(b.title);
                case 'author':    return a.author.localeCompare(b.author);
                case 'rating':    return b.rating - a.rating;
                case 'source':    return (a.source || '').localeCompare(b.source || '');
                case 'dateAdded': return b.id - a.id;
                default:
                    var order = { 'returned': 0, 'given': 1, 'kept': 2 };
                    return (order[a.status] || 99) - (order[b.status] || 99);
            }
        });

        updateExtStats();

        if (!filtered.length) {
            container.innerHTML = '<div class="empty-state"><span class="emoji">📖</span><p>Aucun livre externe.</p></div>';
            return;
        }

        var statusLabels = { 'returned': '📤 Retiré', 'given': '🎁 Rendu', 'kept': '📚 Laissé' };
        var statusClasses = { 'returned': 'ext-returned', 'given': 'ext-given', 'kept': 'ext-kept' };
        var parts = [];

        for (var j = 0; j < filtered.length; j++) {
            var it = filtered[j];
            var sc = statusClasses[it.status] || 'ext-returned';
            var sourceIcon = SOURCE_ICONS[it.source] || '📚';
            var tomeDisplay = it.tome ? 'Tome ' + it.tome + (it.totalTomes ? '/' + it.totalTomes : '') : '';

            parts.push(
                '<div class="book-card ' + sc + '">' +
                '<button class="delete-icon" data-action="deleteExt" data-id="' + it.id + '" type="button" aria-label="Supprimer">🗑</button>' +
                '<h3>' + escapeHTML(it.title) + '</h3>' +
                '<p class="author">par ' + escapeHTML(it.author) + '</p>' +
                '<div class="wish-tags">' +
                '<span class="genre-tag">' + escapeHTML(it.genre) + '</span>' +
                '<span class="status-badge ' + sc + '">' + (statusLabels[it.status] || '📖') + '</span>' +
                (it.source ? '<span class="source-tag">' + sourceIcon + ' ' + escapeHTML(it.source) + '</span>' : '') +
                (tomeDisplay ? '<span class="tome-tag">' + tomeDisplay + '</span>' : '') +
                (it.series ? '<span class="saga-tag">📖 ' + escapeHTML(it.series) + '</span>' : '') +
                (it.wantToBuy ? '<span class="want-buy-badge">🛒 À acheter</span>' : '') +
                '</div>' +
                buildReadingHtml(it) + buildStarsHtml(it.rating) + buildReviewHtml(it.review) +
                (it.notes ? '<p class="wish-notes">📝 ' + escapeHTML(it.notes) + '</p>' : '') +
                '<div class="actions">' +
                '<button data-action="rateExt" data-id="' + it.id + '" class="btn-rate" type="button">⭐ ' + (it.rating > 0 ? 'Modifier note' : 'Noter') + '</button>' +
                (it.status !== 'returned' ? '<button data-action="changeExtStatus" data-id="' + it.id + '" data-value="returned" class="btn-returned" type="button">📤 Retiré</button>' : '') +
                (it.status !== 'given' ? '<button data-action="changeExtStatus" data-id="' + it.id + '" data-value="given" class="btn-given" type="button">🎁 Rendu</button>' : '') +
                (it.status !== 'kept' ? '<button data-action="changeExtStatus" data-id="' + it.id + '" data-value="kept" class="btn-kept" type="button">📚 Laissé</button>' : '') +
                '<button data-action="toggleExtBuy" data-id="' + it.id + '" class="btn-want-buy" type="button">' + (it.wantToBuy ? '❌ Retirer wishlist' : '🛒 Ajouter wishlist') + '</button>' +
                '<button data-action="editExt" data-id="' + it.id + '" class="btn-edit" type="button">✏️ Modifier</button>' +
                '</div></div>'
            );
        }
        container.innerHTML = parts.join('');
    }

    function updateExtStats() {
        var ratedSum = 0, ratedCount = 0, toBuyCount = 0;
        var returnedCount = 0, givenCount = 0, keptCount = 0, tomesCount = 0;
        var extSeriesSet = {};

        for (var i = 0; i < external.length; i++) {
            var e = external[i];
            if (e.status === 'returned') returnedCount++;
            else if (e.status === 'given') givenCount++;
            else if (e.status === 'kept') keptCount++;
            if (e.rating > 0) { ratedSum += e.rating; ratedCount++; }
            if (e.wantToBuy) toBuyCount++;
            if (e.series && e.series.trim()) {
                extSeriesSet[e.series.trim().toLowerCase()] = true;
                if (e.tome) tomesCount++;
            }
        }

        setText('extTotal', external.length);
        setText('extToBuy', toBuyCount);
        setText('extAvgRating', ratedCount > 0 ? (ratedSum / ratedCount).toFixed(1) : '-');
        setText('extReturned', returnedCount);
        setText('extGiven', givenCount);
        setText('extKept', keptCount);
        setText('extSagasCount', Object.keys(extSeriesSet).length);
        setText('extTomesCount', tomesCount);
    }

    function filterExt(f, btn) {
        state.extFilter = f;
        var btns = document.querySelectorAll('#page-external .filter-btn');
        for (var i = 0; i < btns.length; i++) btns[i].classList.remove('active');
        if (btn) btn.classList.add('active');
        renderExternal();
    }

    function changeExtStatus(id, newStatus) {
        var item = findById(external, id);
        if (!item) return;
        item.status = newStatus;
        saveExternal();
        renderAll();
        var labels = { 'returned': '📤 Retiré', 'given': '🎁 Rendu', 'kept': '📚 Laissé' };
        showToast((labels[newStatus] || '✅') + ' !');
    }

    function toggleExtWantBuy(id) {
        var item = findById(external, id);
        if (!item) return;

        item.wantToBuy = !item.wantToBuy;

        if (item.wantToBuy) {
            addToWishlistFromExternal(item.id, item.title, item.author, item.genre, item.series, item.tome, item.notes);
            showToast('🛒 Ajouté à la wishlist !');
        } else {
            wishlist = wishlist.filter(function (w) { return w.fromExternal !== id; });
            saveWishlist();
            showToast('❌ Retiré de la wishlist !');
        }

        saveExternal();
        renderAll();
    }

    function deleteExternal(id) {
        var item = findById(external, id);
        if (!item || !confirm('Supprimer "' + item.title + '" ?')) return;

        external = removeById(external, id);
        wishlist = wishlist.filter(function (w) { return w.fromExternal !== id; });
        saveExternal();
        saveWishlist();
        renderAll();
        showToast('🗑 Supprimé.');
    }

    // ============================================================
    //  MODALE NOTATION (EXTERNE)
    // ============================================================
    function openRatingExtModal(id) {
        state.ratingExtBookId = id;
        state.selectedExtRating = 0;
        var b = findById(external, id);
        if (!b) return;

        setText('modalExtBookTitle', b.title);
        var rv = $('extBookReview'); if (rv) rv.value = b.review || '';
        var ds = $('extDateStart'); if (ds) ds.value = b.dateStart || '';
        var de = $('extDateEnd'); if (de) de.value = b.dateEnd || '';

        if (b.rating > 0) state.selectedExtRating = b.rating;
        updateExtStarsDisplay();
        calcReadingDays('ext');
        openModal('ratingExtModal');
    }

    function updateExtStarsDisplay() {
        var stars = document.querySelectorAll('#starsExtInput .star-btn');
        for (var i = 0; i < stars.length; i++) {
            stars[i].classList.toggle('active', i < state.selectedExtRating);
        }
    }

    function confirmExtRating() {
        if (!state.selectedExtRating) { showToast('⚠️ Sélectionne au moins 1 étoile !'); return; }

        var b = findById(external, state.ratingExtBookId);
        if (!b) return;

        b.rating = state.selectedExtRating;
        b.review = getVal('extBookReview');
        b.dateStart = getRawVal('extDateStart') || null;
        b.dateEnd = getRawVal('extDateEnd') || null;

        saveExternal();
        renderAll();
        showToast('⭐ Noté ' + state.selectedExtRating + '/5 !');
        closeModal('ratingExtModal');
    }

    // ============================================================
    //  SAGAS
    // ============================================================
    function renderSagas() {
        var container = $('sagasList');
        if (!container) return;

        var query = getVal('sagaSearchInput').toLowerCase();
        var allSeries = getAllSeries();
        var allKeys = Object.keys(allSeries);

        var seriesList = [];
        for (var i = 0; i < allKeys.length; i++) {
            var s = allSeries[allKeys[i]];
            if (!query || s.name.toLowerCase().indexOf(query) !== -1 || s.author.toLowerCase().indexOf(query) !== -1) {
                seriesList.push(s);
            }
        }

        var filter = state.sagaFilter;
        if (filter === 'completed') seriesList = seriesList.filter(function (s) { return s.isCompleted; });
        else if (filter === 'inProgress') seriesList = seriesList.filter(function (s) { return s.isStarted && !s.isCompleted; });
        else if (filter === 'notStarted') seriesList = seriesList.filter(function (s) { return !s.isStarted; });

        var allValues = [];
        for (var a = 0; a < allKeys.length; a++) allValues.push(allSeries[allKeys[a]]);

        var completedCount = 0, inProgressCount = 0, totalTomes = 0;
        for (var t = 0; t < allValues.length; t++) {
            if (allValues[t].isCompleted) completedCount++;
            else if (allValues[t].isStarted) inProgressCount++;
            totalTomes += allValues[t].ownedCount;
        }

        setText('sagasTotalStat', allValues.length);
        setText('sagasCompletedStat', completedCount);
        setText('sagasInProgressStat', inProgressCount);
        setText('sagasTotalTomes', totalTomes);
        setText('sagasCount', allValues.length);

        if (!seriesList.length) {
            container.innerHTML = '<div class="empty-state"><span class="emoji">📚</span><p>Aucune saga trouvée.</p></div>';
            return;
        }

        seriesList.sort(function (a, b) {
            if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
            return b.progress - a.progress;
        });

        var parts = [];
        for (var si = 0; si < seriesList.length; si++) {
            var sg = seriesList[si];

            var tomesHtml = '';
            for (var ti = 0; ti < sg.books.length; ti++) {
                var bk = sg.books[ti];
                tomesHtml +=
                    '<div class="tome-item">' +
                    '<span class="tome-title">' + (bk.tome ? 'T' + bk.tome + ' — ' : '') + escapeHTML(bk.title) + '</span>' +
                    (bk.rating > 0 ? '<span class="tome-rating">' + '★'.repeat(bk.rating) + '</span>' : '') +
                    '<span class="tome-status ' + (bk.status === 'read' ? 'read-tome' : 'unread-tome') + '">' + (bk.status === 'read' ? '✅' : '📖') + '</span>' +
                    '</div>';
            }

            var ownedNums = [];
            for (var oi = 0; oi < sg.books.length; oi++) { if (sg.books[oi].tome) ownedNums.push(sg.books[oi].tome); }

            var missingTomes = [];
            if (sg.totalTomes > 0) {
                for (var mi = 1; mi <= sg.totalTomes; mi++) {
                    if (ownedNums.indexOf(mi) === -1) missingTomes.push(mi);
                }
            }

            var missingHtml = '';
            if (missingTomes.length > 0) {
                var missingItems = '';
                for (var mj = 0; mj < missingTomes.length; mj++) {
                    missingItems += '<div class="tome-item missing-tome"><span class="tome-title missing-title">T' + missingTomes[mj] + ' — ???</span><span class="tome-status missing-status">❌ Manquant</span></div>';
                }
                missingHtml =
                    '<div class="missing-section">' +
                    '<div class="missing-header"><span class="missing-icon">⚠️</span><span class="missing-label">' +
                    missingTomes.length + ' tome' + (missingTomes.length > 1 ? 's' : '') + ' manquant' + (missingTomes.length > 1 ? 's' : '') +
                    '</span></div><div class="missing-list">' + missingItems + '</div></div>';
            }

            var compIcon = '';
            if (sg.isCompleted) compIcon = '<span class="saga-complete-badge">🎉 Terminée !</span>';
            else if (missingTomes.length === 0 && sg.ownedCount >= sg.totalTomes) compIcon = '<span class="saga-all-owned-badge">📚 Tous possédés</span>';

            var ratedBooks = sg.books.filter(function (b) { return b.rating > 0; });
            var avg = ratedBooks.length > 0 ? (ratedBooks.reduce(function (sum, b) { return sum + b.rating; }, 0) / ratedBooks.length).toFixed(1) : null;
            var missingCount = sg.totalTomes - sg.ownedCount;

            parts.push(
                '<div class="saga-card ' + (sg.isCompleted ? 'saga-completed' : '') + ' ' + (missingTomes.length > 0 ? 'saga-has-missing' : '') + '">' +
                '<h3>📖 ' + escapeHTML(sg.name) + '</h3>' +
                '<p class="saga-author">par ' + escapeHTML(sg.author) + '</p>' +
                '<span class="genre-tag">' + escapeHTML(sg.genre) + '</span>' + compIcon +
                '<div class="saga-info">' +
                '<span>📚 ' + sg.ownedCount + '/' + sg.totalTomes + ' possédés</span>' +
                '<span>✅ ' + sg.readCount + ' lus</span>' +
                (missingCount > 0 ? '<span class="missing-count-tag">❌ ' + missingCount + ' manquants</span>' : '') +
                (avg ? '<span>⭐ ' + avg + '/5</span>' : '') +
                '</div>' +
                '<p class="progress-text">' + sg.progress + '% lu ' + (sg.isCompleted ? '🎉' : '') + '</p>' +
                '<div class="progress-bar"><div class="progress-fill" style="width:' + Math.min(sg.progress, 100) + '%"></div></div>' +
                '<div class="tomes-list"><p class="tomes-section-title">📗 Tomes possédés (' + sg.ownedCount + ')</p>' + tomesHtml + '</div>' +
                missingHtml +
                '<div class="actions"><button data-action="editSaga" data-value="' + sg.key + '" class="btn-edit-saga" type="button">✏️ Modifier tomes prévus</button></div>' +
                '</div>'
            );
        }
        container.innerHTML = parts.join('');
    }

    function filterSagas(f, btn) {
        state.sagaFilter = f;
        var btns = document.querySelectorAll('#page-sagas .filter-btn');
        for (var i = 0; i < btns.length; i++) btns[i].classList.remove('active');
        if (btn) btn.classList.add('active');
        renderSagas();
    }

    function openEditSagaModal(key) {
        state.editSagaKey = key;
        var allSeries = getAllSeries();
        var s = allSeries[key];
        if (!s) return;
        setText('editSagaTitle', s.name);
        var t = $('editSagaTotalTomes');
        if (t) t.value = s.totalTomes;
        openModal('editSagaModal');
    }

    function confirmEditSaga() {
        var val = parseInt(getRawVal('editSagaTotalTomes'));
        if (!val || val < 1) { showToast('⚠️ Nombre invalide !'); return; }
        if (!sagasMeta[state.editSagaKey]) sagasMeta[state.editSagaKey] = {};
        sagasMeta[state.editSagaKey].totalTomes = val;
        saveSagasMeta();
        renderAll();
        showToast('✏️ Mise à jour !');
        closeModal('editSagaModal');
        state.editSagaKey = null;
    }

    // ============================================================
    //  AUTEURS
    // ============================================================
    function renderAuthors() {
        var container = $('authorsList');
        if (!container) return;

        var query = getVal('authorSearchInput').toLowerCase();
        var sortBy = getRawVal('authorSortSelect') || 'count';
        var allSeries = getAllSeries();

        var authorMap = {};
        for (var i = 0; i < books.length; i++) {
            var key = books[i].author.trim();
            if (!authorMap[key]) authorMap[key] = { name: key, books: [], extBooks: [] };
            authorMap[key].books.push(books[i]);
        }
        for (var i2 = 0; i2 < external.length; i2++) {
            var key2 = external[i2].author.trim();
            if (!authorMap[key2]) authorMap[key2] = { name: key2, books: [], extBooks: [] };
            authorMap[key2].extBooks.push(external[i2]);
        }

        var authors = [];
        var aKeys = Object.keys(authorMap);
        for (var j = 0; j < aKeys.length; j++) {
            var a = authorMap[aKeys[j]];
            if (query && a.name.toLowerCase().indexOf(query) === -1) continue;

            var totalBooks = a.books.length + a.extBooks.length;
            var readB = 0, ratingSum = 0, ratedCount = 0;

            for (var k = 0; k < a.books.length; k++) {
                if (a.books[k].status === 'read') readB++;
                if (a.books[k].rating > 0) { ratingSum += a.books[k].rating; ratedCount++; }
            }
            for (var k2 = 0; k2 < a.extBooks.length; k2++) {
                readB++;
                if (a.extBooks[k2].rating > 0) { ratingSum += a.extBooks[k2].rating; ratedCount++; }
            }

            var aSeries = [];
            var sKeys = Object.keys(allSeries);
            for (var s = 0; s < sKeys.length; s++) {
                if (allSeries[sKeys[s]].author.trim() === a.name) aSeries.push(allSeries[sKeys[s]]);
            }

            authors.push({
                name: a.name, books: a.books, extBooks: a.extBooks, totalBooks: totalBooks,
                readBooks: readB,
                avgRating: ratedCount > 0 ? ratingSum / ratedCount : 0,
                authorSeries: aSeries
            });
        }

        authors.sort(function (a, b) {
            switch (sortBy) {
                case 'name':   return a.name.localeCompare(b.name);
                case 'rating': return b.avgRating - a.avgRating;
                case 'read':   return b.readBooks - a.readBooks;
                default:       return b.totalBooks - a.totalBooks;
            }
        });

        setText('authorsTotal', authors.length);
        if (authors.length > 0) {
            var sorted = authors.slice().sort(function (a, b) { return b.totalBooks - a.totalBooks; });
            var topName = sorted[0].name;
            setText('authorTopName', topName.length > 15 ? topName.substring(0, 15) + '…' : topName);
            setText('authorTopCount', sorted[0].totalBooks);
        } else {
            setText('authorTopName', '-');
            setText('authorTopCount', '0');
        }

        if (!authors.length) {
            container.innerHTML = '<div class="empty-state"><span class="emoji">✍️</span><p>Aucun auteur trouvé.</p></div>';
            return;
        }

        var parts = [];
        for (var ai = 0; ai < authors.length; ai++) {
            var au = authors[ai];

            var allBooksList = [];
            for (var b1 = 0; b1 < au.books.length; b1++) allBooksList.push({ book: au.books[b1], isExternal: false });
            for (var b2 = 0; b2 < au.extBooks.length; b2++) allBooksList.push({ book: au.extBooks[b2], isExternal: true });
            allBooksList.sort(function (x, y) { return x.book.title.localeCompare(y.book.title); });

            var booksHtml = '';
            for (var bi = 0; bi < allBooksList.length; bi++) {
                var bkObj = allBooksList[bi];
                var bk = bkObj.book;
                var statusCls = bkObj.isExternal ? 'ab-ext' : (bk.status === 'read' ? 'ab-read' : 'ab-toread');
                var statusIcon = bkObj.isExternal ? '📖' : (bk.status === 'read' ? '✅' : '📖');
                var extLabel = bkObj.isExternal ? ' (externe)' : '';

                booksHtml +=
                    '<div class="author-book-item">' +
                    '<span class="ab-title">' + escapeHTML(bk.title) +
                    (bk.tome ? ' (T' + bk.tome + ')' : '') +
                    (bk.series ? ' — ' + escapeHTML(bk.series) : '') + extLabel +
                    '</span>' +
                    '<span class="ab-status ' + statusCls + '">' + statusIcon + '</span>' +
                    (bk.rating > 0 ? '<span class="ab-rating">' + '★'.repeat(bk.rating) + '</span>' : '') +
                    '</div>';
            }

            var seriesHtml = '';
            if (au.authorSeries.length > 0) {
                var seriesParts = [];
                for (var si = 0; si < au.authorSeries.length; si++) {
                    seriesParts.push(escapeHTML(au.authorSeries[si].name) + ' (' + au.authorSeries[si].readCount + '/' + au.authorSeries[si].totalTomes + ')');
                }
                seriesHtml = '<p class="author-series">📖 Sagas : ' + seriesParts.join(', ') + '</p>';
            }

            var uid = 'au_' + ai + '_' + Math.random().toString(36).substr(2, 6);

            parts.push(
                '<div class="author-card">' +
                '<h3>✍️ ' + escapeHTML(au.name) + '</h3>' +
                '<div class="author-stats">' +
                '<div class="author-stat"><span class="author-stat-num">' + au.totalBooks + '</span><span class="author-stat-label">Livres</span></div>' +
                '<div class="author-stat"><span class="author-stat-num">' + au.readBooks + '</span><span class="author-stat-label">Lus</span></div>' +
                '<div class="author-stat"><span class="author-stat-num">' + (au.avgRating > 0 ? au.avgRating.toFixed(1) + '⭐' : '-') + '</span><span class="author-stat-label">Note</span></div>' +
                '<div class="author-stat"><span class="author-stat-num">' + au.authorSeries.length + '</span><span class="author-stat-label">Sagas</span></div>' +
                '</div>' + seriesHtml +
                (au.totalBooks > 0
                    ? '<button data-action="toggleAuthor" data-value="' + uid + '" class="toggle-books-btn" type="button">📚 Voir les ' + au.totalBooks + ' livres</button>' +
                      '<div class="author-books-container" id="' + uid + '">' + booksHtml + '</div>'
                    : '') +
                '</div>'
            );
        }
        container.innerHTML = parts.join('');
    }

    function toggleAuthorBooks(uid, btn) {
        var c = $(uid);
        if (!c) return;
        var exp = c.classList.toggle('expanded');
        btn.textContent = exp ? '📚 Masquer' : '📚 Voir les livres';
    }

    // ============================================================
    //  WISHLIST
    // ============================================================
    function addWishlistItem(e) {
        e.preventDefault();
        var title = getVal('wishTitle');
        var author = getVal('wishAuthor');
        if (!title || !author) { showToast('⚠️ Titre et auteur requis !'); return; }

        wishlist.push({
            id: nowTimestamp(), title: title, author: author,
            genre: getRawVal('wishGenre'), format: getRawVal('wishFormat'),
            price: parseFloat(getRawVal('wishPrice')) || 0,
            priority: parseInt(getRawVal('wishPriority')) || 2,
            notes: getVal('wishNotes'),
            series: getVal('wishSeries') || null,
            tome: parseInt(getRawVal('wishTome')) || null,
            status: 'toBuy', dateAdded: nowDateStr(), dateBought: null
        });

        saveWishlist();
        renderWishlist();
        updateStats();
        updateWishSeriesSuggestions();
        var form = $('addWishlistForm');
        if (form) form.reset();
        showToast('🛒 "' + title + '" ajouté !');
    }

    function renderWishlist() {
        var container = $('wishlistList');
        if (!container) return;

        var query = getVal('wishSearchInput').toLowerCase();
        var filter = state.wishlistFilter;

        var filtered = [];
        for (var i = 0; i < wishlist.length; i++) {
            var it = wishlist[i];
            var matchFilter = filter === 'all'
                || (filter === 'toBuy' && it.status === 'toBuy')
                || (filter === 'bought' && it.status === 'bought');

            var matchSearch = !query
                || it.title.toLowerCase().indexOf(query) !== -1
                || it.author.toLowerCase().indexOf(query) !== -1
                || (it.genre && it.genre.toLowerCase().indexOf(query) !== -1)
                || (it.series && it.series.toLowerCase().indexOf(query) !== -1)
                || (it.format && it.format.toLowerCase().indexOf(query) !== -1);

            if (matchFilter && matchSearch) filtered.push(it);
        }

        filtered.sort(function (a, b) {
            if (a.status !== b.status) return a.status === 'toBuy' ? -1 : 1;
            return b.priority - a.priority;
        });

        if (!filtered.length) {
            container.innerHTML = '<div class="empty-state"><span class="emoji">🛒</span><p>Aucun livre dans la wishlist.</p></div>';
            return;
        }

        var pl = { 3: '🔴 Haute', 2: '🟡 Moyenne', 1: '🟢 Basse' };
        var pc = { 3: 'high', 2: 'medium', 1: 'low' };
        var parts = [];

        for (var j = 0; j < filtered.length; j++) {
            var it = filtered[j];
            var sc = it.status === 'bought' ? 'wish-bought' : 'wish-to-buy';
            var sl = it.status === 'bought' ? '✅ Acheté' : '📋 À acheter';

            parts.push(
                '<div class="book-card ' + sc + '">' +
                '<button class="delete-icon" data-action="deleteWish" data-id="' + it.id + '" type="button" aria-label="Supprimer">🗑</button>' +
                '<h3>' + escapeHTML(it.title) + '</h3>' +
                '<p class="author">par ' + escapeHTML(it.author) + '</p>' +
                '<div class="wish-tags">' +
                '<span class="genre-tag">' + escapeHTML(it.genre || 'Roman') + '</span>' +
                '<span class="status-badge ' + sc + '">' + sl + '</span>' +
                getFormatHtml(it.format) +
                (it.price > 0 ? '<span class="price-tag">' + it.price.toFixed(2) + ' €</span>' : '') +
                '<span class="priority-tag ' + (pc[it.priority] || 'medium') + '">' + (pl[it.priority] || '🟡 Moyenne') + '</span>' +
                (it.tome ? '<span class="tome-tag">Tome ' + it.tome + '</span>' : '') +
                (it.series ? '<span class="saga-tag">📖 ' + escapeHTML(it.series) + '</span>' : '') +
                '</div>' +
                (it.notes ? '<p class="wish-notes">📝 ' + escapeHTML(it.notes) + '</p>' : '') +
                '<div class="actions">' +
                (it.status === 'toBuy'
                    ? '<button data-action="markBought" data-id="' + it.id + '" class="btn-bought" type="button">✅ Acheté</button>'
                    : '<button data-action="markUnbought" data-id="' + it.id + '" class="btn-unbuy" type="button">🛒 Remettre</button>') +
                '<button data-action="transferWish" data-id="' + it.id + '" class="btn-transfer" type="button">📚 → Biblio</button>' +
                '<button data-action="editWish" data-id="' + it.id + '" class="btn-edit" type="button">✏️ Modifier</button>' +
                '</div></div>'
            );
        }
        container.innerHTML = parts.join('');
    }

    function filterWishlist(f, btn) {
        state.wishlistFilter = f;
        var btns = document.querySelectorAll('#page-wishlist .filter-btn');
        for (var i = 0; i < btns.length; i++) btns[i].classList.remove('active');
        if (btn) btn.classList.add('active');
        renderWishlist();
    }

    function markAsBought(id) {
        var it = findById(wishlist, id);
        if (!it) return;
        it.status = 'bought';
        it.dateBought = nowDateStr();
        saveWishlist();
        renderWishlist();
        updateStats();
        showToast('✅ Acheté !');
    }

    function markAsUnbought(id) {
        var it = findById(wishlist, id);
        if (!it) return;
        it.status = 'toBuy';
        it.dateBought = null;
        saveWishlist();
        renderWishlist();
        updateStats();
        showToast('🛒 Remis !');
    }

    function deleteWishlistItem(id) {
        var item = findById(wishlist, id);
        if (!item || !confirm('Supprimer "' + item.title + '" ?')) return;

        if (item.fromExternal) {
            var ext = findById(external, item.fromExternal);
            if (ext) { ext.wantToBuy = false; saveExternal(); }
        }

        wishlist = removeById(wishlist, id);
        saveWishlist();
        renderAll();
        showToast('🗑 Supprimé.');
    }

    // ============================================================
    //  MODALE TRANSFERT
    // ============================================================
    function openTransferModal(id) {
        state.transferBookId = id;
        var item = findById(wishlist, id);
        if (!item) return;
        setText('transferBookTitle', item.title + ' — ' + item.author);
        var cb = $('removeFromWishlist');
        if (cb) cb.checked = true;
        openModal('transferModal');
    }

    function confirmTransfer() {
        var item = findById(wishlist, state.transferBookId);
        if (!item) return;

        for (var j = 0; j < books.length; j++) {
            if (books[j].title.toLowerCase() === item.title.toLowerCase() &&
                books[j].author.toLowerCase() === item.author.toLowerCase()) {
                showToast('⚠️ Déjà dans la biblio !');
                closeModal('transferModal');
                return;
            }
        }

        books.push({
            id: nowTimestamp(), title: item.title, author: item.author,
            genre: item.genre || 'Roman', format: item.format || 'Broché',
            series: item.series || null, tome: item.tome || null,
            status: 'toRead', rating: 0, review: '',
            dateAdded: nowDateStr(), dateRead: null,
            dateStart: null, dateEnd: null
        });

        if (item.series) {
            var key = getSeriesKey(item.series);
            if (!sagasMeta[key]) sagasMeta[key] = {};
            saveSagasMeta();
        }

        var cb = $('removeFromWishlist');
        if (cb && cb.checked) {
            wishlist = removeById(wishlist, state.transferBookId);
        } else {
            item.status = 'bought';
            item.dateBought = nowDateStr();
        }

        saveBooks();
        saveWishlist();
        renderAll();
        showToast('📚 Transféré !');
        closeModal('transferModal');
    }

    // ============================================================
    //  STATS GLOBALES
    // ============================================================
    function updateStats() {
        var toRead = 0, read = 0, rSum = 0, rCount = 0, oneShot = 0, broche = 0, poche = 0;

        for (var i = 0; i < books.length; i++) {
            var b = books[i];
            if (b.status === 'toRead') toRead++;
            else if (b.status === 'read') read++;
            if (b.rating > 0) { rSum += b.rating; rCount++; }
            if (!b.series || !b.series.trim()) oneShot++;
            if (b.format === 'Broché') broche++;
            else if (b.format === 'Poche') poche++;
        }

        var extReadCount = external.length;

        for (var e = 0; e < external.length; e++) {
            if (external[e].rating > 0) { rSum += external[e].rating; rCount++; }
        }

        setText('totalBooks', books.length);
        setText('toReadBooks', toRead);
        setText('readBooks', read);
        setText('externalCount', external.length);
        setText('totalReadGlobal', read + extReadCount);
        setText('avgRating', rCount > 0 ? (rSum / rCount).toFixed(1) : '-');
        setText('oneShotCount', oneShot);
        setText('brocheCount', broche);
        setText('pocheCount', poche);

        var wToBuy = 0, wBought = 0, budget = 0, spent = 0;
        for (var j = 0; j < wishlist.length; j++) {
            var w = wishlist[j];
            if (w.status === 'toBuy') { wToBuy++; budget += w.price || 0; }
            else if (w.status === 'bought') { wBought++; spent += w.price || 0; }
        }

        setText('wishlistCount', wToBuy);
        setText('wishlistTotal', wToBuy);
        setText('wishlistBought', wBought);
        setText('wishlistBudget', budget.toFixed(2) + ' €');
        setText('wishlistSpent', spent.toFixed(2) + ' €');
    }

    // ============================================================
    //  ÉDITION LIVRE BIBLIOTHÈQUE
    // ============================================================
    function openEditBookModal(id) {
        state.editBookId = id;
        var b = findById(books, id);
        if (!b) return;

        setFormVal('editBookTitle', b.title);
        setFormVal('editBookAuthor', b.author);
        setFormVal('editBookGenre', b.genre || 'Roman');
        setFormVal('editBookFormat', b.format || 'Broché');
        setFormVal('editBookSeries', b.series || '');
        setFormVal('editBookTome', b.tome || '');

        openModal('editBookModal');
    }

    function confirmEditBook() {
        var b = findById(books, state.editBookId);
        if (!b) return;

        var title = getVal('editBookTitle');
        var author = getVal('editBookAuthor');
        if (!title || !author) { showToast('⚠️ Titre et auteur requis !'); return; }

        var oldSeries = b.series;
        b.title = title;
        b.author = author;
        b.genre = getRawVal('editBookGenre');
        b.format = getRawVal('editBookFormat');
        var newSeries = getVal('editBookSeries');
        b.series = newSeries || null;
        b.tome = parseInt(getRawVal('editBookTome')) || null;

        if (oldSeries && oldSeries !== newSeries) {
            var oldKey = getSeriesKey(oldSeries);
            var hasOthers = false;
            for (var i = 0; i < books.length; i++) {
                if (books[i].series && getSeriesKey(books[i].series) === oldKey && books[i].id !== b.id) {
                    hasOthers = true; break;
                }
            }
            if (!hasOthers) delete sagasMeta[oldKey];
        }

        if (newSeries) {
            var newKey = getSeriesKey(newSeries);
            if (!sagasMeta[newKey]) sagasMeta[newKey] = {};
        }

        saveBooks();
        saveSagasMeta();
        renderAll();
        showToast('✅ "' + title + '" modifié !');
        closeModal('editBookModal');
        state.editBookId = null;
    }

    // ============================================================
    //  ÉDITION WISHLIST
    // ============================================================
    function openEditWishModal(id) {
        state.editWishId = id;
        var it = findById(wishlist, id);
        if (!it) return;

        setFormVal('editWishTitle', it.title);
        setFormVal('editWishAuthor', it.author);
        setFormVal('editWishGenre', it.genre || 'Roman');
        setFormVal('editWishFormat', it.format || 'Broché');
        setFormVal('editWishPriority', it.priority || 2);
        setFormVal('editWishSeries', it.series || '');
        setFormVal('editWishTome', it.tome || '');
        setFormVal('editWishPrice', it.price || '');
        setFormVal('editWishNotes', it.notes || '');

        openModal('editWishModal');
    }

    function confirmEditWish() {
        var it = findById(wishlist, state.editWishId);
        if (!it) return;

        var title = getVal('editWishTitle');
        var author = getVal('editWishAuthor');
        if (!title || !author) { showToast('⚠️ Titre et auteur requis !'); return; }

        it.title = title;
        it.author = author;
        it.genre = getRawVal('editWishGenre');
        it.format = getRawVal('editWishFormat');
        it.priority = parseInt(getRawVal('editWishPriority')) || 2;
        it.series = getVal('editWishSeries') || null;
        it.tome = parseInt(getRawVal('editWishTome')) || null;
        it.price = parseFloat(getRawVal('editWishPrice')) || 0;
        it.notes = getVal('editWishNotes');

        saveWishlist();
        renderAll();
        showToast('✅ "' + title + '" modifié !');
        closeModal('editWishModal');
        state.editWishId = null;
    }

    // ============================================================
    //  ÉDITION EXTERNE
    // ============================================================
    function openEditExtModal(id) {
        state.editExtId = id;
        var it = findById(external, id);
        if (!it) return;

        setFormVal('editExtTitle', it.title);
        setFormVal('editExtAuthor', it.author);
        setFormVal('editExtGenre', it.genre || 'Roman');
        setFormVal('editExtSource', it.source || 'Bibliothèque');
        setFormVal('editExtSeries', it.series || '');
        setFormVal('editExtTome', it.tome || '');
        setFormVal('editExtTotalTomes', it.totalTomes || '');
        setFormVal('editExtNotes', it.notes || '');

        openModal('editExtModal');
    }

    function confirmEditExt() {
        var it = findById(external, state.editExtId);
        if (!it) return;

        var title = getVal('editExtTitle');
        var author = getVal('editExtAuthor');
        if (!title || !author) { showToast('⚠️ Titre et auteur requis !'); return; }

        it.title = title;
        it.author = author;
        it.genre = getRawVal('editExtGenre');
        it.source = getRawVal('editExtSource');
        it.series = getVal('editExtSeries') || null;
        it.tome = parseInt(getRawVal('editExtTome')) || null;
        it.totalTomes = parseInt(getRawVal('editExtTotalTomes')) || null;
        it.notes = getVal('editExtNotes');

        saveExternal();
        renderAll();
        showToast('✅ "' + title + '" modifié !');
        closeModal('editExtModal');
        state.editExtId = null;
    }

    function setFormVal(id, value) {
        var el = $(id);
        if (el) el.value = value;
    }

    // ============================================================
    //  TOAST
    // ============================================================
    function showToast(msg) {
        var ex = document.querySelector('.toast');
        if (ex) ex.remove();
        var t = document.createElement('div');
        t.className = 'toast';
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(function () { if (t.parentNode) t.remove(); }, 3000);
    }

    // ============================================================
    //  FIREBASE
    // ============================================================
    document.addEventListener('firebaseReady', function () {
        var auth = window.firebaseAuth;
        if (!auth || !window.firebaseOnAuthChanged) return;
        window.firebaseOnAuthChanged(auth, function (user) {
            if (user) {
                state.currentUser = user;
                showLoggedUI(user);
                firebasePullData();
            } else {
                state.currentUser = null;
                showNotLoggedUI();
            }
        });
    });

    function showAuthTab(tab, btn) {
        var tabs = document.querySelectorAll('.auth-tab');
        var forms = document.querySelectorAll('.auth-form');
        for (var i = 0; i < tabs.length; i++) {
            tabs[i].classList.remove('active');
            tabs[i].setAttribute('aria-selected', 'false');
        }
        for (var j = 0; j < forms.length; j++) forms[j].classList.remove('active');
        if (btn) {
            btn.classList.add('active');
            btn.setAttribute('aria-selected', 'true');
        }
        var f = $(tab + 'Form');
        if (f) f.classList.add('active');
    }

    function showLoggedUI(user) {
        var nl = $('authNotLogged');
        var l = $('authLogged');
        if (nl) nl.style.display = 'none';
        if (l) l.style.display = 'block';
        setText('userEmail', user.email);
    }

    function showNotLoggedUI() {
        var nl = $('authNotLogged');
        var l = $('authLogged');
        if (nl) nl.style.display = 'block';
        if (l) l.style.display = 'none';
    }

    function firebaseRegister() {
        var email = getVal('regEmail');
        var pass = getRawVal('regPassword');
        var pass2 = getRawVal('regPassword2');

        if (!email || !pass) { showToast('⚠️ Remplis tous les champs !'); return; }
        if (pass.length < 6) { showToast('⚠️ Mot de passe : min. 6 caractères'); return; }
        if (pass !== pass2) { showToast('⚠️ Les mots de passe ne correspondent pas !'); return; }
        if (!window.firebaseCreateUser) { showToast('❌ Firebase non chargé'); return; }

        window.firebaseCreateUser(window.firebaseAuth, email, pass)
            .then(function () {
                showToast('✅ Compte créé !');
                setTimeout(firebaseSync, 1000);
            })
            .catch(function (error) {
                var msgs = {
                    'auth/email-already-in-use': '⚠️ Email déjà utilisé',
                    'auth/invalid-email': '⚠️ Email invalide',
                    'auth/weak-password': '⚠️ Mot de passe trop faible'
                };
                showToast(msgs[error.code] || '❌ Erreur : ' + error.message);
            });
    }

    function firebaseLogin() {
        var email = getVal('loginEmail');
        var pass = getRawVal('loginPassword');

        if (!email || !pass) { showToast('⚠️ Remplis tous les champs !'); return; }
        if (!window.firebaseSignIn) { showToast('❌ Firebase non chargé'); return; }

        window.firebaseSignIn(window.firebaseAuth, email, pass)
            .then(function () { showToast('✅ Connecté !'); })
            .catch(function (error) {
                var msgs = {
                    'auth/user-not-found': '⚠️ Utilisateur introuvable',
                    'auth/wrong-password': '⚠️ Mot de passe incorrect',
                    'auth/invalid-email': '⚠️ Email invalide',
                    'auth/invalid-credential': '⚠️ Identifiants invalides'
                };
                showToast(msgs[error.code] || '❌ Erreur : ' + error.message);
            });
    }

    function firebaseLogout() {
        if (!confirm('Se déconnecter ?')) return;
        if (!window.firebaseSignOut) return;
        window.firebaseSignOut(window.firebaseAuth)
            .then(function () { showToast('👋 Déconnecté !'); });
    }

    function firebaseSync() {
        if (!state.currentUser) { showToast('⚠️ Non connecté !'); return; }

        setSyncStatus('syncing', '⏳ Synchronisation...');
        var data = {
            books: books, wishlist: wishlist, external: external,
            sagasMeta: sagasMeta, settings: settings, lastSync: nowTimestamp()
        };

        var docRef = window.firebaseDoc(window.firebaseDb, 'users', state.currentUser.uid);
        window.firebaseSetDoc(docRef, data)
            .then(function () {
                setSyncStatus('ok', '☁️ Synchronisé ' + new Date().toLocaleTimeString('fr-FR'));
                showToast('☁️ Synchronisé !');
            })
            .catch(function (err) {
                setSyncStatus('error', '❌ Erreur');
                showToast('❌ Erreur sync');
                console.error('Sync error:', err);
            });
    }

    function firebasePullData() {
        if (!state.currentUser) return;

        setSyncStatus('syncing', '⏳ Récupération...');
        var docRef = window.firebaseDoc(window.firebaseDb, 'users', state.currentUser.uid);

        window.firebaseGetDoc(docRef)
            .then(function (docSnap) {
                if (!docSnap.exists()) {
                    setSyncStatus('ok', '☁️ Premier envoi...');
                    firebaseSync();
                    return;
                }

                var data = docSnap.data();
                var localLastSync = parseInt(localStorage.getItem('lastLocalChange') || '0');
                var cloudLastSync = data.lastSync || 0;

                if (localLastSync > cloudLastSync && (books.length > 0 || wishlist.length > 0 || external.length > 0)) {
                    if (confirm('⚠️ Données locales plus récentes.\n\nOK = local vers cloud / Annuler = cloud vers local')) {
                        firebaseSync();
                        return;
                    }
                }

                if (data.books && Array.isArray(data.books)) books = data.books;
                if (data.wishlist && Array.isArray(data.wishlist)) wishlist = data.wishlist;
                if (data.external && Array.isArray(data.external)) external = data.external;
                if (data.sagasMeta && typeof data.sagasMeta === 'object') sagasMeta = data.sagasMeta;
                if (data.settings && typeof data.settings === 'object') {
                    settings = Object.assign({}, settings, data.settings);
                    applySettings();
                }

                saveJSON('myBookPile', books);
                saveJSON('myBookWishlist', wishlist);
                saveJSON('myBookExternal', external);
                saveJSON('myBookSagasMeta', sagasMeta);
                saveSettings();
                renderAll();
                setSyncStatus('ok', '☁️ Récupéré');
                showToast('⬇️ Récupéré !');
            })
            .catch(function (err) {
                setSyncStatus('error', '❌ Erreur');
                console.error('Pull error:', err);
            });
    }

    function setSyncStatus(status, msg) {
        var el = $('syncStatus');
        if (!el) return;
        el.textContent = msg;
        el.classList.remove('syncing', 'error');
        if (status === 'syncing') el.classList.add('syncing');
        else if (status === 'error') el.classList.add('error');
    }

    function triggerAutoSync() {
        localStorage.setItem('lastLocalChange', nowTimestamp().toString());
        if (!state.currentUser) return;
        if (state.syncTimeout) clearTimeout(state.syncTimeout);
        state.syncTimeout = setTimeout(firebaseSync, 3000);
    }

})();
