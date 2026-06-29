document.addEventListener('DOMContentLoaded', () => {
    // State variables
    let releaseNotes = [];
    let activeFilter = 'all';
    let searchQuery = '';
    let sortOrder = 'newest';
    let activeTweetNote = null;

    // DOM Elements
    const refreshBtn = document.getElementById('refresh-btn');
    const refreshIcon = document.getElementById('refresh-icon');
    const searchInput = document.getElementById('search-input');
    const searchClearBtn = document.getElementById('search-clear-btn');
    const filterContainer = document.getElementById('filter-container');
    const notesContainer = document.getElementById('notes-container');
    const skeletonContainer = document.getElementById('skeleton-container');
    const emptyState = document.getElementById('empty-state');
    const resetFiltersBtn = document.getElementById('reset-filters-btn');
    const resultsCount = document.getElementById('results-count');
    const sortSelect = document.getElementById('sort-select');
    const lastUpdatedText = document.getElementById('last-updated-text');
    const statusBadge = document.getElementById('status-badge');
    const exportCsvBtn = document.getElementById('export-csv-btn');

    // Tweet Modal Elements
    const tweetModal = document.getElementById('tweet-modal');
    const tweetTextarea = document.getElementById('tweet-textarea');
    const charCounter = document.getElementById('char-counter');
    const charBarFill = document.getElementById('char-bar-fill');
    const cancelTweetBtn = document.getElementById('cancel-tweet-btn');
    const postTweetBtn = document.getElementById('post-tweet-btn');
    const modalCloseBtn = document.getElementById('modal-close-btn');

    // Initial Load
    fetchReleaseNotes(false);

    // Event Listeners
    refreshBtn.addEventListener('click', () => fetchReleaseNotes(true));
    
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        searchClearBtn.style.display = searchQuery ? 'block' : 'none';
        renderFilteredNotes();
    });

    searchClearBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchQuery = '';
        searchClearBtn.style.display = 'none';
        searchInput.focus();
        renderFilteredNotes();
    });

    sortSelect.addEventListener('change', (e) => {
        sortOrder = e.target.value;
        renderFilteredNotes();
    });

    resetFiltersBtn.addEventListener('click', resetFilters);
    exportCsvBtn.addEventListener('click', exportToCSV);

    // Modal Events
    cancelTweetBtn.addEventListener('click', closeTweetModal);
    modalCloseBtn.addEventListener('click', closeTweetModal);
    tweetModal.addEventListener('click', (e) => {
        if (e.target === tweetModal) closeTweetModal();
    });

    tweetTextarea.addEventListener('input', updateCharCount);

    postTweetBtn.addEventListener('click', () => {
        const tweetText = tweetTextarea.value.trim();
        if (tweetText.length > 280) {
            alert('Your draft exceeds X/Twitter\'s 280-character limit!');
            return;
        }
        
        // Open Twitter intent in a new tab
        const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
        window.open(twitterUrl, '_blank', 'noopener,noreferrer');
        closeTweetModal();
    });

    // Fetch notes from Flask backend
    async function fetchReleaseNotes(forceRefresh = false) {
        setLoadingState(true);
        try {
            const url = `/api/release-notes${forceRefresh ? '?refresh=true' : ''}`;
            const response = await fetch(url);
            if (!response.ok) throw new Error('API request failed');
            
            const result = await response.json();
            
            if (result.status === 'success') {
                releaseNotes = result.data;
                updateLastUpdatedTime(result.last_updated);
                setStatusOnline(true);
                generateFilters();
                renderFilteredNotes();
            } else {
                throw new Error(result.message || 'API responded with error');
            }
        } catch (error) {
            console.error('Error fetching release notes:', error);
            setStatusOnline(false);
            showErrorToast('Failed to fetch release notes feed. Please try again.');
        } finally {
            setLoadingState(false);
        }
    }

    function setLoadingState(isLoading) {
        if (isLoading) {
            refreshIcon.classList.add('spinning');
            refreshBtn.disabled = true;
            skeletonContainer.style.display = 'flex';
            notesContainer.style.display = 'none';
            emptyState.style.display = 'none';
        } else {
            refreshIcon.classList.remove('spinning');
            refreshBtn.disabled = false;
            skeletonContainer.style.display = 'none';
        }
    }

    function updateLastUpdatedTime(timestamp) {
        if (!timestamp) return;
        const date = new Date(timestamp * 1000);
        lastUpdatedText.textContent = `Last Checked: ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }

    function setStatusOnline(isOnline) {
        if (isOnline) {
            statusBadge.className = 'status-badge online';
            statusBadge.textContent = 'Live';
        } else {
            statusBadge.className = 'status-badge offline';
            statusBadge.textContent = 'Offline / Error';
        }
    }

    // Generate categories filter counts dynamically
    function generateFilters() {
        // Count frequencies of types
        const counts = { all: releaseNotes.length };
        releaseNotes.forEach(note => {
            const type = note.type || 'Info';
            counts[type] = (counts[type] || 0) + 1;
        });

        // Get unique categories list
        const categories = Object.keys(counts).filter(cat => cat !== 'all');
        
        // Re-generate filter DOM
        filterContainer.innerHTML = '';
        
        // Always add "All Updates" button
        const allBtn = createFilterBtn('all', 'All Updates', counts.all, activeFilter === 'all');
        filterContainer.appendChild(allBtn);

        // Add specific categories
        categories.sort().forEach(cat => {
            const btn = createFilterBtn(cat, cat, counts[cat], activeFilter === cat);
            filterContainer.appendChild(btn);
        });
    }

    function createFilterBtn(type, label, count, isActive) {
        const btn = document.createElement('button');
        btn.className = `filter-btn ${isActive ? 'active' : ''}`;
        btn.setAttribute('data-type', type);
        
        // Map types to color classes for CSS dots
        const safeType = type.toLowerCase().replace(/\W+/g, '-');
        let dotClass = 'info';
        if (type === 'Feature') dotClass = 'feature';
        else if (type === 'Change') dotClass = 'change';
        else if (type === 'Deprecated') dotClass = 'deprecated';
        else if (type === 'Fixed') dotClass = 'fixed';
        else if (type === 'Info') dotClass = 'info';

        btn.innerHTML = `
            <span class="filter-dot ${dotClass}"></span>
            <span class="filter-label">${label}</span>
            <span class="filter-count">${count}</span>
        `;

        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeFilter = type;
            renderFilteredNotes();
        });

        return btn;
    }

    // Filter, sort, and render release notes
    function renderFilteredNotes() {
        let filtered = [...releaseNotes];

        // 1. Filter by category
        if (activeFilter !== 'all') {
            filtered = filtered.filter(note => (note.type || 'Info') === activeFilter);
        }

        // 2. Filter by search query
        if (searchQuery) {
            filtered = filtered.filter(note => {
                const dateMatch = note.date.toLowerCase().includes(searchQuery);
                const typeMatch = note.type.toLowerCase().includes(searchQuery);
                const contentMatch = note.content_text.toLowerCase().includes(searchQuery);
                return dateMatch || typeMatch || contentMatch;
            });
        }

        // 3. Sort items
        filtered.sort((a, b) => {
            const dateA = new Date(a.updated || a.date);
            const dateB = new Date(b.updated || b.date);
            
            if (sortOrder === 'newest') {
                return dateB - dateA;
            } else {
                return dateA - dateB;
            }
        });

        // Update counts UI
        resultsCount.textContent = `Showing ${filtered.length} of ${releaseNotes.length} updates`;

        // Render HTML
        if (filtered.length === 0) {
            notesContainer.style.display = 'none';
            emptyState.style.display = 'block';
        } else {
            emptyState.style.display = 'none';
            notesContainer.innerHTML = '';
            
            filtered.forEach(note => {
                const card = createNoteCard(note);
                notesContainer.appendChild(card);
            });
            notesContainer.style.display = 'flex';
        }
    }

    function createNoteCard(note) {
        const card = document.createElement('article');
        const safeType = (note.type || 'Info').toLowerCase().replace(/\W+/g, '-');
        
        card.className = `note-card category-${safeType}`;
        card.id = note.id;

        // Map badge class
        let badgeClass = 'badge-info';
        if (note.type === 'Feature') badgeClass = 'badge-feature';
        else if (note.type === 'Change') badgeClass = 'badge-change';
        else if (note.type === 'Deprecated') badgeClass = 'badge-deprecated';
        else if (note.type === 'Fixed') badgeClass = 'badge-fixed';

        card.innerHTML = `
            <div class="note-card-header">
                <div class="note-date-container">
                    <i class="fa-regular fa-calendar"></i>
                    <span>${note.date}</span>
                </div>
                <span class="badge ${badgeClass}">${note.type || 'Update'}</span>
            </div>
            <div class="note-content">
                ${note.content_html}
            </div>
            <div class="note-card-actions">
                <a href="${note.link}" target="_blank" rel="noopener" class="note-deep-link">
                    Official Release Notes <i class="fa-solid fa-arrow-up-right-from-square"></i>
                </a>
                <div class="action-buttons-group" style="display: flex; gap: 0.5rem;">
                    <button class="btn btn-secondary btn-sm copy-trigger" data-id="${note.id}">
                        <i class="fa-regular fa-copy"></i> Copy
                    </button>
                    <button class="btn btn-secondary btn-sm tweet-trigger" data-id="${note.id}">
                        <i class="fa-brands fa-x-twitter"></i> Tweet
                    </button>
                </div>
            </div>
        `;

        // Attach listener to copy trigger
        const copyBtn = card.querySelector('.copy-trigger');
        copyBtn.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(note.content_text);
                
                // Show success feedback
                const originalHTML = copyBtn.innerHTML;
                copyBtn.innerHTML = `<i class="fa-solid fa-check" style="color: var(--color-feature)"></i> Copied!`;
                copyBtn.disabled = true;
                
                setTimeout(() => {
                    copyBtn.innerHTML = originalHTML;
                    copyBtn.disabled = false;
                }, 1500);
            } catch (err) {
                console.error('Failed to copy text:', err);
                showErrorToast('Could not copy to clipboard');
            }
        });

        // Attach listener to tweet trigger
        card.querySelector('.tweet-trigger').addEventListener('click', () => {
            openTweetModal(note);
        });

        return card;
    }

    // Reset filters helper
    function resetFilters() {
        searchInput.value = '';
        searchQuery = '';
        searchClearBtn.style.display = 'none';
        
        activeFilter = 'all';
        document.querySelectorAll('.filter-btn').forEach(btn => {
            if (btn.getAttribute('data-type') === 'all') {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        sortSelect.value = 'newest';
        sortOrder = 'newest';
        
        renderFilteredNotes();
    }

    // Modal Functionality
    function openTweetModal(note) {
        activeTweetNote = note;
        
        // Draft a tweet
        // X text limit is 280 characters.
        // A link is counted as 23 characters.
        // Let's reserve 30-40 characters for header/badge metadata.
        const typeEmoji = getEmojiForType(note.type);
        const prefix = `${typeEmoji} BigQuery Release [${note.type}] (${note.date}): `;
        const link = `\n\nRead more: ${note.link}`;
        
        // Calculate remaining size for content text.
        // Twitter link takes 23 characters in the count.
        const linkLengthTwitter = 23 + 12; // 23 for URL, 12 for "\n\nRead more: "
        const prefixLength = prefix.length;
        const maxContentLength = 280 - prefixLength - linkLengthTwitter - 4; // 4 for "..."
        
        let contentText = note.content_text;
        if (contentText.length > maxContentLength) {
            contentText = contentText.slice(0, maxContentLength) + '...';
        }
        
        const fullTweetText = `${prefix}${contentText}${link}`;
        
        tweetTextarea.value = fullTweetText;
        updateCharCount();
        
        tweetModal.classList.add('active');
        document.body.style.overflow = 'hidden'; // prevent page scroll behind modal
    }

    function closeTweetModal() {
        tweetModal.classList.remove('active');
        document.body.style.overflow = '';
        activeTweetNote = null;
    }

    function getEmojiForType(type) {
        switch (type) {
            case 'Feature': return '🚀';
            case 'Change': return '🔄';
            case 'Deprecated': return '⚠️';
            case 'Fixed': return '🛠️';
            default: return '📢';
        }
    }

    function updateCharCount() {
        const text = tweetTextarea.value;
        
        // Twitter custom URL parser treats all links as 23 characters.
        // Let's do a simple count based on Twitter's actual rules:
        // Replace all URL substrings with 23 placeholder characters to count correctly.
        const urlRegex = /https?:\/\/[^\s]+/g;
        let countedText = text;
        const matches = text.match(urlRegex);
        if (matches) {
            matches.forEach(url => {
                countedText = countedText.replace(url, 'a'.repeat(23));
            });
        }
        
        const charCount = countedText.length;
        charCounter.textContent = charCount;
        
        // Calculate percentage for progress bar
        const percent = Math.min((charCount / 280) * 100, 100);
        charBarFill.style.width = `${percent}%`;
        
        // Color updates
        charBarFill.className = 'char-bar-fill';
        if (charCount > 280) {
            charBarFill.classList.add('danger');
            charCounter.style.color = 'var(--color-deprecated)';
            postTweetBtn.disabled = true;
        } else if (charCount > 250) {
            charBarFill.classList.add('warning');
            charCounter.style.color = 'var(--color-change)';
            postTweetBtn.disabled = false;
        } else {
            charCounter.style.color = 'var(--text-secondary)';
            postTweetBtn.disabled = false;
        }
    }

    function showErrorToast(msg) {
        // Simple error logging to UI.
        const toast = document.createElement('div');
        toast.style.position = 'fixed';
        toast.style.bottom = '2rem';
        toast.style.right = '2rem';
        toast.style.backgroundColor = 'var(--color-deprecated)';
        toast.style.color = 'white';
        toast.style.padding = '1rem 1.5rem';
        toast.style.borderRadius = 'var(--radius-md)';
        toast.style.boxShadow = 'var(--shadow-lg)';
        toast.style.zIndex = '1000';
        toast.style.fontFamily = 'var(--font-sans)';
        toast.style.fontSize = '0.875rem';
        toast.style.fontWeight = '600';
        toast.style.display = 'flex';
        toast.style.alignItems = 'center';
        toast.style.gap = '0.5rem';
        toast.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${msg}`;
        
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.transition = 'opacity 0.5s';
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 500);
        }, 4000);
    }

    function exportToCSV() {
        if (!releaseNotes || releaseNotes.length === 0) {
            showErrorToast('No notes available to export.');
            return;
        }

        // We export the currently filtered notes
        let notesToExport = [...releaseNotes];
        
        // 1. Filter by category
        if (activeFilter !== 'all') {
            notesToExport = notesToExport.filter(note => (note.type || 'Info') === activeFilter);
        }

        // 2. Filter by search query
        if (searchQuery) {
            notesToExport = notesToExport.filter(note => {
                const dateMatch = note.date.toLowerCase().includes(searchQuery);
                const typeMatch = note.type.toLowerCase().includes(searchQuery);
                const contentMatch = note.content_text.toLowerCase().includes(searchQuery);
                return dateMatch || typeMatch || contentMatch;
            });
        }

        // 3. Sort items
        notesToExport.sort((a, b) => {
            const dateA = new Date(a.updated || a.date);
            const dateB = new Date(b.updated || b.date);
            if (sortOrder === 'newest') {
                return dateB - dateA;
            } else {
                return dateA - dateB;
            }
        });

        if (notesToExport.length === 0) {
            showErrorToast('No matching notes to export.');
            return;
        }

        // Generate CSV content
        // Header
        const headers = ['Date', 'Type', 'Content', 'Link'];
        
        const csvRows = [
            headers.join(',')
        ];

        for (const note of notesToExport) {
            const dateVal = escapeCsvField(note.date);
            const typeVal = escapeCsvField(note.type);
            const contentVal = escapeCsvField(note.content_text);
            const linkVal = escapeCsvField(note.link);
            
            csvRows.push(`${dateVal},${typeVal},${contentVal},${linkVal}`);
        }

        const csvContent = csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        
        // Create download link
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `bigquery-release-notes-${activeFilter}-${sortOrder}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    function escapeCsvField(val) {
        if (val === undefined || val === null) {
            return '""';
        }
        let str = String(val);
        if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
            str = str.replace(/"/g, '""');
            return `"${str}"`;
        }
        return `"${str}"`;
    }
});
