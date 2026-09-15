/**
 * Main Application Script for Creative Portfolio & Showcase
 * Tab Routing, Gallery Rendering, Filtering, Search, and Event Coordination.
 */

// Application State
const AppState = {
  currentTab: 'home',
  activeFilters: {
    'social-media': 'all',
    'youtube-thumbnails': 'all',
    'movie-posters': 'all',
    'ai-videos': 'all'
  },
  searchQueries: {
    'social-media': '',
    'youtube-thumbnails': '',
    'movie-posters': '',
    'ai-videos': ''
  }
};

// Global Toast System
window.showToast = function(message, icon = '✨') {
  const toast = document.getElementById('toastNotification');
  const textEl = document.getElementById('toastText');
  const iconEl = document.getElementById('toastIcon');

  if (!toast) return;

  textEl.textContent = message;
  iconEl.textContent = icon;
  toast.classList.add('show');

  if (window._toastTimeout) clearTimeout(window._toastTimeout);
  window._toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 3500);
};

// Tab Switching
window.switchTab = function(tabId) {
  const targetSection = document.getElementById('tab-' + tabId);
  if (!targetSection) return;

  AppState.currentTab = tabId;
  document.body.setAttribute('data-active-tab', tabId);

  // Update Nav Buttons
  document.querySelectorAll('.nav-item-btn').forEach(btn => {
    const isTarget = btn.getAttribute('data-tab') === tabId;
    btn.classList.toggle('active', isTarget);
  });

  // Update Sections
  document.querySelectorAll('.tab-section').forEach(sec => {
    sec.classList.remove('active');
  });

  targetSection.classList.add('active');

  // Close mobile drawer if open
  const drawer = document.getElementById('mobileNavDrawer');
  if (drawer) drawer.classList.remove('open');

  // Scroll to top of section smoothly
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Update URL hash
  if (history.pushState) {
    history.pushState(null, null, '#' + tabId);
  } else {
    location.hash = '#' + tabId;
  }

  // Render gallery if it's one of the 4 media tabs
  if (['social-media', 'youtube-thumbnails', 'movie-posters', 'ai-videos'].includes(tabId)) {
    renderGalleryTab(tabId);
  }
};

window.renderActiveGallery = function() {
  if (['social-media', 'youtube-thumbnails', 'movie-posters', 'ai-videos'].includes(AppState.currentTab)) {
    renderGalleryTab(AppState.currentTab);
  }
};

/**
 * Global item deletion handler with confirmation and instant rerender
 */
window.deleteGalleryItem = async function(id, title = 'item', isVideo = false) {
  const itemType = isVideo ? 'video' : 'artwork';
  const confirmed = confirm(`Are you sure you want to delete this ${itemType}:\n\n"${title}"?\n\nThis will remove it from your portfolio.`);
  if (!confirmed) return false;

  try {
    await window.portfolioStorage.deleteItem(id);
    window.showToast(`🗑️ ${itemType.charAt(0).toUpperCase() + itemType.slice(1)} deleted successfully!`, '🗑️');

    // Close lightbox if currently viewing this item
    if (window.lightbox && window.lightbox.isOpen() && window.lightbox.currentItem?.id === id) {
      window.lightbox.close();
    }

    // Refresh active gallery
    window.renderActiveGallery();
    return true;
  } catch (err) {
    console.error('Error deleting item:', err);
    window.showToast('Failed to delete: ' + err.message, '❌');
    return false;
  }
};

/**
 * Restore all deleted demo items
 */
window.restoreDemoItems = function() {
  if (confirm('Restore all default sample artworks and videos to the portfolio?')) {
    window.portfolioStorage.restoreDeletedDefaults();
    window.showToast('✨ Sample artworks and videos restored!', '🎉');
    window.renderActiveGallery();
  }
};

/**
 * Fetch and combine Default + IndexedDB Custom Uploads for a category, excluding deleted items
 */
async function getCombinedItems(category) {
  const deletedIds = window.portfolioStorage ? window.portfolioStorage.getDeletedIds() : new Set();

  const defaultItems = (typeof DEFAULT_GALLERY_ITEMS !== 'undefined' ? DEFAULT_GALLERY_ITEMS : [])
    .filter(i => i.category === category && !deletedIds.has(i.id));
  
  let userItems = [];
  try {
    if (window.portfolioStorage) {
      const allUser = await window.portfolioStorage.getItemsByCategory(category);
      userItems = allUser.filter(i => !deletedIds.has(i.id));
    }
  } catch (err) {
    console.error('Error fetching user uploads for', category, err);
  }

  // User uploaded items appear first, followed by default curated items
  return [...userItems, ...defaultItems];
}

/**
 * Render items in a gallery tab with search and category filters
 */
