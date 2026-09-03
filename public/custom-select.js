/**
 * CustomSelect - Tailored zero-dependency modern dark-theme dropdown component
 * Engineered for Yom Kippur Diabetes Timer
 * 
 * Features:
 * - 100% theme integration (glassmorphism, cyan/purple glow, dark palette)
 * - Bi-directional sync with underlying native <select> elements
 * - Seamless i18n & RTL (Hebrew/English) support
 * - Full keyboard navigation (Arrow keys, Enter, Space, Escape, Tab)
 * - Safe for Cat Lockout Shield (respects body.app-locked)
 * - Guaranteed top-layer z-index & auto upward/downward positioning
 */

class CustomSelectManager {
  constructor() {
    this.instances = new Map(); // selectEl -> CustomSelectInstance
    this.activeOpenInstance = null;
    this._initGlobalListeners();
  }

  _initGlobalListeners() {
    // Global click outside to close dropdowns
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.custom-select-wrapper')) {
        this.closeAll();
      }
    });

    // Global keyboard listener for Esc to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.activeOpenInstance) {
        this.activeOpenInstance.close();
      }
    });
  }

  /**
   * Initialize a single <select> element or selector
   */
  init(selectElement, options = {}) {
    const el = typeof selectElement === 'string' ? document.querySelector(selectElement) : selectElement;
    if (!el || el.tagName !== 'SELECT') return null;

    if (this.instances.has(el)) {
      const existing = this.instances.get(el);
      existing.sync();
      return existing;
    }

    const instance = new CustomSelectInstance(el, this, options);
    this.instances.set(el, instance);
    return instance;
  }

  /**
   * Initialize all target select elements in a container or whole document
   */
  initAll(container = document) {
    const selector = 'select#selectLanguageHeader, select#selectFastEndExtra, select#selectQuickSoundProfile, select#selectModalLanguage, select#selectFastScheduleMode, select#selectModalSoundProfile, select#inputAutoShutoff, select#selectLibreRegion, select.custom-select-init, select.form-select, select.form-select-compact, select.form-select-extra, select.header-lang-select';
    const selects = container.querySelectorAll(selector);
    selects.forEach((sel) => {
      this.init(sel);
    });
  }

  /**
   * Sync a specific select element or all instances
   */
  sync(selectElement) {
    if (!selectElement) {
      this.syncAll();
      return;
    }
    const el = typeof selectElement === 'string' ? document.querySelector(selectElement) : selectElement;
    if (el && this.instances.has(el)) {
      this.instances.get(el).sync();
    } else if (el) {
      this.init(el);
    }
  }

  syncAll() {
    this.instances.forEach((instance) => {
      instance.sync();
    });
  }

  closeAll(exceptInstance = null) {
    this.instances.forEach((instance) => {
      if (instance !== exceptInstance) {
        instance.close();
      }
    });
    if (!exceptInstance) {
      this.activeOpenInstance = null;
    }
  }
}

class CustomSelectInstance {
  constructor(selectEl, manager, options = {}) {
    this.selectEl = selectEl;
    this.manager = manager;
    this.options = options;
    this.isOpen = false;
    this.highlightedIndex = -1;

    this._buildUI();
    this._bindEvents();
    this.sync();
  }

