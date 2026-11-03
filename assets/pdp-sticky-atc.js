(() => {
  class PdpStickyAtc {
    constructor(root) {
      this.root = root;
      this.sectionId = root.dataset.sectionId;
      this.observeSelector = root.dataset.observe;
      this.submitBtn = root.querySelector(`#PdpStickySubmit-${this.sectionId}`);
      this.mq = window.matchMedia('(max-width: 749px)');
      this.observer = null;

      this.submitBtn?.addEventListener('click', () => {
        const targetId = this.submitBtn.dataset.targetSubmit;
        const target = targetId ? document.getElementById(targetId) : null;
        if (target && !target.disabled && target.getAttribute('aria-disabled') !== 'true') {
          target.click();
        }
      });

      this.onMqChange = this.onMqChange.bind(this);
      this.mq.addEventListener('change', this.onMqChange);
      this.onMqChange();
    }

    onMqChange() {
      if (this.mq.matches) {
        this.enable();
      } else {
        this.disable();
      }
    }

    enable() {
      const target = document.querySelector(this.observeSelector);
      if (!target) return;

      this.root.hidden = false;
      this.observer?.disconnect();
      this.observer = new IntersectionObserver(
        ([entry]) => {
          this.root.classList.toggle('is-visible', !entry.isIntersecting);
        },
        { root: null, threshold: 0, rootMargin: '0px 0px -8px 0px' }
      );
      this.observer.observe(target);
    }

    disable() {
      this.observer?.disconnect();
      this.observer = null;
      this.root.classList.remove('is-visible');
      this.root.hidden = true;
    }
  }

  const init = () => {
    document.querySelectorAll('.pdp-sticky-atc').forEach((el) => {
      if (el.dataset.pdpStickyInit) return;
      el.dataset.pdpStickyInit = 'true';
      new PdpStickyAtc(el);
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  document.addEventListener('shopify:section:load', init);
})();