async function renderGalleryTab(category) {
  const grid = document.getElementById('grid-' + category);
  if (!grid) return;

  const items = await getCombinedItems(category);
  const activeFilter = AppState.activeFilters[category] || 'all';
  const searchQuery = (AppState.searchQueries[category] || '').toLowerCase().trim();

  // Filter items
  const filteredItems = items.filter(item => {
    // Filter chip match
    const matchesFilter = activeFilter === 'all' || 
      (item.tag && item.tag.toLowerCase().includes(activeFilter.toLowerCase())) ||
      (activeFilter === 'custom' && item.isCustom);

    // Search query match
    const matchesSearch = !searchQuery || 
      item.title.toLowerCase().includes(searchQuery) ||
      (item.description && item.description.toLowerCase().includes(searchQuery)) ||
      (item.client && item.client.toLowerCase().includes(searchQuery)) ||
      (item.tag && item.tag.toLowerCase().includes(searchQuery));

    return matchesFilter && matchesSearch;
  });

  // Render Grid
  grid.innerHTML = '';

  if (filteredItems.length === 0) {
    grid.innerHTML = '';
    return;
  }

  filteredItems.forEach(item => {
    const card = document.createElement('div');
    card.className = 'gallery-card';
    const isVideo = item.mediaType === 'video' || category === 'ai-videos';

    // Determine aspect ratio class
    let aspectClass = 'aspect-16-9';
    if (category === 'social-media') {
      aspectClass = item.aspect === '4:5' ? 'aspect-4-5' : 'aspect-1-1';
    } else if (category === 'movie-posters') {
      aspectClass = 'aspect-2-3';
    } else if (category === 'ai-videos') {
      aspectClass = item.aspect === '9:16' ? 'aspect-4-5' : 'aspect-16-9';
    }

    // Media Thumbnail Tag
    let mediaTag = '';
    const hasImageThumb = item.thumbnailUrl && (item.thumbnailUrl.startsWith('data:image/') || item.thumbnailUrl.match(/\.(jpg|jpeg|png|webp|gif)/i));

    if (isVideo) {
      const posterAttr = hasImageThumb ? `poster="${item.thumbnailUrl}"` : '';
      mediaTag = `<video src="${item.mediaUrl}#t=0.5" ${posterAttr} class="card-media-item video-card-thumb" muted playsinline preload="auto" loop></video>`;
    } else {
      mediaTag = `<img src="${item.thumbnailUrl || item.mediaUrl}" alt="${item.title || 'Artwork'}" class="card-media-item" loading="lazy" />`;
    }
    
    // Play overlay for video
    let playOverlay = '';
    if (isVideo) {
      playOverlay = `
        <div class="card-play-overlay">
          <i class="fas fa-play"></i>
        </div>
        ${item.duration ? `<div class="card-duration-badge">${item.duration}</div>` : ''}
      `;
    }

    card.innerHTML = `
      <div class="card-media-wrapper ${aspectClass}">
        ${mediaTag}
        ${playOverlay}
        <button class="card-delete-btn" title="Delete ${isVideo ? 'Video' : 'Artwork'}" aria-label="Delete">
          <i class="fas fa-trash-can"></i>
        </button>
      </div>
    `;

    // Video hover preview
    if (isVideo) {
      card.addEventListener('mouseenter', () => {
        const vid = card.querySelector('video.video-card-thumb');
        if (vid && vid.paused) {
          vid.play().catch(() => {});
        }
      });
      card.addEventListener('mouseleave', () => {
        const vid = card.querySelector('video.video-card-thumb');
        if (vid) {
          vid.pause();
          vid.currentTime = 0.5;
        }
      });
    }

    // Direct card delete button listener
    const deleteBtn = card.querySelector('.card-delete-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        window.deleteGalleryItem(item.id, item.title, isVideo);
      });
    }

    // Click to open in large lightbox
    card.addEventListener('click', () => {
      window.lightbox.open(item, filteredItems);
    });

    grid.appendChild(card);
  });
}

/**
 * Attach listeners for filter chips and search inputs
 */
function setupGalleryControls() {
  const categories = ['social-media', 'youtube-thumbnails', 'movie-posters', 'ai-videos'];

  categories.forEach(cat => {
    // Filter chips
    const chipContainer = document.getElementById('filters-' + cat);
    if (chipContainer) {
      chipContainer.querySelectorAll('.filter-chip').forEach(chip => {
        chip.addEventListener('click', () => {
          chipContainer.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
          AppState.activeFilters[cat] = chip.getAttribute('data-filter');
          renderGalleryTab(cat);
        });
      });
    }

    // Search inputs
    const searchInput = document.getElementById('search-' + cat);
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        AppState.searchQueries[cat] = e.target.value;
        renderGalleryTab(cat);
      });
    }
  });
}

/**
 * Handle Contact Form submission
 */
function setupContactForm() {
  const contactForm = document.getElementById('contactForm');
  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const submitBtn = contactForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending message...';

      setTimeout(() => {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
        contactForm.reset();
        window.showToast('🚀 Thank you! Your message has been sent successfully.', '✅');
      }, 900);
    });
  }
}

/**
 * Setup navigation listeners
 */
function setupNavigation() {
  // Nav buttons
  document.querySelectorAll('.nav-item-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const tabId = btn.getAttribute('data-tab');
      if (tabId) window.switchTab(tabId);
    });
  });

  // Mobile hamburger button
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const mobileDrawer = document.getElementById('mobileNavDrawer');
  if (hamburgerBtn && mobileDrawer) {
    hamburgerBtn.addEventListener('click', () => {
      mobileDrawer.classList.toggle('open');
    });
  }

  // Brand logo click goes to home
  const brandLogo = document.getElementById('brandLogo');
  if (brandLogo) {
    brandLogo.addEventListener('click', () => window.switchTab('home'));
  }

  // Handle URL hash on load
  const initialHash = window.location.hash.replace('#', '').split('?')[0];
  if (initialHash && ['home', 'about', 'social-media', 'youtube-thumbnails', 'movie-posters', 'ai-videos', 'contact'].includes(initialHash)) {
    window.switchTab(initialHash);
  } else {
    window.switchTab('home');
  }

  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace('#', '').split('?')[0];
    if (hash && hash !== AppState.currentTab) {
      window.switchTab(hash);
    }
  });
}

// Initial Boot on DOM Ready
document.addEventListener('DOMContentLoaded', async () => {
  if (window.portfolioStorage && window.portfolioStorage.deleteItemByTitleOrMatch) {
    await window.portfolioStorage.deleteItemByTitleOrMatch('Hairstyle');
  }
  setupNavigation();
  setupGalleryControls();
  setupContactForm();
});
