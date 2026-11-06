const skipLink = document.querySelector<HTMLAnchorElement>('a.skip-link');
const main = document.getElementById('main-content');
if (skipLink && main) {
  // Let the anchor scroll normally, then move focus for engines that only scroll.
  skipLink.addEventListener('click', () => requestAnimationFrame(() => main.focus({ preventScroll: true })));
}

function setupMobileMenu() {
    const btn = document.getElementById("mobile-menu-btn");
    const drawer = document.getElementById("mobile-nav-drawer");
    const iconOpen = document.getElementById("menu-icon-open");
    const iconClose = document.getElementById("menu-icon-close");
    const links = document.querySelectorAll(".mobile-nav-link");
    const headerEl = document.querySelector("header");

    if (!btn || !drawer) return;

    let isOpen = false;

    function getOutsideHeaderInteractiveElements(): HTMLElement[] {
      if (!headerEl || !drawer) return [];
      const elements = headerEl.querySelectorAll<HTMLElement>(
        'a, button, [tabindex]'
      );
      return Array.from(elements).filter(
        (el) => el !== btn && !drawer.contains(el)
      );
    }

    function getFocusableElements(): HTMLElement[] {
      if (!drawer) return [];
      const items = drawer.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      return Array.from(items);
    }

    function toggleMenu(open?: boolean, restoreFocus = true) {
      isOpen = open !== undefined ? open : !isOpen;
      btn?.setAttribute("aria-expanded", isOpen ? "true" : "false");
      btn?.setAttribute("aria-label", isOpen ? "Close navigation menu" : "Open navigation menu");

      const mainContent = document.getElementById("main-content");
      const footerEl = document.querySelector("footer");
      const outsideHeaderElements = getOutsideHeaderInteractiveElements();

      if (isOpen) {
        drawer?.classList.remove("-translate-y-full", "opacity-0", "pointer-events-none");
        drawer?.classList.add("translate-y-0", "opacity-100", "pointer-events-auto");
        drawer?.removeAttribute("aria-hidden");
        drawer?.removeAttribute("inert");

        // Isolate background from assistive technology & focus
        mainContent?.setAttribute("inert", "");
        mainContent?.setAttribute("aria-hidden", "true");
        footerEl?.setAttribute("inert", "");
        footerEl?.setAttribute("aria-hidden", "true");

        // Isolate background header elements outside active modal (Brand Logo & tablet CTA)
        outsideHeaderElements.forEach((el) => {
          el.setAttribute("inert", "");
          el.setAttribute("aria-hidden", "true");
        });

        iconOpen?.classList.add("hidden");
        iconClose?.classList.remove("hidden");
        document.body.style.overflow = "hidden";

        // Focus first link in drawer
        const focusables = getFocusableElements();
        if (focusables.length > 0) {
          requestAnimationFrame(() => {
            focusables[0]?.focus();
          });
        }
      } else {
        drawer?.classList.add("-translate-y-full", "opacity-0", "pointer-events-none");
        drawer?.classList.remove("translate-y-0", "opacity-100", "pointer-events-auto");
        drawer?.setAttribute("aria-hidden", "true");
        drawer?.setAttribute("inert", "");

        // Restore background accessibility
        mainContent?.removeAttribute("inert");
        mainContent?.removeAttribute("aria-hidden");
        footerEl?.removeAttribute("inert");
        footerEl?.removeAttribute("aria-hidden");

        // Restore background header elements
        outsideHeaderElements.forEach((el) => {
          el.removeAttribute("inert");
          el.removeAttribute("aria-hidden");
        });

        iconOpen?.classList.remove("hidden");
        iconClose?.classList.add("hidden");
        document.body.style.overflow = "";

        if (restoreFocus) {
          btn?.focus();
        }
      }
    }

    btn.addEventListener("click", () => toggleMenu());

    // Close menu when clicking any mobile link
    links.forEach((link) => {
      link.addEventListener("click", () => {
        if (isOpen) toggleMenu(false, false);
      });
    });

    // Keyboard navigation & Focus trapping
    document.addEventListener("keydown", (e) => {
      if (!isOpen) return;

      if (e.key === "Escape") {
        e.preventDefault();
        toggleMenu(false, true);
        return;
      }

      if (e.key === "Tab") {
        const focusables = [btn, ...getFocusableElements()];
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    });

    // Close when resizing above mobile breakpoint
    window.addEventListener("resize", () => {
      if (window.innerWidth >= 1280 && isOpen) {
        toggleMenu(false, false);
      }
    });
  }

  // Run on initial load and View Transitions
  setupMobileMenu();
