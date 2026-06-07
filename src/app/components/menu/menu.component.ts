import { Component, OnInit, AfterViewInit, OnDestroy, signal, computed, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MenuService } from '../../services/menu.service';
import { MenuItem } from '../../models/menu-item.model';
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './menu.component.html',
  styleUrl: './menu.component.css'
})
export class MenuComponent implements OnInit, AfterViewInit, OnDestroy {
  public readonly menuService = inject(MenuService);

  // Search and filter controls
  public readonly searchControl = new FormControl<string>('', { nonNullable: true });
  public readonly onlyVegetarian = signal<boolean>(false);
  public readonly onlyGlutenFree = signal<boolean>(false);

  // Convert FormControl to Signal for reactive computed variables
  public readonly searchQuery = toSignal(
    this.searchControl.valueChanges.pipe(startWith('')),
    { initialValue: '' }
  );

  // Active category tracked via IntersectionObserver
  public readonly activeCategory = signal<string>('');

  // Scroll tracking to avoid double updates during manual scroll leaps
  private isManualScrolling = false;
  private observer: IntersectionObserver | null = null;

  // Real-time client-side filtered menu
  public readonly filteredMenu = computed(() => {
    const items = this.menuService.menuItems();
    const query = this.searchQuery().toLowerCase().trim();
    const vegOnly = this.onlyVegetarian();
    const gfOnly = this.onlyGlutenFree();

    return items.filter(item => {
      const matchesSearch = !query || 
        item.ItemName.toLowerCase().includes(query) || 
        item.Description.toLowerCase().includes(query);
      const matchesVeg = !vegOnly || item.isVegetarian;
      const matchesGf = !gfOnly || item.isGlutenFree;
      return matchesSearch && matchesVeg && matchesGf;
    });
  });

  // Grouped filtered items
  public readonly groupedFilteredMenu = computed(() => {
    const items = this.filteredMenu();
    const grouped: { [key: string]: MenuItem[] } = {};

    for (const item of items) {
      if (!grouped[item.Category]) {
        grouped[item.Category] = [];
      }
      grouped[item.Category].push(item);
    }

    return grouped;
  });

  // Unique categories matching the active search filters
  public readonly filteredCategories = computed(() => {
    return Object.keys(this.groupedFilteredMenu());
  });

  constructor() {
    // Reactive effect to automatically re-observe DOM elements when items filter changes
    effect(() => {
      // Register dependency on filtered categories
      const categories = this.filteredCategories();
      if (categories.length > 0) {
        this.observeSections();
      }
    });
  }

  ngOnInit(): void {
    // If we have categories loaded, initialize the active category
    const initialCats = this.filteredCategories();
    if (initialCats.length > 0) {
      this.activeCategory.set(initialCats[0]);
    }
  }

  ngAfterViewInit(): void {
    this.setupIntersectionObserver();
  }

  ngOnDestroy(): void {
    if (this.observer) {
      this.observer.disconnect();
    }
  }

  public toggleVegetarian(): void {
    this.onlyVegetarian.update(val => !val);
  }

  public toggleGlutenFree(): void {
    this.onlyGlutenFree.update(val => !val);
  }

  public clearFilters(): void {
    this.searchControl.setValue('');
    this.onlyVegetarian.set(false);
    this.onlyGlutenFree.set(false);
  }

  public scrollToCategory(category: string): void {
    const element = document.getElementById(`category-${this.getCategoryId(category)}`);
    if (element) {
      this.isManualScrolling = true;
      this.activeCategory.set(category);

      // Scroll with smooth leaps, offset by the height of sticky headers (approx 140px)
      const yOffset = -140;
      const y = element.getBoundingClientRect().top + window.scrollY + yOffset;

      window.scrollTo({ top: y, behavior: 'smooth' });

      // Keep active category link focused and scroll categories bar
      this.scrollCategoryNav(category);

      // Re-enable scroll observer updates after scroll animation completes
      setTimeout(() => {
        this.isManualScrolling = false;
      }, 800);
    }
  }

  public getCategoryId(category: string): string {
    return category.toLowerCase().replace(/[^a-z0-9]/g, '-');
  }

  private setupIntersectionObserver(): void {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;

    const options = {
      root: null,
      rootMargin: '-150px 0px -55% 0px', // Focus window centered on upper viewport
      threshold: 0
    };

    this.observer = new IntersectionObserver((entries) => {
      if (this.isManualScrolling) return;

      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const categoryName = entry.target.getAttribute('data-category');
          if (categoryName) {
            this.activeCategory.set(categoryName);
            this.scrollCategoryNav(categoryName);
          }
        }
      });
    }, options);

    this.observeSections();
  }

  private observeSections(): void {
    // Run after Angular's change detection updates the DOM
    setTimeout(() => {
      if (!this.observer) return;
      
      // Remove all previous targets
      this.observer.disconnect();

      // Observe new category section elements
      const sections = document.querySelectorAll('.category-section');
      sections.forEach(section => {
        this.observer?.observe(section);
      });

      // Synchronize active category with the first visible one if current active is gone
      const currentCats = this.filteredCategories();
      if (currentCats.length > 0 && !currentCats.includes(this.activeCategory())) {
        this.activeCategory.set(currentCats[0]);
      }
    }, 120);
  }

  private scrollCategoryNav(category: string): void {
    const navId = `nav-${this.getCategoryId(category)}`;
    const navItem = document.getElementById(navId);
    const navBar = document.querySelector('.category-nav-bar');

    if (navItem && navBar) {
      const navBarRect = navBar.getBoundingClientRect();
      const navItemRect = navItem.getBoundingClientRect();

      // Check if nav item is out of view horizontally and scroll it in
      if (navItemRect.left < navBarRect.left || navItemRect.right > navBarRect.right) {
        const scrollLeft = navItem.offsetLeft - (navBarRect.width / 2) + (navItemRect.width / 2);
        navBar.scrollTo({ left: scrollLeft, behavior: 'smooth' });
      }
    }
  }
}
