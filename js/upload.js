/**
 * Upload System Controller
 * Handles drag-and-drop, batch multi-video processing, IndexedDB saving, and preview generation.
 */

class UploadController {
  constructor() {
    this.selectedFiles = []; // Array of File objects
    this.singleDataUrl = null;
    this.singleThumbnailUrl = null;

    // Elements
    this.modal = document.getElementById('uploadModal');
    this.closeBtn = document.getElementById('uploadModalCloseBtn');
    this.dropzone = document.getElementById('uploadDropzone');
    this.fileInput = document.getElementById('mediaFileInput');
    this.previewContainer = document.getElementById('uploadPreviewContainer');
    this.form = document.getElementById('uploadForm');
    this.categorySelect = document.getElementById('uploadCategory');
    this.submitBtn = this.form ? this.form.querySelector('.upload-submit-btn') : null;
    this.discardBtn = document.getElementById('uploadDiscardBtn');

    this.initEvents();
  }

  initEvents() {
    // Close modal triggers
    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.close());
    }

    if (this.modal) {
      this.modal.addEventListener('click', (e) => {
        if (e.target === this.modal) {
          this.close();
        }
      });
    }

    // Dropzone click triggers file picker
    if (this.dropzone && this.fileInput) {
      this.dropzone.addEventListener('click', () => {
        this.fileInput.click();
      });

      // Drag & Drop events
      ['dragenter', 'dragover'].forEach(eventName => {
        this.dropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.dropzone.classList.add('drag-over');
        });
      });

      ['dragleave', 'drop'].forEach(eventName => {
        this.dropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.dropzone.classList.remove('drag-over');
        });
      });

      this.dropzone.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
          this.handleFiles(files);
        }
      });

      this.fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
          this.handleFiles(e.target.files);
        }
      });
    }

    // Discard / Delete upload button in form actions
    if (this.discardBtn) {
      this.discardBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.resetFile();
        window.showToast('🗑️ Selected files were removed.', '🗑️');
      });
    }

    // Form submit
    if (this.form) {
      this.form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleSubmit();
      });
    }
  }

  open(preselectedCategory = null) {
    if (preselectedCategory && this.categorySelect) {
      this.categorySelect.value = preselectedCategory;
    }
    this.modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  close() {
    this.modal.classList.remove('active');
    document.body.style.overflow = '';
    this.resetForm();
  }

  async captureVideoThumbnail(file) {
    return new Promise((resolve) => {
      try {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.muted = true;
        video.playsInline = true;
        const url = URL.createObjectURL(file);
        video.src = url;

        let finished = false;
        const done = (data) => {
          if (!finished) {
            finished = true;
            URL.revokeObjectURL(url);
            resolve(data);
          }
        };

        video.onloadeddata = () => {
          video.currentTime = Math.min(0.5, (video.duration || 1) / 2);
        };

        video.onseeked = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 360;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const thumb = canvas.toDataURL('image/jpeg', 0.85);
            done(thumb);
          } catch (e) {
            done(null);
          }
        };

        video.onerror = () => done(null);
        setTimeout(() => done(null), 3000);
      } catch (err) {
        resolve(null);
      }
    });
  }

  readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(file);
    });
  }

  formatFileSize(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  async handleFiles(fileList) {
    if (!fileList || fileList.length === 0) return;

    const validFiles = Array.from(fileList).filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'));
    if (validFiles.length === 0) {
      window.showToast('Please select valid image (PNG/JPG) or video (MP4/WEBM) files', '⚠️');
      return;
    }

    this.selectedFiles = validFiles;
    const count = validFiles.length;
    const hasVideo = validFiles.some(f => f.type.startsWith('video/'));

    // Automatically set category to 'ai-videos' if uploading videos and on default or empty
    if (hasVideo && this.categorySelect && (this.categorySelect.value === 'social-media' || !this.categorySelect.value)) {
      this.categorySelect.value = 'ai-videos';
    }

    if (count === 1) {
      // Single file preview
      const file = validFiles[0];
      const isVideo = file.type.startsWith('video/');
      const dataUrl = await this.readFileAsDataURL(file);
      this.singleDataUrl = dataUrl;

      if (isVideo) {
        this.captureVideoThumbnail(file).then(thumb => {
          this.singleThumbnailUrl = thumb;
        });
      }

      this.showSinglePreview(dataUrl, isVideo, file.name);
    } else {
      // Multiple files preview (e.g. 10 videos)
      this.showBatchPreview(validFiles);
    }
  }

  showSinglePreview(src, isVideo, filename = '') {
    this.previewContainer.innerHTML = '';
    
    const topBar = document.createElement('div');
    topBar.className = 'preview-top-bar';
    topBar.innerHTML = `
      <span class="preview-type-badge">
        <i class="fas ${isVideo ? 'fa-video' : 'fa-image'}"></i>
        ${isVideo ? 'Video Selected' : 'Image Selected'}: ${filename}
      </span>
      <button type="button" class="preview-delete-btn" id="previewDeleteBtn" title="Remove file">
        <i class="fas fa-trash-can"></i> Discard
      </button>
    `;
    this.previewContainer.appendChild(topBar);

    if (isVideo) {
      const video = document.createElement('video');
      video.className = 'upload-preview-media';
      video.src = src;
      video.controls = true;
      video.autoplay = false;
      this.previewContainer.appendChild(video);
    } else {
      const img = document.createElement('img');
      img.className = 'upload-preview-media';
      img.src = src;
      this.previewContainer.appendChild(img);
    }

    const delBtn = topBar.querySelector('#previewDeleteBtn');
    if (delBtn) {
      delBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.resetFile();
      });
    }

    this.previewContainer.classList.add('has-preview');
    this.dropzone.style.display = 'none';

    if (this.submitBtn) {
      this.submitBtn.innerHTML = `<i class="fas fa-check-circle"></i> Save to Portfolio`;
    }
    if (this.discardBtn) {
      this.discardBtn.style.display = 'inline-flex';
      this.discardBtn.innerHTML = `<i class="fas fa-trash-can"></i> Discard`;
    }
  }

  showBatchPreview(files) {
    this.previewContainer.innerHTML = '';

    const videoCount = files.filter(f => f.type.startsWith('video/')).length;
    const label = videoCount === files.length 
      ? `${files.length} Videos Selected` 
      : `${files.length} Files Selected (${videoCount} Videos)`;

    const topBar = document.createElement('div');
    topBar.className = 'preview-top-bar';
    topBar.innerHTML = `
      <span class="preview-type-badge">
        <i class="fas fa-layer-group"></i> ${label}
      </span>
      <button type="button" class="preview-delete-btn" id="previewClearBatchBtn" title="Clear all files">
        <i class="fas fa-trash-can"></i> Clear All
      </button>
    `;
    this.previewContainer.appendChild(topBar);

    const list = document.createElement('div');
    list.className = 'batch-files-list';
    files.forEach((f, idx) => {
      const isVid = f.type.startsWith('video/');
      const item = document.createElement('div');
      item.className = 'batch-file-item';
      item.innerHTML = `
        <i class="fas ${isVid ? 'fa-file-video' : 'fa-file-image'}"></i>
        <span class="batch-file-name">${idx + 1}. ${f.name}</span>
        <span class="batch-file-size">${this.formatFileSize(f.size)}</span>
      `;
      list.appendChild(item);
    });
    this.previewContainer.appendChild(list);

    const clearBtn = topBar.querySelector('#previewClearBatchBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.resetFile();
      });
    }

    this.previewContainer.classList.add('has-preview');
    this.dropzone.style.display = 'none';

    if (this.submitBtn) {
      const btnText = videoCount > 0 
        ? `Upload All ${files.length} Videos to Portfolio`
        : `Upload All ${files.length} Files to Portfolio`;
      this.submitBtn.innerHTML = `<i class="fas fa-cloud-arrow-up"></i> ${btnText}`;
    }
    if (this.discardBtn) {
      this.discardBtn.style.display = 'inline-flex';
      this.discardBtn.innerHTML = `<i class="fas fa-trash-can"></i> Clear All`;
    }
  }

  resetFile() {
    this.selectedFiles = [];
    this.singleDataUrl = null;
    this.singleThumbnailUrl = null;
    if (this.fileInput) this.fileInput.value = '';
    this.previewContainer.innerHTML = '';
    this.previewContainer.classList.remove('has-preview');
    this.dropzone.style.display = 'block';

    if (this.submitBtn) {
      this.submitBtn.disabled = false;
      this.submitBtn.innerHTML = `<i class="fas fa-check-circle"></i> Save to Portfolio`;
    }
    if (this.discardBtn) {
      this.discardBtn.style.display = 'none';
    }
  }

  resetForm() {
    this.resetFile();
    if (this.form) this.form.reset();
  }

  async handleSubmit() {
    if (!this.selectedFiles || this.selectedFiles.length === 0) {
      window.showToast('Please select one or more files to upload!', '⚠️');
      return;
    }

    const category = this.categorySelect ? this.categorySelect.value : 'ai-videos';
    const total = this.selectedFiles.length;

    if (this.submitBtn) {
      this.submitBtn.disabled = true;
      this.submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Uploading 1 of ${total}...`;
    }

    window.showToast(`Processing ${total} file${total > 1 ? 's' : ''}...`, '⏳');
    let savedCount = 0;

    for (let i = 0; i < total; i++) {
      const file = this.selectedFiles[i];
      const isVideo = file.type.startsWith('video/');

      if (this.submitBtn) {
        this.submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Uploading ${i + 1} of ${total}...`;
      }

      try {
        let dataUrl = (total === 1 && this.singleDataUrl) ? this.singleDataUrl : await this.readFileAsDataURL(file);
        let thumbUrl = (total === 1 && this.singleThumbnailUrl) ? this.singleThumbnailUrl : null;

        if (isVideo && !thumbUrl) {
          thumbUrl = await this.captureVideoThumbnail(file);
        }

        const newItem = {
          id: 'custom-' + Date.now() + '-' + i + '-' + Math.random().toString(36).substr(2, 6),
          category: category,
          title: '',
          client: '',
          tag: '',
          description: '',
          mediaType: isVideo ? 'video' : 'image',
          mediaUrl: dataUrl,
          thumbnailUrl: thumbUrl || dataUrl,
          date: '',
          isCustom: true,
          timestamp: Date.now() + (total - i)
        };

        await window.portfolioStorage.addItem(newItem);
        savedCount++;
      } catch (err) {
        console.error('Failed to save file:', file.name, err);
      }
    }

    if (this.submitBtn) {
      this.submitBtn.disabled = false;
      this.submitBtn.innerHTML = `<i class="fas fa-check-circle"></i> Save to Portfolio`;
    }

    window.showToast(`✨ Successfully published ${savedCount} video${savedCount > 1 ? 's' : ''} to ${category.replace('-', ' ')}!`, '🎉');
    this.close();

    if (window.switchTab) {
      window.switchTab(category);
    }
    if (window.renderActiveGallery) {
      window.renderActiveGallery();
    }
  }
}

// Global initialization
window.uploader = new UploadController();
