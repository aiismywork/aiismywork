/**
 * Lightbox & Modal Viewer Controller
 * Handles full-size image viewing, video playback, cross close button, and navigation.
 */

class LightboxController {
  constructor() {
    this.currentItem = null;
    this.currentList = [];
    this.currentIndex = -1;

    // Elements
    this.backdrop = document.getElementById('lightboxModal');
    this.closeBtn = document.getElementById('lightboxCloseBtn');
    this.prevBtn = document.getElementById('lightboxPrevBtn');
    this.nextBtn = document.getElementById('lightboxNextBtn');
    this.titleEl = document.getElementById('lightboxTitle');
    this.categoryEl = document.getElementById('lightboxCategory');
    this.descEl = document.getElementById('lightboxDesc');
    this.dateEl = document.getElementById('lightboxDate');
    this.clientEl = document.getElementById('lightboxClient');
    this.mediaContainer = document.getElementById('lightboxMediaContainer');
    this.downloadBtn = document.getElementById('lightboxDownloadBtn');
    this.shareBtn = document.getElementById('lightboxShareBtn');
    this.deleteBtn = document.getElementById('lightboxDeleteBtn');

    this.initEvents();
  }

  initEvents() {
    // Cross Close Button
    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.close());
    }

    // Click outside lightbox window to close
    if (this.backdrop) {
      this.backdrop.addEventListener('click', (e) => {
        if (e.target === this.backdrop) {
          this.close();
        }
      });
    }

    // Prev / Next Navigation
    if (this.prevBtn) {
      this.prevBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.prev();
      });
    }

    if (this.nextBtn) {
      this.nextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.next();
      });
    }

    // Keyboard controls
    document.addEventListener('keydown', (e) => {
      if (!this.isOpen()) return;

      if (e.key === 'Escape') {
        this.close();
      } else if (e.key === 'ArrowLeft') {
        this.prev();
      } else if (e.key === 'ArrowRight') {
        this.next();
      }
    });

    // Share / Copy Link
    if (this.shareBtn) {
      this.shareBtn.addEventListener('click', () => {
        if (!this.currentItem) return;
        const shareUrl = window.location.origin + window.location.pathname + '#' + this.currentItem.category + '?item=' + this.currentItem.id;
        if (navigator.clipboard) {
          navigator.clipboard.writeText(shareUrl).then(() => {
            window.showToast('Link copied to clipboard!', '🔗');
          }).catch(() => {
            window.showToast('Copied item link!', '🔗');
          });
        } else {
          window.showToast('Sharing ' + this.currentItem.title, '🚀');
        }
      });
    }

    // Download media
    if (this.downloadBtn) {
      this.downloadBtn.addEventListener('click', () => {
        if (!this.currentItem) return;
        const link = document.createElement('a');
        link.href = this.currentItem.mediaUrl;
        link.download = (this.currentItem.title || 'media').toLowerCase().replace(/\s+/g, '-') + (this.currentItem.mediaType === 'video' ? '.mp4' : '.jpg');
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.showToast('Downloading media...', '💾');
      });
    }

    // Delete video or artwork from lightbox
    if (this.deleteBtn) {
      this.deleteBtn.addEventListener('click', async () => {
        if (!this.currentItem) return;
        const isVideo = this.currentItem.mediaType === 'video' || this.currentItem.category === 'ai-videos';
        const label = isVideo ? 'video' : 'artwork';
        if (window.deleteGalleryItem) {
          await window.deleteGalleryItem(this.currentItem.id, this.currentItem.title, isVideo);
        }
      });
    }
  }

  isOpen() {
    return this.backdrop && this.backdrop.classList.contains('active');
  }

  open(item, list = []) {
    this.currentItem = item;
    this.currentList = list;
    this.currentIndex = list.findIndex(i => i.id === item.id);

    this.render();
    this.backdrop.classList.add('active');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
  }

  close() {
    if (!this.backdrop) return;
    this.backdrop.classList.remove('active');
    document.body.style.overflow = '';

    // Stop any playing video
    const video = this.mediaContainer.querySelector('video');
    if (video) {
      video.pause();
      video.src = '';
    }
  }

  prev() {
    if (this.currentList.length <= 1) return;
    this.currentIndex = (this.currentIndex - 1 + this.currentList.length) % this.currentList.length;
    this.currentItem = this.currentList[this.currentIndex];
    this.render();
  }

  next() {
    if (this.currentList.length <= 1) return;
    this.currentIndex = (this.currentIndex + 1) % this.currentList.length;
    this.currentItem = this.currentList[this.currentIndex];
    this.render();
  }

  render() {
    if (!this.currentItem) return;
    const item = this.currentItem;
    const isVideo = item.mediaType === 'video' || item.category === 'ai-videos';

    // Header Details
    if (this.titleEl) this.titleEl.textContent = item.title;
    if (this.categoryEl) this.categoryEl.textContent = item.tag || item.category.replace('-', ' ');
    if (this.descEl) this.descEl.textContent = item.description || 'Exclusive portfolio creative piece.';
    if (this.dateEl) this.dateEl.textContent = item.date || 'Recent';
    if (this.clientEl) this.clientEl.textContent = item.client ? `Client: ${item.client}` : 'Personal Project';

    // Delete Button always available for user control
    if (this.deleteBtn) {
      this.deleteBtn.style.display = 'inline-flex';
      this.deleteBtn.innerHTML = `<i class="fas fa-trash-can"></i> ${isVideo ? 'Delete Video' : 'Delete Artwork'}`;
    }

    // Render Media (Image or Video)
    this.mediaContainer.innerHTML = '';
    if (item.mediaType === 'video') {
      const video = document.createElement('video');
      video.className = 'lightbox-video';
      video.src = item.mediaUrl;
      video.controls = true;
      video.autoplay = true;
      video.playsInline = true;
      video.loop = true;
      this.mediaContainer.appendChild(video);
    } else {
      const img = document.createElement('img');
      img.className = 'lightbox-image';
      img.src = item.mediaUrl || item.thumbnailUrl;
      img.alt = item.title;
      this.mediaContainer.appendChild(img);
    }

    // Toggle nav buttons visibility if single item
    if (this.prevBtn && this.nextBtn) {
      const showArrows = this.currentList.length > 1;
      this.prevBtn.style.display = showArrows ? 'flex' : 'none';
      this.nextBtn.style.display = showArrows ? 'flex' : 'none';
    }
  }
}

// Global initialization
window.lightbox = new LightboxController();
