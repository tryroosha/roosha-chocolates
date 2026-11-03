class DetailsDisclosure extends HTMLElement {
  constructor() {
    super();
    this.mainDetailsToggle = this.querySelector('details');
    this.content = this.mainDetailsToggle.querySelector('summary').nextElementSibling;

    this.mainDetailsToggle.addEventListener('focusout', this.onFocusOut.bind(this));
    this.mainDetailsToggle.addEventListener('toggle', this.onToggle.bind(this));
  }

  onFocusOut() {
    setTimeout(() => {
      if (!this.contains(document.activeElement)) this.close();
    });
  }

  onToggle() {
    if (!this.animations) this.animations = this.content.getAnimations();

    if (this.mainDetailsToggle.hasAttribute('open')) {
      this.animations.forEach((animation) => animation.play());
    } else {
      this.animations.forEach((animation) => animation.cancel());
    }
  }

  close() {
    this.mainDetailsToggle.removeAttribute('open');
    this.mainDetailsToggle.querySelector('summary').setAttribute('aria-expanded', false);
  }
}

customElements.define('details-disclosure', DetailsDisclosure);

class HeaderMenu extends DetailsDisclosure {
  constructor() {
    super();
    this.header = document.querySelector('.header-wrapper');
    this.closeTimeout = null;
    this.hoverMedia = window.matchMedia('(hover: hover) and (pointer: fine)');
    this.summary = this.mainDetailsToggle.querySelector('summary');

    this.onMouseEnter = this.onMouseEnter.bind(this);
    this.onMouseLeave = this.onMouseLeave.bind(this);
    this.onSummaryClick = this.onSummaryClick.bind(this);

    this.bindHover();
    if (typeof this.hoverMedia.addEventListener === 'function') {
      this.hoverMedia.addEventListener('change', this.bindHover.bind(this));
    } else if (typeof this.hoverMedia.addListener === 'function') {
      this.hoverMedia.addListener(this.bindHover.bind(this));
    }
  }

  bindHover() {
    this.removeEventListener('mouseenter', this.onMouseEnter);
    this.removeEventListener('mouseleave', this.onMouseLeave);
    this.summary.removeEventListener('click', this.onSummaryClick);

    if (!this.hoverMedia.matches) return;

    this.addEventListener('mouseenter', this.onMouseEnter);
    this.addEventListener('mouseleave', this.onMouseLeave);
    // Keep click from fighting hover open/close on desktop
    this.summary.addEventListener('click', this.onSummaryClick);
  }

  onSummaryClick(event) {
    if (!this.hoverMedia.matches) return;
    event.preventDefault();
  }

  onMouseEnter() {
    clearTimeout(this.closeTimeout);

    document.querySelectorAll('header-menu details[open]').forEach((details) => {
      if (details !== this.mainDetailsToggle) {
        details.removeAttribute('open');
        const summary = details.querySelector('summary');
        if (summary) summary.setAttribute('aria-expanded', 'false');
      }
    });

    this.mainDetailsToggle.setAttribute('open', '');
    this.summary.setAttribute('aria-expanded', 'true');
    this.onToggle();
  }

  onMouseLeave() {
    clearTimeout(this.closeTimeout);
    this.closeTimeout = setTimeout(() => {
      this.close();
      this.onToggle();
    }, 140);
  }

  onToggle() {
    if (!this.header) return;
    this.header.preventHide = this.mainDetailsToggle.open;

    if (document.documentElement.style.getPropertyValue('--header-bottom-position-desktop') !== '') return;
    document.documentElement.style.setProperty(
      '--header-bottom-position-desktop',
      `${Math.floor(this.header.getBoundingClientRect().bottom)}px`
    );
  }
}

customElements.define('header-menu', HeaderMenu);
