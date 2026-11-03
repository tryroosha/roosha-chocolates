class HeaderOverflowMenu extends HTMLElement {
  connectedCallback() {
    this.list = this.querySelector('[data-overflow-list]');
    this.moreItem = this.querySelector('[data-overflow-more]');
    this.moreList = this.querySelector('[data-overflow-more-list]');
    this.moreDetails = this.moreItem?.querySelector('details');

    if (!this.list || !this.moreItem || !this.moreList) return;

    this.items = Array.from(this.list.children).filter((item) => item !== this.moreItem);
    this.mql = window.matchMedia('(min-width: 990px)');
    this.frame = null;

    this.recalculate = this.recalculate.bind(this);
    this.schedule = this.schedule.bind(this);

    this.resizeObserver = new ResizeObserver(this.schedule);
    this.resizeObserver.observe(this);
    this.mql.addEventListener('change', this.schedule);

    if (document.fonts?.ready) {
      document.fonts.ready.then(this.schedule);
    }

    this.schedule();
  }

  disconnectedCallback() {
    this.resizeObserver?.disconnect();
    this.mql?.removeEventListener('change', this.schedule);
    if (this.frame) cancelAnimationFrame(this.frame);
  }

  schedule() {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(this.recalculate);
  }

  restore() {
    this.items.forEach((item) => this.list.insertBefore(item, this.moreItem));
    this.moreItem.hidden = true;
    this.moreDetails?.removeAttribute('open');
  }

  fits() {
    return this.list.scrollWidth <= this.list.clientWidth + 1;
  }

  recalculate() {
    this.restore();
    if (!this.mql.matches) return;

    if (this.fits()) return;

    this.moreItem.hidden = false;

    while (!this.fits() && this.moreItem.previousElementSibling) {
      this.moreList.prepend(this.moreItem.previousElementSibling);
    }

    if (!this.moreList.children.length) {
      this.moreItem.hidden = true;
    }
  }
}

customElements.define('header-overflow-menu', HeaderOverflowMenu);
