class InfiniteScroll extends HTMLElement {
  constructor() {
    super();
    this.loading = false;
    this.observer = null;
  }

  connectedCallback() {
    this.grid = document.getElementById('product-grid');
    this.spinner = this.querySelector('.loading__spinner');
    this.nextUrl = this.dataset.nextUrl;

    if (!this.grid || !this.nextUrl) return;

    this.observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) this.loadMore();
      },
      { rootMargin: '400px 0px' }
    );

    this.observer.observe(this);
  }

  disconnectedCallback() {
    if (this.observer) this.observer.disconnect();
  }

  async loadMore() {
    if (this.loading || !this.nextUrl) return;

    this.loading = true;
    if (this.observer) this.observer.disconnect();
    if (this.spinner) this.spinner.classList.remove('hidden');

    try {
      const url = new URL(this.nextUrl, window.location.origin);
      url.searchParams.set('section_id', this.grid.dataset.id);

      const response = await fetch(url.toString());
      if (!response.ok) throw new Error('Failed to load more products');

      const html = await response.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const newGrid = doc.getElementById('product-grid');
      const newTrigger = doc.querySelector('infinite-scroll');

      if (newGrid) {
        newGrid.querySelectorAll(':scope > .grid__item').forEach((item) => {
          item.classList.add('scroll-trigger--cancel');
          this.grid.appendChild(document.importNode(item, true));
        });
      }

      const nextUrl = newTrigger?.dataset?.nextUrl;
      if (nextUrl) {
        this.nextUrl = nextUrl;
        this.dataset.nextUrl = nextUrl;
        this.loading = false;
        if (this.observer) this.observer.observe(this);
      } else {
        this.remove();
      }
    } catch (error) {
      console.error(error);
      this.loading = false;
      if (this.observer) this.observer.observe(this);
    } finally {
      if (this.spinner && this.isConnected) this.spinner.classList.add('hidden');
    }
  }
}

customElements.define('infinite-scroll', InfiniteScroll);
