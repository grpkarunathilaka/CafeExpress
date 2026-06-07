import { Component, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

interface CarouselSlide {
  image: string;
  title: string;
  subtitle: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);

  // Slides configuration
  public readonly slides: CarouselSlide[] = [
    {
      image: 'hero-interior.png',
      title: 'Warm & Inviting Spaces',
      subtitle: 'Experience traditional comfort in a contemporary dining setting, designed for catching up or winding down.'
    },
    {
      image: 'hero-coffee.png',
      title: 'Artisanal Specialty Coffee',
      subtitle: 'Carefully sourced single-origins and our signature house blend, extracted with micro-lot precision.'
    },
    {
      image: 'hero-brunch.png',
      title: 'Gourmet All-Day Brunch',
      subtitle: 'Artisanal sourdough spreads, hand-baked pastries, and fresh local kitchen meals prepared from scratch daily.'
    }
  ];

  public readonly activeSlide = signal<number>(0);
  private autoPlayIntervalId: any = null;

  ngOnInit(): void {
    this.startAutoPlay();
  }

  ngOnDestroy(): void {
    this.stopAutoPlay();
  }

  public nextSlide(): void {
    this.activeSlide.update(current => (current + 1) % this.slides.length);
    this.resetAutoPlay();
  }

  public prevSlide(): void {
    this.activeSlide.update(current => (current - 1 + this.slides.length) % this.slides.length);
    this.resetAutoPlay();
  }

  public goToSlide(index: number): void {
    this.activeSlide.set(index);
    this.resetAutoPlay();
  }

  public navigateToMenu(): void {
    this.router.navigate(['/menu']);
  }

  private startAutoPlay(): void {
    if (typeof window !== 'undefined') {
      this.autoPlayIntervalId = setInterval(() => {
        this.activeSlide.update(current => (current + 1) % this.slides.length);
      }, 6000); // Rotate slides every 6 seconds
    }
  }

  private stopAutoPlay(): void {
    if (this.autoPlayIntervalId) {
      clearInterval(this.autoPlayIntervalId);
      this.autoPlayIntervalId = null;
    }
  }

  private resetAutoPlay(): void {
    this.stopAutoPlay();
    this.startAutoPlay();
  }
}