  _buildUI() {
    // Hide the native select visually but keep it accessible & form-connected
    this.selectEl.classList.add('custom-select-native-hidden');
    this.selectEl.setAttribute('tabindex', '-1');
    this.selectEl.setAttribute('aria-hidden', 'true');

    // Create wrapper
    this.wrapper = document.createElement('div');
    this.wrapper.className = 'custom-select-wrapper';
    this.wrapper.setAttribute('data-select-id', this.selectEl.id || '');

    // Inherit relevant variant classes
    if (this.selectEl.classList.contains('header-lang-select')) {
      this.wrapper.classList.add('custom-select-header-lang');
    }
    if (this.selectEl.classList.contains('form-select-extra')) {
      this.wrapper.classList.add('custom-select-extra');
    }
    if (this.selectEl.classList.contains('form-select-compact')) {
      this.wrapper.classList.add('custom-select-compact');
    }
    if (this.selectEl.classList.contains('form-select') || this.selectEl.closest('.modal-body')) {
      this.wrapper.classList.add('custom-select-form');
    }

    // Trigger button / box
    this.trigger = document.createElement('button');
    this.trigger.type = 'button';
    this.trigger.className = 'custom-select-trigger';
    this.trigger.setAttribute('aria-haspopup', 'listbox');
    this.trigger.setAttribute('aria-expanded', 'false');

    // Trigger value text label
    this.triggerLabel = document.createElement('span');
    this.triggerLabel.className = 'custom-select-label';

    // Trigger arrow icon
    this.triggerArrow = document.createElement('span');
    this.triggerArrow.className = 'custom-select-arrow';
    this.triggerArrow.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    `;

    this.trigger.appendChild(this.triggerLabel);
    this.trigger.appendChild(this.triggerArrow);
    this.wrapper.appendChild(this.trigger);

    // Dropdown popover
    this.dropdown = document.createElement('div');
    this.dropdown.className = 'custom-select-dropdown';
    this.dropdown.setAttribute('role', 'listbox');
    this.dropdown.setAttribute('tabindex', '-1');

    this.optionsList = document.createElement('div');
    this.optionsList.className = 'custom-select-options-list';
    this.dropdown.appendChild(this.optionsList);

    this.wrapper.appendChild(this.dropdown);

    // Insert wrapper right after the native select
    this.selectEl.parentNode.insertBefore(this.wrapper, this.selectEl.nextSibling);
  }

  _bindEvents() {
    // Toggle on trigger click
    this.trigger.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (document.body.classList.contains('app-locked')) return;
      this.toggle();
    });

    // Keyboard navigation on trigger
    this.trigger.addEventListener('keydown', (e) => {
      if (document.body.classList.contains('app-locked')) return;

      const options = Array.from(this.optionsList.querySelectorAll('.custom-select-option:not(.disabled)'));
      if (options.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (!this.isOpen) {
          this.open();
        } else {
          this.highlightNext();
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (!this.isOpen) {
          this.open();
        } else {
          this.highlightPrev();
        }
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (this.isOpen) {
          if (this.highlightedIndex >= 0 && options[this.highlightedIndex]) {
            const val = options[this.highlightedIndex].getAttribute('data-value');
            this.selectValue(val);
          }
          this.close();
        } else {
          this.open();
        }
      } else if (e.key === 'Tab') {
        if (this.isOpen) {
          this.close();
        }
      } else if (e.key === 'Home' && this.isOpen) {
        e.preventDefault();
        this.highlightIndex(0);
      } else if (e.key === 'End' && this.isOpen) {
        e.preventDefault();
        this.highlightIndex(options.length - 1);
      }
    });

    // Native select change event listener (if updated elsewhere)
    this.selectEl.addEventListener('change', () => {
      this.sync();
    });
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  open() {
    if (this.isOpen) return;
    if (document.body.classList.contains('app-locked')) return;

    this.manager.closeAll(this);
    this.isOpen = true;
    this.manager.activeOpenInstance = this;

    // Viewport safety: auto-detect if dropdown should open upwards or downwards
    try {
      const triggerRect = this.trigger.getBoundingClientRect();
      const dropdownEstimate = 220;
      const spaceBelow = window.innerHeight - triggerRect.bottom;
      const spaceAbove = triggerRect.top;

      if (spaceBelow < dropdownEstimate && spaceAbove > spaceBelow) {
        this.wrapper.classList.add('open-upwards');
      } else {
        this.wrapper.classList.remove('open-upwards');
      }
    } catch (e) {}

    this.wrapper.classList.add('is-open');
    this.trigger.setAttribute('aria-expanded', 'true');

    // Scroll selected option into view
    const selected = this.optionsList.querySelector('.custom-select-option.is-selected');
    if (selected) {
      const options = Array.from(this.optionsList.querySelectorAll('.custom-select-option:not(.disabled)'));
      this.highlightedIndex = options.indexOf(selected);
      this._updateHighlightClass(options);
      setTimeout(() => {
        selected.scrollIntoView({ block: 'nearest' });
      }, 10);
    }
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.wrapper.classList.remove('is-open');
    this.wrapper.classList.remove('open-upwards');
    this.trigger.setAttribute('aria-expanded', 'false');
    this.highlightedIndex = -1;
    this._updateHighlightClass([]);
    if (this.manager.activeOpenInstance === this) {
      this.manager.activeOpenInstance = null;
    }
  }

  highlightNext() {
    const options = Array.from(this.optionsList.querySelectorAll('.custom-select-option:not(.disabled)'));
    if (options.length === 0) return;
    this.highlightedIndex = (this.highlightedIndex + 1) % options.length;
    this._updateHighlightClass(options);
  }

  highlightPrev() {
    const options = Array.from(this.optionsList.querySelectorAll('.custom-select-option:not(.disabled)'));
    if (options.length === 0) return;
    this.highlightedIndex = (this.highlightedIndex - 1 + options.length) % options.length;
    this._updateHighlightClass(options);
  }

  highlightIndex(index) {
    const options = Array.from(this.optionsList.querySelectorAll('.custom-select-option:not(.disabled)'));
    if (options.length === 0 || index < 0 || index >= options.length) return;
    this.highlightedIndex = index;
    this._updateHighlightClass(options);
  }

  _updateHighlightClass(options) {
    options.forEach((opt, idx) => {
      if (idx === this.highlightedIndex) {
        opt.classList.add('is-highlighted');
        opt.scrollIntoView({ block: 'nearest' });
      } else {
        opt.classList.remove('is-highlighted');
      }
    });
  }

  selectValue(value) {
    if (this.selectEl.value !== value) {
      this.selectEl.value = value;
      // Dispatch standard change event on native select so existing listeners fire
      const evt = new Event('change', { bubbles: true });
      this.selectEl.dispatchEvent(evt);
    }
    this.sync();
    this.close();
    this.trigger.focus();
  }

  /**
   * Re-reads the native select options and selected value, updating the custom UI
   */
  sync() {
    if (!this.selectEl) return;

    // Clear and rebuild options
    this.optionsList.innerHTML = '';
    const nativeOptions = Array.from(this.selectEl.options);
    let selectedText = '';

    nativeOptions.forEach((nativeOpt) => {
      const optionEl = document.createElement('div');
      optionEl.className = 'custom-select-option';
      optionEl.setAttribute('role', 'option');
      optionEl.setAttribute('data-value', nativeOpt.value);

      const isSelected = nativeOpt.selected || nativeOpt.value === this.selectEl.value;
      if (isSelected) {
        optionEl.classList.add('is-selected');
        optionEl.setAttribute('aria-selected', 'true');
        selectedText = nativeOpt.textContent;
      } else {
        optionEl.setAttribute('aria-selected', 'false');
      }

      if (nativeOpt.disabled) {
        optionEl.classList.add('disabled');
      }

      // Label
      const labelSpan = document.createElement('span');
      labelSpan.className = 'custom-option-text';
      labelSpan.textContent = nativeOpt.textContent;

      // Checkmark icon for selected item
      const checkSpan = document.createElement('span');
      checkSpan.className = 'custom-option-check';
      checkSpan.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      `;

      optionEl.appendChild(labelSpan);
      optionEl.appendChild(checkSpan);

      // Click to select
      optionEl.addEventListener('click', (e) => {
        e.stopPropagation();
        if (nativeOpt.disabled) return;
        this.selectValue(nativeOpt.value);
      });

      this.optionsList.appendChild(optionEl);
    });

    // Fallback if no option matched
    if (!selectedText && nativeOptions.length > 0) {
      selectedText = nativeOptions[0].textContent;
    }

    this.triggerLabel.textContent = selectedText;

    // If disabled on native select
    if (this.selectEl.disabled) {
      this.wrapper.classList.add('is-disabled');
      this.trigger.disabled = true;
    } else {
      this.wrapper.classList.remove('is-disabled');
      this.trigger.disabled = false;
    }
  }

  destroy() {
    this.selectEl.classList.remove('custom-select-native-hidden');
    this.selectEl.removeAttribute('tabindex');
    this.selectEl.removeAttribute('aria-hidden');
    if (this.wrapper && this.wrapper.parentNode) {
      this.wrapper.parentNode.removeChild(this.wrapper);
    }
    this.manager.instances.delete(this.selectEl);
  }
}

// Global Singleton
const CustomSelect = new CustomSelectManager();

// Expose globally
if (typeof window !== 'undefined') {
  window.CustomSelect = CustomSelect;
  
  // Auto-init on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      CustomSelect.initAll();
    });
  } else {
    // DOM already loaded
    setTimeout(() => {
      CustomSelect.initAll();
    }, 0);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CustomSelectManager, CustomSelect };
}
